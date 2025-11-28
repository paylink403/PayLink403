/**
 * Example: Self-hosted Paylink Server
 * 
 * Each user runs this with their own RPC nodes.
 * 
 * Run: node example.js
 */

const { createServer } = require('./dist/index.js');

// Create server with YOUR OWN configuration
const server = createServer({
  // Server settings
  port: 3000,
  baseUrl: 'https://your-domain.com', // Your domain
  apiKey: 'your-secret-api-key',      // Your API key
  
  // YOUR OWN blockchain nodes
  chains: [
    {
      chainId: 1,
      name: 'Ethereum',
      symbol: 'ETH',
      rpcUrl: process.env.ETH_RPC_URL || 'mock', // Your Alchemy/Infura/own node
      confirmations: 3,
    },
    {
      chainId: 137,
      name: 'Polygon',
      symbol: 'MATIC',
      rpcUrl: process.env.POLYGON_RPC_URL || 'mock',
      confirmations: 5,
    },
    {
      chainId: 56,
      name: 'BSC',
      symbol: 'BNB',
      rpcUrl: process.env.BSC_RPC_URL || 'mock',
      confirmations: 3,
    },
  ],
});

// Start the server
server.start();

// You can also create links programmatically
async function createExampleLink() {
  const link = await server.createPayLink({
    targetUrl: 'https://example.com/premium-content',
    price: {
      amount: '0.01',
      tokenSymbol: 'ETH',
      chainId: 1,
    },
    recipientAddress: '0xYourWalletAddress',
    description: 'Premium content access',
    maxUses: 100,
  });
  
  console.log('Created link:', link.id);
  console.log('URL:', `http://localhost:3000/pay/${link.id}`);
}

// Uncomment to create a test link on startup
// createExampleLink();
