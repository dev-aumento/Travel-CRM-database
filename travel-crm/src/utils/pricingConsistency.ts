import { buildQuoteLineItemsFromQuote } from './quoteLineItems';
import {
    calculateQuote,
    calculatePackageBaseTravel,
    guessPresetFromDestination,
    parseTravelers,
    type PricingResult,
} from './pricing';
import { sumStayHotelTotal } from './hotelStayPricing';
import { compareQuoteVersions, normalizeQuoteVersion } from './quoteActivities';
import {
    convertToInr,
    formatMoney,
    parseCurrencyCode,
    parseDisplayMoneyString,
    resolveAgencyCurrency,
} from './currency';

const parseAmount = (value: any): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]+/g, '');
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

/** Read paid/total fields stored as INR numbers or legacy formatted currency strings. */
const parseStoredInrAmount = (value: any, db?: any): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.round(value);
    }
    if (typeof value !== 'string') return 0;

    const trimmed = value.trim();
    if (!trimmed) return 0;

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return Math.round(Number(trimmed));
    }

    const setting = resolveAgencyCurrency(db);
    const code = parseCurrencyCode(setting);
    const looksFormatted =
        /[₹$€£]/.test(trimmed) || /\bAED\b/i.test(trimmed) || (code !== 'INR' && /[.,]/.test(trimmed));

    if (looksFormatted) {
        const display = parseDisplayMoneyString(trimmed, setting);
        if (display > 0) {
            return convertToInr(display, setting);
        }
    }

    return Math.round(parseAmount(trimmed));
};

const formatBudget = (amount: number, db?: any) =>
    formatMoney(amount || 0, resolveAgencyCurrency(db));

/** Bumped when quote pricing rules change; triggers in-place refresh of saved quotations. */
export const CURRENT_QUOTE_PRICING_REVISION = 3;

const resolveLinkedLead = (record: any, db: any) => {
    const leads = db?.leads?.data || [];
    if (!record) return undefined;

    if (record.leadId) {
        const byLeadId = leads.find((l: any) => l.id === record.leadId);
        if (byLeadId) return byLeadId;
    }
    if (record.id) {
        const byBookingId = leads.find((l: any) => l.bookingId === record.id);
        if (byBookingId) return byBookingId;
    }
    if (record.quoteId) {
        const byQuote = leads.find((l: any) => l.confirmedQuoteId === record.quoteId);
        if (byQuote) return byQuote;
    }
    const tripId = record.trackingId || record.tripId;
    if (tripId) {
        const byTrip = leads.find(
            (l: any) => l.trackingId === tripId || l.tripId === tripId
        );
        if (byTrip) return byTrip;
    }
    const nameMatches = leads.filter((l: any) => l.name === record.customer);
    return nameMatches.length === 1 ? nameMatches[0] : undefined;
};

const resolveLinkedQuote = (record: any, db: any) => {
    const quotes = db?.quotations?.data || [];

    if (record?.quoteId) {
        const quoteById = quotes.find((q: any) => q.id === record.quoteId);
        if (quoteById) return quoteById;
    }

    const byCustomer = quotes
        .filter((q: any) => q.customer === record?.customer)
        .sort((a: any, b: any) => compareQuoteVersions(b.version, a.version));

    return byCustomer[0] || null;
};

const getQuotesForLead = (lead: any, db: any) => {
    if (!lead) return [];
    const quotes = db?.quotations?.data || [];
    return quotes.filter(
        (q: any) =>
            q.leadId === lead.id ||
            q.customer === lead.name ||
            (lead.trackingId && (q.trackingId === lead.trackingId || q.tripId === lead.trackingId))
    );
};

/** True when quote was built from a package template (not a fully custom plan). */
export const isTemplatePackageQuote = (quote: any): boolean => {
    if (quote?.tripMode === 'package') return true;
    if (quote?.tripMode === 'custom') return false;
    const source = String(quote?.source || '').trim();
    if (source === 'Quotation') return true;
    if (source === 'Custom Trip') return false;
    return false;
};

