import { createHmac } from 'crypto';
import type { PayLink, Payment, Subscription } from './types.js';

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /** Webhook URL to send events to */
  url: string;
  /** Secret for HMAC signature */
  secret?: string;
  /** Events to send (default: all) */
  events?: WebhookEvent[];
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
  /** Retry count on failure (default: 3) */
  retries?: number;
  /** Custom headers to include */
  headers?: Record<string, string>;
}

/**
 * Webhook event types
 */
export type WebhookEvent =
  | 'payment.confirmed'
  | 'payment.pending'
  | 'payment.failed'
  | 'payment.underpaid'
  | 'link.created'
  | 'link.disabled'
  | 'link.expired'
  | 'subscription.created'
  | 'subscription.renewed'
  | 'subscription.cancelled'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.past_due'
  | 'subscription.expired'
  | 'subscription.trial_ending'
  | 'subscription.payment_due';

/**
 * Webhook payload base
 */
export interface WebhookPayload {
  /** Event type */
  event: WebhookEvent;
  /** Event timestamp */
  timestamp: string;
  /** Unique event ID */
  eventId: string;
  /** Event data */
  data: WebhookPaymentData | WebhookLinkData | WebhookSubscriptionData;
}

/**
 * Payment event data
 */
export interface WebhookPaymentData {
  type: 'payment';
  payment: {
    id: string;
    payLinkId: string;
    chainId: number;
    txHash: string;
    fromAddress: string;
    amount: string;
    confirmed: boolean;
    createdAt: string;
    confirmedAt?: string;
  };
  payLink: {
    id: string;
    targetUrl: string;
    price: {
      amount: string;
      tokenSymbol: string;
      chainId: number;
    };
    recipientAddress: string;
  };
}

/**
 * Link event data
 */
export interface WebhookLinkData {
  type: 'link';
  link: {
    id: string;
    targetUrl: string;
    price: {
      amount: string;
      tokenSymbol: string;
      chainId: number;
    };
    recipientAddress: string;
    status: string;
    createdAt: string;
    description?: string;
    maxUses?: number;
    expiresAt?: string;
  };
}

/**
 * Subscription event data
 */
export interface WebhookSubscriptionData {
  type: 'subscription';
  subscription: {
    id: string;
    payLinkId: string;
    subscriberAddress: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextPaymentDue: string;
    cycleCount: number;
    createdAt: string;
    cancelledAt?: string;
    pausedAt?: string;
    trialEndsAt?: string;
  };
  payLink: {
    id: string;
    targetUrl: string;
    price: {
      amount: string;
      tokenSymbol: string;
      chainId: number;
    };
    recipientAddress: string;
    subscription?: {
      interval: string;
      intervalCount?: number;
    };
  };
}

/**
 * Webhook delivery result
 */
export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
  duration: number;
}

/**
 * Webhook Manager
 * Handles sending webhook notifications for payment events
 */
export class WebhookManager {
  private config: Required<Omit<WebhookConfig, 'secret' | 'headers'>> & {
    secret?: string;
    headers?: Record<string, string>;
  };
  private queue: Array<{ payload: WebhookPayload; attempt: number }> = [];
  private processing = false;

  constructor(config: WebhookConfig) {
    this.config = {
      url: config.url,
      secret: config.secret,
      events: config.events ?? [
        'payment.confirmed',
        'payment.pending',
        'payment.failed',
        'payment.underpaid',
        'link.created',
        'link.disabled',
        'subscription.created',
        'subscription.renewed',
        'subscription.cancelled',
        'subscription.paused',
        'subscription.resumed',
        'subscription.past_due',
        'subscription.expired',
        'subscription.trial_ending',
        'subscription.payment_due',
      ],
      timeout: config.timeout ?? 10000,
      retries: config.retries ?? 3,
      headers: config.headers,
    };
  }

  /**
   * Check if event type is enabled
   */
  isEventEnabled(event: WebhookEvent): boolean {
    return this.config.events.includes(event);
  }

  /**
   * Send payment event
   */
  async sendPaymentEvent(
    event: WebhookEvent,
    payment: Payment,
    payLink: PayLink
  ): Promise<WebhookResult | null> {
    if (!this.isEventEnabled(event)) {
      return null;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
      data: {
        type: 'payment',
        payment: {
          id: payment.id,
          payLinkId: payment.payLinkId,
          chainId: payment.chainId,
          txHash: payment.txHash,
          fromAddress: payment.fromAddress,
          amount: payment.amount,
          confirmed: payment.confirmed,
          createdAt: payment.createdAt.toISOString(),
          confirmedAt: payment.confirmedAt?.toISOString(),
        },
        payLink: {
          id: payLink.id,
          targetUrl: payLink.targetUrl,
          price: payLink.price,
          recipientAddress: payLink.recipientAddress,
        },
      },
    };

    return this.send(payload);
  }

