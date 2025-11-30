import type { PaymentCheckResult } from '../types.js';
import { compareAmounts } from '../utils.js';

/**
 * Solana chain configuration
 */
export interface SolanaConfig {
  /** RPC URL (e.g., https://api.mainnet-beta.solana.com) */
  rpcUrl: string;
  /** Number of confirmations required (default: 1) */
  confirmations?: number;
  /** Request timeout in ms (default: 30000) */
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

interface SolanaTransaction {
  slot: number;
  meta: {
    err: null | object;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    status: { Ok: null } | { Err: object };
  } | null;
  transaction: {
    message: {
      accountKeys: string[];
      instructions: Array<{
        programIdIndex: number;
        accounts: number[];
        data: string;
      }>;
    };
    signatures: string[];
  };
  blockTime: number | null;
}

interface SignatureStatus {
  slot: number;
  confirmations: number | null;
  err: null | object;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized' | null;
}

/**
 * Solana Payment Verifier
 * Verifies native SOL transfers on Solana blockchain
 */
export class SolanaVerifier {
  private config: Required<SolanaConfig>;
  private requestId = 0;

  constructor(config: SolanaConfig) {
    this.config = {
      rpcUrl: config.rpcUrl,
      confirmations: config.confirmations ?? 1,
      timeout: config.timeout ?? 30000,
    };
  }

  /**
   * Verify a Solana payment
   */
  async verifyPayment(params: {
    txHash: string;
    recipient: string;
    amount: string;
  }): Promise<PaymentCheckResult> {
    try {
      // Get transaction details
      const tx = await this.getTransaction(params.txHash);

      if (!tx) {
        return { status: 'not_found' };
      }

      // Check if transaction failed
      if (tx.meta?.err) {
        return { status: 'failed' };
      }

      // Get signature status for confirmation count
      const status = await this.getSignatureStatus(params.txHash);

      if (!status) {
        return { status: 'pending' };
      }

      // Check confirmations
      const confirmations = status.confirmations ?? 0;
      const isFinalized = status.confirmationStatus === 'finalized';

      if (!isFinalized && confirmations < this.config.confirmations) {
        return { status: 'pending' };
      }

      // Parse transaction to find recipient and amount
      const { recipient: actualRecipient, amount: actualAmount, sender } = 
        this.parseTransfer(tx, params.recipient);

      if (!actualRecipient) {
        return { status: 'not_found' };
      }

      // Verify recipient matches
      if (actualRecipient.toLowerCase() !== params.recipient.toLowerCase()) {
        return { status: 'not_found' };
      }

      // Compare amounts (SOL has 9 decimals)
      if (compareAmounts(actualAmount, params.amount) < 0) {
        return {
          status: 'underpaid',
          actualAmount,
          fromAddress: sender,
          raw: tx,
        };
      }

      return {
        status: 'confirmed',
        actualAmount,
        fromAddress: sender,
        raw: tx,
      };
    } catch (error) {
      console.error('Solana verification error:', error);
      return { status: 'not_found' };
    }
  }

  /**
   * Parse a Solana transaction to extract transfer details
   */
  private parseTransfer(
    tx: SolanaTransaction,
    expectedRecipient: string
  ): { recipient: string | null; amount: string; sender: string } {
    const accountKeys = tx.transaction.message.accountKeys;
    const preBalances = tx.meta?.preBalances ?? [];
    const postBalances = tx.meta?.postBalances ?? [];

    // Find the expected recipient in account keys
    const recipientIndex = accountKeys.findIndex(
      key => key.toLowerCase() === expectedRecipient.toLowerCase()
    );

    if (recipientIndex === -1) {
      return { recipient: null, amount: '0', sender: '' };
    }

    // Calculate amount received (in lamports)
    const preBalance = preBalances[recipientIndex] ?? 0;
    const postBalance = postBalances[recipientIndex] ?? 0;
    const lamportsReceived = postBalance - preBalance;

    if (lamportsReceived <= 0) {
      return { recipient: null, amount: '0', sender: '' };
    }

    // Convert lamports to SOL (9 decimals)
    const solAmount = lamportsReceived / 1e9;

    // First account is typically the fee payer/sender
    const sender = accountKeys[0] ?? '';

    return {
      recipient: expectedRecipient,
      amount: solAmount.toString(),
      sender,
    };
  }

  /**
   * Get transaction details from Solana RPC
   */
  private async getTransaction(signature: string): Promise<SolanaTransaction | null> {
    return this.rpc<SolanaTransaction>('getTransaction', [
      signature,
      {
        encoding: 'json',
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      },
    ]);
  }

  /**
   * Get signature status
   */
  private async getSignatureStatus(signature: string): Promise<SignatureStatus | null> {
    const result = await this.rpc<{ value: Array<SignatureStatus | null> }>(
      'getSignatureStatuses',
      [[signature]]
    );
    return result?.value?.[0] ?? null;
  }

  /**
   * Make an RPC call to Solana
   */
  private async rpc<T>(method: string, params: unknown[]): Promise<T | null> {
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

      const data = (await response.json()) as JsonRpcResponse<T>;

      if (data.error) {
        console.error('Solana RPC error:', data.error);
        return null;
      }

      return data.result ?? null;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.error('Solana RPC request timeout');
      } else {
        console.error('Solana RPC error:', error);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Mock Solana verifier for testing
 */
export class MockSolanaVerifier {
  private confirmed = new Set<string>();
  private pending = new Set<string>();
  private failed = new Set<string>();

  markConfirmed(signature: string): void {
    this.confirmed.add(signature);
    this.pending.delete(signature);
    this.failed.delete(signature);
  }

  markPending(signature: string): void {
    this.pending.add(signature);
  }

  markFailed(signature: string): void {
    this.failed.add(signature);
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
      fromAddress: 'So11111111111111111111111111111111111111112',
    };
  }
}

/**
 * Create a Solana verifier
 */
export function createSolanaVerifier(config: SolanaConfig): SolanaVerifier {
  return new SolanaVerifier(config);
}
