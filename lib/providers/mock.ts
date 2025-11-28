import type { PaymentProvider, PaymentStatusResult } from '../types.js';
import { compareAmounts } from '../utils.js';

export interface MockPaymentConfig {
  /** Default status to return */
  defaultStatus?: 'confirmed' | 'pending' | 'failed';
  /** Simulate network delay in ms */
  simulateDelay?: number;
  /** Simulate underpaid by this percentage (0-100) */
  underpaidPercent?: number;
}

/**
 * Mock payment provider for development and testing
 */
export class MockPaymentProvider implements PaymentProvider {
  private config: MockPaymentConfig;
  private confirmedTxHashes: Set<string> = new Set();
  private pendingTxHashes: Set<string> = new Set();
  private failedTxHashes: Set<string> = new Set();

  constructor(config: MockPaymentConfig = {}) {
    this.config = {
      defaultStatus: config.defaultStatus ?? 'confirmed',
      simulateDelay: config.simulateDelay ?? 100,
      underpaidPercent: config.underpaidPercent ?? 0,
    };
  }

  /**
   * Manually mark a transaction as confirmed
   */
  markConfirmed(txHash: string): void {
    this.confirmedTxHashes.add(txHash);
    this.pendingTxHashes.delete(txHash);
    this.failedTxHashes.delete(txHash);
  }

  /**
   * Manually mark a transaction as pending
   */
  markPending(txHash: string): void {
    this.pendingTxHashes.add(txHash);
    this.confirmedTxHashes.delete(txHash);
    this.failedTxHashes.delete(txHash);
  }

  /**
   * Manually mark a transaction as failed
   */
  markFailed(txHash: string): void {
    this.failedTxHashes.add(txHash);
    this.confirmedTxHashes.delete(txHash);
    this.pendingTxHashes.delete(txHash);
  }

  /**
   * Reset all marked transactions
   */
  reset(): void {
    this.confirmedTxHashes.clear();
    this.pendingTxHashes.clear();
    this.failedTxHashes.clear();
  }

  async getPaymentStatus(params: {
    chainId: number;
    recipient: string;
    amount: string;
    txHash?: string;
  }): Promise<PaymentStatusResult> {
    // Simulate network delay
    if (this.config.simulateDelay) {
      await new Promise(resolve => setTimeout(resolve, this.config.simulateDelay));
    }

    if (!params.txHash) {
      return { status: 'not_found' };
    }

    // Check manually marked statuses first
    if (this.failedTxHashes.has(params.txHash)) {
      return { status: 'failed' };
    }

    if (this.pendingTxHashes.has(params.txHash)) {
      return { status: 'pending' };
    }

    if (this.confirmedTxHashes.has(params.txHash)) {
      return this.createConfirmedResult(params);
    }

    // Use default status
    switch (this.config.defaultStatus) {
      case 'pending':
        return { status: 'pending' };
      case 'failed':
        return { status: 'failed' };
      case 'confirmed':
      default:
        return this.createConfirmedResult(params);
    }
  }

  private createConfirmedResult(params: {
    amount: string;
    recipient: string;
  }): PaymentStatusResult {
    let actualAmount = params.amount;

    // Simulate underpayment
    if (this.config.underpaidPercent && this.config.underpaidPercent > 0) {
      const original = parseFloat(params.amount);
      const reduced = original * (1 - this.config.underpaidPercent / 100);
      actualAmount = reduced.toString();
    }

    const status = compareAmounts(actualAmount, params.amount) < 0 
      ? 'underpaid' 
      : 'confirmed';

    return {
      status,
      actualAmount,
      fromAddress: '0x' + 'a'.repeat(40), // Mock sender address
      raw: {
        mock: true,
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * Create a mock payment provider
 */
export function createMockProvider(config?: MockPaymentConfig): MockPaymentProvider {
  return new MockPaymentProvider(config);
}
