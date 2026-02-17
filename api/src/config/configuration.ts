import fs from 'fs';

const readSecret = (value?: string, filePath?: string) => {
  if (value) {
    return value;
  }
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  return '';
};

export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean),
  },
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: readSecret(process.env.DB_PASSWORD, process.env.DB_PASSWORD_FILE),
    database: process.env.DB_DATABASE ?? 'vit_platform',
    ssl: process.env.DB_SSL === 'true',
    defaultSchema: process.env.DB_DEFAULT_SCHEMA ?? 'platform',
  },
  auth: {
    jwtSecret: readSecret(process.env.JWT_SECRET, process.env.JWT_SECRET_FILE),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    jwtRefreshSecret: readSecret(
      process.env.JWT_REFRESH_SECRET,
      process.env.JWT_REFRESH_SECRET_FILE,
    ),
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    forceMfaForAdmins: process.env.FORCE_MFA_FOR_ADMINS === 'true',
    maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS ?? 5),
    lockoutMinutes: Number(process.env.LOCKOUT_MINUTES ?? 15),
  },
  bootstrap: {
    token: readSecret(process.env.BOOTSTRAP_TOKEN, process.env.BOOTSTRAP_TOKEN_FILE),
  },
  rateLimit: {
    ttl: Number(process.env.RATE_LIMIT_TTL ?? 60),
    limit: Number(process.env.RATE_LIMIT_LIMIT ?? 100),
    perTenantLimit: Number(process.env.RATE_LIMIT_PER_TENANT ?? 500),
    perUserLimit: Number(process.env.RATE_LIMIT_PER_USER ?? 100),
  },
  email: {
    // Mailgun HTTP API (preferred): set MAILGUN_API_KEY + MAILGUN_DOMAIN. Optional MAILGUN_URL for EU (https://api.eu.mailgun.net).
    mailgunApiKey: readSecret(process.env.MAILGUN_API_KEY, process.env.MAILGUN_API_KEY_FILE),
    mailgunDomain: process.env.MAILGUN_DOMAIN,
    mailgunUrl: process.env.MAILGUN_URL,
    // SMTP fallback: EMAIL_USER / EMAIL_PASSWORD (e.g. Mailgun SMTP or other provider).
    host: process.env.EMAIL_HOST ?? 'smtp.mailgun.org',
    port: Number(process.env.EMAIL_PORT ?? 587),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM ?? 'noreply@vit.com',
    testSecret: process.env.EMAIL_TEST_SECRET,
  },
  appUrls: {
    frontend: process.env.FRONTEND_URL ?? 'http://localhost:3002',
    tenantAdmin: process.env.TENANT_ADMIN_APP_URL ?? process.env.FRONTEND_URL ?? 'http://localhost:3002',
    systemAdmin: process.env.SYSTEM_ADMIN_APP_URL ?? 'http://localhost:3001',
    driverApp: process.env.DRIVER_APP_URL,
  },
  platform: {
    adminNotifyEmails: process.env.PLATFORM_ADMIN_NOTIFY_EMAILS,
    sendNewTenantCreatedEmail: process.env.SEND_NEW_TENANT_EMAIL !== 'false',
    sendTenantAdminWelcomeEmail: process.env.SEND_TENANT_ADMIN_WELCOME_EMAIL !== 'false',
  },
});

