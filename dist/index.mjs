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
  ReasonCode2["SUBSCRIPTION_CANCELLED"] = "SUBSCRIPTION_CANCELLED";
  ReasonCode2["SUBSCRIPTION_PAST_DUE"] = "SUBSCRIPTION_PAST_DUE";
  ReasonCode2["SUBSCRIPTION_PAUSED"] = "SUBSCRIPTION_PAUSED";
  ReasonCode2["SUBSCRIPTION_EXPIRED"] = "SUBSCRIPTION_EXPIRED";
  ReasonCode2["SUBSCRIPTION_MAX_CYCLES_REACHED"] = "SUBSCRIPTION_MAX_CYCLES_REACHED";
  return ReasonCode2;
})(ReasonCode || {});

// lib/storage.ts
var MemoryStorage = class {
  links = /* @__PURE__ */ new Map();
  payments = /* @__PURE__ */ new Map();
  paymentsByTx = /* @__PURE__ */ new Map();
  paymentsByLink = /* @__PURE__ */ new Map();
  paymentsByAddress = /* @__PURE__ */ new Map();
  subscriptions = /* @__PURE__ */ new Map();
  subscriptionsByAddress = /* @__PURE__ */ new Map();
  subscriptionsByLink = /* @__PURE__ */ new Map();
  referrals = /* @__PURE__ */ new Map();
  referralsByCode = /* @__PURE__ */ new Map();
  referralsByLink = /* @__PURE__ */ new Map();
  referralsByReferrer = /* @__PURE__ */ new Map();
  commissions = /* @__PURE__ */ new Map();
  commissionsByReferral = /* @__PURE__ */ new Map();
  commissionsByReferrer = /* @__PURE__ */ new Map();
  installmentPlans = /* @__PURE__ */ new Map();
  installmentPlansByAddress = /* @__PURE__ */ new Map();
  installmentPlansByLink = /* @__PURE__ */ new Map();
  installmentPlansByBuyer = /* @__PURE__ */ new Map();
  installmentPayments = /* @__PURE__ */ new Map();
  installmentPaymentsByPlan = /* @__PURE__ */ new Map();
  installmentPaymentsByBuyer = /* @__PURE__ */ new Map();
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
    if (payment.fromAddress) {
      const addressKey = `${payment.payLinkId}:${payment.fromAddress.toLowerCase()}`;
      this.paymentsByAddress.set(addressKey, payment);
    }
  }
  async getPaymentByTxHash(txHash) {
    return this.paymentsByTx.get(txHash) ?? null;
  }
  async getConfirmedPayment(payLinkId) {
    const list = this.paymentsByLink.get(payLinkId) ?? [];
    return list.find((p) => p.confirmed) ?? null;
  }
  async getConfirmedPaymentByAddress(payLinkId, fromAddress) {
    const addressKey = `${payLinkId}:${fromAddress.toLowerCase()}`;
    const payment = this.paymentsByAddress.get(addressKey);
    if (payment && payment.confirmed) {
      return payment;
    }
    return null;
  }
  async getPaymentsByLink(payLinkId) {
    return this.paymentsByLink.get(payLinkId) ?? [];
  }
  async getAllPayments() {
    return Array.from(this.payments.values());
  }
  // Subscription methods
  async saveSubscription(subscription) {
    this.subscriptions.set(subscription.id, { ...subscription });
    const addressKey = `${subscription.payLinkId}:${subscription.subscriberAddress}`;
    this.subscriptionsByAddress.set(addressKey, subscription);
    const linkSubs = this.subscriptionsByLink.get(subscription.payLinkId) ?? [];
    linkSubs.push(subscription);
    this.subscriptionsByLink.set(subscription.payLinkId, linkSubs);
  }
  async getSubscription(id) {
    return this.subscriptions.get(id) ?? null;
  }
  async updateSubscription(subscription) {
    if (!this.subscriptions.has(subscription.id)) {
      throw new Error(`Subscription ${subscription.id} not found`);
    }
    const updated = { ...subscription, updatedAt: /* @__PURE__ */ new Date() };
    this.subscriptions.set(subscription.id, updated);
    const addressKey = `${subscription.payLinkId}:${subscription.subscriberAddress}`;
    this.subscriptionsByAddress.set(addressKey, updated);
    const linkSubs = this.subscriptionsByLink.get(subscription.payLinkId) ?? [];
    const idx = linkSubs.findIndex((s) => s.id === subscription.id);
    if (idx !== -1) {
      linkSubs[idx] = updated;
    }
  }
  async getSubscriptionByAddress(payLinkId, subscriberAddress) {
    const addressKey = `${payLinkId}:${subscriberAddress}`;
    return this.subscriptionsByAddress.get(addressKey) ?? null;
  }
  async getSubscriptionsByPayLink(payLinkId) {
    return this.subscriptionsByLink.get(payLinkId) ?? [];
  }
  async getSubscriptionsDue(beforeDate) {
    const result = [];
    for (const sub of this.subscriptions.values()) {
      if (sub.status === "active" && sub.nextPaymentDue <= beforeDate) {
        result.push(sub);
      }
    }
    return result;
  }
  async getAllSubscriptions() {
    return Array.from(this.subscriptions.values());
  }
  // Referral methods
  async saveReferral(referral) {
    this.referrals.set(referral.id, { ...referral });
    this.referralsByCode.set(referral.code.toUpperCase(), referral);
    const linkRefs = this.referralsByLink.get(referral.payLinkId) ?? [];
    linkRefs.push(referral);
    this.referralsByLink.set(referral.payLinkId, linkRefs);
    const referrerKey = referral.referrerAddress.toLowerCase();
    const referrerRefs = this.referralsByReferrer.get(referrerKey) ?? [];
    referrerRefs.push(referral);
    this.referralsByReferrer.set(referrerKey, referrerRefs);
  }
  async getReferral(id) {
    return this.referrals.get(id) ?? null;
  }
  async getReferralByCode(code) {
    return this.referralsByCode.get(code.toUpperCase()) ?? null;
  }
  async updateReferral(referral) {
    if (!this.referrals.has(referral.id)) {
      throw new Error(`Referral ${referral.id} not found`);
    }
    const updated = { ...referral, updatedAt: /* @__PURE__ */ new Date() };
    this.referrals.set(referral.id, updated);
    this.referralsByCode.set(referral.code.toUpperCase(), updated);
    const linkRefs = this.referralsByLink.get(referral.payLinkId) ?? [];
    const linkIdx = linkRefs.findIndex((r) => r.id === referral.id);
    if (linkIdx !== -1) {
      linkRefs[linkIdx] = updated;
    }
    const referrerKey = referral.referrerAddress.toLowerCase();
    const referrerRefs = this.referralsByReferrer.get(referrerKey) ?? [];
    const referrerIdx = referrerRefs.findIndex((r) => r.id === referral.id);
    if (referrerIdx !== -1) {
      referrerRefs[referrerIdx] = updated;
    }
  }
  async getReferralsByPayLink(payLinkId) {
    return this.referralsByLink.get(payLinkId) ?? [];
  }
  async getReferralsByReferrer(referrerAddress) {
    return this.referralsByReferrer.get(referrerAddress.toLowerCase()) ?? [];
  }
  async getAllReferrals() {
    return Array.from(this.referrals.values());
  }
  // Referral commission methods
  async saveCommission(commission) {
    this.commissions.set(commission.id, { ...commission });
    const refComms = this.commissionsByReferral.get(commission.referralId) ?? [];
    refComms.push(commission);
    this.commissionsByReferral.set(commission.referralId, refComms);
    const referrerKey = commission.referrerAddress.toLowerCase();
    const referrerComms = this.commissionsByReferrer.get(referrerKey) ?? [];
    referrerComms.push(commission);
    this.commissionsByReferrer.set(referrerKey, referrerComms);
  }
  async getCommission(id) {
    return this.commissions.get(id) ?? null;
  }
  async updateCommission(commission) {
    if (!this.commissions.has(commission.id)) {
      throw new Error(`Commission ${commission.id} not found`);
    }
    this.commissions.set(commission.id, { ...commission });
    const refComms = this.commissionsByReferral.get(commission.referralId) ?? [];
    const refIdx = refComms.findIndex((c) => c.id === commission.id);
    if (refIdx !== -1) {
      refComms[refIdx] = commission;
    }
    const referrerKey = commission.referrerAddress.toLowerCase();
    const referrerComms = this.commissionsByReferrer.get(referrerKey) ?? [];
    const referrerIdx = referrerComms.findIndex((c) => c.id === commission.id);
    if (referrerIdx !== -1) {
      referrerComms[referrerIdx] = commission;
    }
  }
  async getCommissionsByReferral(referralId) {
    return this.commissionsByReferral.get(referralId) ?? [];
  }
  async getCommissionsByReferrer(referrerAddress) {
    return this.commissionsByReferrer.get(referrerAddress.toLowerCase()) ?? [];
  }
  async getPendingCommissions(referrerAddress) {
    const comms = await this.getCommissionsByReferrer(referrerAddress);
    return comms.filter((c) => c.status === "confirmed");
  }
  async getAllCommissions() {
    return Array.from(this.commissions.values());
  }
  // Installment plan methods
  async saveInstallmentPlan(plan) {
    this.installmentPlans.set(plan.id, { ...plan });
    const addressKey = `${plan.payLinkId}:${plan.buyerAddress.toLowerCase()}`;
    this.installmentPlansByAddress.set(addressKey, plan);
    const linkPlans = this.installmentPlansByLink.get(plan.payLinkId) ?? [];
    linkPlans.push(plan);
    this.installmentPlansByLink.set(plan.payLinkId, linkPlans);
    const buyerKey = plan.buyerAddress.toLowerCase();
    const buyerPlans = this.installmentPlansByBuyer.get(buyerKey) ?? [];
    buyerPlans.push(plan);
    this.installmentPlansByBuyer.set(buyerKey, buyerPlans);
  }
  async getInstallmentPlan(id) {
    return this.installmentPlans.get(id) ?? null;
  }
  async updateInstallmentPlan(plan) {
    if (!this.installmentPlans.has(plan.id)) {
      throw new Error(`Installment plan ${plan.id} not found`);
    }
    const updated = { ...plan, updatedAt: /* @__PURE__ */ new Date() };
    this.installmentPlans.set(plan.id, updated);
    const addressKey = `${plan.payLinkId}:${plan.buyerAddress.toLowerCase()}`;
    this.installmentPlansByAddress.set(addressKey, updated);
    const linkPlans = this.installmentPlansByLink.get(plan.payLinkId) ?? [];
    const linkIdx = linkPlans.findIndex((p) => p.id === plan.id);
    if (linkIdx !== -1) {
      linkPlans[linkIdx] = updated;
    }
    const buyerKey = plan.buyerAddress.toLowerCase();
    const buyerPlans = this.installmentPlansByBuyer.get(buyerKey) ?? [];
    const buyerIdx = buyerPlans.findIndex((p) => p.id === plan.id);
    if (buyerIdx !== -1) {
      buyerPlans[buyerIdx] = updated;
    }
  }
  async getInstallmentPlanByAddress(payLinkId, buyerAddress) {
    const addressKey = `${payLinkId}:${buyerAddress.toLowerCase()}`;
    return this.installmentPlansByAddress.get(addressKey) ?? null;
  }
  async getInstallmentPlansByPayLink(payLinkId) {
    return this.installmentPlansByLink.get(payLinkId) ?? [];
  }
  async getInstallmentPlansByBuyer(buyerAddress) {
    return this.installmentPlansByBuyer.get(buyerAddress.toLowerCase()) ?? [];
  }
  async getOverdueInstallmentPlans() {
    const now = /* @__PURE__ */ new Date();
    const result = [];
    for (const plan of this.installmentPlans.values()) {
      if (plan.status === "active") {
        const graceEnd = new Date(plan.nextDueDate);
        graceEnd.setDate(graceEnd.getDate() + plan.gracePeriodDays);
        if (now > graceEnd) {
          result.push(plan);
        }
      }
    }
    return result;
  }
  async getInstallmentPlansDueBefore(date) {
    const result = [];
    for (const plan of this.installmentPlans.values()) {
      if ((plan.status === "active" || plan.status === "pending") && plan.nextDueDate <= date) {
        result.push(plan);
      }
    }
    return result;
  }
  async getAllInstallmentPlans() {
    return Array.from(this.installmentPlans.values());
  }
  // Installment payment methods
  async saveInstallmentPayment(payment) {
    this.installmentPayments.set(payment.id, { ...payment });
    const planPayments = this.installmentPaymentsByPlan.get(payment.installmentPlanId) ?? [];
    planPayments.push(payment);
    this.installmentPaymentsByPlan.set(payment.installmentPlanId, planPayments);
    const buyerKey = payment.buyerAddress.toLowerCase();
    const buyerPayments = this.installmentPaymentsByBuyer.get(buyerKey) ?? [];
    buyerPayments.push(payment);
    this.installmentPaymentsByBuyer.set(buyerKey, buyerPayments);
  }
  async getInstallmentPayment(id) {
    return this.installmentPayments.get(id) ?? null;
  }
  async updateInstallmentPayment(payment) {
    if (!this.installmentPayments.has(payment.id)) {
      throw new Error(`Installment payment ${payment.id} not found`);
    }
    this.installmentPayments.set(payment.id, { ...payment });
    const planPayments = this.installmentPaymentsByPlan.get(payment.installmentPlanId) ?? [];
    const planIdx = planPayments.findIndex((p) => p.id === payment.id);
    if (planIdx !== -1) {
      planPayments[planIdx] = payment;
    }
    const buyerKey = payment.buyerAddress.toLowerCase();
    const buyerPayments = this.installmentPaymentsByBuyer.get(buyerKey) ?? [];
    const buyerIdx = buyerPayments.findIndex((p) => p.id === payment.id);
    if (buyerIdx !== -1) {
      buyerPayments[buyerIdx] = payment;
    }
  }
  async getInstallmentPaymentsByPlan(planId) {
    return this.installmentPaymentsByPlan.get(planId) ?? [];
  }
  async getInstallmentPaymentsByBuyer(buyerAddress) {
    return this.installmentPaymentsByBuyer.get(buyerAddress.toLowerCase()) ?? [];
  }
  async getAllInstallmentPayments() {
    return Array.from(this.installmentPayments.values());
  }
  /** Clear all data */
  clear() {
    this.links.clear();
    this.payments.clear();
    this.paymentsByTx.clear();
    this.paymentsByLink.clear();
    this.paymentsByAddress.clear();
    this.subscriptions.clear();
    this.subscriptionsByAddress.clear();
    this.subscriptionsByLink.clear();
    this.referrals.clear();
    this.referralsByCode.clear();
    this.referralsByLink.clear();
    this.referralsByReferrer.clear();
    this.commissions.clear();
    this.commissionsByReferral.clear();
    this.commissionsByReferrer.clear();
    this.installmentPlans.clear();
    this.installmentPlansByAddress.clear();
    this.installmentPlansByLink.clear();
    this.installmentPlansByBuyer.clear();
    this.installmentPayments.clear();
    this.installmentPaymentsByPlan.clear();
    this.installmentPaymentsByBuyer.clear();
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
  INTERNAL_ERROR: "An internal error occurred.",
  SUBSCRIPTION_CANCELLED: "This subscription has been cancelled.",
  SUBSCRIPTION_PAST_DUE: "Subscription payment is past due.",
  SUBSCRIPTION_PAUSED: "This subscription is paused.",
  SUBSCRIPTION_EXPIRED: "This subscription has expired.",
  SUBSCRIPTION_MAX_CYCLES_REACHED: "Subscription has reached maximum billing cycles."
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
        "link.disabled",
        "subscription.created",
        "subscription.renewed",
        "subscription.cancelled",
        "subscription.paused",
        "subscription.resumed",
        "subscription.past_due",
        "subscription.expired",
        "subscription.trial_ending",
        "subscription.payment_due",
        "referral.created",
        "referral.disabled",
        "commission.pending",
        "commission.confirmed",
        "commission.paid",
        "installment.plan_created",
        "installment.payment_received",
        "installment.payment_confirmed",
        "installment.plan_activated",
        "installment.plan_completed",
        "installment.plan_suspended",
        "installment.plan_cancelled",
        "installment.payment_due",
        "installment.payment_overdue"
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
   * Send subscription event
   */
  async sendSubscriptionEvent(event, subscription, payLink) {
    if (!this.isEventEnabled(event)) {
      return null;
    }
    const payload = {
      event,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      eventId: this.generateEventId(),
      data: {
        type: "subscription",
        subscription: {
          id: subscription.id,
          payLinkId: subscription.payLinkId,
          subscriberAddress: subscription.subscriberAddress,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          nextPaymentDue: subscription.nextPaymentDue.toISOString(),
          cycleCount: subscription.cycleCount,
          createdAt: subscription.createdAt.toISOString(),
          cancelledAt: subscription.cancelledAt?.toISOString(),
          pausedAt: subscription.pausedAt?.toISOString(),
          trialEndsAt: subscription.trialEndsAt?.toISOString()
        },
        payLink: {
          id: payLink.id,
          targetUrl: payLink.targetUrl,
          price: payLink.price,
          recipientAddress: payLink.recipientAddress,
          subscription: payLink.subscription ? {
            interval: payLink.subscription.interval,
            intervalCount: payLink.subscription.intervalCount
          } : void 0
        }
      }
    };
    return this.send(payload);
  }
  /**
   * Send referral event
   */
  async sendReferralEvent(event, referral, payLink) {
    if (!this.isEventEnabled(event)) {
      return null;
    }
    const payload = {
      event,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      eventId: this.generateEventId(),
      data: {
        type: "referral",
        referral: {
          id: referral.id,
          code: referral.code,
          referrerAddress: referral.referrerAddress,
          payLinkId: referral.payLinkId,
          totalReferrals: referral.totalReferrals,
          confirmedReferrals: referral.confirmedReferrals,
          totalEarned: referral.totalEarned,
          pendingAmount: referral.pendingAmount,
          status: referral.status,
          createdAt: referral.createdAt.toISOString()
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
   * Send commission event
   */
  async sendCommissionEvent(event, commission, referral, payLink) {
    if (!this.isEventEnabled(event)) {
      return null;
    }
    const payload = {
      event,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      eventId: this.generateEventId(),
      data: {
        type: "commission",
        commission: {
          id: commission.id,
          referralId: commission.referralId,
          paymentId: commission.paymentId,
          referrerAddress: commission.referrerAddress,
          referredAddress: commission.referredAddress,
          paymentAmount: commission.paymentAmount,
          commissionAmount: commission.commissionAmount,
          commissionPercent: commission.commissionPercent,
          tokenSymbol: commission.tokenSymbol,
          chainId: commission.chainId,
          status: commission.status,
          createdAt: commission.createdAt.toISOString(),
          confirmedAt: commission.confirmedAt?.toISOString(),
          paidAt: commission.paidAt?.toISOString(),
          payoutTxHash: commission.payoutTxHash
        },
        referral: {
          id: referral.id,
          code: referral.code,
          referrerAddress: referral.referrerAddress
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
   * Send installment event
   */
  async sendInstallmentEvent(event, plan, payLink, payment) {
    if (!this.isEventEnabled(event)) {
      return null;
    }
    const payload = {
      event,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      eventId: this.generateEventId(),
      data: {
        type: "installment",
        plan: {
          id: plan.id,
          payLinkId: plan.payLinkId,
          buyerAddress: plan.buyerAddress,
          status: plan.status,
          totalAmount: plan.totalAmount,
          paidAmount: plan.paidAmount,
          totalInstallments: plan.totalInstallments,
          completedInstallments: plan.completedInstallments,
          nextDueDate: plan.nextDueDate.toISOString(),
          nextInstallmentNumber: plan.nextInstallmentNumber,
          createdAt: plan.createdAt.toISOString(),
          activatedAt: plan.activatedAt?.toISOString(),
          completedAt: plan.completedAt?.toISOString(),
          suspendedAt: plan.suspendedAt?.toISOString(),
          cancelledAt: plan.cancelledAt?.toISOString()
        },
        payment: payment ? {
          id: payment.id,
          installmentNumber: payment.installmentNumber,
          amount: payment.amount,
          expectedAmount: payment.expectedAmount,
          txHash: payment.txHash,
          status: payment.status,
          dueDate: payment.dueDate.toISOString(),
          createdAt: payment.createdAt.toISOString(),
          confirmedAt: payment.confirmedAt?.toISOString()
        } : void 0,
        payLink: {
          id: payLink.id,
          targetUrl: payLink.targetUrl,
          price: payLink.price,
          recipientAddress: payLink.recipientAddress,
          installment: payLink.installment ? {
            totalInstallments: payLink.installment.totalInstallments,
            intervalDays: payLink.installment.intervalDays,
            downPaymentPercent: payLink.installment.downPaymentPercent
          } : void 0
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

// lib/subscription.ts
function calculateNextBillingDate(fromDate, interval, intervalCount = 1) {
  const date = new Date(fromDate);
  switch (interval) {
    case "daily":
      date.setDate(date.getDate() + intervalCount);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7 * intervalCount);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + intervalCount);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + intervalCount);
      break;
  }
  return date;
}
function isWithinGracePeriod(nextPaymentDue, gracePeriodHours = 24) {
  const now = /* @__PURE__ */ new Date();
  const graceEnd = new Date(nextPaymentDue);
  graceEnd.setHours(graceEnd.getHours() + gracePeriodHours);
  return now <= graceEnd;
}
function isPaymentDue(subscription) {
  const now = /* @__PURE__ */ new Date();
  return now >= subscription.nextPaymentDue;
}
function isInTrialPeriod(subscription) {
  if (!subscription.trialEndsAt) return false;
  return /* @__PURE__ */ new Date() < subscription.trialEndsAt;
}
function getIntervalDisplayName(interval, count = 1) {
  const labels = {
    daily: ["day", "days"],
    weekly: ["week", "weeks"],
    monthly: ["month", "months"],
    yearly: ["year", "years"]
  };
  const [singular, plural] = labels[interval];
  if (count === 1) return singular;
  return `${count} ${plural}`;
}
var SubscriptionManager = class {
  storage;
  checkInterval = null;
  constructor(storage) {
    this.storage = storage;
  }
  /**
   * Create a new subscription
   */
  async createSubscription(payLink, input) {
    if (!payLink.subscription) {
      throw new Error("PayLink is not configured for subscriptions");
    }
    const config = payLink.subscription;
    const now = /* @__PURE__ */ new Date();
    const existing = await this.storage.getSubscriptionByAddress(
      payLink.id,
      input.subscriberAddress
    );
    if (existing && existing.status === "active") {
      throw new Error("Active subscription already exists for this address");
    }
    const trialEndsAt = config.trialDays ? new Date(now.getTime() + config.trialDays * 24 * 60 * 60 * 1e3) : void 0;
    const periodStart = trialEndsAt ?? now;
    const periodEnd = calculateNextBillingDate(
      periodStart,
      config.interval,
      config.intervalCount
    );
    const subscription = {
      id: generateId(12),
      payLinkId: payLink.id,
      subscriberAddress: input.subscriberAddress,
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextPaymentDue: trialEndsAt ?? now,
      cycleCount: 0,
      createdAt: now,
      updatedAt: now,
      trialEndsAt,
      metadata: input.metadata
    };
    await this.storage.saveSubscription(subscription);
    return subscription;
  }
  /**
   * Process payment for subscription
   */
  async processPayment(subscription, payment, payLink) {
    if (!payLink.subscription) {
      throw new Error("PayLink is not configured for subscriptions");
    }
    const config = payLink.subscription;
    const now = /* @__PURE__ */ new Date();
    const newPeriodStart = subscription.currentPeriodEnd;
    const newPeriodEnd = calculateNextBillingDate(
      newPeriodStart,
      config.interval,
      config.intervalCount
    );
    subscription.currentPeriodStart = newPeriodStart;
    subscription.currentPeriodEnd = newPeriodEnd;
    subscription.nextPaymentDue = newPeriodEnd;
    subscription.cycleCount += 1;
    subscription.lastPaymentId = payment.id;
    subscription.status = "active";
    subscription.updatedAt = now;
    if (config.maxCycles && subscription.cycleCount >= config.maxCycles) {
      subscription.status = "expired";
    }
    await this.storage.updateSubscription(subscription);
    return subscription;
  }
  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, immediate = false) {
    const subscription = await this.storage.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }
    subscription.status = "cancelled";
    subscription.cancelledAt = /* @__PURE__ */ new Date();
    subscription.updatedAt = /* @__PURE__ */ new Date();
    await this.storage.updateSubscription(subscription);
    return subscription;
  }
  /**
   * Pause subscription
   */
  async pauseSubscription(subscriptionId) {
    const subscription = await this.storage.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }
    if (subscription.status !== "active") {
      throw new Error("Only active subscriptions can be paused");
    }
    subscription.status = "paused";
    subscription.pausedAt = /* @__PURE__ */ new Date();
    subscription.updatedAt = /* @__PURE__ */ new Date();
    await this.storage.updateSubscription(subscription);
    return subscription;
  }
  /**
   * Resume subscription
   */
  async resumeSubscription(subscriptionId) {
    const subscription = await this.storage.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }
    if (subscription.status !== "paused") {
      throw new Error("Only paused subscriptions can be resumed");
    }
    subscription.status = "active";
    subscription.pausedAt = void 0;
    subscription.updatedAt = /* @__PURE__ */ new Date();
    await this.storage.updateSubscription(subscription);
    return subscription;
  }
  /**
   * Check subscription access
   * Returns true if subscription grants access to the resource
   */
  async checkAccess(subscription, payLink) {
    if (subscription.status === "cancelled") {
      return {
        hasAccess: false,
        reason: "Subscription has been cancelled"
      };
    }
    if (subscription.status === "expired") {
      return {
        hasAccess: false,
        reason: "Subscription has expired"
      };
    }
    if (subscription.status === "paused") {
      return {
        hasAccess: false,
        reason: "Subscription is paused"
      };
    }
    if (isInTrialPeriod(subscription)) {
      return { hasAccess: true };
    }
    if (isPaymentDue(subscription)) {
      const gracePeriodHours = payLink.subscription?.gracePeriodHours ?? 24;
      if (isWithinGracePeriod(subscription.nextPaymentDue, gracePeriodHours)) {
        return {
          hasAccess: true,
          requiresPayment: true
        };
      }
      return {
        hasAccess: false,
        reason: "Payment is past due",
        requiresPayment: true
      };
    }
    return { hasAccess: true };
  }
  /**
   * Mark subscription as past due
   */
  async markPastDue(subscriptionId) {
    const subscription = await this.storage.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }
    subscription.status = "past_due";
    subscription.updatedAt = /* @__PURE__ */ new Date();
    await this.storage.updateSubscription(subscription);
    return subscription;
  }
  /**
   * Get subscription by ID
   */
  async getSubscription(id) {
    return this.storage.getSubscription(id);
  }
  /**
   * Get subscription by subscriber address
   */
  async getSubscriptionByAddress(payLinkId, subscriberAddress) {
    return this.storage.getSubscriptionByAddress(payLinkId, subscriberAddress);
  }
  /**
   * Get all subscriptions due for payment
   */
  async getDueSubscriptions() {
    return this.storage.getSubscriptionsDue(/* @__PURE__ */ new Date());
  }
  /**
   * Start periodic check for due subscriptions
   */
  startPeriodicCheck(intervalMs = 6e4, onDue) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.checkInterval = setInterval(async () => {
      try {
        const dueSubscriptions = await this.getDueSubscriptions();
        for (const sub of dueSubscriptions) {
          if (onDue) {
            onDue(sub);
          }
        }
      } catch (error) {
        console.error("Subscription check error:", error);
      }
    }, intervalMs);
  }
  /**
   * Stop periodic check
   */
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
};
function createSubscriptionManager(storage) {
  return new SubscriptionManager(storage);
}

// lib/referral.ts
var DEFAULT_REFERRAL_CONFIG = {
  enabled: true,
  commissionPercent: 10,
  minPayoutThreshold: void 0,
  expirationDays: void 0
};
function generateReferralCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
function isValidReferralCode(code) {
  return /^[A-Z0-9]{4,16}$/i.test(code);
}
function calculateCommission(paymentAmount, commissionPercent) {
  const amount = parseFloat(paymentAmount);
  const commission = amount * commissionPercent / 100;
  return commission.toFixed(8).replace(/\.?0+$/, "");
}
function isCommissionExpired(createdAt, expirationDays) {
  if (!expirationDays) return false;
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + expirationDays);
  return /* @__PURE__ */ new Date() > expiresAt;
}
var ReferralManager = class {
  storage;
  constructor(storage) {
    this.storage = storage;
  }
  /**
   * Create a new referral
   */
  async createReferral(input) {
    const payLink = await this.storage.getPayLink(input.payLinkId);
    if (!payLink) {
      throw new Error("PayLink not found");
    }
    if (!payLink.referral?.enabled) {
      throw new Error("Referral program is not enabled for this link");
    }
    const existingReferrals = await this.storage.getReferralsByPayLink(input.payLinkId);
    const existing = existingReferrals.find(
      (r) => r.referrerAddress.toLowerCase() === input.referrerAddress.toLowerCase()
    );
    if (existing) {
      throw new Error("Referral already exists for this address");
    }
    let code = input.code;
    if (code) {
      if (!isValidReferralCode(code)) {
        throw new Error("Invalid referral code format");
      }
      const existingCode = await this.storage.getReferralByCode(code);
      if (existingCode) {
        throw new Error("Referral code already in use");
      }
    } else {
      let attempts = 0;
      do {
        code = generateReferralCode();
        const existingCode = await this.storage.getReferralByCode(code);
        if (!existingCode) break;
        attempts++;
      } while (attempts < 10);
      if (attempts >= 10) {
        throw new Error("Failed to generate unique referral code");
      }
    }
    const now = /* @__PURE__ */ new Date();
    const referral = {
      id: generateId(12),
      code,
      referrerAddress: input.referrerAddress,
      payLinkId: input.payLinkId,
      totalReferrals: 0,
      confirmedReferrals: 0,
      totalEarned: "0",
      pendingAmount: "0",
      paidAmount: "0",
      status: "active",
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata
    };
    await this.storage.saveReferral(referral);
    return referral;
  }
  /**
   * Get referral by code
   */
  async getReferralByCode(code) {
    return this.storage.getReferralByCode(code.toUpperCase());
  }
  /**
   * Get referral by ID
   */
  async getReferral(id) {
    return this.storage.getReferral(id);
  }
  /**
   * Get all referrals for a PayLink
   */
  async getReferralsByPayLink(payLinkId) {
    return this.storage.getReferralsByPayLink(payLinkId);
  }
  /**
   * Get all referrals for a referrer
   */
  async getReferralsByReferrer(referrerAddress) {
    return this.storage.getReferralsByReferrer(referrerAddress);
  }
  /**
   * Process payment with referral
   * Creates commission record and updates referral stats
   */
  async processReferralPayment(payment, payLink, referralCode) {
    const referral = await this.storage.getReferralByCode(referralCode.toUpperCase());
    if (!referral) {
      console.warn(`Referral code not found: ${referralCode}`);
      return null;
    }
    if (referral.payLinkId !== payLink.id) {
      console.warn(`Referral code ${referralCode} is not valid for this link`);
      return null;
    }
    if (referral.status !== "active") {
      console.warn(`Referral ${referral.id} is not active`);
      return null;
    }
    if (!payLink.referral?.enabled) {
      console.warn(`Referral program is not enabled for link ${payLink.id}`);
      return null;
    }
    if (referral.referrerAddress.toLowerCase() === payment.fromAddress.toLowerCase()) {
      console.warn("Self-referral detected, skipping commission");
      return null;
    }
    const commissionPercent = payLink.referral.commissionPercent;
    const commissionAmount = calculateCommission(payment.amount, commissionPercent);
    const now = /* @__PURE__ */ new Date();
    const commission = {
      id: generateId(12),
      referralId: referral.id,
      paymentId: payment.id,
      payLinkId: payLink.id,
      referrerAddress: referral.referrerAddress,
      referredAddress: payment.fromAddress,
      paymentAmount: payment.amount,
      commissionAmount,
      commissionPercent,
      tokenSymbol: payment.tokenSymbol || payLink.price.tokenSymbol,
      chainId: payment.chainId,
      status: payment.confirmed ? "confirmed" : "pending",
      createdAt: now,
      confirmedAt: payment.confirmed ? now : void 0
    };
    await this.storage.saveCommission(commission);
    referral.totalReferrals += 1;
    if (payment.confirmed) {
      referral.confirmedReferrals += 1;
      referral.pendingAmount = this.addAmounts(referral.pendingAmount, commissionAmount);
      referral.totalEarned = this.addAmounts(referral.totalEarned, commissionAmount);
    }
    referral.updatedAt = now;
    await this.storage.updateReferral(referral);
    return commission;
  }
  /**
   * Confirm pending commission (when payment is confirmed)
   */
  async confirmCommission(paymentId) {
    const commissions = await this.storage.getAllCommissions();
    const commission = commissions.find((c) => c.paymentId === paymentId);
    if (!commission) {
      return null;
    }
    if (commission.status !== "pending") {
      return commission;
    }
    const now = /* @__PURE__ */ new Date();
    commission.status = "confirmed";
    commission.confirmedAt = now;
    await this.storage.updateCommission(commission);
    const referral = await this.storage.getReferral(commission.referralId);
    if (referral) {
      referral.confirmedReferrals += 1;
      referral.pendingAmount = this.addAmounts(referral.pendingAmount, commission.commissionAmount);
      referral.totalEarned = this.addAmounts(referral.totalEarned, commission.commissionAmount);
      referral.updatedAt = now;
      await this.storage.updateReferral(referral);
    }
    return commission;
  }
  /**
   * Mark commission as paid
   */
  async markCommissionPaid(commissionId, payoutTxHash) {
    const commission = await this.storage.getCommission(commissionId);
    if (!commission) {
      throw new Error("Commission not found");
    }
    if (commission.status !== "confirmed") {
      throw new Error("Commission is not in confirmed status");
    }
    const now = /* @__PURE__ */ new Date();
    commission.status = "paid";
    commission.paidAt = now;
    commission.payoutTxHash = payoutTxHash;
    await this.storage.updateCommission(commission);
    const referral = await this.storage.getReferral(commission.referralId);
    if (referral) {
      referral.pendingAmount = this.subtractAmounts(referral.pendingAmount, commission.commissionAmount);
      referral.paidAmount = this.addAmounts(referral.paidAmount, commission.commissionAmount);
      referral.updatedAt = now;
      await this.storage.updateReferral(referral);
    }
    return commission;
  }
  /**
   * Get referral statistics for a referrer
   */
  async getStats(referrerAddress) {
    const commissions = await this.storage.getCommissionsByReferrer(referrerAddress);
    let totalReferrals = 0;
    let confirmedReferrals = 0;
    let pendingReferrals = 0;
    let totalEarned = 0;
    let pendingPayout = 0;
    let paidOut = 0;
    for (const commission of commissions) {
      totalReferrals++;
      if (commission.status === "confirmed") {
        confirmedReferrals++;
        pendingPayout += parseFloat(commission.commissionAmount);
        totalEarned += parseFloat(commission.commissionAmount);
      } else if (commission.status === "pending") {
        pendingReferrals++;
      } else if (commission.status === "paid") {
        confirmedReferrals++;
        paidOut += parseFloat(commission.commissionAmount);
        totalEarned += parseFloat(commission.commissionAmount);
      }
    }
    const conversionRate = totalReferrals > 0 ? confirmedReferrals / totalReferrals * 100 : 0;
    return {
      totalReferrals,
      confirmedReferrals,
      pendingReferrals,
      totalEarned: totalEarned.toString(),
      pendingPayout: pendingPayout.toString(),
      paidOut: paidOut.toString(),
      conversionRate: Math.round(conversionRate * 100) / 100
    };
  }
  /**
   * Disable a referral
   */
  async disableReferral(referralId) {
    const referral = await this.storage.getReferral(referralId);
    if (!referral) {
      throw new Error("Referral not found");
    }
    referral.status = "disabled";
    referral.updatedAt = /* @__PURE__ */ new Date();
    await this.storage.updateReferral(referral);
    return referral;
  }
  /**
   * Get pending commissions for payout
   */
  async getPendingCommissions(referrerAddress) {
    return this.storage.getPendingCommissions(referrerAddress);
  }
  /**
   * Helper: Add string amounts
   */
  addAmounts(a, b) {
    const result = parseFloat(a) + parseFloat(b);
    return result.toFixed(8).replace(/\.?0+$/, "");
  }
  /**
   * Helper: Subtract string amounts
   */
  subtractAmounts(a, b) {
    const result = parseFloat(a) - parseFloat(b);
    return Math.max(0, result).toFixed(8).replace(/\.?0+$/, "");
  }
};
function createReferralManager(storage) {
  return new ReferralManager(storage);
}
function buildReferralUrl(baseUrl, linkId, referralCode) {
  return `${baseUrl}/pay/${linkId}?ref=${referralCode}`;
}
function parseReferralCode(input) {
  try {
    const url = new URL(input);
    const ref = url.searchParams.get("ref");
    if (ref && isValidReferralCode(ref)) {
      return ref.toUpperCase();
    }
  } catch {
    if (isValidReferralCode(input)) {
      return input.toUpperCase();
    }
  }
  return null;
}

// lib/installment.ts
var DEFAULT_INSTALLMENT_CONFIG = {
  enabled: true,
  totalInstallments: 4,
  intervalDays: 30,
  downPaymentPercent: 25,
  gracePeriodDays: 3,
  autoSuspend: true
};
function calculateInstallmentAmounts(totalAmount, totalInstallments, downPaymentPercent = 25) {
  const total = parseFloat(totalAmount);
  if (isNaN(total) || total <= 0) {
    throw new Error("Invalid total amount");
  }
  if (totalInstallments < 2) {
    throw new Error("Minimum 2 installments required");
  }
  if (downPaymentPercent < 0 || downPaymentPercent > 100) {
    throw new Error("Down payment percent must be between 0 and 100");
  }
  const amounts = [];
  const downPayment = total * (downPaymentPercent / 100);
  amounts.push(downPayment.toFixed(8));
  const remaining = total - downPayment;
  const regularAmount = remaining / (totalInstallments - 1);
  for (let i = 1; i < totalInstallments; i++) {
    amounts.push(regularAmount.toFixed(8));
  }
  return amounts;
}
function calculateNextDueDate(fromDate, intervalDays) {
  const next = new Date(fromDate);
  next.setDate(next.getDate() + intervalDays);
  return next;
}
function calculateDueDates(startDate, totalInstallments, intervalDays) {
  const dates = [startDate];
  for (let i = 1; i < totalInstallments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + intervalDays * i);
    dates.push(dueDate);
  }
  return dates;
}
function isInstallmentOverdue(dueDate, gracePeriodDays = 3) {
  const now = /* @__PURE__ */ new Date();
  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + gracePeriodDays);
  return now > graceEnd;
}
function isInGracePeriod(dueDate, gracePeriodDays = 3) {
  const now = /* @__PURE__ */ new Date();
  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + gracePeriodDays);
  return now > dueDate && now <= graceEnd;
}
function getInstallmentProgress(plan) {
  const paidAmount = parseFloat(plan.paidAmount);
  const totalAmount = parseFloat(plan.totalAmount);
  const remainingAmount = totalAmount - paidAmount;
  return {
    paidCount: plan.completedInstallments,
    remainingCount: plan.totalInstallments - plan.completedInstallments,
    paidAmount: plan.paidAmount,
    remainingAmount: remainingAmount.toFixed(8),
    percentComplete: Math.round(paidAmount / totalAmount * 100),
    isComplete: plan.completedInstallments >= plan.totalInstallments
  };
}
function formatInstallmentSchedule(plan, payments) {
  const schedule = [];
  const dueDates = calculateDueDates(
    plan.createdAt,
    plan.totalInstallments,
    plan.intervalDays
  );
  for (let i = 0; i < plan.totalInstallments; i++) {
    const payment = payments.find((p) => p.installmentNumber === i + 1);
    const dueDate = dueDates[i];
    const now = /* @__PURE__ */ new Date();
    let status;
    if (payment?.status === "confirmed") {
      status = "paid";
    } else if (i < plan.completedInstallments) {
      status = "paid";
    } else if (i === plan.completedInstallments) {
      if (isInstallmentOverdue(dueDate, plan.gracePeriodDays)) {
        status = "overdue";
      } else {
        status = "current";
      }
    } else {
      status = "upcoming";
    }
    schedule.push({
      number: i + 1,
      amount: plan.installmentAmounts[i] || "0",
      dueDate: dueDate.toISOString(),
      status,
      paidAt: payment?.confirmedAt?.toISOString(),
      txHash: payment?.txHash
    });
  }
  return schedule;
}
var InstallmentManager = class {
  constructor(storage) {
    this.storage = storage;
  }
  /**
   * Create a new installment plan
   */
  async createPlan(input) {
    const payLink = await this.storage.getPayLink(input.payLinkId);
    if (!payLink) {
      throw new Error("PayLink not found");
    }
    if (!payLink.installment?.enabled) {
      throw new Error("Installments not enabled for this link");
    }
    const existing = await this.storage.getInstallmentPlanByAddress(
      input.payLinkId,
      input.buyerAddress
    );
    if (existing && existing.status !== "completed" && existing.status !== "cancelled") {
      throw new Error("Active installment plan already exists for this buyer");
    }
    const config = payLink.installment;
    const totalAmount = payLink.price.amount;
    const totalInstallments = config.totalInstallments || 4;
    const downPaymentPercent = config.downPaymentPercent ?? 25;
    const intervalDays = config.intervalDays || 30;
    const gracePeriodDays = config.gracePeriodDays ?? 3;
    const installmentAmounts = calculateInstallmentAmounts(
      totalAmount,
      totalInstallments,
      downPaymentPercent
    );
    const now = /* @__PURE__ */ new Date();
    const firstDueDate = now;
    const plan = {
      id: generateUUID(),
      payLinkId: input.payLinkId,
      buyerAddress: input.buyerAddress,
      status: "pending",
      totalAmount,
      paidAmount: "0",
      totalInstallments,
      completedInstallments: 0,
      installmentAmounts,
      intervalDays,
      gracePeriodDays,
      nextDueDate: firstDueDate,
      nextInstallmentNumber: 1,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata
    };
    await this.storage.saveInstallmentPlan(plan);
    return plan;
  }
  /**
   * Get installment plan by ID
   */
  async getPlan(id) {
    return this.storage.getInstallmentPlan(id);
  }
  /**
   * Get plan by buyer address
   */
  async getPlanByAddress(payLinkId, buyerAddress) {
    return this.storage.getInstallmentPlanByAddress(payLinkId, buyerAddress);
  }
  /**
   * Process an installment payment
   */
  async processPayment(planId, payment) {
    const plan = await this.storage.getInstallmentPlan(planId);
    if (!plan) {
      throw new Error("Installment plan not found");
    }
    if (plan.status === "completed") {
      throw new Error("Installment plan already completed");
    }
    if (plan.status === "cancelled") {
      throw new Error("Installment plan was cancelled");
    }
    const installmentNumber = plan.nextInstallmentNumber;
    const expectedAmount = plan.installmentAmounts[installmentNumber - 1];
    const installmentPayment = {
      id: generateUUID(),
      installmentPlanId: planId,
      paymentId: payment.id,
      payLinkId: plan.payLinkId,
      buyerAddress: plan.buyerAddress,
      installmentNumber,
      amount: payment.amount,
      expectedAmount,
      txHash: payment.txHash,
      chainId: payment.chainId,
      tokenSymbol: payment.tokenSymbol || "SOL",
      status: "pending",
      dueDate: plan.nextDueDate,
      createdAt: /* @__PURE__ */ new Date()
    };
    await this.storage.saveInstallmentPayment(installmentPayment);
    return installmentPayment;
  }
  /**
   * Confirm an installment payment
   */
  async confirmPayment(installmentPaymentId) {
    const payment = await this.storage.getInstallmentPayment(installmentPaymentId);
    if (!payment) {
      throw new Error("Installment payment not found");
    }
    const plan = await this.storage.getInstallmentPlan(payment.installmentPlanId);
    if (!plan) {
      throw new Error("Installment plan not found");
    }
    payment.status = "confirmed";
    payment.confirmedAt = /* @__PURE__ */ new Date();
    await this.storage.updateInstallmentPayment(payment);
    const paidAmount = parseFloat(plan.paidAmount) + parseFloat(payment.amount);
    plan.paidAmount = paidAmount.toFixed(8);
    plan.completedInstallments++;
    plan.updatedAt = /* @__PURE__ */ new Date();
    if (plan.completedInstallments === 1 && plan.status === "pending") {
      plan.status = "active";
      plan.activatedAt = /* @__PURE__ */ new Date();
    }
    if (plan.completedInstallments >= plan.totalInstallments) {
      plan.status = "completed";
      plan.completedAt = /* @__PURE__ */ new Date();
    } else {
      plan.nextInstallmentNumber++;
      plan.nextDueDate = calculateNextDueDate(
        plan.nextDueDate,
        plan.intervalDays
      );
      if (plan.status === "suspended") {
        plan.status = "active";
        plan.suspendedAt = void 0;
      }
    }
    await this.storage.updateInstallmentPlan(plan);
    return { payment, plan };
  }
  /**
   * Suspend a plan due to missed payment
   */
  async suspendPlan(planId, reason) {
    const plan = await this.storage.getInstallmentPlan(planId);
    if (!plan) {
      throw new Error("Installment plan not found");
    }
    if (plan.status !== "active") {
      throw new Error("Can only suspend active plans");
    }
    plan.status = "suspended";
    plan.suspendedAt = /* @__PURE__ */ new Date();
    plan.updatedAt = /* @__PURE__ */ new Date();
    if (reason) {
      plan.metadata = { ...plan.metadata, suspendReason: reason };
    }
    await this.storage.updateInstallmentPlan(plan);
    return plan;
  }
  /**
   * Cancel an installment plan
   */
  async cancelPlan(planId, reason) {
    const plan = await this.storage.getInstallmentPlan(planId);
    if (!plan) {
      throw new Error("Installment plan not found");
    }
    if (plan.status === "completed") {
      throw new Error("Cannot cancel completed plan");
    }
    plan.status = "cancelled";
    plan.cancelledAt = /* @__PURE__ */ new Date();
    plan.updatedAt = /* @__PURE__ */ new Date();
    if (reason) {
      plan.metadata = { ...plan.metadata, cancelReason: reason };
    }
    await this.storage.updateInstallmentPlan(plan);
    return plan;
  }
  /**
   * Get all payments for a plan
   */
  async getPlanPayments(planId) {
    return this.storage.getInstallmentPaymentsByPlan(planId);
  }
  /**
   * Get overdue plans
   */
  async getOverduePlans() {
    return this.storage.getOverdueInstallmentPlans();
  }
  /**
   * Get plans due soon (within N days)
   */
  async getPlansDueSoon(withinDays = 3) {
    const cutoff = /* @__PURE__ */ new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return this.storage.getInstallmentPlansDueBefore(cutoff);
  }
  /**
   * Check and suspend overdue plans
   */
  async processOverduePlans() {
    const overdue = await this.getOverduePlans();
    const suspended = [];
    for (const plan of overdue) {
      if (plan.status === "active") {
        const updated = await this.suspendPlan(plan.id, "Payment overdue");
        suspended.push(updated);
      }
    }
    return suspended;
  }
  /**
   * Get installment plan details with schedule
   */
  async getPlanDetails(planId) {
    const plan = await this.storage.getInstallmentPlan(planId);
    if (!plan) {
      return null;
    }
    const payments = await this.storage.getInstallmentPaymentsByPlan(planId);
    const schedule = formatInstallmentSchedule(plan, payments);
    const progress = getInstallmentProgress(plan);
    return {
      plan,
      payments,
      schedule,
      progress
    };
  }
  /**
   * Check if buyer has active access
   */
  async hasActiveAccess(payLinkId, buyerAddress) {
    const plan = await this.storage.getInstallmentPlanByAddress(
      payLinkId,
      buyerAddress
    );
    if (!plan) {
      return false;
    }
    return plan.status === "active" || plan.status === "completed";
  }
};
function createInstallmentManager(storage) {
  return new InstallmentManager(storage);
}

