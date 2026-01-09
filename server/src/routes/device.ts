import { Router } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../auth';
import logger from '../utils/logger';
import { validate, validators } from '../middleware/validation';

const router = Router();

// Register device for push notifications
router.post('/register', authenticateToken, validate([
  validators.apnsToken,
]), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { apnsToken } = req.body;

    // Upsert device (one device per token)
    await prisma.device.upsert({
      where: { apnsToken },
      update: {
        userId,
        updatedAt: new Date(),
      },
      create: {
        userId,
        apnsToken,
      },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Device registration error', { error, userId: req.userId });
    res.status(500).json({ error: 'Failed to register device' });
  }
});

export default router;



