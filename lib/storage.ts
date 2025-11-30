import type { Storage, PayLink, Payment, Subscription } from './types.js';

/**
 * In-memory storage implementation
 * Replace with database for production
 */
export class MemoryStorage implements Storage {
  private links = new Map<string, PayLink>();
  private payments = new Map<string, Payment>();
  private paymentsByTx = new Map<string, Payment>();
  private paymentsByLink = new Map<string, Payment[]>();
  private subscriptions = new Map<string, Subscription>();
  private subscriptionsByAddress = new Map<string, Subscription>();
  private subscriptionsByLink = new Map<string, Subscription[]>();

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
    
    const list = this.paymentsByLink.get(payment.payLinkId) ?? [];
    list.push(payment);
    this.paymentsByLink.set(payment.payLinkId, list);
  }

  async getPaymentByTxHash(txHash: string): Promise<Payment | null> {
    return this.paymentsByTx.get(txHash) ?? null;
  }

  async getConfirmedPayment(payLinkId: string): Promise<Payment | null> {
    const list = this.paymentsByLink.get(payLinkId) ?? [];
    return list.find(p => p.confirmed) ?? null;
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

  /** Clear all data */
  clear(): void {
    this.links.clear();
    this.payments.clear();
    this.paymentsByTx.clear();
    this.paymentsByLink.clear();
    this.subscriptions.clear();
    this.subscriptionsByAddress.clear();
    this.subscriptionsByLink.clear();
  }
}
