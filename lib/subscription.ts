import type {
  Subscription,
  SubscriptionConfig,
  SubscriptionInterval,
  SubscriptionStatus,
  PayLink,
  Payment,
  Storage,
  CreateSubscriptionInput,
} from './types.js';
import { generateId, generateUUID } from './utils.js';

/**
 * Calculate next billing date based on interval
 */
export function calculateNextBillingDate(
  fromDate: Date,
  interval: SubscriptionInterval,
  intervalCount: number = 1
): Date {
  const date = new Date(fromDate);

  switch (interval) {
    case 'daily':
      date.setDate(date.getDate() + intervalCount);
      break;
    case 'weekly':
      date.setDate(date.getDate() + (7 * intervalCount));
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + intervalCount);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + intervalCount);
      break;
  }

  return date;
}

/**
 * Check if subscription is within grace period
 */
export function isWithinGracePeriod(
  nextPaymentDue: Date,
  gracePeriodHours: number = 24
): boolean {
  const now = new Date();
  const graceEnd = new Date(nextPaymentDue);
  graceEnd.setHours(graceEnd.getHours() + gracePeriodHours);
  return now <= graceEnd;
}

/**
 * Check if subscription payment is due
 */
export function isPaymentDue(subscription: Subscription): boolean {
  const now = new Date();
  return now >= subscription.nextPaymentDue;
}

/**
 * Check if subscription is in trial period
 */
export function isInTrialPeriod(subscription: Subscription): boolean {
  if (!subscription.trialEndsAt) return false;
  return new Date() < subscription.trialEndsAt;
}

/**
 * Get interval display name
 */
export function getIntervalDisplayName(
  interval: SubscriptionInterval,
  count: number = 1
): string {
  const labels: Record<SubscriptionInterval, [string, string]> = {
    daily: ['day', 'days'],
    weekly: ['week', 'weeks'],
    monthly: ['month', 'months'],
    yearly: ['year', 'years'],
  };

  const [singular, plural] = labels[interval];
  if (count === 1) return singular;
  return `${count} ${plural}`;
}

/**
 * Subscription Manager
 * Handles subscription lifecycle and billing
 */
export class SubscriptionManager {
  private storage: Storage;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  /**
   * Create a new subscription
   */
  async createSubscription(
    payLink: PayLink,
    input: CreateSubscriptionInput
  ): Promise<Subscription> {
    if (!payLink.subscription) {
      throw new Error('PayLink is not configured for subscriptions');
    }

    const config = payLink.subscription;
    const now = new Date();

    // Check for existing subscription
    const existing = await this.storage.getSubscriptionByAddress(
      payLink.id,
      input.subscriberAddress
    );

    if (existing && existing.status === 'active') {
      throw new Error('Active subscription already exists for this address');
    }

    // Calculate dates
    const trialEndsAt = config.trialDays
      ? new Date(now.getTime() + config.trialDays * 24 * 60 * 60 * 1000)
      : undefined;

    const periodStart = trialEndsAt ?? now;
    const periodEnd = calculateNextBillingDate(
      periodStart,
      config.interval,
      config.intervalCount
    );

    const subscription: Subscription = {
      id: generateId(12),
      payLinkId: payLink.id,
      subscriberAddress: input.subscriberAddress,
      status: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextPaymentDue: trialEndsAt ?? now,
      cycleCount: 0,
      createdAt: now,
      updatedAt: now,
      trialEndsAt,
      metadata: input.metadata,
    };

    await this.storage.saveSubscription(subscription);
    return subscription;
  }

