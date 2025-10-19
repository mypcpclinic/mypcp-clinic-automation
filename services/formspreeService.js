const axios = require('axios');
const winston = require('winston');

class FormspreeService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'formspree-service' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './logs/formspree-service.log' })
      ]
    });

    this.formId = process.env.FORMSPREE_FORM_ID;
    this.apiKey = process.env.FORMSPREE_API_KEY;
    this.baseUrl = 'https://formspree.io';
  }

  /**
   * Process form submission data
   */
  async processFormSubmission(formData) {
    try {
      this.logger.info('Processing Formspree form submission', {
        formId: this.formId,
        hasEmail: !!formData.email
      });

      // Validate required fields
      const validationResult = this.validateFormData(formData);
      if (!validationResult.isValid) {
        throw new Error(`Form validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Normalize form data
      const normalizedData = this.normalizeFormData(formData);

      // Generate unique form ID
      normalizedData.formId = this.generateFormId();

      this.logger.info('Form submission processed successfully', {
        formId: normalizedData.formId,
        patientName: normalizedData.fullName
      });

      return normalizedData;
    } catch (error) {
      this.logger.error('Error processing form submission', {
        error: error.message,
        formData: formData
      });
      throw error;
    }
  }

  /**
   * Validate form data
   */
  validateFormData(formData) {
    const errors = [];
    const requiredFields = ['fullName', 'email', 'dob'];

    requiredFields.forEach(field => {
      if (!formData[field] || formData[field].trim() === '') {
        errors.push(`${field} is required`);
      }
    });

    // Validate email format
    if (formData.email && !this.isValidEmail(formData.email)) {
      errors.push('Invalid email format');
    }

    // Validate date of birth
    if (formData.dob && !this.isValidDate(formData.dob)) {
      errors.push('Invalid date of birth format');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Normalize form data to standard format
   */
  normalizeFormData(formData) {
    return {
      formId: formData.formId || this.generateFormId(),
      fullName: this.normalizeName(formData.fullName || formData.name || ''),
      email: (formData.email || '').toLowerCase().trim(),
      phone: this.normalizePhone(formData.phone || formData.phoneNumber || ''),
      dob: this.normalizeDate(formData.dob || formData.dateOfBirth || ''),
      address: formData.address || formData.streetAddress || '',
      city: formData.city || '',
      state: formData.state || '',
      zipCode: formData.zipCode || formData.zip || '',
      reasonForVisit: formData.reasonForVisit || formData.reason || formData.chiefComplaint || '',
      currentMedications: formData.currentMedications || formData.medications || '',
      allergies: formData.allergies || formData.allergy || '',
      pastConditions: formData.pastConditions || formData.medicalHistory || formData.pastMedicalHistory || '',
      insuranceProvider: formData.insuranceProvider || formData.insurance || '',
      insuranceId: formData.insuranceId || formData.policyNumber || '',
      emergencyContact: formData.emergencyContact || formData.emergencyName || '',
      emergencyPhone: formData.emergencyPhone || formData.emergencyNumber || '',
      appointmentDate: formData.appointmentDate || '',
      appointmentTime: formData.appointmentTime || '',
      visitType: formData.visitType || formData.appointmentType || 'General Consultation',
      additionalNotes: formData.additionalNotes || formData.notes || formData.comments || '',
      timestamp: new Date().toISOString(),
      source: 'Formspree'
    };
  }

  /**
   * Generate unique form ID
   */
  generateFormId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `FORM_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate date format
   */
  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * Normalize name format
   */
  normalizeName(name) {
    if (!name) return '';
    return name.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Normalize phone number format
   */
  normalizePhone(phone) {
    if (!phone) return '';
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX if 10 digits
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // Return original if not 10 digits
    return phone;
  }

  /**
   * Normalize date format
   */
  normalizeDate(dateString) {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      // Return in YYYY-MM-DD format
      return date.toISOString().split('T')[0];
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Extract appointment information from form data
   */
  extractAppointmentInfo(formData) {
    try {
      // Look for appointment-related fields
      const appointmentInfo = {
        appointmentDate: formData.appointmentDate || formData.appointment_date || '',
        appointmentTime: formData.appointmentTime || formData.appointment_time || '',
        visitType: formData.visitType || formData.visit_type || formData.appointmentType || 'General Consultation'
      };

      // If no explicit appointment info, try to extract from other fields
      if (!appointmentInfo.appointmentDate) {
        // Look for date in various formats
        const dateFields = ['preferred_date', 'requested_date', 'date', 'when'];
        for (const field of dateFields) {
          if (formData[field]) {
            appointmentInfo.appointmentDate = this.normalizeDate(formData[field]);
            break;
          }
        }
      }

      if (!appointmentInfo.appointmentTime) {
        // Look for time in various formats
        const timeFields = ['preferred_time', 'requested_time', 'time', 'when'];
        for (const field of timeFields) {
          if (formData[field]) {
            appointmentInfo.appointmentTime = formData[field];
            break;
          }
        }
      }

      return appointmentInfo;
    } catch (error) {
      this.logger.error('Error extracting appointment info', {
        error: error.message,
        formData: formData
      });
      return {
        appointmentDate: '',
        appointmentTime: '',
        visitType: 'General Consultation'
      };
    }
  }

  /**
   * Check for high-risk keywords in form data
   */
  checkForRiskKeywords(formData) {
    const riskKeywords = [
      'chest pain', 'difficulty breathing', 'shortness of breath', 'severe pain',
      'emergency', 'urgent', 'critical', 'life threatening', 'suicide', 'self harm',
      'medication reaction', 'allergic reaction', 'anaphylaxis', 'stroke',
      'heart attack', 'severe bleeding', 'unconscious', 'fever', 'infection'
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

    return foundKeywords;
  }

  /**
   * Get form submissions from Formspree API
   */
  async getFormSubmissions(limit = 100) {
    try {
      if (!this.apiKey || !this.formId) {
        throw new Error('Formspree API key or form ID not configured');
      }

      const response = await axios.get(`${this.baseUrl}/api/forms/${this.formId}/submissions`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          limit: limit
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting form submissions', { error: error.message });
      throw error;
    }
  }

  /**
   * Send test form submission
   */
  async sendTestSubmission(testData) {
    try {
      if (!this.formId) {
        throw new Error('Formspree form ID not configured');
      }

      const response = await axios.post(`${this.baseUrl}/f/${this.formId}`, testData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.logger.info('Test form submission sent', { response: response.data });
      return response.data;
    } catch (error) {
      this.logger.error('Error sending test form submission', {
        error: error.message,
        testData: testData
      });
      throw error;
    }
  }

  /**
   * Validate webhook signature (if Formspree provides one)
   */
  validateWebhookSignature(payload, signature) {
    try {
      // Formspree doesn't typically provide webhook signatures
      // This is a placeholder for future implementation
      this.logger.info('Webhook signature validation not implemented for Formspree');
      return true;
    } catch (error) {
      this.logger.error('Error validating webhook signature', { error: error.message });
      return false;
    }
  }

  /**
   * Create form HTML template
   */
  generateFormHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Patient Intake Form - ${process.env.CLINIC_NAME}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, textarea, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .required { color: red; }
        .submit-btn { background-color: #2c5aa0; color: white; padding: 15px 30px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        .submit-btn:hover { background-color: #1e3d6f; }
        .section { margin: 30px 0; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
        .section h3 { margin-top: 0; color: #2c5aa0; }
    </style>
</head>
<body>
    <h1>Patient Intake Form</h1>
    <p>Welcome to ${process.env.CLINIC_NAME}. Please fill out this form to help us prepare for your visit.</p>
    
    <form action="https://formspree.io/f/${this.formId}" method="POST">
        <div class="section">
            <h3>Personal Information</h3>
            <div class="form-group">
                <label for="fullName">Full Name <span class="required">*</span></label>
                <input type="text" id="fullName" name="fullName" required>
            </div>
            <div class="form-group">
                <label for="email">Email Address <span class="required">*</span></label>
                <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
                <label for="phone">Phone Number</label>
                <input type="tel" id="phone" name="phone">
            </div>
            <div class="form-group">
                <label for="dob">Date of Birth <span class="required">*</span></label>
                <input type="date" id="dob" name="dob" required>
            </div>
            <div class="form-group">
                <label for="address">Address</label>
                <input type="text" id="address" name="address">
            </div>
        </div>

        <div class="section">
            <h3>Medical Information</h3>
            <div class="form-group">
                <label for="reasonForVisit">Reason for Visit <span class="required">*</span></label>
                <textarea id="reasonForVisit" name="reasonForVisit" rows="4" required></textarea>
            </div>
            <div class="form-group">
                <label for="currentMedications">Current Medications</label>
                <textarea id="currentMedications" name="currentMedications" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label for="allergies">Allergies</label>
                <textarea id="allergies" name="allergies" rows="2"></textarea>
            </div>
            <div class="form-group">
                <label for="pastConditions">Past Medical Conditions</label>
                <textarea id="pastConditions" name="pastConditions" rows="3"></textarea>
            </div>
        </div>

        <div class="section">
            <h3>Insurance Information</h3>
            <div class="form-group">
                <label for="insuranceProvider">Insurance Provider</label>
                <input type="text" id="insuranceProvider" name="insuranceProvider">
            </div>
            <div class="form-group">
                <label for="insuranceId">Insurance ID/Policy Number</label>
                <input type="text" id="insuranceId" name="insuranceId">
            </div>
        </div>

        <div class="section">
            <h3>Emergency Contact</h3>
            <div class="form-group">
                <label for="emergencyContact">Emergency Contact Name</label>
                <input type="text" id="emergencyContact" name="emergencyContact">
            </div>
            <div class="form-group">
                <label for="emergencyPhone">Emergency Contact Phone</label>
                <input type="tel" id="emergencyPhone" name="emergencyPhone">
            </div>
        </div>

        <div class="form-group">
            <label for="additionalNotes">Additional Notes</label>
            <textarea id="additionalNotes" name="additionalNotes" rows="3"></textarea>
        </div>

        <button type="submit" class="submit-btn">Submit Intake Form</button>
    </form>

    <script>
        // Auto-populate appointment info from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const appointmentDate = urlParams.get('appointment_date');
        const appointmentTime = urlParams.get('appointment_time');
        
        if (appointmentDate) {
            const dateInput = document.createElement('input');
            dateInput.type = 'hidden';
            dateInput.name = 'appointmentDate';
            dateInput.value = appointmentDate;
            document.querySelector('form').appendChild(dateInput);
        }
        
        if (appointmentTime) {
            const timeInput = document.createElement('input');
            timeInput.type = 'hidden';
            timeInput.name = 'appointmentTime';
            timeInput.value = appointmentTime;
            document.querySelector('form').appendChild(timeInput);
        }
    </script>
</body>
</html>`;
  }
}

module.exports = FormspreeService;
