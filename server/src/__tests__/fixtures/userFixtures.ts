/**
 * User test fixtures
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export interface TestUser {
  id: string;
  email: string;
  password: string; // Plain text password (for testing)
  passwordHash: string;
  timezone?: string;
  notificationTime?: string;
  goal?: string;
}

/**
 * Create a test user
 */
export async function createTestUser(
  prisma: PrismaClient,
  overrides?: Partial<TestUser>
): Promise<TestUser> {
  const email = overrides?.email || `test-${Date.now()}@example.com`;
  const plainPassword = overrides?.password || 'TestPassword123!';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      timezone: overrides?.timezone || 'America/New_York',
      notificationTime: overrides?.notificationTime || '19:00',
      goal: overrides?.goal || 'paydown',
    },
  });

  return {
    id: user.id,
    email: user.email,
    password: plainPassword,
    passwordHash: user.passwordHash,
    timezone: user.timezone || undefined,
    notificationTime: user.notificationTime || undefined,
    goal: user.goal || undefined,
  };
}

/**
 * Create multiple test users
 */
export async function createTestUsers(
  prisma: PrismaClient,
  count: number
): Promise<TestUser[]> {
  const users: TestUser[] = [];
  for (let i = 0; i < count; i++) {
    users.push(await createTestUser(prisma, { email: `test${i}-${Date.now()}@example.com` }));
  }
  return users;
}

