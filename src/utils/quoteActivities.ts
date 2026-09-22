export type QuoteActivityItem = {
    id: string;
    at: string;
    sortKey: number;
    type: 'quote' | 'hotel' | 'status' | 'revision' | 'booking' | 'note';
    title: string;
    detail?: string;
    actor?: string;
};

const parseActivityDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) return d.getTime();
    const parts = dateStr.split(' ');
    if (parts.length !== 3) return 0;
    const monthMap: Record<string, number> = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const month = monthMap[parts[0]];
    const day = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);
    const year = parseInt(parts[2], 10);
    if (month === undefined || Number.isNaN(day) || Number.isNaN(year)) return 0;
    return new Date(year, month, day).getTime();
};

const isLikelyLeadRecordId = (id: string | undefined): boolean =>
    Boolean(id && !String(id).includes(' ') && id.length > 6);

const normalizePhone = (phone?: string): string =>
    String(phone || '').replace(/\s+/g, '').replace(/^\+/, '');

const normalizeEmail = (email?: string): string => String(email || '').trim().toLowerCase();

const isPlaceholderEmail = (email?: string): boolean => {
    const normalized = normalizeEmail(email);
    return !normalized || normalized.endsWith('@example.com');
};

import { formatDestinationLabel, parseDestinationParts, resolveWorldCountryName } from './worldLocations';

/** Country/region label from lead destination strings like "MV Maldives (Maldives)". */
export const extractLeadDestinationCountry = (destination?: string): string => {
    const parsed = parseDestinationParts(destination);
    if (parsed.country) return parsed.country;
    const raw = String(destination || '').trim();
    return raw ? resolveWorldCountryName(raw) : '';
};

/** City/place label from destination strings like "Sydney, Australia". */
export const extractLeadDestinationCity = (destination?: string): string =>
    parseDestinationParts(destination).city;

const destinationTokens = (destination?: string): string[] =>
    String(destination || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3);

/** Loose match for catalog destinations vs lead labels (handles parentheses and aliases). */
export const destinationsMatch = (left?: string, right?: string): boolean => {
    const a = String(left || '').trim().toLowerCase();
    const b = String(right || '').trim().toLowerCase();
    if (!a || !b) return false;
    if (a === b || a.includes(b) || b.includes(a)) return true;

    const countryA = extractLeadDestinationCountry(left).toLowerCase();
    const countryB = extractLeadDestinationCountry(right).toLowerCase();
    if (countryA && countryB && (countryA.includes(countryB) || countryB.includes(countryA))) {
        return true;
    }
    if (countryA && b.includes(countryA)) return true;
    if (countryB && a.includes(countryB)) return true;

    const tokensA = destinationTokens(left);
    const tokensB = destinationTokens(right);
    return tokensA.some((token) =>
        tokensB.some((other) => token.includes(other) || other.includes(token))
    );
};

export const findPresetForDestination = (destination: string, presets: any[]): any | undefined => {
    const dest = String(destination || '').trim();
    if (!dest || !Array.isArray(presets)) return undefined;
    return presets.find((preset) => destinationsMatch(preset.destination, dest));
};

export const findPresetForLead = (lead: any, presets: any[]): any | undefined => {
    if (!Array.isArray(presets) || presets.length === 0) return undefined;
    if (lead?.presetId) {
        const byId = presets.find((preset) => preset.id === lead.presetId);
        if (byId) return byId;
    }
    const leadDest = String(lead?.destination || '').trim();
    if (!leadDest) return undefined;
    return findPresetForDestination(leadDest, presets);
};

export const resolveQuoteDestinationLabel = (
    lead: any | null | undefined,
    presets: any[],
    options?: { matchedPreset?: any | null; quoteDestination?: string }
): string => {
    const explicit = String(options?.quoteDestination || '').trim();
    if (explicit) return explicit;
    const preset =
        options?.matchedPreset ?? (lead ? findPresetForLead(lead, presets) : undefined);
    if (preset?.destination) return preset.destination;
    return String(lead?.destination || '').trim();
};

