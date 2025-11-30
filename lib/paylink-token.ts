/**
 * PAYLINK Token Integration
 * Native token support for Paylink Protocol
 * 
 * Token: PAYLINK
 * Mint: cMNjNj2NMaEniE37KvyV2GCyQJnbY8YDeANBhSMpump
 * Chain: Solana
 * Decimals: 6 (standard pump.fun token)
 */

import type { PaymentCheckResult } from './types.js';

/**
 * PAYLINK Token Constants
 */
export const PAYLINK_TOKEN = {
  /** Token mint address */
  MINT: 'cMNjNj2NMaEniE37KvyV2GCyQJnbY8YDeANBhSMpump',
  /** Token symbol */
  SYMBOL: 'PAYLINK',
  /** Token decimals (pump.fun standard) */
  DECIMALS: 6,
  /** Chain ID (Solana mainnet) */
  CHAIN_ID: 101,
} as const;

/**
 * Discount tiers based on PAYLINK holdings
 */
export interface DiscountTier {
  /** Minimum token balance required */
  minBalance: number;
  /** Discount percentage (0-100) */
  discountPercent: number;
  /** Tier name */
  name: string;
}

/**
 * Default discount tiers
 */
export const DEFAULT_DISCOUNT_TIERS: DiscountTier[] = [
  { minBalance: 1_000_000, discountPercent: 50, name: 'Diamond' },    // 1M tokens = 50% off
  { minBalance: 500_000, discountPercent: 30, name: 'Platinum' },     // 500K tokens = 30% off
  { minBalance: 100_000, discountPercent: 20, name: 'Gold' },         // 100K tokens = 20% off
  { minBalance: 10_000, discountPercent: 10, name: 'Silver' },        // 10K tokens = 10% off
  { minBalance: 1_000, discountPercent: 5, name: 'Bronze' },          // 1K tokens = 5% off
];

/**
 * PAYLINK configuration
 */
export interface PaylinkTokenConfig {
  /** Solana RPC URL */
  rpcUrl: string;
  /** Enable PAYLINK token payments */
  enableTokenPayments?: boolean;
  /** Discount when paying with PAYLINK (percentage, 0-100) */
  tokenPaymentDiscount?: number;
  /** Enable holder discounts */
  enableHolderDiscounts?: boolean;
  /** Custom discount tiers (optional) */
  discountTiers?: DiscountTier[];
  /** Request timeout in ms */
  timeout?: number;
}

interface TokenAccountInfo {
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
}

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

/**
 * PAYLINK Token Manager
 * Handles token balance checks, discounts, and SPL token payment verification
 */
export class PaylinkTokenManager {
  private config: Required<PaylinkTokenConfig>;
  private requestId = 0;

  constructor(config: PaylinkTokenConfig) {
    this.config = {
      rpcUrl: config.rpcUrl,
      enableTokenPayments: config.enableTokenPayments ?? true,
      tokenPaymentDiscount: config.tokenPaymentDiscount ?? 10,
      enableHolderDiscounts: config.enableHolderDiscounts ?? true,
      discountTiers: config.discountTiers ?? DEFAULT_DISCOUNT_TIERS,
      timeout: config.timeout ?? 30000,
    };
  }

  /**
   * Get PAYLINK token balance for a wallet
   */
  async getTokenBalance(walletAddress: string): Promise<number> {
    try {
      const tokenAccounts = await this.getTokenAccountsByOwner(walletAddress);
      
      const paylinkAccount = tokenAccounts.find(
        acc => acc.mint === PAYLINK_TOKEN.MINT
      );

      if (!paylinkAccount) {
        return 0;
      }

      // Convert from raw amount to token amount
      return Number(paylinkAccount.amount) / Math.pow(10, PAYLINK_TOKEN.DECIMALS);
    } catch (error) {
      console.error('Error fetching PAYLINK balance:', error);
      return 0;
    }
  }

  /**
   * Get discount tier for a wallet based on PAYLINK holdings
   */
  async getDiscountTier(walletAddress: string): Promise<DiscountTier | null> {
    if (!this.config.enableHolderDiscounts) {
      return null;
    }

    const balance = await this.getTokenBalance(walletAddress);
    
    // Sort tiers by minBalance descending to find highest qualifying tier
    const sortedTiers = [...this.config.discountTiers].sort(
      (a, b) => b.minBalance - a.minBalance
    );

    for (const tier of sortedTiers) {
      if (balance >= tier.minBalance) {
        return tier;
      }
    }

    return null;
  }

  /**
   * Calculate discounted price based on holder tier
   */
  async calculateDiscountedPrice(
    walletAddress: string,
    originalPrice: number
  ): Promise<{ price: number; discount: number; tier: DiscountTier | null }> {
    const tier = await this.getDiscountTier(walletAddress);
    
    if (!tier) {
      return { price: originalPrice, discount: 0, tier: null };
    }

    const discount = (originalPrice * tier.discountPercent) / 100;
    const price = originalPrice - discount;

    return { price, discount, tier };
  }