const resolveTripMode = (quote: any): 'package' | 'custom' =>
    isTemplatePackageQuote(quote) ? 'package' : 'custom';

const resolvePricing = (source: any, fallback: any, db: any) => {
    const travelers = parseTravelers(source?.travelers || fallback?.travelers);
    const presetId =
        source?.presetId ||
        fallback?.presetId ||
        guessPresetFromDestination(source?.destination || fallback?.destination || fallback?.package);

    return calculateQuote(
        {
            presetId,
            adults: travelers.adults,
            kids: travelers.kids,
            kidsAges: source?.kidAges || fallback?.kidAges,
            itinerary: source?.itinerary || fallback?.itinerary,
            flightMeal: source?.flightMeal || fallback?.flightMeal,
            hotelTier: source?.hotelTier || fallback?.hotelTier || 'Standard',
            hotelId: source?.hotelId || fallback?.hotelId,
            hotelStays: source?.hotelStays || fallback?.hotelStays,
            hotelMealPlan: source?.hotelMealPlan || fallback?.hotelMealPlan || 'CP (Breakfast Only)',
            needFlight:
                source?.needFlight !== undefined
                    ? source.needFlight !== false
                    : fallback?.needFlight !== false,
            customHotelRate: source?.customHotelRate ?? fallback?.customHotelRate,
            customFlightTotal: source?.customFlightTotal ?? fallback?.customFlightTotal,
            tripMode: resolveTripMode(source || fallback),
        },
        db?.customPresets?.data || [],
        db?.hotels?.data || []
    );
};

const sumItemTotals = (items: any[], matcher: (desc: string) => boolean) =>
    (items || [])
        .filter((i: any) => matcher(String(i.desc || '').toLowerCase()))
        .reduce((sum: number, i: any) => sum + (Number(i.total) || 0), 0);

const isFlightItem = (desc: string) =>
    (desc.includes('return flight') || desc.includes('flight')) &&
    !desc.includes('meal');

const isHotelStayItem = (desc: string) =>
    desc.includes('hotel accommodation') ||
    (desc.includes('hotel') && !desc.includes('extra') && !desc.includes('meal'));

export const canResolveQuotePricing = (quote: any): boolean =>
    Boolean(quote && (quote.presetId || quote.destination || quote.package));

const getStoredQuoteSubtotal = (quote: any) => {
    const itemsSubtotal = (quote?.items || []).reduce(
        (sum: number, i: any) => sum + (Number(i.total) || 0),
        0
    );
    const storedSubtotal = parseAmount(quote?.subtotal);
    return itemsSubtotal > 0 ? itemsSubtotal : storedSubtotal;
};

const sumHotelStaysTotal = (quote: any) => {
    const stays = (quote?.hotelStays || []).filter(
        (s: any) => s?.hotelId && Number(s.nights) > 0
    );
    return stays.reduce((sum: number, stay: any) => sum + sumStayHotelTotal(stay), 0);
};

const hasCustomHotelBookings = (quote: any) => {
    const stays = (quote?.hotelStays || []).filter(
        (s: any) => s?.hotelId && Number(s.nights) > 0
    );
    return stays.length > 0;
};

const sumItineraryActivities = (quote: any) => {
    let total = 0;
    (quote?.itinerary || []).forEach((day: any) => {
        (day?.activities || []).forEach((act: any) => {
            total += act.customPrice ?? act.price ?? 0;
        });
    });
    return total;
};

const sumAdditionalActivities = (quote: any) =>
    (quote?.additionalActivities || []).reduce(
        (sum: number, row: any) => sum + Math.max(0, Number(row?.rate) || 0),
        0
    );

export type QuoteAdditionalServiceChargeConfig = {
    enabled: boolean;
    percent: number;
    fixedAmount: number;
    gstEnabled?: boolean;
    gstPercent?: number;
};

