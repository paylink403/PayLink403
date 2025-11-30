// Main exports
export { PaylinkServer, createServer } from './server.js';

// Types
export type {
  PaylinkConfig,
  PayLink,
  Payment,
  Price,
  PaymentOption,
  MultiPrice,
  ChainConfig,
  ChainType,
  CreatePayLinkInput,
  Storage,
  PayLinkStatus,
  PaymentStatus,
  Protocol402Response,
  Protocol403Response,
  PaymentCheckResult,
  WebhookConfigType,
  // Subscription types
  Subscription,
  SubscriptionConfig,
  SubscriptionInterval,
  SubscriptionStatus,
  CreateSubscriptionInput,
} from './types.js';

export { ReasonCode, SOLANA_CHAIN_IDS } from './types.js';

// Storage
export { MemoryStorage } from './storage.js';

// Chain verification
export { ChainVerifier, MockVerifier } from './chain.js';

// Solana verification
export { SolanaVerifier, MockSolanaVerifier, createSolanaVerifier } from './providers/solana.js';
export type { SolanaConfig } from './providers/solana.js';

// QR Code generation
export {
  generatePaymentURI,
  generateQRCodeSVG,
  generateQRCodeDataURL,
  generatePaymentQR,
} from './qrcode.js';
export type { QRCodeOptions, PaymentQRData } from './qrcode.js';

// Webhooks
export {
  WebhookManager,
  createWebhookManager,
  verifyWebhookSignature,
} from './webhook.js';
export type {
  WebhookConfig,
  WebhookEvent,
  WebhookPayload,
  WebhookResult,
  WebhookPaymentData,
  WebhookLinkData,
  WebhookSubscriptionData,
} from './webhook.js';

// Subscriptions
export {
  SubscriptionManager,
  createSubscriptionManager,
  calculateNextBillingDate,
  isPaymentDue,
  isInTrialPeriod,
  isWithinGracePeriod,
  getIntervalDisplayName,
} from './subscription.js';

// PAYLINK Token
export {
  PaylinkTokenManager,
  createPaylinkTokenManager,
  isPaylinkToken,
  formatPaylinkAmount,
  PAYLINK_TOKEN,
  DEFAULT_DISCOUNT_TIERS,
} from './paylink-token.js';
export type {
  PaylinkTokenConfig,
  DiscountTier,
} from './paylink-token.js';

// Utils
export {
  generateId,
  generateUUID,
  generateNonce,
  sign,
  isExpired,
  isLimitReached,
  compareAmounts,
  REASON_MESSAGES,
} from './utils.js';
