# @paylinkprotocol/paylink

Self-hosted paid links with 402/403 protocol and blockchain payment verification.

**Each user runs their own server with their own RPC nodes.**

## What's New in v1.5.0

- 🔄 **Multi-Use Links** - One link, multiple payers - each pays once for access
- 👥 **Per-Address Tracking** - Track who has paid, grant access individually
- 📊 **Usage Stats** - See total payments on multi-use links

## Features

- 🔗 Create paid links with automatic payment verification
- 🔄 **Multi-use links** - Sell access to unlimited users with one link
- 💱 **Multi-currency support** - Accept ETH, SOL, USDC, etc. on one link
- 🔄 **Subscription links** with recurring payments
- ⛓️ Multi-chain support (EVM chains + Solana)
- 📱 QR codes with wallet deep links (Solana Pay, EIP-681)
- 🔔 Webhook notifications for payment and subscription events
- 🔒 Standard 402/403 payment protocol
- 🚀 Simple API, easy to integrate
- 💻 Self-hosted - you control everything

## Installation

```bash
npm install @paylinkprotocol/paylink
```

## Quick Start

### Using CLI

```bash
# Start with mock chains (for testing)
npx paylink --mock --mock-solana --api-key your-secret-key

# Start with Ethereum
npx paylink \
  --chain 1:Ethereum:ETH:https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
  --api-key your-secret-key

# Start with Solana
npx paylink \
  --solana https://api.mainnet-beta.solana.com \
  --api-key your-secret-key

# Multiple chains with webhook
npx paylink \
  --chain 1:Ethereum:ETH:https://eth-rpc.com \
  --solana \
  --webhook https://your-server.com/webhook \
  --webhook-secret your-hmac-secret \
  --api-key secret
```

### Using Code

```javascript
const { createServer } = require('@paylinkprotocol/paylink');

const server = createServer({
  port: 3000,
  baseUrl: 'https://your-domain.com',
  apiKey: 'your-secret-api-key',
  
  // Blockchain networks
  chains: [
    // EVM chains
    {
      chainId: 1,
      name: 'Ethereum',
      symbol: 'ETH',
      rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
      confirmations: 3,
    },
    {
      chainId: 137,
      name: 'Polygon',
      symbol: 'MATIC',
      rpcUrl: 'https://polygon-rpc.com',
      confirmations: 5,
    },
    // Solana
    {
      chainId: 101, // 101 = mainnet, 102 = devnet, 103 = testnet
      name: 'Solana',
      symbol: 'SOL',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      type: 'solana',
    },
  ],
  
  // Webhook configuration (optional)
  webhook: {
    url: 'https://your-server.com/webhook',
    secret: 'your-hmac-secret',
    events: ['payment.confirmed', 'payment.pending', 'link.created'],
  },
});

server.start();
```

## API Endpoints

### Public Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/` | Server info |
| GET | `/health` | Health check |
| GET | `/pay/:id` | Payment link (returns 402/403/302) |
| GET | `/pay/:id/status` | Check payment status |
| POST | `/pay/:id/confirm` | Confirm payment with txHash |
| GET | `/pay/:id/qr` | Get QR code for payment |
| POST | `/pay/:id/subscribe` | Create or renew subscription |
| GET | `/pay/:id/subscription?subscriber=ADDRESS` | Get subscription status |

### Admin Endpoints (require X-API-Key header)

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/links` | Create payment link |
| GET | `/api/links` | List all links |
| GET | `/api/links/:id` | Get link details |
| DELETE | `/api/links/:id` | Disable link |
| GET | `/api/payments` | List all payments |
| GET | `/api/subscriptions` | List all subscriptions |
| GET | `/api/subscriptions/:id` | Get subscription details |
| POST | `/api/subscriptions/:id/cancel` | Cancel subscription |
| POST | `/api/subscriptions/:id/pause` | Pause subscription |
| POST | `/api/subscriptions/:id/resume` | Resume subscription |

## Usage Examples

### Create a Payment Link

```bash
# Ethereum payment
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "targetUrl": "https://example.com/premium-content",
    "amount": "0.01",
    "tokenSymbol": "ETH",
    "chainId": 1,
    "recipientAddress": "0xYourWalletAddress",
    "description": "Premium content access"
  }'

