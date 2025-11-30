import { randomBytes, createHmac, randomUUID } from 'crypto';

/**
 * Generate short unique ID
 */
export function generateId(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Generate UUID
 */
export function generateUUID(): string {
  return randomUUID();
}

/**
 * Generate nonce
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Create HMAC signature
 */
export function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Check if date is expired
 */
export function isExpired(date?: Date): boolean {
  if (!date) return false;
  return new Date() > new Date(date);
}

/**
 * Check if usage limit reached
 */
export function isLimitReached(used?: number, max?: number): boolean {
  if (max === undefined) return false;
  return (used ?? 0) >= max;
}

/**
 * Compare amounts
 */
export function compareAmounts(a: string, b: string): number {
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  if (numA < numB) return -1;
  if (numA > numB) return 1;
  return 0;
}

/**
 * Reason code messages
 */
export const REASON_MESSAGES: Record<string, string> = {
  LINK_NOT_FOUND: 'Payment link not found.',
  LINK_DISABLED: 'This payment link has been disabled.',
  LINK_EXPIRED: 'This payment link has expired.',
  LINK_USAGE_LIMIT_REACHED: 'This payment link has reached its usage limit.',
  PAYMENT_UNDERPAID: 'Payment amount is less than required.',
  PAYMENT_CHAIN_NOT_SUPPORTED: 'This blockchain is not supported.',
  ACCESS_DENIED: 'Access denied.',
  INTERNAL_ERROR: 'An internal error occurred.',
  SUBSCRIPTION_CANCELLED: 'This subscription has been cancelled.',
  SUBSCRIPTION_PAST_DUE: 'Subscription payment is past due.',
  SUBSCRIPTION_PAUSED: 'This subscription is paused.',
  SUBSCRIPTION_EXPIRED: 'This subscription has expired.',
  SUBSCRIPTION_MAX_CYCLES_REACHED: 'Subscription has reached maximum billing cycles.',
};
