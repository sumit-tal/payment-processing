import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  // API Key Configuration
  apiKey: {
    saltRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    keyLength: 64,
    keyPrefix: 'pk_live_',
  },

  // Rate Limiting Configuration
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60, // seconds
    limit: parseInt(process.env.RATE_LIMIT_LIMIT, 10) || 100, // requests per TTL
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  // Encryption Configuration
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    key: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production',
  },

  // CORS Configuration
  cors: {
    enabled: process.env.CORS_ENABLED === 'true',
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
  },

  // Security Headers Configuration
  headers: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET || 'default-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict' as const,
    },
  },

  // PCI DSS Configuration
  pciDss: {
    // Data retention policies
    dataRetention: {
      auditLogs: 365, // days
      transactionLogs: 1095, // 3 years
      webhookEvents: 90, // days
    },
    
    // Sensitive data handling
    sensitiveFields: [
      'cardNumber',
      'cvv',
      'expiryMonth',
      'expiryYear',
      'accountNumber',
      'routingNumber',
      'ssn',
      'taxId',
    ],
    
    // Security requirements
    requirements: {
      minPasswordLength: 12,
      passwordComplexity: true,
      accountLockoutThreshold: 5,
      accountLockoutDuration: 30, // minutes
      sessionTimeout: 30, // minutes
      requireTwoFactor: process.env.NODE_ENV === 'production',
    },
  },

  // Audit Configuration
  audit: {
    enabled: true,
    logLevel: process.env.LOG_LEVEL || 'info',
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS, 10) || 365,
    sensitiveDataMasking: true,
    realTimeAlerts: {
      enabled: process.env.NODE_ENV === 'production',
      thresholds: {
        failedLogins: 10,
        rateLimitExceeded: 50,
        suspiciousActivity: 5,
      },
    },
  },

  // Webhook Security
  webhook: {
    signatureHeader: process.env.WEBHOOK_SIGNATURE_HEADER || 'X-ANET-Signature',
    secretKey: process.env.WEBHOOK_SECRET_KEY || 'your-webhook-secret-key-change-this-in-production',
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT, 10) || 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000, // 1 second
  },

  // IP Whitelist Configuration
  ipWhitelist: {
    enabled: process.env.IP_WHITELIST_ENABLED === 'true',
    allowedIps: process.env.ALLOWED_IPS?.split(',') || [],
    adminIps: process.env.ADMIN_IPS?.split(',') || [],
  },

  // Monitoring and Alerting
  monitoring: {
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
    },
    metrics: {
      enabled: true,
      endpoint: '/metrics',
      authentication: process.env.NODE_ENV === 'production',
    },
  },
}));
