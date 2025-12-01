/**
 * Installment (Payment Plan) Module
 * 
 * Enables splitting payments into multiple installments.
 * Buyer pays first installment and gets access, then pays remaining
 * installments on schedule. Access is paused if payments are missed.
 */

import type {
  Storage,
  InstallmentPlan,
  InstallmentPayment,
  InstallmentConfig,
  InstallmentStatus,
  CreateInstallmentPlanInput,
  PayLink,
  Payment,
} from './types.js';
import { generateUUID } from './utils.js';

/**
 * Default installment configuration
 */
export const DEFAULT_INSTALLMENT_CONFIG: InstallmentConfig = {
  enabled: true,
  totalInstallments: 4,
  intervalDays: 30,
  downPaymentPercent: 25,
  gracePeriodDays: 3,
  autoSuspend: true,
};

/**
 * Calculate installment amounts
 * @param totalAmount Total price amount
 * @param totalInstallments Number of installments
 * @param downPaymentPercent Percentage for first payment (0-100)
 * @returns Array of amounts for each installment
 */
export function calculateInstallmentAmounts(
  totalAmount: string,
  totalInstallments: number,
  downPaymentPercent: number = 25
): string[] {
  const total = parseFloat(totalAmount);
  if (isNaN(total) || total <= 0) {
    throw new Error('Invalid total amount');
  }
  if (totalInstallments < 2) {
    throw new Error('Minimum 2 installments required');
  }
  if (downPaymentPercent < 0 || downPaymentPercent > 100) {
    throw new Error('Down payment percent must be between 0 and 100');
  }

  const amounts: string[] = [];

  // Calculate down payment (first installment)
  const downPayment = total * (downPaymentPercent / 100);
  amounts.push(downPayment.toFixed(8));

  // Calculate remaining installments
  const remaining = total - downPayment;
  const regularAmount = remaining / (totalInstallments - 1);

  for (let i = 1; i < totalInstallments; i++) {
    amounts.push(regularAmount.toFixed(8));
  }

  return amounts;
}

/**
 * Calculate next due date based on interval
 */
export function calculateNextDueDate(
  fromDate: Date,
  intervalDays: number
): Date {
  const next = new Date(fromDate);
  next.setDate(next.getDate() + intervalDays);
  return next;
}

/**
 * Calculate all due dates for an installment plan
 */
export function calculateDueDates(
  startDate: Date,
  totalInstallments: number,
  intervalDays: number
): Date[] {
  const dates: Date[] = [startDate]; // First payment is immediate

  for (let i = 1; i < totalInstallments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + intervalDays * i);
    dates.push(dueDate);
  }

  return dates;
}

/**
 * Check if an installment payment is overdue
 */
export function isInstallmentOverdue(
  dueDate: Date,
  gracePeriodDays: number = 3
): boolean {
  const now = new Date();
  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + gracePeriodDays);
  return now > graceEnd;
}

/**
 * Check if a date is within grace period
 */
export function isInGracePeriod(
  dueDate: Date,
  gracePeriodDays: number = 3
): boolean {
  const now = new Date();
  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + gracePeriodDays);
  return now > dueDate && now <= graceEnd;
}

/**
 * Get installment plan progress info
 */
export function getInstallmentProgress(plan: InstallmentPlan): {
  paidCount: number;
  remainingCount: number;
  paidAmount: string;
  remainingAmount: string;
  percentComplete: number;
  isComplete: boolean;
} {
  const paidAmount = parseFloat(plan.paidAmount);
  const totalAmount = parseFloat(plan.totalAmount);
  const remainingAmount = totalAmount - paidAmount;

  return {
    paidCount: plan.completedInstallments,
    remainingCount: plan.totalInstallments - plan.completedInstallments,
    paidAmount: plan.paidAmount,
    remainingAmount: remainingAmount.toFixed(8),
    percentComplete: Math.round((paidAmount / totalAmount) * 100),
    isComplete: plan.completedInstallments >= plan.totalInstallments,
  };
}

/**
 * Format installment schedule for display
 */
