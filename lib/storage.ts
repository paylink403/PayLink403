import type { Storage, PayLink, Payment } from './types.js';

/**
 * In-memory storage implementation
 * Replace with database for production
 */
export class MemoryStorage implements Storage {
  private links = new Map<string, PayLink>();
  private payments = new Map<string, Payment>();
  private paymentsByTx = new Map<string, Payment>();
  private paymentsByLink = new Map<string, Payment[]>();

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

  /** Clear all data */
  clear(): void {
    this.links.clear();
    this.payments.clear();
    this.paymentsByTx.clear();
    this.paymentsByLink.clear();
  }
}
