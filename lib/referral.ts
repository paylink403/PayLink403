/**
 * Referral System
 * Viral growth through referral rewards
 * 
 * Features:
 * - Generate unique referral codes
 * - Track referrals per link
 * - Calculate and track commissions
 * - Support for commission payouts
 */

import type {
  Referral,
  ReferralCommission,
  ReferralConfig,
  ReferralStats,
  ReferralStatus,
  CreateReferralInput,
  PayLink,
  Payment,
  Storage,
} from './types.js';
import { generateId } from './utils.js';

/**
 * Default referral configuration
 */
export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  enabled: true,
  commissionPercent: 10,
  minPayoutThreshold: undefined,
  expirationDays: undefined,
};

/**
 * Generate a unique referral code
 * Format: 6-8 alphanumeric characters, URL-safe
 */
export function generateReferralCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (0, O, 1, I)
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate referral code format
 */
export function isValidReferralCode(code: string): boolean {
  return /^[A-Z0-9]{4,16}$/i.test(code);
}

/**
 * Calculate commission amount
 */
export function calculateCommission(
  paymentAmount: string,
  commissionPercent: number
): string {
  const amount = parseFloat(paymentAmount);
  const commission = (amount * commissionPercent) / 100;
  // Round to 8 decimal places for crypto precision
  return commission.toFixed(8).replace(/\.?0+$/, '');
}

/**
 * Check if commission has expired
 */
export function isCommissionExpired(
  createdAt: Date,
  expirationDays?: number
): boolean {
  if (!expirationDays) return false;
  
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + expirationDays);
  
  return new Date() > expiresAt;
}

/**
 * Referral Manager
 * Handles referral creation, tracking, and commission calculations
 */
export class ReferralManager {
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  /**
   * Create a new referral
   */
  async createReferral(input: CreateReferralInput): Promise<Referral> {
    const payLink = await this.storage.getPayLink(input.payLinkId);
    
    if (!payLink) {
      throw new Error('PayLink not found');
    }

    if (!payLink.referral?.enabled) {
      throw new Error('Referral program is not enabled for this link');
    }

    // Check if referrer already has a referral for this link
    const existingReferrals = await this.storage.getReferralsByPayLink(input.payLinkId);
    const existing = existingReferrals.find(
      r => r.referrerAddress.toLowerCase() === input.referrerAddress.toLowerCase()
    );

    if (existing) {
      throw new Error('Referral already exists for this address');
    }

    // Generate or validate code
    let code = input.code;
    if (code) {
      if (!isValidReferralCode(code)) {
        throw new Error('Invalid referral code format');
      }
      // Check if code already exists
      const existingCode = await this.storage.getReferralByCode(code);
      if (existingCode) {
        throw new Error('Referral code already in use');
      }
    } else {
      // Generate unique code
      let attempts = 0;
      do {
        code = generateReferralCode();
        const existingCode = await this.storage.getReferralByCode(code);
        if (!existingCode) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        throw new Error('Failed to generate unique referral code');
      }
    }

    const now = new Date();
    const referral: Referral = {
      id: generateId(12),
      code: code!,
      referrerAddress: input.referrerAddress,
      payLinkId: input.payLinkId,
      totalReferrals: 0,
      confirmedReferrals: 0,
      totalEarned: '0',
      pendingAmount: '0',
      paidAmount: '0',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };

    await this.storage.saveReferral(referral);
    return referral;
  }

  /**
   * Get referral by code
   */
  async getReferralByCode(code: string): Promise<Referral | null> {
    return this.storage.getReferralByCode(code.toUpperCase());
  }

  /**
   * Get referral by ID
   */
  async getReferral(id: string): Promise<Referral | null> {
    return this.storage.getReferral(id);
  }

  /**
   * Get all referrals for a PayLink
   */
  async getReferralsByPayLink(payLinkId: string): Promise<Referral[]> {
    return this.storage.getReferralsByPayLink(payLinkId);
  }

