"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lib/index.ts
var index_exports = {};
__export(index_exports, {
  ChainVerifier: () => ChainVerifier,
  MemoryStorage: () => MemoryStorage,
  MockVerifier: () => MockVerifier,
  PaylinkServer: () => PaylinkServer,
  REASON_MESSAGES: () => REASON_MESSAGES,
  ReasonCode: () => ReasonCode,
  compareAmounts: () => compareAmounts,
  createServer: () => createServer,
  generateId: () => generateId,
  generateNonce: () => generateNonce,
  generateUUID: () => generateUUID,
  isExpired: () => isExpired,
  isLimitReached: () => isLimitReached,
  sign: () => sign
});
module.exports = __toCommonJS(index_exports);

// lib/server.ts
var import_express = __toESM(require("express"));
var import_cors = __toESM(require("cors"));
var import_helmet = __toESM(require("helmet"));

// lib/types.ts
var ReasonCode = /* @__PURE__ */ ((ReasonCode2) => {
  ReasonCode2["LINK_NOT_FOUND"] = "LINK_NOT_FOUND";
  ReasonCode2["LINK_DISABLED"] = "LINK_DISABLED";
  ReasonCode2["LINK_EXPIRED"] = "LINK_EXPIRED";
  ReasonCode2["LINK_USAGE_LIMIT_REACHED"] = "LINK_USAGE_LIMIT_REACHED";
  ReasonCode2["PAYMENT_UNDERPAID"] = "PAYMENT_UNDERPAID";
  ReasonCode2["PAYMENT_CHAIN_NOT_SUPPORTED"] = "PAYMENT_CHAIN_NOT_SUPPORTED";
  ReasonCode2["ACCESS_DENIED"] = "ACCESS_DENIED";
  ReasonCode2["INTERNAL_ERROR"] = "INTERNAL_ERROR";
  return ReasonCode2;
})(ReasonCode || {});

// lib/storage.ts
var MemoryStorage = class {
  links = /* @__PURE__ */ new Map();
  payments = /* @__PURE__ */ new Map();
  paymentsByTx = /* @__PURE__ */ new Map();
  paymentsByLink = /* @__PURE__ */ new Map();
  async getPayLink(id) {
    return this.links.get(id) ?? null;
  }
  async savePayLink(payLink) {
    this.links.set(payLink.id, { ...payLink });
  }
  async updatePayLink(payLink) {
    if (!this.links.has(payLink.id)) {
      throw new Error(`PayLink ${payLink.id} not found`);
    }
    this.links.set(payLink.id, { ...payLink, updatedAt: /* @__PURE__ */ new Date() });
  }
  async deletePayLink(id) {
    this.links.delete(id);
  }
  async getAllPayLinks() {
    return Array.from(this.links.values());
  }
  async savePayment(payment) {
    this.payments.set(payment.id, { ...payment });
    this.paymentsByTx.set(payment.txHash, payment);
    const list = this.paymentsByLink.get(payment.payLinkId) ?? [];
    list.push(payment);
    this.paymentsByLink.set(payment.payLinkId, list);
  }
  async getPaymentByTxHash(txHash) {
    return this.paymentsByTx.get(txHash) ?? null;
  }
  async getConfirmedPayment(payLinkId) {
    const list = this.paymentsByLink.get(payLinkId) ?? [];
    return list.find((p) => p.confirmed) ?? null;
  }
  async getAllPayments() {
    return Array.from(this.payments.values());
  }
  /** Clear all data */
  clear() {
    this.links.clear();
    this.payments.clear();
    this.paymentsByTx.clear();
    this.paymentsByLink.clear();
  }
};