export type LeadQuoteDestinationBootstrap = {
    matchedPreset?: any;
    destination: string;
    builderCountry: string;
    builderCity: string;
    selectedPresetId: string;
};

/** Map a lead (and optional existing quote) to builder destination + catalog preset. */
export const bootstrapLeadQuoteDestination = (
    lead: any,
    presets: any[],
    existingQuote?: any | null
): LeadQuoteDestinationBootstrap => {
    const leadDest = String(lead?.destination || '').trim();
    let matchedPreset: any | undefined;

    if (existingQuote?.presetId) {
        matchedPreset = presets.find((preset) => preset.id === existingQuote.presetId);
    }
    if (!matchedPreset && lead) {
        matchedPreset = findPresetForLead(lead, presets);
    }

    const quoteDest = String(existingQuote?.destination || '').trim();
    if (!matchedPreset && quoteDest) {
        matchedPreset = findPresetForDestination(quoteDest, presets);
    }

    const destination = resolveQuoteDestinationLabel(lead, presets, {
        matchedPreset,
        quoteDestination: quoteDest,
    });

    const builderCountry =
        extractLeadDestinationCountry(destination) ||
        extractLeadDestinationCountry(leadDest) ||
        '';
    const builderCity =
        extractLeadDestinationCity(destination) ||
        extractLeadDestinationCity(leadDest) ||
        '';

    return {
        matchedPreset,
        destination,
        builderCountry,
        builderCity,
        selectedPresetId: matchedPreset?.id || existingQuote?.presetId || '',
    };
};

/** Resolve quote destination label + catalog preset when the user picks country/city in the builder. */
export const resolveBuilderDestinationFromCountry = (
    country: string,
    presets: any[],
    city?: string
): { destination: string; matchedPreset?: any; selectedPresetId: string } => {
    const normalizedCountry = resolveWorldCountryName(country);
    const normalizedCity = String(city || '').trim();
    const fullLabel = formatDestinationLabel(normalizedCity, normalizedCountry);

    if (!normalizedCountry && !normalizedCity) {
        return { destination: '', selectedPresetId: '' };
    }

    const matched =
        (fullLabel ? findPresetForDestination(fullLabel, presets) : undefined) ||
        (normalizedCountry ? findPresetForDestination(normalizedCountry, presets) : undefined) ||
        presets.find(
            (preset) =>
                normalizedCountry &&
                extractLeadDestinationCountry(preset.destination).toLowerCase() ===
                    normalizedCountry.toLowerCase()
        );

    if (matched) {
        const presetCountry = extractLeadDestinationCountry(matched.destination).toLowerCase();
        const useCustomCity =
            normalizedCity &&
            presetCountry === normalizedCountry.toLowerCase();
        return {
            destination: useCustomCity
                ? formatDestinationLabel(normalizedCity, normalizedCountry)
                : matched.destination,
            matchedPreset: matched,
            selectedPresetId: matched.id,
        };
    }

    return {
        destination: fullLabel || normalizedCountry,
        selectedPresetId: '',
    };
};

/** Resolve the lead record for a quotation (tripId → email → phone → leadId → unique name). */
export const findLeadForQuote = (quote: any, leads: any[]): any | undefined => {
    if (!quote || !Array.isArray(leads) || leads.length === 0) return undefined;

    const tripId = quote.tripId || quote.trackingId;
    if (tripId) {
        const byTrip = leads.find(
            (l: any) => l.trackingId === tripId || l.tripId === tripId
        );
        if (byTrip) return byTrip;
    }

    const email = normalizeEmail(quote.email || quote.customerEmail);
    if (email && !isPlaceholderEmail(email)) {
        const byEmail = leads.find((l: any) => normalizeEmail(l.email) === email);
        if (byEmail) return byEmail;
    }

    const phone = normalizePhone(quote.phone);
    if (phone) {
        const byPhone = leads.find((l: any) => normalizePhone(l.phone) === phone);
        if (byPhone) return byPhone;
    }

    if (quote.leadId) {
        const byId = leads.find((l: any) => l.id === quote.leadId);
        if (byId) return byId;
    }

    const customer = String(quote.customer || '').trim();
    if (!customer) return undefined;
    const nameMatches = leads.filter((l: any) => l.name === customer);
    return nameMatches.length === 1 ? nameMatches[0] : undefined;
};

