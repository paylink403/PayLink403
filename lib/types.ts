/**
 * Payment link status
 */
export type PayLinkStatus = 'active' | 'disabled' | 'expired';

/**
 * Referral status
 */
export type ReferralStatus = 'pending' | 'confirmed' | 'paid' | 'expired';

/**
 * Installment plan status
 */
export type InstallmentStatus = 'pending' | 'active' | 'suspended' | 'completed' | 'cancelled';

/**
 * Installment payment status
 */
export type InstallmentPaymentStatus = 'pending' | 'confirmed' | 'failed';

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
  /** Maximum total uses (for single-use links) */
  maxUses?: number;
  usedCount?: number;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  /** Subscription configuration */
  subscription?: SubscriptionConfig;
  /** 
   * Multi-use mode: allows multiple users to pay for access
   * Each payer gets their own access after payment
   * When true, link doesn't expire after first payment
   */
  multiUse?: boolean;
  /** Referral program configuration */
  referral?: ReferralConfig;
  /** Installment payment configuration */
  installment?: InstallmentConfig;
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
  /** Referral code used for this payment */
  referralCode?: string;
}

/**
 * Referral configuration for a payment link
 */
export interface ReferralConfig {
  /** Enable referral program for this link */
  enabled: boolean;
  /** Commission percentage for referrer (0-100, default: 10) */
  commissionPercent: number;
  /** Minimum payout threshold (optional) */
  minPayoutThreshold?: string;
  /** Commission expires after N days (optional) */
  expirationDays?: number;
}

/**
 * Referral entity
 */
export interface Referral {
  /** Unique referral ID */
  id: string;
  /** Referral code (short, shareable) */
  code: string;
  /** Referrer wallet address (who earns commission) */
  referrerAddress: string;
  /** Associated PayLink ID */
  payLinkId: string;
  /** Total referrals count */
  totalReferrals: number;
  /** Confirmed referrals count */
  confirmedReferrals: number;
  /** Total commission earned (in primary token) */
  totalEarned: string;
  /** Pending commission (not yet paid out) */
  pendingAmount: string;
  /** Paid out commission */
  paidAmount: string;
  /** Status */
  status: 'active' | 'disabled';
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Referral commission record (individual commission per payment)
 */
export interface ReferralCommission {
  /** Unique commission ID */
  id: string;
  /** Referral ID */
  referralId: string;
  /** Payment ID that triggered this commission */
  paymentId: string;
  /** PayLink ID */
  payLinkId: string;
  /** Referrer address */
  referrerAddress: string;
  /** Referred user address */
  referredAddress: string;
  /** Payment amount */
  paymentAmount: string;
  /** Commission amount */
  commissionAmount: string;
  /** Commission percentage at time of payment */
  commissionPercent: number;
  /** Token symbol */
  tokenSymbol: string;
  /** Chain ID */
  chainId: number;
  /** Status */
  status: ReferralStatus;
  /** Created timestamp */
  createdAt: Date;
  /** Confirmed timestamp */
  confirmedAt?: Date;
  /** Paid out timestamp */
  paidAt?: Date;
  /** Payout transaction hash */
  payoutTxHash?: string;
}

/**
 * Input for creating a referral
 */
export interface CreateReferralInput {
  /** PayLink ID */
  payLinkId: string;
  /** Referrer wallet address */
  referrerAddress: string;
  /** Custom referral code (optional, auto-generated if not provided) */
  code?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Referral statistics
 */
export interface ReferralStats {
  /** Total referrals */
  totalReferrals: number;
  /** Confirmed referrals */
  confirmedReferrals: number;
  /** Pending referrals */
  pendingReferrals: number;
  /** Total earned */
  totalEarned: string;
  /** Pending payout */
  pendingPayout: string;
  /** Paid out */
  paidOut: string;
  /** Conversion rate (confirmed / total) */
  conversionRate: number;
}

/**
 * Installment configuration for a payment link
 */
export interface InstallmentConfig {
  /** Enable installment payments for this link */
  enabled: boolean;
  /** Total number of installments (default: 4) */
  totalInstallments?: number;
  /** Days between installments (default: 30) */
  intervalDays?: number;
  /** First payment percentage (0-100, default: 25) */
  downPaymentPercent?: number;
  /** Grace period in days before suspending access (default: 3) */
  gracePeriodDays?: number;
  /** Automatically suspend access on missed payment (default: true) */
  autoSuspend?: boolean;
}

/**
 * Installment plan entity
 */
export interface InstallmentPlan {
  /** Unique plan ID */
  id: string;
  /** Associated PayLink ID */
  payLinkId: string;
  /** Buyer wallet address */
  buyerAddress: string;
  /** Plan status */
  status: InstallmentStatus;
  /** Total amount to be paid */
  totalAmount: string;
  /** Amount paid so far */
  paidAmount: string;
  /** Total number of installments */
  totalInstallments: number;
  /** Number of completed installments */
  completedInstallments: number;
  /** Amount for each installment */
  installmentAmounts: string[];
  /** Days between payments */
  intervalDays: number;
  /** Grace period days */
  gracePeriodDays: number;
  /** Next payment due date */
  nextDueDate: Date;
  /** Next installment number (1-based) */
  nextInstallmentNumber: number;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** When first payment was made (access granted) */
  activatedAt?: Date;
  /** When all payments completed */
  completedAt?: Date;
  /** When plan was suspended */
  suspendedAt?: Date;
  /** When plan was cancelled */
  cancelledAt?: Date;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Individual installment payment record
 */
export interface InstallmentPayment {
  /** Unique payment ID */
  id: string;
  /** Installment plan ID */
  installmentPlanId: string;
  /** Original payment ID (from Payment entity) */
  paymentId: string;
  /** PayLink ID */
  payLinkId: string;
  /** Buyer address */
  buyerAddress: string;
  /** Installment number (1-based) */
  installmentNumber: number;
  /** Actual amount paid */
  amount: string;
  /** Expected amount for this installment */
  expectedAmount: string;
  /** Transaction hash */
  txHash: string;
  /** Chain ID */
  chainId: number;
  /** Token symbol */
  tokenSymbol: string;
  /** Payment status */
  status: InstallmentPaymentStatus;
  /** Due date for this installment */
  dueDate: Date;
  /** Created timestamp */
  createdAt: Date;
  /** Confirmed timestamp */
  confirmedAt?: Date;
}

/**
 * Input for creating an installment plan
 */
export interface CreateInstallmentPlanInput {
  /** PayLink ID */
  payLinkId: string;
  /** Buyer wallet address */
  buyerAddress: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Installment plan statistics
 */
export interface InstallmentPlanStats {
  /** Total plans */
  totalPlans: number;
  /** Active plans */
  activePlans: number;
  /** Completed plans */
  completedPlans: number;
  /** Suspended plans */
  suspendedPlans: number;
  /** Total amount collected */
  totalCollected: string;
  /** Total amount pending */
  totalPending: string;
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
  /** Maximum total uses (optional limit even for multi-use links) */
  maxUses?: number;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  /** Subscription configuration (if set, creates a subscription link) */
  subscription?: SubscriptionConfig;
  /** 
   * Multi-use mode: allows multiple users to pay for access
   * Each payer gets their own access after payment
   */
  multiUse?: boolean;
  /** Referral program configuration */
  referral?: ReferralConfig;
  /** Installment payment configuration */
  installment?: InstallmentConfig;
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
  /** Get confirmed payment for a specific payer address on a link */
  getConfirmedPaymentByAddress(payLinkId: string, fromAddress: string): Promise<Payment | null>;
  /** Get all payments for a link */
  getPaymentsByLink(payLinkId: string): Promise<Payment[]>;
  getAllPayments(): Promise<Payment[]>;

