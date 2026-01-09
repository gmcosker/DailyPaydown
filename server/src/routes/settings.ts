import { Router } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../auth';
import logger from '../utils/logger';
import { validate, validators } from '../middleware/validation';

const router = Router();

/**
 * @swagger
 * /settings:
 *   get:
 *     summary: Get user settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notificationTime:
 *                   type: string
 *                   nullable: true
 *                   example: "19:00"
 *                 timezone:
 *                   type: string
 *                   nullable: true
 *                   example: "America/New_York"
 *                 goal:
 *                   type: string
 *                   nullable: true
 *                 creditAccountId:
 *                   type: string
 *                   nullable: true
 *                 checkingAccountId:
 *                   type: string
 *                   nullable: true
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        notificationTime: true,
        timezone: true,
        goal: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accountSelection = await prisma.accountSelection.findUnique({
      where: { userId },
      select: {
        creditAccountId: true,
        checkingAccountId: true,
      },
    });

    res.json({
      notificationTime: user.notificationTime,
      timezone: user.timezone,
      goal: user.goal,
      creditAccountId: accountSelection?.creditAccountId || null,
      checkingAccountId: accountSelection?.checkingAccountId || null,
    });
  } catch (error) {
    logger.error('Get settings error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * @swagger
 * /settings:
 *   patch:
 *     summary: Update user settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationTime:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: "19:00"
 *               timezone:
 *                 type: string
 *                 example: "America/New_York"
 *               goal:
 *                 type: string
 *               creditAccountId:
 *                 type: string
 *               checkingAccountId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.patch('/', authenticateToken, validate([
  validators.notificationTime,
  validators.timezone,
  validators.goal,
  validators.creditAccountId,
  validators.checkingAccountId,
]), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { notificationTime, timezone, goal, creditAccountId, checkingAccountId } = req.body;

    // Update user settings
    const updateData: any = {};
    if (notificationTime !== undefined) updateData.notificationTime = notificationTime;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (goal !== undefined) updateData.goal = goal;

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    // Update account selection if provided
    if (creditAccountId !== undefined || checkingAccountId !== undefined) {
      await prisma.accountSelection.upsert({
        where: { userId },
        update: {
          creditAccountId: creditAccountId !== undefined ? creditAccountId : undefined,
          checkingAccountId: checkingAccountId !== undefined ? checkingAccountId : undefined,
          updatedAt: new Date(),
        },
        create: {
          userId,
          creditAccountId: creditAccountId || null,
          checkingAccountId: checkingAccountId || null,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Update settings error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;



