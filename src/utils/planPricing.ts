import { useEffect, useState } from 'react';
import { parsePlanPriceValue } from './agentPlan';
import { findAgencySettingsRecord } from './databaseSync';

/** Subscription plans are priced in INR for India and USD for everyone else. */
export type PlanCurrency = 'INR' | 'USD';

const INDIA_TIMEZONES = new Set(['Asia/Kolkata', 'Asia/Calcutta']);

/**
 * Best-effort check whether the viewer is in India, using the browser timezone
 * (falls back to the browser locale region when the timezone is unavailable).
 */
export const isViewerInIndia = (): boolean => {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) return INDIA_TIMEZONES.has(tz);
    } catch {
        // ignore and fall back to locale
    }
    if (typeof navigator === 'undefined') return true;
    const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
    return locales.some((locale) => /-IN$/i.test(String(locale || '')));
};

export const getViewerPlanCurrency = (): PlanCurrency => (isViewerInIndia() ? 'INR' : 'USD');

/* ---------- Viewer country from IP (follows VPNs, unlike timezone/locale) ---------- */

/**
 * Free, keyless IP-geolocation providers tried in order; each yields an ISO country code.
 * The first is reached by IPv4 address so it sees the same IP as most VPNs (many VPNs
 * don't tunnel IPv6, which would otherwise leak the real country).
 */
const COUNTRY_PROVIDERS: Array<{ url: string; read: (res: Response) => Promise<unknown> }> = [
    { url: 'https://1.1.1.1/cdn-cgi/trace', read: async (res) => /^loc=(\w+)$/m.exec(await res.text())?.[1] },
    { url: 'https://get.geojs.io/v1/ip/country.json', read: async (res) => (await res.json())?.country },
    { url: 'https://api.country.is/', read: async (res) => (await res.json())?.country },
];

let countryInFlight: Promise<string | null> | null = null;

/**
 * ISO country code of the viewer's public IP, or `null` when no provider answers.
 * Not cached, so connecting or switching a VPN takes effect on the next page load.
 */
export const fetchViewerCountry = (): Promise<string | null> => {
    if (countryInFlight) return countryInFlight;

    countryInFlight = (async () => {
        for (const provider of COUNTRY_PROVIDERS) {
            try {
                const res = await fetch(provider.url, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
                if (!res.ok) continue;
                const code = String((await provider.read(res)) || '').toUpperCase();
                if (/^[A-Z]{2}$/.test(code)) return code;
            } catch {
                // try the next provider
            }
        }
        return null;
    })().finally(() => {
        countryInFlight = null;
    });

    return countryInFlight;
};

/**
 * React hook: plan currency for the viewer — INR when their IP is in India, USD elsewhere.
 * Falls back to the timezone/locale check if IP lookup fails.
 */
export const useViewerPlanCurrency = () => {
    const [country, setCountry] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        fetchViewerCountry().then((code) => {
            if (!active) return;
            setCountry(code);
            setLoading(false);
        });
        return () => {
            active = false;
        };
    }, []);

    const currency: PlanCurrency = country ? (country === 'IN' ? 'INR' : 'USD') : getViewerPlanCurrency();
    return { currency, country, loading };
};

/* ---------- Live INR → USD exchange rate ---------- */

export interface InrUsdRate {
    /** USD per 1 INR */
    rate: number;
    fetchedAt: string;
}

const RATE_CACHE_KEY = 'inrUsdRate';
const RATE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Free, keyless rate providers tried in order; each returns USD per 1 INR. */
const RATE_PROVIDERS: Array<{ url: string; read: (json: any) => unknown }> = [
    { url: 'https://open.er-api.com/v6/latest/INR', read: (json) => json?.rates?.USD },
    { url: 'https://api.frankfurter.app/latest?from=INR&to=USD', read: (json) => json?.rates?.USD },
];

const readCachedRate = (): InrUsdRate | null => {
    try {
        const parsed = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) || 'null');
        return parsed && Number(parsed.rate) > 0 ? parsed : null;
    } catch {
        return null;
    }
};

const writeCachedRate = (value: InrUsdRate) => {
    try {
        localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(value));
    } catch {
        // storage unavailable — rate is simply refetched next time
    }
};

const isFresh = (value: InrUsdRate | null): value is InrUsdRate =>
    !!value && Date.now() - new Date(value.fetchedAt).getTime() < RATE_MAX_AGE_MS;

let inFlight: Promise<InrUsdRate | null> | null = null;

