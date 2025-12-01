# Changelog

All notable changes to this project will be documented in this file.

## [1.6.0] - 2024-12-01

### Added

- **Referral System**: Viral growth through referral rewards
  - Create referral codes for any payment link
  - Track referrals and commissions automatically
  - Configurable commission percentages (default: 10%)
  - Commission tracking with pending/confirmed/paid statuses
  - Self-referral prevention

- **New Types**:
  - `Referral` - Referral entity with tracking stats
  - `ReferralCommission` - Individual commission records
  - `ReferralConfig` - Configuration for referral programs
  - `ReferralStats` - Statistics for referrers
  - `ReferralStatus` - Commission status type

- **ReferralManager**:
  - `createReferral()` - Create new referral codes
  - `processReferralPayment()` - Process commission on payment
  - `confirmCommission()` - Confirm pending commission
  - `markCommissionPaid()` - Mark commission as paid out
  - `getStats()` - Get referrer statistics
  - `disableReferral()` - Disable a referral

- **Webhook Events**:
  - `referral.created` - New referral created
  - `referral.disabled` - Referral disabled
  - `commission.pending` - Commission pending
  - `commission.confirmed` - Commission confirmed
  - `commission.paid` - Commission paid out

- **Utility Functions**:
  - `generateReferralCode()` - Generate unique codes
  - `isValidReferralCode()` - Validate code format
  - `calculateCommission()` - Calculate commission amount
  - `buildReferralUrl()` - Build shareable referral URL
  - `parseReferralCode()` - Extract code from URL

### API Changes

- `POST /api/links` now accepts `referral` configuration:
  ```json
  {
    "referral": {
      "enabled": true,
      "commissionPercent": 10,
      "minPayoutThreshold": "0.01",
      "expirationDays": 30
    }
  }
  ```

- `POST /pay/:id/confirm` now accepts `referralCode`:
  ```json
  {
    "txHash": "0x...",
    "referralCode": "ABC123"
  }
  ```

### New Admin Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/referrals` | Create referral |
| GET | `/api/referrals` | List referrals |
| GET | `/api/referrals/:id` | Get referral |
| GET | `/api/referrals/code/:code` | Get by code |
| POST | `/api/referrals/:id/disable` | Disable referral |
| GET | `/api/referrals/:id/stats` | Get stats |
| GET | `/api/commissions` | List commissions |
| GET | `/api/commissions/pending/:address` | Pending payouts |
| POST | `/api/commissions/:id/payout` | Mark as paid |

### Storage Interface Changes

- Added referral methods:
  - `saveReferral()`, `getReferral()`, `getReferralByCode()`
  - `updateReferral()`, `getReferralsByPayLink()`
  - `getReferralsByReferrer()`, `getAllReferrals()`

- Added commission methods:
  - `saveCommission()`, `getCommission()`, `updateCommission()`
  - `getCommissionsByReferral()`, `getCommissionsByReferrer()`
  - `getPendingCommissions()`, `getAllCommissions()`

## [1.5.0] - 2024-12-01

### Added

- **Multi-Use Links**: One link, multiple payers - each pays once for access
  - Set `multiUse: true` when creating a link
  - Each payer's address is tracked individually
  - Access granted per-address after payment confirmation
  - Optional `maxUses` limit even for multi-use links

- **Per-Address Payment Tracking**:
  - New storage method `getConfirmedPaymentByAddress()`
  - New storage method `getPaymentsByLink()`
  - Payments indexed by payer address for fast lookups

- **Updated Status Endpoint**:
  - Multi-use links return total payment count
  - Use `?payer=ADDRESS` to check specific payer's status

### API Changes

- `POST /api/links` now accepts `multiUse` boolean:
  ```json
  {
    "multiUse": true,
    "maxUses": 1000
  }
  ```

- `GET /pay/:id?payer=ADDRESS` - Access check for multi-use links
- `GET /pay/:id/status?payer=ADDRESS` - Payment status for specific payer

### Storage Interface Changes

- Added `getConfirmedPaymentByAddress(payLinkId, fromAddress)` method
- Added `getPaymentsByLink(payLinkId)` method

## [1.4.0] - 2024-11-30

### Added

- **Multi-Currency Support**: Accept multiple tokens/chains per payment link
  - Define different prices for each accepted token
  - Set different recipient addresses per payment option
  - Automatic verification based on chain ID in confirm request

- **New Types**:
  - `PaymentOption` - Configuration for each accepted token
  - `MultiPrice` - Multi-currency price structure

- **Updated 402 Response**:
  - New `paymentOptions` array in 402 response
  - Shows all accepted payment methods with amounts

### API Changes

- `POST /api/links` now accepts `paymentOptions` array:
  ```json
  {
    "paymentOptions": [
      { "tokenSymbol": "SOL", "chainId": 101, "amount": "0.5" },
      { "tokenSymbol": "MATIC", "chainId": 137, "amount": "15" }
    ]
  }
  ```

- `POST /pay/:id/confirm` now accepts optional `chainId`:
  ```json
  { "txHash": "...", "chainId": 101 }
  ```

### New Exports

- Types: `PaymentOption`, `MultiPrice`

## [1.3.0] - 2024-11-30

### Added

- **Subscriptions**: Recurring payment support with flexible billing
  - New subscription link type with configurable intervals (daily, weekly, monthly, yearly)
  - Grace periods for late payments
  - Trial period support
  - Maximum billing cycles limit
  - Automatic past-due detection

