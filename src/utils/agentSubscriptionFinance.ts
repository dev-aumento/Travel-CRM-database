import { getAgentPlanExpiryDisplay, isMainAgencyAgent, parseAgentDate } from './agentPlan';
import { getPlanPeriodLabel, getPlanPriceInr, normalizeBillingCycle } from './planPricing';

export type SubscriptionSettlementStatus = 'paid' | 'trial' | 'unpaid';

export type SalesReportDatePreset = 'last_week' | 'last_month' | 'last_year' | 'custom';

export interface SalesReportDateRange {
    preset: SalesReportDatePreset;
    startMs: number;
    endMs: number;
    label: string;
}

export interface AgentSubscriptionPayment {
    total: number;
    amountPaid: number;
    amountDue: number;
    status: SubscriptionSettlementStatus;
    totalFormatted: string;
}

export interface AgentSubscriptionRow {
    id: string;
    agent: any;
    planName: string;
    period: string;
    purchasedAt: string;
    expiresLabel: string;
    payment: AgentSubscriptionPayment;
}

export const parsePlanPrice = (priceStr?: string): number => {
    if (!priceStr) return 0;
    const digits = String(priceStr).replace(/[^\d]/g, '');
    return parseInt(digits, 10) || 0;
};

/** Main-agency subscriptions, including paid Lite. Sub-agents and rejected agencies are excluded. */
export const hasAgentPurchasedPlan = (agent: any): boolean => {
    if (!isMainAgencyAgent(agent)) return false;
    if (agent?.status === 'rejected') return false;
    return Boolean(agent?.plan);
};

/** Staying on a trial is not a purchase, even after the trial end date, until a payment is recorded. */
export const isUnpaidTrialSubscription = (agent: any): boolean =>
    Boolean(agent?.isTrial) && !agent?.razorpayPaymentId;