// lib/utils.ts
var import_crypto = require("crypto");
function generateId(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = (0, import_crypto.randomBytes)(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
function generateUUID() {
  return (0, import_crypto.randomUUID)();
}
function generateNonce() {
  return (0, import_crypto.randomBytes)(16).toString("hex");
}
function sign(data, secret) {
  return (0, import_crypto.createHmac)("sha256", secret).update(data).digest("hex");
}
function isExpired(date) {
  if (!date) return false;
  return /* @__PURE__ */ new Date() > new Date(date);
}
function isLimitReached(used, max) {
  if (max === void 0) return false;
  return (used ?? 0) >= max;
}
function compareAmounts(a, b) {
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  if (numA < numB) return -1;
  if (numA > numB) return 1;
  return 0;
}
var REASON_MESSAGES = {
  LINK_NOT_FOUND: "Payment link not found.",
  LINK_DISABLED: "This payment link has been disabled.",
  LINK_EXPIRED: "This payment link has expired.",
  LINK_USAGE_LIMIT_REACHED: "This payment link has reached its usage limit.",
  PAYMENT_UNDERPAID: "Payment amount is less than required.",
  PAYMENT_CHAIN_NOT_SUPPORTED: "This blockchain is not supported.",
  ACCESS_DENIED: "Access denied.",
  INTERNAL_ERROR: "An internal error occurred."
};

// lib/chain.ts
var ChainVerifier = class {
  config;
  requestId = 0;
  constructor(config) {
    this.config = config;
  }
  get chainId() {
    return this.config.chainId;
  }
  /**
   * Verify payment on chain
   */
  async verifyPayment(params) {
    try {
      const tx = await this.rpc("eth_getTransactionByHash", [params.txHash]);
      if (!tx) {
        return { status: "not_found" };
      }
      if (!tx.blockNumber) {
        return { status: "pending" };
      }
      const receipt = await this.rpc("eth_getTransactionReceipt", [params.txHash]);
      if (!receipt) {
        return { status: "pending" };
      }
      if (receipt.status === "0x0") {
        return { status: "failed" };
      }
      const currentBlock = await this.rpc("eth_blockNumber", []);
      const txBlock = parseInt(tx.blockNumber, 16);
      const current = parseInt(currentBlock, 16);
      const confirmations = current - txBlock;
      if (confirmations < (this.config.confirmations ?? 1)) {
        return { status: "pending" };
      }
      const recipientLower = params.recipient.toLowerCase();
      const toAddress = (tx.to || "").toLowerCase();
      if (toAddress !== recipientLower) {
        if (!this.isTokenTransfer(receipt, recipientLower)) {
          return { status: "not_found" };
        }
      }
      const valueWei = BigInt(tx.value || "0");
      const actualAmount = this.weiToEther(valueWei);
      if (compareAmounts(actualAmount, params.amount) < 0) {
        return {
          status: "underpaid",
          actualAmount,
          fromAddress: tx.from
        };
      }
      return {
        status: "confirmed",
        actualAmount,
        fromAddress: tx.from,
        raw: { tx, receipt }
      };
    } catch (error) {
      console.error(`Chain ${this.config.chainId} verification error:`, error);
      return { status: "not_found" };
    }
  }
  async rpc(method, params) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3e4);
    try {
      const response = await fetch(this.config.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: ++this.requestId,
          method,
          params
        }),
        signal: controller.signal
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      return data.result;
    } finally {
      clearTimeout(timeout);
    }
  }
  isTokenTransfer(receipt, recipient) {
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    for (const log of receipt.logs || []) {
      if (log.topics?.[0] === transferTopic && log.topics.length >= 3) {
        const to = "0x" + log.topics[2].slice(26).toLowerCase();
        if (to === recipient) {
          return true;
        }
      }
    }
    return false;
  }
  weiToEther(wei) {
    return (Number(wei) / 1e18).toString();
  }
};
var MockVerifier = class {
  confirmed = /* @__PURE__ */ new Set();
  pending = /* @__PURE__ */ new Set();
  failed = /* @__PURE__ */ new Set();
  chainId = 1;
  markConfirmed(txHash) {
    this.confirmed.add(txHash);
    this.pending.delete(txHash);
    this.failed.delete(txHash);
  }
  markPending(txHash) {
    this.pending.add(txHash);
  }
  markFailed(txHash) {
    this.failed.add(txHash);
  }
  async verifyPayment(params) {
    await new Promise((r) => setTimeout(r, 100));
    if (this.failed.has(params.txHash)) {
      return { status: "failed" };
    }
    if (this.pending.has(params.txHash)) {
      return { status: "pending" };
    }
    return {
      status: "confirmed",
      actualAmount: params.amount,
      fromAddress: "0x" + "a".repeat(40)
    };
  }
};