  /**
   * Send link event
   */
  async sendLinkEvent(
    event: WebhookEvent,
    payLink: PayLink
  ): Promise<WebhookResult | null> {
    if (!this.isEventEnabled(event)) {
      return null;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
      data: {
        type: 'link',
        link: {
          id: payLink.id,
          targetUrl: payLink.targetUrl,
          price: payLink.price,
          recipientAddress: payLink.recipientAddress,
          status: payLink.status,
          createdAt: payLink.createdAt.toISOString(),
          description: payLink.description,
          maxUses: payLink.maxUses,
          expiresAt: payLink.expiresAt?.toISOString(),
        },
      },
    };

    return this.send(payload);
  }

  /**
   * Send subscription event
   */
  async sendSubscriptionEvent(
    event: WebhookEvent,
    subscription: Subscription,
    payLink: PayLink
  ): Promise<WebhookResult | null> {
    if (!this.isEventEnabled(event)) {
      return null;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
      data: {
        type: 'subscription',
        subscription: {
          id: subscription.id,
          payLinkId: subscription.payLinkId,
          subscriberAddress: subscription.subscriberAddress,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          nextPaymentDue: subscription.nextPaymentDue.toISOString(),
          cycleCount: subscription.cycleCount,
          createdAt: subscription.createdAt.toISOString(),
          cancelledAt: subscription.cancelledAt?.toISOString(),
          pausedAt: subscription.pausedAt?.toISOString(),
          trialEndsAt: subscription.trialEndsAt?.toISOString(),
        },
        payLink: {
          id: payLink.id,
          targetUrl: payLink.targetUrl,
          price: payLink.price,
          recipientAddress: payLink.recipientAddress,
          subscription: payLink.subscription ? {
            interval: payLink.subscription.interval,
            intervalCount: payLink.subscription.intervalCount,
          } : undefined,
        },
      },
    };

    return this.send(payload);
  }

  /**
   * Queue event for async delivery
   */
  queueEvent(payload: WebhookPayload): void {
    this.queue.push({ payload, attempt: 0 });
    this.processQueue();
  }

  /**
   * Send webhook with retries
   */
  async send(payload: WebhookPayload): Promise<WebhookResult> {
    const startTime = Date.now();
    let lastError: string | undefined;
    let lastStatusCode: number | undefined;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const result = await this.deliver(payload);
        
        if (result.success) {
          return {
            success: true,
            statusCode: result.statusCode,
            attempts: attempt,
            duration: Date.now() - startTime,
          };
        }

        lastStatusCode = result.statusCode;
        lastError = result.error;

        // Don't retry on 4xx errors (client errors)
        if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.config.retries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      } catch (error) {
        lastError = (error as Error).message;
        
        if (attempt < this.config.retries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    return {
      success: false,
      statusCode: lastStatusCode,
      error: lastError,
      attempts: this.config.retries,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Deliver webhook
   */
  private async deliver(
    payload: WebhookPayload
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const body = JSON.stringify(payload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Paylink-Webhook/1.1.0',
        'X-Paylink-Event': payload.event,
        'X-Paylink-Event-Id': payload.eventId,
        'X-Paylink-Timestamp': payload.timestamp,
        ...this.config.headers,
      };

      // Add HMAC signature if secret is configured
      if (this.config.secret) {
        headers['X-Paylink-Signature'] = this.sign(body);
      }

      const response = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (response.ok) {
        return { success: true, statusCode: response.status };
      }

      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }
      return { success: false, error: (error as Error).message };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Sign payload with HMAC-SHA256
   */
  private sign(body: string): string {
    if (!this.config.secret) return '';
    return createHmac('sha256', this.config.secret).update(body).digest('hex');
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `evt_${timestamp}_${random}`;
  }

  /**
   * Process queued events
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      const result = await this.send(item.payload);
      
      if (!result.success) {
        console.error(
          `Webhook delivery failed for ${item.payload.event}:`,
          result.error
        );
      }
    }

    this.processing = false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Verify webhook signature
 * Use this in your webhook handler to verify authenticity
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expected.length) return false;
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Create a webhook manager
 */
export function createWebhookManager(config: WebhookConfig): WebhookManager {
  return new WebhookManager(config);
}
