/**
 * Plaid-related test fixtures
 */

import { PrismaClient } from '@prisma/client';
import { encryptPlaidToken } from '../../db';

export interface TestPlaidItem {
  id: string;
  userId: string;
  itemId: string;
  accessTokenEncrypted: string;
  institutionName: string | null;
  status: string | null;
}

/**
 * Create a test Plaid item
 */
export async function createTestPlaidItem(
  prisma: PrismaClient,
  userId: string,
  overrides?: Partial<TestPlaidItem>
): Promise<TestPlaidItem> {
  const itemId = overrides?.itemId || `item-${Date.now()}`;
  const accessToken = overrides?.accessTokenEncrypted 
    ? overrides.accessTokenEncrypted 
    : encryptPlaidToken(`test-access-token-${itemId}`);

  const item = await prisma.plaidItem.create({
    data: {
      userId,
      itemId,
      accessTokenEncrypted: accessToken,
      institutionName: overrides?.institutionName || 'Test Bank',
      status: overrides?.status || 'active',
    },
  });

  return {
    id: item.id,
    userId: item.userId,
    itemId: item.itemId,
    accessTokenEncrypted: item.accessTokenEncrypted,
    institutionName: item.institutionName,
    status: item.status,
  };
}

/**
 * Create account selection for a user
 */
export async function createAccountSelection(
  prisma: PrismaClient,
  userId: string,
  creditAccountId?: string,
  checkingAccountId?: string
): Promise<void> {
  await prisma.accountSelection.upsert({
    where: { userId },
    update: {
      creditAccountId: creditAccountId || null,
      checkingAccountId: checkingAccountId || null,
    },
    create: {
      userId,
      creditAccountId: creditAccountId || null,
      checkingAccountId: checkingAccountId || null,
    },
  });
}