/** Current INR → USD rate (cached for 6 hours). Falls back to the last known rate if providers are unreachable. */
export const fetchInrUsdRate = (): Promise<InrUsdRate | null> => {
    const cached = readCachedRate();
    if (isFresh(cached)) return Promise.resolve(cached);
    if (inFlight) return inFlight;

    inFlight = (async () => {
        for (const provider of RATE_PROVIDERS) {
            try {
                const res = await fetch(provider.url, { signal: AbortSignal.timeout(5000) });
                if (!res.ok) continue;
                const rate = Number(provider.read(await res.json()));
                if (Number.isFinite(rate) && rate > 0) {
                    const value = { rate, fetchedAt: new Date().toISOString() };
                    writeCachedRate(value);
                    return value;
                }
            } catch {
                // try the next provider
            }
        }
        return cached;
    })().finally(() => {
        inFlight = null;
    });

    return inFlight;
};

const PLATFORM_ADMIN_EMAIL = 'admin@aumento.com';

/** Admin-set conversion rate (₹ per 1 USD) from Platform Settings, or `null` when not configured. */
export const getPlatformInrPerUsd = (db: any): number | null => {
    const value = Number(findAgencySettingsRecord(db, PLATFORM_ADMIN_EMAIL)?.planInrPerUsd);
    return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * React hook: INR → USD rate for plan prices. Uses the admin-set rate when one is configured;
 * otherwise the live rate, `null` while loading or when no rate could be fetched.
 */
export const useInrUsdRate = (manualInrPerUsd: number | null = null) => {
    const [rate, setRate] = useState<InrUsdRate | null>(() => {
        const cached = readCachedRate();
        return isFresh(cached) ? cached : null;
    });
    const [loading, setLoading] = useState(rate == null);
    const isManual = manualInrPerUsd != null;

    useEffect(() => {
        if (isManual) return;
        let active = true;
        fetchInrUsdRate().then((value) => {
            if (!active) return;
            setRate(value);
            setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [isManual]);

    if (isManual) {
        return { rate: 1 / manualInrPerUsd, fetchedAt: null, loading: false, isManual: true };
    }
    return { rate: rate?.rate ?? null, fetchedAt: rate?.fetchedAt ?? null, loading, isManual: false };
};

/* ---------- Plan prices ---------- */

export type BillingCycle = 'monthly' | 'yearly';

export const normalizeBillingCycle = (value: unknown): BillingCycle =>
    value === 'yearly' ? 'yearly' : 'monthly';

const readStoredAmount = (value: unknown): number | null => {
    if (value === '' || value == null) return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

/**
 * INR amount for a plan and billing cycle.
 * Monthly: numeric `priceInr`, or parsed from the legacy `price` string ("₹1,999").
 * Yearly: `priceYearlyInr`, or 12 × monthly for plans saved before yearly pricing existed.
 */
export const getPlanPriceInr = (plan: any, cycle: BillingCycle = 'monthly'): number => {
    const monthly = readStoredAmount(plan?.priceInr) ?? parsePlanPriceValue(plan?.price);
    if (cycle === 'monthly') return monthly;
    return readStoredAmount(plan?.priceYearlyInr) ?? monthly * 12;
};

export const isFreePlan = (plan: any): boolean =>
    getPlanPriceInr(plan, 'monthly') === 0 && getPlanPriceInr(plan, 'yearly') === 0;

export const getPlanPeriodLabel = (plan: any, cycle: BillingCycle): string =>
    isFreePlan(plan) ? '/forever' : cycle === 'yearly' ? '/year' : '/month';

/** Percent saved by paying yearly vs. 12 monthly payments (0 when there is no saving). */
export const getYearlySavingsPercent = (plan: any): number => {
    const monthlyTotal = getPlanPriceInr(plan, 'monthly') * 12;
    const yearly = getPlanPriceInr(plan, 'yearly');
    if (monthlyTotal <= 0 || yearly >= monthlyTotal) return 0;
    return Math.round((1 - yearly / monthlyTotal) * 100);
};

/** Convert INR to USD at the given live rate, rounded to the nearest whole dollar ($24.56 → $25, $24.33 → $24). */
export const convertPlanInrToUsd = (amountInInr: number, usdPerInr: number): number =>
    Math.round((Number(amountInInr) || 0) * usdPerInr);

export const getPlanPriceUsd = (plan: any, usdPerInr: number, cycle: BillingCycle = 'monthly'): number =>
    convertPlanInrToUsd(getPlanPriceInr(plan, cycle), usdPerInr);

export const formatInrPlanPrice = (amount: number): string =>
    `₹${Math.round(amount).toLocaleString('en-IN')}`;

export const formatUsdPlanPrice = (amount: number): string =>
    `$${Math.round(amount).toLocaleString('en-US')}`;

/** Display price for a plan; USD needs a live rate and shows a placeholder until one is available. */
export const formatPlanPrice = (
    plan: any,
    currency: PlanCurrency,
    usdPerInr: number | null,
    cycle: BillingCycle = 'monthly',
    placeholder = '…'
): string => {
    if (currency === 'INR') return formatInrPlanPrice(getPlanPriceInr(plan, cycle));
    if (usdPerInr == null) return placeholder;
    return formatUsdPlanPrice(getPlanPriceUsd(plan, usdPerInr, cycle));
};
