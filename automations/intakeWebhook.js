const winston = require('winston');

class IntakeWebhook {
  constructor(googleService, aiService, emailService) {
    this.googleService = googleService;
    this.aiService = aiService;
    this.emailService = emailService;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'intake-webhook' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './logs/intake-webhook.log' })
      ]
    });
  }

  /**
   * Handle form submission from Formspree webhook
   */
  async handleFormSubmission(formData) {
    try {
      this.logger.info('Processing intake form submission', {
        patientName: formData.fullName,
        email: formData.email
      });

      // Step 1: Add patient intake data to Google Sheets
      await this.googleService.addPatientIntake(formData);
      this.logger.info('Patient intake data added to Google Sheets');

      // Step 2: Generate AI triage summary
      const triageSummary = await this.aiService.summarizeIntake(formData);
      this.logger.info('AI triage summary generated', {
        urgencyLevel: triageSummary.urgencyLevel
      });

      // Step 3: Add triage summary to Google Sheets
      const triageData = {
        patientName: formData.fullName,
        appointmentDate: formData.appointmentDate,
        reasonForVisit: formData.reasonForVisit,
        aiSummary: triageSummary.summary,
        urgencyLevel: triageSummary.urgencyLevel,
        riskKeywords: triageSummary.riskKeywords.join(', '),
        recommendations: triageSummary.recommendations,
        formId: formData.formId
      };

      await this.googleService.addTriageSummary(triageData);
      this.logger.info('Triage summary added to Google Sheets');

      // Step 4: Send triage summary to clinic staff
      await this.emailService.sendTriageSummary(triageData);
      this.logger.info('Triage summary sent to clinic staff');

      // Step 5: Send confirmation email to patient
      const appointmentData = {
        patientName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        visitType: formData.visitType || 'General Consultation'
      };

      await this.emailService.sendConfirmationEmail(appointmentData, triageSummary);
      this.logger.info('Confirmation email sent to patient');

      // Step 6: Create Google Calendar event if appointment details are available
      if (formData.appointmentDate && formData.appointmentTime) {
        try {
          const calendarEvent = await this.googleService.createCalendarEvent(appointmentData);
          this.logger.info('Google Calendar event created', {
            eventId: calendarEvent.id
          });
        } catch (error) {
          this.logger.error('Error creating Google Calendar event', {
            error: error.message
          });
          // Don't fail the entire process for calendar errors
        }
      }

      // Step 7: Log analytics data
      await this.logAnalyticsEvent('intake_form_processed', {
        patientName: formData.fullName,
        urgencyLevel: triageSummary.urgencyLevel,
        hasAppointment: !!(formData.appointmentDate && formData.appointmentTime)
      });

      this.logger.info('Intake form processing completed successfully', {
        patientName: formData.fullName,
        formId: formData.formId
      });

      return {
        success: true,
        formId: formData.formId,
        urgencyLevel: triageSummary.urgencyLevel,
        triageSummary: triageSummary
      };

    } catch (error) {
      this.logger.error('Error processing intake form submission', {
        error: error.message,
        stack: error.stack,
        formData: formData
      });

      // Send error notification to admin
      try {
        await this.emailService.sendErrorNotification({
          type: 'intake_form_processing_error',
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          formData: formData
        });
      } catch (emailError) {
        this.logger.error('Error sending error notification', {
          error: emailError.message
        });
      }

      throw error;
    }
  }

  /**
   * Handle appointment booking from Calendly webhook
   */
  async handleAppointmentBooking(appointmentData) {
    try {
      this.logger.info('Processing appointment booking', {
        patientName: appointmentData.patientName,
        appointmentDate: appointmentData.appointmentDate
      });

      // Step 1: Add appointment to Google Sheets
      await this.googleService.addAppointment(appointmentData);
      this.logger.info('Appointment data added to Google Sheets');

      // Step 2: Create Google Calendar event
      const calendarEvent = await this.googleService.createCalendarEvent(appointmentData);
      this.logger.info('Google Calendar event created', {
        eventId: calendarEvent.id
      });

      // Step 3: Update appointment with Google Calendar event ID
      appointmentData.googleCalendarEventId = calendarEvent.id;

      // Step 4: Log analytics data
      await this.logAnalyticsEvent('appointment_booked', {
        patientName: appointmentData.patientName,
        appointmentDate: appointmentData.appointmentDate,
        visitType: appointmentData.visitType
      });

      this.logger.info('Appointment booking processing completed successfully', {
        patientName: appointmentData.patientName,
        calendlyEventId: appointmentData.calendlyEventId
      });

      return {
        success: true,
        calendlyEventId: appointmentData.calendlyEventId,
        googleCalendarEventId: calendarEvent.id
      };

    } catch (error) {
      this.logger.error('Error processing appointment booking', {
        error: error.message,
        stack: error.stack,
        appointmentData: appointmentData
      });

      // Send error notification to admin
      try {
        await this.emailService.sendErrorNotification({
          type: 'appointment_booking_error',
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          appointmentData: appointmentData
        });
      } catch (emailError) {
        this.logger.error('Error sending error notification', {
          error: emailError.message
        });
      }

      throw error;
    }
  }

  /**
   * Process batch of form submissions
   */
  async processBatchSubmissions(formSubmissions) {
    try {
      this.logger.info(`Processing batch of ${formSubmissions.length} form submissions`);

      const results = [];
      const errors = [];

      for (const formData of formSubmissions) {
        try {
          const result = await this.handleFormSubmission(formData);
          results.push(result);
        } catch (error) {
          this.logger.error('Error processing form submission in batch', {
            error: error.message,
            formData: formData
          });
          errors.push({
            formData: formData,
            error: error.message
          });
        }
      }

      this.logger.info('Batch processing completed', {
        successful: results.length,
        failed: errors.length
      });

      return {
        success: true,
        results: results,
        errors: errors
      };

    } catch (error) {
      this.logger.error('Error processing batch submissions', {
        error: error.message,
        batchSize: formSubmissions.length
      });
      throw error;
    }
  }

  /**
   * Validate form data before processing
   */
  validateFormData(formData) {
    const requiredFields = ['fullName', 'email', 'dob'];
    const missingFields = [];

    requiredFields.forEach(field => {
      if (!formData[field] || formData[field].trim() === '') {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      throw new Error('Invalid email format');
    }

    // Validate date of birth
    const dob = new Date(formData.dob);
    if (isNaN(dob.getTime())) {
      throw new Error('Invalid date of birth format');
    }

    return true;
  }

  /**
   * Extract appointment information from form data
   */
  extractAppointmentInfo(formData) {
    const appointmentInfo = {
      appointmentDate: formData.appointmentDate || '',
      appointmentTime: formData.appointmentTime || '',
      visitType: formData.visitType || 'General Consultation'
    };

    // If no explicit appointment info, try to extract from other fields
    if (!appointmentInfo.appointmentDate) {
      const dateFields = ['preferred_date', 'requested_date', 'date'];
      for (const field of dateFields) {
        if (formData[field]) {
          appointmentInfo.appointmentDate = formData[field];
          break;
        }
      }
    }

    if (!appointmentInfo.appointmentTime) {
      const timeFields = ['preferred_time', 'requested_time', 'time'];
      for (const field of timeFields) {
        if (formData[field]) {
          appointmentInfo.appointmentTime = formData[field];
          break;
        }
      }
    }

    return appointmentInfo;
  }

  /**
   * Check for high-risk indicators in form data
   */
  checkForRiskIndicators(formData) {
    const riskKeywords = [
      'chest pain', 'difficulty breathing', 'shortness of breath', 'severe pain',
      'emergency', 'urgent', 'critical', 'life threatening', 'suicide', 'self harm',
      'medication reaction', 'allergic reaction', 'anaphylaxis', 'stroke',
      'heart attack', 'severe bleeding', 'unconscious', 'high fever'
    ];

    const foundKeywords = [];
    const textToSearch = [
      formData.reasonForVisit,
      formData.currentMedications,
      formData.allergies,
      formData.pastConditions,
      formData.additionalNotes
    ].join(' ').toLowerCase();

    riskKeywords.forEach(keyword => {
      if (textToSearch.includes(keyword.toLowerCase())) {
        foundKeywords.push(keyword);
      }
    });

    return {
      hasRiskIndicators: foundKeywords.length > 0,
      riskKeywords: foundKeywords,
      riskLevel: foundKeywords.length > 3 ? 'High' : foundKeywords.length > 1 ? 'Moderate' : 'Low'
    };
  }

  /**
   * Log analytics event
   */
  async logAnalyticsEvent(eventType, eventData) {
    try {
      const analyticsData = {
        timestamp: new Date().toISOString(),
        eventType: eventType,
        ...eventData
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
            analyticsData.patientName || '',
            analyticsData.urgencyLevel || '',
            analyticsData.appointmentDate || '',
            analyticsData.visitType || '',
            analyticsData.hasAppointment || false,
            '', // Additional fields can be added as needed
            '', '', '', '', '', '', '', '', '', '', '', ''
          ]]
        }
      });

      this.logger.info('Analytics event logged', {
        eventType: eventType,
        eventData: eventData
      });

    } catch (error) {
      this.logger.error('Error logging analytics event', {
        error: error.message,
        eventType: eventType,
        eventData: eventData
      });
      // Don't throw error for analytics logging failures
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats() {
    try {
      const stats = await this.googleService.getDashboardStats();
      
      return {
        totalIntakeForms: stats.totalBookings,
        highRiskTriage: stats.highRiskTriage,
        averageProcessingTime: 'N/A', // Could be calculated from logs
        lastProcessed: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error getting processing stats', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retry failed form processing
   */
  async retryFailedProcessing(formData, maxRetries = 3) {
    let retryCount = 0;
    let lastError = null;

    while (retryCount < maxRetries) {
      try {
        this.logger.info(`Retrying form processing (attempt ${retryCount + 1})`, {
          formId: formData.formId
        });

        const result = await this.handleFormSubmission(formData);
        
        this.logger.info('Form processing retry successful', {
          formId: formData.formId,
          attempt: retryCount + 1
        });

        return result;

      } catch (error) {
        lastError = error;
        retryCount++;
        
        this.logger.error(`Form processing retry failed (attempt ${retryCount})`, {
          error: error.message,
          formId: formData.formId
        });

        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    this.logger.error('Form processing retry exhausted', {
      formId: formData.formId,
      maxRetries: maxRetries,
      lastError: lastError.message
    });

    throw lastError;
  }
}

module.exports = IntakeWebhook;
