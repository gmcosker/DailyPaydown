import { Router } from 'express';
import express from 'express';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import prisma, { encryptPlaidToken, decryptPlaidToken } from '../db';
import { authenticateToken, AuthRequest } from '../auth';
import logger from '../utils/logger';
import { validate, validators } from '../middleware/validation';

const router = Router();

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

const isTestMode = process.env.TEST_MODE === 'true';

/**
 * @swagger
 * /plaid/create-link-token:
 *   post:
 *     summary: Create Plaid Link token for connecting bank account
 *     tags: [Plaid]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Link token created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 linkToken:
 *                   type: string
 *                   description: Plaid Link token to use in Plaid Link SDK
 */
router.post('/create-link-token', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Test mode: return mock token
    if (isTestMode) {
      logger.debug('[TEST MODE] Returning mock link token', { userId });
      return res.json({ linkToken: 'mock-link-token-for-testing' });
    }

    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: 'DailyPaydown',
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    res.json({ linkToken: response.data.link_token });
  } catch (error: any) {
    logger.error('Create link token error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to create link token', details: error.message });
  }
});

/**
 * @swagger
 * /plaid/exchange-public-token:
 *   post:
 *     summary: Exchange Plaid public token for access token
 *     tags: [Plaid]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicToken
 *             properties:
 *               publicToken:
 *                 type: string
 *                 description: Public token from Plaid Link
 *     responses:
 *       200:
 *         description: Token exchanged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 itemId:
 *                   type: string
 *                   description: Plaid item ID
 */
router.post('/exchange-public-token', authenticateToken, validate([
  validators.publicToken,
]), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { publicToken } = req.body;

    // Test mode: accept preview-token and return mock itemId
    if (isTestMode && publicToken === 'preview-token') {
      logger.debug('[TEST MODE] Accepting preview-token, returning mock itemId', { userId });
      const mockItemId = 'preview-item-id';
      const mockInstitutionName = 'Test Bank (Mock)';

      // Create or update PlaidItem with mock data
      const encryptedToken = encryptPlaidToken('mock-access-token-for-testing');
      
      const existingItem = await prisma.plaidItem.findUnique({
        where: { itemId: mockItemId },
      });

      if (existingItem) {
        await prisma.plaidItem.update({
          where: { itemId: mockItemId },
          data: {
            accessTokenEncrypted: encryptedToken,
            institutionName: mockInstitutionName,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.plaidItem.create({
          data: {
            userId,
            accessTokenEncrypted: encryptedToken,
            itemId: mockItemId,
            institutionName: mockInstitutionName,
          },
        });
      }

      return res.json({ success: true, itemId: mockItemId });
    }

    // Exchange public token for access token
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Get institution info
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id;
    let institutionName = 'Unknown';

    if (institutionId) {
      try {
        const instResponse = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        });
        institutionName = instResponse.data.institution.name;
      } catch (error) {
        logger.warn('Failed to get institution name', { error, institutionId, itemId });
      }
    }

    // Encrypt and store access token
    const encryptedToken = encryptPlaidToken(accessToken);

    // Check if PlaidItem already exists for this itemId
    const existingItem = await prisma.plaidItem.findUnique({
      where: { itemId },
    });

    if (existingItem) {
      // Update existing item
      await prisma.plaidItem.update({
        where: { itemId },
        data: {
          accessTokenEncrypted: encryptedToken,
          institutionName,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new item
      await prisma.plaidItem.create({
        data: {
          userId,
          accessTokenEncrypted: encryptedToken,
          itemId,
          institutionName,
        },
      });
    }

    res.json({ success: true, itemId });
  } catch (error: any) {
    logger.error('Exchange public token error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to exchange public token', details: error.message });
  }
});

/**
 * @swagger
 * /plaid/accounts:
 *   get:
 *     summary: Get accounts for a Plaid item
 *     tags: [Plaid]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Plaid item ID
 *     responses:
 *       200:
 *         description: List of accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accounts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       accountId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *                       subtype:
 *                         type: string
 *                       mask:
 *                         type: string
 */
router.get('/accounts', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { itemId } = req.query;

    if (!itemId || typeof itemId !== 'string') {
      return res.status(400).json({ error: 'itemId is required' });
    }

    // Test mode: return mock accounts for preview-item-id
    if (isTestMode && itemId === 'preview-item-id') {
      logger.debug('[TEST MODE] Returning mock accounts for preview-item-id', { userId, itemId });
      
      // Create or ensure PlaidItem exists in test mode
      const mockInstitutionName = 'Test Bank (Mock)';
      const encryptedToken = encryptPlaidToken('mock-access-token-for-testing');
      
      const existingItem = await prisma.plaidItem.findUnique({
        where: { itemId },
      });

      if (!existingItem) {
        await prisma.plaidItem.create({
          data: {
            userId,
            accessTokenEncrypted: encryptedToken,
            itemId,
            institutionName: mockInstitutionName,
          },
        });
        logger.debug('[TEST MODE] Created mock PlaidItem', { userId, itemId });
      }

      return res.json({
        accounts: [
          {
            accountId: 'mock-credit-account-123',
            name: 'Chase Sapphire Preferred',
            type: 'credit',
            subtype: 'credit card',
            mask: '1234',
          },
          {
            accountId: 'mock-checking-account-456',
            name: 'Chase Total Checking',
            type: 'depository',
            subtype: 'checking',
            mask: '5678',
          },
        ],
      });
    }

    // Get PlaidItem
    const plaidItem = await prisma.plaidItem.findFirst({
      where: {
        itemId,
        userId,
      },
    });

    if (!plaidItem) {
      return res.status(404).json({ error: 'Plaid item not found' });
    }

    // Decrypt access token
    const accessToken = decryptPlaidToken(plaidItem.accessTokenEncrypted);

    // Get accounts
    const response = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    res.json({
      accounts: response.data.accounts.map(account => ({
        accountId: account.account_id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
      })),
    });
  } catch (error: any) {
    logger.error('Get accounts error', { error, userId: req.userId, itemId: req.query.itemId });
    res.status(500).json({ error: 'Failed to get accounts', details: error.message });
  }
});