  /**
   * Get price when paying with PAYLINK token
   */
  getTokenPaymentPrice(originalPrice: number): number {
    if (!this.config.enableTokenPayments) {
      return originalPrice;
    }

    const discount = (originalPrice * this.config.tokenPaymentDiscount) / 100;
    return originalPrice - discount;
  }

  /**
   * Verify PAYLINK token payment
   */
  async verifyTokenPayment(params: {
    txHash: string;
    recipient: string;
    amount: string;
  }): Promise<PaymentCheckResult> {
    try {
      const tx = await this.getTransaction(params.txHash);

      if (!tx) {
        return { status: 'not_found' };
      }

      if (tx.meta?.err) {
        return { status: 'failed' };
      }

      // Parse SPL token transfer
      const transfer = this.parseTokenTransfer(tx, params.recipient);

      if (!transfer) {
        return { status: 'not_found' };
      }

      // Verify it's PAYLINK token
      if (transfer.mint !== PAYLINK_TOKEN.MINT) {
        return { status: 'not_found' };
      }

      // Convert amount to token units
      const actualAmount = transfer.amount / Math.pow(10, PAYLINK_TOKEN.DECIMALS);
      const requiredAmount = parseFloat(params.amount);

      if (actualAmount < requiredAmount) {
        return {
          status: 'underpaid',
          actualAmount: actualAmount.toString(),
          fromAddress: transfer.from,
        };
      }

      return {
        status: 'confirmed',
        actualAmount: actualAmount.toString(),
        fromAddress: transfer.from,
        raw: tx,
      };
    } catch (error) {
      console.error('PAYLINK payment verification error:', error);
      return { status: 'not_found' };
    }
  }

  /**
   * Parse SPL token transfer from transaction
   */
  private parseTokenTransfer(
    tx: any,
    expectedRecipient: string
  ): { mint: string; from: string; to: string; amount: number } | null {
    try {
      // Look for token balance changes in postTokenBalances
      const preBalances = tx.meta?.preTokenBalances || [];
      const postBalances = tx.meta?.postTokenBalances || [];

      // Find PAYLINK transfers to recipient
      for (const post of postBalances) {
        if (post.mint !== PAYLINK_TOKEN.MINT) continue;

        const pre = preBalances.find(
          (p: any) => p.accountIndex === post.accountIndex
        );

        const preAmount = pre ? Number(pre.uiTokenAmount?.amount || 0) : 0;
        const postAmount = Number(post.uiTokenAmount?.amount || 0);
        const diff = postAmount - preAmount;

        if (diff > 0) {
          // This account received tokens
          const owner = post.owner;
          
          if (owner?.toLowerCase() === expectedRecipient.toLowerCase()) {
            // Find sender (account with negative diff)
            let sender = '';
            for (const otherPost of postBalances) {
              if (otherPost.mint !== PAYLINK_TOKEN.MINT) continue;
              const otherPre = preBalances.find(
                (p: any) => p.accountIndex === otherPost.accountIndex
              );
              const otherPreAmount = otherPre ? Number(otherPre.uiTokenAmount?.amount || 0) : 0;
              const otherPostAmount = Number(otherPost.uiTokenAmount?.amount || 0);
              if (otherPostAmount - otherPreAmount < 0) {
                sender = otherPost.owner || '';
                break;
              }
            }

            return {
              mint: PAYLINK_TOKEN.MINT,
              from: sender,
              to: owner,
              amount: diff,
            };
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get token accounts for a wallet
   */
  private async getTokenAccountsByOwner(owner: string): Promise<TokenAccountInfo[]> {
    const result = await this.rpc<{
      value: Array<{
        account: {
          data: {
            parsed: {
              info: TokenAccountInfo;
            };
          };
        };
      }>;
    }>('getTokenAccountsByOwner', [
      owner,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed' },
    ]);

    if (!result?.value) {
      return [];
    }

    return result.value.map(item => item.account.data.parsed.info);
  }

  /**
   * Get transaction details
   */
  private async getTransaction(signature: string): Promise<any> {
    return this.rpc('getTransaction', [
      signature,
      {
        encoding: 'jsonParsed',
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      },
    ]);
  }

  /**
   * Make RPC call
   */
  private async rpc<T>(method: string, params: unknown[]): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

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

      const data = (await response.json()) as JsonRpcResponse<T>;

      if (data.error) {
        console.error('RPC error:', data.error);
        return null;
      }

      return data.result ?? null;
    } catch (error) {
      console.error('RPC request failed:', error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Create a PAYLINK token manager
 */
export function createPaylinkTokenManager(config: PaylinkTokenConfig): PaylinkTokenManager {
  return new PaylinkTokenManager(config);
}

/**
 * Check if a token symbol is PAYLINK
 */
export function isPaylinkToken(symbol: string): boolean {
  return symbol.toUpperCase() === PAYLINK_TOKEN.SYMBOL;
}

/**
 * Format PAYLINK amount for display
 */
export function formatPaylinkAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`;
  }
  return amount.toFixed(2);
}
