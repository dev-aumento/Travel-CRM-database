/** Plan expiry labels for travel agent records */

export type PlanExpiryTone = 'ok' | 'warning' | 'expired' | 'trial' | 'neutral';

export interface PlanExpiryDisplay {
    text: string;
    label: string;
    tone: PlanExpiryTone;
}

export const isMainAgencyAgent = (agent: any): boolean => !agent?.parentId;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const NEW_AGENT_WINDOW_DAYS = 30;
export const PLAN_RENEWED_WINDOW_DAYS = 45;
export const PLAN_EXPIRING_SOON_DAYS = 10;

export type AgentInsightCategory =
    | 'new'
    | 'expired'
    | 'expiring_soon'
    | 'renewed'
    | 'disabled'
    | 'active';

export const parseAgentDate = (value?: string): number | null => {
    if (!value) return null;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? null : t;
};

export const daysSince = (value?: string): number | null => {
    const t = parseAgentDate(value);
    if (t == null) return null;
    return Math.floor((Date.now() - t) / MS_PER_DAY);
};

export const daysUntil = (value?: string): number | null => {
    const t = parseAgentDate(value);
    if (t == null) return null;
    return Math.ceil((t - Date.now()) / MS_PER_DAY);
};

export interface AgentTrialInfo {
    daysLeft: number;
    active: boolean;
    trialEndsAt: string;
}

/** Agent is in (or should be in) a trial window */
export const isImplicitTrialCandidate = (agent: any): boolean => {
    if (agent?.isTrial) return true;
    if ((agent?.plan || 'Lite') !== 'Lite') return false;
    if (agent?.planExpiresAt) return false;
    return isNewAgent(agent);
};

export const agentQualifiesForTrialBadge = (agent: any): boolean => {
    if (!agent) return false;
    if (isImplicitTrialCandidate(agent)) return true;
    const remaining = daysUntil(agent.trialEndsAt);
    return remaining != null && remaining > 0;
};

export const inferTrialEndMs = (agent: any): number | null => {
    if (!agent) return null;

    const explicitEnd = parseAgentDate(agent.trialEndsAt);
    if (explicitEnd != null) return explicitEnd;

    if (!agent.isTrial && !isImplicitTrialCandidate(agent)) return null;

    const joinedMs = parseAgentDate(agent.joinedDate);
    if (joinedMs != null) return joinedMs + NEW_AGENT_WINDOW_DAYS * MS_PER_DAY;

    const renewedMs = parseAgentDate(agent.planRenewedAt);
    if (renewedMs != null) return renewedMs + NEW_AGENT_WINDOW_DAYS * MS_PER_DAY;

    return Date.now() + NEW_AGENT_WINDOW_DAYS * MS_PER_DAY;
};

/** Resolve trial countdown for navbar / dashboard badges */
export const getAgentTrialInfo = (agent: any): AgentTrialInfo | null => {
    if (!agentQualifiesForTrialBadge(agent)) return null;

    const endMs = inferTrialEndMs(agent);
    if (endMs == null) return null;

    const daysLeft = Math.ceil((endMs - Date.now()) / MS_PER_DAY);
    if (daysLeft <= 0) return null;

    return {
        daysLeft,
        active: true,
        trialEndsAt: new Date(endMs).toISOString(),
    };
};

/** Merge seed agents and repair missing trial metadata in localStorage snapshots */
export const migrateTravelAgentRecords = (agents: any[] = [], seedAgents: any[] = []): any[] => {
    const seedById = Object.fromEntries(seedAgents.map((a) => [a.id, a]));
    const merged = [...agents];

    seedAgents.forEach((seed) => {
        if (!merged.some((a) => a.id === seed.id)) {
            merged.push({ ...seed });
        }
    });

    return merged.map((agent) => {
        const seed = seedById[agent.id];
        let next = { ...agent };

        if (seed?.isTrial && !next.isTrial) {
            next = {
                ...next,
                isTrial: true,
                trialEndsAt: next.trialEndsAt || seed.trialEndsAt,
            };
        }

        if (isImplicitTrialCandidate(next) && !next.isTrial) {
            next = { ...next, isTrial: true };
        }

        if (next.isTrial && !next.trialEndsAt) {
            const endMs = inferTrialEndMs(next);
            if (endMs != null) {
                next = { ...next, trialEndsAt: new Date(endMs).toISOString() };
            }
        }

        if (!next.password) {
            next = { ...next, password: seed?.password || 'password123' };
        }

        if (next.parentId && !next.staffLoginId && next.email) {
            next = {
                ...next,
                staffLoginId: String(next.email).trim().toLowerCase(),
            };
        }

        return next;
    });
};

