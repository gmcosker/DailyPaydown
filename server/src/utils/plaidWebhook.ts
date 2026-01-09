/**
 * Plaid webhook verification and handling utilities
 */

import crypto from 'crypto';
import { env } from '../config/env';
import logger from './logger';
import prisma from '../db';

export interface PlaidWebhook {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: {
    error_code: string;
    error_message: string;
    error_type: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
  account_id?: string;
  [key: string]: any;
}

/**
 * Verify webhook signature from Plaid
 * Plaid sends webhooks with a signature in the PLAID-SIGNATURE header
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  if (!env.plaidWebhookVerificationKey) {
    logger.warn('Plaid webhook verification key not configured. Webhook verification skipped.');
    return true; // Allow in development if key not set
  }

  try {
    // Plaid uses HMAC-SHA256 for webhook signatures
    const hmac = crypto.createHmac('sha256', env.plaidWebhookVerificationKey);
    hmac.update(body);
    const calculatedSignature = hmac.digest('hex');
    
    // Compare signatures using constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature)
    );
  } catch (error) {
    logger.error('Error verifying webhook signature', { error });
    return false;
  }
}

/**
 * Handle Plaid webhook
 */
export async function handlePlaidWebhook(webhook: PlaidWebhook): Promise<void> {
  const { webhook_type, webhook_code, item_id } = webhook;

  logger.info('Received Plaid webhook', { 
    webhook_type, 
    webhook_code, 
    item_id 
  });

  // Find the PlaidItem
  const plaidItem = await prisma.plaidItem.findUnique({
    where: { itemId: item_id },
  });

  if (!plaidItem) {
    logger.warn('Received webhook for unknown Plaid item', { item_id });
    return;
  }

  // Update lastWebhookAt timestamp
  await prisma.plaidItem.update({
    where: { id: plaidItem.id },
    data: { 
      lastWebhookAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Handle different webhook types
  switch (webhook_type) {
    case 'TRANSACTIONS':
      await handleTransactionsWebhook(webhook, plaidItem.id, plaidItem.userId);
      break;
    
    case 'ITEM':
      await handleItemWebhook(webhook, plaidItem.id, plaidItem.userId);
      break;
    
    default:
      logger.debug('Unhandled webhook type', { 
        webhook_type, 
        webhook_code, 
        item_id 
      });
  }
}

/**
 * Handle TRANSACTIONS webhooks
 */
async function handleTransactionsWebhook(
  webhook: PlaidWebhook,
  plaidItemId: string,
  userId: string
): Promise<void> {
  const { webhook_code, new_transactions, removed_transactions } = webhook;

  switch (webhook_code) {
    case 'INITIAL_UPDATE':
      logger.info('Transactions initial update received', { 
        plaidItemId, 
        userId, 
        new_transactions 
      });
      // Clear sync cursor to force full resync
      await prisma.plaidItem.update({
        where: { id: plaidItemId },
        data: { syncCursor: null },
      });
      break;

    case 'HISTORICAL_UPDATE':
      logger.info('Transactions historical update received', { 
        plaidItemId, 
        userId, 
        new_transactions 
      });
      // Clear sync cursor to force full resync
      await prisma.plaidItem.update({
        where: { id: plaidItemId },
        data: { syncCursor: null },
      });
      break;

    case 'DEFAULT_UPDATE':
      logger.info('Transactions default update received', { 
        plaidItemId, 
        userId, 
        new_transactions 
      });
      // Incremental sync - cursor should handle this
      break;

    case 'TRANSACTIONS_REMOVED':
      logger.info('Transactions removed', { 
        plaidItemId, 
        userId, 
        removed_count: removed_transactions?.length || 0 
      });
      // Remove transactions if needed
      if (removed_transactions && removed_transactions.length > 0) {
        // Note: Plaid provides transaction_ids, but we store plaidTransactionId
        // We'd need to map these or Plaid provides the IDs directly
        // For now, log and handle in sync job
        logger.debug('Transactions to remove', { 
          transactionIds: removed_transactions,
          plaidItemId,
          userId
        });
      }
      break;

    default:
      logger.debug('Unhandled TRANSACTIONS webhook code', { 
        webhook_code, 
        plaidItemId, 
        userId 
      });
  }
}

/**
 * Handle ITEM webhooks
 */
async function handleItemWebhook(
  webhook: PlaidWebhook,
  plaidItemId: string,
  userId: string
): Promise<void> {
  const { webhook_code, error } = webhook;

  switch (webhook_code) {
    case 'ERROR':
      logger.error('Plaid item error received', { 
        plaidItemId, 
        userId, 
        error 
      });
      // Update item status
      await prisma.plaidItem.update({
        where: { id: plaidItemId },
        data: {
          status: 'error',
          lastError: error?.error_code || error?.error_message || 'Unknown error',
          updatedAt: new Date(),
        },
      });
      break;

    case 'PENDING_EXPIRATION':
      logger.warn('Plaid item pending expiration', { 
        plaidItemId, 
        userId 
      });
      // Log warning but don't change status yet
      await prisma.plaidItem.update({
        where: { id: plaidItemId },
        data: {
          lastError: 'PENDING_EXPIRATION',
          updatedAt: new Date(),
        },
      });
      break;

    case 'USER_PERMISSION_REVOKED':
      logger.warn('User permission revoked for Plaid item', { 
        plaidItemId, 
        userId 
      });
      // Mark item as revoked
      await prisma.plaidItem.update({
        where: { id: plaidItemId },
        data: {
          status: 'revoked',
          lastError: 'USER_PERMISSION_REVOKED',
          updatedAt: new Date(),
        },
      });
      break;

    case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
      logger.debug('Webhook update acknowledged', { 
        plaidItemId, 
        userId 
      });
      break;

    default:
      logger.debug('Unhandled ITEM webhook code', { 
        webhook_code, 
        plaidItemId, 
        userId 
      });
  }
}