// lib/server.ts
var PaylinkServer = class {
  app;
  config;
  storage;
  verifiers;
  webhookManager;
  subscriptionManager;
  referralManager;
  installmentManager;
  subscriptionCheckInterval;
  installmentCheckInterval;
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
      webhook: config.webhook,
      paylinkToken: config.paylinkToken
    };
    this.storage = new MemoryStorage();
    this.verifiers = /* @__PURE__ */ new Map();
    this.subscriptionManager = new SubscriptionManager(this.storage);
    this.referralManager = new ReferralManager(this.storage);
    this.installmentManager = new InstallmentManager(this.storage);
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
    this.subscriptionManager = new SubscriptionManager(storage);
    this.referralManager = new ReferralManager(storage);
    this.installmentManager = new InstallmentManager(storage);
  }
  /**
   * Get subscription manager
   */
  getSubscriptionManager() {
    return this.subscriptionManager;
  }
  /**
   * Get referral manager
   */
  getReferralManager() {
    return this.referralManager;
  }
  /**
   * Get installment manager
   */
  getInstallmentManager() {
    return this.installmentManager;
  }
  /**
   * Start server
   */
  start() {
    this.startSubscriptionCheck();
    this.startInstallmentCheck();
    this.app.listen(this.config.port, () => {
      console.log("");
      console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
      console.log("\u2551              Paylink Protocol Server v1.7.0              \u2551");
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
      paymentOptions: input.paymentOptions,
      recipientAddress: input.recipientAddress,
      status: "active",
      createdAt: now,
      updatedAt: now,
      description: input.description,
      maxUses: input.maxUses,
      usedCount: 0,
      expiresAt: input.expiresAt,
      metadata: input.metadata,
      subscription: input.subscription,
      multiUse: input.multiUse,
      referral: input.referral
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
  // SUBSCRIPTION METHODS
  // ========================================
  /**
   * Create a subscription for a subscriber
   */
  async createSubscription(payLinkId, subscriberAddress, metadata) {
    const link = await this.storage.getPayLink(payLinkId);
    if (!link) throw new Error("PayLink not found");
    if (!link.subscription) throw new Error("PayLink is not a subscription link");
    const subscription = await this.subscriptionManager.createSubscription(link, {
      payLinkId,
      subscriberAddress,
      metadata
    });
    if (this.webhookManager) {
      this.webhookManager.sendSubscriptionEvent("subscription.created", subscription, link).catch((err) => {
        console.error("Webhook error:", err);
      });
    }
    return subscription;
  }
  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId) {
    const subscription = await this.subscriptionManager.cancelSubscription(subscriptionId);
    const link = await this.storage.getPayLink(subscription.payLinkId);
    if (this.webhookManager && link) {
      this.webhookManager.sendSubscriptionEvent("subscription.cancelled", subscription, link).catch((err) => {
        console.error("Webhook error:", err);
      });
    }
    return subscription;
  }
  /**
   * Pause a subscription
   */
  async pauseSubscription(subscriptionId) {
    const subscription = await this.subscriptionManager.pauseSubscription(subscriptionId);
    const link = await this.storage.getPayLink(subscription.payLinkId);
    if (this.webhookManager && link) {
      this.webhookManager.sendSubscriptionEvent("subscription.paused", subscription, link).catch((err) => {
        console.error("Webhook error:", err);
      });
    }
    return subscription;
  }
  /**
   * Resume a subscription
   */
  async resumeSubscription(subscriptionId) {
    const subscription = await this.subscriptionManager.resumeSubscription(subscriptionId);
    const link = await this.storage.getPayLink(subscription.payLinkId);
    if (this.webhookManager && link) {
      this.webhookManager.sendSubscriptionEvent("subscription.resumed", subscription, link).catch((err) => {
        console.error("Webhook error:", err);
      });
    }
    return subscription;
  }
  /**
   * Get subscription by ID
   */
  async getSubscription(id) {
    return this.subscriptionManager.getSubscription(id);
  }
  /**
   * Start periodic subscription check
   */
  startSubscriptionCheck() {
    this.subscriptionCheckInterval = setInterval(async () => {
      try {
        const dueSubscriptions = await this.subscriptionManager.getDueSubscriptions();
        for (const sub of dueSubscriptions) {
          const link = await this.storage.getPayLink(sub.payLinkId);
          if (!link) continue;
          const gracePeriodHours = link.subscription?.gracePeriodHours ?? 24;
          const graceEnd = new Date(sub.nextPaymentDue);
          graceEnd.setHours(graceEnd.getHours() + gracePeriodHours);
          const now = /* @__PURE__ */ new Date();
          if (now > graceEnd && sub.status === "active") {
            await this.subscriptionManager.markPastDue(sub.id);
            if (this.webhookManager) {
              const updated = await this.subscriptionManager.getSubscription(sub.id);
              if (updated) {
                this.webhookManager.sendSubscriptionEvent("subscription.past_due", updated, link).catch((err) => {
                  console.error("Webhook error:", err);
                });
              }
            }
          } else if (sub.status === "active") {
            if (this.webhookManager) {
              this.webhookManager.sendSubscriptionEvent("subscription.payment_due", sub, link).catch((err) => {
                console.error("Webhook error:", err);
              });
            }
          }
        }
      } catch (error) {
        console.error("Subscription check error:", error);
      }
    }, 6e4);
  }
  /**
   * Stop subscription check
   */
  stopSubscriptionCheck() {
    if (this.subscriptionCheckInterval) {
      clearInterval(this.subscriptionCheckInterval);
      this.subscriptionCheckInterval = void 0;
    }
  }
  /**
   * Start periodic installment check
   */
  startInstallmentCheck() {
    this.installmentCheckInterval = setInterval(async () => {
      try {
        const overduePlans = await this.installmentManager.getOverduePlans();
        for (const plan of overduePlans) {
          if (plan.status === "active") {
            const link = await this.storage.getPayLink(plan.payLinkId);
            if (!link?.installment?.autoSuspend) continue;
            const suspended = await this.installmentManager.suspendPlan(plan.id, "Payment overdue");
            if (this.webhookManager && link) {
              this.webhookManager.sendInstallmentEvent("installment.plan_suspended", suspended, link).catch((err) => {
                console.error("Installment webhook error:", err);
              });
            }
          }
        }
        const dueSoon = await this.installmentManager.getPlansDueSoon(3);
        for (const plan of dueSoon) {
          if (plan.status !== "active") continue;
          const link = await this.storage.getPayLink(plan.payLinkId);
          if (!link) continue;
          if (this.webhookManager) {
            this.webhookManager.sendInstallmentEvent("installment.payment_due", plan, link).catch((err) => {
              console.error("Installment webhook error:", err);
            });
          }
        }
      } catch (error) {
        console.error("Installment check error:", error);
      }
    }, 3e5);
  }
  /**
   * Stop installment check
   */
  stopInstallmentCheck() {
    if (this.installmentCheckInterval) {
      clearInterval(this.installmentCheckInterval);
      this.installmentCheckInterval = void 0;
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
        version: "1.7.0",
        chains: this.config.chains.map((c) => ({ id: c.chainId, name: c.name, symbol: c.symbol })),
        endpoints: {
          paylink: `${base}${this.config.basePath}/:id`,
          status: `${base}${this.config.basePath}/:id/status`,
          confirm: `${base}${this.config.basePath}/:id/confirm`,
          subscribe: `${base}${this.config.basePath}/:id/subscribe`,
          installment: `${base}${this.config.basePath}/:id/installment`
        }
      });
    });
    this.app.get(`${this.config.basePath}/:id`, this.handlePayLink.bind(this));
    this.app.get(`${this.config.basePath}/:id/status`, this.handleStatus.bind(this));
    this.app.post(`${this.config.basePath}/:id/confirm`, this.handleConfirm.bind(this));
    this.app.get(`${this.config.basePath}/:id/qr`, this.handleQRCode.bind(this));
    this.app.post(`${this.config.basePath}/:id/subscribe`, this.handleSubscribe.bind(this));
    this.app.get(`${this.config.basePath}/:id/subscription`, this.handleGetSubscription.bind(this));
    if (this.config.apiKey) {
      const auth = this.authMiddleware.bind(this);
      this.app.post("/api/links", auth, this.apiCreateLink.bind(this));
      this.app.get("/api/links", auth, this.apiListLinks.bind(this));
      this.app.get("/api/links/:id", auth, this.apiGetLink.bind(this));
      this.app.delete("/api/links/:id", auth, this.apiDeleteLink.bind(this));
      this.app.get("/api/payments", auth, this.apiListPayments.bind(this));
      this.app.get("/api/subscriptions", auth, this.apiListSubscriptions.bind(this));
      this.app.get("/api/subscriptions/:id", auth, this.apiGetSubscription.bind(this));
      this.app.post("/api/subscriptions/:id/cancel", auth, this.apiCancelSubscription.bind(this));
      this.app.post("/api/subscriptions/:id/pause", auth, this.apiPauseSubscription.bind(this));
      this.app.post("/api/subscriptions/:id/resume", auth, this.apiResumeSubscription.bind(this));
      this.app.post("/api/referrals", auth, this.apiCreateReferral.bind(this));
      this.app.get("/api/referrals", auth, this.apiListReferrals.bind(this));
      this.app.get("/api/referrals/:id", auth, this.apiGetReferral.bind(this));
      this.app.get("/api/referrals/code/:code", auth, this.apiGetReferralByCode.bind(this));
      this.app.post("/api/referrals/:id/disable", auth, this.apiDisableReferral.bind(this));
      this.app.get("/api/referrals/:id/stats", auth, this.apiGetReferralStats.bind(this));
      this.app.get("/api/commissions", auth, this.apiListCommissions.bind(this));
      this.app.get("/api/commissions/pending/:address", auth, this.apiGetPendingCommissions.bind(this));
      this.app.post("/api/commissions/:id/payout", auth, this.apiMarkCommissionPaid.bind(this));
      this.app.post("/api/installments", auth, this.apiCreateInstallmentPlan.bind(this));
      this.app.get("/api/installments", auth, this.apiListInstallmentPlans.bind(this));
      this.app.get("/api/installments/:id", auth, this.apiGetInstallmentPlan.bind(this));
      this.app.get("/api/installments/:id/schedule", auth, this.apiGetInstallmentSchedule.bind(this));
      this.app.post("/api/installments/:id/payment", auth, this.apiProcessInstallmentPayment.bind(this));
      this.app.post("/api/installments/:id/suspend", auth, this.apiSuspendInstallmentPlan.bind(this));
      this.app.post("/api/installments/:id/cancel", auth, this.apiCancelInstallmentPlan.bind(this));
      this.app.get("/api/installments/buyer/:address", auth, this.apiGetBuyerInstallments.bind(this));
      this.app.get("/api/installments/overdue", auth, this.apiGetOverdueInstallments.bind(this));
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
      if (!link.subscription && !link.multiUse && isLimitReached(link.usedCount, link.maxUses)) {
        this.send403(res, "LINK_USAGE_LIMIT_REACHED" /* LINK_USAGE_LIMIT_REACHED */, link.id, {
          maxUses: link.maxUses,
          usedCount: link.usedCount
        });
        return;
      }
      if (link.subscription) {
        const subscriberAddress = req.query.subscriber;
        if (subscriberAddress) {
          const subscription = await this.storage.getSubscriptionByAddress(link.id, subscriberAddress);
          if (subscription) {
            const access = await this.subscriptionManager.checkAccess(subscription, link);
            if (access.hasAccess) {
              res.redirect(302, link.targetUrl);
              return;
            }
            if (subscription.status === "cancelled") {
              this.send403(res, "SUBSCRIPTION_CANCELLED" /* SUBSCRIPTION_CANCELLED */, link.id, {
                subscriptionId: subscription.id,
                cancelledAt: subscription.cancelledAt?.toISOString()
              });
              return;
            }
            if (subscription.status === "paused") {
              this.send403(res, "SUBSCRIPTION_PAUSED" /* SUBSCRIPTION_PAUSED */, link.id, {
                subscriptionId: subscription.id,
                pausedAt: subscription.pausedAt?.toISOString()
              });
              return;
            }
            if (subscription.status === "expired") {
              this.send403(res, "SUBSCRIPTION_EXPIRED" /* SUBSCRIPTION_EXPIRED */, link.id, {
                subscriptionId: subscription.id
              });
              return;
            }
            if (subscription.status === "past_due") {
              this.send402(res, link, subscription);
              return;
            }
          }
        }
        this.send402(res, link);
        return;
      }
      if (link.multiUse) {
        const payerAddress = req.query.payer;
        if (!payerAddress) {
          this.send402(res, link);
          return;
        }
        const payment2 = await this.storage.getConfirmedPaymentByAddress(link.id, payerAddress);
        if (payment2) {
          if (link.maxUses && (link.usedCount ?? 0) >= link.maxUses) {
            this.send403(res, "LINK_USAGE_LIMIT_REACHED" /* LINK_USAGE_LIMIT_REACHED */, link.id, {
              maxUses: link.maxUses,
              usedCount: link.usedCount
            });
            return;
          }
          link.usedCount = (link.usedCount ?? 0) + 1;
          await this.storage.updatePayLink(link);
          res.redirect(302, link.targetUrl);
          return;
        }
        this.send402(res, link);
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
      if (isExpired(link.expiresAt)) {
        res.json({ status: "forbidden" });
        return;
      }
      if (link.multiUse) {
        const payerAddress = req.query.payer;
        if (!payerAddress) {
          res.json({
            status: "multiUse",
            message: "Provide ?payer=ADDRESS to check payment status",
            totalPayments: (await this.storage.getPaymentsByLink(link.id)).filter((p) => p.confirmed).length
          });
          return;
        }
        const payment2 = await this.storage.getConfirmedPaymentByAddress(link.id, payerAddress);
        res.json({
          status: payment2 ? "paid" : "unpaid",
          payerAddress
        });
        return;
      }
      if (isLimitReached(link.usedCount, link.maxUses)) {
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
      const { txHash, chainId: requestedChainId, referralCode } = req.body;
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
      let chainId = link.price.chainId;
      let expectedAmount = link.price.amount;
      let recipient = link.recipientAddress;
      let tokenSymbol = link.price.tokenSymbol;
      if (requestedChainId !== void 0) {
        const numChainId = Number(requestedChainId);
        if (numChainId === link.price.chainId) {
          chainId = link.price.chainId;
          expectedAmount = link.price.amount;
          tokenSymbol = link.price.tokenSymbol;
        } else if (link.paymentOptions) {
          const option = link.paymentOptions.find((opt) => opt.chainId === numChainId);
          if (option) {
            chainId = option.chainId;
            expectedAmount = option.amount;
            tokenSymbol = option.tokenSymbol;
            recipient = option.recipientAddress || link.recipientAddress;
          } else {
            res.status(400).json({ status: "failed", message: "Chain not accepted for this payment link" });
            return;
          }
        } else {
          res.status(400).json({ status: "failed", message: "Chain not accepted for this payment link" });
          return;
        }
      }
      const verifier = this.verifiers.get(chainId);
      if (!verifier) {
        res.status(400).json({ status: "failed", message: "Chain not supported by server" });
        return;
      }
      const result = await verifier.verifyPayment({
        txHash,
        recipient,
        amount: expectedAmount
      });
      switch (result.status) {
        case "confirmed": {
          const payment = {
            id: generateUUID(),
            payLinkId: link.id,
            chainId,
            txHash,
            fromAddress: result.fromAddress ?? "",
            amount: result.actualAmount ?? expectedAmount,
            tokenSymbol,
            confirmed: true,
            createdAt: /* @__PURE__ */ new Date(),
            confirmedAt: /* @__PURE__ */ new Date(),
            referralCode: referralCode || void 0
          };
          await this.storage.savePayment(payment);
          let commission = null;
          if (referralCode && link.referral?.enabled) {
            try {
              commission = await this.referralManager.processReferralPayment(
                payment,
                link,
                referralCode
              );
              if (commission && this.webhookManager) {
                const referral = await this.storage.getReferral(commission.referralId);
                if (referral) {
                  this.webhookManager.sendCommissionEvent(
                    "commission.confirmed",
                    commission,
                    referral,
                    link
                  ).catch((err) => {
                    console.error("Commission webhook error:", err);
                  });
                }
              }
            } catch (err) {
              console.error("Referral processing error:", err);
            }
          }
          if (this.webhookManager) {
            this.webhookManager.sendPaymentEvent("payment.confirmed", payment, link).catch((err) => {
              console.error("Webhook error:", err);
            });
          }
          res.json({
            status: "confirmed",
            chainId,
            tokenSymbol,
            referral: commission ? {
              commissionId: commission.id,
              commissionAmount: commission.commissionAmount
            } : void 0
          });
          break;
        }
        case "pending":
          if (this.webhookManager) {
            const pendingPayment = {
              id: generateUUID(),
              payLinkId: link.id,
              chainId,
              txHash,
              fromAddress: result.fromAddress ?? "",
              amount: result.actualAmount ?? expectedAmount,
              tokenSymbol,
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
              chainId,
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
  // SUBSCRIPTION HANDLERS
  // ========================================
  /**
   * Handle subscription creation/renewal
   */
  async handleSubscribe(req, res) {
    try {
      const { subscriberAddress, txHash } = req.body;
      if (!subscriberAddress) {
        res.status(400).json({ error: "Missing subscriberAddress" });
        return;
      }
      const link = await this.storage.getPayLink(req.params.id);
      if (!link) {
        res.status(404).json({ error: "Payment link not found" });
        return;
      }
      if (!link.subscription) {
        res.status(400).json({ error: "This link does not support subscriptions" });
        return;
      }
      let subscription = await this.storage.getSubscriptionByAddress(link.id, subscriberAddress);
      if (txHash) {
        const verifier = this.verifiers.get(link.price.chainId);
        if (!verifier) {
          res.status(400).json({ error: "Chain not supported" });
          return;
        }
        const result = await verifier.verifyPayment({
          txHash,
          recipient: link.recipientAddress,
          amount: link.price.amount
        });
        if (result.status !== "confirmed") {
          res.status(400).json({
            error: "Payment not confirmed",
            status: result.status
          });
          return;
        }
        const payment = {
          id: generateUUID(),
          payLinkId: link.id,
          chainId: link.price.chainId,
          txHash,
          fromAddress: result.fromAddress ?? subscriberAddress,
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
        if (subscription) {
          subscription = await this.subscriptionManager.processPayment(subscription, payment, link);
          if (this.webhookManager) {
            this.webhookManager.sendSubscriptionEvent("subscription.renewed", subscription, link).catch((err) => {
              console.error("Webhook error:", err);
            });
          }
          res.json({
            success: true,
            action: "renewed",
            subscription: this.formatSubscriptionResponse(subscription, link)
          });
          return;
        }
      }
      if (!subscription) {
        subscription = await this.createSubscription(link.id, subscriberAddress);
        res.status(201).json({
          success: true,
          action: "created",
          subscription: this.formatSubscriptionResponse(subscription, link)
        });
        return;
      }
      res.json({
        success: true,
        action: "existing",
        subscription: this.formatSubscriptionResponse(subscription, link)
      });
    } catch (error) {
      console.error("Subscribe error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  /**
   * Handle get subscription status
   */
  async handleGetSubscription(req, res) {
    try {
      const subscriberAddress = req.query.subscriber;
      if (!subscriberAddress) {
        res.status(400).json({ error: "Missing subscriber query parameter" });
        return;
      }
      const link = await this.storage.getPayLink(req.params.id);
      if (!link) {
        res.status(404).json({ error: "Payment link not found" });
        return;
      }
      const subscription = await this.storage.getSubscriptionByAddress(link.id, subscriberAddress);
      if (!subscription) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }
      const access = await this.subscriptionManager.checkAccess(subscription, link);
      res.json({
        subscription: this.formatSubscriptionResponse(subscription, link),
        access: {
          hasAccess: access.hasAccess,
          reason: access.reason,
          requiresPayment: access.requiresPayment
        }
      });
    } catch (error) {
      console.error("Get subscription error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  /**
   * Format subscription for response
   */
  formatSubscriptionResponse(subscription, link) {
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
      renewUrl: `${base}${this.config.basePath}/${link.id}/subscribe`
    };
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
        expiresIn,
        // Multi-currency payment options
        paymentOptions,
        // Subscription fields
        subscription,
        // Multi-use mode
        multiUse,
        // Referral configuration
        referral
      } = req.body;
      if (!targetUrl || !amount || !recipientAddress) {
        res.status(400).json({ error: "Missing: targetUrl, amount, or recipientAddress" });
        return;
      }
      let parsedPaymentOptions;
      if (paymentOptions && Array.isArray(paymentOptions)) {
        parsedPaymentOptions = paymentOptions.map((opt) => ({
          tokenSymbol: opt.tokenSymbol,
          chainId: Number(opt.chainId),
          amount: String(opt.amount),
          recipientAddress: opt.recipientAddress
        }));
      }
      let subscriptionConfig;
      if (subscription) {
        if (!subscription.interval || !["daily", "weekly", "monthly", "yearly"].includes(subscription.interval)) {
          res.status(400).json({ error: "Invalid subscription interval. Must be: daily, weekly, monthly, or yearly" });
          return;
        }
        subscriptionConfig = {
          interval: subscription.interval,
          intervalCount: subscription.intervalCount ? Number(subscription.intervalCount) : 1,
          gracePeriodHours: subscription.gracePeriodHours ? Number(subscription.gracePeriodHours) : 24,
          maxCycles: subscription.maxCycles ? Number(subscription.maxCycles) : void 0,
          trialDays: subscription.trialDays ? Number(subscription.trialDays) : 0
        };
      }
      let referralConfig;
      if (referral && referral.enabled) {
        referralConfig = {
          enabled: true,
          commissionPercent: referral.commissionPercent ? Number(referral.commissionPercent) : 10,
          minPayoutThreshold: referral.minPayoutThreshold ? String(referral.minPayoutThreshold) : void 0,
          expirationDays: referral.expirationDays ? Number(referral.expirationDays) : void 0
        };
      }
      const link = await this.createPayLink({
        targetUrl,
        price: { amount: String(amount), tokenSymbol, chainId: Number(chainId) },
        paymentOptions: parsedPaymentOptions,
        recipientAddress,
        description,
        maxUses: maxUses ? Number(maxUses) : void 0,
        expiresAt: expiresIn ? new Date(Date.now() + Number(expiresIn) * 1e3) : void 0,
        subscription: subscriptionConfig,
        multiUse: multiUse === true || multiUse === "true",
        referral: referralConfig
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
            subscribeUrl: `${base}${this.config.basePath}/${link.id}/subscribe`
          } : void 0,
          referral: link.referral ? {
            enabled: link.referral.enabled,
            commissionPercent: link.referral.commissionPercent,
            minPayoutThreshold: link.referral.minPayoutThreshold,
            expirationDays: link.referral.expirationDays
          } : void 0
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
        usedCount: l.usedCount,
        isSubscription: !!l.subscription,
        subscription: l.subscription
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
  // SUBSCRIPTION ADMIN ENDPOINTS
  // ========================================
  async apiListSubscriptions(req, res) {
    const subscriptions = await this.storage.getAllSubscriptions();
    res.json({
      count: subscriptions.length,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        payLinkId: s.payLinkId,
        subscriberAddress: s.subscriberAddress,
        status: s.status,
        cycleCount: s.cycleCount,
        nextPaymentDue: s.nextPaymentDue.toISOString(),
        createdAt: s.createdAt.toISOString()
      }))
    });
  }
  async apiGetSubscription(req, res) {
    const subscription = await this.storage.getSubscription(req.params.id);
    if (!subscription) {
      res.status(404).json({ error: "Subscription not found" });
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
        subscription: link.subscription
      } : void 0
    });
  }
  async apiCancelSubscription(req, res) {
    try {
      const subscription = await this.cancelSubscription(req.params.id);
      res.json({ success: true, subscription: { id: subscription.id, status: subscription.status } });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
  async apiPauseSubscription(req, res) {
    try {
      const subscription = await this.pauseSubscription(req.params.id);
      res.json({ success: true, subscription: { id: subscription.id, status: subscription.status } });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  async apiResumeSubscription(req, res) {
    try {
      const subscription = await this.resumeSubscription(req.params.id);
      res.json({ success: true, subscription: { id: subscription.id, status: subscription.status } });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  // ========================================
  // REFERRAL ADMIN ENDPOINTS
  // ========================================
  async apiCreateReferral(req, res) {
    try {
      const { payLinkId, referrerAddress, code, metadata } = req.body;
      if (!payLinkId || !referrerAddress) {
        res.status(400).json({ error: "Missing: payLinkId or referrerAddress" });
        return;
      }
      const referral = await this.referralManager.createReferral({
        payLinkId,
        referrerAddress,
        code,
        metadata
      });
      const link = await this.storage.getPayLink(payLinkId);
      const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
      if (this.webhookManager && link) {
        this.webhookManager.sendReferralEvent("referral.created", referral, link).catch((err) => {
          console.error("Referral webhook error:", err);
        });
      }
      res.status(201).json({
        success: true,
        referral: {
          id: referral.id,
          code: referral.code,
          referrerAddress: referral.referrerAddress,
          payLinkId: referral.payLinkId,
          status: referral.status,
          referralUrl: buildReferralUrl(base, payLinkId, referral.code),
          createdAt: referral.createdAt.toISOString()
        }
      });
    } catch (error) {
      console.error("Create referral error:", error);
      res.status(400).json({ error: error.message });
    }
  }
  async apiListReferrals(req, res) {
    try {
      const { payLinkId, referrerAddress } = req.query;
      let referrals;
      if (payLinkId) {
        referrals = await this.storage.getReferralsByPayLink(payLinkId);
      } else if (referrerAddress) {
        referrals = await this.storage.getReferralsByReferrer(referrerAddress);
      } else {
        referrals = await this.storage.getAllReferrals();
      }
      const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
      res.json({
        count: referrals.length,
        referrals: referrals.map((r) => ({
          id: r.id,
          code: r.code,
          referrerAddress: r.referrerAddress,
          payLinkId: r.payLinkId,
          totalReferrals: r.totalReferrals,
          confirmedReferrals: r.confirmedReferrals,
          totalEarned: r.totalEarned,
          pendingAmount: r.pendingAmount,
          paidAmount: r.paidAmount,
          status: r.status,
          referralUrl: buildReferralUrl(base, r.payLinkId, r.code),
          createdAt: r.createdAt.toISOString()
        }))
      });
    } catch (error) {
      console.error("List referrals error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async apiGetReferral(req, res) {
    try {
      const referral = await this.storage.getReferral(req.params.id);
      if (!referral) {
        res.status(404).json({ error: "Referral not found" });
        return;
      }
      const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
      res.json({
        id: referral.id,
        code: referral.code,
        referrerAddress: referral.referrerAddress,
        payLinkId: referral.payLinkId,
        totalReferrals: referral.totalReferrals,
        confirmedReferrals: referral.confirmedReferrals,
        totalEarned: referral.totalEarned,
        pendingAmount: referral.pendingAmount,
        paidAmount: referral.paidAmount,
        status: referral.status,
        referralUrl: buildReferralUrl(base, referral.payLinkId, referral.code),
        createdAt: referral.createdAt.toISOString(),
        updatedAt: referral.updatedAt.toISOString(),
        metadata: referral.metadata
      });
    } catch (error) {
      console.error("Get referral error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async apiGetReferralByCode(req, res) {
    try {
      const referral = await this.storage.getReferralByCode(req.params.code);
      if (!referral) {
        res.status(404).json({ error: "Referral not found" });
        return;
      }
      const base = this.config.baseUrl || `http://localhost:${this.config.port}`;
      res.json({
        id: referral.id,
        code: referral.code,
        referrerAddress: referral.referrerAddress,
        payLinkId: referral.payLinkId,
        totalReferrals: referral.totalReferrals,
        confirmedReferrals: referral.confirmedReferrals,
        totalEarned: referral.totalEarned,
        pendingAmount: referral.pendingAmount,
        status: referral.status,
        referralUrl: buildReferralUrl(base, referral.payLinkId, referral.code),
        createdAt: referral.createdAt.toISOString()
      });
    } catch (error) {
      console.error("Get referral by code error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async apiDisableReferral(req, res) {
    try {
      const referral = await this.referralManager.disableReferral(req.params.id);
      const link = await this.storage.getPayLink(referral.payLinkId);
      if (this.webhookManager && link) {
        this.webhookManager.sendReferralEvent("referral.disabled", referral, link).catch((err) => {
          console.error("Referral webhook error:", err);
        });
      }
      res.json({ success: true, referral: { id: referral.id, status: referral.status } });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
  async apiGetReferralStats(req, res) {
    try {
      const referral = await this.storage.getReferral(req.params.id);
      if (!referral) {
        res.status(404).json({ error: "Referral not found" });
        return;
      }
      const stats = await this.referralManager.getStats(referral.referrerAddress);
      res.json({
        referralId: referral.id,
        code: referral.code,
        stats
      });
    } catch (error) {
      console.error("Get referral stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async apiListCommissions(req, res) {
    try {
      const { referralId, referrerAddress, status } = req.query;
      let commissions;
      if (referralId) {
        commissions = await this.storage.getCommissionsByReferral(referralId);
      } else if (referrerAddress) {
        commissions = await this.storage.getCommissionsByReferrer(referrerAddress);
      } else {
        commissions = await this.storage.getAllCommissions();
      }
      if (status) {
        commissions = commissions.filter((c) => c.status === status);
      }
      res.json({
        count: commissions.length,
        commissions: commissions.map((c) => ({
          id: c.id,
          referralId: c.referralId,
          paymentId: c.paymentId,
          payLinkId: c.payLinkId,
          referrerAddress: c.referrerAddress,
          referredAddress: c.referredAddress,
          paymentAmount: c.paymentAmount,
          commissionAmount: c.commissionAmount,
          commissionPercent: c.commissionPercent,
          tokenSymbol: c.tokenSymbol,
          chainId: c.chainId,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          confirmedAt: c.confirmedAt?.toISOString(),
          paidAt: c.paidAt?.toISOString(),
          payoutTxHash: c.payoutTxHash
        }))
      });
    } catch (error) {
      console.error("List commissions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async apiGetPendingCommissions(req, res) {
    try {
      const commissions = await this.referralManager.getPendingCommissions(req.params.address);
      const totalPending = commissions.reduce(
        (sum, c) => sum + parseFloat(c.commissionAmount),
        0
      );
      res.json({
        address: req.params.address,
        count: commissions.length,
        totalPending: totalPending.toString(),
        commissions: commissions.map((c) => ({
          id: c.id,
          referralId: c.referralId,
          commissionAmount: c.commissionAmount,
          tokenSymbol: c.tokenSymbol,
          chainId: c.chainId,
          createdAt: c.createdAt.toISOString(),
          confirmedAt: c.confirmedAt?.toISOString()
        }))
      });
    } catch (error) {
      console.error("Get pending commissions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async apiMarkCommissionPaid(req, res) {
    try {
      const { payoutTxHash } = req.body;
      if (!payoutTxHash) {
        res.status(400).json({ error: "Missing payoutTxHash" });
        return;
      }
      const commission = await this.referralManager.markCommissionPaid(
        req.params.id,
        payoutTxHash
      );
      const referral = await this.storage.getReferral(commission.referralId);
      const link = await this.storage.getPayLink(commission.payLinkId);
      if (this.webhookManager && referral && link) {
        this.webhookManager.sendCommissionEvent("commission.paid", commission, referral, link).catch((err) => {
          console.error("Commission webhook error:", err);
        });
      }
      res.json({
        success: true,
        commission: {
          id: commission.id,
          status: commission.status,
          payoutTxHash: commission.payoutTxHash,
          paidAt: commission.paidAt?.toISOString()
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  // ========================================
  // INSTALLMENT API HANDLERS
  // ========================================
  async apiCreateInstallmentPlan(req, res) {
    try {
      const { payLinkId, buyerAddress, metadata } = req.body;
      if (!payLinkId || !buyerAddress) {
        res.status(400).json({ error: "Missing required fields: payLinkId, buyerAddress" });
        return;
      }
      const plan = await this.installmentManager.createPlan({
        payLinkId,
        buyerAddress,
        metadata
      });
      const link = await this.storage.getPayLink(payLinkId);
      if (this.webhookManager && link) {
        this.webhookManager.sendInstallmentEvent("installment.plan_created", plan, link).catch((err) => {
          console.error("Installment webhook error:", err);
        });
      }
      res.status(201).json({
        id: plan.id,
        payLinkId: plan.payLinkId,
        buyerAddress: plan.buyerAddress,
        status: plan.status,
        totalAmount: plan.totalAmount,
        totalInstallments: plan.totalInstallments,
        installmentAmounts: plan.installmentAmounts,
        intervalDays: plan.intervalDays,
        nextDueDate: plan.nextDueDate.toISOString(),
        nextInstallmentNumber: plan.nextInstallmentNumber,
        createdAt: plan.createdAt.toISOString()
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  async apiListInstallmentPlans(req, res) {
    try {
      const { payLinkId, buyerAddress, status } = req.query;
      let plans;
      if (payLinkId) {
        plans = await this.storage.getInstallmentPlansByPayLink(payLinkId);
      } else if (buyerAddress) {
        plans = await this.storage.getInstallmentPlansByBuyer(buyerAddress);
      } else {
        plans = await this.storage.getAllInstallmentPlans();
      }
      if (status) {
        plans = plans.filter((p) => p.status === status);
      }
      res.json({
        count: plans.length,
        plans: plans.map((p) => ({
          id: p.id,
          payLinkId: p.payLinkId,
          buyerAddress: p.buyerAddress,
          status: p.status,
          totalAmount: p.totalAmount,
          paidAmount: p.paidAmount,
          totalInstallments: p.totalInstallments,
          completedInstallments: p.completedInstallments,
          nextDueDate: p.nextDueDate.toISOString(),
          nextInstallmentNumber: p.nextInstallmentNumber,
          createdAt: p.createdAt.toISOString(),
          progress: getInstallmentProgress(p)
        }))
      });
    } catch (error) {
      console.error("List installment plans error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async apiGetInstallmentPlan(req, res) {
    try {
      const details = await this.installmentManager.getPlanDetails(req.params.id);
      if (!details) {
        res.status(404).json({ error: "Installment plan not found" });
        return;
      }
      const { plan, payments, schedule, progress } = details;
      res.json({
        id: plan.id,
        payLinkId: plan.payLinkId,
        buyerAddress: plan.buyerAddress,
        status: plan.status,
        totalAmount: plan.totalAmount,
        paidAmount: plan.paidAmount,
        totalInstallments: plan.totalInstallments,
        completedInstallments: plan.completedInstallments,
        installmentAmounts: plan.installmentAmounts,
        intervalDays: plan.intervalDays,
        gracePeriodDays: plan.gracePeriodDays,
        nextDueDate: plan.nextDueDate.toISOString(),
        nextInstallmentNumber: plan.nextInstallmentNumber,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
        activatedAt: plan.activatedAt?.toISOString(),
        completedAt: plan.completedAt?.toISOString(),
        suspendedAt: plan.suspendedAt?.toISOString(),
        cancelledAt: plan.cancelledAt?.toISOString(),
        progress,
        schedule,
        payments: payments.map((p) => ({
          id: p.id,
          installmentNumber: p.installmentNumber,
          amount: p.amount,
          expectedAmount: p.expectedAmount,
          txHash: p.txHash,
          status: p.status,
          dueDate: p.dueDate.toISOString(),
          createdAt: p.createdAt.toISOString(),
          confirmedAt: p.confirmedAt?.toISOString()
        }))
      });
    } catch (error) {
      console.error("Get installment plan error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async apiGetInstallmentSchedule(req, res) {
    try {
      const details = await this.installmentManager.getPlanDetails(req.params.id);
      if (!details) {
        res.status(404).json({ error: "Installment plan not found" });
        return;
      }
      res.json({
        planId: details.plan.id,
        totalAmount: details.plan.totalAmount,
        paidAmount: details.plan.paidAmount,
        progress: details.progress,
        schedule: details.schedule
      });
    } catch (error) {
      console.error("Get installment schedule error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async apiProcessInstallmentPayment(req, res) {
    try {
      const { txHash, chainId } = req.body;
      if (!txHash || !chainId) {
        res.status(400).json({ error: "Missing required fields: txHash, chainId" });
        return;
      }
      const plan = await this.storage.getInstallmentPlan(req.params.id);
      if (!plan) {
        res.status(404).json({ error: "Installment plan not found" });
        return;
      }
      const link = await this.storage.getPayLink(plan.payLinkId);
      if (!link) {
        res.status(404).json({ error: "PayLink not found" });
        return;
      }
      const verifier = this.verifiers.get(chainId);
      if (!verifier) {
        res.status(400).json({ error: "Unsupported chain" });
        return;
      }
      const expectedAmount = plan.installmentAmounts[plan.nextInstallmentNumber - 1];
      const result = await verifier.verifyPayment({
        txHash,
        recipient: link.recipientAddress,
        amount: expectedAmount
      });
      if (result.status !== "confirmed") {
        res.status(400).json({ error: "Payment not confirmed", status: result.status });
        return;
      }
      const payment = {
        id: generateUUID(),
        payLinkId: plan.payLinkId,
        chainId,
        txHash,
        fromAddress: result.fromAddress || plan.buyerAddress,
        amount: result.actualAmount || expectedAmount,
        tokenSymbol: link.price.tokenSymbol,
        confirmed: true,
        createdAt: /* @__PURE__ */ new Date(),
        confirmedAt: /* @__PURE__ */ new Date()
      };
      await this.storage.savePayment(payment);
      const installmentPayment = await this.installmentManager.processPayment(plan.id, payment);
      if (this.webhookManager && link) {
        this.webhookManager.sendInstallmentEvent("installment.payment_received", plan, link, installmentPayment).catch((err) => {
          console.error("Installment webhook error:", err);
        });
      }
      const { payment: confirmedPayment, plan: updatedPlan } = await this.installmentManager.confirmPayment(installmentPayment.id);
      if (this.webhookManager && link) {
        if (updatedPlan.status === "active" && updatedPlan.completedInstallments === 1) {
          this.webhookManager.sendInstallmentEvent("installment.plan_activated", updatedPlan, link, confirmedPayment).catch((err) => {
            console.error("Installment webhook error:", err);
          });
        }
        if (updatedPlan.status === "completed") {
          this.webhookManager.sendInstallmentEvent("installment.plan_completed", updatedPlan, link, confirmedPayment).catch((err) => {
            console.error("Installment webhook error:", err);
          });
        }
        this.webhookManager.sendInstallmentEvent("installment.payment_confirmed", updatedPlan, link, confirmedPayment).catch((err) => {
          console.error("Installment webhook error:", err);
        });
      }
      const progress = getInstallmentProgress(updatedPlan);
      res.json({
        success: true,
        payment: {
          id: confirmedPayment.id,
          installmentNumber: confirmedPayment.installmentNumber,
          amount: confirmedPayment.amount,
          status: confirmedPayment.status,
          confirmedAt: confirmedPayment.confirmedAt?.toISOString()
        },
        plan: {
          id: updatedPlan.id,
          status: updatedPlan.status,
          completedInstallments: updatedPlan.completedInstallments,
          paidAmount: updatedPlan.paidAmount,
          nextDueDate: updatedPlan.nextDueDate?.toISOString(),
          nextInstallmentNumber: updatedPlan.nextInstallmentNumber
        },
        progress
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  async apiSuspendInstallmentPlan(req, res) {
    try {
      const { reason } = req.body;
      const plan = await this.installmentManager.suspendPlan(req.params.id, reason);
      const link = await this.storage.getPayLink(plan.payLinkId);
      if (this.webhookManager && link) {
        this.webhookManager.sendInstallmentEvent("installment.plan_suspended", plan, link).catch((err) => {
          console.error("Installment webhook error:", err);
        });
      }
      res.json({
        success: true,
        plan: {
          id: plan.id,
          status: plan.status,
          suspendedAt: plan.suspendedAt?.toISOString()
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  async apiCancelInstallmentPlan(req, res) {
    try {
      const { reason } = req.body;
      const plan = await this.installmentManager.cancelPlan(req.params.id, reason);
      const link = await this.storage.getPayLink(plan.payLinkId);
      if (this.webhookManager && link) {
        this.webhookManager.sendInstallmentEvent("installment.plan_cancelled", plan, link).catch((err) => {
          console.error("Installment webhook error:", err);
        });
      }
      res.json({
        success: true,
        plan: {
          id: plan.id,
          status: plan.status,
          cancelledAt: plan.cancelledAt?.toISOString()
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  async apiGetBuyerInstallments(req, res) {
    try {
      const plans = await this.storage.getInstallmentPlansByBuyer(req.params.address);
      res.json({
        address: req.params.address,
        count: plans.length,
        plans: plans.map((p) => ({
          id: p.id,
          payLinkId: p.payLinkId,
          status: p.status,
          totalAmount: p.totalAmount,
          paidAmount: p.paidAmount,
          totalInstallments: p.totalInstallments,
          completedInstallments: p.completedInstallments,
          nextDueDate: p.nextDueDate.toISOString(),
          progress: getInstallmentProgress(p)
        }))
      });
    } catch (error) {
      console.error("Get buyer installments error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  async apiGetOverdueInstallments(req, res) {
    try {
      const plans = await this.installmentManager.getOverduePlans();
      res.json({
        count: plans.length,
        plans: plans.map((p) => ({
          id: p.id,
          payLinkId: p.payLinkId,
          buyerAddress: p.buyerAddress,
          status: p.status,
          totalAmount: p.totalAmount,
          paidAmount: p.paidAmount,
          completedInstallments: p.completedInstallments,
          nextDueDate: p.nextDueDate.toISOString(),
          nextInstallmentNumber: p.nextInstallmentNumber,
          progress: getInstallmentProgress(p)
        }))
      });
    } catch (error) {
      console.error("Get overdue installments error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  // ========================================
  // RESPONSE HELPERS
  // ========================================
  send402(res, link, subscription) {
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
    if (link.paymentOptions && link.paymentOptions.length > 0) {
      body.paymentOptions = link.paymentOptions.map((opt) => ({
        chainId: opt.chainId,
        tokenSymbol: opt.tokenSymbol,
        amount: opt.amount,
        recipient: opt.recipientAddress || link.recipientAddress
      }));
    }
    if (link.subscription) {
      body.subscription = {
        interval: link.subscription.interval,
        intervalCount: link.subscription.intervalCount ?? 1,
        trialDays: link.subscription.trialDays,
        existingSubscriptionId: subscription?.id,
        subscriptionStatus: subscription?.status,
        nextPaymentDue: subscription?.nextPaymentDue.toISOString()
      };
    }
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

// lib/paylink-token.ts
var PAYLINK_TOKEN = {
  /** Token mint address */
  MINT: "cMNjNj2NMaEniE37KvyV2GCyQJnbY8YDeANBhSMpump",
  /** Token symbol */
  SYMBOL: "PAYLINK",
  /** Token decimals (pump.fun standard) */
  DECIMALS: 6,
  /** Chain ID (Solana mainnet) */
  CHAIN_ID: 101
};
var DEFAULT_DISCOUNT_TIERS = [
  { minBalance: 1e6, discountPercent: 50, name: "Diamond" },
  // 1M tokens = 50% off
  { minBalance: 5e5, discountPercent: 30, name: "Platinum" },
  // 500K tokens = 30% off
  { minBalance: 1e5, discountPercent: 20, name: "Gold" },
  // 100K tokens = 20% off
  { minBalance: 1e4, discountPercent: 10, name: "Silver" },
  // 10K tokens = 10% off
  { minBalance: 1e3, discountPercent: 5, name: "Bronze" }
  // 1K tokens = 5% off
];
var PaylinkTokenManager = class {
  config;
  requestId = 0;
  constructor(config) {
    this.config = {
      rpcUrl: config.rpcUrl,
      enableTokenPayments: config.enableTokenPayments ?? true,
      tokenPaymentDiscount: config.tokenPaymentDiscount ?? 10,
      enableHolderDiscounts: config.enableHolderDiscounts ?? true,
      discountTiers: config.discountTiers ?? DEFAULT_DISCOUNT_TIERS,
      timeout: config.timeout ?? 3e4
    };
  }
  /**
   * Get PAYLINK token balance for a wallet
   */
  async getTokenBalance(walletAddress) {
    try {
      const tokenAccounts = await this.getTokenAccountsByOwner(walletAddress);
      const paylinkAccount = tokenAccounts.find(
        (acc) => acc.mint === PAYLINK_TOKEN.MINT
      );
      if (!paylinkAccount) {
        return 0;
      }
      return Number(paylinkAccount.amount) / Math.pow(10, PAYLINK_TOKEN.DECIMALS);
    } catch (error) {
      console.error("Error fetching PAYLINK balance:", error);
      return 0;
    }
  }
  /**
   * Get discount tier for a wallet based on PAYLINK holdings
   */
  async getDiscountTier(walletAddress) {
    if (!this.config.enableHolderDiscounts) {
      return null;
    }
    const balance = await this.getTokenBalance(walletAddress);
    const sortedTiers = [...this.config.discountTiers].sort(
      (a, b) => b.minBalance - a.minBalance
    );
    for (const tier of sortedTiers) {
      if (balance >= tier.minBalance) {
        return tier;
      }
    }
    return null;
  }
  /**
   * Calculate discounted price based on holder tier
   */
  async calculateDiscountedPrice(walletAddress, originalPrice) {
    const tier = await this.getDiscountTier(walletAddress);
    if (!tier) {
      return { price: originalPrice, discount: 0, tier: null };
    }
    const discount = originalPrice * tier.discountPercent / 100;
    const price = originalPrice - discount;
    return { price, discount, tier };
  }
  /**
   * Get price when paying with PAYLINK token
   */
  getTokenPaymentPrice(originalPrice) {
    if (!this.config.enableTokenPayments) {
      return originalPrice;
    }
    const discount = originalPrice * this.config.tokenPaymentDiscount / 100;
    return originalPrice - discount;
  }
  /**
   * Verify PAYLINK token payment
   */
  async verifyTokenPayment(params) {
    try {
      const tx = await this.getTransaction(params.txHash);
      if (!tx) {
        return { status: "not_found" };
      }
      if (tx.meta?.err) {
        return { status: "failed" };
      }
      const transfer = this.parseTokenTransfer(tx, params.recipient);
      if (!transfer) {
        return { status: "not_found" };
      }
      if (transfer.mint !== PAYLINK_TOKEN.MINT) {
        return { status: "not_found" };
      }
      const actualAmount = transfer.amount / Math.pow(10, PAYLINK_TOKEN.DECIMALS);
      const requiredAmount = parseFloat(params.amount);
      if (actualAmount < requiredAmount) {
        return {
          status: "underpaid",
          actualAmount: actualAmount.toString(),
          fromAddress: transfer.from
        };
      }
      return {
        status: "confirmed",
        actualAmount: actualAmount.toString(),
        fromAddress: transfer.from,
        raw: tx
      };
    } catch (error) {
      console.error("PAYLINK payment verification error:", error);
      return { status: "not_found" };
    }
  }
  /**
   * Parse SPL token transfer from transaction
   */
  parseTokenTransfer(tx, expectedRecipient) {
    try {
      const preBalances = tx.meta?.preTokenBalances || [];
      const postBalances = tx.meta?.postTokenBalances || [];
      for (const post of postBalances) {
        if (post.mint !== PAYLINK_TOKEN.MINT) continue;
        const pre = preBalances.find(
          (p) => p.accountIndex === post.accountIndex
        );
        const preAmount = pre ? Number(pre.uiTokenAmount?.amount || 0) : 0;
        const postAmount = Number(post.uiTokenAmount?.amount || 0);
        const diff = postAmount - preAmount;
        if (diff > 0) {
          const owner = post.owner;
          if (owner?.toLowerCase() === expectedRecipient.toLowerCase()) {
            let sender = "";
            for (const otherPost of postBalances) {
              if (otherPost.mint !== PAYLINK_TOKEN.MINT) continue;
              const otherPre = preBalances.find(
                (p) => p.accountIndex === otherPost.accountIndex
              );
              const otherPreAmount = otherPre ? Number(otherPre.uiTokenAmount?.amount || 0) : 0;
              const otherPostAmount = Number(otherPost.uiTokenAmount?.amount || 0);
              if (otherPostAmount - otherPreAmount < 0) {
                sender = otherPost.owner || "";
                break;
              }
            }
            return {
              mint: PAYLINK_TOKEN.MINT,
              from: sender,
              to: owner,
              amount: diff
            };
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  /**
   * Get token accounts for a wallet
   */
  async getTokenAccountsByOwner(owner) {
    const result = await this.rpc("getTokenAccountsByOwner", [
      owner,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" }
    ]);
    if (!result?.value) {
      return [];
    }
    return result.value.map((item) => item.account.data.parsed.info);
  }
  /**
   * Get transaction details
   */
  async getTransaction(signature) {
    return this.rpc("getTransaction", [
      signature,
      {
        encoding: "jsonParsed",
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0
      }
    ]);
  }
  /**
   * Make RPC call
   */
  async rpc(method, params) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);
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
        console.error("RPC error:", data.error);
        return null;
      }
      return data.result ?? null;
    } catch (error) {
      console.error("RPC request failed:", error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
};
function createPaylinkTokenManager(config) {
  return new PaylinkTokenManager(config);
}
function isPaylinkToken(symbol) {
  return symbol.toUpperCase() === PAYLINK_TOKEN.SYMBOL;
}
function formatPaylinkAmount(amount) {
  if (amount >= 1e6) {
    return `${(amount / 1e6).toFixed(2)}M`;
  }
  if (amount >= 1e3) {
    return `${(amount / 1e3).toFixed(2)}K`;
  }
  return amount.toFixed(2);
}
export {
  ChainVerifier,
  DEFAULT_DISCOUNT_TIERS,
  DEFAULT_INSTALLMENT_CONFIG,
  DEFAULT_REFERRAL_CONFIG,
  InstallmentManager,
  MemoryStorage,
  MockSolanaVerifier,
  MockVerifier,
  PAYLINK_TOKEN,
  PaylinkServer,
  PaylinkTokenManager,
  REASON_MESSAGES,
  ReasonCode,
  ReferralManager,
  SOLANA_CHAIN_IDS,
  SolanaVerifier,
  SubscriptionManager,
  WebhookManager,
  buildReferralUrl,
  calculateCommission,
  calculateDueDates,
  calculateInstallmentAmounts,
  calculateNextBillingDate,
  calculateNextDueDate,
  compareAmounts,
  createInstallmentManager,
  createPaylinkTokenManager,
  createReferralManager,
  createServer,
  createSolanaVerifier,
  createSubscriptionManager,
  createWebhookManager,
  formatInstallmentSchedule,
  formatPaylinkAmount,
  generateId,
  generateNonce,
  generatePaymentQR,
  generatePaymentURI,
  generateQRCodeDataURL,
  generateQRCodeSVG,
  generateReferralCode,
  generateUUID,
  getInstallmentProgress,
  getIntervalDisplayName,
  isCommissionExpired,
  isExpired,
  isInGracePeriod,
  isInTrialPeriod,
  isInstallmentOverdue,
  isLimitReached,
  isPaylinkToken,
  isPaymentDue,
  isValidReferralCode,
  isWithinGracePeriod,
  parseReferralCode,
  sign,
  verifyWebhookSignature
};
//# sourceMappingURL=index.mjs.map