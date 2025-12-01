import type { Storage, PayLink, Payment, Subscription, Referral, ReferralCommission } from './types.js';

/**
 * In-memory storage implementation
 * Replace with database for production
 */
export class MemoryStorage implements Storage {
  private links = new Map<string, PayLink>();
  private payments = new Map<string, Payment>();
  private paymentsByTx = new Map<string, Payment>();
  private paymentsByLink = new Map<string, Payment[]>();
  private paymentsByAddress = new Map<string, Payment>();
  private subscriptions = new Map<string, Subscription>();
  private subscriptionsByAddress = new Map<string, Subscription>();
  private subscriptionsByLink = new Map<string, Subscription[]>();
  private referrals = new Map<string, Referral>();
  private referralsByCode = new Map<string, Referral>();
  private referralsByLink = new Map<string, Referral[]>();
  private referralsByReferrer = new Map<string, Referral[]>();
  private commissions = new Map<string, ReferralCommission>();
  private commissionsByReferral = new Map<string, ReferralCommission[]>();
  private commissionsByReferrer = new Map<string, ReferralCommission[]>();

  async getPayLink(id: string): Promise<PayLink | null> {
    return this.links.get(id) ?? null;
  }

  async savePayLink(payLink: PayLink): Promise<void> {
    this.links.set(payLink.id, { ...payLink });
  }

  async updatePayLink(payLink: PayLink): Promise<void> {
    if (!this.links.has(payLink.id)) {
      throw new Error(`PayLink ${payLink.id} not found`);
    }
    this.links.set(payLink.id, { ...payLink, updatedAt: new Date() });
  }

  async deletePayLink(id: string): Promise<void> {
    this.links.delete(id);
  }

  async getAllPayLinks(): Promise<PayLink[]> {
    return Array.from(this.links.values());
  }

  async savePayment(payment: Payment): Promise<void> {
    this.payments.set(payment.id, { ...payment });
    this.paymentsByTx.set(payment.txHash, payment);
    
    // Index by link
    const list = this.paymentsByLink.get(payment.payLinkId) ?? [];
    list.push(payment);
    this.paymentsByLink.set(payment.payLinkId, list);
    
    // Index by address (for multi-use links)
    if (payment.fromAddress) {
      const addressKey = `${payment.payLinkId}:${payment.fromAddress.toLowerCase()}`;
      this.paymentsByAddress.set(addressKey, payment);
    }
  }

  async getPaymentByTxHash(txHash: string): Promise<Payment | null> {
    return this.paymentsByTx.get(txHash) ?? null;
  }

  async getConfirmedPayment(payLinkId: string): Promise<Payment | null> {
    const list = this.paymentsByLink.get(payLinkId) ?? [];
    return list.find(p => p.confirmed) ?? null;
  }

  async getConfirmedPaymentByAddress(
    payLinkId: string,
    fromAddress: string
  ): Promise<Payment | null> {
    const addressKey = `${payLinkId}:${fromAddress.toLowerCase()}`;
    const payment = this.paymentsByAddress.get(addressKey);
    if (payment && payment.confirmed) {
      return payment;
    }
    return null;
  }

  async getPaymentsByLink(payLinkId: string): Promise<Payment[]> {
    return this.paymentsByLink.get(payLinkId) ?? [];
  }

  async getAllPayments(): Promise<Payment[]> {
    return Array.from(this.payments.values());
  }

  // Subscription methods

  async saveSubscription(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.id, { ...subscription });
    
    // Index by address
    const addressKey = `${subscription.payLinkId}:${subscription.subscriberAddress}`;
    this.subscriptionsByAddress.set(addressKey, subscription);
    
