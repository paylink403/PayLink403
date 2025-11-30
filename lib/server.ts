import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type {
  PaylinkConfig,
  PayLink,
  Payment,
  CreatePayLinkInput,
  Protocol402Response,
  Protocol403Response,
  Storage,
  ChainConfig,
  Subscription,
  CreateSubscriptionInput,
  PaymentOption,
} from './types.js';
import { ReasonCode, SOLANA_CHAIN_IDS } from './types.js';
import { MemoryStorage } from './storage.js';
import { ChainVerifier, MockVerifier } from './chain.js';
import { SolanaVerifier, MockSolanaVerifier } from './providers/solana.js';
import { WebhookManager } from './webhook.js';
import { generatePaymentQR, generateQRCodeSVG, type PaymentQRData } from './qrcode.js';
import {
  generateId,
  generateUUID,
  generateNonce,
  sign,
  isExpired,
  isLimitReached,
  REASON_MESSAGES,
} from './utils.js';
import {
  SubscriptionManager,
  isPaymentDue,
  isInTrialPeriod,
  getIntervalDisplayName,
} from './subscription.js';

type Verifier = ChainVerifier | MockVerifier | SolanaVerifier | MockSolanaVerifier;

/**
 * Paylink Server
 * Self-hosted paid links with blockchain payment verification
 */
export class PaylinkServer {
  private app: Express;
  private config: Required<Omit<PaylinkConfig, 'chains' | 'webhook' | 'paylinkToken'>> & { 
    chains: PaylinkConfig['chains'];
    webhook?: PaylinkConfig['webhook'];
    paylinkToken?: PaylinkConfig['paylinkToken'];
  };
  private storage: Storage;
  private verifiers: Map<number, Verifier>;
  private webhookManager?: WebhookManager;
  private subscriptionManager: SubscriptionManager;
  private subscriptionCheckInterval?: NodeJS.Timeout;

