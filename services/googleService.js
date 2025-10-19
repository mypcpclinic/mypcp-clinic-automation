const { google } = require('googleapis');
const winston = require('winston');

class GoogleService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'google-service' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './logs/google-service.log' })
      ]
    });

    // Use Service Account authentication if available, otherwise fall back to OAuth
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/calendar'
        ]
      });
    } else {
      // Fallback to OAuth2
      this.auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      if (process.env.GOOGLE_REFRESH_TOKEN) {
        this.auth.setCredentials({
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });
      }
    }

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  /**
   * Initialize Google Sheets with required headers
   */
  async initializeSheets() {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      
      // Define sheet structure
      const requests = [
        {
          addSheet: {
            properties: {
              title: 'Patient Intake',
              gridProperties: { rowCount: 1000, columnCount: 20 }
            }
          }
        },
        {
          addSheet: {
            properties: {
              title: 'Appointments',
              gridProperties: { rowCount: 1000, columnCount: 15 }
            }
          }
        },
        {
          addSheet: {
            properties: {
              title: 'Triage Summary',
              gridProperties: { rowCount: 1000, columnCount: 10 }
            }
          }
        },
        {
          addSheet: {
            properties: {
              title: 'Analytics',
              gridProperties: { rowCount: 1000, columnCount: 20 }
            }
          }
        }
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        resource: { requests }
      });

      // Add headers to each sheet
      await this.addSheetHeaders();
      
      this.logger.info('Google Sheets initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing Google Sheets', { error: error.message });
      throw error;
    }
  }

  /**
   * Add headers to all sheets
   */
  async addSheetHeaders() {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    const headers = {
      'Patient Intake': [
        'Timestamp', 'Full Name', 'DOB', 'Email', 'Phone', 'Address', 
        'Reason for Visit', 'Current Medications', 'Allergies', 'Past Conditions',
        'Insurance Provider', 'Insurance ID', 'Emergency Contact', 'Emergency Phone',
        'Form ID', 'Appointment Date', 'Appointment Time', 'Status'
      ],
      'Appointments': [
        'Timestamp', 'Patient Name', 'Email', 'Phone', 'Appointment Date', 
        'Appointment Time', 'Visit Type', 'Status', 'Calendly Event ID',
        'Google Calendar Event ID', 'Reminder Sent', 'Confirmation Sent', 'Notes'
      ],
      'Triage Summary': [
        'Timestamp', 'Patient Name', 'Appointment Date', 'Reason for Visit',
        'AI Summary', 'Urgency Level', 'Risk Keywords', 'Recommendations',
        'Form ID', 'Processed By'
      ],
      'Analytics': [
        'Date', 'Total Bookings', 'Completed Appointments', 'No Shows',
        'High Risk Triage', 'Average Daily Bookings', 'Reminder Sent',
        'Confirmations Sent', 'Weekly Summary'
      ]
    };

    for (const [sheetName, headerRow] of Object.entries(headers)) {
      try {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${sheetName}!A1:${String.fromCharCode(65 + headerRow.length - 1)}1`,
          valueInputOption: 'RAW',
          resource: {
            values: [headerRow]
          }
        });
      } catch (error) {
        this.logger.error(`Error adding headers to ${sheetName}`, { error: error.message });
      }
    }
  }

  /**
   * Add patient intake data to Google Sheets
   */
  async addPatientIntake(formData) {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const timestamp = new Date().toISOString();
      
      const rowData = [
        timestamp,
        formData.fullName || '',
        formData.dob || '',
        formData.email || '',
        formData.phone || '',
        formData.address || '',
        formData.reasonForVisit || '',
        formData.currentMedications || '',
        formData.allergies || '',
        formData.pastConditions || '',
        formData.insuranceProvider || '',
        formData.insuranceId || '',
        formData.emergencyContact || '',
        formData.emergencyPhone || '',
        formData.formId || '',
        formData.appointmentDate || '',
        formData.appointmentTime || '',
        'New'
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Patient Intake!A:T',
        valueInputOption: 'RAW',
        resource: {
          values: [rowData]
        }
      });

      this.logger.info('Patient intake data added to Google Sheets', { 
        patientName: formData.fullName,
        timestamp 
      });

      return { success: true, timestamp };
    } catch (error) {
      this.logger.error('Error adding patient intake to Google Sheets', { 
        error: error.message,
        formData: formData 
      });
      throw error;
    }
  }

  /**
   * Add appointment data to Google Sheets
   */
  async addAppointment(appointmentData) {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const timestamp = new Date().toISOString();
      
      const rowData = [
        timestamp,
        appointmentData.patientName || '',
        appointmentData.email || '',
        appointmentData.phone || '',
        appointmentData.appointmentDate || '',
        appointmentData.appointmentTime || '',
        appointmentData.visitType || '',
        'Scheduled',
        appointmentData.calendlyEventId || '',
        appointmentData.googleCalendarEventId || '',
        'No',
        'No',
        appointmentData.notes || ''
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Appointments!A:M',
        valueInputOption: 'RAW',
        resource: {
          values: [rowData]
        }
      });

      this.logger.info('Appointment data added to Google Sheets', { 
        patientName: appointmentData.patientName,
        appointmentDate: appointmentData.appointmentDate 
      });

      return { success: true, timestamp };
    } catch (error) {
      this.logger.error('Error adding appointment to Google Sheets', { 
        error: error.message,
        appointmentData: appointmentData 
      });
      throw error;
    }
  }

  /**
   * Add triage summary to Google Sheets
   */
  async addTriageSummary(triageData) {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const timestamp = new Date().toISOString();
      
      const rowData = [
        timestamp,
        triageData.patientName || '',
        triageData.appointmentDate || '',
        triageData.reasonForVisit || '',
        triageData.aiSummary || '',
        triageData.urgencyLevel || '',
        triageData.riskKeywords || '',
        triageData.recommendations || '',
        triageData.formId || '',
        'AI System'
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Triage Summary!A:J',
        valueInputOption: 'RAW',
        resource: {
          values: [rowData]
        }
      });

      this.logger.info('Triage summary added to Google Sheets', { 
        patientName: triageData.patientName,
        urgencyLevel: triageData.urgencyLevel 
      });

      return { success: true, timestamp };
    } catch (error) {
      this.logger.error('Error adding triage summary to Google Sheets', { 
        error: error.message,
        triageData: triageData 
      });
      throw error;
    }
  }

  /**
   * Get upcoming appointments for reminders
   */
  async getUpcomingAppointments(hoursAhead = 48) {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Appointments!A:M'
      });

      const rows = response.data.values || [];
      const headers = rows[0];
      const appointments = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const appointment = {};
        
        headers.forEach((header, index) => {
          appointment[header.toLowerCase().replace(/\s+/g, '')] = row[index] || '';
        });

        // Check if appointment is within the specified hours
        const appointmentDateTime = new Date(`${appointment.appointmentdate} ${appointment.appointmenttime}`);
        const now = new Date();
        const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60);

        if (hoursUntilAppointment > 0 && hoursUntilAppointment <= hoursAhead && appointment.remindersent === 'No') {
          appointments.push(appointment);
        }
      }

      this.logger.info(`Found ${appointments.length} upcoming appointments for reminders`);
      return appointments;
    } catch (error) {
      this.logger.error('Error getting upcoming appointments', { error: error.message });
      throw error;
    }
  }

  /**
   * Update appointment reminder status
   */
  async updateReminderStatus(appointmentId, sent = true) {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Appointments!A:M'
      });

      const rows = response.data.values || [];
      let rowIndex = -1;

      // Find the row with the matching appointment
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][8] === appointmentId) { // Calendly Event ID column
          rowIndex = i + 1; // Google Sheets is 1-indexed
          break;
        }
      }

      if (rowIndex > 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `Appointments!L${rowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[sent ? 'Yes' : 'No']]
          }
        });

        this.logger.info('Appointment reminder status updated', { 
          appointmentId, 
          sent 
        });
      }
    } catch (error) {
      this.logger.error('Error updating reminder status', { 
        error: error.message,
        appointmentId 
      });
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      
      // Get appointments data
      const appointmentsResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Appointments!A:M'
      });

      // Get triage data
      const triageResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Triage Summary!A:J'
      });

      const appointments = appointmentsResponse.data.values || [];
      const triageData = triageResponse.data.values || [];

      // Calculate statistics
      const totalBookings = appointments.length - 1; // Subtract header row
      const completedAppointments = appointments.filter(row => row[7] === 'Completed').length;
      const noShows = appointments.filter(row => row[7] === 'No Show').length;
      const highRiskTriage = triageData.filter(row => row[5] === 'High').length;

      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const recentBookings = appointments.filter(row => {
        if (row[0]) {
          const bookingDate = new Date(row[0]);
          return bookingDate >= weekAgo;
        }
        return false;
      }).length - 1; // Subtract header row

      const stats = {
        totalBookings,
        completedAppointments,
        noShows,
        highRiskTriage,
        recentBookings,
        noShowRate: totalBookings > 0 ? ((noShows / totalBookings) * 100).toFixed(1) : 0,
        completionRate: totalBookings > 0 ? ((completedAppointments / totalBookings) * 100).toFixed(1) : 0,
        lastUpdated: new Date().toISOString()
      };

      this.logger.info('Dashboard statistics calculated', stats);
      return stats;
    } catch (error) {
      this.logger.error('Error getting dashboard stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Create Google Calendar event
   */
  async createCalendarEvent(eventData) {
    try {
      const event = {
        summary: `${eventData.patientName} - ${eventData.visitType}`,
        description: `Patient: ${eventData.patientName}\nEmail: ${eventData.email}\nPhone: ${eventData.phone}\nReason: ${eventData.reasonForVisit || 'Not specified'}`,
        start: {
          dateTime: new Date(`${eventData.appointmentDate}T${eventData.appointmentTime}`).toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: new Date(new Date(`${eventData.appointmentDate}T${eventData.appointmentTime}`).getTime() + 60 * 60 * 1000).toISOString(),
          timeZone: 'America/New_York'
        },
        attendees: [
          { email: eventData.email }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 30 } // 30 minutes before
          ]
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        resource: event
      });

      this.logger.info('Google Calendar event created', { 
        eventId: response.data.id,
        patientName: eventData.patientName 
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error creating Google Calendar event', { 
        error: error.message,
        eventData: eventData 
      });
      throw error;
    }
  }
}

module.exports = GoogleService;
