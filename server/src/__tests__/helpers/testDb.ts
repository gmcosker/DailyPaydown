/**
 * Test database utilities
 */

import { PrismaClient } from '@prisma/client';

// Create a test database client
export function createTestDb(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'file:./test.db',
      },
    },
  });
}

/**
 * Clean all tables in test database
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  // Delete in correct order to respect foreign key constraints
  await prisma.balanceSnapshot.deleteMany();
  await prisma.dailyReport.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.accountSelection.deleteMany();
  await prisma.device.deleteMany();
  await prisma.plaidItem.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Close database connection
 */
export async function closeDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect();
}