export const findTravelAgentForSession = (
    agents: any[],
    opts: { agentId?: string | null; userEmail?: string | null }
): any | undefined => {
    const { agentId, userEmail } = opts;
    if (agentId) {
        const byId = agents.find((a: any) => a.id === agentId);
        if (byId) return byId;
    }
    const email = String(userEmail || '').trim().toLowerCase();
    if (!email) return undefined;
    return agents.find((a: any) => {
        const agentEmail = String(a.email || '').trim().toLowerCase();
        const staffLogin = String(a.staffLoginId || '').trim().toLowerCase();
        return agentEmail === email || (staffLogin && staffLogin === email);
    });
};

export const isNewAgent = (agent: any, windowDays = NEW_AGENT_WINDOW_DAYS): boolean => {
    const joined = daysSince(agent?.joinedDate);
    return joined != null && joined >= 0 && joined <= windowDays;
};

export const isPlanRenewedRecently = (agent: any, windowDays = PLAN_RENEWED_WINDOW_DAYS): boolean => {
    const renewed = daysSince(agent?.planRenewedAt);
    if (renewed != null && renewed >= 0 && renewed <= windowDays) return true;
    const expiry = parseAgentDate(agent?.planExpiresAt);
    const joined = parseAgentDate(agent?.joinedDate);
    const plan = agent?.plan || 'Lite';
    if (plan === 'Lite' || !expiry || !joined) return false;
    const daysToExpiry = daysUntil(agent?.planExpiresAt);
    const accountAge = daysSince(agent?.joinedDate);
    return (
        accountAge != null &&
        accountAge > NEW_AGENT_WINDOW_DAYS &&
        daysToExpiry != null &&
        daysToExpiry > 0 &&
        daysToExpiry <= 35
    );
};

export const getAgentInsightCategories = (agent: any): AgentInsightCategory[] => {
    if (agent?.status === 'disabled' || agent?.status === 'rejected') {
        return ['disabled'];
    }

    const categories: AgentInsightCategory[] = [];
    if (isNewAgent(agent)) categories.push('new');

    const expiry = getAgentPlanExpiryDisplay(agent);
    if (expiry.tone === 'expired') categories.push('expired');
    else if (expiry.tone === 'warning') categories.push('expiring_soon');

    if (isPlanRenewedRecently(agent)) categories.push('renewed');

    const needsAttention = categories.some((c) =>
        ['new', 'expired', 'expiring_soon', 'renewed'].includes(c)
    );
    if (!needsAttention) categories.push('active');

    return categories;
};

export const agentInsightLabel: Record<AgentInsightCategory, string> = {
    new: 'New Agent',
    expired: 'Plan Expired',
    expiring_soon: 'Expiring Soon',
    renewed: 'Plan Renewed',
    disabled: 'Disabled',
    active: 'Active',
};

export const agentInsightBadgeClass: Record<AgentInsightCategory, string> = {
    new: 'bg-blue-50 text-blue-700 border-blue-100',
    expired: 'bg-red-50 text-red-700 border-red-100',
    expiring_soon: 'bg-amber-50 text-amber-700 border-amber-100',
    renewed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    disabled: 'bg-slate-100 text-slate-600 border-slate-200',
    active: 'bg-crm-50 text-crm-700 border-crm-100',
};

export type AgentSubscriptionFilter = 'all' | 'active' | 'expired' | 'expiring_soon';

export type AgentSubscriptionStatus = 'active' | 'expired' | 'expiring_soon';

export const getAgentSubscriptionStatus = (agent: any): AgentSubscriptionStatus => {
    const expiry = getAgentPlanExpiryDisplay(agent);
    if (expiry.tone === 'expired') return 'expired';
    if (expiry.tone === 'warning') return 'expiring_soon';
    return 'active';
};

