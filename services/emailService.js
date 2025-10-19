const nodemailer = require('nodemailer');
const winston = require('winston');

class EmailService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'email-service' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './logs/email-service.log' })
      ]
    });

    this.setupTransporter();
  }

  /**
   * Setup email transporter
   */
  setupTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });

      this.logger.info('Email transporter configured successfully');
    } catch (error) {
      this.logger.error('Error setting up email transporter', { error: error.message });
      throw error;
    }
  }

  /**
   * Send patient confirmation email
   */
  async sendConfirmationEmail(appointmentData, triageSummary) {
    try {
      const emailContent = await this.generateConfirmationEmailContent(appointmentData, triageSummary);
      
      const mailOptions = {
        from: process.env.CLINIC_EMAIL,
        to: appointmentData.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.info('Confirmation email sent successfully', {
        patientName: appointmentData.patientName,
        email: appointmentData.email,
        messageId: result.messageId
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error('Error sending confirmation email', {
        error: error.message,
        patientName: appointmentData.patientName,
        email: appointmentData.email
      });
      throw error;
    }
  }

  /**
   * Send appointment reminder email
   */
  async sendReminderEmail(appointmentData) {
    try {
      const emailContent = this.generateReminderEmailContent(appointmentData);
      
      const mailOptions = {
        from: process.env.CLINIC_EMAIL,
        to: appointmentData.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.info('Reminder email sent successfully', {
        patientName: appointmentData.patientName,
        email: appointmentData.email,
        appointmentDate: appointmentData.appointmentDate,
        messageId: result.messageId
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error('Error sending reminder email', {
        error: error.message,
        patientName: appointmentData.patientName,
        email: appointmentData.email
      });
      throw error;
    }
  }

  /**
   * Send triage summary to clinic staff
   */
  async sendTriageSummary(triageData) {
    try {
      const emailContent = this.generateTriageEmailContent(triageData);
      
      const mailOptions = {
        from: process.env.CLINIC_EMAIL,
        to: process.env.TRIAGE_EMAIL,
        cc: process.env.ADMIN_EMAIL,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.info('Triage summary sent successfully', {
        patientName: triageData.patientName,
        urgencyLevel: triageData.urgencyLevel,
        messageId: result.messageId
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error('Error sending triage summary', {
        error: error.message,
        patientName: triageData.patientName
      });
      throw error;
    }
  }

  /**
   * Send weekly report to clinic staff
   */
  async sendWeeklyReport(reportData) {
    try {
      const emailContent = this.generateWeeklyReportEmailContent(reportData);
      
      const mailOptions = {
        from: process.env.CLINIC_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.info('Weekly report sent successfully', {
        totalBookings: reportData.stats.totalBookings,
        messageId: result.messageId
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error('Error sending weekly report', {
        error: error.message,
        reportData: reportData
      });
      throw error;
    }
  }

  /**
   * Send error notification to admin
   */
  async sendErrorNotification(errorData) {
    try {
      const emailContent = this.generateErrorEmailContent(errorData);
      
      const mailOptions = {
        from: process.env.CLINIC_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.info('Error notification sent successfully', {
        errorType: errorData.type,
        messageId: result.messageId
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error('Error sending error notification', {
        error: error.message,
        originalError: errorData
      });
      throw error;
    }
  }

  /**
   * Generate confirmation email content
   */
  async generateConfirmationEmailContent(appointmentData, triageSummary) {
    const subject = `Appointment Confirmation - ${appointmentData.patientName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Appointment Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3CB6AD 0%, #2E8C83 100%); color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .appointment-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .urgent-notice { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${process.env.CLINIC_NAME}</h1>
            <p>Appointment Confirmation</p>
          </div>
          
          <div class="content">
            <h2>Dear ${appointmentData.patientName},</h2>
            
            <p>Thank you for scheduling your appointment with us. We have received your intake form and look forward to seeing you.</p>
            
            <div class="appointment-details">
              <h3>Appointment Details</h3>
              <p><strong>Date:</strong> ${appointmentData.appointmentDate}</p>
              <p><strong>Time:</strong> ${appointmentData.appointmentTime}</p>
              <p><strong>Visit Type:</strong> ${appointmentData.visitType}</p>
              <p><strong>Location:</strong> ${process.env.CLINIC_ADDRESS}</p>
              <p><strong>Phone:</strong> ${process.env.CLINIC_PHONE}</p>
            </div>
            
            ${triageSummary.urgencyLevel === 'High' ? `
            <div class="urgent-notice">
              <h3>Important Notice</h3>
              <p>Based on your intake form, we recommend that you contact us immediately if your symptoms worsen before your appointment, or seek emergency care if needed.</p>
            </div>
            ` : ''}
            
            <h3>What to Bring</h3>
            <ul>
              <li>Photo ID</li>
              <li>Insurance card</li>
              <li>List of current medications</li>
              <li>Any relevant medical records</li>
            </ul>
            
            <h3>Important Reminders</h3>
            <ul>
              <li>Please arrive 15 minutes early for check-in</li>
              <li>If you need to reschedule, please call us at least 24 hours in advance</li>
              <li>If you have any urgent symptoms, please contact us immediately</li>
            </ul>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>
            ${process.env.CLINIC_NAME}<br>
            ${process.env.CLINIC_PHONE}<br>
            ${process.env.CLINIC_EMAIL}</p>
          </div>
          
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} ${process.env.CLINIC_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Dear ${appointmentData.patientName},

Thank you for scheduling your appointment with ${process.env.CLINIC_NAME}.

APPOINTMENT DETAILS:
Date: ${appointmentData.appointmentDate}
Time: ${appointmentData.appointmentTime}
Visit Type: ${appointmentData.visitType}
Location: ${process.env.CLINIC_ADDRESS}
Phone: ${process.env.CLINIC_PHONE}

${triageSummary.urgencyLevel === 'High' ? 'IMPORTANT: Based on your intake form, please contact us immediately if your symptoms worsen before your appointment, or seek emergency care if needed.' : ''}

WHAT TO BRING:
- Photo ID
- Insurance card
- List of current medications
- Any relevant medical records

IMPORTANT REMINDERS:
- Please arrive 15 minutes early for check-in
- If you need to reschedule, please call us at least 24 hours in advance
- If you have any urgent symptoms, please contact us immediately

If you have any questions, please don't hesitate to contact us.

Best regards,
${process.env.CLINIC_NAME}
${process.env.CLINIC_PHONE}
${process.env.CLINIC_EMAIL}

This is an automated message. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Generate reminder email content
   */
  generateReminderEmailContent(appointmentData) {
    const subject = `Appointment Reminder - Tomorrow at ${appointmentData.appointmentTime}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Appointment Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3CB6AD 0%, #2E8C83 100%); color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .appointment-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${process.env.CLINIC_NAME}</h1>
            <p>Appointment Reminder</p>
          </div>
          
          <div class="content">
            <h2>Dear ${appointmentData.patientName},</h2>
            
            <p>This is a friendly reminder about your upcoming appointment.</p>
            
            <div class="appointment-details">
              <h3>Appointment Details</h3>
              <p><strong>Date:</strong> ${appointmentData.appointmentDate}</p>
              <p><strong>Time:</strong> ${appointmentData.appointmentTime}</p>
              <p><strong>Location:</strong> ${process.env.CLINIC_ADDRESS}</p>
              <p><strong>Phone:</strong> ${process.env.CLINIC_PHONE}</p>
            </div>
            
            <p>Please arrive 15 minutes early for check-in. If you need to reschedule, please call us as soon as possible.</p>
            
            <p>We look forward to seeing you!</p>
            
            <p>Best regards,<br>
            ${process.env.CLINIC_NAME}</p>
          </div>
          
          <div class="footer">
            <p>This is an automated reminder. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Dear ${appointmentData.patientName},

This is a friendly reminder about your upcoming appointment.

APPOINTMENT DETAILS:
Date: ${appointmentData.appointmentDate}
Time: ${appointmentData.appointmentTime}
Location: ${process.env.CLINIC_ADDRESS}
Phone: ${process.env.CLINIC_PHONE}

Please arrive 15 minutes early for check-in. If you need to reschedule, please call us as soon as possible.

We look forward to seeing you!

Best regards,
${process.env.CLINIC_NAME}

This is an automated reminder. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Generate triage email content
   */
  generateTriageEmailContent(triageData) {
    const subject = `Triage Alert - ${triageData.urgencyLevel} Priority - ${triageData.patientName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Triage Summary</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${triageData.urgencyLevel === 'High' ? '#dc3545' : triageData.urgencyLevel === 'Moderate' ? '#ffc107' : '#28a745'}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .patient-info { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .summary { background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Triage Summary</h1>
            <p>${triageData.urgencyLevel} Priority</p>
          </div>
          
          <div class="content">
            <div class="patient-info">
              <h3>Patient Information</h3>
              <p><strong>Name:</strong> ${triageData.patientName}</p>
              <p><strong>Appointment Date:</strong> ${triageData.appointmentDate}</p>
              <p><strong>Reason for Visit:</strong> ${triageData.reasonForVisit}</p>
            </div>
            
            <div class="summary">
              <h3>AI Analysis Summary</h3>
              <p><strong>Urgency Level:</strong> ${triageData.urgencyLevel}</p>
              <p><strong>Summary:</strong> ${triageData.aiSummary}</p>
              <p><strong>Risk Keywords:</strong> ${triageData.riskKeywords.join(', ')}</p>
              <p><strong>Recommendations:</strong> ${triageData.recommendations}</p>
              <p><strong>Follow-up Notes:</strong> ${triageData.followUpNotes}</p>
            </div>
            
            <p>Please review this information before the patient's appointment.</p>
          </div>
          
          <div class="footer">
            <p>Generated by myPCP Clinic Automation System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
TRIAGE SUMMARY - ${triageData.urgencyLevel} PRIORITY

Patient Information:
Name: ${triageData.patientName}
Appointment Date: ${triageData.appointmentDate}
Reason for Visit: ${triageData.reasonForVisit}

AI Analysis Summary:
Urgency Level: ${triageData.urgencyLevel}
Summary: ${triageData.aiSummary}
Risk Keywords: ${triageData.riskKeywords.join(', ')}
Recommendations: ${triageData.recommendations}
Follow-up Notes: ${triageData.followUpNotes}

Please review this information before the patient's appointment.

Generated by myPCP Clinic Automation System
    `;

    return { subject, html, text };
  }

  /**
   * Generate weekly report email content
   */
  generateWeeklyReportEmailContent(reportData) {
    const subject = `Weekly Clinic Report - ${new Date().toLocaleDateString()}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Weekly Clinic Report</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3CB6AD 0%, #2E8C83 100%); color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .metrics { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .section { margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Weekly Clinic Report</h1>
            <p>${process.env.CLINIC_NAME}</p>
          </div>
          
          <div class="content">
            <div class="metrics">
              <h3>Key Metrics</h3>
              <p><strong>Total Bookings:</strong> ${reportData.stats.totalBookings}</p>
              <p><strong>Completed Appointments:</strong> ${reportData.stats.completedAppointments}</p>
              <p><strong>No Shows:</strong> ${reportData.stats.noShows}</p>
              <p><strong>High Risk Triage Cases:</strong> ${reportData.stats.highRiskTriage}</p>
              <p><strong>No-Show Rate:</strong> ${reportData.stats.noShowRate}%</p>
              <p><strong>Completion Rate:</strong> ${reportData.stats.completionRate}%</p>
            </div>
            
            <div class="section">
              <h3>Executive Summary</h3>
              <p>${reportData.aiReport.executiveSummary}</p>
            </div>
            
            <div class="section">
              <h3>Trends</h3>
              <p>${reportData.aiReport.trends}</p>
            </div>
            
            <div class="section">
              <h3>Recommendations</h3>
              <ul>
                ${reportData.aiReport.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            </div>
            
            ${reportData.aiReport.alerts.length > 0 ? `
            <div class="section">
              <h3>Alerts</h3>
              <ul>
                ${reportData.aiReport.alerts.map(alert => `<li>${alert}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            
            <div class="section">
              <h3>Next Week Focus</h3>
              <p>${reportData.aiReport.nextWeekFocus}</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Generated by myPCP Clinic Automation System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
WEEKLY CLINIC REPORT - ${process.env.CLINIC_NAME}

Key Metrics:
- Total Bookings: ${reportData.stats.totalBookings}
- Completed Appointments: ${reportData.stats.completedAppointments}
- No Shows: ${reportData.stats.noShows}
- High Risk Triage Cases: ${reportData.stats.highRiskTriage}
- No-Show Rate: ${reportData.stats.noShowRate}%
- Completion Rate: ${reportData.stats.completionRate}%

Executive Summary:
${reportData.aiReport.executiveSummary}

Trends:
${reportData.aiReport.trends}

Recommendations:
${reportData.aiReport.recommendations.map(rec => `- ${rec}`).join('\n')}

${reportData.aiReport.alerts.length > 0 ? `Alerts:\n${reportData.aiReport.alerts.map(alert => `- ${alert}`).join('\n')}\n` : ''}

Next Week Focus:
${reportData.aiReport.nextWeekFocus}

Generated by myPCP Clinic Automation System
    `;

    return { subject, html, text };
  }

  /**
   * Generate error notification email content
   */
  generateErrorEmailContent(errorData) {
    const subject = `System Error Alert - ${errorData.type}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>System Error Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .error-details { background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>System Error Alert</h1>
            <p>${process.env.CLINIC_NAME} Automation System</p>
          </div>
          
          <div class="content">
            <div class="error-details">
              <h3>Error Details</h3>
              <p><strong>Type:</strong> ${errorData.type}</p>
              <p><strong>Time:</strong> ${errorData.timestamp}</p>
              <p><strong>Message:</strong> ${errorData.message}</p>
              <p><strong>Stack Trace:</strong></p>
              <pre>${errorData.stack}</pre>
            </div>
            
            <p>Please investigate this error and take appropriate action.</p>
          </div>
          
          <div class="footer">
            <p>Generated by myPCP Clinic Automation System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
SYSTEM ERROR ALERT - ${process.env.CLINIC_NAME} AUTOMATION SYSTEM

Error Details:
Type: ${errorData.type}
Time: ${errorData.timestamp}
Message: ${errorData.message}

Stack Trace:
${errorData.stack}

Please investigate this error and take appropriate action.

Generated by myPCP Clinic Automation System
    `;

    return { subject, html, text };
  }
}

module.exports = EmailService;
