/**
 * Integration tests for authentication endpoints
 */

import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/auth';
import { createTestDb, cleanDatabase, closeDatabase } from '../helpers/testDb';
import { PrismaClient } from '@prisma/client';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Endpoints', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createTestDb();
    await cleanDatabase(prisma);
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await closeDatabase(prisma);
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject duplicate email', async () => {
      // Register first user
      await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });

      // Try to register again with same email
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'AnotherPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Register a user for login tests
      await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
    });

    it('should reject incorrect password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /auth/me', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      // Register and login a user
      const registerResponse = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });

      authToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', userId);
      expect(response.body).toHaveProperty('email', 'test@example.com');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject request with malformed token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});