# Solana payment
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "targetUrl": "https://example.com/premium-content",
    "amount": "0.5",
    "tokenSymbol": "SOL",
    "chainId": 101,
    "recipientAddress": "YourSolanaWalletAddress",
    "description": "Premium content access"
  }'
```

Response:
```json
{
  "success": true,
  "link": {
    "id": "abc123",
    "url": "http://localhost:3000/pay/abc123",
    "targetUrl": "https://example.com/premium-content",
    "price": {
      "amount": "0.01",
      "tokenSymbol": "ETH",
      "chainId": 1
    }
  }
}
```

### Create a Multi-Currency Payment Link

Accept multiple tokens on different chains with custom amounts for each:

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "targetUrl": "https://example.com/premium-content",
    "amount": "0.01",
    "tokenSymbol": "ETH",
    "chainId": 1,
    "recipientAddress": "0xYourEthAddress",
    "description": "Premium content - pay with ETH or SOL",
    "paymentOptions": [
      {
        "tokenSymbol": "SOL",
        "chainId": 101,
        "amount": "0.5",
        "recipientAddress": "YourSolanaAddress"
      },
      {
        "tokenSymbol": "MATIC",
        "chainId": 137,
        "amount": "15"
      }
    ]
  }'
```

Response:
```json
{
  "success": true,
  "link": {
    "id": "abc123",
    "url": "http://localhost:3000/pay/abc123",
    "price": {
      "amount": "0.01",
      "tokenSymbol": "ETH",
      "chainId": 1
    },
    "paymentOptions": [
      { "tokenSymbol": "SOL", "chainId": 101, "amount": "0.5", "recipientAddress": "YourSolanaAddress" },
      { "tokenSymbol": "MATIC", "chainId": 137, "amount": "15" }
    ]
  }
}
```

### Confirm Multi-Currency Payment

When confirming a payment, specify which chain was used:

```bash
curl -X POST http://localhost:3000/pay/abc123/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "5xK8...",
    "chainId": 101
  }'
```

### Create a Multi-Use Payment Link

Multi-use links allow multiple users to pay for access. Each payer's address is tracked individually:

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "targetUrl": "https://example.com/premium-content",
    "amount": "0.01",
    "tokenSymbol": "ETH",
    "chainId": 1,
    "recipientAddress": "0xYourWalletAddress",
    "description": "Premium content - pay once, access forever",
    "multiUse": true,
    "maxUses": 1000
  }'
```

Response:
```json
{
  "success": true,
  "link": {
    "id": "abc123",
    "url": "http://localhost:3000/pay/abc123",
    "multiUse": true,
    "maxUses": 1000
  }
}
```

### Access Multi-Use Link

Users must provide their payer address to check access:

```bash
# Check access (redirect if paid, 402 if not)
curl http://localhost:3000/pay/abc123?payer=0xUserAddress

# Check payment status
curl http://localhost:3000/pay/abc123/status?payer=0xUserAddress
```

Status Response:
```json
{
  "status": "paid",
  "payerAddress": "0xUserAddress"
}
```

### Multi-Use vs Single-Use vs Subscription

| Feature | Single-Use | Multi-Use | Subscription |
|---------|------------|-----------|--------------|
| Payers | 1 | Unlimited | Unlimited |
| Access check | Any payment | By payer address | By subscriber address |
| Recurring | No | No | Yes |
| Use case | One-time purchase | Sell to many | Recurring access |

### Get QR Code

```bash
# Get QR code as SVG
curl http://localhost:3000/pay/abc123/qr

# Get QR code as JSON (with data URL)
curl http://localhost:3000/pay/abc123/qr?format=json

