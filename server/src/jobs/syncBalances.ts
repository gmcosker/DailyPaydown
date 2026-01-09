import * as cron from 'node-cron';
import { PlaidApi, PlaidEnvironments, Configuration } from 'plaid';
import prisma, { decryptPlaidToken } from '../db';
import logger from '../utils/logger';
import { isTokenExpiredError, logPlaidError } from '../utils/plaidErrors';

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

/**
 * Sync account balances for a specific user
 * Fetches balances for both credit and checking accounts and stores them
 */
export async function syncUserBalances(userId: string) {
  try {
    // Get user's account selection
    const accountSelection = await prisma.accountSelection.findUnique({
      where: { userId },
    });

    if (!accountSelection) {
      logger.debug('No account selection found for user', { userId });
      return;
    }

    // Get all PlaidItems for this user
    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId },
    });

    if (plaidItems.length === 0) {
      logger.debug('No Plaid items found for user', { userId });
      return;
    }

    // Find PlaidItems that contain the selected accounts
    // We need to check all items since credit and checking might be in different items
    const accountIdsToSync: string[] = [];
    if (accountSelection.creditAccountId) {
      accountIdsToSync.push(accountSelection.creditAccountId);
    }
    if (accountSelection.checkingAccountId) {
      accountIdsToSync.push(accountSelection.checkingAccountId);
    }

    if (accountIdsToSync.length === 0) {
      logger.debug('No accounts selected for balance sync', { userId });
      return;
    }

    // Map to store access tokens for each account
    const accountToTokenMap = new Map<string, string>();

    // Find which PlaidItem contains each account
    for (const item of plaidItems) {
      // Skip expired or revoked items
      if (item.status === 'expired' || item.status === 'revoked') {
        logger.debug('Skipping balance sync for expired/revoked Plaid item', {
          itemId: item.itemId,
          userId,
          status: item.status,
        });
        continue;
      }

      const decryptedToken = decryptPlaidToken(item.accessTokenEncrypted);

      try {
        const accountsResponse = await plaidClient.accountsGet({
          access_token: decryptedToken,
        });

        // Check which selected accounts are in this item
        for (const account of accountsResponse.data.accounts) {
          if (accountIdsToSync.includes(account.account_id)) {
            accountToTokenMap.set(account.account_id, decryptedToken);
          }
        }
      } catch (error) {
        logPlaidError(error, { userId, itemId: item.itemId, operation: 'accountsGet' });

        // Check if token is expired
        if (isTokenExpiredError(error)) {
          logger.warn('Plaid item token expired during balance sync, updating status', {
            itemId: item.itemId,
            userId,
          });
          await prisma.plaidItem.update({
            where: { id: item.id },
            data: {
              status: 'expired',
              lastError: 'ITEM_LOGIN_REQUIRED',
              updatedAt: new Date(),
            },
          });
        }
      }
    }

    if (accountToTokenMap.size === 0) {
      logger.warn('Could not find Plaid items with selected accounts for user', { userId });
      return;
    }

    // Fetch and store balances for each account
    let syncedCount = 0;
    for (const [accountId, accessToken] of accountToTokenMap.entries()) {
      try {
        const accountsResponse = await plaidClient.accountsGet({
          access_token: accessToken,
        });

        const account = accountsResponse.data.accounts.find((acc: any) => acc.account_id === accountId);

        if (!account) {
          logger.warn('Account not found in Plaid response', { userId, accountId });
          continue;
        }

        // Extract balance information
        // Plaid returns balances in the account object
        const balances = account.balances;
        const available = balances?.available ?? null;
        const current = balances?.current ?? null;

        // Store balance snapshot
        await prisma.balanceSnapshot.create({
          data: {
            userId,
            accountId,
            available: available !== null ? available : undefined,
            current: current !== null ? current : undefined,
            asOf: new Date(),
          },
        });

        syncedCount++;
        logger.debug('Synced balance for account', {
          userId,
          accountId,
          available,
          current,
        });
      } catch (error) {
        logPlaidError(error, { userId, itemId: accountId, operation: 'accountsGet (balance sync)' });
        // Continue with other accounts even if one fails
      }
    }

    if (syncedCount > 0) {
      logger.info('Balance sync completed', {
        userId,
        accountsSynced: syncedCount,
        totalAccounts: accountIdsToSync.length,
      });
    }
  } catch (error) {
    logger.error('Balance sync error', { error, userId });
    throw error;
  }
}

/**
 * Sync balances for all users
 */
async function syncAllUserBalances() {
  try {
    logger.info('Starting balance sync for all users');

    const users = await prisma.user.findMany({
      select: { id: true },
    });

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        await syncUserBalances(user.id);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error('Failed to sync balances for user', { userId: user.id, error });
      }
    }

    logger.info('Balance sync job completed', {
      totalUsers: users.length,
      successCount,
      errorCount,
    });
  } catch (error) {
    logger.error('Balance sync job error', { error });
  }
}

/**
 * Start the balance sync job
 * Runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
 */
export function startBalanceSyncJob() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    await syncAllUserBalances();
  });

  logger.info('Balance sync job scheduled to run every hour');
}

