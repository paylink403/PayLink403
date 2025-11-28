# @paylinkprotocol/paylink

Self-hosted paid links with 402/403 protocol and blockchain payment verification.

**Each user runs their own server with their own RPC nodes.**

## Features

- 🔗 Create paid links with automatic payment verification
- ⛓️ Multi-chain support (any EVM chain)
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
# Start with mock chain (for testing)
npx paylink --mock --api-key your-secret-key

# Start with real Ethereum node
npx paylink \
  --chain 1:Ethereum:ETH:https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
  --api-key your-secret-key \
  --port 3000

# Multiple chains
npx paylink \
  --chain 1:Ethereum:ETH:https://eth-rpc.com \
  --chain 137:Polygon:MATIC:https://polygon-rpc.com \
  --api-key secret
```

### Using Code

```javascript
const { createServer } = require('@paylinkprotocol/paylink');

const server = createServer({
  port: 3000,
  baseUrl: 'https://your-domain.com',
  apiKey: 'your-secret-api-key',
  
  // Your own RPC nodes
  chains: [
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
  ],
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

### Admin Endpoints (require X-API-Key header)

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/links` | Create payment link |
| GET | `/api/links` | List all links |
| GET | `/api/links/:id` | Get link details |
| DELETE | `/api/links/:id` | Disable link |
| GET | `/api/payments` | List all payments |

## Usage Example

### Create a Payment Link

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

### User Flow

1. User visits `http://localhost:3000/pay/abc123`
2. Server returns `402 Payment Required` with payment details
3. User pays to the specified address
4. User/frontend calls `POST /pay/abc123/confirm` with `{ txHash: "0x..." }`
5. Server verifies payment on-chain
6. Next visit to the link returns `302 Redirect` to target URL

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
  "callbacks": {
    "status": "http://localhost:3000/pay/abc123/status",
    "confirm": "http://localhost:3000/pay/abc123/confirm"
  },
  "nonce": "random-string"
}
```

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

## Configuration

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
    }
  ]
}
```

## Custom Storage

By default, links are stored in memory. For production, implement the `Storage` interface:

```javascript
const { createServer, MemoryStorage } = require('@paylinkprotocol/paylink');

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

## Testing with Mock Chain

For development, use the mock chain:

```javascript
const server = createServer({
  chains: [
    {
      chainId: 1,
      name: 'Mock Ethereum',
      symbol: 'ETH',
      rpcUrl: 'mock', // Special value for mock mode
    }
  ]
});
```

Mock chain auto-confirms all payments.