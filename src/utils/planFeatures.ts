import { useCallback, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { resolveMainAgencyAgent } from './databaseSync';

/**
 * CRM capabilities a subscription plan can include. Plans store the selected
 * labels comma-separated in `plan.features`, so labels must not contain commas.
 */
export const PLAN_FEATURES = [
    { key: 'dashboard', label: 'Dashboard & Analytics' },
    { key: 'leads', label: 'Lead Management (Pipeline & Kanban)' },
    { key: 'leadFollowUps', label: 'Lead Follow-ups' },
    { key: 'quotations', label: 'Quotation Builder with Itinerary' },
    { key: 'quotePdf', label: 'Quotation PDF Download' },
    { key: 'quoteSharing', label: 'Share Quotes via Email & WhatsApp' },
    { key: 'bookings', label: 'Booking Management' },
    { key: 'hotelVouchers', label: 'Hotel Vouchers' },
    { key: 'tripCancellations', label: 'Trip Cancellations' },
    { key: 'finance', label: 'Invoices & Finance Tracking' },
    { key: 'csvExport', label: 'CSV Export (Bookings & Finance)' },
    { key: 'packageStudio', label: 'Package Studio (Hotels / Activities / Presets)' },
    { key: 'terms', label: 'Terms & Conditions Templates' },
    { key: 'teamStaff', label: 'Team Staff with Role Permissions' },
    { key: 'subAgents', label: 'Sub-Agent Management' },
    { key: 'agencyBranding', label: 'Agency Branding (Logo & Profile)' },
    { key: 'bankDetails', label: 'Bank Details on Invoices' },
    { key: 'agencyEmail', label: 'Send Emails from Your Agency Address' },
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURES)[number]['key'];

/** Fixed team-staff caps used when a plan still has the old unlimited value (9999). */
export const DEFAULT_PLAN_STAFF_LIMITS: Record<string, number> = {
    lite: 3,
    growth: 5,
    enterprise: 10,
};

const UNLIMITED_STAFF_SENTINEL = 9999;

/** Staff seats for a plan. Master admin `staffLimit` wins; 9999 falls back to the plan default. */
export const resolvePlanStaffLimit = (plan: any): number => {
    const name = String(plan?.name || '').trim().toLowerCase();
    const fallback = DEFAULT_PLAN_STAFF_LIMITS[name] ?? 5;
    const raw = Number(plan?.staffLimit);
    if (!Number.isFinite(raw) || raw >= UNLIMITED_STAFF_SENTINEL) return fallback;
    return Math.max(0, Math.round(raw));
};

export const formatPlanStaffLimitLabel = (plan: any): string => {
    const limit = resolvePlanStaffLimit(plan);
    if (limit <= 0) return 'Not included';
    return limit === 1 ? '1 User' : `${limit} Users`;
};

export const ALL_PLAN_FEATURE_KEYS: PlanFeatureKey[] = PLAN_FEATURES.map((f) => f.key);

export const PLAN_FEATURE_LABELS = Object.fromEntries(
    PLAN_FEATURES.map((f) => [f.key, f.label])
) as Record<PlanFeatureKey, string>;

/** Module routes that require a plan feature (Team needs either staff or sub-agent management). */
export const ROUTE_PLAN_FEATURES: Record<string, PlanFeatureKey[]> = {
    '/': ['dashboard'],
    '/leads': ['leads'],
    '/quotations': ['quotations'],
    '/bookings': ['bookings'],
    '/finance': ['finance'],
    '/studio': ['packageStudio'],
    '/terms': ['terms'],
    '/my-team': ['teamStaff', 'subAgents'],
};

/**
 * Keep the first plan's features in that same order on every card, so matching
 * items sit on the same row. Features the first plan does not include are added after those.
 */
export const alignPlanFeatureLists = (lists: string[][]): string[][] => {
    const base = lists[0] || [];
    const seen = new Set(base);
    const extras: string[] = [];
    for (const list of lists) {
        for (const feature of list) {
            if (seen.has(feature)) continue;
            seen.add(feature);
            extras.push(feature);
        }
    }
    return lists.map((list) => {
        const included = new Set(list);
        return [
            ...base.filter((feature) => included.has(feature)),
            ...extras.filter((feature) => included.has(feature)),
        ];
    });
};

/** Feature labels selected on a plan, in catalog order; legacy free-text features are ignored. */
export const getPlanFeatureLabels = (plan: any): string[] => {
    const saved = String(plan?.features || '')
        .split(',')
        .map((f) => f.trim().toLowerCase())
        .filter(Boolean);
    return PLAN_FEATURES.filter((f) => saved.includes(f.label.toLowerCase())).map((f) => f.label);
};

/**
 * Feature keys a plan unlocks.
 * A blank `features` field is a legacy plan and keeps full access.
 * Once features are saved, only the ticked catalog items are included.
 */
export const getPlanFeatureKeys = (plan: any): Set<PlanFeatureKey> => {
    const raw = String(plan?.features ?? '').trim();
    if (!raw) return new Set(ALL_PLAN_FEATURE_KEYS);
    const labels = getPlanFeatureLabels(plan);
    return new Set(PLAN_FEATURES.filter((f) => labels.includes(f.label)).map((f) => f.key));
};

/** Comma-separated labels of the features currently ticked on a plan. */
export const getSelectedPlanFeatureString = (plan: any): string => getPlanFeatureLabels(plan).join(',');

/** Fields copied onto an agency when they buy or change a plan. */
export const planFeatureFields = (plan: any): { planFeatures: string } => ({
    planFeatures: plan ? getSelectedPlanFeatureString(plan) : '',
});

/** Features available to the session's agency (main agency plan applies to sub-agents and staff). */
export const getAgencyPlanFeatures = (
    db: any,
    opts: { userRole?: string | null; sessionAgentId?: string | null; userEmail?: string | null }
): Set<PlanFeatureKey> => {
    if (opts.userRole === 'admin') return new Set(ALL_PLAN_FEATURE_KEYS);
    const agency = resolveMainAgencyAgent(db, opts);
    const planName = String(agency?.plan || 'Lite').trim().toLowerCase();
    const plans = db?.plans?.data || [];
    const plan = plans.find((p: any) => String(p?.name || '').trim().toLowerCase() === planName);
    if (plan) return getPlanFeatureKeys(plan);
    if (agency?.planFeatures) return getPlanFeatureKeys({ features: agency.planFeatures });
    if (plans.length === 0) return new Set(ALL_PLAN_FEATURE_KEYS);
    return new Set();
};

export const canAccessRouteOnPlan = (features: Set<PlanFeatureKey>, path: string): boolean => {
    const required = ROUTE_PLAN_FEATURES[path];
    return !required || required.some((key) => features.has(key));
};

/** React hook: plan features for the logged-in session. */
export const usePlanFeatures = () => {
    const { db } = useDatabase();
    const userRole = localStorage.getItem('userRole');
    const sessionAgentId = localStorage.getItem('agentId');
    const userEmail = localStorage.getItem('userEmail');

    const features = useMemo(
        () => getAgencyPlanFeatures(db, { userRole, sessionAgentId, userEmail }),
        [db, userRole, sessionAgentId, userEmail]
    );

    const hasFeature = useCallback((key: PlanFeatureKey) => features.has(key), [features]);

    return { features, hasFeature };
};