  /**
   * Process payment for subscription
   */
  async processPayment(
    subscription: Subscription,
    payment: Payment,
    payLink: PayLink
  ): Promise<Subscription> {
    if (!payLink.subscription) {
      throw new Error('PayLink is not configured for subscriptions');
    }

    const config = payLink.subscription;
    const now = new Date();

    // Calculate new period
    const newPeriodStart = subscription.currentPeriodEnd;
    const newPeriodEnd = calculateNextBillingDate(
      newPeriodStart,
      config.interval,
      config.intervalCount
    );

    // Update subscription
    subscription.currentPeriodStart = newPeriodStart;
    subscription.currentPeriodEnd = newPeriodEnd;
    subscription.nextPaymentDue = newPeriodEnd;
    subscription.cycleCount += 1;
    subscription.lastPaymentId = payment.id;
    subscription.status = 'active';
    subscription.updatedAt = now;

    // Check max cycles
    if (config.maxCycles && subscription.cycleCount >= config.maxCycles) {
      subscription.status = 'expired';
    }

    await this.storage.updateSubscription(subscription);
    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediate: boolean = false
  ): Promise<Subscription> {
    const subscription = await this.storage.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.updatedAt = new Date();

    await this.storage.updateSubscription(subscription);
    return subscription;
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.storage.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'active') {
      throw new Error('Only active subscriptions can be paused');
    }

    subscription.status = 'paused';
    subscription.pausedAt = new Date();
    subscription.updatedAt = new Date();

    await this.storage.updateSubscription(subscription);
    return subscription;
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.storage.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'paused') {
      throw new Error('Only paused subscriptions can be resumed');
    }

    subscription.status = 'active';
    subscription.pausedAt = undefined;
    subscription.updatedAt = new Date();

    await this.storage.updateSubscription(subscription);
    return subscription;
  }

  /**
   * Check subscription access
   * Returns true if subscription grants access to the resource
   */
  async checkAccess(subscription: Subscription, payLink: PayLink): Promise<{
    hasAccess: boolean;
    reason?: string;
    requiresPayment?: boolean;
  }> {
    // Check if cancelled
    if (subscription.status === 'cancelled') {
      return {
        hasAccess: false,
        reason: 'Subscription has been cancelled',
      };
    }

    // Check if expired
    if (subscription.status === 'expired') {
      return {
        hasAccess: false,
        reason: 'Subscription has expired',
      };
    }

    // Check if paused
    if (subscription.status === 'paused') {
      return {
        hasAccess: false,
        reason: 'Subscription is paused',
      };
    }

    // Check trial period
    if (isInTrialPeriod(subscription)) {
      return { hasAccess: true };
    }

    // Check if payment is due
    if (isPaymentDue(subscription)) {
      const gracePeriodHours = payLink.subscription?.gracePeriodHours ?? 24;

      if (isWithinGracePeriod(subscription.nextPaymentDue, gracePeriodHours)) {
        // Still in grace period
        return {
          hasAccess: true,
          requiresPayment: true,
        };
      }

      // Past grace period
      return {
        hasAccess: false,
        reason: 'Payment is past due',
        requiresPayment: true,
      };
    }

    return { hasAccess: true };
  }

  /**
   * Mark subscription as past due
   */
  async markPastDue(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.storage.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.status = 'past_due';
    subscription.updatedAt = new Date();

    await this.storage.updateSubscription(subscription);
    return subscription;
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(id: string): Promise<Subscription | null> {
    return this.storage.getSubscription(id);
  }

  /**
   * Get subscription by subscriber address
   */
  async getSubscriptionByAddress(
    payLinkId: string,
    subscriberAddress: string
  ): Promise<Subscription | null> {
    return this.storage.getSubscriptionByAddress(payLinkId, subscriberAddress);
  }

  /**
   * Get all subscriptions due for payment
   */
  async getDueSubscriptions(): Promise<Subscription[]> {
    return this.storage.getSubscriptionsDue(new Date());
  }

  /**
   * Start periodic check for due subscriptions
   */
  startPeriodicCheck(
    intervalMs: number = 60000,
    onDue?: (subscription: Subscription) => void
  ): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      try {
        const dueSubscriptions = await this.getDueSubscriptions();
        for (const sub of dueSubscriptions) {
          if (onDue) {
            onDue(sub);
          }
        }
      } catch (error) {
        console.error('Subscription check error:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop periodic check
   */
  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

/**
 * Create subscription manager
 */
export function createSubscriptionManager(storage: Storage): SubscriptionManager {
  return new SubscriptionManager(storage);
}
