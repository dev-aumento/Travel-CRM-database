import type { BillingCycle } from './planPricing';

const STORAGE_KEY = 'pendingPlanSignup';

export interface PendingPlanSignup {
    planName: string;
    billingCycle: BillingCycle;
}

export const savePendingPlanSignup = (value: PendingPlanSignup) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export const readPendingPlanSignup = (): PendingPlanSignup | null => {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
        const planName = String(parsed?.planName || '').trim();
        if (!planName) return null;
        return {
            planName,
            billingCycle: parsed?.billingCycle === 'yearly' ? 'yearly' : 'monthly',
        };
    } catch {
        return null;
    }
};

export const clearPendingPlanSignup = () => {
    sessionStorage.removeItem(STORAGE_KEY);
};