// lib/server.ts
var PaylinkServer = class {
  app;
  config;
  storage;
  verifiers;
  constructor(config) {
    this.config = {
      port: config.port ?? 3e3,
      baseUrl: config.baseUrl ?? "",
      basePath: config.basePath ?? "/pay",
      chains: config.chains,
      paymentTimeout: config.paymentTimeout ?? 900,
      signatureSecret: config.signatureSecret ?? "",
      apiKey: config.apiKey ?? "",
      cors: config.cors ?? true
    };
    this.storage = new MemoryStorage();
    this.verifiers = /* @__PURE__ */ new Map();
    for (const chain of config.chains) {
      if (chain.rpcUrl === "mock") {
        this.verifiers.set(chain.chainId, new MockVerifier());
      } else {
        this.verifiers.set(chain.chainId, new ChainVerifier(chain));
      }
    }
    this.app = (0, import_express.default)();
    this.setupMiddleware();
    this.setupRoutes();
  }
  /**
   * Get Express app instance
   */
  getApp() {
    return this.app;
  }
  /**
   * Get storage instance
   */
  getStorage() {
    return this.storage;
  }
  /**
   * Set custom storage
   */
  setStorage(storage) {
    this.storage = storage;
  }
  /**
   * Start server
   */
  start() {
    this.app.listen(this.config.port, () => {
      console.log("");
      console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
      console.log("\u2551              Paylink Protocol Server                     \u2551");
      console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
      console.log(`\u2551  Port:     ${String(this.config.port).padEnd(44)}\u2551`);
      console.log(`\u2551  Base URL: ${(this.config.baseUrl || "http://localhost:" + this.config.port).padEnd(44)}\u2551`);
      console.log(`\u2551  Chains:   ${this.config.chains.map((c) => c.name).join(", ").padEnd(44)}\u2551`);
      console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
      console.log("");
      console.log("Endpoints:");
      console.log(`  GET  ${this.config.basePath}/:id          \u2192 Payment page (402/403/302)`);
      console.log(`  GET  ${this.config.basePath}/:id/status   \u2192 Check payment status`);
      console.log(`  POST ${this.config.basePath}/:id/confirm  \u2192 Confirm with txHash`);
      console.log("");
      if (this.config.apiKey) {
        console.log("Admin API (X-API-Key header required):");
        console.log("  POST   /api/links       \u2192 Create link");
        console.log("  GET    /api/links       \u2192 List links");
        console.log("  GET    /api/links/:id   \u2192 Get link");
        console.log("  DELETE /api/links/:id   \u2192 Disable link");
        console.log("  GET    /api/payments    \u2192 List payments");
        console.log("");
      }
    });
  }
  // ========================================
  // PAYLINK METHODS
  // ========================================
  /**
   * Create a new payment link
   */
  async createPayLink(input) {
    const now = /* @__PURE__ */ new Date();
    const payLink = {
      id: generateId(),
      targetUrl: input.targetUrl,
      price: input.price,
      recipientAddress: input.recipientAddress,
      status: "active",
      createdAt: now,
      updatedAt: now,
      description: input.description,
      maxUses: input.maxUses,
      usedCount: 0,
      expiresAt: input.expiresAt,
      metadata: input.metadata
    };
    await this.storage.savePayLink(payLink);
    return payLink;
  }
  /**
   * Get payment link by ID
   */
  async getPayLink(id) {
    return this.storage.getPayLink(id);
  }
  /**
   * Disable a payment link
   */
  async disablePayLink(id) {
    const link = await this.storage.getPayLink(id);
    if (!link) throw new Error("Link not found");
    link.status = "disabled";
    await this.storage.updatePayLink(link);
  }
  // ========================================
  // PRIVATE METHODS
  // ========================================
  setupMiddleware() {
    this.app.use((0, import_helmet.default)());
    if (this.config.cors) {
      this.app.use((0, import_cors.default)({ origin: "*", methods: ["GET", "POST", "DELETE"] }));
    }
    this.app.use(import_express.default.json());
    this.app.set("trust proxy", 1);
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }
  setupRoutes() {
    this.app.get("/health", (req, res) => {
      res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    });
    this.app.get("/", (req, res) => {
      const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
      res.json({
        name: "Paylink Protocol",
        version: "1.0.0",
        chains: this.config.chains.map((c) => ({ id: c.chainId, name: c.name, symbol: c.symbol })),
        endpoints: {
          paylink: `${base}${this.config.basePath}/:id`,
          status: `${base}${this.config.basePath}/:id/status`,
          confirm: `${base}${this.config.basePath}/:id/confirm`
        }
      });
    });
    this.app.get(`${this.config.basePath}/:id`, this.handlePayLink.bind(this));
    this.app.get(`${this.config.basePath}/:id/status`, this.handleStatus.bind(this));
    this.app.post(`${this.config.basePath}/:id/confirm`, this.handleConfirm.bind(this));
    if (this.config.apiKey) {
      const auth = this.authMiddleware.bind(this);
      this.app.post("/api/links", auth, this.apiCreateLink.bind(this));
      this.app.get("/api/links", auth, this.apiListLinks.bind(this));
      this.app.get("/api/links/:id", auth, this.apiGetLink.bind(this));
      this.app.delete("/api/links/:id", auth, this.apiDeleteLink.bind(this));
      this.app.get("/api/payments", auth, this.apiListPayments.bind(this));
    }
  }
  authMiddleware(req, res, next) {
    const key = req.headers["x-api-key"];
    if (key !== this.config.apiKey) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    next();
  }
  // ========================================
  // PAYLINK HANDLERS
  // ========================================
  async handlePayLink(req, res) {
    try {
      const link = await this.storage.getPayLink(req.params.id);
      if (!link) {
        res.status(404).json({ error: "Payment link not found" });
        return;
      }
      if (link.status !== "active") {
        this.send403(res, "LINK_DISABLED" /* LINK_DISABLED */, link.id);
        return;
      }
      if (isExpired(link.expiresAt)) {
        this.send403(res, "LINK_EXPIRED" /* LINK_EXPIRED */, link.id, {
          expiredAt: link.expiresAt?.toISOString()
        });
        return;
      }
      if (isLimitReached(link.usedCount, link.maxUses)) {
        this.send403(res, "LINK_USAGE_LIMIT_REACHED" /* LINK_USAGE_LIMIT_REACHED */, link.id, {
          maxUses: link.maxUses,
          usedCount: link.usedCount
        });
        return;
      }
      const payment = await this.storage.getConfirmedPayment(link.id);
      if (payment) {
        link.usedCount = (link.usedCount ?? 0) + 1;
        await this.storage.updatePayLink(link);
        res.redirect(302, link.targetUrl);
        return;
      }
      this.send402(res, link);
    } catch (error) {
      console.error("PayLink error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async handleStatus(req, res) {
    try {
      const link = await this.storage.getPayLink(req.params.id);
      if (!link) {
        res.json({ status: "not_found" });
        return;
      }
      if (link.status !== "active") {
        res.json({ status: "forbidden" });
        return;
      }
      if (isExpired(link.expiresAt) || isLimitReached(link.usedCount, link.maxUses)) {
        res.json({ status: "forbidden" });
        return;
      }
      const payment = await this.storage.getConfirmedPayment(link.id);
      res.json({ status: payment ? "paid" : "unpaid" });
    } catch (error) {
      console.error("Status error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async handleConfirm(req, res) {
    try {
      const { txHash } = req.body;
      if (!txHash || typeof txHash !== "string") {
        res.status(400).json({ status: "failed", message: "Missing txHash" });
        return;
      }
      const link = await this.storage.getPayLink(req.params.id);
      if (!link) {
        res.status(404).json({ status: "failed", message: "Link not found" });
        return;
      }
      const existing = await this.storage.getPaymentByTxHash(txHash);
      if (existing?.confirmed) {
        res.json({ status: "confirmed", message: "Already confirmed" });
        return;
      }
      const verifier = this.verifiers.get(link.price.chainId);
      if (!verifier) {
        res.status(400).json({ status: "failed", message: "Chain not supported" });
        return;
      }
      const result = await verifier.verifyPayment({
        txHash,
        recipient: link.recipientAddress,
        amount: link.price.amount
      });
      switch (result.status) {
        case "confirmed": {
          const payment = {
            id: generateUUID(),
            payLinkId: link.id,
            chainId: link.price.chainId,
            txHash,
            fromAddress: result.fromAddress ?? "",
            amount: result.actualAmount ?? link.price.amount,
            confirmed: true,
            createdAt: /* @__PURE__ */ new Date(),
            confirmedAt: /* @__PURE__ */ new Date()
          };
          await this.storage.savePayment(payment);
          res.json({ status: "confirmed" });
          break;
        }
        case "pending":
          res.status(202).json({ status: "pending", message: "Transaction pending" });
          break;
        case "underpaid":
          res.status(400).json({
            status: "failed",
            message: `Underpaid: received ${result.actualAmount}, required ${link.price.amount}`
          });
          break;
        default:
          res.status(400).json({ status: "failed", message: "Transaction not found or failed" });
      }
    } catch (error) {
      console.error("Confirm error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  // ========================================
  // ADMIN API HANDLERS
  // ========================================
  async apiCreateLink(req, res) {
    try {
      const {
        targetUrl,
        amount,
        tokenSymbol = "ETH",
        chainId = 1,
        recipientAddress,
        description,
        maxUses,
        expiresIn
      } = req.body;
      if (!targetUrl || !amount || !recipientAddress) {
        res.status(400).json({ error: "Missing: targetUrl, amount, or recipientAddress" });
        return;
      }
      const link = await this.createPayLink({
        targetUrl,
        price: { amount: String(amount), tokenSymbol, chainId: Number(chainId) },
        recipientAddress,
        description,
        maxUses: maxUses ? Number(maxUses) : void 0,
        expiresAt: expiresIn ? new Date(Date.now() + Number(expiresIn) * 1e3) : void 0
      });
      const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
      res.status(201).json({
        success: true,
        link: {
          id: link.id,
          url: `${base}${this.config.basePath}/${link.id}`,
          targetUrl: link.targetUrl,
          price: link.price,
          recipientAddress: link.recipientAddress,
          description: link.description,
          maxUses: link.maxUses,
          expiresAt: link.expiresAt?.toISOString()
        }
      });
    } catch (error) {
      console.error("Create link error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async apiListLinks(req, res) {
    const links = await this.storage.getAllPayLinks();
    const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
    res.json({
      count: links.length,
      links: links.map((l) => ({
        id: l.id,
        url: `${base}${this.config.basePath}/${l.id}`,
        status: l.status,
        price: l.price,
        usedCount: l.usedCount
      }))
    });
  }
  async apiGetLink(req, res) {
    const link = await this.storage.getPayLink(req.params.id);
    if (!link) {
      res.status(404).json({ error: "Link not found" });
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
      createdAt: link.createdAt.toISOString()
    });
  }
  async apiDeleteLink(req, res) {
    try {
      await this.disablePayLink(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(404).json({ error: "Link not found" });
    }
  }
  async apiListPayments(req, res) {
    const payments = await this.storage.getAllPayments();
    res.json({
      count: payments.length,
      payments: payments.map((p) => ({
        id: p.id,
        payLinkId: p.payLinkId,
        txHash: p.txHash,
        amount: p.amount,
        confirmed: p.confirmed,
        createdAt: p.createdAt.toISOString()
      }))
    });
  }
  // ========================================
  // RESPONSE HELPERS
  // ========================================
  send402(res, link) {
    const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
    const nonce = generateNonce();
    const body = {
      protocol: "402-paylink-v1",
      payLinkId: link.id,
      resource: {
        description: link.description,
        preview: null
      },
      payment: {
        chainId: link.price.chainId,
        tokenSymbol: link.price.tokenSymbol,
        amount: link.price.amount,
        recipient: link.recipientAddress,
        timeoutSeconds: this.config.paymentTimeout
      },
      callbacks: {
        status: `${base}${this.config.basePath}/${link.id}/status`,
        confirm: `${base}${this.config.basePath}/${link.id}/confirm`
      },
      nonce
    };
    if (this.config.signatureSecret) {
      const data = JSON.stringify({ payLinkId: body.payLinkId, payment: body.payment, nonce });
      body.signature = sign(data, this.config.signatureSecret);
    }
    res.set({
      "Content-Type": "application/json; charset=utf-8",
      "X-Paylink-Protocol": "402-v1"
    });
    res.status(402).json(body);
  }
  send403(res, code, payLinkId, details) {
    const body = {
      protocol: "403-paylink-v1",
      payLinkId,
      reasonCode: code,
      reasonMessage: REASON_MESSAGES[code] ?? "Forbidden",
      details
    };
    res.set({
      "Content-Type": "application/json; charset=utf-8",
      "X-Paylink-Protocol": "403-v1"
    });
    res.status(403).json(body);
  }
};
function createServer(config) {
  return new PaylinkServer(config);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ChainVerifier,
  MemoryStorage,
  MockVerifier,
  PaylinkServer,
  REASON_MESSAGES,
  ReasonCode,
  compareAmounts,
  createServer,
  generateId,
  generateNonce,
  generateUUID,
  isExpired,
  isLimitReached,
  sign
});
//# sourceMappingURL=index.js.map