export function formatInstallmentSchedule(
  plan: InstallmentPlan,
  payments: InstallmentPayment[]
): Array<{
  number: number;
  amount: string;
  dueDate: string;
  status: 'paid' | 'current' | 'upcoming' | 'overdue';
  paidAt?: string;
  txHash?: string;
}> {
  const schedule: Array<{
    number: number;
    amount: string;
    dueDate: string;
    status: 'paid' | 'current' | 'upcoming' | 'overdue';
    paidAt?: string;
    txHash?: string;
  }> = [];

  const dueDates = calculateDueDates(
    plan.createdAt,
    plan.totalInstallments,
    plan.intervalDays
  );

  for (let i = 0; i < plan.totalInstallments; i++) {
    const payment = payments.find(p => p.installmentNumber === i + 1);
    const dueDate = dueDates[i];
    const now = new Date();

    let status: 'paid' | 'current' | 'upcoming' | 'overdue';

    if (payment?.status === 'confirmed') {
      status = 'paid';
    } else if (i < plan.completedInstallments) {
      status = 'paid';
    } else if (i === plan.completedInstallments) {
      // Current installment
      if (isInstallmentOverdue(dueDate, plan.gracePeriodDays)) {
        status = 'overdue';
      } else {
        status = 'current';
      }
    } else {
      status = 'upcoming';
    }

    schedule.push({
      number: i + 1,
      amount: plan.installmentAmounts[i] || '0',
      dueDate: dueDate.toISOString(),
      status,
      paidAt: payment?.confirmedAt?.toISOString(),
      txHash: payment?.txHash,
    });
  }

  return schedule;
}

/**
 * Installment Plan Manager
 */
export class InstallmentManager {
  constructor(private storage: Storage) {}

  /**
   * Create a new installment plan
   */
  async createPlan(input: CreateInstallmentPlanInput): Promise<InstallmentPlan> {
    const payLink = await this.storage.getPayLink(input.payLinkId);
    if (!payLink) {
      throw new Error('PayLink not found');
    }

    if (!payLink.installment?.enabled) {
      throw new Error('Installments not enabled for this link');
    }

    // Check if buyer already has a plan for this link
    const existing = await this.storage.getInstallmentPlanByAddress(
      input.payLinkId,
      input.buyerAddress
    );
    if (existing && existing.status !== 'completed' && existing.status !== 'cancelled') {
      throw new Error('Active installment plan already exists for this buyer');
    }

    const config = payLink.installment;
    const totalAmount = payLink.price.amount;
    const totalInstallments = config.totalInstallments || 4;
    const downPaymentPercent = config.downPaymentPercent ?? 25;
    const intervalDays = config.intervalDays || 30;
    const gracePeriodDays = config.gracePeriodDays ?? 3;

    // Calculate installment amounts
    const installmentAmounts = calculateInstallmentAmounts(
      totalAmount,
      totalInstallments,
      downPaymentPercent
    );

    const now = new Date();
    const firstDueDate = now; // First payment is immediate

    const plan: InstallmentPlan = {
      id: generateUUID(),
      payLinkId: input.payLinkId,
      buyerAddress: input.buyerAddress,
      status: 'pending',
      totalAmount,
      paidAmount: '0',
      totalInstallments,
      completedInstallments: 0,
      installmentAmounts,
      intervalDays,
      gracePeriodDays,
      nextDueDate: firstDueDate,
      nextInstallmentNumber: 1,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };

    await this.storage.saveInstallmentPlan(plan);

    return plan;
  }

  /**
   * Get installment plan by ID
   */
  async getPlan(id: string): Promise<InstallmentPlan | null> {
    return this.storage.getInstallmentPlan(id);
  }

  /**
   * Get plan by buyer address
   */
  async getPlanByAddress(
    payLinkId: string,
    buyerAddress: string
  ): Promise<InstallmentPlan | null> {
    return this.storage.getInstallmentPlanByAddress(payLinkId, buyerAddress);
  }

  /**
   * Process an installment payment
   */
  async processPayment(
    planId: string,
    payment: Payment
  ): Promise<InstallmentPayment> {
    const plan = await this.storage.getInstallmentPlan(planId);
    if (!plan) {
      throw new Error('Installment plan not found');
    }

    if (plan.status === 'completed') {
      throw new Error('Installment plan already completed');
    }

    if (plan.status === 'cancelled') {
      throw new Error('Installment plan was cancelled');
    }

    const installmentNumber = plan.nextInstallmentNumber;
    const expectedAmount = plan.installmentAmounts[installmentNumber - 1];

    // Create installment payment record
    const installmentPayment: InstallmentPayment = {
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
      tokenSymbol: payment.tokenSymbol || 'SOL',
      status: 'pending',
      dueDate: plan.nextDueDate,
      createdAt: new Date(),
    };

    await this.storage.saveInstallmentPayment(installmentPayment);

    return installmentPayment;
  }