# Custom size
curl http://localhost:3000/pay/abc123/qr?size=512
```

QR JSON Response:
```json
{
  "payLinkId": "abc123",
  "paymentUri": "solana:YourAddress?amount=0.5&label=Paylink%20Payment",
  "qrCodeDataUrl": "data:image/svg+xml;base64,...",
  "payment": {
    "chainId": 101,
    "tokenSymbol": "SOL",
    "amount": "0.5",
    "recipient": "YourAddress"
  }
}
```

### User Flow

1. User visits `http://localhost:3000/pay/abc123`
2. Server returns `402 Payment Required` with payment details
3. User scans QR code or pays manually to the specified address
4. User/frontend calls `POST /pay/abc123/confirm` with `{ txHash: "..." }`
5. Server verifies payment on-chain
6. Webhook notification sent (if configured)
7. Next visit to the link returns `302 Redirect` to target URL

## 402 Response Format

```json
{
  "protocol": "402-paylink-v1",
  "payLinkId": "abc123",
  "resource": {
    "description": "Premium content access"
  },
  "payment": {
    "chainId": 1,
    "tokenSymbol": "ETH",
    "amount": "0.01",
    "recipient": "0x...",
    "timeoutSeconds": 900
  },
  "paymentOptions": [
    { "chainId": 101, "tokenSymbol": "SOL", "amount": "0.5", "recipient": "Sol..." },
    { "chainId": 137, "tokenSymbol": "MATIC", "amount": "15", "recipient": "0x..." }
  ],
  "callbacks": {
    "status": "http://localhost:3000/pay/abc123/status",
    "confirm": "http://localhost:3000/pay/abc123/confirm"
  },
  "nonce": "random-string"
}
```

The `payment` field contains the primary/default payment option. The `paymentOptions` array contains additional accepted tokens (only present for multi-currency links).

## 403 Response Format

```json
{
  "protocol": "403-paylink-v1",
  "payLinkId": "abc123",
  "reasonCode": "LINK_EXPIRED",
  "reasonMessage": "This payment link has expired."
}
```

### Reason Codes

- `LINK_NOT_FOUND` - Link doesn't exist
- `LINK_DISABLED` - Link was disabled
- `LINK_EXPIRED` - Link expired
- `LINK_USAGE_LIMIT_REACHED` - Max uses reached
- `PAYMENT_UNDERPAID` - Amount too low
- `PAYMENT_CHAIN_NOT_SUPPORTED` - Chain not configured
- `SUBSCRIPTION_CANCELLED` - Subscription was cancelled
- `SUBSCRIPTION_PAST_DUE` - Payment is past due
- `SUBSCRIPTION_PAUSED` - Subscription is paused
- `SUBSCRIPTION_EXPIRED` - Subscription has expired

## Subscriptions

Create subscription links for recurring payments.

### Create a Subscription Link

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "targetUrl": "https://example.com/premium-content",
    "amount": "0.1",
    "tokenSymbol": "SOL",
    "chainId": 101,
    "recipientAddress": "YourSolanaWalletAddress",
    "description": "Monthly premium subscription",
    "subscription": {
      "interval": "monthly",
      "intervalCount": 1,
      "gracePeriodHours": 48,
      "trialDays": 7
    }
  }'
```

Response:
```json
{
  "success": true,
  "link": {
    "id": "abc123",
    "url": "http://localhost:3000/pay/abc123",
    "subscription": {
      "interval": "monthly",
      "intervalCount": 1,
      "gracePeriodHours": 48,
      "trialDays": 7,
      "subscribeUrl": "http://localhost:3000/pay/abc123/subscribe"
    }
  }
}
```

### Subscribe to a Link

```bash
# Create new subscription (with initial payment)
curl -X POST http://localhost:3000/pay/abc123/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "subscriberAddress": "SubscriberWalletAddress",
    "txHash": "TransactionHash..."
  }'
