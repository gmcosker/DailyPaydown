/**
 * Daily report computation job
 * Computes daily reports independently from notification sending
 * Runs daily to compute reports for the previous day in each user's timezone
 */

import * as cron from 'node-cron';
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';
import prisma from '../db';
import logger from '../utils/logger';

async function computeDailyReportsForUser(userId: string, targetDate: Date) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
      },
    });

    if (!user || !user.timezone) {
      logger.debug('User timezone not configured, skipping report computation', { userId });
      return;
    }

    const timezone = user.timezone;

    // Get account selection
    const accountSelection = await prisma.accountSelection.findUnique({
      where: { userId },
    });

    if (!accountSelection || !accountSelection.creditAccountId) {
      logger.debug('No credit account selected, skipping report computation', { userId });
      return;
    }

    // Get date string for target date in user's timezone
    const targetDateStr = formatInTimeZone(targetDate, timezone, 'yyyy-MM-dd');
    
    // Create start of day in user's timezone, then convert to UTC for database storage
    const startOfDayLocal = new Date(`${targetDateStr}T00:00:00`);
    const startOfDayUTC = zonedTimeToUtc(startOfDayLocal, timezone);
    
    // End of day
    const endOfDayLocal = new Date(startOfDayLocal);
    endOfDayLocal.setDate(endOfDayLocal.getDate() + 1);
    const endOfDayUTC = zonedTimeToUtc(endOfDayLocal, timezone);

    // Get all transactions for this day
    const allTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        accountId: accountSelection.creditAccountId,
        date: {
          gte: startOfDayUTC,
          lt: endOfDayUTC,
        },
      },
    });

    // Filter to only transactions that match the target date in user's timezone
    const dayTransactions = allTransactions.filter(t => {
      const transactionDateStr = formatInTimeZone(t.date, timezone, 'yyyy-MM-dd');
      return transactionDateStr === targetDateStr;
    });

    const totalAmount = dayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const transactionCount = dayTransactions.length;

    // Create or update daily report
    await prisma.dailyReport.upsert({
      where: {
        userId_date: {
          userId,
          date: startOfDayUTC,
        },
      },
      update: {
        totalAmount,
        transactionCount,
        lastComputedAt: new Date(),
      },
      create: {
        userId,
        date: startOfDayUTC,
        totalAmount,
        transactionCount,
        lastComputedAt: new Date(),
      },
    });

    logger.debug('Computed daily report', { 
      userId, 
      date: targetDateStr, 
      totalAmount, 
      transactionCount 
    });
  } catch (error) {
    logger.error('Error computing daily report for user', { error, userId });
  }
}

async function computeDailyReportsJob() {
  try {
    logger.info('Running daily report computation job');
    
    // Get all users
    const users = await prisma.user.findMany({
      select: { 
        id: true,
        timezone: true,
      },
    });

    // Compute reports for yesterday (relative to UTC)
    // Each user's report will be for their "yesterday" in their timezone
    const now = new Date();
    const yesterdayUTC = new Date(now);
    yesterdayUTC.setDate(yesterdayUTC.getDate() - 1);

    logger.debug('Computing daily reports for previous day', { 
      userCount: users.length,
      targetDateUTC: yesterdayUTC.toISOString()
    });

    // For each user, compute report for their "yesterday" in their timezone
    for (const user of users) {
      if (!user.timezone) {
        continue; // Skip users without timezone
      }

      // Get yesterday in user's timezone
      const yesterdayInUserTz = formatInTimeZone(yesterdayUTC, user.timezone, 'yyyy-MM-dd');
      const yesterdayDate = new Date(`${yesterdayInUserTz}T00:00:00`);
      
      await computeDailyReportsForUser(user.id, yesterdayDate);
    }

    logger.info('Daily report computation job completed', { userCount: users.length });
  } catch (error) {
    logger.error('Error in daily report computation job', { error });
  }
}

export function startDailyReportComputationJob() {
  // Run daily at midnight UTC (00:00 UTC)
  // Cron: '0 0 * * *' means "at 00:00 on every day"
  cron.schedule('0 0 * * *', async () => {
    await computeDailyReportsJob();
  });

  logger.info('Daily report computation job scheduled', { schedule: 'daily at 00:00 UTC' });
}

// Export for manual triggering if needed
export { computeDailyReportsJob };


