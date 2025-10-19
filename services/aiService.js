const axios = require('axios');
const winston = require('winston');

class AIService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'ai-service' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './logs/ai-service.log' })
      ]
    });

    this.useLocalAI = process.env.USE_LOCAL_AI === 'true';
    this.localAIUrl = process.env.LOCAL_AI_URL || 'http://localhost:1234/v1/chat/completions';
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.AI_MODEL || 'gpt-3.5-turbo';
  }

  /**
   * Summarize patient intake information and assess urgency
   */
  async summarizeIntake(formData) {
    try {
      const prompt = this.createIntakePrompt(formData);
      const response = await this.callAI(prompt);
      
      const summary = this.parseAIResponse(response);
      
      this.logger.info('Patient intake summarized successfully', {
        patientName: formData.fullName,
        urgencyLevel: summary.urgencyLevel
      });

      return summary;
    } catch (error) {
      this.logger.error('Error summarizing patient intake', {
        error: error.message,
        patientName: formData.fullName
      });
      throw error;
    }
  }

  /**
   * Generate weekly clinic report
   */
  async generateWeeklyReport(stats) {
    try {
      const prompt = this.createWeeklyReportPrompt(stats);
      const response = await this.callAI(prompt);
      
      const report = this.parseAIResponse(response);
      
      this.logger.info('Weekly report generated successfully', {
        totalBookings: stats.totalBookings,
        highRiskTriage: stats.highRiskTriage
      });

      return report;
    } catch (error) {
      this.logger.error('Error generating weekly report', {
        error: error.message,
        stats: stats
      });
      throw error;
    }
  }

  /**
   * Create prompt for patient intake summarization
   */
  createIntakePrompt(formData) {
    return `You are a medical AI assistant helping to triage patient intake forms for an internal medicine clinic. 

Please analyze the following patient information and provide a structured summary:

PATIENT INFORMATION:
- Name: ${formData.fullName || 'Not provided'}
- Age: ${this.calculateAge(formData.dob) || 'Not provided'}
- Reason for Visit: ${formData.reasonForVisit || 'Not specified'}
- Current Medications: ${formData.currentMedications || 'None listed'}
- Allergies: ${formData.allergies || 'None listed'}
- Past Medical Conditions: ${formData.pastConditions || 'None listed'}

Please provide your analysis in the following JSON format:
{
  "summary": "Brief 2-3 sentence summary of the patient's chief complaint and relevant medical history",
  "urgencyLevel": "Low/Moderate/High",
  "riskKeywords": ["list", "of", "concerning", "keywords", "found"],
  "recommendations": "Specific recommendations for the physician (e.g., 'Review medication interactions', 'Consider urgent evaluation for chest pain')",
  "followUpNotes": "Any additional notes for the clinical team"
}

URGENCY GUIDELINES:
- HIGH: Chest pain, difficulty breathing, severe pain, signs of infection, mental health crisis, medication reactions
- MODERATE: Chronic condition management, routine follow-up, mild symptoms
- LOW: Preventive care, routine check-ups, minor concerns

Focus on patient safety and clinical relevance. Be concise but thorough.`;
  }

  /**
   * Create prompt for weekly report generation
   */
  createWeeklyReportPrompt(stats) {
    return `You are an AI assistant generating a weekly clinic performance report for myPCP Internal Medicine Clinic.

CLINIC STATISTICS FOR THE WEEK:
- Total Bookings: ${stats.totalBookings}
- Completed Appointments: ${stats.completedAppointments}
- No Shows: ${stats.noShows}
- High Risk Triage Cases: ${stats.highRiskTriage}
- Recent Bookings (last 7 days): ${stats.recentBookings}
- No-Show Rate: ${stats.noShowRate}%
- Completion Rate: ${stats.completionRate}%

Please generate a professional weekly summary report in the following JSON format:
{
  "executiveSummary": "2-3 sentence overview of the week's performance",
  "keyMetrics": {
    "totalVisits": ${stats.totalBookings},
    "noShowRate": "${stats.noShowRate}%",
    "highRiskCases": ${stats.highRiskTriage},
    "completionRate": "${stats.completionRate}%"
  },
  "trends": "Analysis of trends compared to previous weeks (if available)",
  "recommendations": ["List", "of", "actionable", "recommendations"],
  "alerts": ["Any", "concerning", "patterns", "or", "issues"],
  "nextWeekFocus": "Priorities for the upcoming week"
}

Make the report professional, actionable, and focused on improving patient care and clinic operations.`;
  }

  /**
   * Call AI service (OpenAI or local)
   */
  async callAI(prompt) {
    try {
      if (this.useLocalAI) {
        return await this.callLocalAI(prompt);
      } else {
        return await this.callOpenAI(prompt);
      }
    } catch (error) {
      this.logger.error('Error calling AI service', { error: error.message });
      throw error;
    }
  }

  /**
   * Call local AI service (LM Studio)
   */
  async callLocalAI(prompt) {
    try {
      const response = await axios.post(this.localAIUrl, {
        model: 'llama-3',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful medical AI assistant. Always respond with valid JSON format as requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      this.logger.error('Error calling local AI', { error: error.message });
      throw new Error(`Local AI service error: ${error.message}`);
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(prompt) {
    try {
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful medical AI assistant. Always respond with valid JSON format as requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      this.logger.error('Error calling OpenAI', { error: error.message });
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * Parse AI response and extract structured data
   */
  parseAIResponse(response) {
    try {
      // Try to parse as JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: create structured response from text
      return {
        summary: response.substring(0, 200) + '...',
        urgencyLevel: this.extractUrgencyLevel(response),
        riskKeywords: this.extractRiskKeywords(response),
        recommendations: 'Review patient information carefully',
        followUpNotes: 'AI analysis completed'
      };
    } catch (error) {
      this.logger.error('Error parsing AI response', { error: error.message, response });
      
      // Return safe fallback
      return {
        summary: 'Patient intake received - manual review recommended',
        urgencyLevel: 'Moderate',
        riskKeywords: [],
        recommendations: 'Review patient information manually',
        followUpNotes: 'AI parsing failed - manual review required'
      };
    }
  }

  /**
   * Extract urgency level from AI response
   */
  extractUrgencyLevel(response) {
    const lowerResponse = response.toLowerCase();
    if (lowerResponse.includes('high') || lowerResponse.includes('urgent')) {
      return 'High';
    } else if (lowerResponse.includes('low') || lowerResponse.includes('routine')) {
      return 'Low';
    }
    return 'Moderate';
  }

  /**
   * Extract risk keywords from AI response
   */
  extractRiskKeywords(response) {
    const riskKeywords = [
      'chest pain', 'difficulty breathing', 'severe pain', 'infection',
      'mental health', 'suicide', 'medication reaction', 'allergic reaction',
      'emergency', 'urgent', 'critical', 'life threatening'
    ];

    const foundKeywords = [];
    const lowerResponse = response.toLowerCase();
    
    riskKeywords.forEach(keyword => {
      if (lowerResponse.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    });

    return foundKeywords;
  }

  /**
   * Calculate age from date of birth
   */
  calculateAge(dob) {
    if (!dob) return null;
    
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age;
    } catch (error) {
      this.logger.error('Error calculating age', { error: error.message, dob });
      return null;
    }
  }

  /**
   * Generate patient confirmation email content
   */
  async generateConfirmationEmail(appointmentData, triageSummary) {
    try {
      const prompt = `Generate a professional patient confirmation email for a medical appointment.

APPOINTMENT DETAILS:
- Patient: ${appointmentData.patientName}
- Date: ${appointmentData.appointmentDate}
- Time: ${appointmentData.appointmentTime}
- Visit Type: ${appointmentData.visitType}
- Clinic: ${process.env.CLINIC_NAME}
- Address: ${process.env.CLINIC_ADDRESS}

TRIAGE SUMMARY:
- Urgency Level: ${triageSummary.urgencyLevel}
- Risk Keywords: ${triageSummary.riskKeywords.join(', ')}

Please generate a professional, reassuring email that:
1. Confirms the appointment details
2. Provides clinic location and contact information
3. Includes any relevant health reminders based on the triage summary
4. Maintains a warm, professional tone
5. Includes appropriate disclaimers for urgent symptoms

Format as a complete email with subject line and body.`;

      const response = await this.callAI(prompt);
      return this.parseEmailResponse(response);
    } catch (error) {
      this.logger.error('Error generating confirmation email', { error: error.message });
      
      // Return fallback email
      return {
        subject: `Appointment Confirmation - ${appointmentData.patientName}`,
        body: `Dear ${appointmentData.patientName},

This email confirms your upcoming appointment:

Date: ${appointmentData.appointmentDate}
Time: ${appointmentData.appointmentTime}
Location: ${process.env.CLINIC_ADDRESS}

Please arrive 15 minutes early for check-in. If you have any urgent symptoms, please contact us immediately or seek emergency care.

Best regards,
${process.env.CLINIC_NAME}`
      };
    }
  }

  /**
   * Parse email response from AI
   */
  parseEmailResponse(response) {
    try {
      const subjectMatch = response.match(/Subject:\s*(.+)/i);
      const bodyMatch = response.match(/Body:\s*([\s\S]*)/i) || response.match(/(?:Dear|Hello)[\s\S]*/i);
      
      return {
        subject: subjectMatch ? subjectMatch[1].trim() : 'Appointment Confirmation',
        body: bodyMatch ? bodyMatch[1].trim() : response
      };
    } catch (error) {
      return {
        subject: 'Appointment Confirmation',
        body: response
      };
    }
  }
}

module.exports = AIService;
