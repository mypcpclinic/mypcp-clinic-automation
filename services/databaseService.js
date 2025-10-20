const { MongoClient } = require('mongodb');
const winston = require('winston');

class DatabaseService {
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
      defaultMeta: { service: 'database-service' },
      transports: transports
    });

    // MongoDB connection
    this.client = null;
    this.db = null;
    this.isConnected = false;
    
    // Connection string from environment variable
    this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/mypcp-clinic';
    this.dbName = 'mypcp-clinic';
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    try {
      if (this.isConnected && this.client) {
        return this.client;
      }

      this.logger.info('Connecting to MongoDB...');
      this.client = new MongoClient(this.connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.isConnected = true;
      
      this.logger.info('Successfully connected to MongoDB');
      return this.client;
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        this.logger.info('Disconnected from MongoDB');
      }
    } catch (error) {
      this.logger.error('Error disconnecting from MongoDB:', error);
    }
  }

  /**
   * Get the patients collection
   */
  getPatientsCollection() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db.collection('patients');
  }

  /**
   * Get the daily patients collection
   */
  getDailyPatientsCollection() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db.collection('daily_patients');
  }

  /**
   * Add a new patient to the database
   */
  async addPatient(patientData) {
    try {
      await this.connect();
      const patients = this.getPatientsCollection();
      
      // Generate a unique ID
      const id = await this.generatePatientId();
      
      const patient = {
        id: id,
        ...patientData,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending'
      };

      const result = await patients.insertOne(patient);
      this.logger.info(`Patient added to database with ID: ${id}`);
      
      // Also add to daily patients
      await this.addToDailyPatients(patient);
      
      return { id, ...patient };
    } catch (error) {
      this.logger.error('Error adding patient to database:', error);
      throw error;
    }
  }

  /**
   * Generate a unique patient ID
   */
  async generatePatientId() {
    try {
      await this.connect();
      const patients = this.getPatientsCollection();
      
      // Get the highest ID and increment it
      const lastPatient = await patients.findOne({}, { sort: { id: -1 } });
      const nextId = lastPatient ? lastPatient.id + 1 : 1000;
      
      return nextId;
    } catch (error) {
      this.logger.error('Error generating patient ID:', error);
      // Fallback to timestamp-based ID
      return Date.now() % 100000;
    }
  }

  /**
   * Add patient to daily patients collection
   */
  async addToDailyPatients(patient) {
    try {
      await this.connect();
      const dailyPatients = this.getDailyPatientsCollection();
      
      const today = new Date().toISOString().split('T')[0];
      
      // Find or create today's record
      const todayRecord = await dailyPatients.findOne({ date: today });
      
      if (todayRecord) {
        // Add patient to existing day
        await dailyPatients.updateOne(
          { date: today },
          { 
            $push: { patients: patient },
            $inc: { count: 1 },
            $set: { updatedAt: new Date() }
          }
        );
      } else {
        // Create new day record
        await dailyPatients.insertOne({
          date: today,
          count: 1,
          patients: [patient],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      this.logger.info(`Patient added to daily patients for ${today}`);
    } catch (error) {
      this.logger.error('Error adding to daily patients:', error);
      // Don't throw error - this is supplementary data
    }
  }

  /**
   * Get all patients
   */
  async getAllPatients() {
    try {
      await this.connect();
      const patients = this.getPatientsCollection();
      
      const allPatients = await patients.find({}).sort({ createdAt: -1 }).toArray();
      this.logger.info(`Retrieved ${allPatients.length} patients from database`);
      
      return allPatients;
    } catch (error) {
      this.logger.error('Error getting all patients:', error);
      throw error;
    }
  }

  /**
   * Get patient by ID
   */
  async getPatientById(id) {
    try {
      await this.connect();
      const patients = this.getPatientsCollection();
      
      const patient = await patients.findOne({ id: parseInt(id) });
      this.logger.info(`Retrieved patient ${id} from database`);
      
      return patient;
    } catch (error) {
      this.logger.error(`Error getting patient ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get today's patients
   */
  async getTodayPatients() {
    try {
      await this.connect();
      const dailyPatients = this.getDailyPatientsCollection();
      
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = await dailyPatients.findOne({ date: today });
      
      return todayRecord ? todayRecord.patients : [];
    } catch (error) {
      this.logger.error('Error getting today\'s patients:', error);
      return [];
    }
  }

  /**
   * Get daily patient history
   */
  async getDailyPatientHistory(days = 7) {
    try {
      await this.connect();
      const dailyPatients = this.getDailyPatientsCollection();
      
      const history = await dailyPatients
        .find({})
        .sort({ date: -1 })
        .limit(days)
        .toArray();
      
      return history.map(record => ({
        date: record.date,
        dateFormatted: new Date(record.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        count: record.count,
        patients: record.patients
      }));
    } catch (error) {
      this.logger.error('Error getting daily patient history:', error);
      return [];
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    try {
      await this.connect();
      const patients = this.getPatientsCollection();
      const dailyPatients = this.getDailyPatientsCollection();
      
      const totalPatients = await patients.countDocuments();
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = await dailyPatients.findOne({ date: today });
      const todayCount = todayRecord ? todayRecord.count : 0;
      
      // Get this month's patients
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const thisMonthPatients = await patients.countDocuments({
        createdAt: { $gte: startOfMonth }
      });
      
      return {
        totalPatients,
        newPatientsThisMonth: thisMonthPatients,
        todayPatientCount: todayCount,
        pendingIntakes: await patients.countDocuments({ status: 'pending' }),
        completedAppointments: await patients.countDocuments({ status: 'completed' }),
        upcomingAppointments: 0, // This would come from appointments collection
        averageWaitTime: '0 minutes',
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error getting dashboard stats:', error);
      return {
        totalPatients: 0,
        newPatientsThisMonth: 0,
        todayPatientCount: 0,
        pendingIntakes: 0,
        completedAppointments: 0,
        upcomingAppointments: 0,
        averageWaitTime: '0 minutes',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Update patient status
   */
  async updatePatientStatus(id, status) {
    try {
      await this.connect();
      const patients = this.getPatientsCollection();
      
      const result = await patients.updateOne(
        { id: parseInt(id) },
        { 
          $set: { 
            status: status,
            updatedAt: new Date()
          }
        }
      );
      
      this.logger.info(`Updated patient ${id} status to ${status}`);
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Error updating patient ${id} status:`, error);
      throw error;
    }
  }

  /**
   * Delete patient (if needed)
   */
  async deletePatient(id) {
    try {
      await this.connect();
      const patients = this.getPatientsCollection();
      
      const result = await patients.deleteOne({ id: parseInt(id) });
      this.logger.info(`Deleted patient ${id}`);
      
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(`Error deleting patient ${id}:`, error);
      throw error;
    }
  }
}

module.exports = DatabaseService;
