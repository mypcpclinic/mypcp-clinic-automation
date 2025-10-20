const XLSX = require('xlsx');
const winston = require('winston');

class ExcelService {
  constructor() {
    // Configure logging for Vercel environment
    const transports = [
      new winston.transports.Console()
    ];
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'excel-service' },
      transports: transports
    });

    // In-memory storage for the Excel file (since Vercel is serverless)
    this.excelBuffer = null;
    this.lastUpdated = null;
    this.patientCount = 0;
  }

  /**
   * Generate Excel file from patient data
   */
  generateExcelFile(patients) {
    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Define headers
      const headers = [
        'Patient ID',
        'Full Name',
        'Date of Birth',
        'Gender',
        'Phone',
        'Email',
        'Address',
        'City',
        'State',
        'ZIP Code',
        'Emergency Contact',
        'Insurance Provider',
        'Policy Number',
        'Primary Care Physician',
        'Current Medications',
        'Allergies',
        'Past Conditions',
        'Reason for Visit',
        'Medical History',
        'Status',
        'Submitted Date',
        'Form Type'
      ];
      
      // Convert patient data to worksheet format
      const worksheetData = [headers];
      
      patients.forEach(patient => {
        const row = [
          patient.id || '',
          patient.fullName || '',
          patient.dateOfBirth || '',
          patient.gender || '',
          patient.phone || '',
          patient.email || '',
          patient.address || '',
          patient.city || '',
          patient.state || '',
          patient.zipCode || '',
          patient.emergencyContact || '',
          patient.insuranceProvider || '',
          patient.policyNumber || '',
          patient.primaryCarePhysician || '',
          patient.currentMedications || '',
          patient.allergies || '',
          patient.pastConditions || '',
          patient.reasonForVisit || '',
          patient.medicalHistory || '',
          patient.status || '',
          patient.timestamp ? new Date(patient.timestamp).toLocaleString() : '',
          'Intake Form'
        ];
        worksheetData.push(row);
      });
      
      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Patient Data');
      
      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      this.logger.info(`Excel file generated with ${patients.length} patients`);
      
      return excelBuffer;
    } catch (error) {
      this.logger.error('Error generating Excel file:', error);
      throw error;
    }
  }

  /**
   * Add patient data to existing Excel file or create new one
   */
  async addPatientToExcel(patientData) {
    try {
      this.logger.info(`Adding patient to Excel file: ${patientData.fullName}`);
      
      // Get current data from data service
      const DataService = require('./dataService');
      const dataService = new DataService();
      const data = await dataService.loadData();
      const allPatients = data.formSubmissions || [];
      
      // Update the Excel file with all current data
      this.excelBuffer = this.generateExcelFile(allPatients);
      this.lastUpdated = new Date();
      this.patientCount = allPatients.length;
      
      this.logger.info(`Excel file updated with ${allPatients.length} patients`);
      
      return { 
        success: true, 
        message: 'Patient data added to Excel file',
        patientCount: allPatients.length,
        lastUpdated: this.lastUpdated
      };
    } catch (error) {
      this.logger.error('Error adding patient to Excel:', error);
      throw error;
    }
  }

  /**
   * Get the current Excel file buffer
   */
  getCurrentExcelFile() {
    return {
      buffer: this.excelBuffer,
      lastUpdated: this.lastUpdated,
      patientCount: this.patientCount
    };
  }

  /**
   * Generate Excel file for daily patient data
   */
  generateDailyExcelFile(dailyData) {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Create summary sheet
      const summaryHeaders = ['Date', 'Patient Count', 'Patients'];
      const summaryData = [summaryHeaders];
      
      Object.keys(dailyData).forEach(date => {
        const dayData = dailyData[date];
        const patientNames = dayData.map(p => p.name).join(', ');
        summaryData.push([
          date,
          dayData.length,
          patientNames
        ]);
      });
      
      const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Daily Summary');
      
      // Create detailed sheet
      const detailHeaders = [
        'Date', 'Patient ID', 'Name', 'Email', 'Phone', 'Reason for Visit', 'Status', 'Submitted'
      ];
      const detailData = [detailHeaders];
      
      Object.keys(dailyData).forEach(date => {
        dayData.forEach(patient => {
          detailData.push([
            date,
            patient.id,
            patient.name,
            patient.email || '',
            patient.phone || '',
            patient.reasonForVisit || '',
            patient.status,
            patient.timestamp ? new Date(patient.timestamp).toLocaleString() : ''
          ]);
        });
      });
      
      const detailWorksheet = XLSX.utils.aoa_to_sheet(detailData);
      XLSX.utils.book_append_sheet(workbook, detailWorksheet, 'Patient Details');
      
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      this.logger.info(`Daily Excel file generated for ${Object.keys(dailyData).length} days`);
      
      return excelBuffer;
    } catch (error) {
      this.logger.error('Error generating daily Excel file:', error);
      throw error;
    }
  }
}

module.exports = ExcelService;
