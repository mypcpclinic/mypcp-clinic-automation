const fs = require('fs').promises;
const path = require('path');

class DataService {
  constructor() {
    this.dataFile = path.join(__dirname, '..', 'data', 'clinicData.json');
    this.data = null;
  }

  generateShortId() {
    // Generate a short, numeric ID like "1001", "1002", etc.
    const min = 1000;
    const max = 9999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async loadData() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      this.data = JSON.parse(data);
      return this.data;
    } catch (error) {
      // If file doesn't exist, create default data
      this.data = {
        patients: [],
        appointments: [],
        formSubmissions: [],
        lastUpdated: new Date().toISOString(),
        stats: {
          totalPatients: 0,
          newPatientsThisMonth: 0,
          upcomingAppointments: 0,
          pendingIntakes: 0,
          completedAppointments: 0,
          averageWaitTime: "0 minutes"
        }
      };
      await this.saveData();
      return this.data;
    }
  }

  async saveData() {
    try {
      this.data.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.dataFile, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  async addFormSubmission(formData) {
    await this.loadData();
    
    const submission = {
      id: this.generateShortId(),
      timestamp: new Date().toISOString(),
      ...formData,
      status: 'pending'
    };

    this.data.formSubmissions.unshift(submission);
    
    // Track daily patients
    this.trackDailyPatient(submission);
    
    // Update stats
    this.data.stats.pendingIntakes = this.data.formSubmissions.filter(s => s.status === 'pending').length;
    this.data.stats.totalPatients = this.data.patients.length;
    
    await this.saveData();
    return submission;
  }

  trackDailyPatient(patient) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Initialize daily tracking if it doesn't exist
    if (!this.data.dailyPatients) {
      this.data.dailyPatients = {};
    }
    
    // Initialize today's array if it doesn't exist
    if (!this.data.dailyPatients[today]) {
      this.data.dailyPatients[today] = [];
    }
    
    // Add patient to today's list
    this.data.dailyPatients[today].push({
      id: patient.id,
      name: patient.fullName,
      timestamp: patient.timestamp,
      status: patient.status,
      ...patient
    });
  }

  async addPatient(patientData) {
    await this.loadData();
    
    const patient = {
      id: this.generateShortId(),
      timestamp: new Date().toISOString(),
      ...patientData,
      status: 'active'
    };

    this.data.patients.unshift(patient);
    
    // Update stats
    this.data.stats.totalPatients = this.data.patients.length;
    this.data.stats.newPatientsThisMonth = this.getNewPatientsThisMonth();
    
    await this.saveData();
    return patient;
  }

  async addAppointment(appointmentData) {
    await this.loadData();
    
    const appointment = {
      id: this.generateShortId(),
      timestamp: new Date().toISOString(),
      ...appointmentData,
      status: 'scheduled'
    };

    this.data.appointments.unshift(appointment);
    
    // Update stats
    this.data.stats.upcomingAppointments = this.getUpcomingAppointments().length;
    
    await this.saveData();
    return appointment;
  }

  getNewPatientsThisMonth() {
    if (!this.data) return 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return this.data.patients.filter(patient => {
      const patientDate = new Date(patient.timestamp);
      return patientDate.getMonth() === currentMonth && 
             patientDate.getFullYear() === currentYear;
    }).length;
  }

  getUpcomingAppointments() {
    if (!this.data) return [];
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return this.data.appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.date);
      return appointmentDate >= now && appointmentDate <= tomorrow;
    });
  }

  getRecentActivity(limit = 10) {
    if (!this.data) return [];
    
    const activities = [];
    
    // Add recent form submissions
    this.data.formSubmissions.slice(0, 5).forEach(submission => {
      activities.push({
        type: 'Intake Form',
        name: submission.fullName,
        time: this.getTimeAgo(submission.timestamp),
        status: submission.status,
        timestamp: submission.timestamp,
        id: submission.id
      });
    });
    
    // Add recent patients
    this.data.patients.slice(0, 3).forEach(patient => {
      activities.push({
        type: 'New Patient',
        name: patient.fullName,
        time: this.getTimeAgo(patient.timestamp),
        status: 'completed',
        timestamp: patient.timestamp,
        id: patient.id
      });
    });
    
    // Sort by timestamp and limit
    return activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getDailyPatients(date = null) {
    if (!this.data || !this.data.dailyPatients) return [];
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.data.dailyPatients[targetDate] || [];
  }

  getDailyPatientCount(date = null) {
    return this.getDailyPatients(date).length;
  }

  getDailyPatientHistory(days = 7) {
    if (!this.data || !this.data.dailyPatients) return [];
    
    const history = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const patients = this.getDailyPatients(dateStr);
      history.push({
        date: dateStr,
        dateFormatted: date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        count: patients.length,
        patients: patients
      });
    }
    
    return history.reverse(); // Show oldest to newest
  }

  getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return `${diffDays} days ago`;
    }
  }

  async getDashboardStats() {
    await this.loadData();
    
    const upcomingAppointments = this.getUpcomingAppointments();
    const recentActivity = this.getRecentActivity();
    
    return {
      success: true,
      message: 'Real Dashboard Data',
      clinic: {
        name: 'myPCP Internal Medicine Clinic',
        location: 'Miami, FL',
        phone: '(305) 555-0123',
        email: 'info@bemypcp.com'
      },
      stats: {
        totalPatients: this.data.stats.totalPatients,
        newPatientsThisMonth: this.getNewPatientsThisMonth(),
        upcomingAppointments: upcomingAppointments.length,
        pendingIntakes: this.data.stats.pendingIntakes,
        completedAppointments: this.data.appointments.filter(a => a.status === 'completed').length,
        averageWaitTime: this.calculateAverageWaitTime(),
        lastUpdated: this.data.lastUpdated
      },
      recentActivity: recentActivity,
      upcomingAppointments: upcomingAppointments.map(apt => ({
        patient: apt.patientName,
        time: this.formatTime(apt.date),
        type: apt.type || 'Appointment',
        status: apt.status
      })),
      systemHealth: {
        status: 'operational',
        uptime: Math.floor(process.uptime() / 3600) + ' hours',
        lastBackup: this.getTimeAgo(this.data.lastUpdated),
        apiStatus: 'healthy'
      }
    };
  }

  calculateAverageWaitTime() {
    // Simple calculation - in real implementation, this would be based on actual wait times
    const completedAppointments = this.data.appointments.filter(a => a.status === 'completed');
    if (completedAppointments.length === 0) return "0 minutes";
    
    // Mock calculation - replace with real data when available
    return "8 minutes";
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }

  async getPatientById(patientId) {
    await this.loadData();
    
    // Convert patientId to number for comparison since IDs are stored as numbers
    const numericId = parseInt(patientId);
    
    // First check form submissions
    const formSubmission = this.data.formSubmissions.find(sub => sub.id === numericId);
    if (formSubmission) {
      return {
        ...formSubmission,
        type: 'form_submission'
      };
    }
    
    // Then check patients
    const patient = this.data.patients.find(pat => pat.id === numericId);
    if (patient) {
      return {
        ...patient,
        type: 'patient'
      };
    }
    
    return null;
  }
}

module.exports = DataService;