/** Match a lead from builder/contact fields (prefers explicit leadId and contact data over name). */
export const findLeadByContact = (
    leads: any[],
    contact: {
        leadId?: string | null;
        name?: string;
        phone?: string;
        email?: string;
        tripId?: string;
    }
): any | undefined => {
    if (!Array.isArray(leads) || leads.length === 0) return undefined;

    if (contact.leadId) {
        const byId = leads.find((l: any) => l.id === contact.leadId);
        if (byId) return byId;
    }

    if (contact.tripId) {
        const byTrip = leads.find(
            (l: any) => l.trackingId === contact.tripId || l.tripId === contact.tripId
        );
        if (byTrip) return byTrip;
    }

    const email = normalizeEmail(contact.email);
    if (email && !isPlaceholderEmail(email)) {
        const byEmail = leads.find((l: any) => normalizeEmail(l.email) === email);
        if (byEmail) return byEmail;
    }

    const phone = normalizePhone(contact.phone);
    if (phone) {
        const byPhone = leads.find((l: any) => normalizePhone(l.phone) === phone);
        if (byPhone) return byPhone;
    }

    const name = String(contact.name || '').trim();
    if (!name) return undefined;
    const nameMatches = leads.filter((l: any) => l.name === name);
    return nameMatches.length === 1 ? nameMatches[0] : undefined;
};

const resolveLeadRecordId = (id?: string | null): string | null => {
    const raw = String(id || '').trim();
    if (!raw) return null;
    if (raw.startsWith('lead:')) return raw.slice(5) || null;
    return raw;
};

const isSyntheticLeadKey = (id?: string | null): boolean => {
    const raw = String(id || '');
    return (
        raw.startsWith('trip:') ||
        raw.startsWith('email:') ||
        raw.startsWith('phone:') ||
        raw.startsWith('quote:')
    );
};

/** Whether a quotation belongs to a specific lead (never merges same-name leads with different contact info). */
export const quoteBelongsToLead = (quote: any, lead: any, allLeads: any[] = []): boolean => {
    if (!quote || !lead) return false;

    const leadRecordId = resolveLeadRecordId(lead.id);
    if (quote.leadId && leadRecordId && !isSyntheticLeadKey(leadRecordId)) {
        return quote.leadId === leadRecordId;
    }

    const quoteTripId = quote.tripId || quote.trackingId;
    const leadTripId = lead.tripId || lead.trackingId;
    if (quoteTripId && leadTripId && quoteTripId === leadTripId) {
        return true;
    }

    const quoteEmail = normalizeEmail(quote.email || quote.customerEmail);
    const leadEmail = normalizeEmail(lead.email);
    if (quoteEmail && leadEmail && !isPlaceholderEmail(quoteEmail) && quoteEmail === leadEmail) {
        return true;
    }

    const quotePhone = normalizePhone(quote.phone);
    const leadPhone = normalizePhone(lead.phone);
    if (quotePhone && leadPhone && quotePhone === leadPhone) {
        return true;
    }

    if (quote.leadId && leadRecordId && quote.leadId === leadRecordId) {
        return true;
    }

    const customer = String(quote.customer || '').trim();
    if (!customer || customer !== lead.name) return false;

    const sameNameLeads = allLeads.filter((l: any) => l.name === customer);
    if (sameNameLeads.length > 1) return false;
    return sameNameLeads.length === 1 && sameNameLeads[0].id === lead.id;
};

