// lib/server.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";

// lib/types.ts
var SOLANA_CHAIN_IDS = {
  MAINNET: 101,
  DEVNET: 102,
  TESTNET: 103
};
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
import { randomBytes, createHmac, randomUUID } from "crypto";
function generateId(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
function generateUUID() {
  return randomUUID();
}
function generateNonce() {
  return randomBytes(16).toString("hex");
}
function sign(data, secret) {
  return createHmac("sha256", secret).update(data).digest("hex");
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

// lib/providers/solana.ts
var SolanaVerifier = class {
  config;
  requestId = 0;
  constructor(config) {
    this.config = {
      rpcUrl: config.rpcUrl,
      confirmations: config.confirmations ?? 1,
      timeout: config.timeout ?? 3e4
    };
  }
  /**
   * Verify a Solana payment
   */
  async verifyPayment(params) {
    try {
      const tx = await this.getTransaction(params.txHash);
      if (!tx) {
        return { status: "not_found" };
      }
      if (tx.meta?.err) {
        return { status: "failed" };
      }
      const status = await this.getSignatureStatus(params.txHash);
      if (!status) {
        return { status: "pending" };
      }
      const confirmations = status.confirmations ?? 0;
      const isFinalized = status.confirmationStatus === "finalized";
      if (!isFinalized && confirmations < this.config.confirmations) {
        return { status: "pending" };
      }
      const { recipient: actualRecipient, amount: actualAmount, sender } = this.parseTransfer(tx, params.recipient);
      if (!actualRecipient) {
        return { status: "not_found" };
      }
      if (actualRecipient.toLowerCase() !== params.recipient.toLowerCase()) {
        return { status: "not_found" };
      }
      if (compareAmounts(actualAmount, params.amount) < 0) {
        return {
          status: "underpaid",
          actualAmount,
          fromAddress: sender,
          raw: tx
        };
      }
      return {
        status: "confirmed",
        actualAmount,
        fromAddress: sender,
        raw: tx
      };
    } catch (error) {
      console.error("Solana verification error:", error);
      return { status: "not_found" };
    }
  }
  /**
   * Parse a Solana transaction to extract transfer details
   */
  parseTransfer(tx, expectedRecipient) {
    const accountKeys = tx.transaction.message.accountKeys;
    const preBalances = tx.meta?.preBalances ?? [];
    const postBalances = tx.meta?.postBalances ?? [];
    const recipientIndex = accountKeys.findIndex(
      (key) => key.toLowerCase() === expectedRecipient.toLowerCase()
    );
    if (recipientIndex === -1) {
      return { recipient: null, amount: "0", sender: "" };
    }
    const preBalance = preBalances[recipientIndex] ?? 0;
    const postBalance = postBalances[recipientIndex] ?? 0;
    const lamportsReceived = postBalance - preBalance;
    if (lamportsReceived <= 0) {
      return { recipient: null, amount: "0", sender: "" };
    }
    const solAmount = lamportsReceived / 1e9;
    const sender = accountKeys[0] ?? "";
    return {
      recipient: expectedRecipient,
      amount: solAmount.toString(),
      sender
    };
  }
  /**
   * Get transaction details from Solana RPC
   */
  async getTransaction(signature) {
    return this.rpc("getTransaction", [
      signature,
      {
        encoding: "json",
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0
      }
    ]);
  }
  /**
   * Get signature status
   */
  async getSignatureStatus(signature) {
    const result = await this.rpc(
      "getSignatureStatuses",
      [[signature]]
    );
    return result?.value?.[0] ?? null;
  }
  /**
   * Make an RPC call to Solana
   */
  async rpc(method, params) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);
    try {
      const response = await fetch(this.config.rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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
        console.error("Solana RPC error:", data.error);
        return null;
      }
      return data.result ?? null;
    } catch (error) {
      if (error.name === "AbortError") {
        console.error("Solana RPC request timeout");
      } else {
        console.error("Solana RPC error:", error);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
};
var MockSolanaVerifier = class {
  confirmed = /* @__PURE__ */ new Set();
  pending = /* @__PURE__ */ new Set();
  failed = /* @__PURE__ */ new Set();
  markConfirmed(signature) {
    this.confirmed.add(signature);
    this.pending.delete(signature);
    this.failed.delete(signature);
  }
  markPending(signature) {
    this.pending.add(signature);
  }
  markFailed(signature) {
    this.failed.add(signature);
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
      fromAddress: "So11111111111111111111111111111111111111112"
    };
  }
};
function createSolanaVerifier(config) {
  return new SolanaVerifier(config);
}

// lib/webhook.ts
import { createHmac as createHmac2 } from "crypto";
var WebhookManager = class {
  config;
  queue = [];
  processing = false;
  constructor(config) {
    this.config = {
      url: config.url,
      secret: config.secret,
      events: config.events ?? [
        "payment.confirmed",
        "payment.pending",
        "payment.failed",
        "payment.underpaid",
        "link.created",
        "link.disabled"
      ],
      timeout: config.timeout ?? 1e4,
      retries: config.retries ?? 3,
      headers: config.headers
    };
  }
  /**
   * Check if event type is enabled
   */
  isEventEnabled(event) {
    return this.config.events.includes(event);
  }
  /**
   * Send payment event
   */
  async sendPaymentEvent(event, payment, payLink) {
    if (!this.isEventEnabled(event)) {
      return null;
    }
    const payload = {
      event,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      eventId: this.generateEventId(),
      data: {
        type: "payment",
        payment: {
          id: payment.id,
          payLinkId: payment.payLinkId,
          chainId: payment.chainId,
          txHash: payment.txHash,
          fromAddress: payment.fromAddress,
          amount: payment.amount,
          confirmed: payment.confirmed,
          createdAt: payment.createdAt.toISOString(),
          confirmedAt: payment.confirmedAt?.toISOString()
        },
        payLink: {
          id: payLink.id,
          targetUrl: payLink.targetUrl,
          price: payLink.price,
          recipientAddress: payLink.recipientAddress
        }
      }
    };
    return this.send(payload);
  }
  /**
   * Send link event
   */
  async sendLinkEvent(event, payLink) {
    if (!this.isEventEnabled(event)) {
      return null;
    }
    const payload = {
      event,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      eventId: this.generateEventId(),
      data: {
        type: "link",
        link: {
          id: payLink.id,
          targetUrl: payLink.targetUrl,
          price: payLink.price,
          recipientAddress: payLink.recipientAddress,
          status: payLink.status,
          createdAt: payLink.createdAt.toISOString(),
          description: payLink.description,
          maxUses: payLink.maxUses,
          expiresAt: payLink.expiresAt?.toISOString()
        }
      }
    };
    return this.send(payload);
  }
  /**
   * Queue event for async delivery
   */
  queueEvent(payload) {
    this.queue.push({ payload, attempt: 0 });
    this.processQueue();
  }
  /**
   * Send webhook with retries
   */
  async send(payload) {
    const startTime = Date.now();
    let lastError;
    let lastStatusCode;
    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const result = await this.deliver(payload);
        if (result.success) {
          return {
            success: true,
            statusCode: result.statusCode,
            attempts: attempt,
            duration: Date.now() - startTime
          };
        }
        lastStatusCode = result.statusCode;
        lastError = result.error;
        if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
          break;
        }
        if (attempt < this.config.retries) {
          await this.delay(Math.pow(2, attempt) * 1e3);
        }
      } catch (error) {
        lastError = error.message;
        if (attempt < this.config.retries) {
          await this.delay(Math.pow(2, attempt) * 1e3);
        }
      }
    }
    return {
      success: false,
      statusCode: lastStatusCode,
      error: lastError,
      attempts: this.config.retries,
      duration: Date.now() - startTime
    };
  }
  /**
   * Deliver webhook
   */
  async deliver(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);
    try {
      const body = JSON.stringify(payload);
      const headers = {
        "Content-Type": "application/json",
        "User-Agent": "Paylink-Webhook/1.1.0",
        "X-Paylink-Event": payload.event,
        "X-Paylink-Event-Id": payload.eventId,
        "X-Paylink-Timestamp": payload.timestamp,
        ...this.config.headers
      };
      if (this.config.secret) {
        headers["X-Paylink-Signature"] = this.sign(body);
      }
      const response = await fetch(this.config.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal
      });
      if (response.ok) {
        return { success: true, statusCode: response.status };
      }
      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      if (error.name === "AbortError") {
        return { success: false, error: "Request timeout" };
      }
      return { success: false, error: error.message };
    } finally {
      clearTimeout(timeout);
    }
  }
  /**
   * Sign payload with HMAC-SHA256
   */
  sign(body) {
    if (!this.config.secret) return "";
    return createHmac2("sha256", this.config.secret).update(body).digest("hex");
  }
  /**
   * Generate unique event ID
   */
  generateEventId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `evt_${timestamp}_${random}`;
  }
  /**
   * Process queued events
   */
  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;
      const result = await this.send(item.payload);
      if (!result.success) {
        console.error(
          `Webhook delivery failed for ${item.payload.event}:`,
          result.error
        );
      }
    }
    this.processing = false;
  }
  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};
