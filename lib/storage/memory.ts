import type { Storage, PayLink, Payment } from '../types.js';

/**
 * In-memory storage implementation for development and testing
 */
export class MemoryStorage implements Storage {
  private payLinks: Map<string, PayLink> = new Map();
  private payments: Map<string, Payment> = new Map();
  private paymentsByTxHash: Map<string, Payment> = new Map();
  private paymentsByPayLinkId: Map<string, Payment[]> = new Map();

  async getPayLinkById(id: string): Promise<PayLink | null> {
    return this.payLinks.get(id) ?? null;
  }

  async savePayLink(payLink: PayLink): Promise<void> {
    this.payLinks.set(payLink.id, { ...payLink });
  }

  async updatePayLink(payLink: PayLink): Promise<void> {
    if (!this.payLinks.has(payLink.id)) {
      throw new Error(`PayLink ${payLink.id} not found`);
    }
    this.payLinks.set(payLink.id, { ...payLink, updatedAt: new Date() });
  }

  async deletePayLink(id: string): Promise<void> {
    this.payLinks.delete(id);
  }

  async savePayment(payment: Payment): Promise<void> {
    this.payments.set(payment.id, { ...payment });
    this.paymentsByTxHash.set(payment.txHash, payment);
    
    const existing = this.paymentsByPayLinkId.get(payment.payLinkId) ?? [];
    existing.push(payment);
    this.paymentsByPayLinkId.set(payment.payLinkId, existing);
  }

  async findPaymentByTxHash(txHash: string): Promise<Payment | null> {
    return this.paymentsByTxHash.get(txHash) ?? null;
  }

  async findConfirmedPaymentByPayLinkId(payLinkId: string): Promise<Payment | null> {
    const payments = this.paymentsByPayLinkId.get(payLinkId) ?? [];
    return payments.find(p => p.confirmed) ?? null;
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.payLinks.clear();
    this.payments.clear();
    this.paymentsByTxHash.clear();
    this.paymentsByPayLinkId.clear();
  }

  /**
   * Get all pay links (useful for debugging)
   */
  getAllPayLinks(): PayLink[] {
    return Array.from(this.payLinks.values());
  }

  /**
   * Get all payments (useful for debugging)
   */
  getAllPayments(): Payment[] {
    return Array.from(this.payments.values());
  }
}

/**
 * Create a new in-memory storage instance
 */
export function createMemoryStorage(): MemoryStorage {
  return new MemoryStorage();
}