/** Pull in sibling revisions / versions that share leadId, parent chain, or trip id. */
export const expandQuoteVersionFamily = (seedQuotes: any[], allQuotes: any[]): any[] => {
    const byId = new Map<string, any>();
    seedQuotes.forEach((q) => {
        if (q?.id) byId.set(q.id, q);
    });

    let changed = true;
    while (changed) {
        changed = false;
        for (const q of allQuotes) {
            if (!q?.id || byId.has(q.id)) continue;

            const linked = Array.from(byId.values()).some((member) => {
                if (member.leadId && q.leadId && member.leadId === q.leadId) return true;
                if (member.parentId === q.id || q.parentId === member.id) return true;
                const memberTrip = member.tripId || member.trackingId;
                const quoteTrip = q.tripId || q.trackingId;
                if (memberTrip && quoteTrip && memberTrip === quoteTrip) return true;
                return false;
            });

            if (linked) {
                byId.set(q.id, q);
                changed = true;
            }
        }
    }

    return Array.from(byId.values());
};

export const getLatestQuoteForLead = (quotes: any[], lead: any, allLeads: any[] = []): any | undefined =>
    quotes
        .filter((q: any) => quoteBelongsToLead(q, lead, allLeads))
        .sort((a: any, b: any) => {
            if (b.customizationRequest && !a.customizationRequest) return 1;
            if (a.customizationRequest && !b.customizationRequest) return -1;
            return compareQuoteVersions(b.version, a.version);
        })[0];

export const toLocalCalendarDay = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const parseCalendarDateInput = (iso: string): Date => {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day);
};

/** When a quote was created/saved — local calendar day, not trip departure. */
export const resolveQuoteHistoryDate = (quote: any, leads: any[] = []): Date | null => {
    if (!quote) return null;

    const fromInstant = (value?: string | null) => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return toLocalCalendarDay(parsed);
    };

    const fromActivity = () => {
        if (!Array.isArray(quote.activityLog) || quote.activityLog.length === 0) return null;
        let latest = 0;
        quote.activityLog.forEach((entry: any) => {
            const t = new Date(entry?.at || '').getTime();
            if (!Number.isNaN(t)) latest = Math.max(latest, t);
        });
        return latest > 0 ? toLocalCalendarDay(new Date(latest)) : null;
    };

    const fromLead = () => {
        if (!Array.isArray(leads) || leads.length === 0) return null;
        const lead = quote.leadId
            ? leads.find((l: any) => l.id === quote.leadId)
            : findLeadForQuote(quote, leads);
        return fromInstant(lead?.createdAt);
    };

    return (
        fromInstant(quote.createdAt) ||
        fromInstant(quote.savedAt) ||
        fromInstant(quote.updatedAt) ||
        fromActivity() ||
        fromLead()
    );
};

const calendarDayMatchesRange = (
    day: Date,
    startIso: string,
    endIso: string
): boolean => {
    if (!startIso && !endIso) return true;

    let rangeStart = startIso;
    let rangeEnd = endIso;
    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
        [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
    }

    if (rangeStart && day < toLocalCalendarDay(parseCalendarDateInput(rangeStart))) {
        return false;
    }
    if (rangeEnd && day > toLocalCalendarDay(parseCalendarDateInput(rangeEnd))) {
        return false;
    }
    return true;
};

export const quoteMatchesHistoryDateRange = (
    quote: any,
    startIso: string,
    endIso: string,
    leads: any[] = []
): boolean => {
    if (!startIso && !endIso) return true;

    const quoteDay = resolveQuoteHistoryDate(quote, leads);
    if (!quoteDay) return false;

    return calendarDayMatchesRange(quoteDay, startIso, endIso);
};