  /**
   * Get all referrals for a referrer
   */
  async getReferralsByReferrer(referrerAddress: string): Promise<Referral[]> {
    return this.storage.getReferralsByReferrer(referrerAddress);
  }

  /**
   * Process payment with referral
   * Creates commission record and updates referral stats
   */
  async processReferralPayment(
    payment: Payment,
    payLink: PayLink,
    referralCode: string
  ): Promise<ReferralCommission | null> {
    // Get referral by code
    const referral = await this.storage.getReferralByCode(referralCode.toUpperCase());
    
    if (!referral) {
      console.warn(`Referral code not found: ${referralCode}`);
      return null;
    }

    // Verify referral is for this link
    if (referral.payLinkId !== payLink.id) {
      console.warn(`Referral code ${referralCode} is not valid for this link`);
      return null;
    }

    // Check if referral is active
    if (referral.status !== 'active') {
      console.warn(`Referral ${referral.id} is not active`);
      return null;
    }

    // Check if referral config exists
    if (!payLink.referral?.enabled) {
      console.warn(`Referral program is not enabled for link ${payLink.id}`);
      return null;
    }

    // Prevent self-referral
    if (referral.referrerAddress.toLowerCase() === payment.fromAddress.toLowerCase()) {
      console.warn('Self-referral detected, skipping commission');
      return null;
    }

    // Calculate commission
    const commissionPercent = payLink.referral.commissionPercent;
    const commissionAmount = calculateCommission(payment.amount, commissionPercent);

    // Create commission record
    const now = new Date();
    const commission: ReferralCommission = {
      id: generateId(12),
      referralId: referral.id,
      paymentId: payment.id,
      payLinkId: payLink.id,
      referrerAddress: referral.referrerAddress,
      referredAddress: payment.fromAddress,
      paymentAmount: payment.amount,
      commissionAmount,
      commissionPercent,
      tokenSymbol: payment.tokenSymbol || payLink.price.tokenSymbol,
      chainId: payment.chainId,
      status: payment.confirmed ? 'confirmed' : 'pending',
      createdAt: now,
      confirmedAt: payment.confirmed ? now : undefined,
    };

    await this.storage.saveCommission(commission);

    // Update referral stats
    referral.totalReferrals += 1;
    if (payment.confirmed) {
      referral.confirmedReferrals += 1;
      referral.pendingAmount = this.addAmounts(referral.pendingAmount, commissionAmount);
      referral.totalEarned = this.addAmounts(referral.totalEarned, commissionAmount);
    }
    referral.updatedAt = now;

    await this.storage.updateReferral(referral);

    return commission;
  }

  /**
   * Confirm pending commission (when payment is confirmed)
   */
  async confirmCommission(paymentId: string): Promise<ReferralCommission | null> {
    const commissions = await this.storage.getAllCommissions();
    const commission = commissions.find(c => c.paymentId === paymentId);

    if (!commission) {
      return null;
    }

    if (commission.status !== 'pending') {
      return commission;
    }

    const now = new Date();
    commission.status = 'confirmed';
    commission.confirmedAt = now;

    await this.storage.updateCommission(commission);

    // Update referral stats
    const referral = await this.storage.getReferral(commission.referralId);
    if (referral) {
      referral.confirmedReferrals += 1;
      referral.pendingAmount = this.addAmounts(referral.pendingAmount, commission.commissionAmount);
      referral.totalEarned = this.addAmounts(referral.totalEarned, commission.commissionAmount);
      referral.updatedAt = now;
      await this.storage.updateReferral(referral);
    }

    return commission;
  }

