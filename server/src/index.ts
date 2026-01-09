import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import plaidRoutes from './routes/plaid';
import todayRoutes from './routes/today';
import historyRoutes from './routes/history';
import settingsRoutes from './routes/settings';
import deviceRoutes from './routes/device';
import adminRoutes from './routes/admin';
import { startTransactionSyncJob } from './jobs/syncTransactions';
import { startNotificationScheduler } from './jobs/sendNotifications';
import { startDailyReportComputationJob } from './jobs/computeDailyReports';
import { startDeviceCleanupJob } from './jobs/cleanupDevices';
import { startBalanceSyncJob } from './jobs/syncBalances';
import { initializeAPNs } from './push';
import { env } from './config/env';
import logger from './utils/logger';
import prisma from './db';
import { errorHandler } from './middleware/errorHandler';
import { authLimiter, plaidLimiter, generalLimiter } from './middleware/rateLimiter';
import { swaggerSpec } from './utils/swagger';

dotenv.config();

// Validate environment variables on startup
try {
  env; // This will throw if validation fails
  logger.info('Environment variables validated successfully');
} catch (error) {
  logger.error('Failed to start server during environment validation', { error });
  process.exit(1);
}

const app = express();
const PORT = env.port;

// Security middleware - Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding if needed
}));

// CORS configuration
const allowedOrigins = env.allowedOrigins 
  ? env.allowedOrigins.split(',').map(origin => origin.trim())
  : ['*']; // Default to allow all in development

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin', { origin, allowedOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general rate limiting to all routes
app.use(generalLimiter);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'DailyPaydown API Documentation',
}));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const healthStatus: {
      status: string;
      timestamp: string;
      database: { status: string; error?: string };
      plaid: { status: string; error?: string };
      apns: { status: string; configured: boolean; error?: string };
      environment: { status: string; nodeEnv: string };
    } = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: { status: 'unknown' },
      plaid: { status: 'unknown' },
      apns: { status: 'unknown', configured: false },
      environment: { status: 'ok', nodeEnv: env.nodeEnv },
    };

    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      healthStatus.database.status = 'ok';
    } catch (error) {
      healthStatus.database.status = 'error';
      healthStatus.database.error = (error as Error).message;
      healthStatus.status = 'degraded';
    }

    // Check Plaid API configuration
    try {
      if (env.plaidClientId && env.plaidSecret) {
        healthStatus.plaid.status = 'configured';
      } else {
        healthStatus.plaid.status = 'not_configured';
        healthStatus.plaid.error = 'Missing Plaid credentials';
      }
    } catch (error) {
      healthStatus.plaid.status = 'error';
      healthStatus.plaid.error = (error as Error).message;
      healthStatus.status = 'degraded';
    }

    // Check APNs configuration
    try {
      const hasAPNsConfig = !!(env.apnsKeyId && env.apnsTeamId && env.apnsBundleId && env.apnsKeyPath);
      healthStatus.apns.configured = hasAPNsConfig;
      healthStatus.apns.status = hasAPNsConfig ? 'configured' : 'not_configured';
      if (!hasAPNsConfig) {
        healthStatus.apns.error = 'APNs configuration incomplete';
      }
    } catch (error) {
      healthStatus.apns.status = 'error';
      healthStatus.apns.error = (error as Error).message;
      healthStatus.status = 'degraded';
    }

    const httpStatus = healthStatus.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(healthStatus);
  } catch (error) {
    logger.error('Health check error', { error });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Routes with specific rate limiters
app.use('/auth', authLimiter, authRoutes); // Stricter rate limiting for auth
app.use('/plaid', plaidLimiter, plaidRoutes); // Moderate rate limiting for Plaid
app.use('/today', todayRoutes);
app.use('/history', historyRoutes);
app.use('/settings', settingsRoutes);
app.use('/device', deviceRoutes);
app.use('/admin', adminRoutes); // Admin routes (protected by API key)

// Error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`, { 
    port: PORT, 
    nodeEnv: env.nodeEnv,
    accessibleFromNetwork: `http://0.0.0.0:${PORT}`
  });
  
  // Initialize APNs
  initializeAPNs();
  
  // Start background jobs
  startTransactionSyncJob();
  startNotificationScheduler();
  startDailyReportComputationJob();
  startDeviceCleanupJob();
  startBalanceSyncJob();
});

