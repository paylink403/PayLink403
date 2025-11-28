import type { PaymentProvider, PaymentStatusResult } from '../types.js';
import { compareAmounts } from '../utils.js';

export interface EVMProviderConfig {
  /** RPC URL for the chain */
  rpcUrl: string;
  /** Chain ID */
  chainId: number;
  /** Number of confirmations required */
  confirmations?: number;
  /** Request timeout in ms */
  timeout?: number;
}

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

interface TransactionReceipt {
  transactionHash: string;
  blockNumber: string;
  from: string;
  to: string;
  status: string;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string | null;
}

/**
 * EVM-compatible payment provider
 * Works with Ethereum, Polygon, BSC, Arbitrum, etc.
 */
export class EVMPaymentProvider implements PaymentProvider {
  private config: Required<EVMProviderConfig>;
  private requestId = 0;

  constructor(config: EVMProviderConfig) {
    this.config = {
      rpcUrl: config.rpcUrl,
      chainId: config.chainId,
      confirmations: config.confirmations ?? 1,
      timeout: config.timeout ?? 30000,
    };
  }

  async getPaymentStatus(params: {
    chainId: number;
    recipient: string;
    amount: string;
    txHash?: string;
  }): Promise<PaymentStatusResult> {
    if (!params.txHash) {
      return { status: 'not_found' };
    }

    if (params.chainId !== this.config.chainId) {
      return { status: 'not_found' };
    }

    try {
      // Get transaction
      const tx = await this.getTransaction(params.txHash);
      
      if (!tx) {
        return { status: 'not_found' };
      }

      // Transaction found but not mined yet
      if (!tx.blockNumber) {
        return { status: 'pending' };
      }

      // Get transaction receipt for status
      const receipt = await this.getTransactionReceipt(params.txHash);
      
      if (!receipt) {
        return { status: 'pending' };
      }

      // Check if transaction failed
      if (receipt.status === '0x0') {
        return { status: 'failed' };
      }

      // Check confirmations
      const currentBlock = await this.getBlockNumber();
      const txBlock = parseInt(tx.blockNumber, 16);
      const confirmations = currentBlock - txBlock;

      if (confirmations < this.config.confirmations) {
        return { status: 'pending' };
      }

      // Verify recipient
      const recipientLower = params.recipient.toLowerCase();
      if (receipt.to.toLowerCase() !== recipientLower) {
        // Check if it's a token transfer (look in logs)
        const isTokenTransfer = this.checkTokenTransfer(receipt, recipientLower);
        if (!isTokenTransfer) {
          return { status: 'not_found' };
        }
      }

      // Convert value from wei to ether
      const valueWei = BigInt(tx.value);
      const actualAmount = this.weiToEther(valueWei);

      // Compare amounts
      if (compareAmounts(actualAmount, params.amount) < 0) {
        return {
          status: 'underpaid',
          actualAmount,
          fromAddress: tx.from,
          raw: { tx, receipt },
        };
      }

      return {
        status: 'confirmed',
        actualAmount,
        fromAddress: tx.from,
        raw: { tx, receipt },
      };
    } catch (error) {
      console.error('EVM payment check error:', error);
      return { status: 'not_found' };
    }
  }

  private async rpcCall<T>(method: string, params: unknown[]): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++this.requestId,
          method,
          params,
        }),
        signal: controller.signal,
      });

      const data = await response.json() as JsonRpcResponse<T>;

      if (data.error) {
        console.error('RPC error:', data.error);
        return null;
      }

      return data.result ?? null;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.error('RPC request timeout');
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getTransaction(txHash: string): Promise<Transaction | null> {
    return this.rpcCall<Transaction>('eth_getTransactionByHash', [txHash]);
  }

  private async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    return this.rpcCall<TransactionReceipt>('eth_getTransactionReceipt', [txHash]);
  }

  private async getBlockNumber(): Promise<number> {
    const result = await this.rpcCall<string>('eth_blockNumber', []);
    return result ? parseInt(result, 16) : 0;
  }

  private checkTokenTransfer(receipt: TransactionReceipt, recipient: string): boolean {
    // ERC20 Transfer event topic
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    
    for (const log of receipt.logs) {
      if (log.topics[0] === transferTopic && log.topics.length >= 3) {
        // Topic 2 is the "to" address (padded)
        const toAddress = '0x' + log.topics[2].slice(26).toLowerCase();
        if (toAddress === recipient) {
          return true;
        }
      }
    }
    
    return false;
  }

  private weiToEther(wei: bigint): string {
    const ether = Number(wei) / 1e18;
    return ether.toString();
  }
}

/**
 * Create an EVM payment provider
 */
export function createEVMProvider(config: EVMProviderConfig): EVMPaymentProvider {
  return new EVMPaymentProvider(config);
}
