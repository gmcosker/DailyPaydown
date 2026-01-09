import apn from 'apn';
import prisma from './db';
import logger from './utils/logger';

let apnProvider: apn.Provider | null = null;

export function initializeAPNs() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const keyPath = process.env.APNS_KEY_PATH;

  if (!keyId || !teamId || !bundleId || !keyPath) {
    logger.warn('APNs configuration incomplete. Push notifications will not work.');
    return;
  }

  try {
    apnProvider = new apn.Provider({
      token: {
        key: keyPath,
        keyId: keyId,
        teamId: teamId,
      },
      production: process.env.NODE_ENV === 'production',
    });

    logger.info('APNs provider initialized', { keyId, teamId, bundleId });
  } catch (error) {
    logger.error('Failed to initialize APNs provider', { error });
  }
}

/**
 * Send push notification with retry logic
 * Retries up to 3 times with exponential backoff
 */
export async function sendPushNotification(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, any>,
  retryCount: number = 0
): Promise<boolean> {
  if (!apnProvider) {
    logger.error('APNs provider not initialized');
    return false;
  }

  const notification = new apn.Notification();

  notification.alert = {
    title,
    body,
  };

  notification.topic = process.env.APNS_BUNDLE_ID!;
  notification.sound = 'default';
  notification.badge = 1;
  notification.payload = data || {};

  // Set expiration to 1 hour from now
  notification.expiry = Math.floor(Date.now() / 1000) + 3600;

  try {
    const result = await apnProvider.send(notification, deviceToken);
    
    if (result.failed.length > 0) {
      // Check for invalid token errors
      const invalidTokenErrors = result.failed.filter((failure: any) => {
        const status = failure.status;
        // APNs status codes: 410 = Unregistered (token invalid), 400 = BadDeviceToken
        return status === 410 || status === 400 || status === '410' || status === '400';
      });

      if (invalidTokenErrors.length > 0) {
        logger.warn('Invalid APNs token detected, will be cleaned up', { 
          deviceToken: deviceToken.substring(0, 20) + '...',
          errors: invalidTokenErrors 
        });
        // Don't retry invalid tokens - they're permanently invalid
        return false;
      }

      // For other errors, retry with exponential backoff
      const maxRetries = 3;
      if (retryCount < maxRetries) {
        const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        logger.warn('Push notification failed, retrying', { 
          deviceToken: deviceToken.substring(0, 20) + '...',
          retryCount: retryCount + 1,
          maxRetries,
          backoffDelay,
          errors: result.failed
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        // Retry
        return sendPushNotification(deviceToken, title, body, data, retryCount + 1);
      }

      logger.error('Failed to send push notification after retries', { 
        failed: result.failed, 
        deviceToken: deviceToken.substring(0, 20) + '...',
        retryCount 
      });
      return false;
    }

    if (retryCount > 0) {
      logger.info('Push notification sent successfully after retry', { 
        deviceToken: deviceToken.substring(0, 20) + '...',
        retryCount 
      });
    } else {
      logger.debug('Push notification sent successfully', { deviceToken: deviceToken.substring(0, 20) + '...' });
    }
    return true;
  } catch (error) {
    // For network/connection errors, retry with exponential backoff
    const maxRetries = 3;
    if (retryCount < maxRetries) {
      const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      logger.warn('Error sending push notification, retrying', { 
        error,
        deviceToken: deviceToken.substring(0, 20) + '...',
        retryCount: retryCount + 1,
        maxRetries,
        backoffDelay
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      
      // Retry
      return sendPushNotification(deviceToken, title, body, data, retryCount + 1);
    }

    logger.error('Error sending push notification after retries', { 
      error, 
      deviceToken: deviceToken.substring(0, 20) + '...',
      retryCount 
    });
    return false;
  }
}

export async function sendDailyNotification(
  userId: string,
  totalAmount: number,
  transactionCount: number
): Promise<boolean> {
  // Get all devices for this user
  const devices = await prisma.device.findMany({
    where: { userId },
  });

  if (devices.length === 0) {
    logger.warn('No devices found for user', { userId });
    return false;
  }

  const title = 'Daily Paydown';
  const body = `You spent USD ${totalAmount.toFixed(2)} today across ${transactionCount} purchase${transactionCount === 1 ? '' : 's'}. Tap to review.`;

  let successCount = 0;
  const failedDevices: string[] = [];

  for (const device of devices) {
    const success = await sendPushNotification(device.apnsToken, title, body, {
      type: 'daily_summary',
      userId,
    });
    
    if (success) {
      successCount++;
    } else {
      failedDevices.push(device.id);
      logger.warn('Failed to send notification to device after retries', { 
        deviceId: device.id, 
        userId 
      });
    }
  }

  // If all devices failed, log for monitoring
  if (successCount === 0 && devices.length > 0) {
    logger.error('Failed to send notification to any device for user', { 
      userId, 
      deviceCount: devices.length,
      failedDeviceIds: failedDevices
    });
  }

  return successCount > 0;
}



