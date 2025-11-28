import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryStorage, MemoryStorage, PayLink, Payment } from '../lib/index.js';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  describe('PayLink operations', () => {
    const createTestPayLink = (): PayLink => ({
      id: 'test123',
      targetUrl: 'https://example.com',
      price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
      recipientAddress: '0x1234',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should save and retrieve a pay link', async () => {
      const payLink = createTestPayLink();
      await storage.savePayLink(payLink);

      const retrieved = await storage.getPayLinkById('test123');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('test123');
      expect(retrieved?.targetUrl).toBe('https://example.com');
    });

    it('should return null for non-existent pay link', async () => {
      const result = await storage.getPayLinkById('nonexistent');
      expect(result).toBeNull();
    });

    it('should update a pay link', async () => {
      const payLink = createTestPayLink();
      await storage.savePayLink(payLink);

      payLink.status = 'disabled';
      await storage.updatePayLink(payLink);

      const retrieved = await storage.getPayLinkById('test123');
      expect(retrieved?.status).toBe('disabled');
    });

    it('should throw when updating non-existent pay link', async () => {
      const payLink = createTestPayLink();
      payLink.id = 'nonexistent';

      await expect(storage.updatePayLink(payLink)).rejects.toThrow();
    });

    it('should delete a pay link', async () => {
      const payLink = createTestPayLink();
      await storage.savePayLink(payLink);
      
      await storage.deletePayLink('test123');
      
      const result = await storage.getPayLinkById('test123');
      expect(result).toBeNull();
    });
  });

  describe('Payment operations', () => {
    const createTestPayment = (): Payment => ({
      id: 'pay123',
      payLinkId: 'link123',
      chainId: 1,
      txHash: '0xabc123',
      fromAddress: '0xsender',
      amount: '0.001',
      confirmed: true,
      createdAt: new Date(),
      confirmedAt: new Date(),
    });

    it('should save and find payment by tx hash', async () => {
      const payment = createTestPayment();
      await storage.savePayment(payment);

      const found = await storage.findPaymentByTxHash('0xabc123');
      
      expect(found).not.toBeNull();
      expect(found?.id).toBe('pay123');
    });

    it('should find confirmed payment by pay link id', async () => {
      const payment = createTestPayment();
      await storage.savePayment(payment);

      const found = await storage.findConfirmedPaymentByPayLinkId('link123');
      
      expect(found).not.toBeNull();
      expect(found?.confirmed).toBe(true);
    });

    it('should not find unconfirmed payment', async () => {
      const payment = createTestPayment();
      payment.confirmed = false;
      await storage.savePayment(payment);

      const found = await storage.findConfirmedPaymentByPayLinkId('link123');
      expect(found).toBeNull();
    });

    it('should return null for non-existent payment', async () => {
      const byTxHash = await storage.findPaymentByTxHash('nonexistent');
      const byPayLinkId = await storage.findConfirmedPaymentByPayLinkId('nonexistent');
      
      expect(byTxHash).toBeNull();
      expect(byPayLinkId).toBeNull();
    });
  });

  describe('Utility methods', () => {
    it('should clear all data', async () => {
      await storage.savePayLink({
        id: 'test1',
        targetUrl: 'https://example.com',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      storage.clear();

      expect(storage.getAllPayLinks()).toHaveLength(0);
      expect(storage.getAllPayments()).toHaveLength(0);
    });

    it('should get all pay links', async () => {
      await storage.savePayLink({
        id: 'test1',
        targetUrl: 'https://example.com/1',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await storage.savePayLink({
        id: 'test2',
        targetUrl: 'https://example.com/2',
        price: { amount: '0.002', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x5678',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const allLinks = storage.getAllPayLinks();
      expect(allLinks).toHaveLength(2);
    });
  });
});
