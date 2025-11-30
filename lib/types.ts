/**
 * Payment link status
 */
export type PayLinkStatus = 'active' | 'disabled' | 'expired';

/**
 * Payment verification status
 */
export type PaymentStatus = 'not_found' | 'pending' | 'confirmed' | 'failed' | 'underpaid';

/**
 * Subscription interval
 */
export type SubscriptionInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Subscription status
 */
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'paused' | 'expired';

/**
 * Chain type
 */
export type ChainType = 'evm' | 'solana';

/**
 * Supported chain configuration
 */
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  symbol: string;
  confirmations?: number;
  /** Chain type (default: 'evm') */
  type?: ChainType;
}

/**
 * Solana chain IDs
 * 101 = Mainnet, 102 = Devnet, 103 = Testnet
 */
export const SOLANA_CHAIN_IDS = {
  MAINNET: 101,
  DEVNET: 102,
  TESTNET: 103,
} as const;

/**
 * Price configuration (single currency - legacy)
 */
export interface Price {
  amount: string;
  tokenSymbol: string;
  chainId: number;
}

/**
 * Payment option for multi-currency support
 */
export interface PaymentOption {
  /** Token symbol (e.g., ETH, SOL, USDC) */
  tokenSymbol: string;
  /** Chain ID where payment is accepted */
  chainId: number;
  /** Amount in this token */
  amount: string;
  /** Recipient address for this payment option (optional, uses default if not set) */
  recipientAddress?: string;
}

/**
 * Multi-currency price configuration
 */
export interface MultiPrice {
  /** Default/primary price (used for display) */
  primary: Price;
  /** Additional accepted payment options */
  options: PaymentOption[];
}

/**
 * Payment link entity
 */
export interface PayLink {
  id: string;
  targetUrl: string;
  /** Primary price (for backward compatibility) */
  price: Price;
  /** Additional payment options for multi-currency */
  paymentOptions?: PaymentOption[];
  /** Default recipient address */
  recipientAddress: string;
  status: PayLinkStatus;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  maxUses?: number;
  usedCount?: number;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  /** Subscription configuration */
  subscription?: SubscriptionConfig;
}

/**
 * Subscription configuration for a payment link
 */
export interface SubscriptionConfig {
  /** Billing interval */
  interval: SubscriptionInterval;
  /** Number of intervals between billings (default: 1) */
  intervalCount?: number;
  /** Grace period in hours after due date before marking as past_due (default: 24) */
  gracePeriodHours?: number;
  /** Maximum number of billing cycles (undefined = unlimited) */
  maxCycles?: number;
  /** Trial period in days (0 = no trial) */
  trialDays?: number;
}

/**
 * Subscription entity
 */
