import { Router } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../auth';
import logger from '../utils/logger';

const router = Router();

// Get history of days with totals
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { limit = '30' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    // Get daily reports for the user, ordered by date descending
    const reports = await prisma.dailyReport.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limitNum,
    });

    logger.info('History request', { userId, reportCount: reports.length });

    const days = reports.map(report => {
      // Ensure date is a valid Date object and convert to ISO string
      const date = report.date instanceof Date ? report.date : new Date(report.date);
      return {
        date: date.toISOString(),
        totalAmount: Number(report.totalAmount),
        transactionCount: report.transactionCount,
        markedPaid: !!report.markedPaidAt,
      };
    });

    res.json({ days });
  } catch (error) {
    logger.error('Get history error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to get history' });
  }
});

export default router;



