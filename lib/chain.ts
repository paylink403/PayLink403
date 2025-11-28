import type { ChainConfig, PaymentCheckResult } from './types.js';
import { compareAmounts } from './utils.js';

/**
 * Blockchain payment verifier
 */
export class ChainVerifier {
  private config: ChainConfig;
  private requestId = 0;

  constructor(config: ChainConfig) {
    this.config = config;
  }

  get chainId(): number {
    return this.config.chainId;
  }

  /**
   * Verify payment on chain
   */
  async verifyPayment(params: {
    txHash: string;
    recipient: string;
    amount: string;
  }): Promise<PaymentCheckResult> {
    try {
      // Get transaction
      const tx = await this.rpc('eth_getTransactionByHash', [params.txHash]);
      
      if (!tx) {
        return { status: 'not_found' };
      }

      // Not mined yet
      if (!tx.blockNumber) {
        return { status: 'pending' };
      }

      // Get receipt
      const receipt = await this.rpc('eth_getTransactionReceipt', [params.txHash]);
      
      if (!receipt) {
        return { status: 'pending' };
      }

      // Failed transaction
      if (receipt.status === '0x0') {
        return { status: 'failed' };
      }

      // Check confirmations
      const currentBlock = await this.rpc('eth_blockNumber', []);
      const txBlock = parseInt(tx.blockNumber, 16);
      const current = parseInt(currentBlock, 16);
      const confirmations = current - txBlock;

      if (confirmations < (this.config.confirmations ?? 1)) {
        return { status: 'pending' };
      }

      // Verify recipient
      const recipientLower = params.recipient.toLowerCase();
      const toAddress = (tx.to || '').toLowerCase();
      
      if (toAddress !== recipientLower) {
        // Check if it's a token transfer
        if (!this.isTokenTransfer(receipt, recipientLower)) {
          return { status: 'not_found' };
        }
      }

      // Calculate amount
      const valueWei = BigInt(tx.value || '0');
      const actualAmount = this.weiToEther(valueWei);

      // Check amount
      if (compareAmounts(actualAmount, params.amount) < 0) {
        return {
          status: 'underpaid',
          actualAmount,
          fromAddress: tx.from,
        };
      }

      return {
        status: 'confirmed',
        actualAmount,
        fromAddress: tx.from,
        raw: { tx, receipt },
      };
    } catch (error) {
      console.error(`Chain ${this.config.chainId} verification error:`, error);
      return { status: 'not_found' };
    }
  }

  private async rpc(method: string, params: unknown[]): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(this.config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++this.requestId,
          method,
          params,
        }),
        signal: controller.signal,
      });

      const data = await response.json() as { error?: { message: string }; result?: unknown };
      
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      return data.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  private isTokenTransfer(receipt: any, recipient: string): boolean {
    // ERC20 Transfer event signature
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    
    for (const log of receipt.logs || []) {
      if (log.topics?.[0] === transferTopic && log.topics.length >= 3) {
        const to = '0x' + log.topics[2].slice(26).toLowerCase();
        if (to === recipient) {
          return true;
        }
      }
    }
    
    return false;
  }

  private weiToEther(wei: bigint): string {
    return (Number(wei) / 1e18).toString();
  }
}

/**
 * Mock verifier for development/testing
 */
export class MockVerifier {
  private confirmed = new Set<string>();
  private pending = new Set<string>();
  private failed = new Set<string>();

  chainId = 1;

  markConfirmed(txHash: string): void {
    this.confirmed.add(txHash);
    this.pending.delete(txHash);
    this.failed.delete(txHash);
  }

  markPending(txHash: string): void {
    this.pending.add(txHash);
  }

  markFailed(txHash: string): void {
    this.failed.add(txHash);
  }

  async verifyPayment(params: {
    txHash: string;
    recipient: string;
    amount: string;
  }): Promise<PaymentCheckResult> {
    await new Promise(r => setTimeout(r, 100));

    if (this.failed.has(params.txHash)) {
      return { status: 'failed' };
    }

    if (this.pending.has(params.txHash)) {
      return { status: 'pending' };
    }

    // Auto-confirm for testing
    return {
      status: 'confirmed',
      actualAmount: params.amount,
      fromAddress: '0x' + 'a'.repeat(40),
    };
  }
}
