# Changelog

All notable changes to this project will be documented in this file.

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