/** Priority desk leads: quote activity in range, or lead created date when no quotes exist. */
export const leadMatchesDeskDateRange = (
    lead: any,
    startIso: string,
    endIso: string,
    allQuotes: any[] = [],
    allLeads: any[] = []
): boolean => {
    if (!startIso && !endIso) return true;
    if (!lead) return false;

    const matched = allQuotes.filter((q: any) => quoteBelongsToLead(q, lead, allLeads));
    const family = expandQuoteVersionFamily(matched, allQuotes);
    const uniqueQuotes = Array.from(new Map(family.map((q) => [q.id, q])).values());

    if (uniqueQuotes.length > 0) {
        return uniqueQuotes.some((q) =>
            quoteMatchesHistoryDateRange(q, startIso, endIso, allLeads)
        );
    }

    if (!lead.createdAt) return false;
    const created = new Date(lead.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    return calendarDayMatchesRange(toLocalCalendarDay(created), startIso, endIso);
};

/** Backfill missing createdAt from activity log timestamps. */
export const inferQuoteCreatedAt = (quote: any): string | null => {
    if (quote?.createdAt) return quote.createdAt;
    if (!Array.isArray(quote.activityLog) || quote.activityLog.length === 0) return null;

    let latestAt = '';
    let latest = 0;
    quote.activityLog.forEach((entry: any) => {
        const t = new Date(entry?.at || '').getTime();
        if (!Number.isNaN(t) && t >= latest) {
            latest = t;
            latestAt = entry.at;
        }
    });
    return latestAt || null;
};

/** Stable sidebar/history group key — never groups different leads that share a name. */
export const getQuoteLeadGroupKey = (quote: any, leads: any[] = []): string => {
    if (leads.length > 0) {
        const resolved = findLeadForQuote(quote, leads);
        if (resolved?.id) return `lead:${resolved.id}`;
    }
    if (quote?.leadId) return `lead:${quote.leadId}`;
    const tripId = quote?.tripId || quote?.trackingId;
    if (tripId) return `trip:${tripId}`;
    const email = normalizeEmail(quote?.email || quote?.customerEmail);
    if (email && !isPlaceholderEmail(email)) return `email:${email}`;
    const phone = normalizePhone(quote?.phone);
    if (phone) return `phone:${phone}`;
    return `quote:${quote?.id || String(quote?.customer || '').trim().toLowerCase()}`;
};

/** Numeric-friendly version sort (1 < 1.1 < 1.1.1 < 2). */
export const compareQuoteVersions = (a: string | undefined, b: string | undefined): number =>
    normalizeQuoteVersion(a).localeCompare(normalizeQuoteVersion(b), undefined, { numeric: true });

/** Repair legacy quotes saved with missing version (e.g. "undefined.1" → "1.1"). */
export const normalizeQuoteVersion = (version?: string | null): string => {
    const raw = String(version ?? '').trim();
    if (!raw || raw === 'undefined') return '1';
    if (raw.startsWith('undefined.')) {
        const suffix = raw.slice('undefined.'.length);
        return suffix ? `1.${suffix}` : '1';
    }
    return raw;
};

export const formatQuoteVersionLabel = (version?: string | null): string =>
    normalizeQuoteVersion(version);

/** All quotes for a lead — used when assigning the next version number. */
export const getQuotesForLeadVersioning = (
    allQuotes: any[],
    lead: any,
    allLeads: any[] = [],
    extraQuotes: any[] = []
): any[] => {
    if (!lead) return [...extraQuotes];
    const byId = new Map<string, any>();
    allQuotes.forEach((q) => {
        if (q.leadId === lead.id || quoteBelongsToLead(q, lead, allLeads)) {
            byId.set(q.id, q);
        }
    });
    extraQuotes.forEach((q) => {
        if (!q.leadId || q.leadId === lead.id || quoteBelongsToLead(q, lead, allLeads)) {
            byId.set(q.id, q);
        }
    });
    return Array.from(byId.values());
};

/** Next major version for a brand-new quote on the same lead (v1 → v2, v2 → v3). */
export const resolveNextPrimaryQuoteVersion = (allQuotes: any[]): string => {
    const primaryQuotes = allQuotes.filter(
        (q: any) => !String(normalizeQuoteVersion(q.version || '1')).includes('.')
    );
    if (primaryQuotes.length === 0) return '1';
    const primaryNumbers = primaryQuotes.map(
        (q: any) => parseInt(normalizeQuoteVersion(q.version), 10) || 0
    );
    const maxPrimary = Math.max(0, ...primaryNumbers);
    return String(maxPrimary + 1);
};

/** Next child version when revising a quote (e.g. v1 → v1.1, v1.1 → v1.1.1). */
export const resolveChildQuoteVersion = (
    parentQuote: { id: string; version?: string | null },
    allQuotes: any[]
): string => {
    const parentVer = normalizeQuoteVersion(parentQuote.version); 
    const siblings = allQuotes.filter((q: any) => q.parentId === parentQuote.id);
    if (siblings.length === 0) {
        return `${parentVer}.1`;
    }
    const suffixes = siblings.map((s: any) => {
        const parts = String(normalizeQuoteVersion(s.version)).split('.');
        return parseInt(parts[parts.length - 1], 10) || 0;
    });
    const maxSuffix = Math.max(0, ...suffixes);
    return `${parentVer}.${maxSuffix + 1}`;
};

export const quoteVersionDepth = (version?: string): number =>
    Math.max(0, String(version || '1').split('.').filter(Boolean).length - 1);

/** All quotations for a lead/customer — every version (v1, v1.1, v1.1.1, v2, …). */
export const getQuotesForLeadWorkbench = (
    allQuotes: any[],
    lead: { id?: string; name?: string; tripId?: string; trackingId?: string; email?: string; phone?: string } | null,
    selectedQuote?: any | null,
    allLeads: any[] = []
): any[] => {
    if (!lead && !selectedQuote) return [];

    const resolvedLead =
        lead ||
        (selectedQuote
            ? {
                  id: selectedQuote.leadId,
                  name: selectedQuote.customer,
                  tripId: selectedQuote.tripId || selectedQuote.trackingId,
                  trackingId: selectedQuote.trackingId || selectedQuote.tripId,
                  email: selectedQuote.email || selectedQuote.customerEmail,
                  phone: selectedQuote.phone,
              }
            : null);

    const matched = allQuotes.filter((q: any) => quoteBelongsToLead(q, resolvedLead, allLeads));
    const expanded = expandQuoteVersionFamily(matched, allQuotes);

    const byId = new Map<string, any>();
    expanded.forEach((q) => byId.set(q.id, q));

    if (selectedQuote?.id && !byId.has(selectedQuote.id)) {
        byId.set(selectedQuote.id, selectedQuote);
        expandQuoteVersionFamily([selectedQuote], allQuotes).forEach((q) => byId.set(q.id, q));
    }

    return Array.from(byId.values()).sort((a, b) =>
        compareQuoteVersions(b.version, a.version)
    );
};

export const isFlightMealsIncludedOnQuote = (quote: {
    needFlight?: boolean;
    flightMeal?: { optIn?: boolean };
    flightDetails?: { mealOpt?: boolean };
} | null | undefined): boolean => {
    if (!quote || quote.needFlight === false) return false;
    if (quote.flightMeal?.optIn === true) return true;
    if (quote.flightMeal?.optIn === false) return false;
    if (quote.flightDetails?.mealOpt === true) return true;
    if (quote.flightDetails?.mealOpt === false) return false;
    return false;
};

export const filterQuoteItemsForDisplay = (items: any[] | undefined, quote: any): any[] =>
    (items || []).filter((item) => {
        const desc = String(item.desc || '').toLowerCase();
        if (desc.includes('flight') && desc.includes('meal')) {
            return isFlightMealsIncludedOnQuote(quote);
        }
        return true;
    });

export const resolveQuoteTimestamp = (
    quote:
        | {
              createdAt?: string;
              updatedAt?: string;
              date?: string;
              activityLog?: Array<{ at?: string }>;
          }
        | string
        | null
        | undefined
): string => {
    if (!quote) return '';
    if (typeof quote === 'string') return quote;
    if (quote.createdAt) return quote.createdAt;
    if (quote.updatedAt) return quote.updatedAt;
    const logEntry = Array.isArray(quote.activityLog)
        ? quote.activityLog.find((entry) => entry?.at && (entry.at.includes('T') || /\d{1,2}:\d{2}/.test(entry.at)))
        : undefined;
    if (logEntry?.at) return logEntry.at;
    return quote.date || '';
};

/** Shows the actual quote date and time (not relative phrases like "a few seconds ago"). */
export const formatQuoteTimestamp = (dateStr?: string | null): string => {
    const raw = String(dateStr || '').trim();
    if (!raw) return '—';
    const ts = parseActivityDate(raw);
    if (!ts) return raw;
    return new Date(ts).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

/** @deprecated Use formatQuoteTimestamp */
export const formatRelativeQuoteTime = formatQuoteTimestamp;

export const buildQuoteActivityLog = (
    lead: any | null,
    quotes: any[],
    hotels: any[] = []
): QuoteActivityItem[] => {
    const items: QuoteActivityItem[] = [];
    const hotelName = (id: string) => hotels.find((h) => h.id === id)?.name || 'Hotel';

    quotes.forEach((q) => {
        const at = q.createdAt || q.date || '';
        const sortKey = parseActivityDate(at) || Date.now();
        const actor = q.agentName || 'Agent';

        items.push({
            id: `${q.id}-created`,
            at,
            sortKey,
            type: 'quote',
            title: `Quote v${q.version || '1'} created`,
            detail: `${q.destination || 'Package'} — sent to client`,
            actor,
        });

        if (q.status && q.status !== 'sent') {
            items.push({
                id: `${q.id}-status-${q.status}`,
                at,
                sortKey: sortKey + 1,
                type: 'status',
                title: `Quote status: ${String(q.status).replace(/_/g, ' ')}`,
                detail: `Version ${q.version}`,
                actor,
            });
        }

        if (q.customizationRequest) {
            items.push({
                id: `${q.id}-revision`,
                at,
                sortKey: sortKey + 2,
                type: 'revision',
                title: 'Revision requested',
                detail: q.customizationRequest,
                actor: q.customer || lead?.name,
            });
        }

        const stays = (q.hotelStays || []).filter((s: any) => s?.hotelId);
        if (stays.length > 0) {
            const hotelSummary = stays
                .map((s: any) => `${s.nights}N ${hotelName(s.hotelId)}`)
                .join(' • ');
            items.push({
                id: `${q.id}-hotels`,
                at,
                sortKey: sortKey + 3,
                type: 'hotel',
                title: 'Hotel selection updated',
                detail: hotelSummary,
                actor,
            });
        } else if (q.hotelId) {
            items.push({
                id: `${q.id}-hotel-single`,
                at,
                sortKey: sortKey + 3,
                type: 'hotel',
                title: 'Hotel tier selected',
                detail: `${hotelName(q.hotelId)} (${q.hotelTier || 'Standard'})`,
                actor,
            });
        }

        if (q.status === 'confirmed' || lead?.confirmedQuoteId === q.id) {
            items.push({
                id: `${q.id}-confirmed`,
                at,
                sortKey: sortKey + 4,
                type: 'booking',
                title: 'Booking confirmed from quote',
                detail: `Quote v${q.version} mobilized`,
                actor,
            });
        }

        if (Array.isArray(q.activityLog)) {
            q.activityLog.forEach((entry: any, idx: number) => {
                items.push({
                    id: `${q.id}-log-${idx}`,
                    at: entry.at || at,
                    sortKey: parseActivityDate(entry.at || at) || sortKey + 5 + idx,
                    type: entry.type || 'note',
                    title: entry.title || 'Update',
                    detail: entry.detail,
                    actor: entry.actor || actor,
                });
            });
        }
    });

    if (lead?.status === 'canceled') {
        items.push({
            id: `${lead.id}-canceled`,
            at: lead.canceledAt || lead.updatedAt || '',
            sortKey: parseActivityDate(lead.canceledAt || '') || Date.now(),
            type: 'status',
            title: 'Trip canceled',
            detail: lead.cancelReason || 'Lead marked as canceled',
            actor: lead.agentName,
        });
    }

    return items.sort((a, b) => b.sortKey - a.sortKey);
};

export const appendQuoteActivityEntry = (
    quote: any,
    entry: { type?: QuoteActivityItem['type']; title: string; detail?: string; actor?: string }
) => {
    const log = Array.isArray(quote.activityLog) ? [...quote.activityLog] : [];
    log.push({
        at: new Date().toISOString(),
        type: entry.type || 'note',
        title: entry.title,
        detail: entry.detail,
        actor: entry.actor,
    });
    return log;
};