```

Response:
```json
{
  "success": true,
  "action": "created",
  "subscription": {
    "id": "sub_xyz789",
    "status": "active",
    "interval": "monthly",
    "currentPeriodStart": "2024-01-15T00:00:00.000Z",
    "currentPeriodEnd": "2024-02-15T00:00:00.000Z",
    "nextPaymentDue": "2024-02-15T00:00:00.000Z",
    "cycleCount": 1,
    "renewUrl": "http://localhost:3000/pay/abc123/subscribe"
  }
}
```

### Check Subscription Status

```bash
curl "http://localhost:3000/pay/abc123/subscription?subscriber=SubscriberWalletAddress"
```

Response:
```json
{
  "subscription": {
    "id": "sub_xyz789",
    "status": "active",
    "nextPaymentDue": "2024-02-15T00:00:00.000Z",
    "cycleCount": 1
  },
  "access": {
    "hasAccess": true,
    "requiresPayment": false
  }
}
```

### Subscription Flow

1. Create a subscription link with `subscription` config
2. User visits the link, gets 402 with subscription info
3. User pays and calls `/subscribe` with `subscriberAddress` and `txHash`
4. Server creates subscription, grants immediate access
5. Before `nextPaymentDue`, webhook `subscription.payment_due` is sent
6. User renews by calling `/subscribe` again with new `txHash`
7. If payment is late, `subscription.past_due` webhook is sent
8. After grace period, access is revoked until payment

### Subscription Intervals

| Interval | Description |
|----------|-------------|
| `daily` | Bill every N days |
| `weekly` | Bill every N weeks |
| `monthly` | Bill every N months |
| `yearly` | Bill every N years |

### Subscription Config Options

```javascript
{
  interval: 'monthly',
  
  // Number of intervals between billings (default: 1)
  // e.g., intervalCount: 2 with interval: 'weekly' = every 2 weeks
  intervalCount: 1,
  
  // Hours after due date before marking as past_due (default: 24)
  gracePeriodHours: 48,
  
  // Maximum billing cycles (undefined = unlimited)
  maxCycles: 12,
  
  // Free trial period in days (0 = no trial)
  trialDays: 7,
}
```

### Subscription Webhook Events

| Event | Description |
|-------|-------------|
| `subscription.created` | New subscription created |
| `subscription.renewed` | Subscription payment received |
| `subscription.cancelled` | Subscription cancelled |
| `subscription.paused` | Subscription paused |
| `subscription.resumed` | Subscription resumed |
| `subscription.past_due` | Payment is past grace period |
| `subscription.payment_due` | Payment is due (reminder) |
| `subscription.expired` | Subscription reached max cycles |

## Webhooks

Webhooks send real-time notifications for payment events.

### Configuration

```javascript
const server = createServer({
  chains: [...],
  webhook: {
    url: 'https://your-server.com/webhook',
    secret: 'your-hmac-secret', // Optional, for signature verification
    events: [
      'payment.confirmed',
      'payment.pending',
      'payment.failed',
      'payment.underpaid',
      'link.created',
      'link.disabled',
    ],
    timeout: 10000, // Request timeout in ms
    retries: 3,     // Retry count on failure
  },
});
```

### Webhook Payload

```json
{
  "event": "payment.confirmed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "eventId": "evt_abc123_xyz789",
  "data": {
    "type": "payment",
    "payment": {
      "id": "uuid",
      "payLinkId": "abc123",
      "chainId": 101,
      "txHash": "5xK8...",
      "fromAddress": "Sender...",
      "amount": "0.5",
      "confirmed": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "confirmedAt": "2024-01-15T10:30:00.000Z"
    },
    "payLink": {
      "id": "abc123",
      "targetUrl": "https://example.com/content",
      "price": {
        "amount": "0.5",
        "tokenSymbol": "SOL",
        "chainId": 101
      },
      "recipientAddress": "Recipient..."
    }
  }
}
```

### Webhook Headers

```
Content-Type: application/json
User-Agent: Paylink-Webhook/1.1.0
X-Paylink-Event: payment.confirmed
X-Paylink-Event-Id: evt_abc123_xyz789
X-Paylink-Timestamp: 2024-01-15T10:30:00.000Z
X-Paylink-Signature: <HMAC-SHA256 signature>
```

### Verifying Webhook Signatures

```javascript
const { verifyWebhookSignature } = require('@paylinkprotocol/paylink');

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-paylink-signature'];
  const body = req.body.toString();
  
  if (!verifyWebhookSignature(body, signature, 'your-hmac-secret')) {
    return res.status(401).send('Invalid signature');
  }
  
  const payload = JSON.parse(body);
  console.log('Received event:', payload.event);
  
  res.status(200).send('OK');
});
```

## Solana Chain IDs

| Chain ID | Network |
|----------|---------|
| 101 | Solana Mainnet |
| 102 | Solana Devnet |
| 103 | Solana Testnet |

## QR Code Payment URIs

### Solana (Solana Pay)
```
solana:<recipient>?amount=<amount>&label=Paylink%20Payment&message=Payment%20for%20<id>
```

### EVM (EIP-681)
```
ethereum:<recipient>@<chainId>?value=<weiAmount>
```

## Configuration Reference

```javascript
{
  // Server port
  port: 3000,
  
  // Public URL (for callbacks in 402 response)
  baseUrl: 'https://your-domain.com',
  
  // Path prefix for payment links
  basePath: '/pay',
  
  // API key for admin endpoints
  apiKey: 'your-secret-key',
  
  // Payment timeout in seconds
  paymentTimeout: 900,
  
  // Signature secret (optional)
  signatureSecret: 'secret-for-signing',
  
  // Enable CORS
  cors: true,
  
  // Blockchain networks
  chains: [
    {
      chainId: 1,
      name: 'Ethereum',
      symbol: 'ETH',
      rpcUrl: 'https://your-eth-node.com',
      confirmations: 3,
      type: 'evm', // optional, default
    },
    {
      chainId: 101,
      name: 'Solana',
      symbol: 'SOL',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      confirmations: 1,
      type: 'solana',
    },
  ],
  
  // Webhook configuration
  webhook: {
    url: 'https://your-server.com/webhook',
    secret: 'hmac-secret',
    events: ['payment.confirmed'],
    timeout: 10000,
    retries: 3,
  },
}
```

## Custom Storage

By default, links are stored in memory. For production, implement the `Storage` interface:

```javascript
const { createServer } = require('@paylinkprotocol/paylink');

