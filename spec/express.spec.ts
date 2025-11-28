import { describe, it, expect, beforeEach } from 'vitest';
import express, { Express } from 'express';
import { 
  createPaylinkServer, 
  createMemoryStorage, 
  createMockProvider,
  PaylinkServer,
} from '../lib/index.js';
import { createExpressMiddleware } from '../lib/express/index.js';

// Simple test helper to make requests
async function request(app: Express, method: string, path: string, body?: unknown) {
  // Create a simple mock request/response
  return new Promise<{
    status: number;
    headers: Record<string, string>;
    body: unknown;
    redirectUrl?: string;
  }>((resolve) => {
    const req = {
      method,
      url: path,
      path,
      params: {},
      query: {},
      body: body ?? {},
      headers: {},
      get: () => undefined,
    } as unknown as express.Request;

    // Extract params from path
    const match = path.match(/\/([^/]+)(?:\/([^/]+))?$/);
    if (match) {
      req.params = { id: match[1] };
      if (match[2]) {
        // This is a sub-route like /status or /confirm
      }
    }

    const responseHeaders: Record<string, string> = {};
    let responseStatus = 200;
    let responseBody: unknown = null;
    let redirectUrl: string | undefined;

    const res = {
      status: (code: number) => {
        responseStatus = code;
        return res;
      },
      set: (headers: Record<string, string>) => {
        Object.assign(responseHeaders, headers);
        return res;
      },
      json: (data: unknown) => {
        responseBody = data;
        resolve({
          status: responseStatus,
          headers: responseHeaders,
          body: responseBody,
        });
        return res;
      },
      redirect: (status: number, url: string) => {
        responseStatus = status;
        redirectUrl = url;
        resolve({
          status: responseStatus,
          headers: responseHeaders,
          body: null,
          redirectUrl,
        });
        return res;
      },
    } as unknown as express.Response;

    // Find and execute the route handler
    const router = createExpressMiddleware(server);
    
    // Manually route the request
    if (method === 'GET' && !path.includes('/status') && !path.includes('/confirm')) {
      router.stack.find((layer: { route?: { path: string; methods: { get: boolean } } }) => 
        layer.route?.path === '/:id' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle(req, res, () => {});
    } else if (method === 'GET' && path.includes('/status')) {
      req.params.id = path.split('/')[1];
      router.stack.find((layer: { route?: { path: string; methods: { get: boolean } } }) => 
        layer.route?.path === '/:id/status'
      )?.route?.stack[0]?.handle(req, res, () => {});
    } else if (method === 'POST' && path.includes('/confirm')) {
      req.params.id = path.split('/')[1];
      router.stack.find((layer: { route?: { path: string; methods: { post: boolean } } }) => 
        layer.route?.path === '/:id/confirm'
      )?.route?.stack[0]?.handle(req, res, () => {});
    }
  });
}

let server: PaylinkServer;

describe('Express Middleware', () => {
  let app: Express;

  beforeEach(() => {
    const storage = createMemoryStorage();
    const mockProvider = createMockProvider();
    
    server = createPaylinkServer({
      storage,
      paymentProviders: { 1: mockProvider },
      protocol: { basePath: '/pay' },
    });

    app = express();
    app.use('/pay', createExpressMiddleware(server));
  });

  describe('GET /:id', () => {
    it('should return 402 for unpaid link', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234',
      });

      const res = await request(app, 'GET', `/${payLink.id}`);
      
      expect(res.status).toBe(402);
      expect(res.headers['X-Paylink-Protocol']).toBe('402-v1');
      expect((res.body as { protocol: string }).protocol).toBe('402-paylink-v1');
    });

    it('should return 302 redirect after payment', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/paid',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234',
      });

      await server.confirmPayment(payLink.id, '0xtxhash');

      const res = await request(app, 'GET', `/${payLink.id}`);
      
      expect(res.status).toBe(302);
      expect(res.redirectUrl).toBe('https://example.com/paid');
    });
  });

  describe('GET /:id/status', () => {
    it('should return unpaid status', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234',
      });

      const res = await request(app, 'GET', `/${payLink.id}/status`);
      
      expect(res.status).toBe(200);
      expect((res.body as { status: string }).status).toBe('unpaid');
    });

    it('should return paid status after payment', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234',
      });

      await server.confirmPayment(payLink.id, '0xtxhash');

      const res = await request(app, 'GET', `/${payLink.id}/status`);
      
      expect(res.status).toBe(200);
      expect((res.body as { status: string }).status).toBe('paid');
    });
  });

  describe('POST /:id/confirm', () => {
    it('should confirm valid payment', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234',
      });

      const res = await request(app, 'POST', `/${payLink.id}/confirm`, {
        txHash: '0xvalidtx',
      });
      
      expect(res.status).toBe(200);
      expect((res.body as { status: string }).status).toBe('confirmed');
    });

    it('should reject missing txHash', async () => {
      const payLink = await server.createPayLink({
        targetUrl: 'https://example.com/content',
        price: { amount: '0.001', tokenSymbol: 'ETH', chainId: 1 },
        recipientAddress: '0x1234',
      });

      const res = await request(app, 'POST', `/${payLink.id}/confirm`, {});
      
      expect(res.status).toBe(400);
    });
  });
});