export const normalizeQuoteAdditionalServiceCharge = (quote: any): QuoteAdditionalServiceChargeConfig => {
    const raw = quote?.additionalServiceCharge;
    if (!raw || typeof raw !== 'object') {
        return { enabled: false, percent: 0, fixedAmount: 0, gstEnabled: false, gstPercent: 0 };
    }
    return {
        enabled: Boolean((raw as any).enabled),
        percent: Math.max(0, Number((raw as any).percent) || 0),
        fixedAmount: Math.max(0, Number((raw as any).fixedAmount) || 0),
        gstEnabled: Boolean((raw as any).gstEnabled),
        gstPercent: Math.max(0, Number((raw as any).gstPercent) || 0),
    };
};

/** Percentage on services, or fixed amount — percentage wins if both are set. */
export const calculateAdditionalServiceChargeAmount = (
    servicesTotal: number,
    config: QuoteAdditionalServiceChargeConfig
): number => {
    if (!config.enabled) return 0;
    const percent = Math.max(0, Number(config.percent) || 0);
    const fixedAmount = Math.max(0, Number(config.fixedAmount) || 0);
    if (percent > 0) {
        return Math.round(servicesTotal * (percent / 100));
    }
    if (fixedAmount > 0) {
        return Math.round(fixedAmount);
    }
    return 0;
};

/** GST applied only on the additional service charge amount. */
export const calculateGstOnAdditionalServiceCharge = (
    chargeAmount: number,
    config: Pick<QuoteAdditionalServiceChargeConfig, 'gstEnabled' | 'gstPercent'>
): number => {
    if (!config.gstEnabled || chargeAmount <= 0) return 0;
    const percent = Math.max(0, Number(config.gstPercent) || 0);
    if (percent <= 0) return 0;
    return Math.round(chargeAmount * (percent / 100));
};

export const appendServiceChargeAndGstLineItems = (
    baseItems: any[],
    chargeAmount: number,
    gstAmount: number,
    gstPercent = 0
) => {
    const items = [...baseItems];
    if (chargeAmount > 0) {
        items.push({
            desc: 'Additional Service Charge',
            sub: 'Service fee on package services',
            qty: '1',
            price: chargeAmount,
            total: chargeAmount,
        });
    }
    if (gstAmount > 0) {
        items.push({
            desc: 'GST',
            sub: `${gstPercent}% on additional service charge`,
            qty: '1',
            price: gstAmount,
            total: gstAmount,
        });
    }
    return items;
};

const applyServiceChargeToEstimate = (
    quote: any,
    estimate: {
        baseTravel: number;
        services: number;
        subtotal: number;
        taxes: number;
        total: number;
    }
) => {
    const serviceChargeConfig = normalizeQuoteAdditionalServiceCharge(quote);
    const charge = calculateAdditionalServiceChargeAmount(
        estimate.services,
        serviceChargeConfig
    );
    const taxes = calculateGstOnAdditionalServiceCharge(charge, serviceChargeConfig);
    return {
        ...estimate,
        additionalServiceCharge: charge,
        taxes,
        total: estimate.subtotal + charge + taxes,
    };
};

const getPackageHotelBaseForQuote = (quote: any, db: any): number => {
    if (!canResolveQuotePricing(quote)) return 0;

    const travelers = parseTravelers(quote?.travelers);
    const presetId =
        quote?.presetId ||
        guessPresetFromDestination(quote?.destination || quote?.package);

    return calculatePackageBaseTravel(
        {
            presetId,
            adults: travelers.adults,
            kids: travelers.kids,
            kidsAges: quote?.kidAges,
            hotelTier: quote?.hotelTier || 'Standard',
            needFlight: false,
        },
        db?.customPresets?.data || []
    );
};

const getPackageBaseTravelForQuote = (quote: any, db: any): number => {
    if (!canResolveQuotePricing(quote)) return 0;

    const travelers = parseTravelers(quote?.travelers);
    const presetId =
        quote?.presetId ||
        guessPresetFromDestination(quote?.destination || quote?.package);

    return calculatePackageBaseTravel(
        {
            presetId,
            adults: travelers.adults,
            kids: travelers.kids,
            kidsAges: quote?.kidAges,
            hotelTier: quote?.hotelTier || 'Standard',
            needFlight: quote?.needFlight !== false,
            customFlightTotal: quote?.customFlightTotal,
        },
        db?.customPresets?.data || []
    );
};

