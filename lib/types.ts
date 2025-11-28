/**
 * Payment link status
 */
export type PayLinkStatus = 'active' | 'disabled' | 'expired';

/**
 * Payment verification status
 */
export type PaymentStatus = 'not_found' | 'pending' | 'confirmed' | 'failed' | 'underpaid';

/**
 * Supported chain configuration
 */
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  symbol: string;
  confirmations?: number;
}

/**
 * Price configuration
 */
export interface Price {
  amount: string;
  tokenSymbol: string;
  chainId: number;
}

/**
 * Payment link entity
 */
export interface PayLink {
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
export interface Payment {
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
export interface CreatePayLinkInput {
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
export interface Protocol402Response {
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
export enum ReasonCode {
  LINK_NOT_FOUND = 'LINK_NOT_FOUND',
  LINK_DISABLED = 'LINK_DISABLED',
  LINK_EXPIRED = 'LINK_EXPIRED',
  LINK_USAGE_LIMIT_REACHED = 'LINK_USAGE_LIMIT_REACHED',
  PAYMENT_UNDERPAID = 'PAYMENT_UNDERPAID',
  PAYMENT_CHAIN_NOT_SUPPORTED = 'PAYMENT_CHAIN_NOT_SUPPORTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
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
}
