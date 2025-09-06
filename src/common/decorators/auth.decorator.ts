import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const SKIP_AUTH_KEY = 'skipAuth';

/**
 * Decorator to specify required permissions for an endpoint
 */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to skip authentication for an endpoint
 */
export const SkipAuth = () => SetMetadata(SKIP_AUTH_KEY, true);

/**
 * Common permission constants
 */
export const Permissions = {
  // Payment permissions
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_WRITE: 'payments:write',
  PAYMENTS_REFUND: 'payments:refund',
  PAYMENTS_VOID: 'payments:void',
  
  // Subscription permissions
  SUBSCRIPTIONS_READ: 'subscriptions:read',
  SUBSCRIPTIONS_WRITE: 'subscriptions:write',
  SUBSCRIPTIONS_CANCEL: 'subscriptions:cancel',
  
  // Webhook permissions
  WEBHOOKS_READ: 'webhooks:read',
  WEBHOOKS_WRITE: 'webhooks:write',
  
  // Admin permissions
  ADMIN_API_KEYS: 'admin:api_keys',
  ADMIN_AUDIT_LOGS: 'admin:audit_logs',
  ADMIN_SYSTEM: 'admin:system',
  
  // All permissions
  ALL: '*',
} as const;