export const matchesAgentSubscriptionFilter = (
    agent: any,
    filter: AgentSubscriptionFilter
): boolean => filter === 'all' || getAgentSubscriptionStatus(agent) === filter;

export const getAgentPlanExpiryDisplay = (agent: any): PlanExpiryDisplay => {
    const plan = agent?.plan || 'Lite';
    const now = Date.now();

    if (agent?.planExpiresAt) {
        const end = new Date(agent.planExpiresAt);
        const expired = end.getTime() < now;
        const soon = !expired && end.getTime() - now < PLAN_EXPIRING_SOON_DAYS * MS_PER_DAY;
        return {
            text: end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            label: expired ? 'Plan expired' : 'Plan expires',
            tone: expired ? 'expired' : soon ? 'warning' : 'ok',
        };
    }

    if (!agent?.planExpiresAt) {
        const trialEndMs = inferTrialEndMs(agent);
        if (trialEndMs != null) {
            const end = new Date(trialEndMs);
            const expired = end.getTime() < now;
            const soon = !expired && end.getTime() - now < PLAN_EXPIRING_SOON_DAYS * MS_PER_DAY;
            return {
                text: end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                label: expired ? 'Trial ended' : 'Trial ends',
                tone: expired ? 'expired' : soon ? 'warning' : 'trial',
            };
        }
    }

    if (plan === 'Lite') {
        return { text: 'No expiry', label: 'Lite (free)', tone: 'neutral' };
    }

    return { text: '—', label: 'Expiry not set', tone: 'neutral' };
};

export const isAgentSubscriptionExpired = (agent: any): boolean =>
    Boolean(agent) && getAgentPlanExpiryDisplay(agent).tone === 'expired';

export interface AgentPlanExpiryAlert {
    planName: string;
    daysLeft: number;
    expiryDateText: string;
}

/** Purchased (paid) plan expiring within PLAN_EXPIRING_SOON_DAYS — not trial accounts. */
export const getAgentPlanExpiryAlert = (agent: any): AgentPlanExpiryAlert | null => {
    if (!agent?.planExpiresAt || agent?.isTrial) return null;

    const expiry = getAgentPlanExpiryDisplay(agent);
    if (expiry.tone !== 'warning') return null;

    const daysLeft = daysUntil(agent.planExpiresAt);
    if (daysLeft == null || daysLeft <= 0) return null;

    return {
        planName: agent.plan || 'Plan',
        daysLeft,
        expiryDateText: expiry.text,
    };
};

export const planExpiryBadgeClass = (tone: PlanExpiryTone): string => {
    switch (tone) {
        case 'expired':
            return 'bg-red-50 text-red-600 border-red-100';
        case 'warning':
            return 'bg-amber-50 text-amber-700 border-amber-100';
        case 'trial':
            return 'bg-indigo-50 text-indigo-600 border-indigo-100';
        case 'ok':
            return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        default:
            return 'bg-slate-50 text-slate-600 border-slate-100';
    }
};

/** Apply subscription / trial dates when creating or updating an agent plan */
export const buildApprovalPlanFields = (agent: any, plans: any[] = []): Record<string, unknown> => {
    const planName = agent?.plan || 'Lite';
    const planMeta = plans.find((p: any) => p.name === planName);
    const period = String(planMeta?.period || '');
    const updates: Record<string, unknown> = {};

    if (period.includes('month')) {
        updates.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        updates.isTrial = false;
    } else if (agent?.isTrial) {
        updates.trialEndsAt =
            agent.trialEndsAt ||
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        updates.isTrial = true;
    }

    return updates;
};

/** Parse display price like "₹1,999" or "₹2999" into a numeric amount for sorting. */
export const parsePlanPriceValue = (price?: string | null): number => {
    const digits = String(price || '').replace(/[^\d.]/g, '');
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : 0;
};

/** Sort subscription plans from lowest to highest price. */
export const sortPlansByPriceAsc = <T extends { price?: string | null }>(plans: T[]): T[] =>
    [...plans].sort(
        (left, right) => parsePlanPriceValue(left.price) - parsePlanPriceValue(right.price)
    );
