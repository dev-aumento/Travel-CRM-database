export type CurrencyCode = string;

export type CurrencyOption = {
    code: string;
    symbol: string;
    name: string;
    value: string;
    label: string;
};

type CurrencyConfig = {
    code: string;
    symbol: string;
    locale: string;
    /** Multiply INR amount by this to get target currency. */
    rateFromInr: number;
};

const KNOWN_RATES: Record<string, number> = {
    INR: 1,
    USD: 1 / 83,
    EUR: 1 / 90,
    GBP: 1 / 105,
    AED: 1 / 22.63,
};

const KNOWN_LOCALES: Record<string, string> = {
    INR: 'en-IN',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    AED: 'en-AE',
};

const getCurrencySymbolForCode = (code: string): string => {
    try {
        const parts = new Intl.NumberFormat('en', {
            style: 'currency',
            currency: code,
            currencyDisplay: 'narrowSymbol',
        }).formatToParts(0);
        const symbol = parts.find((part) => part.type === 'currency')?.value;
        return symbol && symbol !== code ? symbol : code;
    } catch {
        return code;
    }
};

const buildCurrencyOptions = (): CurrencyOption[] => {
    const codes = Intl.supportedValuesOf('currency');
    const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });

    return codes
        .map((code) => {
            const symbol = getCurrencySymbolForCode(code);
            const name = displayNames.of(code) || code;
            const value = `${code} (${symbol})`;
            return {
                code,
                symbol,
                name,
                value,
                label: `${value} - ${name}`,
            };
        })
        .sort((left, right) => left.code.localeCompare(right.code));
};

export const CURRENCY_OPTIONS = buildCurrencyOptions();

export const DEFAULT_CURRENCY = 'INR (₹)';

/** Parse settings value like "USD ($)" into a currency code. */
export const parseCurrencyCode = (setting?: string | null): CurrencyCode => {
    const value = String(setting || '').trim();
    const match = value.match(/^([A-Z]{3})\b/i);
    if (match?.[1]) return match[1].toUpperCase();
    return 'INR';
};

export const getCurrencyConfig = (setting?: string | null): CurrencyConfig => {
    const code = parseCurrencyCode(setting);
    const symbol = getCurrencySymbolForCode(code);
    return {
        code,
        symbol,
        locale: KNOWN_LOCALES[code] || 'en-US',
        rateFromInr: KNOWN_RATES[code] ?? 1,
    };
};

export const getCurrencySymbol = (setting?: string | null): string =>
    getCurrencyConfig(setting).symbol;

export const getCurrencyCodeLabel = (setting?: string | null): string =>
    getCurrencyConfig(setting).code;

/** Read agency currency from settings for the logged-in user. */
export const resolveAgencyCurrency = (db?: any, userEmail?: string | null): string => {
    const email =
        userEmail ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : '') ||
        '';
    const settings = db?.settings?.data || [];
    const match = settings.find((row: any) => row.email === email);
    return match?.currency || settings[0]?.currency || 'INR (₹)';
};

/** Convert an INR-stored amount into the selected currency. */
export const convertFromInr = (amountInInr: number, setting?: string | null): number => {
    const config = getCurrencyConfig(setting);
    const base = Number(amountInInr) || 0;
    return base * config.rateFromInr;
};

/** Convert a display-currency amount back to INR for storage. */
export const convertToInr = (displayAmount: number, setting?: string | null): number => {
    const config = getCurrencyConfig(setting);
    const base = Number(displayAmount) || 0;
    if (config.code === 'INR') return Math.round(base);
    return Math.round(base / config.rateFromInr);
};

/** INR storage value → numeric amount for price input fields. */
export const toDisplayAmount = (amountInInr: number, setting?: string | null): number => {
    const code = parseCurrencyCode(setting);
    return roundForDisplay(convertFromInr(amountInInr, setting), code);
};

/** Controlled input: INR storage → string shown in the field. */
export const formatPriceInputValue = (amountInInr: number, setting?: string | null): string => {
    const stored = Number(amountInInr) || 0;
    if (stored <= 0) return '';
    const code = parseCurrencyCode(setting);
    const display = toDisplayAmount(stored, setting);
    if (code === 'INR') return String(Math.round(display));
    return Number.isInteger(display) ? String(display) : display.toFixed(2);
};

/** Parse a locale-formatted money string (e.g. "€ 4.745,42") into a display-currency number. */
export const parseDisplayMoneyString = (raw: string, setting?: string | null): number => {
    let s = String(raw || '')
        .replace(/[₹$€£]/g, '')
        .replace(/\b(INR|USD|EUR|GBP|AED)\b/gi, '')
        .replace(/AED/gi, '')
        .trim();
    if (!s) return 0;

    const code = parseCurrencyCode(setting);

    if (code === 'INR') {
        s = s.replace(/,/g, '');
        const parsed = Number(s);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    if (code === 'EUR') {
        if (s.includes(',') && /\.\d{3}/.test(s)) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else if (s.includes(',')) {
            s = s.replace(',', '.');
        }
        const parsed = Number(s);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    // USD, GBP, AED — comma thousands separator
    s = s.replace(/,/g, '');
    const parsed = Number(s);
    return Number.isFinite(parsed) ? parsed : 0;
};

/** Parse user input in display currency → INR for storage. */
export const parsePriceInputValue = (raw: string, setting?: string | null): number => {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return convertToInr(parsed, setting);
};

const roundForDisplay = (amount: number, code: string): number => {
    if (code === 'INR') return Math.round(amount);
    return Math.round(amount * 100) / 100;
};

/** Format numeric part only (no symbol) — useful for emails and inputs. */
export const formatMoneyAmount = (
    amountInInr: number,
    setting?: string | null
): string => {
    const config = getCurrencyConfig(setting);
    const converted = roundForDisplay(convertFromInr(amountInInr, setting), config.code);
    const fractionDigits = config.code === 'INR' ? 0 : 2;
    return converted.toLocaleString(config.locale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
};

export type FormatMoneyOptions = {
    compact?: boolean;
    fallback?: string;
    includeSymbol?: boolean;
};

/** Format an INR-stored amount for display in the agency's selected currency. */
export const formatMoney = (
    amountInInr: number,
    setting?: string | null,
    options: FormatMoneyOptions = {}
): string => {
    const { compact = false, fallback = '—', includeSymbol = true } = options;
    const base = Number(amountInInr);
    if (!Number.isFinite(base)) return fallback;

    const config = getCurrencyConfig(setting);
    const converted = roundForDisplay(convertFromInr(base, setting), config.code);

    if (compact) {
        if (config.code === 'INR') {
            if (converted >= 10000000) {
                return `${includeSymbol ? config.symbol : ''}${(converted / 10000000).toFixed(2)} Cr`;
            }
            if (converted >= 100000) {
                return `${includeSymbol ? config.symbol : ''}${(converted / 100000).toFixed(2)} L`;
            }
        }
        if (config.code === 'USD' || config.code === 'EUR' || config.code === 'GBP') {
            if (converted >= 1000000) {
                return `${includeSymbol ? config.symbol : ''}${(converted / 1000000).toFixed(2)}M`;
            }
            if (converted >= 1000) {
                return `${includeSymbol ? config.symbol : ''}${(converted / 1000).toFixed(1)}K`;
            }
        }
    }

    const formatted = formatMoneyAmount(base, setting);
    if (!includeSymbol) return formatted;
    return config.code === 'AED' ? `${config.symbol} ${formatted}` : `${config.symbol} ${formatted}`;
};
