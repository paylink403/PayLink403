import type { Request, Response, NextFunction, Router } from 'express';
import type { PaylinkServer } from '../server.js';
import type { ConfirmRequest } from '../types.js';
import { HEADERS_402, HEADERS_403 } from '../protocol.js';

/**
 * Express middleware options
 */
export interface ExpressMiddlewareOptions {
  /** Custom error handler */
  onError?: (error: Error, req: Request, res: Response) => void;
}

/**
 * Create Express middleware for handling paylink routes
 */
export function createExpressMiddleware(
  server: PaylinkServer,
  options: ExpressMiddlewareOptions = {}
): Router {
  // Dynamic import to avoid requiring express as a hard dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express');
  const router: Router = express.Router();

  // Parse JSON body
  router.use(express.json());

  /**
   * GET /:id - Main payment link endpoint
   * Returns 402 (payment required), 403 (forbidden), 302 (redirect), or 404 (not found)
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await server.handlePayLinkRequest(id);

      switch (result.type) {
        case 'redirect':
          res.redirect(302, result.targetUrl);
          return;

        case 'payment-required':
          res.set(HEADERS_402);
          res.status(402).json(result.body);
          return;

        case 'forbidden':
          res.set(HEADERS_403);
          res.status(403).json(result.body);
          return;

        case 'not-found':
          res.status(404).json({ error: 'Payment link not found' });
          return;
      }
    } catch (error) {
      if (options.onError) {
        options.onError(error as Error, req, res);
      } else {
        next(error);
      }
    }
  });

  /**
   * GET /:id/status - Get payment link status
   * Returns JSON with status: unpaid | pending | paid | forbidden | not_found
   */
  router.get('/:id/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const status = await server.getStatus(id);
      
      res.json({ status });
    } catch (error) {
      if (options.onError) {
        options.onError(error as Error, req, res);
      } else {
        next(error);
      }
    }
  });

  /**
   * POST /:id/confirm - Confirm payment with transaction hash
   * Body: { txHash: string }
   * Returns confirmation result
   */
  router.post('/:id/confirm', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const body = req.body as ConfirmRequest;

      if (!body.txHash || typeof body.txHash !== 'string') {
        res.status(400).json({ 
          error: 'Missing or invalid txHash',
          status: 'failed',
        });
        return;
      }

      const result = await server.confirmPayment(id, body.txHash);

      const statusCode = result.status === 'confirmed' ? 200 
        : result.status === 'pending' ? 202 
        : 400;

      res.status(statusCode).json(result);
    } catch (error) {
      if (options.onError) {
        options.onError(error as Error, req, res);
      } else {
        next(error);
      }
    }
  });

  return router;
}

/**
 * Universal handler for Next.js API routes, Vercel functions, etc.
 */
export interface UniversalRequest {
  method: string;
  url: string;
  body?: unknown;
  query?: Record<string, string | string[]>;
}

export interface UniversalResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  redirect?: string;
}

/**
 * Create a universal handler function
 */
export function createUniversalHandler(server: PaylinkServer) {
  return async (req: UniversalRequest): Promise<UniversalResponse> => {
    const url = new URL(req.url, 'http://localhost');
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Extract ID (assuming path is /pay/:id or /:id)
    const idIndex = pathParts.findIndex(p => p === 'pay') + 1 || 0;
    const id = pathParts[idIndex];
    const action = pathParts[idIndex + 1]; // 'status' or 'confirm'

    if (!id) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Not found' },
      };
    }

    // Handle GET /:id/status
    if (req.method === 'GET' && action === 'status') {
      const status = await server.getStatus(id);
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { status },
      };
    }

    // Handle POST /:id/confirm
    if (req.method === 'POST' && action === 'confirm') {
      const body = req.body as ConfirmRequest;
      
      if (!body?.txHash) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Missing txHash', status: 'failed' },
        };
      }

      const result = await server.confirmPayment(id, body.txHash);
      const statusCode = result.status === 'confirmed' ? 200 
        : result.status === 'pending' ? 202 
        : 400;

      return {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: result,
      };
    }

    // Handle GET /:id (main endpoint)
    if (req.method === 'GET' && !action) {
      const result = await server.handlePayLinkRequest(id);

      switch (result.type) {
        case 'redirect':
          return {
            status: 302,
            headers: { Location: result.targetUrl },
            body: null,
            redirect: result.targetUrl,
          };

        case 'payment-required':
          return {
            status: 402,
            headers: HEADERS_402 as Record<string, string>,
            body: result.body,
          };

        case 'forbidden':
          return {
            status: 403,
            headers: HEADERS_403 as Record<string, string>,
            body: result.body,
          };

        case 'not-found':
          return {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
            body: { error: 'Payment link not found' },
          };
      }
    }

    return {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Method not allowed' },
    };
  };
}