  /**
   * Confirm an installment payment
   */
  async confirmPayment(installmentPaymentId: string): Promise<{
    payment: InstallmentPayment;
    plan: InstallmentPlan;
  }> {
    const payment = await this.storage.getInstallmentPayment(installmentPaymentId);
    if (!payment) {
      throw new Error('Installment payment not found');
    }

    const plan = await this.storage.getInstallmentPlan(payment.installmentPlanId);
    if (!plan) {
      throw new Error('Installment plan not found');
    }

    // Update payment status
    payment.status = 'confirmed';
    payment.confirmedAt = new Date();
    await this.storage.updateInstallmentPayment(payment);

    // Update plan
    const paidAmount = parseFloat(plan.paidAmount) + parseFloat(payment.amount);
    plan.paidAmount = paidAmount.toFixed(8);
    plan.completedInstallments++;
    plan.updatedAt = new Date();

    // Check if first payment - activate access
    if (plan.completedInstallments === 1 && plan.status === 'pending') {
      plan.status = 'active';
      plan.activatedAt = new Date();
    }

    // Check if all installments completed
    if (plan.completedInstallments >= plan.totalInstallments) {
      plan.status = 'completed';
      plan.completedAt = new Date();
    } else {
      // Calculate next due date
      plan.nextInstallmentNumber++;
      plan.nextDueDate = calculateNextDueDate(
        plan.nextDueDate,
        plan.intervalDays
      );
      
      // If was suspended, reactivate
      if (plan.status === 'suspended') {
        plan.status = 'active';
        plan.suspendedAt = undefined;
      }
    }

    await this.storage.updateInstallmentPlan(plan);

    return { payment, plan };
  }

  /**
   * Suspend a plan due to missed payment
   */
  async suspendPlan(planId: string, reason?: string): Promise<InstallmentPlan> {
    const plan = await this.storage.getInstallmentPlan(planId);
    if (!plan) {
      throw new Error('Installment plan not found');
    }

    if (plan.status !== 'active') {
      throw new Error('Can only suspend active plans');
    }

    plan.status = 'suspended';
    plan.suspendedAt = new Date();
    plan.updatedAt = new Date();
    if (reason) {
      plan.metadata = { ...plan.metadata, suspendReason: reason };
    }

    await this.storage.updateInstallmentPlan(plan);

    return plan;
  }

  /**
   * Cancel an installment plan
   */
  async cancelPlan(planId: string, reason?: string): Promise<InstallmentPlan> {
    const plan = await this.storage.getInstallmentPlan(planId);
    if (!plan) {
      throw new Error('Installment plan not found');
    }

    if (plan.status === 'completed') {
      throw new Error('Cannot cancel completed plan');
    }

    plan.status = 'cancelled';
    plan.cancelledAt = new Date();
    plan.updatedAt = new Date();
    if (reason) {
      plan.metadata = { ...plan.metadata, cancelReason: reason };
    }

    await this.storage.updateInstallmentPlan(plan);

    return plan;
  }

  /**
   * Get all payments for a plan
   */
  async getPlanPayments(planId: string): Promise<InstallmentPayment[]> {
    return this.storage.getInstallmentPaymentsByPlan(planId);
  }

  /**
   * Get overdue plans
   */
  async getOverduePlans(): Promise<InstallmentPlan[]> {
    return this.storage.getOverdueInstallmentPlans();
  }

  /**
   * Get plans due soon (within N days)
   */
  async getPlansDueSoon(withinDays: number = 3): Promise<InstallmentPlan[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return this.storage.getInstallmentPlansDueBefore(cutoff);
  }

  /**
   * Check and suspend overdue plans
   */
  async processOverduePlans(): Promise<InstallmentPlan[]> {
    const overdue = await this.getOverduePlans();
    const suspended: InstallmentPlan[] = [];

    for (const plan of overdue) {
      if (plan.status === 'active') {
        const updated = await this.suspendPlan(plan.id, 'Payment overdue');
        suspended.push(updated);
      }
    }

    return suspended;
  }

  /**
   * Get installment plan details with schedule
   */
  async getPlanDetails(planId: string): Promise<{
    plan: InstallmentPlan;
    payments: InstallmentPayment[];
    schedule: ReturnType<typeof formatInstallmentSchedule>;
    progress: ReturnType<typeof getInstallmentProgress>;
  } | null> {
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
      progress,
    };
  }

  /**
   * Check if buyer has active access
   */
  async hasActiveAccess(
    payLinkId: string,
    buyerAddress: string
  ): Promise<boolean> {
    const plan = await this.storage.getInstallmentPlanByAddress(
      payLinkId,
      buyerAddress
    );

    if (!plan) {
      return false;
    }

    // Active or completed plans have access
    return plan.status === 'active' || plan.status === 'completed';
  }
}

/**
 * Create an installment manager instance
 */
export function createInstallmentManager(storage: Storage): InstallmentManager {
  return new InstallmentManager(storage);
}
