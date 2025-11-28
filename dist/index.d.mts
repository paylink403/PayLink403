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
 * Supported chain configuration
 */
interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    symbol: string;
    confirmations?: number;
}
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
    constructor(config: PaylinkConfig);
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

export { type ChainConfig, ChainVerifier, type CreatePayLinkInput, MemoryStorage, MockVerifier, type PayLink, type PayLinkStatus, type PaylinkConfig, PaylinkServer, type Payment, type PaymentCheckResult, type PaymentStatus, type Price, type Protocol402Response, type Protocol403Response, REASON_MESSAGES, ReasonCode, type Storage, compareAmounts, createServer, generateId, generateNonce, generateUUID, isExpired, isLimitReached, sign };
