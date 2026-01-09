/**
 * Admin and monitoring endpoints
 * Provides administrative functions and system metrics
 */

import { Router } from 'express';
import prisma from '../db';
import { authenticateAdmin, AdminRequest } from '../middleware/adminAuth';
import logger from '../utils/logger';
import { syncUserTransactions } from '../jobs/syncTransactions';
import { syncUserBalances } from '../jobs/syncBalances';

const router = Router();

// All admin routes require authentication
router.use(authenticateAdmin);

/**
 * @swagger
 * /admin/sync-status:
 *   get:
 *     summary: Get sync job status and system stats
 *     tags: [Admin]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Sync status and statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 syncJob:
 *                   type: object
 *                 notificationJob:
 *                   type: object
 *                 stats:
 *                   type: object
 */
router.get('/sync-status', async (req: AdminRequest, res) => {
  try {
    // Get last transaction update time as proxy for last sync
    const lastTransaction = await prisma.transaction.findFirst({
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        updatedAt: true,
      },
    });

    // Get user count
    const userCount = await prisma.user.count();

    // Get active Plaid items count
    const activeItemsCount = await prisma.plaidItem.count({
      where: {
        status: {
          not: 'expired',
        },
      },
    });

    res.json({
      syncJob: {
        schedule: 'every 15 minutes',
        lastSyncTime: lastTransaction?.updatedAt.toISOString() || null,
        nextSyncTime: 'Calculated by cron scheduler',
      },
      notificationJob: {
        schedule: 'every minute',
        status: 'running',
      },
      dailyReportJob: {
        schedule: 'daily at 00:00 UTC',
        status: 'running',
      },
      deviceCleanupJob: {
        schedule: 'weekly on Sunday at 02:00 UTC',
        status: 'running',
      },
      balanceSyncJob: {
        schedule: 'every hour at minute 0',
        status: 'running',
      },
      stats: {
        totalUsers: userCount,
        activePlaidItems: activeItemsCount,
        totalTransactions: await prisma.transaction.count(),
        totalDevices: await prisma.device.count(),
        totalBalanceSnapshots: await prisma.balanceSnapshot.count(),
      },
    });
  } catch (error) {
    logger.error('Error getting sync status', { error });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get sync status',
      },
    });
  }
});

// Manually trigger transaction sync for a user
/**
 * @swagger
 * /admin/trigger-sync/{userId}:
 *   post:
 *     summary: Manually trigger transaction sync for a user
 *     tags: [Admin]
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to sync
 *     responses:
 *       200:
 *         description: Sync triggered successfully
 *       404:
 *         description: User not found
 */
router.post('/trigger-sync/:userId', async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Trigger sync asynchronously (don't wait for completion)
    syncUserTransactions(userId).catch(error => {
      logger.error('Error in manual sync trigger', { error, userId });
    });

    logger.info('Manual sync triggered for user', { userId, email: user.email });
    
    res.json({
      success: true,
      message: 'Transaction sync triggered for user',
      userId,
      email: user.email,
    });
  } catch (error) {
    logger.error('Error triggering sync', { error, userId: req.params.userId });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to trigger sync',
      },
    });
  }
});

// Manually trigger balance sync for a user
/**
 * @swagger
 * /admin/trigger-balance-sync/{userId}:
 *   post:
 *     summary: Manually trigger balance sync for a user
 *     tags: [Admin]
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to sync balances for
 *     responses:
 *       200:
 *         description: Balance sync triggered successfully
 *       404:
 *         description: User not found
 */
router.post('/trigger-balance-sync/:userId', async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Trigger balance sync asynchronously (don't wait for completion)
    syncUserBalances(userId).catch(error => {
      logger.error('Error in manual balance sync trigger', { error, userId });
    });

    logger.info('Manual balance sync triggered for user', { userId, email: user.email });
    
    res.json({
      success: true,
      message: 'Balance sync triggered for user',
      userId,
      email: user.email,
    });
  } catch (error) {
    logger.error('Error triggering balance sync', { error, userId: req.params.userId });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to trigger balance sync',
      },
    });
  }
});

// Get list of users (basic stats only)
router.get('/users', async (req: AdminRequest, res) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100); // Max 100
    const offsetNum = parseInt(offset as string, 10) || 0;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        timezone: true,
        notificationTime: true,
        createdAt: true,
        _count: {
          select: {
            devices: true,
            plaidItems: true,
            transactions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limitNum,
      skip: offsetNum,
    });

    const totalUsers = await prisma.user.count();

    res.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        timezone: user.timezone,
        notificationTime: user.notificationTime,
        createdAt: user.createdAt.toISOString(),
        deviceCount: user._count.devices,
        plaidItemCount: user._count.plaidItems,
        transactionCount: user._count.transactions,
      })),
      pagination: {
        total: totalUsers,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < totalUsers,
      },
    });
  } catch (error) {
    logger.error('Error getting users list', { error });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get users list',
      },
    });
  }
});

// Get basic metrics
router.get('/metrics', async (req: AdminRequest, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalPlaidItems,
      activePlaidItems,
      totalTransactions,
      totalDevices,
      totalDailyReports,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          plaidItems: {
            some: {
              status: {
                not: 'expired',
              },
            },
          },
        },
      }),
      prisma.plaidItem.count(),
      prisma.plaidItem.count({
        where: {
          status: {
            not: 'expired',
          },
        },
      }),
      prisma.transaction.count(),
      prisma.device.count(),
      prisma.dailyReport.count(),
    ]);

    // Get recent activity (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const [
      recentUsers,
      recentTransactions,
      recentReports,
    ] = await Promise.all([
      prisma.user.count({
        where: {
          createdAt: {
            gte: oneDayAgo,
          },
        },
      }),
      prisma.transaction.count({
        where: {
          createdAt: {
            gte: oneDayAgo,
          },
        },
      }),
      prisma.dailyReport.count({
        where: {
          createdAt: {
            gte: oneDayAgo,
          },
        },
      }),
    ]);

    res.json({
      overview: {
        totalUsers,
        activeUsers,
        totalPlaidItems,
        activePlaidItems,
        totalTransactions,
        totalDevices,
        totalDailyReports,
      },
      recentActivity: {
        period: 'last 24 hours',
        newUsers: recentUsers,
        newTransactions: recentTransactions,
        newReports: recentReports,
      },
      health: {
        database: 'connected',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting metrics', { error });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get metrics',
      },
    });
  }
});

export default router;