  // Subscription methods
  saveSubscription(subscription: Subscription): Promise<void>;
  getSubscription(id: string): Promise<Subscription | null>;
  updateSubscription(subscription: Subscription): Promise<void>;
  getSubscriptionByAddress(payLinkId: string, subscriberAddress: string): Promise<Subscription | null>;
  getSubscriptionsByPayLink(payLinkId: string): Promise<Subscription[]>;
  getSubscriptionsDue(beforeDate: Date): Promise<Subscription[]>;
  getAllSubscriptions(): Promise<Subscription[]>;

  // Referral methods
  saveReferral(referral: Referral): Promise<void>;
  getReferral(id: string): Promise<Referral | null>;
  getReferralByCode(code: string): Promise<Referral | null>;
  updateReferral(referral: Referral): Promise<void>;
  getReferralsByPayLink(payLinkId: string): Promise<Referral[]>;
  getReferralsByReferrer(referrerAddress: string): Promise<Referral[]>;
  getAllReferrals(): Promise<Referral[]>;

  // Referral commission methods
  saveCommission(commission: ReferralCommission): Promise<void>;
  getCommission(id: string): Promise<ReferralCommission | null>;
  updateCommission(commission: ReferralCommission): Promise<void>;
  getCommissionsByReferral(referralId: string): Promise<ReferralCommission[]>;
  getCommissionsByReferrer(referrerAddress: string): Promise<ReferralCommission[]>;
  getPendingCommissions(referrerAddress: string): Promise<ReferralCommission[]>;
  getAllCommissions(): Promise<ReferralCommission[]>;

  // Installment plan methods
  saveInstallmentPlan(plan: InstallmentPlan): Promise<void>;
  getInstallmentPlan(id: string): Promise<InstallmentPlan | null>;
  updateInstallmentPlan(plan: InstallmentPlan): Promise<void>;
  getInstallmentPlanByAddress(payLinkId: string, buyerAddress: string): Promise<InstallmentPlan | null>;
  getInstallmentPlansByPayLink(payLinkId: string): Promise<InstallmentPlan[]>;
  getInstallmentPlansByBuyer(buyerAddress: string): Promise<InstallmentPlan[]>;
  getOverdueInstallmentPlans(): Promise<InstallmentPlan[]>;
  getInstallmentPlansDueBefore(date: Date): Promise<InstallmentPlan[]>;
  getAllInstallmentPlans(): Promise<InstallmentPlan[]>;

  // Installment payment methods
  saveInstallmentPayment(payment: InstallmentPayment): Promise<void>;
  getInstallmentPayment(id: string): Promise<InstallmentPayment | null>;
  updateInstallmentPayment(payment: InstallmentPayment): Promise<void>;
  getInstallmentPaymentsByPlan(planId: string): Promise<InstallmentPayment[]>;
  getInstallmentPaymentsByBuyer(buyerAddress: string): Promise<InstallmentPayment[]>;
  getAllInstallmentPayments(): Promise<InstallmentPayment[]>;
}