/** Base Travel + Services split that matches review line items and always sums to subtotal. */
export const buildQuoteEstimateBuckets = (
    quote: any,
    pricing: PricingResult,
    db: any
) => {
    const needFlight = quote?.needFlight !== false;
    const customHotels = hasCustomHotelBookings(quote);
    const additional = sumAdditionalActivities(quote);

    const hasChosenActivities = (quote?.itinerary || []).some(
        (day: any) => Array.isArray(day?.activities) && day.activities.length > 0
    );
    const activityTotal = hasChosenActivities
        ? sumItineraryActivities(quote)
        : pricing.breakdown.activity;

    const subtotal = pricing.subtotal + additional;
    const taxes = 0;
    const total = subtotal;

    if (isTemplatePackageQuote(quote)) {
        const baseTravel = getPackageBaseTravelForQuote(quote, db);
        const services = Math.max(0, subtotal - baseTravel);
        return applyServiceChargeToEstimate(quote, {
            baseTravel,
            services,
            subtotal,
            taxes,
            total: subtotal,
        });
    }

    if (customHotels && !needFlight) {
        return applyServiceChargeToEstimate(quote, {
            baseTravel: 0,
            services: subtotal,
            subtotal,
            taxes,
            total: subtotal,
        });
    }

    let services =
        (customHotels ? pricing.breakdown.hotel : 0) +
        (pricing.breakdown.hotelExtras || 0) +
        activityTotal +
        additional +
        (customHotels ? 0 : pricing.breakdown.transfer) +
        (needFlight
            ? (pricing.breakdown.flightMeals || 0) + (pricing.breakdown.visa || 0)
            : 0);

    let baseTravel = 0;
    if (!customHotels) {
        baseTravel = getPackageBaseTravelForQuote(quote, db);
    } else if (needFlight) {
        const packageBaseFull = getPackageBaseTravelForQuote(quote, db);
        const packageHotelOnly = getPackageHotelBaseForQuote(quote, db);
        baseTravel = Math.max(0, packageBaseFull - packageHotelOnly);
    }

    const calculatedSum = baseTravel + services;
    if (Math.abs(calculatedSum - subtotal) > 1) {
        baseTravel = Math.max(0, subtotal - services);
    }

    return applyServiceChargeToEstimate(quote, {
        baseTravel,
        services,
        subtotal,
        taxes,
        total: subtotal,
    });
};

const getBreakdownFromSubtotal = (
    subtotal: number,
    quote: any,
    db: any,
    pricing?: PricingResult,
    itemHotel = 0,
    itemFlights = 0
) => {
    if (pricing) {
        const buckets = buildQuoteEstimateBuckets(quote, pricing, db);
        let { baseTravel, services } = buckets;
        if (Math.abs(buckets.subtotal - subtotal) > 1) {
            baseTravel = Math.max(0, subtotal - services);
        }
        return {
            hotel: itemHotel,
            flights: itemFlights,
            baseTravel,
            services,
        };
    }

    const baseTravel = getPackageBaseTravelForQuote(quote, db);
    const services = Math.max(0, subtotal - baseTravel);
    return {
        hotel: itemHotel,
        flights: itemFlights,
        baseTravel,
        services,
    };
};

const getBreakdownFromItems = (items: any[], subtotal: number, quote: any, db: any) => {
    const hotel = sumItemTotals(items, isHotelStayItem);
    const flights = sumItemTotals(items, isFlightItem);
    const pricing = canResolveQuotePricing(quote)
        ? resolvePricing(quote, quote, db)
        : undefined;
    return getBreakdownFromSubtotal(subtotal, quote, db, pricing, hotel, flights);
};

const getBreakdownFromPricing = (pricing: PricingResult, quote: any, db: any) => {
    const buckets = buildQuoteEstimateBuckets(quote, pricing, db);
    return {
        hotel: pricing.breakdown.hotel,
        flights: pricing.breakdown.flights,
        baseTravel: buckets.baseTravel,
        services: buckets.services,
    };
};

