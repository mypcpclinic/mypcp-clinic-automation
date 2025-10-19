const axios = require('axios');
const winston = require('winston');

class CalendlyService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'calendly-service' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './logs/calendly-service.log' })
      ]
    });

    this.apiToken = process.env.CALENDLY_API_TOKEN;
    this.webhookSecret = process.env.CALENDLY_WEBHOOK_SECRET;
    this.baseUrl = 'https://api.calendly.com';
  }

  /**
   * Handle Calendly webhook events
   */
  async handleBookingEvent(eventData) {
    try {
      this.logger.info('Processing Calendly booking event', { eventType: eventData.event });

      switch (eventData.event) {
        case 'invitee.created':
          await this.handleInviteeCreated(eventData);
          break;
        case 'invitee.canceled':
          await this.handleInviteeCanceled(eventData);
          break;
        case 'invitee.rescheduled':
          await this.handleInviteeRescheduled(eventData);
          break;
        default:
          this.logger.warn('Unknown Calendly event type', { eventType: eventData.event });
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error handling Calendly booking event', {
        error: error.message,
        eventData: eventData
      });
      throw error;
    }
  }

  /**
   * Handle new appointment booking
   */
  async handleInviteeCreated(eventData) {
    try {
      const inviteeData = eventData.payload;
      const eventDetails = await this.getEventDetails(inviteeData.event.uri);
      
      const appointmentData = {
        calendlyEventId: inviteeData.uuid,
        patientName: inviteeData.name,
        email: inviteeData.email,
        phone: inviteeData.phone_number || '',
        appointmentDate: this.formatDate(inviteeData.created_at),
        appointmentTime: this.formatTime(inviteeData.created_at),
        visitType: eventDetails.name || 'General Consultation',
        status: 'Scheduled',
        calendlyUri: inviteeData.uri,
        eventUri: inviteeData.event.uri,
        questionsAndAnswers: inviteeData.questions_and_answers || []
      };

      this.logger.info('New appointment created', {
        patientName: appointmentData.patientName,
        email: appointmentData.email,
        appointmentDate: appointmentData.appointmentDate
      });

      return appointmentData;
    } catch (error) {
      this.logger.error('Error handling invitee created event', {
        error: error.message,
        eventData: eventData
      });
      throw error;
    }
  }

  /**
   * Handle appointment cancellation
   */
  async handleInviteeCanceled(eventData) {
    try {
      const inviteeData = eventData.payload;
      
      this.logger.info('Appointment canceled', {
        patientName: inviteeData.name,
        email: inviteeData.email,
        calendlyEventId: inviteeData.uuid
      });

      // Update appointment status in Google Sheets
      // This would be handled by the main automation system
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error handling invitee canceled event', {
        error: error.message,
        eventData: eventData
      });
      throw error;
    }
  }

  /**
   * Handle appointment rescheduling
   */
  async handleInviteeRescheduled(eventData) {
    try {
      const inviteeData = eventData.payload;
      
      this.logger.info('Appointment rescheduled', {
        patientName: inviteeData.name,
        email: inviteeData.email,
        calendlyEventId: inviteeData.uuid
      });

      // Update appointment details in Google Sheets
      // This would be handled by the main automation system
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error handling invitee rescheduled event', {
        error: error.message,
        eventData: eventData
      });
      throw error;
    }
  }

  /**
   * Get event details from Calendly API
   */
  async getEventDetails(eventUri) {
    try {
      if (!this.apiToken) {
        this.logger.warn('Calendly API token not configured');
        return { name: 'General Consultation' };
      }

      const response = await axios.get(`${this.baseUrl}/scheduled_events/${eventUri}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.resource;
    } catch (error) {
      this.logger.error('Error getting Calendly event details', {
        error: error.message,
        eventUri: eventUri
      });
      return { name: 'General Consultation' };
    }
  }

  /**
   * Get scheduled events from Calendly API
   */
  async getScheduledEvents(userUri, count = 100) {
    try {
      if (!this.apiToken) {
        throw new Error('Calendly API token not configured');
      }

      const response = await axios.get(`${this.baseUrl}/scheduled_events`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          user: userUri,
          count: count,
          status: 'active'
        }
      });

      return response.data.collection;
    } catch (error) {
      this.logger.error('Error getting scheduled events', {
        error: error.message,
        userUri: userUri
      });
      throw error;
    }
  }

  /**
   * Get user information from Calendly API
   */
  async getUserInfo() {
    try {
      if (!this.apiToken) {
        throw new Error('Calendly API token not configured');
      }

      const response = await axios.get(`${this.baseUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.resource;
    } catch (error) {
      this.logger.error('Error getting user info', { error: error.message });
      throw error;
    }
  }

  /**
   * Create webhook subscription
   */
  async createWebhookSubscription(webhookUrl, events = ['invitee.created', 'invitee.canceled', 'invitee.rescheduled']) {
    try {
      if (!this.apiToken) {
        throw new Error('Calendly API token not configured');
      }

      const userInfo = await this.getUserInfo();
      
      const response = await axios.post(`${this.baseUrl}/webhook_subscriptions`, {
        url: webhookUrl,
        events: events,
        organization: userInfo.current_organization,
        user: userInfo.uri
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      this.logger.info('Webhook subscription created', {
        webhookId: response.data.resource.uuid,
        url: webhookUrl
      });

      return response.data.resource;
    } catch (error) {
      this.logger.error('Error creating webhook subscription', {
        error: error.message,
        webhookUrl: webhookUrl
      });
      throw error;
    }
  }

  /**
   * List webhook subscriptions
   */
  async listWebhookSubscriptions() {
    try {
      if (!this.apiToken) {
        throw new Error('Calendly API token not configured');
      }

      const response = await axios.get(`${this.baseUrl}/webhook_subscriptions`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.collection;
    } catch (error) {
      this.logger.error('Error listing webhook subscriptions', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete webhook subscription
   */
  async deleteWebhookSubscription(webhookId) {
    try {
      if (!this.apiToken) {
        throw new Error('Calendly API token not configured');
      }

      await axios.delete(`${this.baseUrl}/webhook_subscriptions/${webhookId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      this.logger.info('Webhook subscription deleted', { webhookId: webhookId });
      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting webhook subscription', {
        error: error.message,
        webhookId: webhookId
      });
      throw error;
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload, signature) {
    try {
      if (!this.webhookSecret) {
        this.logger.warn('Calendly webhook secret not configured');
        return true; // Allow if no secret configured
      }

      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      this.logger.error('Error validating webhook signature', { error: error.message });
      return false;
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      this.logger.error('Error formatting date', { error: error.message, dateString });
      return dateString;
    }
  }

  /**
   * Format time for display
   */
  formatTime(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      this.logger.error('Error formatting time', { error: error.message, dateString });
      return dateString;
    }
  }

  /**
   * Extract appointment details from Calendly event
   */
  extractAppointmentDetails(inviteeData) {
    try {
      const questionsAndAnswers = inviteeData.questions_and_answers || [];
      const extractedData = {};

      questionsAndAnswers.forEach(qa => {
        const question = qa.question.toLowerCase();
        const answer = qa.answer;

        if (question.includes('phone') || question.includes('number')) {
          extractedData.phone = answer;
        } else if (question.includes('reason') || question.includes('visit')) {
          extractedData.reasonForVisit = answer;
        } else if (question.includes('insurance')) {
          extractedData.insuranceProvider = answer;
        } else if (question.includes('medication')) {
          extractedData.currentMedications = answer;
        } else if (question.includes('allerg')) {
          extractedData.allergies = answer;
        }
      });

      return extractedData;
    } catch (error) {
      this.logger.error('Error extracting appointment details', {
        error: error.message,
        inviteeData: inviteeData
      });
      return {};
    }
  }

  /**
   * Get upcoming appointments
   */
  async getUpcomingAppointments(daysAhead = 7) {
    try {
      if (!this.apiToken) {
        throw new Error('Calendly API token not configured');
      }

      const userInfo = await this.getUserInfo();
      const events = await this.getScheduledEvents(userInfo.uri, 100);
      
      const now = new Date();
      const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
      
      const upcomingEvents = events.filter(event => {
        const eventDate = new Date(event.start_time);
        return eventDate >= now && eventDate <= futureDate;
      });

      this.logger.info(`Found ${upcomingEvents.length} upcoming appointments`);
      return upcomingEvents;
    } catch (error) {
      this.logger.error('Error getting upcoming appointments', { error: error.message });
      throw error;
    }
  }
}

module.exports = CalendlyService;
