#!/usr/bin/env node

/**
 * Paylink CLI v1.1.0
 * Quick way to start a paylink server
 * 
 * Usage:
 *   npx paylink --port 3000 --chain 1:https://eth-rpc.example.com
 *   npx paylink --solana https://api.mainnet-beta.solana.com
 *   npx paylink --webhook https://your-server.com/webhook
 */

const { createServer } = require('../dist/index.js');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    port: 3000,
    baseUrl: '',
    chains: [],
    apiKey: '',
    webhook: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--port':
      case '-p':
        config.port = parseInt(next, 10);
        i++;
        break;

      case '--url':
      case '-u':
        config.baseUrl = next;
        i++;
        break;

      case '--chain':
      case '-c':
        // Format: chainId:rpcUrl or chainId:name:symbol:rpcUrl
        const parts = next.split(':');
        if (parts.length === 2) {
          config.chains.push({
            chainId: parseInt(parts[0], 10),
            name: `Chain ${parts[0]}`,
            symbol: 'ETH',
            rpcUrl: parts[1],
          });
        } else if (parts.length >= 4) {
          config.chains.push({
            chainId: parseInt(parts[0], 10),
            name: parts[1],
            symbol: parts[2],
            rpcUrl: parts.slice(3).join(':'),
          });
        }
        i++;
        break;

      case '--solana':
      case '-s':
        // Solana mainnet
        config.chains.push({
          chainId: 101,
          name: 'Solana',
          symbol: 'SOL',
          rpcUrl: next || 'https://api.mainnet-beta.solana.com',
          type: 'solana',
        });
        if (next && !next.startsWith('-')) i++;
        break;

      case '--solana-devnet':
        config.chains.push({
          chainId: 102,
          name: 'Solana Devnet',
          symbol: 'SOL',
          rpcUrl: next || 'https://api.devnet.solana.com',
          type: 'solana',
        });
        if (next && !next.startsWith('-')) i++;
        break;

      case '--api-key':
      case '-k':
        config.apiKey = next;
        i++;
        break;

      case '--webhook':
      case '-w':
        config.webhook = { url: next };
        i++;
        break;

      case '--webhook-secret':
        if (config.webhook) {
          config.webhook.secret = next;
        }
        i++;
        break;

      case '--mock':
      case '-m':
        config.chains.push({
          chainId: 1,
          name: 'Mock Ethereum',
          symbol: 'ETH',
          rpcUrl: 'mock',
        });
        break;

      case '--mock-solana':
        config.chains.push({
          chainId: 101,
          name: 'Mock Solana',
          symbol: 'SOL',
          rpcUrl: 'mock',
          type: 'solana',
        });
        break;

      case '--help':
      case '-h':
        console.log(`
Paylink Protocol Server v1.1.0

Usage:
  paylink [options]

Options:
  -p, --port <port>         Server port (default: 3000)
  -u, --url <url>           Base URL for callbacks
  -c, --chain <config>      Add EVM chain (format: chainId:rpcUrl or chainId:name:symbol:rpcUrl)
  -s, --solana [url]        Add Solana mainnet (default: https://api.mainnet-beta.solana.com)
      --solana-devnet [url] Add Solana devnet
  -k, --api-key <key>       API key for admin endpoints
  -w, --webhook <url>       Webhook URL for notifications
      --webhook-secret <s>  Webhook HMAC secret
  -m, --mock                Use mock EVM chain for testing
      --mock-solana         Use mock Solana chain for testing
  -h, --help                Show this help

Examples:
  # Start with mock chains for testing
  paylink --mock --mock-solana --api-key secret123

  # Start with Ethereum mainnet
  paylink -c 1:Ethereum:ETH:https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

  # Start with Solana mainnet
  paylink --solana https://api.mainnet-beta.solana.com --api-key secret

  # Multiple chains with webhook
  paylink -c 1:https://eth-rpc.com --solana -w https://your-server.com/webhook

  # Full production setup
  paylink \\
    -c 1:Ethereum:ETH:https://eth-rpc.com \\
    --solana https://solana-rpc.com \\
    -k your-api-key \\
    -w https://your-server.com/webhook \\
    --webhook-secret your-hmac-secret
`);
        process.exit(0);
    }
  }

  // Default to mock if no chains
  if (config.chains.length === 0) {
    console.log('No chains configured, using mock chains for testing');
    config.chains.push({
      chainId: 1,
      name: 'Mock Ethereum',
      symbol: 'ETH',
      rpcUrl: 'mock',
    });
    config.chains.push({
      chainId: 101,
      name: 'Mock Solana',
      symbol: 'SOL',
      rpcUrl: 'mock',
      type: 'solana',
    });
  }

  return config;
}

const config = parseArgs();
const server = createServer(config);
server.start();