export interface Subscription {
  id: string;
  payLinkId: string;
  subscriberAddress: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextPaymentDue: Date;
  cycleCount: number;
  lastPaymentId?: string;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  pausedAt?: Date;
  trialEndsAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Payment record
 */
export interface Payment {
  id: string;
  payLinkId: string;
  chainId: number;
  txHash: string;
  fromAddress: string;
  /** Amount paid */
  amount: string;
  /** Token symbol used for payment */
  tokenSymbol?: string;
  confirmed: boolean;
  createdAt: Date;
  confirmedAt?: Date;
}

/**
 * Input for creating a payment link
 */
export interface CreatePayLinkInput {
  targetUrl: string;
  /** Primary price */
  price: Price;
  /** Additional payment options for multi-currency */
  paymentOptions?: PaymentOption[];
  /** Default recipient address */
  recipientAddress: string;
  description?: string;
  maxUses?: number;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  /** Subscription configuration (if set, creates a subscription link) */
  subscription?: SubscriptionConfig;
}

/**
 * Input for creating a subscription
 */
export interface CreateSubscriptionInput {
  payLinkId: string;
  subscriberAddress: string;
  metadata?: Record<string, unknown>;
}

/**
 * 402 Protocol response
 */
export interface Protocol402Response {
  protocol: '402-paylink-v1';
  payLinkId: string;
  resource: {
    description?: string;
    preview?: string | null;
  };
  /** Primary payment option */
  payment: {
    chainId: number;
    tokenSymbol: string;
    amount: string;
    recipient: string;
    timeoutSeconds: number;
  };
  /** Additional payment options (multi-currency) */
  paymentOptions?: Array<{
    chainId: number;
    tokenSymbol: string;
    amount: string;
    recipient: string;
  }>;
  callbacks: {
    status: string;
    confirm: string;
  };
  nonce: string;
  signature?: string;
  /** Subscription info (if this is a subscription link) */
  subscription?: {
    interval: SubscriptionInterval;
    intervalCount: number;
    trialDays?: number;
    /** Existing subscription ID if subscriber already has one */
    existingSubscriptionId?: string;
    /** Current subscription status */
    subscriptionStatus?: SubscriptionStatus;
    /** Next payment due date */
    nextPaymentDue?: string;
  };
}

/**
 * 403 Reason codes
 */
export enum ReasonCode {
  LINK_NOT_FOUND = 'LINK_NOT_FOUND',
  LINK_DISABLED = 'LINK_DISABLED',
  LINK_EXPIRED = 'LINK_EXPIRED',
  LINK_USAGE_LIMIT_REACHED = 'LINK_USAGE_LIMIT_REACHED',
  PAYMENT_UNDERPAID = 'PAYMENT_UNDERPAID',
  PAYMENT_CHAIN_NOT_SUPPORTED = 'PAYMENT_CHAIN_NOT_SUPPORTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_PAST_DUE = 'SUBSCRIPTION_PAST_DUE',
  SUBSCRIPTION_PAUSED = 'SUBSCRIPTION_PAUSED',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_MAX_CYCLES_REACHED = 'SUBSCRIPTION_MAX_CYCLES_REACHED',
}

/**
 * 403 Protocol response
 */
export interface Protocol403Response {
  protocol: '403-paylink-v1';
  payLinkId?: string;
  reasonCode: ReasonCode;
  reasonMessage: string;
  details?: Record<string, unknown>;
}

/**
 * Webhook configuration
 */
export interface WebhookConfigType {
  /** Webhook URL to send events to */
  url: string;
  /** Secret for HMAC signature */
  secret?: string;
  /** Events to send */
  events?: Array<
    | 'payment.confirmed'
    | 'payment.pending'
    | 'payment.failed'
    | 'payment.underpaid'
    | 'link.created'
    | 'link.disabled'
    | 'subscription.created'
    | 'subscription.renewed'
    | 'subscription.cancelled'
    | 'subscription.paused'
    | 'subscription.resumed'
    | 'subscription.past_due'
    | 'subscription.expired'
    | 'subscription.trial_ending'
    | 'subscription.payment_due'
  >;
  /** Request timeout in ms */
  timeout?: number;
  /** Retry count on failure */
  retries?: number;
}

/**
 * PAYLINK token configuration
 */
export interface PaylinkTokenConfigType {
  /** Enable PAYLINK token payments */
  enabled?: boolean;
  /** Discount when paying with PAYLINK token (percentage, 0-100) */
  paymentDiscount?: number;
  /** Enable holder discounts based on PAYLINK balance */
  holderDiscounts?: boolean;
  /** Custom discount tiers */
  discountTiers?: Array<{
    minBalance: number;
    discountPercent: number;
    name: string;
  }>;
}

/**
 * Server configuration
 */
export interface PaylinkConfig {
  /** Server port */
  port?: number;
  /** Base URL for callbacks (e.g., https://your-domain.com) */
  baseUrl?: string;
  /** Base path for paylink routes (default: /pay) */
  basePath?: string;
  /** Supported blockchain networks */
  chains: ChainConfig[];
  /** Payment timeout in seconds (default: 900) */
  paymentTimeout?: number;
  /** Secret for signing responses */
  signatureSecret?: string;
  /** API key for admin endpoints */
  apiKey?: string;
  /** Enable CORS (default: true) */
  cors?: boolean;
  /** Webhook configuration */
  webhook?: WebhookConfigType;
  /** PAYLINK token configuration */
  paylinkToken?: PaylinkTokenConfigType;
}

/**
 * Payment check result
 */
export interface PaymentCheckResult {
  status: PaymentStatus;
  actualAmount?: string;
  fromAddress?: string;
  raw?: unknown;
}

/**
 * Storage interface
 */
export interface Storage {
  getPayLink(id: string): Promise<PayLink | null>;
  savePayLink(payLink: PayLink): Promise<void>;
  updatePayLink(payLink: PayLink): Promise<void>;
  deletePayLink(id: string): Promise<void>;
  getAllPayLinks(): Promise<PayLink[]>;
  
  savePayment(payment: Payment): Promise<void>;
  getPaymentByTxHash(txHash: string): Promise<Payment | null>;
  getConfirmedPayment(payLinkId: string): Promise<Payment | null>;
  getAllPayments(): Promise<Payment[]>;

  // Subscription methods
  saveSubscription(subscription: Subscription): Promise<void>;
  getSubscription(id: string): Promise<Subscription | null>;
  updateSubscription(subscription: Subscription): Promise<void>;
  getSubscriptionByAddress(payLinkId: string, subscriberAddress: string): Promise<Subscription | null>;
  getSubscriptionsByPayLink(payLinkId: string): Promise<Subscription[]>;
  getSubscriptionsDue(beforeDate: Date): Promise<Subscription[]>;
  getAllSubscriptions(): Promise<Subscription[]>;
}
