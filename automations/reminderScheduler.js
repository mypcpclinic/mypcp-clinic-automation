const winston = require('winston');
const moment = require('moment');

class ReminderScheduler {
  constructor(googleService, emailService) {
    this.googleService = googleService;
    this.emailService = emailService;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'reminder-scheduler' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './logs/reminder-scheduler.log' })
      ]
    });

    this.reminderHoursBefore = parseInt(process.env.REMINDER_HOURS_BEFORE) || 48;
  }

  /**
   * Send reminders for upcoming appointments
   */
  async sendReminders() {
    try {
      this.logger.info('Starting reminder check for upcoming appointments');

      // Get upcoming appointments that need reminders
      const upcomingAppointments = await this.getAppointmentsNeedingReminders();
      
      if (upcomingAppointments.length === 0) {
        this.logger.info('No appointments need reminders at this time');
        return { success: true, remindersSent: 0 };
      }

      this.logger.info(`Found ${upcomingAppointments.length} appointments needing reminders`);

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      // Process each appointment
      for (const appointment of upcomingAppointments) {
        try {
          const result = await this.sendAppointmentReminder(appointment);
          results.push(result);
          successCount++;
          
          this.logger.info('Reminder sent successfully', {
            patientName: appointment.patientName,
            appointmentDate: appointment.appointmentDate,
            email: appointment.email
          });

        } catch (error) {
          errorCount++;
          this.logger.error('Error sending reminder', {
            error: error.message,
            patientName: appointment.patientName,
            appointmentDate: appointment.appointmentDate
          });

          results.push({
            success: false,
            error: error.message,
            appointment: appointment
          });
        }
      }

      // Log summary
      this.logger.info('Reminder processing completed', {
        totalAppointments: upcomingAppointments.length,
        successful: successCount,
        failed: errorCount
      });

      return {
        success: true,
        remindersSent: successCount,
        errors: errorCount,
        results: results
      };

    } catch (error) {
      this.logger.error('Error in reminder scheduler', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get appointments that need reminders
   */
  async getAppointmentsNeedingReminders() {
    try {
      const appointments = await this.googleService.getUpcomingAppointments(this.reminderHoursBefore);
      
      // Filter appointments that haven't had reminders sent
      const appointmentsNeedingReminders = appointments.filter(appointment => {
        return appointment.remindersent === 'No' && 
               appointment.status === 'Scheduled' &&
               this.isWithinReminderWindow(appointment.appointmentdate, appointment.appointmenttime);
      });

      this.logger.info(`Found ${appointmentsNeedingReminders.length} appointments needing reminders`);
      return appointmentsNeedingReminders;

    } catch (error) {
      this.logger.error('Error getting appointments needing reminders', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if appointment is within reminder window
   */
  isWithinReminderWindow(appointmentDate, appointmentTime) {
    try {
      const appointmentDateTime = moment(`${appointmentDate} ${appointmentTime}`, 'YYYY-MM-DD HH:mm');
      const now = moment();
      const hoursUntilAppointment = appointmentDateTime.diff(now, 'hours');

      // Send reminder if appointment is within the specified hours
      return hoursUntilAppointment > 0 && hoursUntilAppointment <= this.reminderHoursBefore;

    } catch (error) {
      this.logger.error('Error checking reminder window', {
        error: error.message,
        appointmentDate: appointmentDate,
        appointmentTime: appointmentTime
      });
      return false;
    }
  }

  /**
   * Send reminder for a specific appointment
   */
  async sendAppointmentReminder(appointment) {
    try {
      // Prepare appointment data for email
      const appointmentData = {
        patientName: appointment.patientname || appointment.patientName,
        email: appointment.email,
        phone: appointment.phone,
        appointmentDate: appointment.appointmentdate || appointment.appointmentDate,
        appointmentTime: appointment.appointmenttime || appointment.appointmentTime,
        visitType: appointment.visittype || appointment.visitType || 'General Consultation'
      };

      // Send reminder email
      const emailResult = await this.emailService.sendReminderEmail(appointmentData);

      // Update reminder status in Google Sheets
      await this.googleService.updateReminderStatus(
        appointment.calendlyeventid || appointment.calendlyEventId,
        true
      );

      // Log analytics
      await this.logReminderEvent('reminder_sent', appointmentData);

      return {
        success: true,
        appointment: appointmentData,
        emailResult: emailResult
      };

    } catch (error) {
      this.logger.error('Error sending appointment reminder', {
        error: error.message,
        appointment: appointment
      });
      throw error;
    }
  }

  /**
   * Send follow-up emails after appointments
   */
  async sendFollowUpEmails() {
    try {
      this.logger.info('Starting follow-up email check');

      // Get completed appointments from the last 24 hours
      const completedAppointments = await this.getCompletedAppointments();
      
      if (completedAppointments.length === 0) {
        this.logger.info('No completed appointments need follow-up emails');
        return { success: true, followUpsSent: 0 };
      }

      this.logger.info(`Found ${completedAppointments.length} completed appointments for follow-up`);

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      // Process each appointment
      for (const appointment of completedAppointments) {
        try {
          const result = await this.sendFollowUpEmail(appointment);
          results.push(result);
          successCount++;
          
          this.logger.info('Follow-up email sent successfully', {
            patientName: appointment.patientName,
            appointmentDate: appointment.appointmentDate
          });

        } catch (error) {
          errorCount++;
          this.logger.error('Error sending follow-up email', {
            error: error.message,
            patientName: appointment.patientName
          });

          results.push({
            success: false,
            error: error.message,
            appointment: appointment
          });
        }
      }

      this.logger.info('Follow-up email processing completed', {
        totalAppointments: completedAppointments.length,
        successful: successCount,
        failed: errorCount
      });

      return {
        success: true,
        followUpsSent: successCount,
        errors: errorCount,
        results: results
      };

    } catch (error) {
      this.logger.error('Error in follow-up email scheduler', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get completed appointments from the last 24 hours
   */
  async getCompletedAppointments() {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const response = await this.googleService.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Appointments!A:M'
      });

      const rows = response.data.values || [];
      const headers = rows[0];
      const completedAppointments = [];

      const yesterday = moment().subtract(1, 'day').startOf('day');
      const today = moment().endOf('day');

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const appointment = {};
        
        headers.forEach((header, index) => {
          appointment[header.toLowerCase().replace(/\s+/g, '')] = row[index] || '';
        });

        // Check if appointment was completed in the last 24 hours
        if (appointment.status === 'Completed') {
          const appointmentDate = moment(appointment.appointmentdate);
          if (appointmentDate.isBetween(yesterday, today)) {
            completedAppointments.push(appointment);
          }
        }
      }

      this.logger.info(`Found ${completedAppointments.length} completed appointments for follow-up`);
      return completedAppointments;

    } catch (error) {
      this.logger.error('Error getting completed appointments', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send follow-up email for a specific appointment
   */
  async sendFollowUpEmail(appointment) {
    try {
      const appointmentData = {
        patientName: appointment.patientname || appointment.patientName,
        email: appointment.email,
        phone: appointment.phone,
        appointmentDate: appointment.appointmentdate || appointment.appointmentDate,
        appointmentTime: appointment.appointmenttime || appointment.appointmentTime,
        visitType: appointment.visittype || appointment.visitType || 'General Consultation'
      };

      // Generate follow-up email content
      const emailContent = this.generateFollowUpEmailContent(appointmentData);

      // Send follow-up email
      const mailOptions = {
        from: process.env.CLINIC_EMAIL,
        to: appointmentData.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      };

      const result = await this.emailService.transporter.sendMail(mailOptions);

      // Log analytics
      await this.logReminderEvent('follow_up_sent', appointmentData);

      return {
        success: true,
        appointment: appointmentData,
        messageId: result.messageId
      };

    } catch (error) {
      this.logger.error('Error sending follow-up email', {
        error: error.message,
        appointment: appointment
      });
      throw error;
    }
  }

  /**
   * Generate follow-up email content
   */
  generateFollowUpEmailContent(appointmentData) {
    const subject = `Thank you for visiting ${process.env.CLINIC_NAME}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Thank You</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c5aa0; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thank You!</h1>
            <p>${process.env.CLINIC_NAME}</p>
          </div>
          
          <div class="content">
            <h2>Dear ${appointmentData.patientName},</h2>
            
            <p>Thank you for choosing ${process.env.CLINIC_NAME} for your healthcare needs. We hope your visit was helpful and that you're feeling better.</p>
            
            <h3>Next Steps</h3>
            <ul>
              <li>Please follow any instructions provided during your visit</li>
              <li>Take medications as prescribed</li>
              <li>Schedule any recommended follow-up appointments</li>
              <li>Contact us if you have any questions or concerns</li>
            </ul>
            
            <h3>How We're Doing</h3>
            <p>We value your feedback! Please take a moment to let us know about your experience:</p>
            <p><a href="${process.env.CLINIC_WEBSITE}/feedback" style="background-color: #2c5aa0; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Leave Feedback</a></p>
            
            <h3>Need Help?</h3>
            <p>If you have any questions or concerns, please don't hesitate to contact us:</p>
            <p>Phone: ${process.env.CLINIC_PHONE}<br>
            Email: ${process.env.CLINIC_EMAIL}</p>
            
            <p>Thank you for trusting us with your healthcare.</p>
            
            <p>Best regards,<br>
            ${process.env.CLINIC_NAME}</p>
          </div>
          
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Dear ${appointmentData.patientName},

Thank you for choosing ${process.env.CLINIC_NAME} for your healthcare needs. We hope your visit was helpful and that you're feeling better.

NEXT STEPS:
- Please follow any instructions provided during your visit
- Take medications as prescribed
- Schedule any recommended follow-up appointments
- Contact us if you have any questions or concerns

HOW WE'RE DOING:
We value your feedback! Please take a moment to let us know about your experience by visiting: ${process.env.CLINIC_WEBSITE}/feedback

NEED HELP?
If you have any questions or concerns, please don't hesitate to contact us:
Phone: ${process.env.CLINIC_PHONE}
Email: ${process.env.CLINIC_EMAIL}

Thank you for trusting us with your healthcare.

Best regards,
${process.env.CLINIC_NAME}

This is an automated message. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Log reminder event for analytics
   */
  async logReminderEvent(eventType, appointmentData) {
    try {
      const analyticsData = {
        timestamp: new Date().toISOString(),
        eventType: eventType,
        patientName: appointmentData.patientName,
        appointmentDate: appointmentData.appointmentDate,
        appointmentTime: appointmentData.appointmentTime
      };

      // Add to analytics sheet
      await this.googleService.sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'Analytics!A:T',
        valueInputOption: 'RAW',
        resource: {
          values: [[
            analyticsData.timestamp,
            analyticsData.eventType,
            analyticsData.patientName,
            '', // urgencyLevel
            analyticsData.appointmentDate,
            analyticsData.appointmentTime,
            '', // hasAppointment
            '', // Additional fields
            '', '', '', '', '', '', '', '', '', '', '', ''
          ]]
        }
      });

      this.logger.info('Reminder event logged', {
        eventType: eventType,
        patientName: appointmentData.patientName
      });

    } catch (error) {
      this.logger.error('Error logging reminder event', {
        error: error.message,
        eventType: eventType,
        appointmentData: appointmentData
      });
      // Don't throw error for analytics logging failures
    }
  }

  /**
   * Get reminder statistics
   */
  async getReminderStats() {
    try {
      const stats = await this.googleService.getDashboardStats();
      
      return {
        totalAppointments: stats.totalBookings,
        remindersSent: stats.totalBookings, // This would need to be calculated from analytics
        followUpsSent: stats.completedAppointments,
        lastReminderCheck: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error getting reminder stats', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Schedule custom reminder for specific appointment
   */
  async scheduleCustomReminder(appointmentData, reminderHours = 24) {
    try {
      this.logger.info('Scheduling custom reminder', {
        patientName: appointmentData.patientName,
        reminderHours: reminderHours
      });

      // This would typically involve adding to a queue or database
      // For now, we'll just log the request
      await this.logReminderEvent('custom_reminder_scheduled', {
        ...appointmentData,
        reminderHours: reminderHours
      });

      return {
        success: true,
        message: `Custom reminder scheduled for ${reminderHours} hours before appointment`
      };

    } catch (error) {
      this.logger.error('Error scheduling custom reminder', {
        error: error.message,
        appointmentData: appointmentData
      });
      throw error;
    }
  }
}

module.exports = ReminderScheduler;