/** True when stored line items define the quote total (incl. hand-edited rates). */
export const hasManualQuotePricing = (quote: any, db: any): boolean => {
    const items = quote?.items || [];
    if (items.length === 0) return false;

    const itemsSubtotal = items.reduce(
        (sum: number, i: any) => sum + (Number(i.total) || 0),
        0
    );
    if (itemsSubtotal <= 0) return false;

    const storedSubtotal = parseAmount(quote?.subtotal);
    const storedTotal = parseAmount(quote?.total);

    if (storedTotal > 0 || storedSubtotal > 0) return true;

    if (!canResolveQuotePricing(quote)) return true;

    const pricing = resolvePricing(quote, quote, db);
    if (!pricing || pricing.subtotal <= 0) return true;

    return Math.abs(itemsSubtotal - pricing.subtotal) > 100;
};

/** Recompute subtotal / tax / total from saved quote builder fields. */
const getResolvedQuoteTotals = (quote: any, db: any) => {
    const pricing = resolvePricing(quote, quote, db);
    if (!pricing || pricing.subtotal <= 0) return null;

    const buckets = buildQuoteEstimateBuckets(quote, pricing, db);
    return {
        pricing,
        subtotal: buckets.subtotal,
        taxes: buckets.taxes,
        total: buckets.total,
        additionalServiceCharge: buckets.additionalServiceCharge || 0,
    };
};

/** Recompute stored totals and line items from quote builder fields. */
export const reconcileQuotationPricing = (quote: any, db: any) => {
    if (!canResolveQuotePricing(quote)) return quote;

    const resolved = getResolvedQuoteTotals(quote, db);
    if (!resolved) return quote;

    const { pricing, subtotal, taxes, total, additionalServiceCharge } = resolved;
    const serviceChargeConfig = normalizeQuoteAdditionalServiceCharge(quote);
    const items = appendServiceChargeAndGstLineItems(
        buildQuoteLineItemsFromQuote(quote, pricing, db),
        additionalServiceCharge,
        taxes,
        serviceChargeConfig.gstPercent || 0
    );

    const next = {
        ...quote,
        subtotal,
        taxes,
        total,
        additionalServiceChargeAmount: additionalServiceCharge,
        items,
        budget: formatBudget(total, db),
        pricingRevision: CURRENT_QUOTE_PRICING_REVISION,
    };

    if (
        quote.pricingRevision === CURRENT_QUOTE_PRICING_REVISION &&
        parseAmount(quote.subtotal) === subtotal &&
        parseAmount(quote.taxes) === taxes &&
        parseAmount(quote.total) === total &&
        JSON.stringify(quote.items || []) === JSON.stringify(items)
    ) {
        return quote;
    }

    return next;
};

/** One-time refresh for quotations saved with legacy pricing logic. */
export const migrateQuotationsPricing = (db: any): { db: any; changed: boolean } => {
    if (!db?.quotations?.data?.length) return { db, changed: false };

    let changed = false;
    const data = db.quotations.data.map((quote: any) => {
        if (quote.pricingRevision === CURRENT_QUOTE_PRICING_REVISION) {
            return quote;
        }
        const next = reconcileQuotationPricing(quote, db);
        if (next !== quote) changed = true;
        return next;
    });

    if (!changed) return { db, changed: false };

    return {
        db: { ...db, quotations: { ...db.quotations, data } },
        changed: true,
    };
};

/** Stored quotation total — prefers recomputed totals from quote builder fields. */
export const getUnifiedTotalForQuote = (quote: any, db: any): number => {
    if (canResolveQuotePricing(quote)) {
        const resolved = getResolvedQuoteTotals(quote, db);
        if (resolved && resolved.total > 0) return resolved.total;
    }

    const quotedTotal = parseAmount(quote?.total);
    const itemsSubtotal = (quote?.items || []).reduce(
        (sum: number, i: any) => sum + (Number(i.total) || 0),
        0
    );

    if (quotedTotal > 0) return quotedTotal;

    const subtotal = parseAmount(quote?.subtotal);
    const taxes = parseAmount(quote?.taxes);
    if (subtotal > 0) {
        return subtotal + taxes;
    }

    if (itemsSubtotal > 0) {
        return itemsSubtotal + taxes;
    }

    return 0;
};