  constructor(config: PaylinkConfig) {
    // Default config
    this.config = {
      port: config.port ?? 3000,
      baseUrl: config.baseUrl ?? '',
      basePath: config.basePath ?? '/pay',
      chains: config.chains,
      paymentTimeout: config.paymentTimeout ?? 900,
      signatureSecret: config.signatureSecret ?? '',
      apiKey: config.apiKey ?? '',
      cors: config.cors ?? true,
      webhook: config.webhook,
      paylinkToken: config.paylinkToken,
    };

    this.storage = new MemoryStorage();
    this.verifiers = new Map();
    this.subscriptionManager = new SubscriptionManager(this.storage);

    // Initialize webhook manager
    if (config.webhook?.url) {
      this.webhookManager = new WebhookManager(config.webhook);
    }

    // Initialize chain verifiers
    for (const chain of config.chains) {
      this.verifiers.set(chain.chainId, this.createVerifier(chain));
    }

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Create appropriate verifier based on chain type
   */
  private createVerifier(chain: ChainConfig): Verifier {
    const isSolana = chain.type === 'solana' || this.isSolanaChainId(chain.chainId);
    
    if (chain.rpcUrl === 'mock') {
      return isSolana ? new MockSolanaVerifier() : new MockVerifier();
    }
    
    if (isSolana) {
      return new SolanaVerifier({
        rpcUrl: chain.rpcUrl,
        confirmations: chain.confirmations,
      });
    }
    
    return new ChainVerifier(chain);
  }

  /**
   * Check if chain ID is a Solana chain
   */
  private isSolanaChainId(chainId: number): boolean {
    return chainId === SOLANA_CHAIN_IDS.MAINNET ||
           chainId === SOLANA_CHAIN_IDS.DEVNET ||
           chainId === SOLANA_CHAIN_IDS.TESTNET;
  }

  /**
   * Get Express app instance
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get storage instance
   */
  getStorage(): Storage {
    return this.storage;
  }

  /**
   * Set custom storage
   */
  setStorage(storage: Storage): void {
    this.storage = storage;
    this.subscriptionManager = new SubscriptionManager(storage);
  }

  /**
   * Get subscription manager
   */
  getSubscriptionManager(): SubscriptionManager {
    return this.subscriptionManager;
  }

  /**
   * Start server
   */
  start(): void {
    // Start subscription payment check
    this.startSubscriptionCheck();

    this.app.listen(this.config.port, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║              Paylink Protocol Server v1.5.0              ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║  Port:     ${String(this.config.port).padEnd(44)}║`);
      console.log(`║  Base URL: ${(this.config.baseUrl || 'http://localhost:' + this.config.port).padEnd(44)}║`);
      console.log(`║  Chains:   ${this.config.chains.map(c => c.name).join(', ').padEnd(44)}║`);
      if (this.webhookManager) {
        console.log(`║  Webhook:  ${this.config.webhook?.url?.substring(0, 44).padEnd(44)}║`);
      }
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('Endpoints:');
      console.log(`  GET  ${this.config.basePath}/:id          → Payment page (402/403/302)`);
      console.log(`  GET  ${this.config.basePath}/:id/status   → Check payment status`);
      console.log(`  POST ${this.config.basePath}/:id/confirm  → Confirm with txHash`);
      console.log(`  GET  ${this.config.basePath}/:id/qr       → QR code for payment`);
      console.log('');
      if (this.config.apiKey) {
        console.log('Admin API (X-API-Key header required):');
        console.log('  POST   /api/links       → Create link');
        console.log('  GET    /api/links       → List links');
        console.log('  GET    /api/links/:id   → Get link');
        console.log('  DELETE /api/links/:id   → Disable link');
        console.log('  GET    /api/payments    → List payments');
        console.log('');
      }
    });
  }

  // ========================================
  // PAYLINK METHODS
  // ========================================

  /**
   * Create a new payment link
   */
  async createPayLink(input: CreatePayLinkInput): Promise<PayLink> {
    const now = new Date();
    
    const payLink: PayLink = {
      id: generateId(),
      targetUrl: input.targetUrl,
      price: input.price,
      paymentOptions: input.paymentOptions,
      recipientAddress: input.recipientAddress,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      description: input.description,
      maxUses: input.maxUses,
      usedCount: 0,
      expiresAt: input.expiresAt,
      metadata: input.metadata,
      subscription: input.subscription,
      multiUse: input.multiUse,
    };

    await this.storage.savePayLink(payLink);

    // Send webhook notification
    if (this.webhookManager) {
      this.webhookManager.sendLinkEvent('link.created', payLink).catch(err => {
        console.error('Webhook error:', err);
      });
    }

    return payLink;
  }

  /**
   * Get payment link by ID
   */
  async getPayLink(id: string): Promise<PayLink | null> {
    return this.storage.getPayLink(id);
  }

  /**
   * Disable a payment link
   */
  async disablePayLink(id: string): Promise<void> {
    const link = await this.storage.getPayLink(id);
    if (!link) throw new Error('Link not found');
    
    link.status = 'disabled';
    await this.storage.updatePayLink(link);

    // Send webhook notification
    if (this.webhookManager) {
      this.webhookManager.sendLinkEvent('link.disabled', link).catch(err => {
        console.error('Webhook error:', err);
      });
    }
  }

  // ========================================
  // SUBSCRIPTION METHODS
  // ========================================

  /**
   * Create a subscription for a subscriber
   */
  async createSubscription(
    payLinkId: string,
    subscriberAddress: string,
    metadata?: Record<string, unknown>
  ): Promise<Subscription> {
    const link = await this.storage.getPayLink(payLinkId);
    if (!link) throw new Error('PayLink not found');
    if (!link.subscription) throw new Error('PayLink is not a subscription link');

    const subscription = await this.subscriptionManager.createSubscription(link, {
      payLinkId,
      subscriberAddress,
      metadata,
    });

    // Send webhook
    if (this.webhookManager) {
      this.webhookManager.sendSubscriptionEvent('subscription.created', subscription, link).catch(err => {
        console.error('Webhook error:', err);
      });
    }

    return subscription;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionManager.cancelSubscription(subscriptionId);
    const link = await this.storage.getPayLink(subscription.payLinkId);

    if (this.webhookManager && link) {
      this.webhookManager.sendSubscriptionEvent('subscription.cancelled', subscription, link).catch(err => {
        console.error('Webhook error:', err);
      });
    }

    return subscription;
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionManager.pauseSubscription(subscriptionId);
    const link = await this.storage.getPayLink(subscription.payLinkId);

    if (this.webhookManager && link) {
      this.webhookManager.sendSubscriptionEvent('subscription.paused', subscription, link).catch(err => {
        console.error('Webhook error:', err);
      });
    }

    return subscription;
  }

  /**
   * Resume a subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionManager.resumeSubscription(subscriptionId);
    const link = await this.storage.getPayLink(subscription.payLinkId);

    if (this.webhookManager && link) {
      this.webhookManager.sendSubscriptionEvent('subscription.resumed', subscription, link).catch(err => {
        console.error('Webhook error:', err);
      });
    }

    return subscription;
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(id: string): Promise<Subscription | null> {
    return this.subscriptionManager.getSubscription(id);
  }

  /**
   * Start periodic subscription check
   */
  private startSubscriptionCheck(): void {
    // Check every minute
    this.subscriptionCheckInterval = setInterval(async () => {
      try {
        const dueSubscriptions = await this.subscriptionManager.getDueSubscriptions();
        
        for (const sub of dueSubscriptions) {
          const link = await this.storage.getPayLink(sub.payLinkId);
          if (!link) continue;

          const gracePeriodHours = link.subscription?.gracePeriodHours ?? 24;
          const graceEnd = new Date(sub.nextPaymentDue);
          graceEnd.setHours(graceEnd.getHours() + gracePeriodHours);

          const now = new Date();

          // Check if past grace period
          if (now > graceEnd && sub.status === 'active') {
            await this.subscriptionManager.markPastDue(sub.id);
            
            if (this.webhookManager) {
              const updated = await this.subscriptionManager.getSubscription(sub.id);
              if (updated) {
                this.webhookManager.sendSubscriptionEvent('subscription.past_due', updated, link).catch(err => {
                  console.error('Webhook error:', err);
                });
              }
            }
          } else if (sub.status === 'active') {
            // Send payment due webhook
            if (this.webhookManager) {
              this.webhookManager.sendSubscriptionEvent('subscription.payment_due', sub, link).catch(err => {
                console.error('Webhook error:', err);
              });
            }
          }
        }
      } catch (error) {
        console.error('Subscription check error:', error);
      }
    }, 60000);
  }

  /**
   * Stop subscription check
   */
  stopSubscriptionCheck(): void {
    if (this.subscriptionCheckInterval) {
      clearInterval(this.subscriptionCheckInterval);
      this.subscriptionCheckInterval = undefined;
    }
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  private setupMiddleware(): void {
    this.app.use(helmet());
    
    if (this.config.cors) {
      this.app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE'] }));
    }
    
    this.app.use(express.json());
    this.app.set('trust proxy', 1);

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API info
    this.app.get('/', (req, res) => {
      const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
      res.json({
        name: 'Paylink Protocol',
        version: '1.3.0',
        chains: this.config.chains.map(c => ({ id: c.chainId, name: c.name, symbol: c.symbol })),
        endpoints: {
          paylink: `${base}${this.config.basePath}/:id`,
          status: `${base}${this.config.basePath}/:id/status`,
          confirm: `${base}${this.config.basePath}/:id/confirm`,
          subscribe: `${base}${this.config.basePath}/:id/subscribe`,
        },
      });
    });

    // Paylink routes
    this.app.get(`${this.config.basePath}/:id`, this.handlePayLink.bind(this));
    this.app.get(`${this.config.basePath}/:id/status`, this.handleStatus.bind(this));
    this.app.post(`${this.config.basePath}/:id/confirm`, this.handleConfirm.bind(this));
    this.app.get(`${this.config.basePath}/:id/qr`, this.handleQRCode.bind(this));
    
    // Subscription routes
    this.app.post(`${this.config.basePath}/:id/subscribe`, this.handleSubscribe.bind(this));
    this.app.get(`${this.config.basePath}/:id/subscription`, this.handleGetSubscription.bind(this));

    // Admin API
    if (this.config.apiKey) {
      const auth = this.authMiddleware.bind(this);
      this.app.post('/api/links', auth, this.apiCreateLink.bind(this));
      this.app.get('/api/links', auth, this.apiListLinks.bind(this));
      this.app.get('/api/links/:id', auth, this.apiGetLink.bind(this));
      this.app.delete('/api/links/:id', auth, this.apiDeleteLink.bind(this));
      this.app.get('/api/payments', auth, this.apiListPayments.bind(this));
      
      // Subscription admin routes
      this.app.get('/api/subscriptions', auth, this.apiListSubscriptions.bind(this));
      this.app.get('/api/subscriptions/:id', auth, this.apiGetSubscription.bind(this));
      this.app.post('/api/subscriptions/:id/cancel', auth, this.apiCancelSubscription.bind(this));
      this.app.post('/api/subscriptions/:id/pause', auth, this.apiPauseSubscription.bind(this));
      this.app.post('/api/subscriptions/:id/resume', auth, this.apiResumeSubscription.bind(this));
    }
  }

  private authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = req.headers['x-api-key'];
    if (key !== this.config.apiKey) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    next();
  }

  // ========================================
  // PAYLINK HANDLERS
  // ========================================

  private async handlePayLink(req: Request, res: Response): Promise<void> {
    try {
      const link = await this.storage.getPayLink(req.params.id);

      if (!link) {
        res.status(404).json({ error: 'Payment link not found' });
        return;
      }

      // Check if disabled
      if (link.status !== 'active') {
        this.send403(res, ReasonCode.LINK_DISABLED, link.id);
        return;
      }

      // Check if expired
      if (isExpired(link.expiresAt)) {
        this.send403(res, ReasonCode.LINK_EXPIRED, link.id, {
          expiredAt: link.expiresAt?.toISOString(),
        });
        return;
      }

      // Check usage limit (for non-subscription, non-multiUse links)
      if (!link.subscription && !link.multiUse && isLimitReached(link.usedCount, link.maxUses)) {
        this.send403(res, ReasonCode.LINK_USAGE_LIMIT_REACHED, link.id, {
          maxUses: link.maxUses,
          usedCount: link.usedCount,
        });
        return;
      }

      // Handle subscription links
      if (link.subscription) {
        const subscriberAddress = req.query.subscriber as string;
        
        if (subscriberAddress) {
          const subscription = await this.storage.getSubscriptionByAddress(link.id, subscriberAddress);
          
          if (subscription) {
            const access = await this.subscriptionManager.checkAccess(subscription, link);
            
            if (access.hasAccess) {
              // Grant access
              res.redirect(302, link.targetUrl);
              return;
            }
            
            // Check subscription status and return appropriate error
            if (subscription.status === 'cancelled') {
              this.send403(res, ReasonCode.SUBSCRIPTION_CANCELLED, link.id, {
                subscriptionId: subscription.id,
                cancelledAt: subscription.cancelledAt?.toISOString(),
              });
              return;
            }
            
            if (subscription.status === 'paused') {
              this.send403(res, ReasonCode.SUBSCRIPTION_PAUSED, link.id, {
                subscriptionId: subscription.id,
                pausedAt: subscription.pausedAt?.toISOString(),
              });
              return;
            }
            
            if (subscription.status === 'expired') {
              this.send403(res, ReasonCode.SUBSCRIPTION_EXPIRED, link.id, {
                subscriptionId: subscription.id,
              });
              return;
            }
            
            if (subscription.status === 'past_due') {
              // Return 402 with subscription info for renewal
              this.send402(res, link, subscription);
              return;
            }
          }
        }
        
        // No subscription or subscriber address - return 402 for new subscription
        this.send402(res, link);
        return;
      }

      // Handle multi-use links (requires payer address)
      if (link.multiUse) {
        const payerAddress = req.query.payer as string;
        
        if (!payerAddress) {
          // No payer address provided - return 402 with info
          this.send402(res, link);
          return;
        }
        
        // Check if this address has already paid
        const payment = await this.storage.getConfirmedPaymentByAddress(link.id, payerAddress);
        
        if (payment) {
          // Check maxUses limit if set
          if (link.maxUses && (link.usedCount ?? 0) >= link.maxUses) {
            this.send403(res, ReasonCode.LINK_USAGE_LIMIT_REACHED, link.id, {
              maxUses: link.maxUses,
              usedCount: link.usedCount,
            });
            return;
          }
          
          // Increment usage and redirect
          link.usedCount = (link.usedCount ?? 0) + 1;
          await this.storage.updatePayLink(link);
          res.redirect(302, link.targetUrl);
          return;
        }
        
        // No payment from this address - return 402
        this.send402(res, link);
        return;
      }

      // Standard single-use links: Check for any confirmed payment
      const payment = await this.storage.getConfirmedPayment(link.id);

      if (payment) {
        // Increment usage and redirect
        link.usedCount = (link.usedCount ?? 0) + 1;
        await this.storage.updatePayLink(link);
        res.redirect(302, link.targetUrl);
        return;
      }

      // No payment - return 402
      this.send402(res, link);
    } catch (error) {
      console.error('PayLink error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleStatus(req: Request, res: Response): Promise<void> {
    try {
      const link = await this.storage.getPayLink(req.params.id);

      if (!link) {
        res.json({ status: 'not_found' });
        return;
      }

      if (link.status !== 'active') {
        res.json({ status: 'forbidden' });
        return;
      }

      if (isExpired(link.expiresAt)) {
        res.json({ status: 'forbidden' });
        return;
      }

      // For multi-use links, check by address
      if (link.multiUse) {
        const payerAddress = req.query.payer as string;
        
        if (!payerAddress) {
          // Return link info without payment status
          res.json({ 
            status: 'multiUse',
            message: 'Provide ?payer=ADDRESS to check payment status',
            totalPayments: (await this.storage.getPaymentsByLink(link.id)).filter(p => p.confirmed).length,
          });
          return;
        }
        
        const payment = await this.storage.getConfirmedPaymentByAddress(link.id, payerAddress);
        res.json({ 
          status: payment ? 'paid' : 'unpaid',
          payerAddress,
        });
        return;
      }

      // For single-use links, check maxUses
      if (isLimitReached(link.usedCount, link.maxUses)) {
        res.json({ status: 'forbidden' });
        return;
      }

      const payment = await this.storage.getConfirmedPayment(link.id);
      res.json({ status: payment ? 'paid' : 'unpaid' });
    } catch (error) {
      console.error('Status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleConfirm(req: Request, res: Response): Promise<void> {
    try {
      const { txHash, chainId: requestedChainId } = req.body;

      if (!txHash || typeof txHash !== 'string') {
        res.status(400).json({ status: 'failed', message: 'Missing txHash' });
        return;
      }

      const link = await this.storage.getPayLink(req.params.id);

      if (!link) {
        res.status(404).json({ status: 'failed', message: 'Link not found' });
        return;
      }

      // Check if already confirmed
      const existing = await this.storage.getPaymentByTxHash(txHash);
      if (existing?.confirmed) {
        res.json({ status: 'confirmed', message: 'Already confirmed' });
        return;
      }

      // Determine which payment option to verify
      let chainId = link.price.chainId;
      let expectedAmount = link.price.amount;
      let recipient = link.recipientAddress;
      let tokenSymbol = link.price.tokenSymbol;

      // If chainId provided in request, find matching payment option
      if (requestedChainId !== undefined) {
        const numChainId = Number(requestedChainId);
        
        if (numChainId === link.price.chainId) {
          // Primary price matches
          chainId = link.price.chainId;
          expectedAmount = link.price.amount;
          tokenSymbol = link.price.tokenSymbol;
        } else if (link.paymentOptions) {
          // Look for matching payment option
          const option = link.paymentOptions.find(opt => opt.chainId === numChainId);
          if (option) {
            chainId = option.chainId;
            expectedAmount = option.amount;
            tokenSymbol = option.tokenSymbol;
            recipient = option.recipientAddress || link.recipientAddress;
          } else {
            res.status(400).json({ status: 'failed', message: 'Chain not accepted for this payment link' });
            return;
          }
        } else {
          res.status(400).json({ status: 'failed', message: 'Chain not accepted for this payment link' });
          return;
        }
      }

      // Get verifier for chain
      const verifier = this.verifiers.get(chainId);
      if (!verifier) {
        res.status(400).json({ status: 'failed', message: 'Chain not supported by server' });
        return;
      }

      // Verify payment
      const result = await verifier.verifyPayment({
        txHash,
        recipient,
        amount: expectedAmount,
      });

      switch (result.status) {
        case 'confirmed': {
          const payment: Payment = {
            id: generateUUID(),
            payLinkId: link.id,
            chainId,
            txHash,
            fromAddress: result.fromAddress ?? '',
            amount: result.actualAmount ?? expectedAmount,
            tokenSymbol,
            confirmed: true,
            createdAt: new Date(),
            confirmedAt: new Date(),
          };
          await this.storage.savePayment(payment);
          
          // Send webhook notification
          if (this.webhookManager) {
            this.webhookManager.sendPaymentEvent('payment.confirmed', payment, link).catch(err => {
              console.error('Webhook error:', err);
            });
          }
          
          res.json({ status: 'confirmed', chainId, tokenSymbol });
          break;
        }
        case 'pending':
          // Send webhook for pending payment
          if (this.webhookManager) {
            const pendingPayment: Payment = {
              id: generateUUID(),
              payLinkId: link.id,
              chainId,
              txHash,
              fromAddress: result.fromAddress ?? '',
              amount: result.actualAmount ?? expectedAmount,
              tokenSymbol,
              confirmed: false,
              createdAt: new Date(),
            };
            this.webhookManager.sendPaymentEvent('payment.pending', pendingPayment, link).catch(err => {
              console.error('Webhook error:', err);
            });
          }
          res.status(202).json({ status: 'pending', message: 'Transaction pending' });
          break;
        case 'underpaid':
          // Send webhook for underpaid
          if (this.webhookManager) {
            const underpaidPayment: Payment = {
              id: generateUUID(),
              payLinkId: link.id,
              chainId,
              txHash,
              fromAddress: result.fromAddress ?? '',
              amount: result.actualAmount ?? '0',
              confirmed: false,
              createdAt: new Date(),
            };
            this.webhookManager.sendPaymentEvent('payment.underpaid', underpaidPayment, link).catch(err => {
              console.error('Webhook error:', err);
            });
          }
          res.status(400).json({
            status: 'failed',
            message: `Underpaid: received ${result.actualAmount}, required ${link.price.amount}`,
          });
          break;
        default:
          res.status(400).json({ status: 'failed', message: 'Transaction not found or failed' });
      }
    } catch (error) {
      console.error('Confirm error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle QR code generation
   */
  private async handleQRCode(req: Request, res: Response): Promise<void> {
    try {
      const link = await this.storage.getPayLink(req.params.id);

      if (!link) {
        res.status(404).json({ error: 'Payment link not found' });
        return;
      }

      if (link.status !== 'active') {
        res.status(403).json({ error: 'Payment link is not active' });
        return;
      }

      const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
      const format = req.query.format as string || 'svg';
      const size = parseInt(req.query.size as string) || 256;

      const qrData: PaymentQRData = {
        chainId: link.price.chainId,
        recipient: link.recipientAddress,
        amount: link.price.amount,
        tokenSymbol: link.price.tokenSymbol,
        payLinkId: link.id,
        confirmUrl: `${base}${this.config.basePath}/${link.id}/confirm`,
      };

      const qr = generatePaymentQR(qrData, { size });

      if (format === 'json') {
        res.json({
          payLinkId: link.id,
          paymentUri: qr.uri,
          qrCodeDataUrl: qr.dataUrl,
          payment: {
            chainId: link.price.chainId,
            tokenSymbol: link.price.tokenSymbol,
            amount: link.price.amount,
            recipient: link.recipientAddress,
          },
        });
        return;
      }

      // Return SVG directly
      res.set({
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300',
      });
      res.send(qr.svg);
    } catch (error) {
      console.error('QR code error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ========================================
  // SUBSCRIPTION HANDLERS
  // ========================================

  /**
   * Handle subscription creation/renewal
   */
  private async handleSubscribe(req: Request, res: Response): Promise<void> {
    try {
      const { subscriberAddress, txHash } = req.body;

      if (!subscriberAddress) {
        res.status(400).json({ error: 'Missing subscriberAddress' });
        return;
      }

      const link = await this.storage.getPayLink(req.params.id);

      if (!link) {
        res.status(404).json({ error: 'Payment link not found' });
        return;
      }

      if (!link.subscription) {
        res.status(400).json({ error: 'This link does not support subscriptions' });
        return;
      }

      // Check for existing subscription
      let subscription = await this.storage.getSubscriptionByAddress(link.id, subscriberAddress);

      // If txHash provided, verify payment first
      if (txHash) {
        const verifier = this.verifiers.get(link.price.chainId);
        if (!verifier) {
          res.status(400).json({ error: 'Chain not supported' });
          return;
        }

        const result = await verifier.verifyPayment({
          txHash,
          recipient: link.recipientAddress,
          amount: link.price.amount,
        });

        if (result.status !== 'confirmed') {
          res.status(400).json({
            error: 'Payment not confirmed',
            status: result.status,
          });
          return;
        }

        // Save payment
        const payment: Payment = {
          id: generateUUID(),
          payLinkId: link.id,
          chainId: link.price.chainId,
          txHash,
          fromAddress: result.fromAddress ?? subscriberAddress,
          amount: result.actualAmount ?? link.price.amount,
          confirmed: true,
          createdAt: new Date(),
          confirmedAt: new Date(),
        };
        await this.storage.savePayment(payment);

        // Send payment webhook
        if (this.webhookManager) {
          this.webhookManager.sendPaymentEvent('payment.confirmed', payment, link).catch(err => {
            console.error('Webhook error:', err);
          });
        }

        if (subscription) {
          // Renew existing subscription
          subscription = await this.subscriptionManager.processPayment(subscription, payment, link);

          if (this.webhookManager) {
            this.webhookManager.sendSubscriptionEvent('subscription.renewed', subscription, link).catch(err => {
              console.error('Webhook error:', err);
            });
          }

          res.json({
            success: true,
            action: 'renewed',
            subscription: this.formatSubscriptionResponse(subscription, link),
          });
          return;
        }
      }

      // Create new subscription
      if (!subscription) {
        subscription = await this.createSubscription(link.id, subscriberAddress);

        res.status(201).json({
          success: true,
          action: 'created',
          subscription: this.formatSubscriptionResponse(subscription, link),
        });
        return;
      }

      // Return existing subscription info
      res.json({
        success: true,
        action: 'existing',
        subscription: this.formatSubscriptionResponse(subscription, link),
      });
    } catch (error) {
      console.error('Subscribe error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle get subscription status
   */
  private async handleGetSubscription(req: Request, res: Response): Promise<void> {
    try {
      const subscriberAddress = req.query.subscriber as string;

      if (!subscriberAddress) {
        res.status(400).json({ error: 'Missing subscriber query parameter' });
        return;
      }

      const link = await this.storage.getPayLink(req.params.id);

      if (!link) {
        res.status(404).json({ error: 'Payment link not found' });
        return;
      }

      const subscription = await this.storage.getSubscriptionByAddress(link.id, subscriberAddress);

      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      const access = await this.subscriptionManager.checkAccess(subscription, link);

      res.json({
        subscription: this.formatSubscriptionResponse(subscription, link),
        access: {
          hasAccess: access.hasAccess,
          reason: access.reason,
          requiresPayment: access.requiresPayment,
        },
      });
    } catch (error) {
      console.error('Get subscription error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Format subscription for response
   */
  private formatSubscriptionResponse(subscription: Subscription, link: PayLink) {
    const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
    
    return {
      id: subscription.id,
      payLinkId: subscription.payLinkId,
      subscriberAddress: subscription.subscriberAddress,
      status: subscription.status,
      interval: link.subscription?.interval,
      intervalCount: link.subscription?.intervalCount ?? 1,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      nextPaymentDue: subscription.nextPaymentDue.toISOString(),
      cycleCount: subscription.cycleCount,
      trialEndsAt: subscription.trialEndsAt?.toISOString(),
      cancelledAt: subscription.cancelledAt?.toISOString(),
      pausedAt: subscription.pausedAt?.toISOString(),
      createdAt: subscription.createdAt.toISOString(),
      price: link.price,
      renewUrl: `${base}${this.config.basePath}/${link.id}/subscribe`,
    };
  }

  // ========================================
  // ADMIN API HANDLERS
  // ========================================

  private async apiCreateLink(req: Request, res: Response): Promise<void> {
    try {
      const {
        targetUrl,
        amount,
        tokenSymbol = 'ETH',
        chainId = 1,
        recipientAddress,
        description,
        maxUses,
        expiresIn,
        // Multi-currency payment options
        paymentOptions,
        // Subscription fields
        subscription,
        // Multi-use mode
        multiUse,
      } = req.body;

      if (!targetUrl || !amount || !recipientAddress) {
        res.status(400).json({ error: 'Missing: targetUrl, amount, or recipientAddress' });
        return;
      }

      // Parse payment options if provided
      let parsedPaymentOptions: PaymentOption[] | undefined;
      if (paymentOptions && Array.isArray(paymentOptions)) {
        parsedPaymentOptions = paymentOptions.map((opt: any) => ({
          tokenSymbol: opt.tokenSymbol,
          chainId: Number(opt.chainId),
          amount: String(opt.amount),
          recipientAddress: opt.recipientAddress,
        }));
      }

      // Parse subscription config if provided
      let subscriptionConfig;
      if (subscription) {
        if (!subscription.interval || !['daily', 'weekly', 'monthly', 'yearly'].includes(subscription.interval)) {
          res.status(400).json({ error: 'Invalid subscription interval. Must be: daily, weekly, monthly, or yearly' });
          return;
        }
        subscriptionConfig = {
          interval: subscription.interval,
          intervalCount: subscription.intervalCount ? Number(subscription.intervalCount) : 1,
          gracePeriodHours: subscription.gracePeriodHours ? Number(subscription.gracePeriodHours) : 24,
          maxCycles: subscription.maxCycles ? Number(subscription.maxCycles) : undefined,
          trialDays: subscription.trialDays ? Number(subscription.trialDays) : 0,
        };
      }

      const link = await this.createPayLink({
        targetUrl,
        price: { amount: String(amount), tokenSymbol, chainId: Number(chainId) },
        paymentOptions: parsedPaymentOptions,
        recipientAddress,
        description,
        maxUses: maxUses ? Number(maxUses) : undefined,
        expiresAt: expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000) : undefined,
        subscription: subscriptionConfig,
        multiUse: multiUse === true || multiUse === 'true',
      });

      const base = this.config.baseUrl || `http://localhost:${this.config.port}`;

      res.status(201).json({
        success: true,
        link: {
          id: link.id,
          url: `${base}${this.config.basePath}/${link.id}`,
          targetUrl: link.targetUrl,
          price: link.price,
          paymentOptions: link.paymentOptions,
          recipientAddress: link.recipientAddress,
          description: link.description,
          maxUses: link.maxUses,
          multiUse: link.multiUse,
          expiresAt: link.expiresAt?.toISOString(),
          subscription: link.subscription ? {
            interval: link.subscription.interval,
            intervalCount: link.subscription.intervalCount,
            gracePeriodHours: link.subscription.gracePeriodHours,
            maxCycles: link.subscription.maxCycles,
            trialDays: link.subscription.trialDays,
            subscribeUrl: `${base}${this.config.basePath}/${link.id}/subscribe`,
          } : undefined,
        },
      });
    } catch (error) {
      console.error('Create link error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async apiListLinks(req: Request, res: Response): Promise<void> {
    const links = await this.storage.getAllPayLinks();
    const base = this.config.baseUrl || `http://localhost:${this.config.port}`;

    res.json({
      count: links.length,
      links: links.map(l => ({
        id: l.id,
        url: `${base}${this.config.basePath}/${l.id}`,
        status: l.status,
        price: l.price,
        usedCount: l.usedCount,
        isSubscription: !!l.subscription,
        subscription: l.subscription,
      })),
    });
  }

  private async apiGetLink(req: Request, res: Response): Promise<void> {
    const link = await this.storage.getPayLink(req.params.id);

    if (!link) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    const base = this.config.baseUrl || `http://localhost:${this.config.port}`;

    res.json({
      id: link.id,
      url: `${base}${this.config.basePath}/${link.id}`,
      targetUrl: link.targetUrl,
      price: link.price,
      recipientAddress: link.recipientAddress,
      status: link.status,
      usedCount: link.usedCount,
      maxUses: link.maxUses,
      expiresAt: link.expiresAt?.toISOString(),
      createdAt: link.createdAt.toISOString(),
    });
  }

  private async apiDeleteLink(req: Request, res: Response): Promise<void> {
    try {
      await this.disablePayLink(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(404).json({ error: 'Link not found' });
    }
  }

  private async apiListPayments(req: Request, res: Response): Promise<void> {
    const payments = await this.storage.getAllPayments();

    res.json({
      count: payments.length,
      payments: payments.map(p => ({
        id: p.id,
        payLinkId: p.payLinkId,
        txHash: p.txHash,
        amount: p.amount,
        confirmed: p.confirmed,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  }

  // ========================================
  // SUBSCRIPTION ADMIN ENDPOINTS
  // ========================================

  private async apiListSubscriptions(req: Request, res: Response): Promise<void> {
    const subscriptions = await this.storage.getAllSubscriptions();
    
    res.json({
      count: subscriptions.length,
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        payLinkId: s.payLinkId,
        subscriberAddress: s.subscriberAddress,
        status: s.status,
        cycleCount: s.cycleCount,
        nextPaymentDue: s.nextPaymentDue.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
    });
  }

  private async apiGetSubscription(req: Request, res: Response): Promise<void> {
    const subscription = await this.storage.getSubscription(req.params.id);
    
    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const link = await this.storage.getPayLink(subscription.payLinkId);

    res.json({
      id: subscription.id,
      payLinkId: subscription.payLinkId,
      subscriberAddress: subscription.subscriberAddress,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      nextPaymentDue: subscription.nextPaymentDue.toISOString(),
      cycleCount: subscription.cycleCount,
      lastPaymentId: subscription.lastPaymentId,
      trialEndsAt: subscription.trialEndsAt?.toISOString(),
      cancelledAt: subscription.cancelledAt?.toISOString(),
      pausedAt: subscription.pausedAt?.toISOString(),
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
      payLink: link ? {
        id: link.id,
        targetUrl: link.targetUrl,
        price: link.price,
        subscription: link.subscription,
      } : undefined,
    });
  }

  private async apiCancelSubscription(req: Request, res: Response): Promise<void> {
    try {
      const subscription = await this.cancelSubscription(req.params.id);
      res.json({ success: true, subscription: { id: subscription.id, status: subscription.status } });
    } catch (error) {
      res.status(404).json({ error: (error as Error).message });
    }
  }

  private async apiPauseSubscription(req: Request, res: Response): Promise<void> {
    try {
      const subscription = await this.pauseSubscription(req.params.id);
      res.json({ success: true, subscription: { id: subscription.id, status: subscription.status } });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  private async apiResumeSubscription(req: Request, res: Response): Promise<void> {
    try {
      const subscription = await this.resumeSubscription(req.params.id);
      res.json({ success: true, subscription: { id: subscription.id, status: subscription.status } });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  // ========================================
  // RESPONSE HELPERS
  // ========================================

  private send402(res: Response, link: PayLink, subscription?: Subscription): void {
    const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
    const nonce = generateNonce();

    const body: Protocol402Response = {
      protocol: '402-paylink-v1',
      payLinkId: link.id,
      resource: {
        description: link.description,
        preview: null,
      },
      payment: {
        chainId: link.price.chainId,
        tokenSymbol: link.price.tokenSymbol,
        amount: link.price.amount,
        recipient: link.recipientAddress,
        timeoutSeconds: this.config.paymentTimeout,
      },
      callbacks: {
        status: `${base}${this.config.basePath}/${link.id}/status`,
        confirm: `${base}${this.config.basePath}/${link.id}/confirm`,
      },
      nonce,
    };

    // Add multi-currency payment options
    if (link.paymentOptions && link.paymentOptions.length > 0) {
      body.paymentOptions = link.paymentOptions.map(opt => ({
        chainId: opt.chainId,
        tokenSymbol: opt.tokenSymbol,
        amount: opt.amount,
        recipient: opt.recipientAddress || link.recipientAddress,
      }));
    }

    // Add subscription info if this is a subscription link
    if (link.subscription) {
      body.subscription = {
        interval: link.subscription.interval,
        intervalCount: link.subscription.intervalCount ?? 1,
        trialDays: link.subscription.trialDays,
        existingSubscriptionId: subscription?.id,
        subscriptionStatus: subscription?.status,
        nextPaymentDue: subscription?.nextPaymentDue.toISOString(),
      };
    }

    if (this.config.signatureSecret) {
      const data = JSON.stringify({ payLinkId: body.payLinkId, payment: body.payment, nonce });
      body.signature = sign(data, this.config.signatureSecret);
    }

    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'X-Paylink-Protocol': '402-v1',
    });
    res.status(402).json(body);
  }

  private send403(
    res: Response,
    code: ReasonCode,
    payLinkId?: string,
    details?: Record<string, unknown>
  ): void {
    const body: Protocol403Response = {
      protocol: '403-paylink-v1',
      payLinkId,
      reasonCode: code,
      reasonMessage: REASON_MESSAGES[code] ?? 'Forbidden',
      details,
    };

    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'X-Paylink-Protocol': '403-v1',
    });
    res.status(403).json(body);
  }
}

/**
 * Create and start a paylink server
 */
export function createServer(config: PaylinkConfig): PaylinkServer {
  return new PaylinkServer(config);
}
