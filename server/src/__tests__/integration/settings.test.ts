/**
 * Integration tests for settings endpoints
 */

import request from 'supertest';
import express from 'express';
import settingsRoutes from '../../routes/settings';
import { authenticateToken } from '../../auth';
import { createTestDb, cleanDatabase, closeDatabase } from '../helpers/testDb';
import { createTestUser } from '../fixtures/userFixtures';
import { PrismaClient } from '@prisma/client';

const app = express();
app.use(express.json());
app.use('/settings', authenticateToken, settingsRoutes);

describe('Settings Endpoints', () => {
  let prisma: PrismaClient;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    prisma = createTestDb();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Create test user and get auth token
    const user = await createTestUser(prisma);
    userId = user.id;

    // Generate token
    const { generateToken } = await import('../../auth');
    authToken = generateToken(userId);
  });

  afterAll(async () => {
    await closeDatabase(prisma);
  });

  describe('GET /settings', () => {
    it('should return user settings', async () => {
      const response = await request(app)
        .get('/settings')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timezone');
      expect(response.body).toHaveProperty('notificationTime');
      expect(response.body).toHaveProperty('goal');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/settings');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /settings', () => {
    it('should update timezone', async () => {
      const response = await request(app)
        .patch('/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timezone: 'America/Los_Angeles',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timezone', 'America/Los_Angeles');
    });

    it('should update notification time', async () => {
      const response = await request(app)
        .patch('/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notificationTime: '20:00',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('notificationTime', '20:00');
    });

    it('should update goal', async () => {
      const response = await request(app)
        .patch('/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          goal: 'save',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('goal', 'save');
    });

    it('should update multiple settings at once', async () => {
      const response = await request(app)
        .patch('/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timezone: 'America/Chicago',
          notificationTime: '18:00',
          goal: 'spend',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timezone', 'America/Chicago');
      expect(response.body).toHaveProperty('notificationTime', '18:00');
      expect(response.body).toHaveProperty('goal', 'spend');
    });

    it('should reject invalid timezone', async () => {
      const response = await request(app)
        .patch('/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timezone: 'Invalid/Timezone',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid notification time format', async () => {
      const response = await request(app)
        .patch('/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notificationTime: '25:00', // Invalid hour
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .patch('/settings')
        .send({
          timezone: 'America/New_York',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});