function verifyWebhookSignature(body, signature, secret) {
  const expected = createHmac2("sha256", secret).update(body).digest("hex");
  if (signature.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}
function createWebhookManager(config) {
  return new WebhookManager(config);
}

// lib/qrcode.ts
var EC_LEVEL = 1;
var MODE_BYTE = 4;
function generatePaymentURI(data) {
  const { chainId, recipient, amount, tokenSymbol } = data;
  if (chainId >= 101 && chainId <= 103) {
    const params = new URLSearchParams({
      amount,
      label: "Paylink Payment",
      message: `Payment for ${data.payLinkId}`
    });
    return `solana:${recipient}?${params.toString()}`;
  }
  const weiAmount = parseFloat(amount) * 1e18;
  let scheme = "ethereum";
  if (chainId === 137 || chainId === 80001) {
    scheme = "polygon";
  } else if (chainId === 56 || chainId === 97) {
    scheme = "bnb";
  } else if (chainId === 42161 || chainId === 421613) {
    scheme = "arbitrum";
  }
  return `${scheme}:${recipient}@${chainId}?value=${weiAmount.toFixed(0)}`;
}
function generateQRCodeSVG(data, options = {}) {
  const {
    size = 256,
    margin = 4,
    darkColor = "#000000",
    lightColor = "#ffffff"
  } = options;
  const matrix = generateQRMatrix(data);
  const moduleCount = matrix.length;
  const moduleSize = size / (moduleCount + margin * 2);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="${lightColor}"/>`;
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (matrix[row][col]) {
        const x = (col + margin) * moduleSize;
        const y = (row + margin) * moduleSize;
        svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="${darkColor}"/>`;
      }
    }
  }
  svg += "</svg>";
  return svg;
}
function generateQRCodeDataURL(data, options = {}) {
  const svg = generateQRCodeSVG(data, options);
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
function generatePaymentQR(data, options = {}) {
  const uri = generatePaymentURI(data);
  const svg = generateQRCodeSVG(uri, options);
  const dataUrl = generateQRCodeDataURL(uri, options);
  return { uri, svg, dataUrl };
}
function generateQRMatrix(data) {
  const bytes = Buffer.from(data, "utf8");
  const version = getMinVersion(bytes.length);
  const size = version * 4 + 17;
  const matrix = Array(size).fill(null).map(() => Array(size).fill(false));
  const reserved = Array(size).fill(null).map(() => Array(size).fill(false));
  addFinderPattern(matrix, reserved, 0, 0);
  addFinderPattern(matrix, reserved, size - 7, 0);
  addFinderPattern(matrix, reserved, 0, size - 7);
  addTimingPatterns(matrix, reserved, size);
  if (version >= 2) {
    addAlignmentPatterns(matrix, reserved, version, size);
  }
  reserveFormatAreas(reserved, size);
  const encoded = encodeData(bytes, version);
  placeData(matrix, reserved, encoded, size);
  applyMask(matrix, reserved, size, 0);
  addFormatInfo(matrix, size, 0);
  return matrix;
}
function getMinVersion(dataLength) {
  const capacities = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  for (let v = 1; v <= 10; v++) {
    if (dataLength <= capacities[v]) return v;
  }
  return 10;
}
function addFinderPattern(matrix, reserved, row, col) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || cc < 0 || rr >= matrix.length || cc >= matrix.length) continue;
      reserved[rr][cc] = true;
      if (r === -1 || r === 7 || c === -1 || c === 7) {
        matrix[rr][cc] = false;
      } else if (r === 0 || r === 6 || c === 0 || c === 6) {
        matrix[rr][cc] = true;
      } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
        matrix[rr][cc] = true;
      } else {
        matrix[rr][cc] = false;
      }
    }
  }
}
function addTimingPatterns(matrix, reserved, size) {
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0;
    matrix[6][i] = bit;
    matrix[i][6] = bit;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }
}
function addAlignmentPatterns(matrix, reserved, version, size) {
  const positions = getAlignmentPositions(version);
  for (const row of positions) {
    for (const col of positions) {
      if (row < 9 && col < 9 || row < 9 && col > size - 10 || row > size - 10 && col < 9) {
        continue;
      }
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const rr = row + r;
          const cc = col + c;
          reserved[rr][cc] = true;
          if (r === -2 || r === 2 || c === -2 || c === 2) {
            matrix[rr][cc] = true;
          } else if (r === 0 && c === 0) {
            matrix[rr][cc] = true;
          } else {
            matrix[rr][cc] = false;
          }
        }
      }
    }
  }
}
function getAlignmentPositions(version) {
  if (version === 1) return [];
  const positions = [6];
  const step = Math.floor((version * 4 + 10) / (Math.floor(version / 7) + 1));
  let pos = version * 4 + 10;
  while (pos > 6 + step) {
    positions.unshift(pos);
    pos -= step;
  }
  positions.unshift(6);
  return [...new Set(positions)].sort((a, b) => a - b);
}
function reserveFormatAreas(reserved, size) {
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[size - 1 - i][8] = true;
  }
  reserved[size - 8][8] = true;
}
function encodeData(data, version) {
  const bits = [];
  pushBits(bits, MODE_BYTE, 4);
  const countBits = version < 10 ? 8 : 16;
  pushBits(bits, data.length, countBits);
  for (const byte of data) {
    pushBits(bits, byte, 8);
  }
  const capacity = getDataCapacity(version);
  const remaining = capacity - bits.length;
  if (remaining > 0) {
    pushBits(bits, 0, Math.min(4, remaining));
  }
  while (bits.length % 8 !== 0) {
    bits.push(false);
  }
  const padBytes = [236, 17];
  let padIndex = 0;
  while (bits.length < capacity) {
    pushBits(bits, padBytes[padIndex % 2], 8);
    padIndex++;
  }
  return addErrorCorrection(bits, version);
}
function getDataCapacity(version) {
  const capacities = [0, 128, 224, 352, 512, 688, 864, 992, 1232, 1456, 1728];
  return capacities[version] || 1728;
}
function pushBits(arr, value, count) {
  for (let i = count - 1; i >= 0; i--) {
    arr.push((value >> i & 1) === 1);
  }
}
function addErrorCorrection(data, version) {
  const dataBytes = [];
  for (let i = 0; i < data.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < data.length; j++) {
      if (data[i + j]) byte |= 1 << 7 - j;
    }
    dataBytes.push(byte);
  }
  const ecCount = getECCount(version);
  const ecBytes = generateECBytes(dataBytes, ecCount);
  const result = [...data];
  for (const byte of ecBytes) {
    pushBits(result, byte, 8);
  }
  return result;
}
function getECCount(version) {
  const counts = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  return counts[version] || 26;
}
function generateECBytes(data, ecCount) {
  const gfExp = new Uint8Array(512);
  const gfLog = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    gfExp[i] = x;
    gfLog[x] = i;
    x <<= 1;
    if (x & 256) x ^= 285;
  }
  for (let i = 255; i < 512; i++) {
    gfExp[i] = gfExp[i - 255];
  }
  const gen = [1];
  for (let i = 0; i < ecCount; i++) {
    const newGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfExp[(gfLog[gen[j]] + i) % 255];
    }
    gen.length = 0;
    gen.push(...newGen);
  }
  const msg = [...data, ...new Array(ecCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        if (gen[j] !== 0) {
          msg[i + j] ^= gfExp[(gfLog[gen[j]] + gfLog[coef]) % 255];
        }
      }
    }
  }
  return msg.slice(data.length);
}
function placeData(matrix, reserved, data, size) {
  let dataIndex = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (!reserved[row][c] && dataIndex < data.length) {
          matrix[row][c] = data[dataIndex++];
        }
      }
    }
    upward = !upward;
  }
}
function applyMask(matrix, reserved, size, mask) {
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!reserved[row][col] && shouldMask(row, col, mask)) {
        matrix[row][col] = !matrix[row][col];
      }
    }
  }
}
function shouldMask(row, col, mask) {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return row * col % 2 + row * col % 3 === 0;
    case 6:
      return (row * col % 2 + row * col % 3) % 2 === 0;
    case 7:
      return ((row + col) % 2 + row * col % 3) % 2 === 0;
    default:
      return false;
  }
}
function addFormatInfo(matrix, size, mask) {
  const formatBits = getFormatBits(EC_LEVEL, mask);
  for (let i = 0; i < 15; i++) {
    const bit = formatBits[i];
    if (i < 6) {
      matrix[i][8] = bit;
    } else if (i < 8) {
      matrix[i + 1][8] = bit;
    } else {
      matrix[8][14 - i] = bit;
    }
    if (i < 8) {
      matrix[8][size - 1 - i] = bit;
    } else {
      matrix[size - 15 + i][8] = bit;
    }
  }
  matrix[size - 8][8] = true;
}
function getFormatBits(ecLevel, mask) {
  const formats = {
    "1-0": "101010000010010",
    "1-1": "101000100100101",
    "1-2": "101111001111100",
    "1-3": "101101101001011",
    "1-4": "100010111111001",
    "1-5": "100000011001110",
    "1-6": "100111110010111",
    "1-7": "100101010100000"
  };
  const key = `${ecLevel}-${mask}`;
  const format = formats[key] || formats["1-0"];
  return format.split("").map((c) => c === "1");
}

