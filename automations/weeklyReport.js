const winston = require('winston');
const moment = require('moment');

class WeeklyReport {
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
      defaultMeta: { service: 'weekly-report' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './logs/weekly-report.log' })
      ]
    });
  }

  /**
   * Generate and send weekly report
   */
  async generateWeeklyReport() {
    try {
      this.logger.info('Starting weekly report generation');

      // Step 1: Collect data for the past week
      const weeklyData = await this.collectWeeklyData();
      this.logger.info('Weekly data collected', {
        totalBookings: weeklyData.stats.totalBookings,
        highRiskTriage: weeklyData.stats.highRiskTriage
      });

      // Step 2: Generate AI-powered analysis
      const aiReport = await this.aiService.generateWeeklyReport(weeklyData.stats);
      this.logger.info('AI report generated', {
        executiveSummary: aiReport.executiveSummary?.substring(0, 100) + '...'
      });

      // Step 3: Create comprehensive report
      const reportData = {
        stats: weeklyData.stats,
        aiReport: aiReport,
        trends: weeklyData.trends,
        recommendations: weeklyData.recommendations,
        weekStart: weeklyData.weekStart,
        weekEnd: weeklyData.weekEnd
      };

      // Step 4: Send report via email
      await this.emailService.sendWeeklyReport(reportData);
      this.logger.info('Weekly report sent successfully');

      // Step 5: Log report generation
      await this.logReportEvent('weekly_report_generated', reportData);

      return {
        success: true,
        reportData: reportData
      };

    } catch (error) {
      this.logger.error('Error generating weekly report', {
        error: error.message,
        stack: error.stack
      });

      // Send error notification
      try {
        await this.emailService.sendErrorNotification({
          type: 'weekly_report_error',
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
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
   * Collect data for the past week
   */
  async collectWeeklyData() {
    try {
      const weekStart = moment().subtract(7, 'days').startOf('day');
      const weekEnd = moment().endOf('day');

      // Get appointments data
      const appointmentsData = await this.getAppointmentsData(weekStart, weekEnd);
      
      // Get triage data
      const triageData = await this.getTriageData(weekStart, weekEnd);
      
      // Get analytics data
      const analyticsData = await this.getAnalyticsData(weekStart, weekEnd);

      // Calculate statistics
      const stats = this.calculateStatistics(appointmentsData, triageData, analyticsData);
      
      // Identify trends
      const trends = this.identifyTrends(appointmentsData, triageData, analyticsData);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(stats, trends);

      return {
        stats: stats,
        trends: trends,
        recommendations: recommendations,
        weekStart: weekStart.format('YYYY-MM-DD'),
        weekEnd: weekEnd.format('YYYY-MM-DD'),
        rawData: {
          appointments: appointmentsData,
          triage: triageData,
          analytics: analyticsData
        }
      };

    } catch (error) {
      this.logger.error('Error collecting weekly data', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get appointments data for the specified period
   */
  async getAppointmentsData(weekStart, weekEnd) {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const response = await this.googleService.sheets.spreadsheets.values.get({
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

        // Check if appointment is within the week
        const appointmentDate = moment(appointment.timestamp);
        if (appointmentDate.isBetween(weekStart, weekEnd, null, '[]')) {
          appointments.push(appointment);
        }
      }

      this.logger.info(`Found ${appointments.length} appointments for the week`);
      return appointments;

    } catch (error) {
      this.logger.error('Error getting appointments data', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get triage data for the specified period
   */
  async getTriageData(weekStart, weekEnd) {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const response = await this.googleService.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Triage Summary!A:J'
      });

      const rows = response.data.values || [];
      const headers = rows[0];
      const triageData = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const triage = {};
        
        headers.forEach((header, index) => {
          triage[header.toLowerCase().replace(/\s+/g, '')] = row[index] || '';
        });

        // Check if triage is within the week
        const triageDate = moment(triage.timestamp);
        if (triageDate.isBetween(weekStart, weekEnd, null, '[]')) {
          triageData.push(triage);
        }
      }

      this.logger.info(`Found ${triageData.length} triage records for the week`);
      return triageData;

    } catch (error) {
      this.logger.error('Error getting triage data', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get analytics data for the specified period
   */
  async getAnalyticsData(weekStart, weekEnd) {
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const response = await this.googleService.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Analytics!A:T'
      });

      const rows = response.data.values || [];
      const headers = rows[0];
      const analyticsData = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const analytics = {};
        
        headers.forEach((header, index) => {
          analytics[header.toLowerCase().replace(/\s+/g, '')] = row[index] || '';
        });

        // Check if analytics record is within the week
        const analyticsDate = moment(analytics.timestamp);
        if (analyticsDate.isBetween(weekStart, weekEnd, null, '[]')) {
          analyticsData.push(analytics);
        }
      }

      this.logger.info(`Found ${analyticsData.length} analytics records for the week`);
      return analyticsData;

    } catch (error) {
      this.logger.error('Error getting analytics data', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate statistics from collected data
   */
  calculateStatistics(appointmentsData, triageData, analyticsData) {
    try {
      const totalBookings = appointmentsData.length;
      const completedAppointments = appointmentsData.filter(apt => apt.status === 'Completed').length;
      const noShows = appointmentsData.filter(apt => apt.status === 'No Show').length;
      const cancelledAppointments = appointmentsData.filter(apt => apt.status === 'Cancelled').length;
      
      const highRiskTriage = triageData.filter(triage => triage.urgencylevel === 'High').length;
      const moderateRiskTriage = triageData.filter(triage => triage.urgencylevel === 'Moderate').length;
      const lowRiskTriage = triageData.filter(triage => triage.urgencylevel === 'Low').length;

      const remindersSent = analyticsData.filter(analytics => analytics.eventtype === 'reminder_sent').length;
      const followUpsSent = analyticsData.filter(analytics => analytics.eventtype === 'follow_up_sent').length;

      const noShowRate = totalBookings > 0 ? ((noShows / totalBookings) * 100).toFixed(1) : 0;
      const completionRate = totalBookings > 0 ? ((completedAppointments / totalBookings) * 100).toFixed(1) : 0;
      const cancellationRate = totalBookings > 0 ? ((cancelledAppointments / totalBookings) * 100).toFixed(1) : 0;

      // Calculate average daily bookings
      const daysInWeek = 7;
      const averageDailyBookings = (totalBookings / daysInWeek).toFixed(1);

      // Calculate high-risk percentage
      const totalTriage = triageData.length;
      const highRiskPercentage = totalTriage > 0 ? ((highRiskTriage / totalTriage) * 100).toFixed(1) : 0;

      return {
        totalBookings,
        completedAppointments,
        noShows,
        cancelledAppointments,
        highRiskTriage,
        moderateRiskTriage,
        lowRiskTriage,
        remindersSent,
        followUpsSent,
        noShowRate: parseFloat(noShowRate),
        completionRate: parseFloat(completionRate),
        cancellationRate: parseFloat(cancellationRate),
        averageDailyBookings: parseFloat(averageDailyBookings),
        highRiskPercentage: parseFloat(highRiskPercentage),
        totalTriage
      };

    } catch (error) {
      this.logger.error('Error calculating statistics', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Identify trends from the data
   */
  identifyTrends(appointmentsData, triageData, analyticsData) {
    try {
      const trends = [];

      // Analyze daily booking patterns
      const dailyBookings = {};
      appointmentsData.forEach(appointment => {
        const date = moment(appointment.timestamp).format('YYYY-MM-DD');
        dailyBookings[date] = (dailyBookings[date] || 0) + 1;
      });

      const dailyBookingValues = Object.values(dailyBookings);
      const averageDaily = dailyBookingValues.reduce((sum, val) => sum + val, 0) / dailyBookingValues.length;
      
      // Check for increasing/decreasing trend
      const firstHalf = dailyBookingValues.slice(0, Math.floor(dailyBookingValues.length / 2));
      const secondHalf = dailyBookingValues.slice(Math.floor(dailyBookingValues.length / 2));
      
      const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      
      if (secondHalfAvg > firstHalfAvg * 1.1) {
        trends.push('Increasing booking trend detected');
      } else if (secondHalfAvg < firstHalfAvg * 0.9) {
        trends.push('Decreasing booking trend detected');
      }

      // Analyze no-show patterns
      const noShowRate = appointmentsData.filter(apt => apt.status === 'No Show').length / appointmentsData.length;
      if (noShowRate > 0.15) {
        trends.push('High no-show rate detected (>15%)');
      } else if (noShowRate < 0.05) {
        trends.push('Low no-show rate detected (<5%)');
      }

      // Analyze high-risk triage patterns
      const highRiskRate = triageData.filter(triage => triage.urgencylevel === 'High').length / triageData.length;
      if (highRiskRate > 0.2) {
        trends.push('High percentage of urgent cases detected (>20%)');
      }

      // Analyze reminder effectiveness
      const reminderRate = analyticsData.filter(analytics => analytics.eventtype === 'reminder_sent').length / appointmentsData.length;
      if (reminderRate < 0.8) {
        trends.push('Low reminder send rate detected');
      }

      return trends;

    } catch (error) {
      this.logger.error('Error identifying trends', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Generate recommendations based on statistics and trends
   */
  generateRecommendations(stats, trends) {
    try {
      const recommendations = [];

      // No-show recommendations
      if (stats.noShowRate > 15) {
        recommendations.push('Consider implementing reminder calls in addition to emails to reduce no-show rate');
        recommendations.push('Review scheduling process to ensure patients understand appointment importance');
      }

      // High-risk triage recommendations
      if (stats.highRiskPercentage > 20) {
        recommendations.push('Consider implementing same-day urgent care slots for high-risk patients');
        recommendations.push('Review triage criteria to ensure appropriate urgency classification');
      }

      // Booking trend recommendations
      if (trends.some(trend => trend.includes('Increasing'))) {
        recommendations.push('Consider expanding appointment availability to meet growing demand');
      } else if (trends.some(trend => trend.includes('Decreasing'))) {
        recommendations.push('Review marketing and patient outreach strategies to maintain booking levels');
      }

      // Reminder recommendations
      if (trends.some(trend => trend.includes('Low reminder'))) {
        recommendations.push('Review reminder system to ensure all patients receive timely notifications');
      }

      // General recommendations
      if (stats.completionRate > 90) {
        recommendations.push('Excellent completion rate - maintain current processes');
      }

      if (stats.averageDailyBookings > 20) {
        recommendations.push('High daily booking volume - consider staff scheduling optimization');
      }

      return recommendations;

    } catch (error) {
      this.logger.error('Error generating recommendations', {
        error: error.message
      });
      return ['Review system performance and patient feedback'];
    }
  }

  /**
   * Log report generation event
   */
  async logReportEvent(eventType, reportData) {
    try {
      const analyticsData = {
        timestamp: new Date().toISOString(),
        eventType: eventType,
        totalBookings: reportData.stats.totalBookings,
        highRiskTriage: reportData.stats.highRiskTriage,
        noShowRate: reportData.stats.noShowRate
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
            '', // patientName
            '', // urgencyLevel
            '', // appointmentDate
            '', // appointmentTime
            '', // hasAppointment
            analyticsData.totalBookings,
            analyticsData.highRiskTriage,
            analyticsData.noShowRate,
            '', '', '', '', '', '', '', '', '', ''
          ]]
        }
      });

      this.logger.info('Report event logged', {
        eventType: eventType,
        totalBookings: reportData.stats.totalBookings
      });

    } catch (error) {
      this.logger.error('Error logging report event', {
        error: error.message,
        eventType: eventType
      });
      // Don't throw error for analytics logging failures
    }
  }

  /**
   * Generate custom report for specific date range
   */
  async generateCustomReport(startDate, endDate) {
    try {
      this.logger.info('Generating custom report', {
        startDate: startDate,
        endDate: endDate
      });

      const weekStart = moment(startDate).startOf('day');
      const weekEnd = moment(endDate).endOf('day');

      // Collect data for the custom period
      const customData = await this.collectCustomData(weekStart, weekEnd);
      
      // Generate AI analysis
      const aiReport = await this.aiService.generateWeeklyReport(customData.stats);
      
      // Create report
      const reportData = {
        stats: customData.stats,
        aiReport: aiReport,
        trends: customData.trends,
        recommendations: customData.recommendations,
        periodStart: weekStart.format('YYYY-MM-DD'),
        periodEnd: weekEnd.format('YYYY-MM-DD')
      };

      return {
        success: true,
        reportData: reportData
      };

    } catch (error) {
      this.logger.error('Error generating custom report', {
        error: error.message,
        startDate: startDate,
        endDate: endDate
      });
      throw error;
    }
  }

  /**
   * Collect data for custom date range
   */
  async collectCustomData(startDate, endDate) {
    try {
      const appointmentsData = await this.getAppointmentsData(startDate, endDate);
      const triageData = await this.getTriageData(startDate, endDate);
      const analyticsData = await this.getAnalyticsData(startDate, endDate);

      const stats = this.calculateStatistics(appointmentsData, triageData, analyticsData);
      const trends = this.identifyTrends(appointmentsData, triageData, analyticsData);
      const recommendations = this.generateRecommendations(stats, trends);

      return {
        stats: stats,
        trends: trends,
        recommendations: recommendations,
        rawData: {
          appointments: appointmentsData,
          triage: triageData,
          analytics: analyticsData
        }
      };

    } catch (error) {
      this.logger.error('Error collecting custom data', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = WeeklyReport;
