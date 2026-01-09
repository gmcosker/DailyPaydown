import { Router } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../auth';
import logger from '../utils/logger';
import { validate, validators } from '../middleware/validation';

const router = Router();

// Helper function to get start of day in user's timezone
function getStartOfDayInTimezone(date: Date, timezone: string): Date {
  // Convert date to user's timezone and get start of day
  const dateStr = date.toLocaleDateString('en-US', { timeZone: timezone });
  const [month, day, year] = dateStr.split('/');
  // Create date in local time (SQLite stores dates as local time strings)
  // This will be interpreted correctly by SQLite
  const localDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
  return localDate;
}

// Helper function to get end of day in user's timezone
function getEndOfDayInTimezone(date: Date, timezone: string): Date {
  const startOfDay = getStartOfDayInTimezone(date, timezone);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  endOfDay.setMilliseconds(endOfDay.getMilliseconds() - 1);
  return endOfDay;
}

/**
 * @swagger
 * /today:
 *   get:
 *     summary: Get today's spending summary
 *     tags: [Today]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's spending summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalAmount:
 *                   type: number
 *                   description: Total amount spent today
 *                 transactionCount:
 *                   type: integer
 *                   description: Number of transactions today
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 checkingAvailable:
 *                   type: number
 *                   nullable: true
 *                   description: Available balance in checking account
 *                 markedPaid:
 *                   type: boolean
 *                   description: Whether today has been marked as paid
 *       400:
 *         description: No credit account selected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Get user's timezone and account selection
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const accountSelection = await prisma.accountSelection.findUnique({
      where: { userId },
    });

    if (!accountSelection || !accountSelection.creditAccountId) {
      return res.status(400).json({ error: 'No credit account selected' });
    }

    const timezone = user?.timezone || 'America/New_York';
    const now = new Date();
    const startOfDay = getStartOfDayInTimezone(now, timezone);
    const endOfDay = getEndOfDayInTimezone(now, timezone);

    // Get today's transactions
    let transactions;
    if (process.env.TEST_MODE === 'true') {
      // In TEST_MODE with SQLite, fetch all transactions and filter by date string
      // SQLite date comparisons can be tricky, so we'll filter in JavaScript
      const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
      
      // Fetch all transactions for this user and account
      const allTransactions = await prisma.transaction.findMany({
        where: {
          userId,
          accountId: accountSelection.creditAccountId,
        },
      });
      
      // Filter to only today's transactions using date string comparison in user's timezone
      transactions = allTransactions.filter(t => {
        // Convert transaction date to user's timezone and compare date strings
        const txDateStr = new Date(t.date).toLocaleDateString('en-CA', { timeZone: timezone });
        return txDateStr === todayDateStr;
      });
      
      logger.debug(`[TEST MODE] Found ${transactions.length} transactions for today (${todayDateStr}) out of ${allTransactions.length} total`, { userId, todayDateStr, transactionCount: transactions.length });
    } else {
      transactions = await prisma.transaction.findMany({
        where: {
          userId,
          accountId: accountSelection.creditAccountId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });
    }

    // Calculate total
    const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const transactionCount = transactions.length;

    // Get latest balance snapshot for checking account
    let checkingAvailable: number | null = null;
    if (accountSelection.checkingAccountId) {
      const latestBalance = await prisma.balanceSnapshot.findFirst({
        where: {
          userId,
          accountId: accountSelection.checkingAccountId,
        },
        orderBy: {
          asOf: 'desc',
        },
      });

      checkingAvailable = latestBalance?.available ? Number(latestBalance.available) : null;
    }

    // Get today's daily report to check if marked as paid
    const todayReport = await prisma.dailyReport.findUnique({
      where: {
        userId_date: {
          userId,
          date: startOfDay,
        },
      },
    });

    const markedPaid = !!todayReport?.markedPaidAt;

    // Get last sync time (most recent transaction update)
    const lastTransaction = await prisma.transaction.findFirst({
      where: {
        userId,
        accountId: accountSelection.creditAccountId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const lastUpdated = lastTransaction?.updatedAt || null;

    res.json({
      totalAmount,
      transactionCount,
      lastUpdated,
      checkingAvailable,
      markedPaid,
    });
  } catch (error) {
    logger.error('Get today summary error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to get today summary' });
  }
});

// Get today's transactions
router.get('/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const accountSelection = await prisma.accountSelection.findUnique({
      where: { userId },
    });

    if (!accountSelection || !accountSelection.creditAccountId) {
      return res.status(400).json({ error: 'No credit account selected' });
    }

    const timezone = user?.timezone || 'America/New_York';
    const now = new Date();
    const startOfDay = getStartOfDayInTimezone(now, timezone);
    const endOfDay = getEndOfDayInTimezone(now, timezone);

    // Get today's transactions
    let transactions;
    if (process.env.TEST_MODE === 'true') {
      // In TEST_MODE with SQLite, fetch all transactions and filter by date string
      const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
      
      // Fetch all transactions for this user and account
      const allTransactions = await prisma.transaction.findMany({
        where: {
          userId,
          accountId: accountSelection.creditAccountId,
        },
        orderBy: {
          date: 'desc',
        },
      });
      
      // Filter to only today's transactions using date string comparison in user's timezone
      transactions = allTransactions.filter(t => {
        // Convert transaction date to user's timezone and compare date strings
        const txDateStr = new Date(t.date).toLocaleDateString('en-CA', { timeZone: timezone });
        return txDateStr === todayDateStr;
      });
      
      logger.debug(`[TEST MODE Transactions] Found ${transactions.length} transactions for today (${todayDateStr}) out of ${allTransactions.length} total`);
    } else {
      transactions = await prisma.transaction.findMany({
        where: {
          userId,
          accountId: accountSelection.creditAccountId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: {
          date: 'desc',
        },
      });
    }

    res.json({
      transactions: transactions.map(t => ({
        id: t.id,
        name: t.name,
        amount: Number(t.amount),
        pending: t.pending,
        date: t.date,
      })),
    });
  } catch (error) {
    logger.error('Get today transactions error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to get today transactions' });
  }
});

// Mark today as paid
router.post('/mark-paid', authenticateToken, validate([
  validators.date,
]), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { date } = req.body; // Optional: defaults to today

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const accountSelection = await prisma.accountSelection.findUnique({
      where: { userId },
    });

    if (!accountSelection || !accountSelection.creditAccountId) {
      return res.status(400).json({ error: 'No credit account selected' });
    }

    const timezone = user?.timezone || 'America/New_York';
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = getStartOfDayInTimezone(targetDate, timezone);
    const endOfDay = getEndOfDayInTimezone(targetDate, timezone);

    // Get today's transactions to calculate actual totals
    let transactions;
    if (process.env.TEST_MODE === 'true') {
      const allTransactions = await prisma.transaction.findMany({
        where: {
          userId,
          accountId: accountSelection.creditAccountId,
        },
      });
      const todayDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: timezone });
      transactions = allTransactions.filter(t => {
        const txDateStr = new Date(t.date).toLocaleDateString('en-CA', { timeZone: timezone });
        return txDateStr === todayDateStr;
      });
    } else {
      transactions = await prisma.transaction.findMany({
        where: {
          userId,
          accountId: accountSelection.creditAccountId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });
    }

    const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const transactionCount = transactions.length;

    // Get or create daily report with correct totals
    const dailyReport = await prisma.dailyReport.upsert({
      where: {
        userId_date: {
          userId,
          date: startOfDay,
        },
      },
      update: {
        markedPaidAt: new Date(),
        totalAmount,
        transactionCount,
        lastComputedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId,
        date: startOfDay,
        totalAmount,
        transactionCount,
        markedPaidAt: new Date(),
      },
    });

    res.json({ success: true, markedPaidAt: dailyReport.markedPaidAt });
  } catch (error) {
    logger.error('Mark paid error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to mark as paid' });
  }
});

// TEST MODE: Add mock transactions for today
router.post('/test/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (process.env.TEST_MODE !== 'true') {
      return res.status(403).json({ error: 'Test mode only' });
    }

    const userId = req.userId!;
    const { count = 5 } = req.body; // Default to 5 transactions

    const accountSelection = await prisma.accountSelection.findUnique({
      where: { userId },
    });

    if (!accountSelection || !accountSelection.creditAccountId) {
      return res.status(400).json({ error: 'No credit account selected' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const timezone = user?.timezone || 'America/New_York';
    const now = new Date();
    const startOfDay = getStartOfDayInTimezone(now, timezone);
    const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone });

    // Delete existing transactions for today first
    const existingTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        accountId: accountSelection.creditAccountId,
      },
    });
    
    const todayTransactions = existingTransactions.filter(t => {
      const txDateStr = new Date(t.date).toLocaleDateString('en-CA', { timeZone: timezone });
      return txDateStr === todayDateStr;
    });
    
    if (todayTransactions.length > 0) {
      // Delete each transaction individually (works better with SQLite)
      await Promise.all(
        todayTransactions.map(t => prisma.transaction.delete({ where: { id: t.id } }))
      );
      logger.debug(`Deleted ${todayTransactions.length} existing transactions for today`);
    }

    // Mock transactions with varied amounts for today (Jan 9, 2026)
    const mockTransactions = [
      { name: 'Starbucks', amount: 6.75 },
      { name: 'Shell Gas', amount: 52.30 },
      { name: 'Whole Foods', amount: 124.68 },
      { name: 'Olive Garden', amount: 78.92 },
      { name: 'Best Buy', amount: 349.99 },
      { name: 'Lyft', amount: 23.45 },
      { name: 'CVS Pharmacy', amount: 41.50 },
      { name: 'Costco', amount: 287.13 },
    ].slice(0, count);
    
    // Add some randomness to amounts to make it more realistic
    const randomizeAmount = (baseAmount: number) => {
      const variation = baseAmount * 0.1; // ±10% variation
      return Number((baseAmount + (Math.random() - 0.5) * variation * 2).toFixed(2));
    };

    const created = [];
    for (const tx of mockTransactions) {
      const transactionDate = new Date(startOfDay);
      transactionDate.setHours(9 + Math.floor(Math.random() * 12)); // Random time during day
      transactionDate.setMinutes(Math.floor(Math.random() * 60));

      const randomizedAmount = randomizeAmount(tx.amount);
      
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          accountId: accountSelection.creditAccountId,
          plaidTransactionId: `test-${Date.now()}-${Math.random()}`,
          date: transactionDate,
          name: tx.name,
          amount: randomizedAmount,
          pending: Math.random() > 0.8, // 20% chance of being pending
        },
      });

      created.push({
        id: transaction.id,
        name: transaction.name,
        amount: Number(transaction.amount),
        pending: transaction.pending,
      });
    }

    res.json({ success: true, transactions: created, message: `Created ${created.length} test transactions` });
  } catch (error) {
    logger.error('Test transactions error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to create test transactions' });
  }
});

// TEST MODE: Set mock checking balance
router.post('/test/balance', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (process.env.TEST_MODE !== 'true') {
      return res.status(403).json({ error: 'Test mode only' });
    }

    const userId = req.userId!;
    const { amount = 5000 } = req.body; // Default $5000 checking balance

    const accountSelection = await prisma.accountSelection.findUnique({
      where: { userId },
    });

    if (!accountSelection || !accountSelection.checkingAccountId) {
      return res.status(400).json({ error: 'No checking account selected' });
    }

    await prisma.balanceSnapshot.create({
      data: {
        userId,
        accountId: accountSelection.checkingAccountId,
        available: amount,
        current: amount,
        asOf: new Date(),
      },
    });

    res.json({ success: true, balance: amount, message: `Set checking balance to $${amount.toFixed(2)}` });
  } catch (error) {
    logger.error('Test balance error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to set test balance' });
  }
});

// TEST MODE: Manually trigger notification
router.post('/test/notification', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (process.env.TEST_MODE !== 'true') {
      return res.status(403).json({ error: 'Test mode only' });
    }

    const userId = req.userId!;
    
    // Import and call the notification sending function
    const { sendNotificationsForUser } = await import('../jobs/sendNotifications');
    await sendNotificationsForUser(userId);

    res.json({ success: true, message: 'Notification triggered (if device is registered, check app or server logs)' });
  } catch (error) {
    logger.error('Test notification error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to trigger notification' });
  }
});

// TEST MODE: Reset marked as paid for today
router.post('/test/reset-paid', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (process.env.TEST_MODE !== 'true') {
      return res.status(403).json({ error: 'Test mode only' });
    }

    const userId = req.userId!;
    const { date } = req.body; // Optional: defaults to today

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const timezone = user?.timezone || 'America/New_York';
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = getStartOfDayInTimezone(targetDate, timezone);

    // Update daily report to remove markedPaidAt
    await prisma.dailyReport.updateMany({
      where: {
        userId,
        date: startOfDay,
      },
      data: {
        markedPaidAt: null,
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, message: 'Marked as paid status reset for today' });
  } catch (error) {
    console.error('Test reset paid error:', error);
    res.status(500).json({ error: 'Failed to reset marked as paid' });
  }
});

// TEST MODE: Create mock history for multiple days (2 days ago, yesterday, today, tomorrow)
router.post('/test/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (process.env.TEST_MODE !== 'true') {
      return res.status(403).json({ error: 'Test mode only' });
    }

    const userId = req.userId!;

    const accountSelection = await prisma.accountSelection.findUnique({
      where: { userId },
    });

    if (!accountSelection || !accountSelection.creditAccountId) {
      return res.status(400).json({ error: 'No credit account selected' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const timezone = user?.timezone || 'America/New_York';
    const now = new Date();

    // Define days to create: 2 days ago, yesterday, today, tomorrow
    const daysToCreate = [
      { offset: -2, name: '2 days ago', markPaid: true, transactionCount: 4 },
      { offset: -1, name: 'yesterday', markPaid: false, transactionCount: 6 },
      { offset: 0, name: 'today', markPaid: true, transactionCount: 5 }, // Today already exists
      { offset: 1, name: 'tomorrow', markPaid: false, transactionCount: 3 },
    ];

    const mockTransactionNames = [
      'Coffee Shop',
      'Gas Station',
      'Grocery Store',
      'Restaurant',
      'Amazon Purchase',
      'Uber Ride',
      'Pharmacy',
      'Target',
      'Starbucks',
      'CVS',
      'Whole Foods',
      'Netflix',
    ];

    const mockAmounts = [
      5.50, 45.20, 87.45, 62.30, 129.99, 18.75, 34.20, 156.88, 8.99, 12.50, 95.00, 15.99,
    ];

    const created = [];

    for (const day of daysToCreate) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + day.offset);
      const startOfDay = getStartOfDayInTimezone(targetDate, timezone);

      // Create mock transactions for this day
      const transactions = [];
      for (let i = 0; i < day.transactionCount; i++) {
        const nameIndex = i % mockTransactionNames.length;
        // Handle negative offsets correctly for amountIndex
        const amountIndex = ((i + day.offset) % mockAmounts.length + mockAmounts.length) % mockAmounts.length;
        const amount = mockAmounts[amountIndex];
        const name = mockTransactionNames[nameIndex];

        const transactionDate = new Date(startOfDay);
        transactionDate.setHours(9 + Math.floor(Math.random() * 12));
        transactionDate.setMinutes(Math.floor(Math.random() * 60));

        const plaidTxId = `test-history-${day.offset}-${i}-${userId}`;
        const isPending = Math.random() > 0.85; // 15% chance of being pending
        
        // Check if transaction already exists
        const existingTx = await prisma.transaction.findUnique({
          where: { plaidTransactionId: plaidTxId },
        });
        
        const transaction = existingTx
          ? await prisma.transaction.update({
              where: { plaidTransactionId: plaidTxId },
              data: {
                date: transactionDate,
                name,
                amount,
                pending: isPending,
              },
            })
          : await prisma.transaction.create({
              data: {
                userId,
                accountId: accountSelection.creditAccountId,
                plaidTransactionId: plaidTxId,
                date: transactionDate,
                name,
                amount,
                pending: isPending,
              },
            });

        transactions.push(transaction);
      }

      // Calculate total for this day
      const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

      // Check if daily report already exists
      const existingReport = await prisma.dailyReport.findUnique({
        where: {
          userId_date: {
            userId,
            date: startOfDay,
          },
        },
      });

      // Prepare update data
      const updateData: any = {
        totalAmount,
        transactionCount: day.transactionCount,
        lastComputedAt: new Date(),
      };
      
      if (day.markPaid) {
        updateData.markedPaidAt = new Date();
      } else if (existingReport) {
        // Only set to null if we're updating an existing report that was marked as paid
        updateData.markedPaidAt = null;
      }

      // Create or update daily report
      const dailyReport = existingReport
        ? await prisma.dailyReport.update({
            where: {
              userId_date: {
                userId,
                date: startOfDay,
              },
            },
            data: updateData,
          })
        : await prisma.dailyReport.create({
            data: {
              userId,
              date: startOfDay,
              totalAmount,
              transactionCount: day.transactionCount,
              markedPaidAt: day.markPaid ? new Date() : undefined,
              lastComputedAt: new Date(),
            },
          });

      created.push({
        date: day.name,
        totalAmount: Number(totalAmount),
        transactionCount: day.transactionCount,
        markedPaid: day.markPaid,
        dateISO: startOfDay.toISOString(),
      });
    }

    res.json({
      success: true,
      message: `Created mock history for ${created.length} days`,
      days: created,
    });
  } catch (error: any) {
    logger.error('Test history error', { 
      error: error?.message || error,
      errorName: error?.name,
      stack: error?.stack,
      userId: req.userId 
    });
    console.error('Test history error details:', error);
    res.status(500).json({ 
      error: 'Failed to create test history',
      details: error?.message || 'Unknown error'
    });
  }
});

// TEST MODE: Clean up test history - remove transactions and reports for days other than today
router.post('/test/cleanup', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (process.env.TEST_MODE !== 'true') {
      return res.status(403).json({ error: 'Test mode only' });
    }

    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const timezone = user?.timezone || 'America/New_York';
    const now = new Date();
    const todayStartOfDay = getStartOfDayInTimezone(now, timezone);
    const todayEndOfDay = getEndOfDayInTimezone(now, timezone);

    // Delete transactions that are NOT for today (past and future)
    const deletedTransactions = await prisma.transaction.deleteMany({
      where: {
        userId,
        OR: [
          { date: { lt: todayStartOfDay } }, // Past dates
          { date: { gt: todayEndOfDay } },   // Future dates
        ],
      },
    });

    // Delete daily reports that are NOT for today (past and future)
    const deletedReports = await prisma.dailyReport.deleteMany({
      where: {
        userId,
        OR: [
          { date: { lt: todayStartOfDay } }, // Past dates
          { date: { gt: todayEndOfDay } },   // Future dates
        ],
      },
    });

    res.json({
      success: true,
      message: `Cleaned up test history`,
      deleted: {
        transactions: deletedTransactions.count,
        dailyReports: deletedReports.count,
      },
    });
  } catch (error: any) {
    logger.error('Test cleanup error', { error: error?.message || error, userId: req.userId });
    res.status(500).json({ error: 'Failed to clean up test history', details: error?.message });
  }
});

export default router;