// Select accounts (credit card and checking)
router.post('/select-accounts', authenticateToken, validate([
  validators.creditAccountId,
  validators.checkingAccountId,
]), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { creditAccountId, checkingAccountId } = req.body;

    if (!creditAccountId && !checkingAccountId) {
      return res.status(400).json({ error: 'At least one account ID is required' });
    }

    // Upsert account selection
    await prisma.accountSelection.upsert({
      where: { userId },
      update: {
        creditAccountId: creditAccountId || undefined,
        checkingAccountId: checkingAccountId || undefined,
        updatedAt: new Date(),
      },
      create: {
        userId,
        creditAccountId: creditAccountId || null,
        checkingAccountId: checkingAccountId || null,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Select accounts error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to select accounts', details: error.message });
  }
});

/**
 * @swagger
 * /plaid/items:
 *   get:
 *     summary: Get all Plaid items for authenticated user
 *     tags: [Plaid]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of Plaid items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       itemId:
 *                         type: string
 *                       institutionName:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 */
router.get('/items', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId },
      select: {
        id: true,
        itemId: true,
        institutionName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      items: plaidItems.map(item => ({
        id: item.id,
        itemId: item.itemId,
        institutionName: item.institutionName,
        status: item.status || 'active',
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    logger.error('Get Plaid items error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to get Plaid items', details: error.message });
  }
});

// Delete/disconnect a Plaid item
router.delete('/items/:itemId', authenticateToken, validate([
  validators.itemId,
]), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { itemId } = req.params;

    // Verify the item belongs to the user
    const plaidItem = await prisma.plaidItem.findFirst({
      where: {
        itemId,
        userId,
      },
      include: {
        user: {
          include: {
            accountSelection: true,
          },
        },
      },
    });

    if (!plaidItem) {
      return res.status(404).json({ error: 'Plaid item not found' });
    }

    // Check if this item's accounts are selected in AccountSelection
    const accountSelection = plaidItem.user.accountSelection;
    
    if (accountSelection) {
      // Get accounts for this item to check if they're selected
      try {
        const accessToken = decryptPlaidToken(plaidItem.accessTokenEncrypted);
        const accountsResponse = await plaidClient.accountsGet({
          access_token: accessToken,
        });

        const accountIds = accountsResponse.data.accounts.map((acc: any) => acc.account_id);
        const hasSelectedAccounts = 
          (accountSelection.creditAccountId && accountIds.includes(accountSelection.creditAccountId)) ||
          (accountSelection.checkingAccountId && accountIds.includes(accountSelection.checkingAccountId));

        if (hasSelectedAccounts) {
          // Clear account selection if it references accounts from this item
          await prisma.accountSelection.update({
            where: { userId },
            data: {
              creditAccountId: accountSelection.creditAccountId && accountIds.includes(accountSelection.creditAccountId)
                ? null
                : accountSelection.creditAccountId,
              checkingAccountId: accountSelection.checkingAccountId && accountIds.includes(accountSelection.checkingAccountId)
                ? null
                : accountSelection.checkingAccountId,
              updatedAt: new Date(),
            },
          });
        }
      } catch (error) {
        // If we can't decrypt or get accounts, still proceed with deletion
        // but try to clear account selection if IDs match (best effort)
        logger.warn('Error getting accounts before deleting item, proceeding with deletion', { 
          error, 
          itemId, 
          userId 
        });
        
        // Clear account selection as a safety measure
        if (accountSelection) {
          await prisma.accountSelection.update({
            where: { userId },
            data: {
              creditAccountId: null,
              checkingAccountId: null,
              updatedAt: new Date(),
            },
          });
        }
      }
    }

    // Delete the PlaidItem (cascades will handle related data)
    await prisma.plaidItem.delete({
      where: { id: plaidItem.id },
    });

    logger.info('Deleted Plaid item', { itemId, userId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Delete Plaid item error', { error, userId: req.userId, itemId: req.params.itemId });
    res.status(500).json({ error: 'Failed to delete Plaid item', details: error.message });
  }
});

// Plaid webhook endpoint (no auth required, but verified by signature)
// Note: This route should be registered before express.json() middleware processes the body
// For now, we'll use the parsed body and note that signature verification may need raw body
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['plaid-signature'] as string;
    
    if (!signature) {
      logger.warn('Plaid webhook received without signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // Get raw body as Buffer for signature verification
    const rawBody = req.body as Buffer;
    const rawBodyString = rawBody.toString('utf-8');

    // Verify webhook signature
    const { verifyWebhookSignature, handlePlaidWebhook } = await import('../utils/plaidWebhook');
    
    const isValid = verifyWebhookSignature(rawBodyString, signature);
    
    if (!isValid) {
      logger.warn('Invalid Plaid webhook signature', { 
        signature: signature.substring(0, 20) + '...' 
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse body for processing
    const webhookData = JSON.parse(rawBodyString);

    // Handle webhook asynchronously (don't block response)
    handlePlaidWebhook(webhookData).catch(error => {
      logger.error('Error handling Plaid webhook', { error, webhook: webhookData });
    });

    // Respond immediately to Plaid
    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    logger.error('Plaid webhook error', { error });
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

export default router;