export const getUnifiedBudgetForQuote = (quote: any, db: any): string => {
    return formatBudget(getUnifiedTotalForQuote(quote, db), db);
};

export type QuotePricingDisplay = {
    total: number;
    subtotal: number;
    taxes: number;
    additionalServiceCharge: number;
    travelersLabel: string;
    perPersonBase: number;
    breakdown: {
        hotel: number;
        flights: number;
        baseTravel: number;
        services: number;
    };
};

/** Breakdown aligned with quotation pricing (for UI cards and estimate panel). */
export const getQuotePricingDisplay = (quote: any, db: any): QuotePricingDisplay => {
    const travelers = parseTravelers(quote?.travelers);
    const pax = Math.max(1, travelers.adults + travelers.kids);

    if (canResolveQuotePricing(quote)) {
        const resolved = getResolvedQuoteTotals(quote, db);
        if (resolved) {
            const buckets = buildQuoteEstimateBuckets(quote, resolved.pricing, db);
            return {
                total: buckets.total,
                subtotal: buckets.subtotal,
                taxes: buckets.taxes,
                additionalServiceCharge: buckets.additionalServiceCharge || 0,
                travelersLabel: quote?.travelers || resolved.pricing.travelersLabel,
                perPersonBase:
                    buckets.total > 0 ? Math.round(buckets.total / pax) : 0,
                breakdown: {
                    hotel: resolved.pricing.breakdown.hotel,
                    flights: resolved.pricing.breakdown.flights,
                    baseTravel: buckets.baseTravel,
                    services: buckets.services,
                },
            };
        }
    }

    const items = quote?.items || [];
    const subtotal = getStoredQuoteSubtotal(quote);
    const taxes = 0;
    const total =
        parseAmount(quote?.total) > 0 ? parseAmount(quote?.total) : subtotal;
    const parts = getBreakdownFromItems(items, subtotal, quote, db);

    return {
        total,
        subtotal,
        taxes,
        additionalServiceCharge: normalizeQuoteAdditionalServiceCharge(quote).enabled
            ? calculateAdditionalServiceChargeAmount(parts.services, normalizeQuoteAdditionalServiceCharge(quote))
            : parseAmount(quote?.additionalServiceChargeAmount),
        travelersLabel: quote?.travelers || `${travelers.adults} Adults`,
        perPersonBase: total > 0 ? Math.round(total / pax) : 0,
        breakdown: parts,
    };
};

/** Financial totals for save / display (includes optional service charge). */
export const resolveQuoteFinancials = (quote: any, pricing: PricingResult, db: any) => {
    const buckets = buildQuoteEstimateBuckets(quote, pricing, db);
    return {
        subtotal: buckets.subtotal,
        taxes: buckets.taxes,
        total: buckets.total,
        additionalServiceChargeAmount: buckets.additionalServiceCharge || 0,
    };
};

export const getLiveQuoteEstimateDisplay = (
    pricing: PricingResult,
    quote: any,
    db: any
) => {
    const buckets = buildQuoteEstimateBuckets(quote, pricing, db);
    const pax = Math.max(
        1,
        parseTravelers(quote?.travelers).adults + parseTravelers(quote?.travelers).kids
    );
    return {
        total: buckets.total,
        subtotal: buckets.subtotal,
        taxes: buckets.taxes,
        additionalServiceCharge: buckets.additionalServiceCharge || 0,
        travelersLabel: pricing.travelersLabel,
        perPersonBase: buckets.total > 0 ? Math.round(buckets.total / pax) : 0,
        breakdown: {
            hotel: pricing.breakdown.hotel,
            flights: pricing.breakdown.flights,
            baseTravel: buckets.baseTravel,
            services: buckets.services,
        },
    };
};

