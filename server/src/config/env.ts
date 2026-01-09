/**
 * Environment variable validation and configuration
 * Validates required environment variables on startup and fails fast with clear error messages
 */

interface EnvConfig {
  databaseUrl: string;
  jwtSecret: string;
  plaidClientId: string;
  plaidSecret: string;
  plaidEnv: string;
  plaidTokenEncryptionKey: string;
  port: number;
  nodeEnv: string;
  // Optional APNs configuration
  apnsKeyId?: string;
  apnsTeamId?: string;
  apnsBundleId?: string;
  apnsKeyPath?: string;
  // Optional webhook configuration
  plaidWebhookVerificationKey?: string;
  // Optional admin configuration
  adminApiKey?: string;
  // Optional CORS configuration
  allowedOrigins?: string;
}

// If TEST_MODE is enabled, Plaid vars are optional
const isTestMode = process.env.TEST_MODE === 'true';

const requiredEnvVars = isTestMode
  ? ['DATABASE_URL', 'JWT_SECRET', 'PLAID_TOKEN_ENCRYPTION_KEY']
  : ['DATABASE_URL', 'JWT_SECRET', 'PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV', 'PLAID_TOKEN_ENCRYPTION_KEY'];

const optionalEnvVars = [
  'APNS_KEY_ID',
  'APNS_TEAM_ID',
  'APNS_BUNDLE_ID',
  'APNS_KEY_PATH',
  'PLAID_WEBHOOK_VERIFICATION_KEY',
  'ADMIN_API_KEY',
  'ALLOWED_ORIGINS',
  // In test mode, Plaid vars are optional
  ...(isTestMode ? ['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV'] : []),
] as const;

function validateEnvVar(name: string, value: string | undefined, required: boolean): void {
  if (required && (!value || value.trim() === '')) {
    throw new Error(`Required environment variable ${name} is missing or empty`);
  }
}

function validateEncryptionKey(key: string): void {
  if (key.length !== 64) {
    throw new Error(
      `PLAID_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 characters), got ${key.length} characters`
    );
  }
  
  // Validate it's a valid hex string
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('PLAID_TOKEN_ENCRYPTION_KEY must be a valid hex string');
  }
}

function validatePlaidEnv(env: string): void {
  const validEnvs = ['sandbox', 'development', 'production'];
  if (!validEnvs.includes(env.toLowerCase())) {
    throw new Error(
      `PLAID_ENV must be one of: ${validEnvs.join(', ')}, got: ${env}`
    );
  }
}

export function validateEnvironment(): EnvConfig {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required environment variables
  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    try {
      validateEnvVar(varName, value, true);
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  // Validate optional environment variables and collect warnings
  for (const varName of optionalEnvVars) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      if (varName.startsWith('APNS_')) {
        warnings.push(`Optional environment variable ${varName} is not set. Push notifications will not work.`);
      }
    }
  }

  // Validate specific formats (only if not in test mode or if values are provided)
  const plaidTokenKey = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  if (plaidTokenKey) {
    try {
      validateEncryptionKey(plaidTokenKey);
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  const plaidEnv = process.env.PLAID_ENV;
  if (plaidEnv) {
    try {
      validatePlaidEnv(plaidEnv);
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  // Display warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Variable Warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
    console.warn('');
  }

  // Throw errors if any required variables are missing or invalid
  if (errors.length > 0) {
    console.error('\n❌ Environment Variable Validation Failed:\n');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.\n');
    throw new Error('Environment validation failed. See errors above.');
  }

  // Build and return configuration object
  const config: EnvConfig = {
    databaseUrl: process.env.DATABASE_URL!,
    jwtSecret: process.env.JWT_SECRET!,
    plaidClientId: process.env.PLAID_CLIENT_ID!,
    plaidSecret: process.env.PLAID_SECRET!,
    plaidEnv: (process.env.PLAID_ENV || 'sandbox').toLowerCase(),
    plaidTokenEncryptionKey: process.env.PLAID_TOKEN_ENCRYPTION_KEY!,
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apnsKeyId: process.env.APNS_KEY_ID,
    apnsTeamId: process.env.APNS_TEAM_ID,
    apnsBundleId: process.env.APNS_BUNDLE_ID,
    apnsKeyPath: process.env.APNS_KEY_PATH,
    plaidWebhookVerificationKey: process.env.PLAID_WEBHOOK_VERIFICATION_KEY,
    adminApiKey: process.env.ADMIN_API_KEY,
    allowedOrigins: process.env.ALLOWED_ORIGINS,
  };

  return config;
}

export const env = validateEnvironment();

