/**
 * Integration tests for today endpoints
 */

import request from 'supertest';
import express from 'express';
import todayRoutes from '../../routes/today';
import { authenticateToken } from '../../auth';
import { createTestDb, cleanDatabase, closeDatabase } from '../helpers/testDb';
import { createTestUser } from '../fixtures/userFixtures';
import { createAccountSelection } from '../fixtures/plaidFixtures';
import { createTestTransaction, createTestTransactions } from '../fixtures/transactionFixtures';
import { PrismaClient } from '@prisma/client';

const app = express();
app.use(express.json());
app.use('/today', authenticateToken, todayRoutes);

describe('Today Endpoints', () => {
  let prisma: PrismaClient;
  let authToken: string;
  let userId: string;
  let creditAccountId: string;

  beforeAll(async () => {
    prisma = createTestDb();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Create test user and get auth token
    const user = await createTestUser(prisma);
    userId = user.id;

    // Generate token (we'll use a simple approach here)
    const { generateToken } = await import('../../auth');
    authToken = generateToken(userId);

    // Set up account selection
    creditAccountId = 'test-credit-account-id';
    await createAccountSelection(prisma, userId, creditAccountId, 'test-checking-account-id');
  });

  afterAll(async () => {
    await closeDatabase(prisma);
  });

  describe('GET /today', () => {
    it('should return today summary with no transactions', async () => {
      const response = await request(app)
        .get('/today')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalAmount', 0);
      expect(response.body).toHaveProperty('transactionCount', 0);
      expect(response.body).toHaveProperty('markedPaid', false);
    });

    it('should return today summary with transactions', async () => {
      // Create transactions for today
      const today = new Date();
      await createTestTransactions(prisma, userId, creditAccountId, 3, today);

      const response = await request(app)
        .get('/today')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('transactionCount', 3);
      expect(response.body.totalAmount).toBeGreaterThan(0);
    });

    it('should calculate correct total amount', async () => {
      const today = new Date();
      await createTestTransaction(prisma, userId, creditAccountId, {
        amount: 10.50,
        date: today,
      });
      await createTestTransaction(prisma, userId, creditAccountId, {
        amount: 25.75,
        date: today,
      });

      const response = await request(app)
        .get('/today')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalAmount).toBeCloseTo(36.25, 2);
      expect(response.body.transactionCount).toBe(2);
    });

    it('should reject request without account selection', async () => {
      // Remove account selection
      await prisma.accountSelection.deleteMany({ where: { userId } });

      const response = await request(app)
        .get('/today')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/today');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /today/transactions', () => {
    it('should return empty array when no transactions', async () => {
      const response = await request(app)
        .get('/today/transactions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('transactions');
      expect(response.body.transactions).toHaveLength(0);
    });

    it('should return today transactions', async () => {
      const today = new Date();
      await createTestTransactions(prisma, userId, creditAccountId, 3, today);

      const response = await request(app)
        .get('/today/transactions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('transactions');
      expect(response.body.transactions).toHaveLength(3);
      expect(response.body.transactions[0]).toHaveProperty('id');
      expect(response.body.transactions[0]).toHaveProperty('name');
      expect(response.body.transactions[0]).toHaveProperty('amount');
      expect(response.body.transactions[0]).toHaveProperty('pending');
      expect(response.body.transactions[0]).toHaveProperty('date');
    });

    it('should not return yesterday transactions', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await createTestTransaction(prisma, userId, creditAccountId, {
        date: yesterday,
      });

      const today = new Date();
      await createTestTransaction(prisma, userId, creditAccountId, {
        date: today,
      });

      const response = await request(app)
        .get('/today/transactions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.transactions).toHaveLength(1);
    });

    it('should reject request without account selection', async () => {
      await prisma.accountSelection.deleteMany({ where: { userId } });

      const response = await request(app)
        .get('/today/transactions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /today/mark-paid', () => {
    it('should mark today as paid', async () => {
      const today = new Date();
      await createTestTransaction(prisma, userId, creditAccountId, {
        amount: 10.50,
        date: today,
      });

      const response = await request(app)
        .post('/today/mark-paid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('markedPaidAt');

      // Verify it's marked in database
      const dailyReport = await prisma.dailyReport.findFirst({
        where: { userId },
      });

      expect(dailyReport).toBeDefined();
      expect(dailyReport?.markedPaidAt).not.toBeNull();
    });

    it('should create daily report when marking as paid', async () => {
      const today = new Date();
      await createTestTransaction(prisma, userId, creditAccountId, {
        amount: 25.50,
        date: today,
      });

      await request(app)
        .post('/today/mark-paid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const dailyReport = await prisma.dailyReport.findFirst({
        where: { userId },
      });

      expect(dailyReport).toBeDefined();
      expect(Number(dailyReport?.totalAmount)).toBeCloseTo(25.50, 2);
      expect(dailyReport?.transactionCount).toBe(1);
    });

    it('should update existing daily report', async () => {
      const today = new Date();
      await createTestTransaction(prisma, userId, creditAccountId, {
        amount: 10.50,
        date: today,
      });

      // Mark as paid once
      await request(app)
        .post('/today/mark-paid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      // Add another transaction
      await createTestTransaction(prisma, userId, creditAccountId, {
        amount: 15.25,
        date: today,
      });

      // Mark as paid again
      const response = await request(app)
        .post('/today/mark-paid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);

      // Verify updated totals
      const dailyReport = await prisma.dailyReport.findFirst({
        where: { userId },
      });

      expect(Number(dailyReport?.totalAmount)).toBeCloseTo(25.75, 2);
      expect(dailyReport?.transactionCount).toBe(2);
    });

    it('should reject request without account selection', async () => {
      await prisma.accountSelection.deleteMany({ where: { userId } });

      const response = await request(app)
        .post('/today/mark-paid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/today/mark-paid')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});