    // Index by link
    const linkSubs = this.subscriptionsByLink.get(subscription.payLinkId) ?? [];
    linkSubs.push(subscription);
    this.subscriptionsByLink.set(subscription.payLinkId, linkSubs);
  }

  async getSubscription(id: string): Promise<Subscription | null> {
    return this.subscriptions.get(id) ?? null;
  }

  async updateSubscription(subscription: Subscription): Promise<void> {
    if (!this.subscriptions.has(subscription.id)) {
      throw new Error(`Subscription ${subscription.id} not found`);
    }
    
    const updated = { ...subscription, updatedAt: new Date() };
    this.subscriptions.set(subscription.id, updated);
    
    // Update address index
    const addressKey = `${subscription.payLinkId}:${subscription.subscriberAddress}`;
    this.subscriptionsByAddress.set(addressKey, updated);
    
    // Update link index
    const linkSubs = this.subscriptionsByLink.get(subscription.payLinkId) ?? [];
    const idx = linkSubs.findIndex(s => s.id === subscription.id);
    if (idx !== -1) {
      linkSubs[idx] = updated;
    }
  }

  async getSubscriptionByAddress(
    payLinkId: string,
    subscriberAddress: string
  ): Promise<Subscription | null> {
    const addressKey = `${payLinkId}:${subscriberAddress}`;
    return this.subscriptionsByAddress.get(addressKey) ?? null;
  }

  async getSubscriptionsByPayLink(payLinkId: string): Promise<Subscription[]> {
    return this.subscriptionsByLink.get(payLinkId) ?? [];
  }

  async getSubscriptionsDue(beforeDate: Date): Promise<Subscription[]> {
    const result: Subscription[] = [];
    for (const sub of this.subscriptions.values()) {
      if (
        sub.status === 'active' &&
        sub.nextPaymentDue <= beforeDate
      ) {
        result.push(sub);
      }
    }
    return result;
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values());
  }

  // Referral methods

  async saveReferral(referral: Referral): Promise<void> {
    this.referrals.set(referral.id, { ...referral });
    this.referralsByCode.set(referral.code.toUpperCase(), referral);

    // Index by link
    const linkRefs = this.referralsByLink.get(referral.payLinkId) ?? [];
    linkRefs.push(referral);
    this.referralsByLink.set(referral.payLinkId, linkRefs);

    // Index by referrer
    const referrerKey = referral.referrerAddress.toLowerCase();
    const referrerRefs = this.referralsByReferrer.get(referrerKey) ?? [];
    referrerRefs.push(referral);
    this.referralsByReferrer.set(referrerKey, referrerRefs);
  }

  async getReferral(id: string): Promise<Referral | null> {
    return this.referrals.get(id) ?? null;
  }

  async getReferralByCode(code: string): Promise<Referral | null> {
    return this.referralsByCode.get(code.toUpperCase()) ?? null;
  }

  async updateReferral(referral: Referral): Promise<void> {
    if (!this.referrals.has(referral.id)) {
      throw new Error(`Referral ${referral.id} not found`);
    }

    const updated = { ...referral, updatedAt: new Date() };
    this.referrals.set(referral.id, updated);
    this.referralsByCode.set(referral.code.toUpperCase(), updated);

    // Update link index
    const linkRefs = this.referralsByLink.get(referral.payLinkId) ?? [];
    const linkIdx = linkRefs.findIndex(r => r.id === referral.id);
    if (linkIdx !== -1) {
      linkRefs[linkIdx] = updated;
    }

    // Update referrer index
    const referrerKey = referral.referrerAddress.toLowerCase();
    const referrerRefs = this.referralsByReferrer.get(referrerKey) ?? [];
    const referrerIdx = referrerRefs.findIndex(r => r.id === referral.id);
    if (referrerIdx !== -1) {
      referrerRefs[referrerIdx] = updated;
    }
  }

  async getReferralsByPayLink(payLinkId: string): Promise<Referral[]> {
    return this.referralsByLink.get(payLinkId) ?? [];
  }

  async getReferralsByReferrer(referrerAddress: string): Promise<Referral[]> {
    return this.referralsByReferrer.get(referrerAddress.toLowerCase()) ?? [];
  }

  async getAllReferrals(): Promise<Referral[]> {
    return Array.from(this.referrals.values());
  }

  // Referral commission methods

  async saveCommission(commission: ReferralCommission): Promise<void> {
    this.commissions.set(commission.id, { ...commission });

    // Index by referral
    const refComms = this.commissionsByReferral.get(commission.referralId) ?? [];
    refComms.push(commission);
    this.commissionsByReferral.set(commission.referralId, refComms);

    // Index by referrer
    const referrerKey = commission.referrerAddress.toLowerCase();
    const referrerComms = this.commissionsByReferrer.get(referrerKey) ?? [];
    referrerComms.push(commission);
    this.commissionsByReferrer.set(referrerKey, referrerComms);
  }

  async getCommission(id: string): Promise<ReferralCommission | null> {
    return this.commissions.get(id) ?? null;
  }

  async updateCommission(commission: ReferralCommission): Promise<void> {
    if (!this.commissions.has(commission.id)) {
      throw new Error(`Commission ${commission.id} not found`);
    }

    this.commissions.set(commission.id, { ...commission });

    // Update referral index
    const refComms = this.commissionsByReferral.get(commission.referralId) ?? [];
    const refIdx = refComms.findIndex(c => c.id === commission.id);
    if (refIdx !== -1) {
      refComms[refIdx] = commission;
    }

    // Update referrer index
    const referrerKey = commission.referrerAddress.toLowerCase();
    const referrerComms = this.commissionsByReferrer.get(referrerKey) ?? [];
    const referrerIdx = referrerComms.findIndex(c => c.id === commission.id);
    if (referrerIdx !== -1) {
      referrerComms[referrerIdx] = commission;
    }
  }

  async getCommissionsByReferral(referralId: string): Promise<ReferralCommission[]> {
    return this.commissionsByReferral.get(referralId) ?? [];
  }

  async getCommissionsByReferrer(referrerAddress: string): Promise<ReferralCommission[]> {
    return this.commissionsByReferrer.get(referrerAddress.toLowerCase()) ?? [];
  }

  async getPendingCommissions(referrerAddress: string): Promise<ReferralCommission[]> {
    const comms = await this.getCommissionsByReferrer(referrerAddress);
    return comms.filter(c => c.status === 'confirmed');
  }

  async getAllCommissions(): Promise<ReferralCommission[]> {
    return Array.from(this.commissions.values());
  }

  /** Clear all data */
  clear(): void {
    this.links.clear();
    this.payments.clear();
    this.paymentsByTx.clear();
    this.paymentsByLink.clear();
    this.paymentsByAddress.clear();
    this.subscriptions.clear();
    this.subscriptionsByAddress.clear();
    this.subscriptionsByLink.clear();
    this.referrals.clear();
    this.referralsByCode.clear();
    this.referralsByLink.clear();
    this.referralsByReferrer.clear();
    this.commissions.clear();
    this.commissionsByReferral.clear();
    this.commissionsByReferrer.clear();
  }
}