/** Amount captured when the agency paid. Later plan-price edits must not replace this. */
export const readSubscriptionPaidInr = (agent: any): number | null => {
    const value = agent?.subscriptionPaidInr;
    if (value === '' || value == null) return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

export const subscriptionPaymentFields = (payment?: {
    paymentId?: string;
    orderId?: string;
    amountInr?: number;
}) => {
    if (!payment?.paymentId) return {};
    const amount = Number(payment.amountInr);
    return {
        razorpayPaymentId: payment.paymentId,
        razorpayOrderId: payment.orderId,
        ...(Number.isFinite(amount) && amount >= 0 ? { subscriptionPaidInr: amount } : {}),
    };
};

export const getAgentSubscriptionPayment = (agent: any, planCatalog: any[] = []): AgentSubscriptionPayment => {
    const planName = agent?.plan || 'Lite';
    const planMeta = planCatalog.find((p: any) => p.name === planName);
    const catalogTotal = planMeta ? getPlanPriceInr(planMeta, normalizeBillingCycle(agent?.billingCycle)) : 0;
    const paidAmount = readSubscriptionPaidInr(agent);
    const total = paidAmount != null ? paidAmount : catalogTotal;
    const now = Date.now();
    const expiry = parseAgentDate(agent?.planExpiresAt);

    const format = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    if (isUnpaidTrialSubscription(agent)) {
        return {
            total: 0,
            amountPaid: 0,
            amountDue: 0,
            status: 'trial',
            totalFormatted: format(0),
        };
    }

    if (paidAmount != null) {
        return {
            total: paidAmount,
            amountPaid: paidAmount,
            amountDue: 0,
            status: expiry != null && expiry < now ? 'unpaid' : 'paid',
            totalFormatted: format(paidAmount),
        };
    }

    if (expiry != null && expiry < now) {
        return {
            total,
            amountPaid: 0,
            amountDue: total,
            status: 'unpaid',
            totalFormatted: format(total),
        };
    }

    if (total === 0) {
        return {
            total: 0,
            amountPaid: 0,
            amountDue: 0,
            status: 'paid',
            totalFormatted: format(0),
        };
    }

    return {
        total,
        amountPaid: total,
        amountDue: 0,
        status: 'paid',
        totalFormatted: format(total),
    };
};

export const buildAgentSubscriptionRows = (
    agents: any[] = [],
    planCatalog: any[] = []
): AgentSubscriptionRow[] => {
    return agents
        .filter((agent) => hasAgentPurchasedPlan(agent) && !isUnpaidTrialSubscription(agent))
        .map((agent) => {
            const planName = agent.plan || 'Lite';
            const planMeta = planCatalog.find((p: any) => p.name === planName);
            const payment = getAgentSubscriptionPayment(agent, planCatalog);
            const expiry = getAgentPlanExpiryDisplay(agent);
            const purchasedAt =
                agent.planRenewedAt?.split('T')[0] ||
                (planName !== 'Lite' ? agent.joinedDate : null) ||
                agent.joinedDate ||
                '—';

            return {
                id: `SUB-${agent.id}`,
                agent,
                planName,
                period: planMeta
                    ? getPlanPeriodLabel(planMeta, normalizeBillingCycle(agent.billingCycle))
                    : '/month',
                purchasedAt,
                expiresLabel: `${expiry.label}: ${expiry.text}`,
                payment,
            };
        })
        .sort((a, b) => String(b.purchasedAt).localeCompare(String(a.purchasedAt)));
};

export const getSubscriptionPurchasedAtMs = (agent: any): number | null =>
    parseAgentDate(agent?.planRenewedAt) ?? parseAgentDate(agent?.joinedDate) ?? null;

const formatReportDate = (date: Date) => date.toLocaleDateString('en-GB');

export const resolveSalesReportDateRange = (
    preset: SalesReportDatePreset,
    customStart?: string,
    customEnd?: string
): SalesReportDateRange => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    if (preset === 'last_week') {
        start.setDate(start.getDate() - 6);
        return {
            preset,
            startMs: start.getTime(),
            endMs: end.getTime(),
            label: `Last Week (${formatReportDate(start)} – ${formatReportDate(end)})`,
        };
    }

    if (preset === 'last_month') {
        start.setDate(start.getDate() - 29);
        return {
            preset,
            startMs: start.getTime(),
            endMs: end.getTime(),
            label: `Last Month (${formatReportDate(start)} – ${formatReportDate(end)})`,
        };
    }

    if (preset === 'last_year') {
        start.setFullYear(start.getFullYear() - 1);
        return {
            preset,
            startMs: start.getTime(),
            endMs: end.getTime(),
            label: `Last Year (${formatReportDate(start)} – ${formatReportDate(end)})`,
        };
    }

    const customStartDate = customStart ? new Date(customStart) : new Date(start);
    const customEndDate = customEnd ? new Date(customEnd) : new Date(end);
    customStartDate.setHours(0, 0, 0, 0);
    customEndDate.setHours(23, 59, 59, 999);

    const rangeStartMs = Math.min(customStartDate.getTime(), customEndDate.getTime());
    const rangeEndMs = Math.max(customStartDate.getTime(), customEndDate.getTime());

    return {
        preset,
        startMs: rangeStartMs,
        endMs: rangeEndMs,
        label: `Custom Range (${formatReportDate(new Date(rangeStartMs))} – ${formatReportDate(new Date(rangeEndMs))})`,
    };
};

export const filterSubscriptionRowsByDateRange = (
    rows: AgentSubscriptionRow[],
    range: Pick<SalesReportDateRange, 'startMs' | 'endMs'>
): AgentSubscriptionRow[] =>
    rows.filter((row) => {
        const purchasedAtMs = getSubscriptionPurchasedAtMs(row.agent);
        if (purchasedAtMs == null) return false;
        return purchasedAtMs >= range.startMs && purchasedAtMs <= range.endMs;
    });

export const summarizeSubscriptionRows = (rows: AgentSubscriptionRow[]) => {
    let totalRevenue = 0;
    let collectedAmount = 0;
    let pendingAmount = 0;
    let activeSubscriptions = 0;

    rows.forEach(({ payment, agent }) => {
        if (payment.status === 'trial') return;
        totalRevenue += payment.total;
        collectedAmount += payment.amountPaid;
        pendingAmount += payment.amountDue;
        if (payment.status === 'paid' && agent?.status === 'approved') activeSubscriptions++;
    });

    return { totalRevenue, collectedAmount, pendingAmount, activeSubscriptions };
};