- **Subscription Endpoints**:
  - `POST /pay/:id/subscribe` - Create or renew subscription
  - `GET /pay/:id/subscription?subscriber=ADDRESS` - Check subscription status
  - `GET /api/subscriptions` - List all subscriptions (admin)
  - `GET /api/subscriptions/:id` - Get subscription details (admin)
  - `POST /api/subscriptions/:id/cancel` - Cancel subscription (admin)
  - `POST /api/subscriptions/:id/pause` - Pause subscription (admin)
  - `POST /api/subscriptions/:id/resume` - Resume subscription (admin)

- **Subscription Webhooks**:
  - `subscription.created` - New subscription created
  - `subscription.renewed` - Payment received, subscription renewed
  - `subscription.cancelled` - Subscription cancelled
  - `subscription.paused` - Subscription paused
  - `subscription.resumed` - Subscription resumed from pause
  - `subscription.past_due` - Payment past grace period
  - `subscription.payment_due` - Payment due reminder
  - `subscription.expired` - Max billing cycles reached

- **New Reason Codes**:
  - `SUBSCRIPTION_CANCELLED`
  - `SUBSCRIPTION_PAST_DUE`
  - `SUBSCRIPTION_PAUSED`
  - `SUBSCRIPTION_EXPIRED`
  - `SUBSCRIPTION_MAX_CYCLES_REACHED`

### New Exports

- `SubscriptionManager`, `createSubscriptionManager`
- `calculateNextBillingDate()`, `isPaymentDue()`, `isInTrialPeriod()`, `isWithinGracePeriod()`, `getIntervalDisplayName()`
- Types: `Subscription`, `SubscriptionConfig`, `SubscriptionInterval`, `SubscriptionStatus`, `CreateSubscriptionInput`
- `WebhookSubscriptionData` type

### Technical

- New file: `lib/subscription.ts` - Subscription management
- Updated `Storage` interface with subscription methods
- Updated `MemoryStorage` with subscription storage
- 402 response now includes subscription info for subscription links
- Automatic periodic check for due subscriptions (every 60 seconds)

## [1.2.0] - 2024-11-30

### Added

- **PAYLINK Token Integration**: Native support for PAYLINK token (cMNjNj2NMaEniE37KvyV2GCyQJnbY8YDeANBhSMpump)
  - SPL token payment verification
  - Holder discount tiers (Bronze 5% → Diamond 50%)
  - Payment discount when using PAYLINK token
  - `PaylinkTokenManager` class for balance checks and discounts
  - Helper functions: `isPaylinkToken()`, `formatPaylinkAmount()`

### New Exports

- `PAYLINK_TOKEN` - Token constants (mint address, decimals, symbol)
- `DEFAULT_DISCOUNT_TIERS` - Default holder discount tiers
- `PaylinkTokenManager` - Token management class
- `createPaylinkTokenManager()` - Factory function
- `PaylinkTokenConfig` type

## [1.1.0] - 2024-11-30

### Added

- **Solana Support**: Native SOL payment verification on Solana mainnet, devnet, and testnet
  - New `SolanaVerifier` class for verifying Solana transactions
  - Chain IDs: 101 (mainnet), 102 (devnet), 103 (testnet)
  - Auto-detection of Solana chains by chain ID or explicit `type: 'solana'`

- **QR Code Generation**: Generate wallet-compatible QR codes for payments
  - New endpoint: `GET /pay/:id/qr` - returns SVG QR code
  - Supports `?format=json` for JSON response with data URL
  - Supports `?size=N` for custom QR code size
  - Generates Solana Pay URIs for Solana chains
  - Generates EIP-681 URIs for EVM chains

- **Webhooks**: Real-time notifications for payment and link events
  - Events: `payment.confirmed`, `payment.pending`, `payment.failed`, `payment.underpaid`, `link.created`, `link.disabled`
  - HMAC-SHA256 signature verification
  - Configurable retries with exponential backoff
  - New `verifyWebhookSignature()` helper function

- **CLI Enhancements**:
  - `--solana [url]` - Add Solana mainnet
  - `--solana-devnet [url]` - Add Solana devnet
  - `--mock-solana` - Use mock Solana chain for testing
  - `--webhook <url>` - Set webhook URL
  - `--webhook-secret <secret>` - Set webhook HMAC secret

### Changed

- Default mock mode now includes both Mock Ethereum and Mock Solana chains
- Server startup banner now shows version number (v1.1.0) and webhook URL if configured
- Updated console output to show QR endpoint

### Technical

- New files:
  - `lib/providers/solana.ts` - Solana payment verification
  - `lib/qrcode.ts` - QR code generation (pure TypeScript, no external dependencies)
  - `lib/webhook.ts` - Webhook management system

- New exports:
  - `SolanaVerifier`, `MockSolanaVerifier`, `createSolanaVerifier`
  - `generatePaymentURI`, `generateQRCodeSVG`, `generateQRCodeDataURL`, `generatePaymentQR`
  - `WebhookManager`, `createWebhookManager`, `verifyWebhookSignature`
  - `SOLANA_CHAIN_IDS` constant
  - `ChainType`, `WebhookConfigType` types

## [1.0.0] - 2024-11-27

### Initial Release

- 402/403 payment protocol
- EVM chain support (Ethereum, Polygon, BSC, Arbitrum, etc.)
- Payment link creation and management
- Transaction verification with configurable confirmations
- Admin API with API key authentication
- In-memory storage (with custom storage interface)
- Mock chain for development/testing
- CLI for quick server startup