// lib/server.ts
var PaylinkServer = class {
  app;
  config;
  storage;
  verifiers;
  webhookManager;
  constructor(config) {
    this.config = {
      port: config.port ?? 3e3,
      baseUrl: config.baseUrl ?? "",
      basePath: config.basePath ?? "/pay",
      chains: config.chains,
      paymentTimeout: config.paymentTimeout ?? 900,
      signatureSecret: config.signatureSecret ?? "",
      apiKey: config.apiKey ?? "",
      cors: config.cors ?? true,
      webhook: config.webhook
    };
    this.storage = new MemoryStorage();
    this.verifiers = /* @__PURE__ */ new Map();
    if (config.webhook?.url) {
      this.webhookManager = new WebhookManager(config.webhook);
    }
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
  createVerifier(chain) {
    const isSolana = chain.type === "solana" || this.isSolanaChainId(chain.chainId);
    if (chain.rpcUrl === "mock") {
      return isSolana ? new MockSolanaVerifier() : new MockVerifier();
    }
    if (isSolana) {
      return new SolanaVerifier({
        rpcUrl: chain.rpcUrl,
        confirmations: chain.confirmations
      });
    }
    return new ChainVerifier(chain);
  }
  /**
   * Check if chain ID is a Solana chain
   */
  isSolanaChainId(chainId) {
    return chainId === SOLANA_CHAIN_IDS.MAINNET || chainId === SOLANA_CHAIN_IDS.DEVNET || chainId === SOLANA_CHAIN_IDS.TESTNET;
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
      console.log("\u2551              Paylink Protocol Server v1.1.0              \u2551");
      console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
      console.log(`\u2551  Port:     ${String(this.config.port).padEnd(44)}\u2551`);
      console.log(`\u2551  Base URL: ${(this.config.baseUrl || "http://localhost:" + this.config.port).padEnd(44)}\u2551`);
      console.log(`\u2551  Chains:   ${this.config.chains.map((c) => c.name).join(", ").padEnd(44)}\u2551`);
      if (this.webhookManager) {
        console.log(`\u2551  Webhook:  ${this.config.webhook?.url?.substring(0, 44).padEnd(44)}\u2551`);
      }
      console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
      console.log("");
      console.log("Endpoints:");
      console.log(`  GET  ${this.config.basePath}/:id          \u2192 Payment page (402/403/302)`);
      console.log(`  GET  ${this.config.basePath}/:id/status   \u2192 Check payment status`);
      console.log(`  POST ${this.config.basePath}/:id/confirm  \u2192 Confirm with txHash`);
      console.log(`  GET  ${this.config.basePath}/:id/qr       \u2192 QR code for payment`);
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
    if (this.webhookManager) {
      this.webhookManager.sendLinkEvent("link.created", payLink).catch((err) => {
        console.error("Webhook error:", err);
      });
    }
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
    if (this.webhookManager) {
      this.webhookManager.sendLinkEvent("link.disabled", link).catch((err) => {
        console.error("Webhook error:", err);
      });
    }
  }
  // ========================================
  // PRIVATE METHODS
  // ========================================
  setupMiddleware() {
    this.app.use(helmet());
    if (this.config.cors) {
      this.app.use(cors({ origin: "*", methods: ["GET", "POST", "DELETE"] }));
    }
    this.app.use(express.json());
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
    this.app.get(`${this.config.basePath}/:id/qr`, this.handleQRCode.bind(this));
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
          if (this.webhookManager) {
            this.webhookManager.sendPaymentEvent("payment.confirmed", payment, link).catch((err) => {
              console.error("Webhook error:", err);
            });
          }
          res.json({ status: "confirmed" });
          break;
        }
        case "pending":
          if (this.webhookManager) {
            const pendingPayment = {
              id: generateUUID(),
              payLinkId: link.id,
              chainId: link.price.chainId,
              txHash,
              fromAddress: result.fromAddress ?? "",
              amount: result.actualAmount ?? link.price.amount,
              confirmed: false,
              createdAt: /* @__PURE__ */ new Date()
            };
            this.webhookManager.sendPaymentEvent("payment.pending", pendingPayment, link).catch((err) => {
              console.error("Webhook error:", err);
            });
          }
          res.status(202).json({ status: "pending", message: "Transaction pending" });
          break;
        case "underpaid":
          if (this.webhookManager) {
            const underpaidPayment = {
              id: generateUUID(),
              payLinkId: link.id,
              chainId: link.price.chainId,
              txHash,
              fromAddress: result.fromAddress ?? "",
              amount: result.actualAmount ?? "0",
              confirmed: false,
              createdAt: /* @__PURE__ */ new Date()
            };
            this.webhookManager.sendPaymentEvent("payment.underpaid", underpaidPayment, link).catch((err) => {
              console.error("Webhook error:", err);
            });
          }
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
  /**
   * Handle QR code generation
   */
  async handleQRCode(req, res) {
    try {
      const link = await this.storage.getPayLink(req.params.id);
      if (!link) {
        res.status(404).json({ error: "Payment link not found" });
        return;
      }
      if (link.status !== "active") {
        res.status(403).json({ error: "Payment link is not active" });
        return;
      }
      const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
      const format = req.query.format || "svg";
      const size = parseInt(req.query.size) || 256;
      const qrData = {
        chainId: link.price.chainId,
        recipient: link.recipientAddress,
        amount: link.price.amount,
        tokenSymbol: link.price.tokenSymbol,
        payLinkId: link.id,
        confirmUrl: `${base}${this.config.basePath}/${link.id}/confirm`
      };
      const qr = generatePaymentQR(qrData, { size });
      if (format === "json") {
        res.json({
          payLinkId: link.id,
          paymentUri: qr.uri,
          qrCodeDataUrl: qr.dataUrl,
          payment: {
            chainId: link.price.chainId,
            tokenSymbol: link.price.tokenSymbol,
            amount: link.price.amount,
            recipient: link.recipientAddress
          }
        });
        return;
      }
      res.set({
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=300"
      });
      res.send(qr.svg);
    } catch (error) {
      console.error("QR code error:", error);
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
export {
  ChainVerifier,
  MemoryStorage,
  MockSolanaVerifier,
  MockVerifier,
  PaylinkServer,
  REASON_MESSAGES,
  ReasonCode,
  SOLANA_CHAIN_IDS,
  SolanaVerifier,
  WebhookManager,
  compareAmounts,
  createServer,
  createSolanaVerifier,
  createWebhookManager,
  generateId,
  generateNonce,
  generatePaymentQR,
  generatePaymentURI,
  generateQRCodeDataURL,
  generateQRCodeSVG,
  generateUUID,
  isExpired,
  isLimitReached,
  sign,
  verifyWebhookSignature
};
//# sourceMappingURL=index.mjs.map