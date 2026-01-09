/**
 * Device cleanup job
 * Removes devices with invalid APNs tokens
 * Runs weekly to clean up devices that have failed notification attempts
 */

import * as cron from 'node-cron';
import prisma from '../db';
import logger from '../utils/logger';
import { sendPushNotification } from '../push';

/**
 * Test a device token by attempting to send a silent notification
 * Returns true if token is valid, false if invalid
 */
async function testDeviceToken(deviceToken: string): Promise<boolean> {
  try {
    // Send a silent notification to test the token
    // Using a minimal notification that won't show to user
    const result = await sendPushNotification(
      deviceToken,
      '', // Empty title = silent
      '', // Empty body = silent
      { test: true }
    );
    return result;
  } catch (error) {
    logger.debug('Error testing device token', { error, deviceToken: deviceToken.substring(0, 20) + '...' });
    return false;
  }
}

/**
 * Cleanup invalid devices
 * Tests devices and removes those with invalid tokens
 */
async function cleanupInvalidDevices() {
  try {
    logger.info('Starting device cleanup job');

    // Get all devices
    const devices = await prisma.device.findMany({
      select: {
        id: true,
        apnsToken: true,
        userId: true,
        createdAt: true,
      },
    });

    logger.debug('Testing devices for validity', { deviceCount: devices.length });

    let removedCount = 0;
    const batchSize = 10; // Process in batches to avoid overwhelming APNs

    for (let i = 0; i < devices.length; i += batchSize) {
      const batch = devices.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (device) => {
          try {
            const isValid = await testDeviceToken(device.apnsToken);
            
            if (!isValid) {
              logger.info('Removing invalid device', { 
                deviceId: device.id, 
                userId: device.userId,
                createdAt: device.createdAt 
              });
              
              await prisma.device.delete({
                where: { id: device.id },
              });
              
              removedCount++;
            }
          } catch (error) {
            logger.error('Error testing device during cleanup', { 
              error, 
              deviceId: device.id 
            });
          }
        })
      );

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < devices.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info('Device cleanup job completed', { 
      totalDevices: devices.length,
      removedCount 
    });
  } catch (error) {
    logger.error('Error in device cleanup job', { error });
  }
}

export function startDeviceCleanupJob() {
  // Run weekly on Sunday at 2 AM UTC
  // Cron: '0 2 * * 0' means "at 02:00 on Sunday"
  cron.schedule('0 2 * * 0', async () => {
    await cleanupInvalidDevices();
  });

  logger.info('Device cleanup job scheduled', { schedule: 'weekly on Sunday at 02:00 UTC' });
}

// Export for manual triggering if needed
export { cleanupInvalidDevices };

