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

/** Feature labels selected on a plan, in catalog order; legacy free-text features are ignored. */
export const getPlanFeatureLabels = (plan: any): string[] => {
    const saved = String(plan?.features || '')
        .split(',')
        .map((f) => f.trim().toLowerCase())
        .filter(Boolean);
    return PLAN_FEATURES.filter((f) => saved.includes(f.label.toLowerCase())).map((f) => f.label);
};

/**
 * Feature keys a plan unlocks. Plans saved before features were selectable
 * (no catalog feature ticked) keep full access until the admin configures them.
 */
export const getPlanFeatureKeys = (plan: any): Set<PlanFeatureKey> => {
    const labels = getPlanFeatureLabels(plan);
    if (labels.length === 0) return new Set(ALL_PLAN_FEATURE_KEYS);
    return new Set(PLAN_FEATURES.filter((f) => labels.includes(f.label)).map((f) => f.key));
};

/** Features available to the session's agency (main agency plan applies to sub-agents and staff). */
export const getAgencyPlanFeatures = (
    db: any,
    opts: { userRole?: string | null; sessionAgentId?: string | null; userEmail?: string | null }
): Set<PlanFeatureKey> => {
    if (opts.userRole === 'admin') return new Set(ALL_PLAN_FEATURE_KEYS);
    const agency = resolveMainAgencyAgent(db, opts);
    const planName = agency?.plan || 'Lite';
    const plan = (db?.plans?.data || []).find((p: any) => p.name === planName);
    if (!plan) return new Set(ALL_PLAN_FEATURE_KEYS);
    return getPlanFeatureKeys(plan);
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
