const request = require('supertest');
const app = require('../server');

describe('myPCP Clinic Automation System', () => {
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'myPCP Clinic Automation System');
    });
  });

  describe('Dashboard', () => {
    it('should return dashboard stats', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('totalBookings');
      expect(response.body).toHaveProperty('completionRate');
      expect(response.body).toHaveProperty('noShowRate');
    });
  });

  describe('Webhook Endpoints', () => {
    it('should accept Formspree webhook', async () => {
      const formData = {
        fullName: 'John Doe',
        email: 'john@example.com',
        dob: '1990-01-01',
        reasonForVisit: 'Annual checkup'
      };

      const response = await request(app)
        .post('/webhook/formspree')
        .send(formData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should accept Calendly webhook', async () => {
      const calendlyData = {
        event: 'invitee.created',
        payload: {
          uuid: 'test-uuid',
          name: 'John Doe',
          email: 'john@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          uri: 'https://calendly.com/test',
          event: {
            uri: 'https://calendly.com/event/test'
          }
        }
      };

      const response = await request(app)
        .post('/webhook/calendly')
        .send(calendlyData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Manual Triggers', () => {
    it('should trigger reminders', async () => {
      const response = await request(app)
        .post('/trigger/reminders')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should trigger weekly report', async () => {
      const response = await request(app)
        .post('/trigger/weekly-report')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid webhook data', async () => {
      const response = await request(app)
        .post('/webhook/formspree')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });
});
