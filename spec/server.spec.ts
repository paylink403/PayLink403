import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createPaylinkServer, 
  createMemoryStorage, 
  createMockProvider,
  ReasonCode,
  PaylinkServer,
  MemoryStorage,
  MockPaymentProvider,
} from '../lib/index.js';

describe('PaylinkServer', () => {
  let server: PaylinkServer;
  let storage: MemoryStorage;
  let mockProvider: MockPaymentProvider;

  beforeEach(() => {
    storage = createMemoryStorage();
    mockProvider = createMockProvider();
    
    server = createPaylinkServer({
      storage,
      paymentProviders: { 1: mockProvider },
      protocol: {
        basePath: '/pay',
        paymentTimeoutSeconds: 900,
      },
    });
  });

  describe('createPayLink', () => {
    it('should create a payment link with required fields', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/secret',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });

      expect(payLink.id).toBeDefined();
      expect(payLink.id.length).toBe(8);
      expect(payLink.targetUrl).toBe('https://example.com/secret');
      expect(payLink.status).toBe('active');
      expect(payLink.usedCount).toBe(0);
    });

    it('should create a payment link with optional fields', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/docs',
        price: { amount: '0.01', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
        description: 'Premium documentation access',
        maxUses: 100,
        expiresAt,
        metadata: { tier: 'premium' },
      });

      expect(payLink.description).toBe('Premium documentation access');
      expect(payLink.maxUses).toBe(100);
      expect(payLink.expiresAt).toEqual(expiresAt);
      expect(payLink.metadata).toEqual({ tier: 'premium' });
    });
  });

  describe('handlePayLinkRequest', () => {
    it('should return not-found for non-existent link', async () => {
      const result = await server.handlePayLinkRequest('nonexistent');
      expect(result.type).toBe('not-found');
    });

    it('should return payment-required for unpaid link', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });

      const result = await server.handlePayLinkRequest(payLink.id);
      
      expect(result.type).toBe('payment-required');
      if (result.type === 'payment-required') {
        expect(result.body.protocol).toBe('402-paylink-v1');
        expect(result.body.payLinkId).toBe(payLink.id);
        expect(result.body.payment.amount).toBe('0.001');
        expect(result.body.payment.chainId).toBe(1);
      }
    });

    it('should return redirect after confirmed payment', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/paid-content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });

      // Confirm payment
      await server.confirmPayment(payLink.id, '0xabc123');

      const result = await server.handlePayLinkRequest(payLink.id);
      
      expect(result.type).toBe('redirect');
      if (result.type === 'redirect') {
        expect(result.targetUrl).toBe('https://example.com/paid-content');
      }
    });

    it('should return forbidden for disabled link', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });

      await server.disablePayLink(payLink.id);

      const result = await server.handlePayLinkRequest(payLink.id);
      
      expect(result.type).toBe('forbidden');
      if (result.type === 'forbidden') {
        expect(result.body.reasonCode).toBe(ReasonCode.LINK_DISABLED);
      }
    });

    it('should return forbidden for expired link', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      const result = await server.handlePayLinkRequest(payLink.id);
      
      expect(result.type).toBe('forbidden');
      if (result.type === 'forbidden') {
        expect(result.body.reasonCode).toBe(ReasonCode.LINK_EXPIRED);
      }
    });

    it('should return forbidden when usage limit reached', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
        maxUses: 1,
      });

      // Confirm payment and use once
      await server.confirmPayment(payLink.id, '0xabc123');
      await server.handlePayLinkRequest(payLink.id); // This increments usage

      const result = await server.handlePayLinkRequest(payLink.id);
      
      expect(result.type).toBe('forbidden');
      if (result.type === 'forbidden') {
        expect(result.body.reasonCode).toBe(ReasonCode.LINK_USAGE_LIMIT_REACHED);
      }
    });
  });

  describe('confirmPayment', () => {
    it('should confirm valid payment', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });

      const result = await server.confirmPayment(payLink.id, '0xvalidtx');
      
      expect(result.status).toBe('confirmed');
    });

    it('should return pending for pending transaction', async () => {
      mockProvider.markPending('0xpendingtx');
      
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });

      const result = await server.confirmPayment(payLink.id, '0xpendingtx');
      
      expect(result.status).toBe('pending');
    });

    it('should return failed for failed transaction', async () => {
      mockProvider.markFailed('0xfailedtx');
      
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });

      const result = await server.confirmPayment(payLink.id, '0xfailedtx');
      
      expect(result.status).toBe('failed');
    });

    it('should return failed for non-existent link', async () => {
      const result = await server.confirmPayment('nonexistent', '0xvalidtx');
      
      expect(result.status).toBe('failed');
      expect(result.message).toContain('not found');
    });
  });

  describe('getStatus', () => {
    it('should return unpaid for new link', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });

      const status = await server.getStatus(payLink.id);
      expect(status).toBe('unpaid');
    });

    it('should return paid after payment', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });

      await server.confirmPayment(payLink.id, '0xvalidtx');
      
      const status = await server.getStatus(payLink.id);
      expect(status).toBe('paid');
    });

    it('should return not_found for missing link', async () => {
      const status = await server.getStatus('nonexistent');
      expect(status).toBe('not_found');
    });

    it('should return forbidden for disabled link', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });

      await server.disablePayLink(payLink.id);
      
      const status = await server.getStatus(payLink.id);
      expect(status).toBe('forbidden');
    });
  });
});