class PostgresStorage {
  async getPayLink(id) { /* ... */ }
  async savePayLink(link) { /* ... */ }
  async updatePayLink(link) { /* ... */ }
  async deletePayLink(id) { /* ... */ }
  async getAllPayLinks() { /* ... */ }
  
  async savePayment(payment) { /* ... */ }
  async getPaymentByTxHash(txHash) { /* ... */ }
  async getConfirmedPayment(payLinkId) { /* ... */ }
  async getAllPayments() { /* ... */ }
}

const server = createServer({ chains: [...] });
server.setStorage(new PostgresStorage());
server.start();
```

## Testing with Mock Chains

For development, use mock chains:

```javascript
const server = createServer({
  chains: [
    {
      chainId: 1,
      name: 'Mock Ethereum',
      symbol: 'ETH',
      rpcUrl: 'mock', // Special value for mock mode
    },
    {
      chainId: 101,
      name: 'Mock Solana',
      symbol: 'SOL',
      rpcUrl: 'mock',
      type: 'solana',
    },
  ],
});
```

Mock chains auto-confirm all payments.

## CLI Reference

```
Usage:
  paylink [options]

Options:
  -p, --port <port>         Server port (default: 3000)
  -u, --url <url>           Base URL for callbacks
  -c, --chain <config>      Add EVM chain (chainId:name:symbol:rpcUrl)
  -s, --solana [url]        Add Solana mainnet
      --solana-devnet [url] Add Solana devnet
  -k, --api-key <key>       API key for admin endpoints
  -w, --webhook <url>       Webhook URL for notifications
      --webhook-secret <s>  Webhook HMAC secret
  -m, --mock                Use mock EVM chain for testing
      --mock-solana         Use mock Solana chain for testing
  -h, --help                Show help
```

## License

MIT
