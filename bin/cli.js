#!/usr/bin/env node

/**
 * Paylink CLI
 * Quick way to start a paylink server
 * 
 * Usage:
 *   npx paylink --port 3000 --chain 1:https://eth-rpc.example.com
 */

const { createServer } = require('../dist/index.js');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    port: 3000,
    baseUrl: '',
    chains: [],
    apiKey: '',
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

      case '--api-key':
      case '-k':
        config.apiKey = next;
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

      case '--help':
      case '-h':
        console.log(`
Paylink Protocol Server

Usage:
  paylink [options]

Options:
  -p, --port <port>      Server port (default: 3000)
  -u, --url <url>        Base URL for callbacks
  -c, --chain <config>   Add chain (format: chainId:rpcUrl or chainId:name:symbol:rpcUrl)
  -k, --api-key <key>    API key for admin endpoints
  -m, --mock             Use mock chain for testing
  -h, --help             Show this help

Examples:
  # Start with mock chain for testing
  paylink --mock --api-key secret123

  # Start with Ethereum mainnet
  paylink -c 1:Ethereum:ETH:https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

  # Multiple chains
  paylink -c 1:https://eth-rpc.com -c 137:https://polygon-rpc.com
`);
        process.exit(0);
    }
  }

  // Default to mock if no chains
  if (config.chains.length === 0) {
    console.log('No chains configured, using mock chain for testing');
    config.chains.push({
      chainId: 1,
      name: 'Mock Ethereum',
      symbol: 'ETH',
      rpcUrl: 'mock',
    });
  }

  return config;
}

const config = parseArgs();
const server = createServer(config);
server.start();