/** Lead budget = confirmed quote, else latest quotation, else stored lead budget. */
export const getUnifiedTotalForLead = (lead: any, db: any): number => {
    const leadQuotes = getQuotesForLead(lead, db);

    if (lead?.confirmedQuoteId) {
        const confirmed = leadQuotes.find((q: any) => q.id === lead.confirmedQuoteId);
        if (confirmed) return getUnifiedTotalForQuote(confirmed, db);
    }

    if (leadQuotes.length > 0) {
        const latest = [...leadQuotes].sort((a, b) =>
            compareQuoteVersions(b.version, a.version)
        )[0];
        return getUnifiedTotalForQuote(latest, db);
    }

    const budget = parseAmount(lead?.budget);
    if (budget > 0) return budget;

    const pricing = resolvePricing(lead, lead, db);
    return pricing?.total || 0;
};

export const getUnifiedBudgetForLead = (lead: any, db: any): string => {
    return formatBudget(getUnifiedTotalForLead(lead, db), db);
};

export const getUnifiedTotalForBooking = (booking: any, db: any): number => {
    const linkedQuote = resolveLinkedQuote(booking, db);
    if (linkedQuote) return getUnifiedTotalForQuote(linkedQuote, db);

    const bookingTotal = parseAmount(booking?.total);
    if (bookingTotal > 0) return bookingTotal;

    const linkedLead = resolveLinkedLead(booking, db);
    if (linkedLead) return getUnifiedTotalForLead(linkedLead, db);

    const pricing = resolvePricing(booking, booking, db);
    return pricing?.total || bookingTotal;
};

export const getUnifiedBudgetForBooking = (booking: any, db: any): string => {
    return formatBudget(getUnifiedTotalForBooking(booking, db), db);
};

export type PaymentSettlementStatus = 'paid' | 'partial' | 'unpaid' | 'refunded';

export const PAYMENT_STATUS_OPTIONS: { value: PaymentSettlementStatus; label: string }[] = [
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'partial', label: 'Partial Paid' },
    { value: 'paid', label: 'Paid In Full' },
    { value: 'refunded', label: 'Refunded' },
];

export const normalizePaymentStatus = (value?: string): PaymentSettlementStatus | '' => {
    const raw = String(value || '').toLowerCase().trim();
    if (raw === 'paid' || raw === 'paid in full' || raw === 'full') return 'paid';
    if (raw === 'partial' || raw === 'partial paid' || raw === 'partial deposit' || raw === 'partially paid') {
        return 'partial';
    }
    if (raw === 'unpaid' || raw === 'pending' || raw === 'due') return 'unpaid';
    if (raw === 'refunded' || raw === 'refund') return 'refunded';
    return '';
};

export const getPaymentStatusLabel = (status: string) =>
    PAYMENT_STATUS_OPTIONS.find((o) => o.value === status)?.label || status;

export type PaymentStatusColorVariant = 'badge' | 'select' | 'filterActive' | 'filterIdle';

const PAYMENT_STATUS_COLOR_MAP: Record<
    PaymentSettlementStatus,
    Record<PaymentStatusColorVariant, string>
> = {
    unpaid: {
        badge: 'bg-red-50 text-red-700 border-red-200',
        select: 'bg-white text-red-700 border-slate-200 focus:border-red-400 focus:ring-1 focus:ring-red-100',
        filterActive: 'bg-white text-red-700 shadow-sm',
        filterIdle: 'text-red-600 hover:text-red-700',
    },
    partial: {
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        select: 'bg-white text-amber-700 border-slate-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-100',
        filterActive: 'bg-white text-amber-700 shadow-sm',
        filterIdle: 'text-amber-600 hover:text-amber-800',
    },
    paid: {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        select: 'bg-white text-emerald-700 border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100',
        filterActive: 'bg-white text-emerald-700 shadow-sm',
        filterIdle: 'text-emerald-600 hover:text-emerald-800',
    },
    refunded: {
        badge: 'bg-sky-50 text-sky-700 border-sky-200',
        select: 'bg-white text-sky-700 border-slate-200 focus:border-sky-400 focus:ring-1 focus:ring-sky-100',
        filterActive: 'bg-white text-sky-700 shadow-sm',
        filterIdle: 'text-sky-600 hover:text-sky-800',
    },
};

