import { isTermsHtml, termsHtmlToPlainLines } from './termsRichText';

export type QuoteTermsRecord = {
    id: string;
    title: string;
    location: string;
    locations?: string[];
    content: string;
    agentId?: string | null;
    isDefault?: boolean;
    status?: string;
    updatedAt?: string;
};

const normalize = (value: string) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^\w\s,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const destinationTokens = (destination: string): string[] => {
    const norm = normalize(destination);
    if (!norm) return [];
    const parts = norm.split(',').map((p) => p.trim()).filter(Boolean);
    const tokens = new Set<string>([norm, ...parts]);
    parts.forEach((p) => {
        p.split(' ').forEach((w) => w.length > 2 && tokens.add(w));
    });
    return Array.from(tokens);
};

const recordTokens = (record: QuoteTermsRecord): string[] => {
    const tokens = new Set<string>();
    [record.location, ...(record.locations || [])].forEach((loc) => {
        const n = normalize(loc);
        if (n) {
            tokens.add(n);
            n.split(',').forEach((p) => p.trim() && tokens.add(p.trim()));
        }
    });
    return Array.from(tokens);
};

const scoreMatch = (destination: string, record: QuoteTermsRecord): number => {
    const destTokens = destinationTokens(destination);
    if (!destTokens.length) return 0;
    const termsTokens = recordTokens(record);
    let score = 0;
    termsTokens.forEach((tt) => {
        destTokens.forEach((dt) => {
            if (dt === tt) score += 10;
            else if (dt.includes(tt) || tt.includes(dt)) score += 5;
        });
    });
    return score;
};

export const parseTermsLines = (content: string): string[] =>
    String(content || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
        .filter(Boolean);

export const getFallbackTermsRecord = (): QuoteTermsRecord => ({
    id: 'TC-FALLBACK',
    title: 'Terms & Conditions',
    location: 'Global',
    content: DEFAULT_TERMS_CONTENT,
    status: 'Active',
});

/** Active terms visible to the current agent (or all for admin). */
export const getAvailableQuoteTerms = (
    allTerms: QuoteTermsRecord[] = [],
    agentId?: string | null,
    userRole?: string | null
): QuoteTermsRecord[] => {
    const active = allTerms.filter((t) => (t.status || 'Active') === 'Active');
    if (userRole === 'admin') return active;
    return active.filter((t) => !t.agentId || t.agentId === agentId);
};

/** Prefer explicit quote.termsId; otherwise match by destination. */
export const resolveQuoteTermsForQuote = (
    quote: { termsId?: string | null; destination?: string; agentId?: string | null },
    allTerms: QuoteTermsRecord[] = [],
    userRole?: string | null
): QuoteTermsRecord | null => {
    const available = getAvailableQuoteTerms(allTerms, quote.agentId, userRole);
    if (quote.termsId) {
        const selected = available.find((t) => t.id === quote.termsId);
        if (selected) return selected;
    }
    return resolveQuoteTerms(quote.destination || '', available, quote.agentId);
};

export const resolveQuoteTerms = (
    destination: string,
    allTerms: QuoteTermsRecord[] = [],
    agentId?: string | null
): QuoteTermsRecord | null => {
    const active = allTerms.filter((t) => (t.status || 'Active') === 'Active');
    const agentScoped = agentId
        ? active.filter((t) => !t.agentId || t.agentId === agentId)
        : active.filter((t) => !t.agentId);

    const ranked = agentScoped
        .map((record) => ({ record, score: scoreMatch(destination, record) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score);

    if (ranked.length > 0) return ranked[0].record;

    const agentDefault = agentScoped.find((t) => t.isDefault);
    if (agentDefault) return agentDefault;

    const globalDefault = active.find((t) => t.isDefault && !t.agentId);
    return globalDefault || null;
};

export const formatTermsForWhatsApp = (terms: QuoteTermsRecord | null): string => {
    const content = terms?.content || '';
    const lines = isTermsHtml(content) ? termsHtmlToPlainLines(content) : parseTermsLines(content);
    if (lines.length === 0) return '';
    const body = lines
        .map((line) => {
            if (line.startsWith('**') && line.endsWith('**')) return `*${line.slice(2, -2)}*`;
            if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) return `_${line.slice(1, -1)}_`;
            return `• ${line}`;
        })
        .join('\n');
    const title = terms?.title ? `*📋 ${terms.title}*\n` : '*📋 Terms & Conditions*\n';
    return `${title}${body}`;
};

export const formatTermsForEmail = (terms: QuoteTermsRecord | null): string => {
    const content = terms?.content || '';
    const lines = isTermsHtml(content) ? termsHtmlToPlainLines(content) : parseTermsLines(content);
    if (lines.length === 0) return '';
    const body = lines.map((line) => `• ${line.replace(/^\*\*|\*\*$/g, '').replace(/^\*|\*$/g, '')}`).join('\n');
    const title = terms?.title ? `${terms.title}\n` : 'Terms & Conditions\n';
    return `${title}${body}`;
};

export const DEFAULT_TERMS_CONTENT = `Rates are subject to availability at the time of booking.
Passport must be valid for at least 6 months from the travel date.
Travel insurance is highly recommended for international trips.
Cancellation and amendment charges apply as per supplier policy.`;
