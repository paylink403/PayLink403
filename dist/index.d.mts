import { Express } from 'express';

/**
 * Payment link status
 */
type PayLinkStatus = 'active' | 'disabled' | 'expired';
/**
 * Payment verification status
 */
type PaymentStatus = 'not_found' | 'pending' | 'confirmed' | 'failed' | 'underpaid';
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
 * Price configuration
 */
interface Price {
    amount: string;
    tokenSymbol: string;
    chainId: number;
}
/**
 * Payment link entity
 */
interface PayLink {
    id: string;
    targetUrl: string;
    price: Price;
    recipientAddress: string;
    status: PayLinkStatus;
    createdAt: Date;
    updatedAt: Date;
    description?: string;
    maxUses?: number;
    usedCount?: number;
    expiresAt?: Date;
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
    amount: string;
    confirmed: boolean;
    createdAt: Date;
    confirmedAt?: Date;
}
/**
 * Input for creating a payment link
 */
interface CreatePayLinkInput {
    targetUrl: string;
    price: Price;
    recipientAddress: string;
    description?: string;
    maxUses?: number;
    expiresAt?: Date;
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
    payment: {
        chainId: number;
        tokenSymbol: string;
        amount: string;
        recipient: string;
        timeoutSeconds: number;
    };
    callbacks: {
        status: string;
        confirm: string;
    };
    nonce: string;
    signature?: string;
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
    INTERNAL_ERROR = "INTERNAL_ERROR"
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
    events?: Array<'payment.confirmed' | 'payment.pending' | 'payment.failed' | 'payment.underpaid' | 'link.created' | 'link.disabled'>;
    /** Request timeout in ms */
    timeout?: number;
    /** Retry count on failure */
    retries?: number;
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
    getAllPayments(): Promise<Payment[]>;
}

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
    private apiCreateLink;
    private apiListLinks;
    private apiGetLink;
    private apiDeleteLink;
    private apiListPayments;
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
    getPayLink(id: string): Promise<PayLink | null>;
    savePayLink(payLink: PayLink): Promise<void>;
    updatePayLink(payLink: PayLink): Promise<void>;
    deletePayLink(id: string): Promise<void>;
    getAllPayLinks(): Promise<PayLink[]>;
    savePayment(payment: Payment): Promise<void>;
    getPaymentByTxHash(txHash: string): Promise<Payment | null>;
    getConfirmedPayment(payLinkId: string): Promise<Payment | null>;
    getAllPayments(): Promise<Payment[]>;
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
type WebhookEvent = 'payment.confirmed' | 'payment.pending' | 'payment.failed' | 'payment.underpaid' | 'link.created' | 'link.disabled' | 'link.expired';
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
    data: WebhookPaymentData | WebhookLinkData;
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

export { type ChainConfig, type ChainType, ChainVerifier, type CreatePayLinkInput, MemoryStorage, MockSolanaVerifier, MockVerifier, type PayLink, type PayLinkStatus, type PaylinkConfig, PaylinkServer, type Payment, type PaymentCheckResult, type PaymentQRData, type PaymentStatus, type Price, type Protocol402Response, type Protocol403Response, type QRCodeOptions, REASON_MESSAGES, ReasonCode, SOLANA_CHAIN_IDS, type SolanaConfig, SolanaVerifier, type Storage, type WebhookConfig, type WebhookConfigType, type WebhookEvent, type WebhookLinkData, WebhookManager, type WebhookPayload, type WebhookPaymentData, type WebhookResult, compareAmounts, createServer, createSolanaVerifier, createWebhookManager, generateId, generateNonce, generatePaymentQR, generatePaymentURI, generateQRCodeDataURL, generateQRCodeSVG, generateUUID, isExpired, isLimitReached, sign, verifyWebhookSignature };