/** Tailwind classes for payment status UI (red / yellow / green / sky blue). */
export const getPaymentStatusColorClasses = (
    status: string,
    variant: PaymentStatusColorVariant = 'badge'
): string => {
    const key = normalizePaymentStatus(status) || 'unpaid';
    return PAYMENT_STATUS_COLOR_MAP[key][variant];
};

/** Apply payment status and sync the paid amount field on a booking record. */
export const buildBookingPaymentPatch = (booking: any, db: any, status: PaymentSettlementStatus) => {
    const total = getUnifiedTotalForBooking(booking, db);
    const existingPaid = parseStoredInrAmount(
        booking?.paid ?? booking?.amountPaid ?? booking?.paidAmount,
        db
    );
    let amountPaid = existingPaid;

    if (status === 'paid') {
        amountPaid = total;
    } else if (status === 'unpaid' || status === 'refunded') {
        amountPaid = 0;
    } else if (status === 'partial') {
        if (amountPaid <= 0 || amountPaid >= total) {
            amountPaid = total > 0 ? Math.round(total * 0.3) : 0;
        }
    }

    return {
        paymentStatus: status,
        paid: Math.round(amountPaid),
    };
};

/** Update the paid amount while status is partial (or auto-adjust status from amount). */
export const buildBookingPartialPaidPatch = (booking: any, db: any, amountPaidInput: number) => {
    const total = getUnifiedTotalForBooking(booking, db);
    let amountPaid = Math.min(Math.max(0, Math.round(amountPaidInput)), total);

    let status: PaymentSettlementStatus = 'partial';
    if (amountPaid <= 0) {
        status = 'unpaid';
        amountPaid = 0;
    } else if (total > 0 && amountPaid >= total) {
        status = 'paid';
        amountPaid = total;
    }

    return {
        paymentStatus: status,
        paid: Math.round(amountPaid),
    };
};

export interface BookingPaymentDetails {
    total: number;
    totalFormatted: string;
    amountPaid: number;
    amountPaidFormatted: string;
    amountDue: number;
    status: PaymentSettlementStatus;
}

/** Resolve amount paid + settlement status; honors stored paymentStatus when set. */
export const getBookingPaymentDetails = (booking: any, db: any): BookingPaymentDetails => {
    const total = getUnifiedTotalForBooking(booking, db);
    const storedStatus = normalizePaymentStatus(booking?.paymentStatus);

    const rawPaidField = booking?.paid ?? booking?.amountPaid ?? booking?.paidAmount;
    const hasPaidField = rawPaidField != null && String(rawPaidField).trim() !== '';
    let amountPaid = parseStoredInrAmount(rawPaidField, db);

    let status: PaymentSettlementStatus = 'unpaid';

    if (storedStatus === 'refunded') {
        status = 'refunded';
        amountPaid = 0;
    } else if (storedStatus === 'paid') {
        status = 'paid';
        amountPaid = total;
    } else if (storedStatus === 'partial') {
        status = 'partial';
        if (amountPaid <= 0 && total > 0 && !hasPaidField) {
            amountPaid = Math.round(total * 0.3);
        }
    } else if (storedStatus === 'unpaid') {
        status = 'unpaid';
        amountPaid = 0;
    } else {
        if (total > 0 && amountPaid >= total) {
            status = 'paid';
            amountPaid = total;
        } else if (amountPaid > 0) {
            status = 'partial';
        } else {
            status = 'unpaid';
            amountPaid = 0;
        }
    }

    if (status === 'unpaid' || status === 'refunded') {
        amountPaid = 0;
    }

    const amountPaidFormatted =
        status === 'unpaid' || status === 'refunded'
            ? getPaymentStatusLabel(status)
            : formatBudget(amountPaid, db);

    return {
        total,
        totalFormatted: formatBudget(total, db),
        amountPaid,
        amountPaidFormatted,
        amountDue: status === 'refunded' ? 0 : Math.max(0, total - amountPaid),
        status,
    };
};
