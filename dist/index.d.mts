import { Express } from 'express';

/**
 * Payment link status
 */
type PayLinkStatus = 'active' | 'disabled' | 'expired';
/**
 * Referral status
 */
type ReferralStatus = 'pending' | 'confirmed' | 'paid' | 'expired';
/**
 * Installment plan status
 */
type InstallmentStatus = 'pending' | 'active' | 'suspended' | 'completed' | 'cancelled';
/**
 * Installment payment status
 */
type InstallmentPaymentStatus = 'pending' | 'confirmed' | 'failed';
/**
 * Payment verification status
 */
type PaymentStatus = 'not_found' | 'pending' | 'confirmed' | 'failed' | 'underpaid';
/**
 * Subscription interval
 */
type SubscriptionInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';
/**
 * Subscription status
 */
type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'paused' | 'expired';
/**
 * Chain type
 */
type ChainType = 'evm' | 'solana';
/**
 * Supported chain configuration
 */
interface ChainConfig {
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
declare const SOLANA_CHAIN_IDS: {
    readonly MAINNET: 101;
    readonly DEVNET: 102;
    readonly TESTNET: 103;
};
/**
 * Price configuration (single currency - legacy)
 */
interface Price {
    amount: string;
    tokenSymbol: string;
    chainId: number;
}
/**
 * Payment option for multi-currency support
 */
interface PaymentOption {
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
interface MultiPrice {
    /** Default/primary price (used for display) */
    primary: Price;
    /** Additional accepted payment options */
    options: PaymentOption[];
}
/**
 * Payment link entity
 */
interface PayLink {
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
interface SubscriptionConfig {
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
interface Subscription {
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
interface Payment {
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
interface ReferralConfig {
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
interface Referral {
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
interface ReferralCommission {
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
interface CreateReferralInput {
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
interface ReferralStats {
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
interface InstallmentConfig {
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
interface InstallmentPlan {
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
interface InstallmentPayment {
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
interface CreateInstallmentPlanInput {
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
interface InstallmentPlanStats {
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
interface CreatePayLinkInput {
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
interface CreateSubscriptionInput {
    payLinkId: string;
    subscriberAddress: string;
    metadata?: Record<string, unknown>;
}
/**
 * 402 Protocol response
 */
interface Protocol402Response {
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
declare enum ReasonCode {
    LINK_NOT_FOUND = "LINK_NOT_FOUND",
    LINK_DISABLED = "LINK_DISABLED",
    LINK_EXPIRED = "LINK_EXPIRED",
    LINK_USAGE_LIMIT_REACHED = "LINK_USAGE_LIMIT_REACHED",
    PAYMENT_UNDERPAID = "PAYMENT_UNDERPAID",
    PAYMENT_CHAIN_NOT_SUPPORTED = "PAYMENT_CHAIN_NOT_SUPPORTED",
    ACCESS_DENIED = "ACCESS_DENIED",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    SUBSCRIPTION_CANCELLED = "SUBSCRIPTION_CANCELLED",
    SUBSCRIPTION_PAST_DUE = "SUBSCRIPTION_PAST_DUE",
    SUBSCRIPTION_PAUSED = "SUBSCRIPTION_PAUSED",
    SUBSCRIPTION_EXPIRED = "SUBSCRIPTION_EXPIRED",
    SUBSCRIPTION_MAX_CYCLES_REACHED = "SUBSCRIPTION_MAX_CYCLES_REACHED"
}
/**
 * 403 Protocol response
 */
interface Protocol403Response {
    protocol: '403-paylink-v1';
    payLinkId?: string;
    reasonCode: ReasonCode;
    reasonMessage: string;
    details?: Record<string, unknown>;
}
/**
 * Webhook configuration
 */
interface WebhookConfigType {
    /** Webhook URL to send events to */
    url: string;
    /** Secret for HMAC signature */
    secret?: string;
    /** Events to send */
    events?: Array<'payment.confirmed' | 'payment.pending' | 'payment.failed' | 'payment.underpaid' | 'link.created' | 'link.disabled' | 'subscription.created' | 'subscription.renewed' | 'subscription.cancelled' | 'subscription.paused' | 'subscription.resumed' | 'subscription.past_due' | 'subscription.expired' | 'subscription.trial_ending' | 'subscription.payment_due'>;
    /** Request timeout in ms */
    timeout?: number;
    /** Retry count on failure */
    retries?: number;
}
/**
 * PAYLINK token configuration
 */
interface PaylinkTokenConfigType {
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
interface PaylinkConfig {
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
interface PaymentCheckResult {
    status: PaymentStatus;
    actualAmount?: string;
    fromAddress?: string;
    raw?: unknown;
}
/**
 * Storage interface
 */
interface Storage {
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
    saveSubscription(subscription: Subscription): Promise<void>;
    getSubscription(id: string): Promise<Subscription | null>;
    updateSubscription(subscription: Subscription): Promise<void>;
    getSubscriptionByAddress(payLinkId: string, subscriberAddress: string): Promise<Subscription | null>;
    getSubscriptionsByPayLink(payLinkId: string): Promise<Subscription[]>;
    getSubscriptionsDue(beforeDate: Date): Promise<Subscription[]>;
    getAllSubscriptions(): Promise<Subscription[]>;
    saveReferral(referral: Referral): Promise<void>;
    getReferral(id: string): Promise<Referral | null>;
    getReferralByCode(code: string): Promise<Referral | null>;
    updateReferral(referral: Referral): Promise<void>;
    getReferralsByPayLink(payLinkId: string): Promise<Referral[]>;
    getReferralsByReferrer(referrerAddress: string): Promise<Referral[]>;
    getAllReferrals(): Promise<Referral[]>;
    saveCommission(commission: ReferralCommission): Promise<void>;
    getCommission(id: string): Promise<ReferralCommission | null>;
    updateCommission(commission: ReferralCommission): Promise<void>;
    getCommissionsByReferral(referralId: string): Promise<ReferralCommission[]>;
    getCommissionsByReferrer(referrerAddress: string): Promise<ReferralCommission[]>;
    getPendingCommissions(referrerAddress: string): Promise<ReferralCommission[]>;
    getAllCommissions(): Promise<ReferralCommission[]>;
    saveInstallmentPlan(plan: InstallmentPlan): Promise<void>;
    getInstallmentPlan(id: string): Promise<InstallmentPlan | null>;
    updateInstallmentPlan(plan: InstallmentPlan): Promise<void>;
    getInstallmentPlanByAddress(payLinkId: string, buyerAddress: string): Promise<InstallmentPlan | null>;
    getInstallmentPlansByPayLink(payLinkId: string): Promise<InstallmentPlan[]>;
    getInstallmentPlansByBuyer(buyerAddress: string): Promise<InstallmentPlan[]>;
    getOverdueInstallmentPlans(): Promise<InstallmentPlan[]>;
    getInstallmentPlansDueBefore(date: Date): Promise<InstallmentPlan[]>;
    getAllInstallmentPlans(): Promise<InstallmentPlan[]>;
    saveInstallmentPayment(payment: InstallmentPayment): Promise<void>;
    getInstallmentPayment(id: string): Promise<InstallmentPayment | null>;
    updateInstallmentPayment(payment: InstallmentPayment): Promise<void>;
    getInstallmentPaymentsByPlan(planId: string): Promise<InstallmentPayment[]>;
    getInstallmentPaymentsByBuyer(buyerAddress: string): Promise<InstallmentPayment[]>;
    getAllInstallmentPayments(): Promise<InstallmentPayment[]>;
}

/**
 * Calculate next billing date based on interval
 */
declare function calculateNextBillingDate(fromDate: Date, interval: SubscriptionInterval, intervalCount?: number): Date;
/**
 * Check if subscription is within grace period
 */
declare function isWithinGracePeriod(nextPaymentDue: Date, gracePeriodHours?: number): boolean;
/**
 * Check if subscription payment is due
 */
declare function isPaymentDue(subscription: Subscription): boolean;
/**
 * Check if subscription is in trial period
 */
declare function isInTrialPeriod(subscription: Subscription): boolean;
/**
 * Get interval display name
 */
declare function getIntervalDisplayName(interval: SubscriptionInterval, count?: number): string;
/**
 * Subscription Manager
 * Handles subscription lifecycle and billing
 */
declare class SubscriptionManager {
    private storage;
    private checkInterval;
    constructor(storage: Storage);
    /**
     * Create a new subscription
     */
    createSubscription(payLink: PayLink, input: CreateSubscriptionInput): Promise<Subscription>;
    /**
     * Process payment for subscription
     */
    processPayment(subscription: Subscription, payment: Payment, payLink: PayLink): Promise<Subscription>;
    /**
     * Cancel subscription
     */
    cancelSubscription(subscriptionId: string, immediate?: boolean): Promise<Subscription>;
    /**
     * Pause subscription
     */
    pauseSubscription(subscriptionId: string): Promise<Subscription>;
    /**
     * Resume subscription
     */
    resumeSubscription(subscriptionId: string): Promise<Subscription>;
    /**
     * Check subscription access
     * Returns true if subscription grants access to the resource
     */
    checkAccess(subscription: Subscription, payLink: PayLink): Promise<{
        hasAccess: boolean;
        reason?: string;
        requiresPayment?: boolean;
    }>;
    /**
     * Mark subscription as past due
     */
    markPastDue(subscriptionId: string): Promise<Subscription>;
    /**
     * Get subscription by ID
     */
    getSubscription(id: string): Promise<Subscription | null>;
    /**
     * Get subscription by subscriber address
     */
    getSubscriptionByAddress(payLinkId: string, subscriberAddress: string): Promise<Subscription | null>;
    /**
     * Get all subscriptions due for payment
     */
    getDueSubscriptions(): Promise<Subscription[]>;
    /**
     * Start periodic check for due subscriptions
     */
    startPeriodicCheck(intervalMs?: number, onDue?: (subscription: Subscription) => void): void;
    /**
     * Stop periodic check
     */
    stopPeriodicCheck(): void;
}
/**
 * Create subscription manager
 */
declare function createSubscriptionManager(storage: Storage): SubscriptionManager;

/**
 * Referral System
 * Viral growth through referral rewards
 *
 * Features:
 * - Generate unique referral codes
 * - Track referrals per link
 * - Calculate and track commissions
 * - Support for commission payouts
 */

/**
 * Default referral configuration
 */
declare const DEFAULT_REFERRAL_CONFIG: ReferralConfig;
/**
 * Generate a unique referral code
 * Format: 6-8 alphanumeric characters, URL-safe
 */
declare function generateReferralCode(length?: number): string;
/**
 * Validate referral code format
 */
declare function isValidReferralCode(code: string): boolean;
/**
 * Calculate commission amount
 */
declare function calculateCommission(paymentAmount: string, commissionPercent: number): string;
/**
 * Check if commission has expired
 */
declare function isCommissionExpired(createdAt: Date, expirationDays?: number): boolean;
/**
 * Referral Manager
 * Handles referral creation, tracking, and commission calculations
 */
declare class ReferralManager {
    private storage;
    constructor(storage: Storage);
    /**
     * Create a new referral
     */
    createReferral(input: CreateReferralInput): Promise<Referral>;
    /**
     * Get referral by code
     */
    getReferralByCode(code: string): Promise<Referral | null>;
    /**
     * Get referral by ID
     */
    getReferral(id: string): Promise<Referral | null>;
    /**
     * Get all referrals for a PayLink
     */
    getReferralsByPayLink(payLinkId: string): Promise<Referral[]>;
    /**
     * Get all referrals for a referrer
     */
    getReferralsByReferrer(referrerAddress: string): Promise<Referral[]>;
    /**
     * Process payment with referral
     * Creates commission record and updates referral stats
     */
    processReferralPayment(payment: Payment, payLink: PayLink, referralCode: string): Promise<ReferralCommission | null>;
    /**
     * Confirm pending commission (when payment is confirmed)
     */
    confirmCommission(paymentId: string): Promise<ReferralCommission | null>;
    /**
     * Mark commission as paid
     */
    markCommissionPaid(commissionId: string, payoutTxHash: string): Promise<ReferralCommission>;
    /**
     * Get referral statistics for a referrer
     */
    getStats(referrerAddress: string): Promise<ReferralStats>;
    /**
     * Disable a referral
     */
    disableReferral(referralId: string): Promise<Referral>;
    /**
     * Get pending commissions for payout
     */
    getPendingCommissions(referrerAddress: string): Promise<ReferralCommission[]>;
    /**
     * Helper: Add string amounts
     */
    private addAmounts;
    /**
     * Helper: Subtract string amounts
     */
    private subtractAmounts;
}
/**
 * Create a referral manager
 */
declare function createReferralManager(storage: Storage): ReferralManager;
/**
 * Build referral URL
 */
declare function buildReferralUrl(baseUrl: string, linkId: string, referralCode: string): string;
/**
 * Parse referral code from URL or query string
 */
declare function parseReferralCode(input: string): string | null;

/**
 * Installment (Payment Plan) Module
 *
 * Enables splitting payments into multiple installments.
 * Buyer pays first installment and gets access, then pays remaining
 * installments on schedule. Access is paused if payments are missed.
 */

/**
 * Default installment configuration
 */
declare const DEFAULT_INSTALLMENT_CONFIG: InstallmentConfig;
/**
 * Calculate installment amounts
 * @param totalAmount Total price amount
 * @param totalInstallments Number of installments
 * @param downPaymentPercent Percentage for first payment (0-100)
 * @returns Array of amounts for each installment
 */
declare function calculateInstallmentAmounts(totalAmount: string, totalInstallments: number, downPaymentPercent?: number): string[];
/**
 * Calculate next due date based on interval
 */
declare function calculateNextDueDate(fromDate: Date, intervalDays: number): Date;
/**
 * Calculate all due dates for an installment plan
 */
declare function calculateDueDates(startDate: Date, totalInstallments: number, intervalDays: number): Date[];
/**
 * Check if an installment payment is overdue
 */
declare function isInstallmentOverdue(dueDate: Date, gracePeriodDays?: number): boolean;
/**
 * Check if a date is within grace period
 */
declare function isInGracePeriod(dueDate: Date, gracePeriodDays?: number): boolean;
/**
 * Get installment plan progress info
 */
declare function getInstallmentProgress(plan: InstallmentPlan): {
    paidCount: number;
    remainingCount: number;
    paidAmount: string;
    remainingAmount: string;
    percentComplete: number;
    isComplete: boolean;
};
/**
 * Format installment schedule for display
 */
declare function formatInstallmentSchedule(plan: InstallmentPlan, payments: InstallmentPayment[]): Array<{
    number: number;
    amount: string;
    dueDate: string;
    status: 'paid' | 'current' | 'upcoming' | 'overdue';
    paidAt?: string;
    txHash?: string;
}>;
/**
 * Installment Plan Manager
 */
declare class InstallmentManager {
    private storage;
    constructor(storage: Storage);
    /**
     * Create a new installment plan
     */
    createPlan(input: CreateInstallmentPlanInput): Promise<InstallmentPlan>;
    /**
     * Get installment plan by ID
     */
    getPlan(id: string): Promise<InstallmentPlan | null>;
    /**
     * Get plan by buyer address
     */
    getPlanByAddress(payLinkId: string, buyerAddress: string): Promise<InstallmentPlan | null>;
    /**
     * Process an installment payment
     */
    processPayment(planId: string, payment: Payment): Promise<InstallmentPayment>;
    /**
     * Confirm an installment payment
     */
    confirmPayment(installmentPaymentId: string): Promise<{
        payment: InstallmentPayment;
        plan: InstallmentPlan;
    }>;
    /**
     * Suspend a plan due to missed payment
     */
    suspendPlan(planId: string, reason?: string): Promise<InstallmentPlan>;
    /**
     * Cancel an installment plan
     */
    cancelPlan(planId: string, reason?: string): Promise<InstallmentPlan>;
    /**
     * Get all payments for a plan
     */
    getPlanPayments(planId: string): Promise<InstallmentPayment[]>;
    /**
     * Get overdue plans
     */
    getOverduePlans(): Promise<InstallmentPlan[]>;
    /**
     * Get plans due soon (within N days)
     */
    getPlansDueSoon(withinDays?: number): Promise<InstallmentPlan[]>;
    /**
     * Check and suspend overdue plans
     */
    processOverduePlans(): Promise<InstallmentPlan[]>;
    /**
     * Get installment plan details with schedule
     */
    getPlanDetails(planId: string): Promise<{
        plan: InstallmentPlan;
        payments: InstallmentPayment[];
        schedule: ReturnType<typeof formatInstallmentSchedule>;
        progress: ReturnType<typeof getInstallmentProgress>;
    } | null>;
    /**
     * Check if buyer has active access
     */
    hasActiveAccess(payLinkId: string, buyerAddress: string): Promise<boolean>;
}
/**
 * Create an installment manager instance
 */
declare function createInstallmentManager(storage: Storage): InstallmentManager;

/**
 * Paylink Server
 * Self-hosted paid links with blockchain payment verification
 */
declare class PaylinkServer {
    private app;
    private config;
    private storage;
    private verifiers;
    private webhookManager?;
    private subscriptionManager;
    private referralManager;
    private installmentManager;
    private subscriptionCheckInterval?;
    private installmentCheckInterval?;
    constructor(config: PaylinkConfig);
    /**
     * Create appropriate verifier based on chain type
     */
    private createVerifier;
    /**
     * Check if chain ID is a Solana chain
     */
    private isSolanaChainId;
    /**
     * Get Express app instance
     */
    getApp(): Express;
    /**
     * Get storage instance
     */
    getStorage(): Storage;
    /**
     * Set custom storage
     */
    setStorage(storage: Storage): void;
    /**
     * Get subscription manager
     */
    getSubscriptionManager(): SubscriptionManager;
    /**
     * Get referral manager
     */
    getReferralManager(): ReferralManager;
    /**
     * Get installment manager
     */
    getInstallmentManager(): InstallmentManager;
    /**
     * Start server
     */
    start(): void;
    /**
     * Create a new payment link
     */
    createPayLink(input: CreatePayLinkInput): Promise<PayLink>;
    /**
     * Get payment link by ID
     */
    getPayLink(id: string): Promise<PayLink | null>;
    /**
     * Disable a payment link
     */
    disablePayLink(id: string): Promise<void>;
    /**
     * Create a subscription for a subscriber
     */
    createSubscription(payLinkId: string, subscriberAddress: string, metadata?: Record<string, unknown>): Promise<Subscription>;
    /**
     * Cancel a subscription
     */
    cancelSubscription(subscriptionId: string): Promise<Subscription>;
    /**
     * Pause a subscription
     */
    pauseSubscription(subscriptionId: string): Promise<Subscription>;
    /**
     * Resume a subscription
     */
    resumeSubscription(subscriptionId: string): Promise<Subscription>;
    /**
     * Get subscription by ID
     */
    getSubscription(id: string): Promise<Subscription | null>;
    /**
     * Start periodic subscription check
     */
    private startSubscriptionCheck;
    /**
     * Stop subscription check
     */
    stopSubscriptionCheck(): void;
    /**
     * Start periodic installment check
     */
    private startInstallmentCheck;
    /**
     * Stop installment check
     */
    stopInstallmentCheck(): void;
    private setupMiddleware;
    private setupRoutes;
    private authMiddleware;
    private handlePayLink;
    private handleStatus;
    private handleConfirm;
    /**
     * Handle QR code generation
     */
    private handleQRCode;
    /**
     * Handle subscription creation/renewal
     */
    private handleSubscribe;
    /**
     * Handle get subscription status
     */
    private handleGetSubscription;
    /**
     * Format subscription for response
     */
    private formatSubscriptionResponse;
    private apiCreateLink;
    private apiListLinks;
    private apiGetLink;
    private apiDeleteLink;
    private apiListPayments;
    private apiListSubscriptions;
    private apiGetSubscription;
    private apiCancelSubscription;
    private apiPauseSubscription;
    private apiResumeSubscription;
    private apiCreateReferral;
    private apiListReferrals;
    private apiGetReferral;
    private apiGetReferralByCode;
    private apiDisableReferral;
    private apiGetReferralStats;
    private apiListCommissions;
    private apiGetPendingCommissions;
    private apiMarkCommissionPaid;
    private apiCreateInstallmentPlan;
    private apiListInstallmentPlans;
    private apiGetInstallmentPlan;
    private apiGetInstallmentSchedule;
    private apiProcessInstallmentPayment;
    private apiSuspendInstallmentPlan;
    private apiCancelInstallmentPlan;
    private apiGetBuyerInstallments;
    private apiGetOverdueInstallments;
    private send402;
    private send403;
}
/**
 * Create and start a paylink server
 */
declare function createServer(config: PaylinkConfig): PaylinkServer;

/**
 * In-memory storage implementation
 * Replace with database for production
 */
declare class MemoryStorage implements Storage {
    private links;
    private payments;
    private paymentsByTx;
    private paymentsByLink;
    private paymentsByAddress;
    private subscriptions;
    private subscriptionsByAddress;
    private subscriptionsByLink;
    private referrals;
    private referralsByCode;
    private referralsByLink;
    private referralsByReferrer;
    private commissions;
    private commissionsByReferral;
    private commissionsByReferrer;
    private installmentPlans;
    private installmentPlansByAddress;
    private installmentPlansByLink;
    private installmentPlansByBuyer;
    private installmentPayments;
    private installmentPaymentsByPlan;
    private installmentPaymentsByBuyer;
    getPayLink(id: string): Promise<PayLink | null>;
    savePayLink(payLink: PayLink): Promise<void>;
    updatePayLink(payLink: PayLink): Promise<void>;
    deletePayLink(id: string): Promise<void>;
    getAllPayLinks(): Promise<PayLink[]>;
    savePayment(payment: Payment): Promise<void>;
    getPaymentByTxHash(txHash: string): Promise<Payment | null>;
    getConfirmedPayment(payLinkId: string): Promise<Payment | null>;
    getConfirmedPaymentByAddress(payLinkId: string, fromAddress: string): Promise<Payment | null>;
    getPaymentsByLink(payLinkId: string): Promise<Payment[]>;
    getAllPayments(): Promise<Payment[]>;
    saveSubscription(subscription: Subscription): Promise<void>;
    getSubscription(id: string): Promise<Subscription | null>;
    updateSubscription(subscription: Subscription): Promise<void>;
    getSubscriptionByAddress(payLinkId: string, subscriberAddress: string): Promise<Subscription | null>;
    getSubscriptionsByPayLink(payLinkId: string): Promise<Subscription[]>;
    getSubscriptionsDue(beforeDate: Date): Promise<Subscription[]>;
    getAllSubscriptions(): Promise<Subscription[]>;
    saveReferral(referral: Referral): Promise<void>;
    getReferral(id: string): Promise<Referral | null>;
    getReferralByCode(code: string): Promise<Referral | null>;
    updateReferral(referral: Referral): Promise<void>;
    getReferralsByPayLink(payLinkId: string): Promise<Referral[]>;
    getReferralsByReferrer(referrerAddress: string): Promise<Referral[]>;
    getAllReferrals(): Promise<Referral[]>;
    saveCommission(commission: ReferralCommission): Promise<void>;
    getCommission(id: string): Promise<ReferralCommission | null>;
    updateCommission(commission: ReferralCommission): Promise<void>;
    getCommissionsByReferral(referralId: string): Promise<ReferralCommission[]>;
    getCommissionsByReferrer(referrerAddress: string): Promise<ReferralCommission[]>;
    getPendingCommissions(referrerAddress: string): Promise<ReferralCommission[]>;
    getAllCommissions(): Promise<ReferralCommission[]>;
    saveInstallmentPlan(plan: InstallmentPlan): Promise<void>;
    getInstallmentPlan(id: string): Promise<InstallmentPlan | null>;
    updateInstallmentPlan(plan: InstallmentPlan): Promise<void>;
    getInstallmentPlanByAddress(payLinkId: string, buyerAddress: string): Promise<InstallmentPlan | null>;
    getInstallmentPlansByPayLink(payLinkId: string): Promise<InstallmentPlan[]>;
    getInstallmentPlansByBuyer(buyerAddress: string): Promise<InstallmentPlan[]>;
    getOverdueInstallmentPlans(): Promise<InstallmentPlan[]>;
    getInstallmentPlansDueBefore(date: Date): Promise<InstallmentPlan[]>;
    getAllInstallmentPlans(): Promise<InstallmentPlan[]>;
    saveInstallmentPayment(payment: InstallmentPayment): Promise<void>;
    getInstallmentPayment(id: string): Promise<InstallmentPayment | null>;
    updateInstallmentPayment(payment: InstallmentPayment): Promise<void>;
    getInstallmentPaymentsByPlan(planId: string): Promise<InstallmentPayment[]>;
    getInstallmentPaymentsByBuyer(buyerAddress: string): Promise<InstallmentPayment[]>;
    getAllInstallmentPayments(): Promise<InstallmentPayment[]>;
    /** Clear all data */
    clear(): void;
}

/**
 * Blockchain payment verifier
 */
declare class ChainVerifier {
    private config;
    private requestId;
    constructor(config: ChainConfig);
    get chainId(): number;
    /**
     * Verify payment on chain
     */
    verifyPayment(params: {
        txHash: string;
        recipient: string;
        amount: string;
    }): Promise<PaymentCheckResult>;
    private rpc;
    private isTokenTransfer;
    private weiToEther;
}
/**
 * Mock verifier for development/testing
 */
declare class MockVerifier {
    private confirmed;
    private pending;
    private failed;
    chainId: number;
    markConfirmed(txHash: string): void;
    markPending(txHash: string): void;
    markFailed(txHash: string): void;
    verifyPayment(params: {
        txHash: string;
        recipient: string;
        amount: string;
    }): Promise<PaymentCheckResult>;
}

/**
 * Solana chain configuration
 */
interface SolanaConfig {
    /** RPC URL (e.g., https://api.mainnet-beta.solana.com) */
    rpcUrl: string;
    /** Number of confirmations required (default: 1) */
    confirmations?: number;
    /** Request timeout in ms (default: 30000) */
    timeout?: number;
}
/**
 * Solana Payment Verifier
 * Verifies native SOL transfers on Solana blockchain
 */
declare class SolanaVerifier {
    private config;
    private requestId;
    constructor(config: SolanaConfig);
    /**
     * Verify a Solana payment
     */
    verifyPayment(params: {
        txHash: string;
        recipient: string;
        amount: string;
    }): Promise<PaymentCheckResult>;
    /**
     * Parse a Solana transaction to extract transfer details
     */
    private parseTransfer;
    /**
     * Get transaction details from Solana RPC
     */
    private getTransaction;
    /**
     * Get signature status
     */
    private getSignatureStatus;
    /**
     * Make an RPC call to Solana
     */
    private rpc;
}
/**
 * Mock Solana verifier for testing
 */
declare class MockSolanaVerifier {
    private confirmed;
    private pending;
    private failed;
    markConfirmed(signature: string): void;
    markPending(signature: string): void;
    markFailed(signature: string): void;
    verifyPayment(params: {
        txHash: string;
        recipient: string;
        amount: string;
    }): Promise<PaymentCheckResult>;
}
/**
 * Create a Solana verifier
 */
declare function createSolanaVerifier(config: SolanaConfig): SolanaVerifier;

/**
 * QR Code Generator
 * Generates QR codes for payment links with wallet deep links
 */
/**
 * QR Code options
 */
interface QRCodeOptions {
    /** Size in pixels (default: 256) */
    size?: number;
    /** Margin in modules (default: 4) */
    margin?: number;
    /** Dark color (default: #000000) */
    darkColor?: string;
    /** Light color (default: #ffffff) */
    lightColor?: string;
    /** Output format */
    format?: 'svg' | 'png-base64';
}
/**
 * Payment QR data
 */
interface PaymentQRData {
    /** Chain ID */
    chainId: number;
    /** Recipient address */
    recipient: string;
    /** Amount to pay */
    amount: string;
    /** Token symbol */
    tokenSymbol: string;
    /** Payment link ID */
    payLinkId: string;
    /** Callback URL for confirmation */
    confirmUrl: string;
}
/**
 * Generate a payment URI for wallets
 */
declare function generatePaymentURI(data: PaymentQRData): string;
/**
 * Generate QR code as SVG
 */
declare function generateQRCodeSVG(data: string, options?: QRCodeOptions): string;
/**
 * Generate QR code as data URL (base64 PNG simulation via SVG)
 */
declare function generateQRCodeDataURL(data: string, options?: QRCodeOptions): string;
/**
 * Generate complete payment QR code
 */
declare function generatePaymentQR(data: PaymentQRData, options?: QRCodeOptions): {
    uri: string;
    svg: string;
    dataUrl: string;
};

/**
 * Webhook configuration
 */
interface WebhookConfig {
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
type WebhookEvent = 'payment.confirmed' | 'payment.pending' | 'payment.failed' | 'payment.underpaid' | 'link.created' | 'link.disabled' | 'link.expired' | 'subscription.created' | 'subscription.renewed' | 'subscription.cancelled' | 'subscription.paused' | 'subscription.resumed' | 'subscription.past_due' | 'subscription.expired' | 'subscription.trial_ending' | 'subscription.payment_due' | 'referral.created' | 'referral.disabled' | 'commission.pending' | 'commission.confirmed' | 'commission.paid' | 'installment.plan_created' | 'installment.payment_received' | 'installment.payment_confirmed' | 'installment.plan_activated' | 'installment.plan_completed' | 'installment.plan_suspended' | 'installment.plan_cancelled' | 'installment.payment_due' | 'installment.payment_overdue';
/**
 * Webhook payload base
 */
interface WebhookPayload {
    /** Event type */
    event: WebhookEvent;
    /** Event timestamp */
    timestamp: string;
    /** Unique event ID */
    eventId: string;
    /** Event data */
    data: WebhookPaymentData | WebhookLinkData | WebhookSubscriptionData | WebhookReferralData | WebhookCommissionData | WebhookInstallmentData;
}
/**
 * Payment event data
 */
interface WebhookPaymentData {
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
interface WebhookLinkData {
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
interface WebhookSubscriptionData {
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
 * Referral event data
 */
interface WebhookReferralData {
    type: 'referral';
    referral: {
        id: string;
        code: string;
        referrerAddress: string;
        payLinkId: string;
        totalReferrals: number;
        confirmedReferrals: number;
        totalEarned: string;
        pendingAmount: string;
        status: string;
        createdAt: string;
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
 * Commission event data
 */
interface WebhookCommissionData {
    type: 'commission';
    commission: {
        id: string;
        referralId: string;
        paymentId: string;
        referrerAddress: string;
        referredAddress: string;
        paymentAmount: string;
        commissionAmount: string;
        commissionPercent: number;
        tokenSymbol: string;
        chainId: number;
        status: string;
        createdAt: string;
        confirmedAt?: string;
        paidAt?: string;
        payoutTxHash?: string;
    };
    referral: {
        id: string;
        code: string;
        referrerAddress: string;
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
 * Installment event data
 */
interface WebhookInstallmentData {
    type: 'installment';
    plan: {
        id: string;
        payLinkId: string;
        buyerAddress: string;
        status: string;
        totalAmount: string;
        paidAmount: string;
        totalInstallments: number;
        completedInstallments: number;
        nextDueDate: string;
        nextInstallmentNumber: number;
        createdAt: string;
        activatedAt?: string;
        completedAt?: string;
        suspendedAt?: string;
        cancelledAt?: string;
    };
    payment?: {
        id: string;
        installmentNumber: number;
        amount: string;
        expectedAmount: string;
        txHash: string;
        status: string;
        dueDate: string;
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
        installment?: {
            totalInstallments?: number;
            intervalDays?: number;
            downPaymentPercent?: number;
        };
    };
}
/**
 * Webhook delivery result
 */
interface WebhookResult {
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
declare class WebhookManager {
    private config;
    private queue;
    private processing;
    constructor(config: WebhookConfig);
    /**
     * Check if event type is enabled
     */
    isEventEnabled(event: WebhookEvent): boolean;
    /**
     * Send payment event
     */
    sendPaymentEvent(event: WebhookEvent, payment: Payment, payLink: PayLink): Promise<WebhookResult | null>;
    /**
     * Send link event
     */
    sendLinkEvent(event: WebhookEvent, payLink: PayLink): Promise<WebhookResult | null>;
    /**
     * Send subscription event
     */
    sendSubscriptionEvent(event: WebhookEvent, subscription: Subscription, payLink: PayLink): Promise<WebhookResult | null>;
    /**
     * Send referral event
     */
    sendReferralEvent(event: WebhookEvent, referral: Referral, payLink: PayLink): Promise<WebhookResult | null>;
    /**
     * Send commission event
     */
    sendCommissionEvent(event: WebhookEvent, commission: ReferralCommission, referral: Referral, payLink: PayLink): Promise<WebhookResult | null>;
    /**
     * Send installment event
     */
    sendInstallmentEvent(event: WebhookEvent, plan: InstallmentPlan, payLink: PayLink, payment?: InstallmentPayment): Promise<WebhookResult | null>;
    /**
     * Queue event for async delivery
     */
    queueEvent(payload: WebhookPayload): void;
    /**
     * Send webhook with retries
     */
    send(payload: WebhookPayload): Promise<WebhookResult>;
    /**
     * Deliver webhook
     */
    private deliver;
    /**
     * Sign payload with HMAC-SHA256
     */
    private sign;
    /**
     * Generate unique event ID
     */
    private generateEventId;
    /**
     * Process queued events
     */
    private processQueue;
    /**
     * Delay helper
     */
    private delay;
}
/**
 * Verify webhook signature
 * Use this in your webhook handler to verify authenticity
 */
declare function verifyWebhookSignature(body: string, signature: string, secret: string): boolean;
/**
 * Create a webhook manager
 */
declare function createWebhookManager(config: WebhookConfig): WebhookManager;

/**
 * PAYLINK Token Integration
 * Native token support for Paylink Protocol
 *
 * Token: PAYLINK
 * Mint: cMNjNj2NMaEniE37KvyV2GCyQJnbY8YDeANBhSMpump
 * Chain: Solana
 * Decimals: 6 (standard pump.fun token)
 */

/**
 * PAYLINK Token Constants
 */
declare const PAYLINK_TOKEN: {
    /** Token mint address */
    readonly MINT: "cMNjNj2NMaEniE37KvyV2GCyQJnbY8YDeANBhSMpump";
    /** Token symbol */
    readonly SYMBOL: "PAYLINK";
    /** Token decimals (pump.fun standard) */
    readonly DECIMALS: 6;
    /** Chain ID (Solana mainnet) */
    readonly CHAIN_ID: 101;
};
/**
 * Discount tiers based on PAYLINK holdings
 */
interface DiscountTier {
    /** Minimum token balance required */
    minBalance: number;
    /** Discount percentage (0-100) */
    discountPercent: number;
    /** Tier name */
    name: string;
}
/**
 * Default discount tiers
 */
declare const DEFAULT_DISCOUNT_TIERS: DiscountTier[];
/**
 * PAYLINK configuration
 */
interface PaylinkTokenConfig {
    /** Solana RPC URL */
    rpcUrl: string;
    /** Enable PAYLINK token payments */
    enableTokenPayments?: boolean;
    /** Discount when paying with PAYLINK (percentage, 0-100) */
    tokenPaymentDiscount?: number;
    /** Enable holder discounts */
    enableHolderDiscounts?: boolean;
    /** Custom discount tiers (optional) */
    discountTiers?: DiscountTier[];
    /** Request timeout in ms */
    timeout?: number;
}
/**
 * PAYLINK Token Manager
 * Handles token balance checks, discounts, and SPL token payment verification
 */
declare class PaylinkTokenManager {
    private config;
    private requestId;
    constructor(config: PaylinkTokenConfig);
    /**
     * Get PAYLINK token balance for a wallet
     */
    getTokenBalance(walletAddress: string): Promise<number>;
    /**
     * Get discount tier for a wallet based on PAYLINK holdings
     */
    getDiscountTier(walletAddress: string): Promise<DiscountTier | null>;
    /**
     * Calculate discounted price based on holder tier
     */
    calculateDiscountedPrice(walletAddress: string, originalPrice: number): Promise<{
        price: number;
        discount: number;
        tier: DiscountTier | null;
    }>;
    /**
     * Get price when paying with PAYLINK token
     */
    getTokenPaymentPrice(originalPrice: number): number;
    /**
     * Verify PAYLINK token payment
     */
    verifyTokenPayment(params: {
        txHash: string;
        recipient: string;
        amount: string;
    }): Promise<PaymentCheckResult>;
    /**
     * Parse SPL token transfer from transaction
     */
    private parseTokenTransfer;
    /**
     * Get token accounts for a wallet
     */
    private getTokenAccountsByOwner;
    /**
     * Get transaction details
     */
    private getTransaction;
    /**
     * Make RPC call
     */
    private rpc;
}
/**
 * Create a PAYLINK token manager
 */
declare function createPaylinkTokenManager(config: PaylinkTokenConfig): PaylinkTokenManager;
/**
 * Check if a token symbol is PAYLINK
 */
declare function isPaylinkToken(symbol: string): boolean;
/**
 * Format PAYLINK amount for display
 */
declare function formatPaylinkAmount(amount: number): string;

/**
 * Generate short unique ID
 */
declare function generateId(length?: number): string;
/**
 * Generate UUID
 */
declare function generateUUID(): string;
/**
 * Generate nonce
 */
declare function generateNonce(): string;
/**
 * Create HMAC signature
 */
declare function sign(data: string, secret: string): string;
/**
 * Check if date is expired
 */
declare function isExpired(date?: Date): boolean;
/**
 * Check if usage limit reached
 */
declare function isLimitReached(used?: number, max?: number): boolean;
/**
 * Compare amounts
 */
declare function compareAmounts(a: string, b: string): number;
/**
 * Reason code messages
 */
declare const REASON_MESSAGES: Record<string, string>;

export { type ChainConfig, type ChainType, ChainVerifier, type CreateInstallmentPlanInput, type CreatePayLinkInput, type CreateReferralInput, type CreateSubscriptionInput, DEFAULT_DISCOUNT_TIERS, DEFAULT_INSTALLMENT_CONFIG, DEFAULT_REFERRAL_CONFIG, type DiscountTier, type InstallmentConfig, InstallmentManager, type InstallmentPayment, type InstallmentPaymentStatus, type InstallmentPlan, type InstallmentPlanStats, type InstallmentStatus, MemoryStorage, MockSolanaVerifier, MockVerifier, type MultiPrice, PAYLINK_TOKEN, type PayLink, type PayLinkStatus, type PaylinkConfig, PaylinkServer, type PaylinkTokenConfig, PaylinkTokenManager, type Payment, type PaymentCheckResult, type PaymentOption, type PaymentQRData, type PaymentStatus, type Price, type Protocol402Response, type Protocol403Response, type QRCodeOptions, REASON_MESSAGES, ReasonCode, type Referral, type ReferralCommission, type ReferralConfig, ReferralManager, type ReferralStats, type ReferralStatus, SOLANA_CHAIN_IDS, type SolanaConfig, SolanaVerifier, type Storage, type Subscription, type SubscriptionConfig, type SubscriptionInterval, SubscriptionManager, type SubscriptionStatus, type WebhookCommissionData, type WebhookConfig, type WebhookConfigType, type WebhookEvent, type WebhookInstallmentData, type WebhookLinkData, WebhookManager, type WebhookPayload, type WebhookPaymentData, type WebhookReferralData, type WebhookResult, type WebhookSubscriptionData, buildReferralUrl, calculateCommission, calculateDueDates, calculateInstallmentAmounts, calculateNextBillingDate, calculateNextDueDate, compareAmounts, createInstallmentManager, createPaylinkTokenManager, createReferralManager, createServer, createSolanaVerifier, createSubscriptionManager, createWebhookManager, formatInstallmentSchedule, formatPaylinkAmount, generateId, generateNonce, generatePaymentQR, generatePaymentURI, generateQRCodeDataURL, generateQRCodeSVG, generateReferralCode, generateUUID, getInstallmentProgress, getIntervalDisplayName, isCommissionExpired, isExpired, isInGracePeriod, isInTrialPeriod, isInstallmentOverdue, isLimitReached, isPaylinkToken, isPaymentDue, isValidReferralCode, isWithinGracePeriod, parseReferralCode, sign, verifyWebhookSignature };
