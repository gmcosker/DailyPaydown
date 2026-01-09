import * as cron from 'node-cron';
import { PlaidApi, PlaidEnvironments, Configuration, CountryCode } from 'plaid';
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

export async function syncUserTransactions(userId: string) {
  try {
    // Get user's account selection
    const accountSelection = await prisma.accountSelection.findUnique({
      where: { userId },
    });

    if (!accountSelection || !accountSelection.creditAccountId) {
      logger.debug('No credit account selected for user', { userId });
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

    // Find the PlaidItem that contains the selected credit account
    // Skip items with expired/revoked status
    let selectedPlaidItem = null;
    let accessToken = null;

    for (const item of plaidItems) {
      // Skip expired or revoked items
      if (item.status === 'expired' || item.status === 'revoked') {
        logger.debug('Skipping sync for expired/revoked Plaid item', { 
          itemId: item.itemId, 
          userId, 
          status: item.status 
        });
        continue;
      }

      const decryptedToken = decryptPlaidToken(item.accessTokenEncrypted);
      
      try {
        const accountsResponse = await plaidClient.accountsGet({
          access_token: decryptedToken,
        });

        const hasCreditAccount = accountsResponse.data.accounts.some(
          (acc: any) => acc.account_id === accountSelection.creditAccountId
        );

        if (hasCreditAccount) {
          selectedPlaidItem = item;
          accessToken = decryptedToken;
          break;
        }
      } catch (error) {
        logPlaidError(error, { userId, itemId: item.itemId, operation: 'accountsGet' });
        
        // Check if token is expired
        if (isTokenExpiredError(error)) {
          logger.warn('Plaid item token expired, updating status', { itemId: item.itemId, userId });
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

    if (!selectedPlaidItem || !accessToken) {
      logger.warn('Could not find Plaid item with credit account for user', { userId });
      return;
    }

    // Get user's timezone
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const userTimezone = user?.timezone || 'America/New_York';

    // Calculate date range: last 30 days to today (in user's timezone)
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);

    // Get stored cursor for incremental sync
    const storedCursor = selectedPlaidItem.syncCursor;
    
    // Use cursor if available for incremental sync, otherwise start fresh
    let cursor = storedCursor || undefined;
    let totalSyncedCount = 0;
    let hasMore = true;

    // Fetch transactions with pagination
    while (hasMore) {
      try {
        const requestParams: any = {
          access_token: accessToken,
          start_date: startDate.toISOString().split('T')[0],
          end_date: now.toISOString().split('T')[0],
          account_ids: [accountSelection.creditAccountId],
        };

        // Add cursor if this is a continuation
        if (cursor) {
          requestParams.cursor = cursor;
        }

        const transactionsResponse = await plaidClient.transactionsGet(requestParams);

      // Upsert transactions from this page
      let pageSyncedCount = 0;
      for (const transaction of transactionsResponse.data.transactions) {
        // Convert date to user's timezone for storage
        const transactionDate = new Date(transaction.date + 'T00:00:00');
        
        await prisma.transaction.upsert({
          where: { plaidTransactionId: transaction.transaction_id },
          update: {
            date: transactionDate,
            name: transaction.name,
            amount: transaction.amount,
            pending: transaction.pending,
            updatedAt: new Date(),
          },
          create: {
            userId,
            accountId: transaction.account_id,
            plaidTransactionId: transaction.transaction_id,
            date: transactionDate,
            name: transaction.name,
            amount: transaction.amount,
            pending: transaction.pending,
          },
        });
        pageSyncedCount++;
      }

      totalSyncedCount += pageSyncedCount;
      
      // Check if there are more pages
      // Plaid API returns has_more and next_cursor in the response
      const responseData = transactionsResponse.data as any;
      hasMore = responseData.has_more === true;
      cursor = responseData.next_cursor || undefined;

        logger.debug('Synced transaction page', { 
          userId, 
          pageCount: pageSyncedCount, 
          totalCount: totalSyncedCount,
          hasMore,
          itemId: selectedPlaidItem.itemId
        });

        // Update cursor in database after each page to allow recovery
        if (cursor) {
          await prisma.plaidItem.update({
            where: { id: selectedPlaidItem.id },
            data: { syncCursor: cursor },
          });
        }
      } catch (error) {
        // Check if token expired during sync
        if (isTokenExpiredError(error)) {
          logPlaidError(error, { userId, itemId: selectedPlaidItem.itemId, operation: 'transactionsGet' });
          logger.warn('Plaid token expired during sync, marking item as expired', { 
            itemId: selectedPlaidItem.itemId, 
            userId 
          });
          await prisma.plaidItem.update({
            where: { id: selectedPlaidItem.id },
            data: {
              status: 'expired',
              lastError: 'ITEM_LOGIN_REQUIRED',
              updatedAt: new Date(),
            },
          });
          // Break out of sync loop - don't continue with expired token
          break;
        }
        // Re-throw other errors
        throw error;
      }
    }

    // Clear cursor if we've synced all transactions (hasMore is false and cursor is null)
    if (!hasMore && cursor === null) {
      await prisma.plaidItem.update({
        where: { id: selectedPlaidItem.id },
        data: { syncCursor: null },
      });
    }

    logger.info('Synced transactions for user', { userId, syncedCount: totalSyncedCount, itemId: selectedPlaidItem.itemId });

    // Sync checking account balance if selected
    if (accountSelection.checkingAccountId) {
      try {
        // Find PlaidItem with checking account
        let checkingAccessToken = null;
        for (const item of plaidItems) {
          const decryptedToken = decryptPlaidToken(item.accessTokenEncrypted);
          
          try {
            const accountsResponse = await plaidClient.accountsGet({
              access_token: decryptedToken,
            });

            const hasCheckingAccount = accountsResponse.data.accounts.some(
              (acc: any) => acc.account_id === accountSelection.checkingAccountId
            );

            if (hasCheckingAccount) {
              checkingAccessToken = decryptedToken;
              break;
            }
          } catch (error) {
            logPlaidError(error, { userId, itemId: item.itemId, operation: 'accountsGet (checking)' });
            
            // Check if token is expired
            if (isTokenExpiredError(error)) {
              logger.warn('Plaid item token expired while checking accounts', { itemId: item.itemId, userId });
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

        if (checkingAccessToken) {
          const accountsResponse = await plaidClient.accountsGet({
            access_token: checkingAccessToken,
          });

          const checkingAccount = accountsResponse.data.accounts.find(
            (acc: any) => acc.account_id === accountSelection.checkingAccountId
          );

          if (checkingAccount && checkingAccount.balances) {
            await prisma.balanceSnapshot.create({
              data: {
                userId,
                accountId: checkingAccount.account_id,
                available: checkingAccount.balances.available || null,
                current: checkingAccount.balances.current || null,
                asOf: new Date(),
              },
            });
          }
        }
      } catch (error) {
        logger.error('Error syncing checking account balance', { error, userId });
      }
    }
  } catch (error) {
    logger.error('Error syncing transactions for user', { error, userId });
  }
}

export function startTransactionSyncJob() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Running transaction sync job');
    
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    logger.debug('Transaction sync job processing users', { userCount: users.length });

    for (const user of users) {
      await syncUserTransactions(user.id);
    }

    logger.info('Transaction sync job completed', { userCount: users.length });
  });

  logger.info('Transaction sync job scheduled', { schedule: 'every 15 minutes' });
}

