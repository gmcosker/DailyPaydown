import * as cron from 'node-cron';
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';
import prisma from '../db';
import { sendDailyNotification } from '../push';
import logger from '../utils/logger';

async function sendNotificationsForUser(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
        notificationTime: true,
      },
    });

    if (!user || !user.timezone || !user.notificationTime) {
      return; // User hasn't configured notifications
    }

    const timezone = user.timezone;
    const [hours, minutes] = user.notificationTime.split(':').map(Number);

    // Get current time in user's timezone
    const now = new Date();
    const userTime = formatInTimeZone(now, timezone, 'HH:mm');
    const [currentHours, currentMinutes] = userTime.split(':').map(Number);

    // Check if it's the notification time (within 1 minute window)
    if (currentHours !== hours || Math.abs(currentMinutes - minutes) > 1) {
      return; // Not the right time
    }

    // Get today's date string in user's timezone
    const todayInTimezone = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
    
    // Create start of day in user's timezone, then convert to UTC for database storage
    const startOfDayLocal = new Date(`${todayInTimezone}T00:00:00`);
    const startOfDayUTC = zonedTimeToUtc(startOfDayLocal, timezone);
    
    // Check if we've already sent a notification for today
    const todayReport = await prisma.dailyReport.findUnique({
      where: {
        userId_date: {
          userId,
          date: startOfDayUTC,
        },
      },
    });

    if (todayReport?.pushSentAt) {
      // Already sent today
      return;
    }

    // Get today's daily report (should already be computed by the daily computation job)
    // If it doesn't exist, compute it on the fly as a fallback
    let dailyReport = await prisma.dailyReport.findUnique({
      where: {
        userId_date: {
          userId,
          date: startOfDayUTC,
        },
      },
    });

    // Fallback: compute report if it doesn't exist
    if (!dailyReport) {
      logger.warn('Daily report not found, computing on the fly', { userId, date: todayInTimezone });
      
      // Get account selection
      const accountSelection = await prisma.accountSelection.findUnique({
        where: { userId },
      });

      if (!accountSelection || !accountSelection.creditAccountId) {
        return; // No account selected
      }

      // Calculate today's total
      const endOfDayLocal = new Date(startOfDayLocal);
      endOfDayLocal.setDate(endOfDayLocal.getDate() + 1);
      const endOfDayUTC = zonedTimeToUtc(endOfDayLocal, timezone);

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

      // Filter to only transactions that are "today" in user's timezone
      const todayTransactions = allTransactions.filter(t => {
        const transactionDateStr = formatInTimeZone(t.date, timezone, 'yyyy-MM-dd');
        return transactionDateStr === todayInTimezone;
      });

      const totalAmount = todayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const transactionCount = todayTransactions.length;

      // Create daily report
      dailyReport = await prisma.dailyReport.create({
        data: {
          userId,
          date: startOfDayUTC,
          totalAmount,
          transactionCount,
          lastComputedAt: new Date(),
        },
      });
    }

    const totalAmount = Number(dailyReport.totalAmount);
    const transactionCount = dailyReport.transactionCount;

    // Send push notification (only if there are transactions or amount > 0)
    // Skip notification if no transactions to avoid spam
    if (transactionCount === 0 && totalAmount === 0) {
      logger.debug('Skipping notification - no transactions for today', { userId, date: todayInTimezone });
      return;
    }

    const success = await sendDailyNotification(userId, totalAmount, transactionCount);

    if (success) {
      // Update report with push sent time
      await prisma.dailyReport.update({
        where: { id: dailyReport.id },
        data: { pushSentAt: new Date() },
      });
      logger.info('Sent daily notification to user', { userId, totalAmount, transactionCount });
    }
  } catch (error) {
    logger.error('Error sending notification for user', { error, userId });
  }
}

export function startNotificationScheduler() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    for (const user of users) {
      await sendNotificationsForUser(user.id);
    }
  });

  logger.info('Notification scheduler started', { schedule: 'every minute' });
}

// Export for test endpoints
export { sendNotificationsForUser };