  /**
   * Mark commission as paid
   */
  async markCommissionPaid(
    commissionId: string,
    payoutTxHash: string
  ): Promise<ReferralCommission> {
    const commission = await this.storage.getCommission(commissionId);

    if (!commission) {
      throw new Error('Commission not found');
    }

    if (commission.status !== 'confirmed') {
      throw new Error('Commission is not in confirmed status');
    }

    const now = new Date();
    commission.status = 'paid';
    commission.paidAt = now;
    commission.payoutTxHash = payoutTxHash;

    await this.storage.updateCommission(commission);

    // Update referral stats
    const referral = await this.storage.getReferral(commission.referralId);
    if (referral) {
      referral.pendingAmount = this.subtractAmounts(referral.pendingAmount, commission.commissionAmount);
      referral.paidAmount = this.addAmounts(referral.paidAmount, commission.commissionAmount);
      referral.updatedAt = now;
      await this.storage.updateReferral(referral);
    }

    return commission;
  }

  /**
   * Get referral statistics for a referrer
   */
  async getStats(referrerAddress: string): Promise<ReferralStats> {
    const commissions = await this.storage.getCommissionsByReferrer(referrerAddress);

    let totalReferrals = 0;
    let confirmedReferrals = 0;
    let pendingReferrals = 0;
    let totalEarned = 0;
    let pendingPayout = 0;
    let paidOut = 0;

    for (const commission of commissions) {
      totalReferrals++;
      
      if (commission.status === 'confirmed') {
        confirmedReferrals++;
        pendingPayout += parseFloat(commission.commissionAmount);
        totalEarned += parseFloat(commission.commissionAmount);
      } else if (commission.status === 'pending') {
        pendingReferrals++;
      } else if (commission.status === 'paid') {
        confirmedReferrals++;
        paidOut += parseFloat(commission.commissionAmount);
        totalEarned += parseFloat(commission.commissionAmount);
      }
    }

    const conversionRate = totalReferrals > 0 
      ? (confirmedReferrals / totalReferrals) * 100 
      : 0;

    return {
      totalReferrals,
      confirmedReferrals,
      pendingReferrals,
      totalEarned: totalEarned.toString(),
      pendingPayout: pendingPayout.toString(),
      paidOut: paidOut.toString(),
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }

  /**
   * Disable a referral
   */
  async disableReferral(referralId: string): Promise<Referral> {
    const referral = await this.storage.getReferral(referralId);

    if (!referral) {
      throw new Error('Referral not found');
    }

    referral.status = 'disabled';
    referral.updatedAt = new Date();

    await this.storage.updateReferral(referral);
    return referral;
  }

  /**
   * Get pending commissions for payout
   */
  async getPendingCommissions(referrerAddress: string): Promise<ReferralCommission[]> {
    return this.storage.getPendingCommissions(referrerAddress);
  }

  /**
   * Helper: Add string amounts
   */
  private addAmounts(a: string, b: string): string {
    const result = parseFloat(a) + parseFloat(b);
    return result.toFixed(8).replace(/\.?0+$/, '');
  }

  /**
   * Helper: Subtract string amounts
   */
  private subtractAmounts(a: string, b: string): string {
    const result = parseFloat(a) - parseFloat(b);
    return Math.max(0, result).toFixed(8).replace(/\.?0+$/, '');
  }
}

/**
 * Create a referral manager
 */
export function createReferralManager(storage: Storage): ReferralManager {
  return new ReferralManager(storage);
}

/**
 * Build referral URL
 */
export function buildReferralUrl(baseUrl: string, linkId: string, referralCode: string): string {
  return `${baseUrl}/pay/${linkId}?ref=${referralCode}`;
}

/**
 * Parse referral code from URL or query string
 */
export function parseReferralCode(input: string): string | null {
  // Try URL
  try {
    const url = new URL(input);
    const ref = url.searchParams.get('ref');
    if (ref && isValidReferralCode(ref)) {
      return ref.toUpperCase();
    }
  } catch {
    // Not a URL, check if it's a direct code
    if (isValidReferralCode(input)) {
      return input.toUpperCase();
    }
  }
  return null;
}
