/**
 * Transaction test fixtures
 */

import { PrismaClient } from '@prisma/client';

export interface TestTransaction {
  id: string;
  userId: string;
  accountId: string;
  plaidTransactionId: string;
  date: Date;
  name: string;
  amount: number;
  pending: boolean;
}

/**
 * Create a test transaction
 */
export async function createTestTransaction(
  prisma: PrismaClient,
  userId: string,
  accountId: string,
  overrides?: Partial<TestTransaction>
): Promise<TestTransaction> {
  const transaction = await prisma.transaction.create({
    data: {
      userId,
      accountId,
      plaidTransactionId: overrides?.plaidTransactionId || `plaid-tx-${Date.now()}-${Math.random()}`,
      date: overrides?.date || new Date(),
      name: overrides?.name || 'Test Transaction',
      amount: overrides?.amount || 10.50,
      pending: overrides?.pending ?? false,
    },
  });

  return {
    id: transaction.id,
    userId: transaction.userId,
    accountId: transaction.accountId,
    plaidTransactionId: transaction.plaidTransactionId,
    date: transaction.date,
    name: transaction.name,
    amount: Number(transaction.amount),
    pending: transaction.pending,
  };
}

/**
 * Create multiple test transactions
 */
export async function createTestTransactions(
  prisma: PrismaClient,
  userId: string,
  accountId: string,
  count: number,
  baseDate?: Date
): Promise<TestTransaction[]> {
  const transactions: TestTransaction[] = [];
  const date = baseDate || new Date();

  for (let i = 0; i < count; i++) {
    const transactionDate = new Date(date);
    transactionDate.setHours(9 + i); // Space them out throughout the day

    transactions.push(
      await createTestTransaction(prisma, userId, accountId, {
        name: `Test Transaction ${i + 1}`,
        amount: (i + 1) * 10.50,
        date: transactionDate,
      })
    );
  }

  return transactions;
}

