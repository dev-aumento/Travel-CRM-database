import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import NumberInput from '../components/NumberInput';
import { useSearchParams } from 'react-router-dom';
import { FileText, Send, Download, Calculator, Plus, User, MapPin, CheckCircle2, Calendar, Globe, X, ChevronDown, ArrowLeft, ArrowRight, Search, GripVertical, Trash2, Edit3, Filter, Briefcase, Hotel as HotelIcon, Copy, Mail } from 'lucide-react';
import { buildNightPricesForStay, formatHotelNightDateLabel, getHotelSelectionIncompleteMessage, isHotelSelectionComplete, stayMissingExtraBedPrice, sumStayChildWithBedTotal, sumStayChildWithoutBedTotal, sumStayExtraBedTotal, sumStayGivenTotal, sumStayHotelTotal, sumStaySpecialInclusionsTotal, type HotelNightPrice } from '../utils/hotelStayPricing';
import { collectReferenceIds, ensureHotelBookingId, ensureTripId } from '../utils/hotelBookingIds';
import {
    filterStaffForAgentSession,
    filterStaffWithLeadActivity,
    filterSubAgentsWithLeadActivity,
    filterTravelAgentsWithLeadActivity,
    getAgentIdsForScope,
    leadMatchesAgentPortfolio,
    quoteMatchesAgentPortfolio,
    recordVisibleToSession,
    resolveRecordCreatedById,
    syncConfirmedLeadBookingStatus,
    buildLeadScheduleFromQuote,
    getQuotationsForLead,
} from '../utils/databaseSync';
import { PLATFORM_NAME } from '../constants/platform';
import HotelSpecialInclusionsSection, { type HotelSpecialInclusion } from '../components/HotelSpecialInclusionsSection';
import QuoteEmailSendModal from '../components/QuoteEmailSendModal';
import { usePlanFeatures } from '../utils/planFeatures';
import LeadQuoteWorkbench, { type LeadWorkbenchTab } from '../components/LeadQuoteWorkbench';
import QuoteTermsSection from '../components/QuoteTermsSection';
import QuoteBuilderReviewPreview from '../components/QuoteBuilderReviewPreview';
import DropdownChevron from '../components/DropdownChevron';
import CountryFlag from '../components/CountryFlag';
import CountryGroupedOptions from '../components/CountryGroupedOptions';
import {
    appendQuoteActivityEntry,
    bootstrapLeadQuoteDestination,
    findLeadByContact,
    findLeadForQuote,
    findPresetForDestination,
    findPresetForLead,
    getLatestQuoteForLead,
    getQuoteLeadGroupKey,
    getQuotesForLeadWorkbench,
    quoteBelongsToLead,
    resolveQuoteDestinationLabel,
    resolveBuilderDestinationFromCountry,
} from '../utils/quoteActivities';
import {
    buildCountryOptions,
    filterLocationOptions,
    formatDestinationLabel,
    getAirportsForCountry,
    getCitiesForCountry,
    parseDestinationParts,
    resolveWorldCountryName,
} from '../utils/worldLocations';
import {
    resolveQuoteTerms,
    resolveQuoteTermsForQuote,
    getAvailableQuoteTerms,
    getFallbackTermsRecord,
} from '../utils/quoteTerms';
import QuoteTermsSelector from '../components/QuoteTermsSelector';
import AgencyBankDetailsBlock from '../components/AgencyBankDetailsBlock';
import QuoteAdditionalServiceChargeSection, {
    buildAdditionalServiceChargePayload,
    normalizeAdditionalServiceCharge,
    type AdditionalServiceChargeForm,
} from '../components/QuoteAdditionalServiceChargeSection';
import {
    buildQuoteEmailHtml,
    buildQuoteEmailPlainText,
    buildQuoteEmailSubject,
    buildQuoteShareMessage,
    openWhatsAppShare,
    resolveCustomerEmail,
    resolveQuoteEmailSender,
    type QuoteEmailDraft,
    type QuoteEmailSender,
} from '../utils/quoteShare';
import { resolveAgencyBankDetails } from '../utils/agencyBankDetails';
import { useDatabase } from '../context/DatabaseContext';
import { packagePresets, calculateQuote, parseDurationNights, parseTravelers } from '../utils/pricing';
import { mergeActivityCatalog } from '../utils/activityData';
import type { Hotel } from '../utils/hotelData';
import { sourceCountries } from '../utils/aviationData';
import { appendServiceChargeAndGstLineItems, getLiveQuoteEstimateDisplay, getQuotePricingDisplay, getUnifiedTotalForQuote, resolveQuoteFinancials } from '../utils/pricingConsistency';
import { buildQuoteLineItems } from '../utils/quoteLineItems';
import { formatMoney as formatMoneyUtil } from '../utils/currency';
import { downloadElementAsMultiPagePdf } from '../utils/downloadPdf';
import { useAgencyBranding } from '../hooks/useAgencyBranding';
import { useCurrency } from '../hooks/useCurrency';
import {
    compareQuoteVersions,
    expandQuoteVersionFamily,
    formatQuoteVersionLabel,
    getQuotesForLeadVersioning,
    normalizeQuoteVersion,
    quoteMatchesHistoryDateRange,
    leadMatchesDeskDateRange,
    resolveChildQuoteVersion,
    resolveNextPrimaryQuoteVersion,
    resolveQuoteHistoryDate,
    resolveQuoteTimestamp,
} from '../utils/quoteActivities';
import {
    COUNTRY_PHONE_DATA,
    getCountryPhoneLabel,
    getPhoneDigitLimit,
    sanitizeLocalPhoneDigits,
    validateLocalPhone,
} from '../utils/countryPhoneData';

const getDurationDays = (duration?: string) => {
    if (!duration) return 0;
    const dayMatch = duration.match(/(\d+)\s*Day/i);
    if (dayMatch) return parseInt(dayMatch[1], 10);
    const nightMatch = duration.match(/(\d+)\s*Night/i);
    if (nightMatch) return parseInt(nightMatch[1], 10) + 1;
    return 0;
};

const getDurationDaysLabel = (duration?: string) => {
    const days = getDurationDays(duration);
    return days > 0 ? `${days} Days` : (duration || 'N/A');
};

export type QuoteAdditionalActivity = {
    id: string;
    title: string;
    description: string;
    rate: number;
};

const createAdditionalActivity = (): QuoteAdditionalActivity => ({
    id: `aa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: '',
    description: '',
    rate: 0,
});

const normalizeAdditionalActivities = (raw: unknown): QuoteAdditionalActivity[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((row: any, i) => ({
        id: row?.id || `aa-${i}`,
        title: String(row?.title ?? ''),
        description: String(row?.description ?? ''),
        rate: Math.max(0, Number(row?.rate) || 0),
    }));
};

/** Newest-first sort key for Priority Desk leads. */
const leadRecencyTs = (lead: any): number => {
    const raw = lead?.createdAt || lead?.updatedAt || lead?.joinedDate || '';
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
};

/** Newest-first sort key for Quotation History (full timestamp, not calendar-day only). */
const quoteRecencyTs = (quote: any): number => {
    const raw =
        quote?.createdAt ||
        quote?.savedAt ||
        quote?.updatedAt ||
        resolveQuoteTimestamp(quote) ||
        '';
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
};

const buildDefaultItinerary = (days: number) => {
    const safeDays = Math.max(1, Number.isFinite(days) ? days : 1);
    const now = Date.now();
    return Array.from({ length: safeDays }, (_, i) => ({
        id: now + i,
        title: i === 0
            ? 'Day 1: Arrival'
            : i === safeDays - 1
                ? `Day ${safeDays}: Departure`
                : `Day ${i + 1}: Sightseeing`,
        activities: []
    }));
};

const getDefaultBuilderBootstrap = (presets = packagePresets) => {
    const defaultPreset = presets[0];
    const presetDays = defaultPreset?.duration ? parseDurationNights(defaultPreset.duration) + 1 : 5;
    return {
        presetId: defaultPreset?.id || '',
        destination: defaultPreset?.destination || '',
        itinerary: buildDefaultItinerary(presetDays),
        builderCountry: '',
        builderCity: '',
    };
};

const INITIAL_BUILDER = getDefaultBuilderBootstrap();

const SIDEBAR_LIST_INITIAL_COUNT = 3;
const SIDEBAR_LIST_LOAD_MORE_COUNT = 10;

type SidebarListControlsProps = {
    total: number;
    visibleCount: number;
    onShowMore: () => void;
    onShowLess: () => void;
};

const SidebarListControls: React.FC<SidebarListControlsProps> = ({
    total,
    visibleCount,
    onShowMore,
    onShowLess,
}) => {
    if (total <= SIDEBAR_LIST_INITIAL_COUNT) return null;

    const showing = Math.min(visibleCount, total);
    const isFullyExpanded = showing >= total;

    return (
        <div className="pt-1">
            {!isFullyExpanded ? (
                <button
                    type="button"
                    onClick={onShowMore}
                    className="w-full py-2 text-[10px] font-bold uppercase tracking-wider text-crm-600 bg-white border border-crm-200 rounded-lg hover:bg-crm-50 transition-colors"
                >
                    Show more
                </button>
            ) : (
                <button
                    type="button"
                    onClick={onShowLess}
                    className="w-full py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    Show less
                </button>
            )}
        </div>
    );
};

// Ensures itinerary always has correct day count + titles, even for old records.
const normalizeItinerary = (rawItinerary: any, desiredDays: number) => {
    const safeDays = Math.max(1, Number.isFinite(desiredDays) ? desiredDays : 1);
    let arr: any[] = [];

    if (Array.isArray(rawItinerary)) {
        arr = rawItinerary;
    } else if (typeof rawItinerary === 'string') {
        try {
            const parsed = JSON.parse(rawItinerary);
            if (Array.isArray(parsed)) arr = parsed;
        } catch {
            // ignore invalid JSON strings
        }
    }

    const now = Date.now();
    return Array.from({ length: safeDays }, (_, i) => {
        const existing = arr[i] || {};
        const titleFallback = i === 0
            ? 'Day 1: Arrival'
            : i === safeDays - 1
                ? `Day ${safeDays}: Departure`
                : `Day ${i + 1}: Sightseeing`;

        const titleCandidate = (
            (typeof existing?.title === 'string' && existing.title.trim()) ||
            (typeof existing?.name === 'string' && existing.name.trim()) ||
            (typeof existing?.dayTitle === 'string' && existing.dayTitle.trim())
        ) as string | undefined;

        const activities = Array.isArray(existing?.activities) ? existing.activities : [];

        return {
            id: existing?.id ?? now + i,
            title: titleCandidate || titleFallback,
            activities
        };
    });
};

const getActivityAssignmentKey = (act: any): string => {
    if (act?.id != null && String(act.id).trim()) return `id:${String(act.id).trim()}`;
    return `title:${String(act.title || act.name || '').trim().toLowerCase()}`;
};

/** Free Day can be assigned to multiple itinerary days. */
const isFreeDayActivity = (act: any): boolean => {
    const id = String(act?.id || '').trim().toUpperCase();
    if (id === 'GLOBAL-1') return true;
    const title = String(act?.title || act?.name || '').toLowerCase();
    return title.includes('free day') || title.includes('exploring on your own');
};

const getAssignedActivityKeys = (itinerary: any[]): Set<string> => {
    const keys = new Set<string>();
    itinerary.forEach((day) => {
        (day.activities || []).forEach((act: any) => {
            if (isFreeDayActivity(act)) return;
            keys.add(getActivityAssignmentKey(act));
        });
    });
    return keys;
};

/** Ground transport for activity days — no flights or trains. */
const ITINERARY_VEHICLE_TYPES = [
    'Bus',
    'Car',
    'Bike',
    'Scooter',
    'Van / Minibus',
    'Auto Rickshaw',
    'Other',
] as const;

const ITINERARY_CAR_TYPES = [
    'Sedan',
    'SUV',
    'XUV',
    'Hatchback',
    'Luxury',
    'Limousine',
    'Minivan',
    'Tempo Traveller',
] as const;

const formatItineraryVehicleLabel = (
    vehicleType?: string,
    carType?: string,
    otherLabel?: string
): string => {
    const type = String(vehicleType || '').trim();
    if (!type) return '';
    if (type === 'Car') {
        const car = String(carType || '').trim();
        return car ? `Car — ${car}` : 'Car';
    }
    if (type === 'Other') {
        const other = String(otherLabel || '').trim();
        return other ? `Other — ${other}` : 'Other';
    }
    return type;
};

const Quotations = () => {
    const { db, addRecord, updateRecord, deleteRecord, getNextId } = useDatabase();
    const { hasFeature: hasPlanFeature } = usePlanFeatures();
    const canShareQuotes = hasPlanFeature('quoteSharing');
    const canDownloadQuotePdf = hasPlanFeature('quotePdf');
    const {
        formatMoney,
        currencySymbol,
        currencySetting,
        formatInputValue,
        parseInputValue,
        priceInputStep,
    } = useCurrency();
    const agencyBranding = useAgencyBranding();
    const agencyName = agencyBranding.name;
    const agencySettings = agencyBranding.settings;
    const agencyBankDetails = useMemo(
        () => resolveAgencyBankDetails(agencySettings),
        [agencySettings]
    );
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Auth context
    const userRole = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    const currentAgentId = localStorage.getItem('agentId');
    const currentAgent = useMemo(() => {
        return (db?.travelAgents?.data || []).find((a: any) => a.id === currentAgentId);
    }, [db?.travelAgents?.data, currentAgentId]);

    const sessionScope = useMemo(
        () => ({ userRole, userEmail, sessionAgentId: currentAgentId }),
        [userRole, userEmail, currentAgentId]
    );

    const teamIds = useMemo(() => {
        if (userRole === 'admin') return [];
        return getAgentIdsForScope(db, currentAgentId || '');
    }, [db, currentAgentId, userRole]);

    const quotations = useMemo(() => {
        const allQuotes = db?.quotations?.data || [];
        if (userRole === 'admin') return allQuotes;
        return allQuotes.filter((q: any) =>
            recordVisibleToSession('quotations', q, db, sessionScope)
        );
    }, [db?.quotations?.data, db, userRole, sessionScope]);

    const leads = useMemo(() => {
        const allLeads = db?.leads?.data || [];
        if (userRole === 'admin') return allLeads;
        return allLeads.filter((l: any) =>
            recordVisibleToSession('leads', l, db, sessionScope)
        );
    }, [db?.leads?.data, db, userRole, sessionScope]);

    const [agentFilter, setAgentFilter] = useState('all');

    const portfolioLeadPool = useMemo(
        () => (userRole === 'admin' ? db?.leads?.data || [] : leads),
        [userRole, db?.leads?.data, leads]
    );

    const portfolioIncludeIds = useMemo(
        () => (agentFilter === 'all' ? [] : [agentFilter]),
        [agentFilter]
    );

    const portfolioStaffOptions = useMemo(
        () =>
            filterStaffWithLeadActivity(
                db?.staff?.data || [],
                currentAgentId,
                db,
                portfolioLeadPool,
                { includeMemberIds: portfolioIncludeIds }
            ),
        [db, currentAgentId, portfolioLeadPool, portfolioIncludeIds]
    );

    const portfolioSubAgentOptions = useMemo(
        () =>
            filterSubAgentsWithLeadActivity(
                db?.travelAgents?.data || [],
                currentAgentId,
                db,
                portfolioLeadPool,
                { includeMemberIds: portfolioIncludeIds }
            ),
        [db, currentAgentId, portfolioLeadPool, portfolioIncludeIds]
    );

    const portfolioAdminAgentOptions = useMemo(
        () =>
            filterTravelAgentsWithLeadActivity(
                db?.travelAgents?.data || [],
                portfolioLeadPool,
                db,
                { includeMemberIds: portfolioIncludeIds }
            ),
        [db, portfolioLeadPool, portfolioIncludeIds]
    );

    useEffect(() => {
        if (agentFilter === 'all' || userRole === 'staff') return;

        if (userRole === 'admin') {
            if (!portfolioAdminAgentOptions.some((agent: any) => agent.id === agentFilter)) {
                setAgentFilter('all');
            }
            return;
        }

        if (agentFilter === currentAgentId) return;

        const stillValid =
            portfolioStaffOptions.some((member: any) => member.employeeId === agentFilter) ||
            portfolioSubAgentOptions.some((agent: any) => agent.id === agentFilter);

        if (!stillValid) setAgentFilter('all');
    }, [
        agentFilter,
        userRole,
        currentAgentId,
        portfolioStaffOptions,
        portfolioSubAgentOptions,
        portfolioAdminAgentOptions,
    ]);

    const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(true);
    const [iterationParent, setIterationParent] = useState<any>(null);
    const [leadWorkbenchTab, setLeadWorkbenchTab] = useState<LeadWorkbenchTab>('quotes');
    const [showQuotePrintPreview, setShowQuotePrintPreview] = useState(false);
    const [isQuotePdfDownloading, setIsQuotePdfDownloading] = useState(false);
    const quotePrintRef = useRef<HTMLDivElement>(null);
    const [quoteEmailDraft, setQuoteEmailDraft] = useState<QuoteEmailDraft | null>(null);
    const [quoteEmailSender, setQuoteEmailSender] = useState<QuoteEmailSender | null>(null);

    const getQuoteDisplayTotal = (quote: any) => getUnifiedTotalForQuote(quote, db);

    const resolveTermsForQuote = (quote: any) => {
        if (!quote) return null;
        return (
            resolveQuoteTermsForQuote(
                {
                    termsId: quote.termsId,
                    destination: quote.destination || '',
                    agentId: quote.agentId || currentAgentId,
                },
                db?.quoteTerms?.data || [],
                userRole
            ) || getFallbackTermsRecord()
        );
    };

    // Form State
    const [formCustomer, setFormCustomer] = useState('');
    const [formAdults, setFormAdults] = useState(2);
    const [formKids, setFormKids] = useState(0);
    const [formKidsAges, setFormKidsAges] = useState('');
    const [selectedPresetId, setSelectedPresetId] = useState(INITIAL_BUILDER.presetId);
    const [leadContext, setLeadContext] = useState<any>(null);

    const [formDepartureDate, setFormDepartureDate] = useState('');
    const [tripMode, setTripMode] = useState<'package' | 'custom'>('custom');
    const [customDestination, setCustomDestination] = useState(packagePresets?.[0]?.destination || '');
    const [formTripDurationUnit, setFormTripDurationUnit] = useState<'nights' | 'days'>('nights');
    const [formTripDurationValue, setFormTripDurationValue] = useState(4);
    const departureDateRef = useRef<HTMLInputElement>(null);
    const [formStatus, setFormStatus] = useState<string>('sent');
    const [formCountryCode, setFormCountryCode] = useState('+91');
    const [formPhone, setFormPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [formSourceCountry, setFormSourceCountry] = useState('India');
    const [formSourceAirport, setFormSourceAirport] = useState('BOM (Mumbai)');
    const [formAgentId, setFormAgentId] = useState('');
    const [formAgentName, setFormAgentName] = useState('');
    // Date range filter (ISO YYYY‑MM‑DD) – empty means no bound
    const [dateFilterStart, setDateFilterStart] = useState<string>('');
    const [dateFilterEnd, setDateFilterEnd] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState('all');
    /** Filters & history panel — collapsed by default on laptop/tablet/mobile */
    const [sidebarAccordionOpen, setSidebarAccordionOpen] = useState(false);

    const quoteInScope = useCallback(
        (q: any) =>
            userRole === 'admin' ||
            recordVisibleToSession('quotations', q, db, sessionScope),
        [db, userRole, sessionScope]
    );

    /** Saved DB quotes shown in sidebar history. */
    const quotationsForHistory = useMemo(() => {
        return (db?.quotations?.data || []).filter((q: any) => quoteInScope(q));
    }, [db?.quotations?.data, quoteInScope]);

    const historyLeadGroups = useMemo(() => {
        const leadGroups: Record<string, { lead: any; quotes: any[]; groupKey: string }> = {};

        quotationsForHistory
            .filter((q: any) => quoteMatchesAgentPortfolio(q, agentFilter, db))
            .forEach((q: any) => {
                const groupKey = getQuoteLeadGroupKey(q, leads);
                if (!leadGroups[groupKey]) {
                    const lead =
                        findLeadForQuote(q, db?.leads?.data || []) ||
                        findLeadForQuote(q, leads) || {
                            name: q.customer,
                            id: groupKey,
                            destination: q.destination,
                            status: 'negotiation',
                            email: q.email || q.customerEmail,
                            phone: q.phone,
                            trackingId: q.trackingId || q.tripId,
                            tripId: q.tripId || q.trackingId,
                        };

                    leadGroups[groupKey] = { lead, quotes: [], groupKey };
                }
                leadGroups[groupKey].quotes.push(q);
            });

        const hasDateFilter = Boolean(dateFilterStart || dateFilterEnd);

        return Object.values(leadGroups)
            .filter((group) => {
                if (!hasDateFilter) return true;
                const family = expandQuoteVersionFamily(group.quotes, quotationsForHistory);
                return family.some((q: any) =>
                    quoteMatchesHistoryDateRange(q, dateFilterStart, dateFilterEnd, leads)
                );
            })
            .sort((a, b) => {
                const latestTs = (quotes: any[]) =>
                    Math.max(
                        0,
                        ...expandQuoteVersionFamily(quotes, quotationsForHistory).map((q) =>
                            quoteRecencyTs(q)
                        )
                    );
                return latestTs(b.quotes) - latestTs(a.quotes);
            });
    }, [
        quotationsForHistory,
        agentFilter,
        db,
        leads,
        dateFilterStart,
        dateFilterEnd,
    ]);

    const clearDateFilters = () => {
        setDateFilterStart('');
        setDateFilterEnd('');
    };

    const findQuoteById = useCallback(
        (id: string | null) => {
            if (!id) return null;
            return (db?.quotations?.data || []).find((q: any) => q.id === id) || null;
        },
        [db?.quotations?.data]
    );

    const selectedQuote = useMemo(
        () => findQuoteById(selectedQuoteId),
        [findQuoteById, selectedQuoteId]
    );

    const workbenchLead = useMemo(() => {
        const fromQuote = selectedQuote
            ? findLeadForQuote(selectedQuote, leads) || {
                  id: selectedQuote.leadId || getQuoteLeadGroupKey(selectedQuote, leads),
                  name: selectedQuote.customer,
                  destination: selectedQuote.destination,
                  duration: selectedQuote.duration,
                  travelers: selectedQuote.travelers,
                  status: 'itinerary',
                  agentName: selectedQuote.agentName,
                  agentId: selectedQuote.agentId,
                  phone: selectedQuote.phone,
                  email: selectedQuote.email || selectedQuote.customerEmail,
                  trackingId: selectedQuote.trackingId || selectedQuote.tripId,
                  tripId: selectedQuote.tripId || selectedQuote.trackingId,
              }
            : null;
        const base = leadContext || fromQuote;
        if (!base) return null;
        // Always prefer the live lead record so status (e.g. confirmed) stays in sync
        if (base.id) {
            const fresh = leads.find((l: any) => l.id === base.id);
            if (fresh) return { ...base, ...fresh };
        }
        return base;
    }, [leadContext, selectedQuote, leads]);

    const workbenchLeadQuotes = useMemo(() => {
        const resolvedLead = workbenchLead?.id
            ? leads.find((l: any) => l.id === workbenchLead.id) || workbenchLead
            : workbenchLead;
        return getQuotesForLeadWorkbench(quotationsForHistory, resolvedLead, selectedQuote, leads);
    }, [quotationsForHistory, workbenchLead, selectedQuote, leads]);

    const passesLeadDeskFilters = useCallback(
        (lead: any) =>
            leadMatchesAgentPortfolio(lead, agentFilter, db) &&
            (statusFilter === 'all' || lead.status === statusFilter) &&
            leadMatchesDeskDateRange(
                lead,
                dateFilterStart,
                dateFilterEnd,
                quotationsForHistory,
                leads
            ),
        [agentFilter, statusFilter, db, dateFilterStart, dateFilterEnd, quotationsForHistory, leads]
    );

    const leadNameCounts = useMemo(() => {
        const counts = new Map<string, number>();
        leads.forEach((lead: any) => counts.set(lead.name, (counts.get(lead.name) || 0) + 1));
        return counts;
    }, [leads]);

    const isPriorityDeskActiveLead = useCallback(
        (lead: any) => {
            if (!lead) return false;
            if (['itinerary', 'negotiation'].includes(lead.status)) return true;
            if (
                lead.status === 'confirmed' &&
                (leadNameCounts.get(lead.name) || 0) > 1 &&
                quotationsForHistory.some((q: any) => quoteBelongsToLead(q, lead, leads))
            ) {
                return true;
            }
            return false;
        },
        [leadNameCounts, quotationsForHistory, leads]
    );

    const priorityDeskNewLeads = useMemo(
        () =>
            leads
                .filter(
                    (lead: any) =>
                        ['new', 'contacted'].includes(lead.status) && passesLeadDeskFilters(lead)
                )
                .sort((a: any, b: any) => leadRecencyTs(b) - leadRecencyTs(a)),
        [leads, passesLeadDeskFilters]
    );

    const priorityDeskActiveLeads = useMemo(() => {
        const byId = new Map<string, any>();

        leads
            .filter((lead: any) => isPriorityDeskActiveLead(lead) && passesLeadDeskFilters(lead))
            .forEach((lead: any) => byId.set(lead.id, lead));

        quotationsForHistory.forEach((quote: any) => {
            const resolved = findLeadForQuote(quote, leads);
            if (!resolved?.id || !passesLeadDeskFilters(resolved) || !isPriorityDeskActiveLead(resolved)) {
                return;
            }
            byId.set(resolved.id, resolved);
        });

        return Array.from(byId.values()).sort(
            (a: any, b: any) => leadRecencyTs(b) - leadRecencyTs(a)
        );
    }, [leads, quotationsForHistory, passesLeadDeskFilters, isPriorityDeskActiveLead]);

    const [priorityDeskVisibleCount, setPriorityDeskVisibleCount] = useState(SIDEBAR_LIST_INITIAL_COUNT);
    const [historyVisibleCount, setHistoryVisibleCount] = useState(SIDEBAR_LIST_INITIAL_COUNT);

    const priorityDeskTotalCount = priorityDeskNewLeads.length + priorityDeskActiveLeads.length;

    const visiblePriorityDeskNewLeads = useMemo(
        () =>
            priorityDeskNewLeads.slice(
                0,
                Math.min(priorityDeskVisibleCount, priorityDeskNewLeads.length)
            ),
        [priorityDeskNewLeads, priorityDeskVisibleCount]
    );

    const visiblePriorityDeskActiveLeads = useMemo(
        () =>
            priorityDeskActiveLeads.slice(
                0,
                Math.max(0, priorityDeskVisibleCount - priorityDeskNewLeads.length)
            ),
        [priorityDeskActiveLeads, priorityDeskVisibleCount, priorityDeskNewLeads.length]
    );

    const visibleHistoryLeadGroups = useMemo(
        () => historyLeadGroups.slice(0, historyVisibleCount),
        [historyLeadGroups, historyVisibleCount]
    );

    useEffect(() => {
        setPriorityDeskVisibleCount(SIDEBAR_LIST_INITIAL_COUNT);
    }, [priorityDeskTotalCount, agentFilter, statusFilter, dateFilterStart, dateFilterEnd]);

    useEffect(() => {
        setHistoryVisibleCount(SIDEBAR_LIST_INITIAL_COUNT);
    }, [historyLeadGroups.length, agentFilter, statusFilter, dateFilterStart, dateFilterEnd]);

    const showMorePriorityDesk = () => {
        setPriorityDeskVisibleCount((prev) =>
            Math.min(prev + SIDEBAR_LIST_LOAD_MORE_COUNT, priorityDeskTotalCount)
        );
    };

    const showLessPriorityDesk = () => {
        setPriorityDeskVisibleCount(SIDEBAR_LIST_INITIAL_COUNT);
    };

    const showMoreHistory = () => {
        setHistoryVisibleCount((prev) =>
            Math.min(prev + SIDEBAR_LIST_LOAD_MORE_COUNT, historyLeadGroups.length)
        );
    };

    const showLessHistory = () => {
        setHistoryVisibleCount(SIDEBAR_LIST_INITIAL_COUNT);
    };

    const [formFlightMeal, setFormFlightMeal] = useState<{ optIn: boolean; type: 'Veg' | 'Non-Veg' | 'Vegan' }>({ optIn: false, type: 'Veg' });
    const [formHotelTier, setFormHotelTier] = useState('Standard');
    const [formPresetInput, setFormPresetInput] = useState('');
    const [openPresetDropdown, setOpenPresetDropdown] = useState(false);
    const [openTierDropdown, setOpenTierDropdown] = useState(false);
    const [formNeedFlight, setFormNeedFlight] = useState(false);
    const [customFlightTotal, setCustomFlightTotal] = useState<number | null>(null);
    const [formHotelMealPlan, setFormHotelMealPlan] = useState('CP (Breakfast Only)');
    const [formHotelId, setFormHotelId] = useState('');
    const [formHotelInput, setFormHotelInput] = useState('');
    const [customHotelRate, setCustomHotelRate] = useState<number | null>(null);
    const [formHotelStays, setFormHotelStays] = useState<Array<{
        hotelId: string;
        nights: number;
        hotelInput?: string;
        city?: string;
        roomType?: string;
        rooms?: number;
        personsPerRoom?: number;
        extraBed?: number;
        extraBedPrice?: number;
        childWithBed?: number;
        childWithBedPrice?: number;
        childWithoutBed?: number;
        childWithoutBedPrice?: number;
        mealPlan?: string;
        nightPrices?: HotelNightPrice[];
        hotelBookingId?: string;
        bookingCnf?: string;
        specialInclusions?: HotelSpecialInclusion[];
    }>>([]);
    const [formTripId, setFormTripId] = useState('');
    const [hotelSelectionConfirmed, setHotelSelectionConfirmed] = useState(false);
    const [hotelValidationAttempted, setHotelValidationAttempted] = useState(false);
    const [itineraryValidationAttempted, setItineraryValidationAttempted] = useState(false);
    const [formQuoteNotes, setFormQuoteNotes] = useState('');
    const [formAdditionalActivities, setFormAdditionalActivities] = useState<QuoteAdditionalActivity[]>([]);
    const [formAdditionalServiceCharge, setFormAdditionalServiceCharge] =
        useState<AdditionalServiceChargeForm>({
            enabled: false,
            percent: 0,
            fixedAmount: 0,
            gstOnPackageEnabled: false,
            gstOnAdditionalEnabled: false,
        });
    const [formTermsId, setFormTermsId] = useState('');
    const termsManuallySelectedRef = useRef(false);
    const [openHotelDropdown, setOpenHotelDropdown] = useState<'main' | number | null>(null);
    const [openRoomTypeDropdown, setOpenRoomTypeDropdown] = useState<number | null>(null);
    const [builderCountry, setBuilderCountry] = useState('');
    const [builderCity, setBuilderCity] = useState('');
    const [builderCountrySearch, setBuilderCountrySearch] = useState('');
    const [openCityDropdown, setOpenCityDropdown] = useState<number | null>(null);
    const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
    const [isSourceCountryDropdownOpen, setIsSourceCountryDropdownOpen] = useState(false);
    const [sourceCountrySearch, setSourceCountrySearch] = useState('');
    // Ref used to skip itinerary auto-rebuild when loading an existing quote for editing
    const isEditingExistingRef = React.useRef(false);
    const backfilledQuoteIdsRef = useRef<Set<string>>(new Set());

    // Activity Vault & Drag State
    const [activitySearch, setActivitySearch] = useState('');
    const [showNewActivityForm, setShowNewActivityForm] = useState(false);
    const [newActivityTitle, setNewActivityTitle] = useState('');
    const [newActivityPrice, setNewActivityPrice] = useState(0);
    const [newActivityCategory, setNewActivityCategory] = useState('Leisure');
    const [newActivityDescription, setNewActivityDescription] = useState('');
    const [newActivityError, setNewActivityError] = useState('');
    /** Tablet: which day index is picking an activity from the popup (null = closed). */
    const [activityPickerDayIndex, setActivityPickerDayIndex] = useState<number | null>(null);
    const [activityPickerSearch, setActivityPickerSearch] = useState('');
    const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());
    const [highlightedQuoteId, setHighlightedQuoteId] = useState('');

    const toggleLead = (leadId: string) => {
        const newExpanded = new Set(expandedLeads);
        if (newExpanded.has(leadId)) newExpanded.delete(leadId);
        else newExpanded.add(leadId);
        setExpandedLeads(newExpanded);
    };
    const [draggedActivity, setDraggedActivity] = useState<any>(null);
    const [formItinerary, setFormItinerary] = useState<any[]>(INITIAL_BUILDER.itinerary);
    const [formVehicleType, setFormVehicleType] = useState('');
    const [formCarType, setFormCarType] = useState('');
    const [formVehicleOther, setFormVehicleOther] = useState('');
    const [formVehiclePrice, setFormVehiclePrice] = useState(0);
    const [builderStep, setBuilderStep] = useState<'customer' | 'hotel' | 'itinerary' | 'additional' | 'review'>('customer');

    const builderSteps = [
        { id: 'customer', label: 'Customer Information', helper: 'Customer information' },
        { id: 'hotel', label: 'Hotel Selection', helper: 'Hotel select' },
        { id: 'itinerary', label: 'Itinerary Design', helper: 'Itinerary design' },
        { id: 'additional', label: 'Additional Fields', helper: 'Additional fields' },
        { id: 'review', label: 'Final Review & Confirmation', helper: 'Final review and confirmation' },
    ] as const;

    const assignHotelBookingReferences = (stays: typeof formHotelStays, tripId: string) => {
        const taken = collectReferenceIds(db);
        if (tripId) taken.push(tripId);
        return stays.map((stay) => {
            const bookingId = ensureHotelBookingId(stay.hotelBookingId || stay.bookingCnf, taken);
            taken.push(bookingId);
            return {
                ...stay,
                hotelBookingId: bookingId,
                bookingCnf: bookingId,
            };
        });
    };

    const confirmHotelSelection = () => {
        setHotelValidationAttempted(true);
        const incompleteMessage = getHotelSelectionIncompleteMessage(
            formHotelStays,
            effectiveNights,
            formDepartureDate
        );
        if (incompleteMessage) {
            return;
        }
        const taken = collectReferenceIds(db);
        const matchingLead =
            leadContext ||
            findLeadByContact(db?.leads?.data || [], {
                leadId: leadContext?.id,
                name: formCustomer,
                phone: `${formCountryCode} ${formPhone}`,
                tripId: formTripId,
            });
        const tripId = ensureTripId(
            formTripId || matchingLead?.trackingId || matchingLead?.tripId,
            taken
        );
        setFormTripId(tripId);
        setFormHotelStays(assignHotelBookingReferences(formHotelStays, tripId));
        setHotelSelectionConfirmed(true);
        setHotelValidationAttempted(false);
        setBuilderStep('itinerary');
    };

    type BuilderStepId = (typeof builderSteps)[number]['id'];

    const currentBuilderStepIndex = builderSteps.findIndex((s) => s.id === builderStep);

    const isBuilderStepCompleted = (stepId: BuilderStepId): boolean => {
        const stepIndex = builderSteps.findIndex((s) => s.id === stepId);
        if (stepIndex < 0) return false;
        if (stepId === 'hotel') return hotelSelectionConfirmed;
        return stepIndex < currentBuilderStepIndex;
    };

    const validateCustomerBasics = (): boolean => {
        if (!formCustomer.trim()) {
            alert('Please enter the client name.');
            setBuilderStep('customer');
            return false;
        }
        const phoneValidationError = validateLocalPhone(formCountryCode, formPhone);
        if (phoneValidationError) {
            setPhoneError('Please enter a correct mobile number.');
            setBuilderStep('customer');
            return false;
        }
        setPhoneError('');
        if (!formDepartureDate) {
            alert('Please set the departure date.');
            setBuilderStep('customer');
            return false;
        }
        if (!builderCountry?.trim()) {
            alert('Please select a destination country.');
            setBuilderStep('customer');
            return false;
        }
        return true;
    };

    const navigateToBuilderStep = (targetId: BuilderStepId) => {
        if (['itinerary', 'additional', 'review'].includes(targetId) && !hotelSelectionConfirmed) {
            alert('Please confirm hotel selection on the Hotel Selection step first.');
            return;
        }
        const needsCustomer = ['hotel', 'itinerary', 'additional', 'review'].includes(targetId);
        if (needsCustomer && !formCustomer.trim()) {
            alert('Complete Customer Information first.');
            setBuilderStep('customer');
            return;
        }
        if (needsCustomer && !formDepartureDate) {
            alert('Set departure date in Customer Information first.');
            setBuilderStep('customer');
            return;
        }
        if (
            builderStep === 'itinerary' &&
            ['additional', 'review'].includes(targetId) &&
            !isItineraryActivitiesComplete
        ) {
            setItineraryValidationAttempted(true);
            return;
        }
        if (targetId !== 'itinerary') {
            setItineraryValidationAttempted(false);
        }
        setBuilderStep(targetId);
    };

    const goToNextBuilderStep = () => {
        if (builderStep === 'customer') {
            if (!validateCustomerBasics()) return;
            navigateToBuilderStep('hotel');
            return;
        }
        if (builderStep === 'hotel') {
            if (!hotelSelectionConfirmed) {
                alert('Click "Confirm Hotel Selection" before continuing.');
                return;
            }
            navigateToBuilderStep('itinerary');
            return;
        }
        if (builderStep === 'itinerary') {
            if (!isItineraryActivitiesComplete) {
                setItineraryValidationAttempted(true);
                return;
            }
            setItineraryValidationAttempted(false);
            navigateToBuilderStep('additional');
            return;
        }
        if (builderStep === 'additional') {
            navigateToBuilderStep('review');
        }
    };

    const goToPrevBuilderStep = () => {
        const idx = builderSteps.findIndex((s) => s.id === builderStep);
        if (idx <= 0) return;
        navigateToBuilderStep(builderSteps[idx - 1].id);
    };

    const getBuilderStepNavConfig = (): {
        nextLabel: string;
        onNext?: () => void;
        hideNext?: boolean;
        disableNext?: boolean;
        extra?: React.ReactNode;
    } => {
        switch (builderStep) {
            case 'customer':
                return { nextLabel: 'Next: Hotel Selection' };
            case 'hotel':
                return {
                    nextLabel: hotelSelectionConfirmed ? 'Next: Itinerary Design' : 'Next Step',
                    onNext: hotelSelectionConfirmed
                        ? () => navigateToBuilderStep('itinerary')
                        : goToNextBuilderStep,
                    disableNext: !hotelSelectionConfirmed,
                    extra: (
                        <button
                            type="button"
                            onClick={confirmHotelSelection}
                            title={
                                hotelSelectionIncompleteMessage ||
                                'Confirm hotel stays for the full package duration'
                            }
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black uppercase tracking-wide shadow-md whitespace-nowrap shrink-0"
                        >
                            <CheckCircle2 size={18} className="shrink-0" />
                            Confirm Hotel Selection
                        </button>
                    ),
                };
            case 'itinerary':
                return {
                    nextLabel: 'Next: Additional Fields',
                    onNext: () => {
                        if (!isItineraryActivitiesComplete) {
                            setItineraryValidationAttempted(true);
                            return;
                        }
                        setItineraryValidationAttempted(false);
                        navigateToBuilderStep('additional');
                    },
                };
            case 'additional':
                return { nextLabel: 'Next: Final Review' };
            case 'review':
                return { nextLabel: 'Next Step', hideNext: true };
            default:
                return { nextLabel: 'Next Step', hideNext: true };
        }
    };

    const renderBuilderStepFooter = () => {
        const nav = getBuilderStepNavConfig();
        return (
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-6 py-4">
                {/* Tablet: Confirm above nav buttons; desktop: Cancel | Previous | Confirm | Next */}
                <div className="flex flex-wrap items-center w-full gap-3 lg:gap-4">
                    <button
                        type="button"
                        onClick={cancelNewQuotation}
                        className="order-2 lg:order-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors whitespace-nowrap shrink-0"
                    >
                        <X size={16} className="shrink-0" />
                        <span>Cancel</span>
                    </button>
                    <button
                        type="button"
                        onClick={goToPrevBuilderStep}
                        disabled={builderStep === 'customer'}
                        className="order-3 lg:order-2 inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                    >
                        <ArrowLeft size={16} className="shrink-0" />
                        <span>Previous Step</span>
                    </button>
                    {nav.extra ? (
                        <div className="order-1 lg:order-3 basis-full lg:basis-auto w-full lg:w-auto lg:flex-1 flex justify-center">
                            {nav.extra}
                        </div>
                    ) : (
                        <div className="hidden lg:block lg:order-3 lg:flex-1 min-w-0" aria-hidden />
                    )}
                    {!nav.hideNext ? (
                        <button
                            type="button"
                            onClick={nav.onNext || goToNextBuilderStep}
                            disabled={nav.disableNext}
                            className="order-4 ml-auto lg:ml-0 inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-crm-600 hover:bg-crm-700 text-white rounded-xl text-sm font-bold shadow-md shadow-crm-200 transition-all active:scale-95 whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-crm-600"
                        >
                            <span>{nav.nextLabel}</span>
                            <ArrowRight size={16} className="shrink-0" />
                        </button>
                    ) : (
                        <div className="order-4 ml-auto lg:ml-0 shrink-0 w-px" aria-hidden />
                    )}
                </div>
            </div>
        );
    };

    const buildCurrentQuoteOption = (options?: { silent?: boolean }): any | null => {
        if (!options?.silent && !validateCustomerBasics()) return null;
        if (options?.silent) {
            if (!formCustomer.trim() || !formPhone.trim() || !formDepartureDate) return null;
        }
        if (!effectivePresetId) {
            if (!options?.silent) alert('Please select a destination package or preset.');
            return null;
        }

        const sourceCountryData = sourceCountries.find(c => c.name === formSourceCountry);
        const sourceFlag = sourceCountryData?.flag || '🇮🇳';
        const airportCode = formSourceAirport.split(' ')[0] || 'BOM';

        const matchingLeadForTrip =
            leadContext ||
            findLeadByContact(db?.leads?.data || [], {
                leadId: leadContext?.id,
                name: formCustomer,
                phone: `${formCountryCode} ${formPhone}`,
                email: leadContext?.email,
                tripId: formTripId,
            });
        const takenIds = collectReferenceIds(db);
        const tripId = ensureTripId(
            formTripId || matchingLeadForTrip?.trackingId || matchingLeadForTrip?.tripId,
            takenIds
        );
        const hotelStaysForQuote = assignHotelBookingReferences(formHotelStays, tripId);

        const pricing = calculateQuote({
            presetId: effectivePresetId,
            adults: formAdults,
            kids: formKids,
            kidsAges: parseKidsAges(formKidsAges),
            itinerary: formItinerary,
            flightMeal: formFlightMeal,
            hotelTier: formHotelTier,
            hotelId: formHotelId,
            hotelStays: hotelStaysForQuote,
            customHotelRate: customHotelRate || undefined,
            hotelMealPlan: formHotelMealPlan,
            needFlight: formNeedFlight,
            customFlightTotal: customFlightTotal || undefined,
            vehiclePrice: formVehiclePrice,
            tripMode,
        }, customPresets, db?.hotels?.data);
        const preset = pricing.preset;
        const selectedHotel = (db?.hotels?.data || []).find((h: any) => h.id === formHotelId);

        // Quote issue/created date (not trip departure — that lives in departureDate)
        const dateDisplay = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        const newQuoteId = getNextId('quotations', 'QT-2026');

        const matchingLead = matchingLeadForTrip || leadContext;
        const allRelevantQuotes = getQuotesForLeadVersioning(
            db?.quotations?.data || [],
            matchingLead,
            db?.leads?.data || []
        );

        const version = iterationParent
            ? resolveChildQuoteVersion(iterationParent, allRelevantQuotes)
            : resolveNextPrimaryQuoteVersion(allRelevantQuotes);

        const leadEmail = matchingLead?.email || leadContext?.email;
        const createdById =
            resolveRecordCreatedById({
                formAgentId,
                userRole,
                userEmail,
                sessionAgentId: currentAgentId,
                db,
            }) ||
            matchingLead?.createdById ||
            leadContext?.createdById ||
            '';
        const additionalServiceCharge = buildAdditionalServiceChargePayload(formAdditionalServiceCharge);
        const pricingQuoteSnapshot = {
            presetId: effectivePresetId,
            destination: builderDestination || preset.destination,
            travelers: pricing.travelersLabel,
            kidAges: parseKidsAges(formKidsAges),
            needFlight: formNeedFlight,
            hotelTier: formHotelTier,
            hotelStays: hotelStaysForQuote,
            itinerary: formItinerary,
            vehiclePrice: formVehiclePrice,
            additionalActivities: normalizeAdditionalActivities(
                formAdditionalActivities.filter((row) => row.title.trim())
            ),
            additionalServiceCharge,
            customFlightTotal: customFlightTotal || undefined,
            tripMode,
            source: tripMode === 'package' ? 'Quotation' : 'Custom Trip',
        };
        const financials = resolveQuoteFinancials(pricingQuoteSnapshot, pricing, db);
        const baseItems = buildQuoteLineItems({
                pricing,
                travelerCount: formAdults + formKids || 1,
                hotelSub:
                    hotelStaysForQuote.length > 0
                        ? hotelStaysForQuote
                              .map((stay: any) => {
                                  const h = (db?.hotels?.data || []).find((row: any) => row.id === stay.hotelId);
                                  return `${stay.nights}N ${h?.name || 'Selected Hotel'}`;
                              })
                              .join(' • ')
                        : selectedHotel
                          ? `${selectedHotel.name} (${formHotelTier})`
                          : `${preset.hotelDesc} (${formHotelTier} Tier)`,
                flightDesc: preset.flightDesc,
                visaSub: 'Standard Processing Fee (Static)',
                activitiesSub: 'Base package components',
                visaCost: preset.visaCost,
                formFlightMeal,
                formNeedFlight,
            });
        const items = appendServiceChargeAndGstLineItems(
            baseItems,
            financials.additionalServiceChargeAmount,
            financials.gstOnPackage || 0,
            financials.gstOnAdditional || 0
        );

        const newQuote = {
            id: newQuoteId,
            customer: formCustomer,
            email:
                leadEmail ||
                `${formCustomer.split(' ')[0].toLowerCase() || 'client'}@example.com`,
            customerEmail: leadEmail || undefined,
            phone: `${formCountryCode} ${formPhone}`,
            destination: builderDestination || preset.destination,
            duration: `${formItinerary.length - 1} Nights / ${formItinerary.length} Days`,
            departureDate: formDepartureDate,
            travelers: pricing.travelersLabel,
            kidAges: parseKidsAges(formKidsAges),
            presetId: effectivePresetId,
            subtotal: financials.subtotal,
            taxes: financials.taxes,
            total: financials.total,
            additionalServiceCharge,
            additionalServiceChargeAmount: financials.additionalServiceChargeAmount,
            date: dateDisplay,
            createdAt: new Date().toISOString(),
            status: formStatus,
            version: String(version),
            parentId: iterationParent?.id || null,
            leadId: leadContext?.id || matchingLead?.id || null,
            agentId: formAgentId || matchingLead?.agentId || currentAgentId || null,
            agentName: formAgentName || matchingLead?.agentName || null,
            createdById,
            sourceCountry: formSourceCountry,
            sourceAirport: formSourceAirport,
            sourceCountryFlag: sourceFlag,
            sourceAirportCode: airportCode,
            tripId,
            trackingId: tripId,
            hotelTier: formHotelTier,
            hotelId: formHotelId,
            hotelStays: hotelStaysForQuote,
            customHotelRate: customHotelRate,
            flightMeal: formFlightMeal,
            hotelMealPlan: formHotelMealPlan,
            needFlight: formNeedFlight,
            customFlightTotal: customFlightTotal,
            quoteNotes: formQuoteNotes,
            customizationRequest: formQuoteNotes || null,
            additionalActivities: normalizeAdditionalActivities(
                formAdditionalActivities.filter((row) => row.title.trim())
            ),
            termsId: formTermsId || null,
            flightDetails: {
                mealOpt: formFlightMeal.optIn,
                mealType: formFlightMeal.type,
                mealCharge: pricing.mealCharge
            },
            itinerary: formItinerary,
            transportation: itineraryVehicleLabel || null,
            vehicleType: formVehicleType || null,
            carType: formVehicleType === 'Car' ? formCarType || null : null,
            vehicleOther: formVehicleType === 'Other' ? formVehicleOther || null : null,
            vehiclePrice: Math.max(0, Number(formVehiclePrice) || 0),
            items,
            tripMode,
            source: tripMode === 'package' ? 'Quotation' : 'Custom Trip',
        };

        return newQuote;
    };

    // State for temporary editing of the selected quote's prices in the preview
    const [editingQuote, setEditingQuote] = useState<any>(null);
    const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

    const parseKidsAges = (value: string): number[] =>
        String(value || '')
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 17);

    useEffect(() => {
        if (selectedQuote) {
            setEditingQuote(JSON.parse(JSON.stringify(selectedQuote)));
        } else {
            setEditingQuote(null);
        }
    }, [selectedQuote]);

    // Resolve the active agency details for the selected quotation
    const quoteBranding = useMemo(() => {
        const quoteObj = editingQuote || selectedQuote;
        if (!quoteObj) return null;

        const settings = agencyBranding.settings;
        let quoteAgent = null;

        // 1. Try to find the agent via quote's agentId
        const bookingAgentId = quoteObj.agentId;
        if (bookingAgentId) {
            // First check if it matches travel agent id
            quoteAgent = (db?.travelAgents?.data || []).find((a: any) => a.id === bookingAgentId);
            
            // If not found, check if it's staff employeeId
            if (!quoteAgent) {
                const staffObj = (db?.staff?.data || []).find(
                    (s: any) => s.employeeId === bookingAgentId || s.id === bookingAgentId
                );
                if (staffObj?.agentId) {
                    quoteAgent = (db?.travelAgents?.data || []).find((a: any) => a.id === staffObj.agentId);
                }
            }
        }

        // 2. Fallback: If not found, try the logged-in user context
        if (!quoteAgent && userRole !== 'admin') {
            if (currentAgentId) {
                quoteAgent = (db?.travelAgents?.data || []).find((a: any) => a.id === currentAgentId);
            }
        }

        // 3. Extract resolved fields
        if (quoteAgent) {
            return {
                name: quoteAgent.businessName || quoteAgent.name || 'Travel Agency',
                logoUrl: quoteAgent.avatar || (quoteAgent as any).logoUrl || '',
                address: quoteAgent.address || quoteAgent.businessAddress || 'No office address specified',
                email: quoteAgent.email || 'support@agency.com',
                gstDetails: quoteAgent.gstDetails || ''
            };
        }

        // Fallback to Admin Settings
        return {
            name: settings?.agencyName || PLATFORM_NAME,
            logoUrl: settings?.logoUrl || '',
            address: settings?.agencyAddress || 'Main Headquarters',
            email: settings?.supportEmail || settings?.email || 'admin@aumento.com',
            gstDetails: settings?.gstDetails || ''
        };
    }, [editingQuote, selectedQuote, db, userRole, currentAgentId, agencyBranding]);

    const handleEditMode = (quoteOverride?: any) => {
        // onClick can pass a MouseEvent; only accept real quote-like objects as overrides
        const isQuoteObject = quoteOverride && typeof quoteOverride === 'object' && 'id' in quoteOverride && 'customer' in quoteOverride;
        const q = isQuoteObject ? quoteOverride : selectedQuote;
        if (!q) return;

        // Reset builder state when editing an existing quote
        setIterationParent(null);

        // Populate all form states from quote
        setFormCustomer(q.customer);
        const travelers = parseTravelers(q.travelers);
        setFormAdults(travelers.adults);
        setFormKids(travelers.kids);
        setFormKidsAges(Array.isArray(q.kidAges) ? q.kidAges.join(', ') : '');

        const presetFromQuote =
            (q.presetId && allPresets.find(p => p.id === q.presetId)) ||
            allPresets.find(p => {
                const dest = String(q.destination || '').toLowerCase();
                const presetDest = String(p.destination || '').toLowerCase();
                return !!dest && (presetDest === dest || presetDest.includes(dest) || dest.includes(presetDest));
            });

        setSelectedPresetId(q.presetId || presetFromQuote?.id || packagePresets?.[0]?.id || '');
        setFormDepartureDate(q.departureDate || '');
        const sourceFromQuote = applySourceCountryAirport(q.sourceCountry || 'India', q.sourceAirport);
        setFormSourceCountry(sourceFromQuote.country);
        setFormSourceAirport(sourceFromQuote.airport || 'BOM (Mumbai)');
        setFormHotelTier(q.hotelTier || 'Standard');
        setFormHotelId(q.hotelId || '');
        setFormHotelInput((db?.hotels?.data || []).find((h: any) => h.id === q.hotelId)?.name || '');
        setCustomHotelRate(q.customHotelRate || null);
        if (Array.isArray(q.hotelStays) && q.hotelStays.length > 0) {
            setFormHotelStays(
                q.hotelStays
                    .filter((s: any) => s?.hotelId && Number(s.nights) > 0)
                    .map((s: any) => {
                        const hotel = (db?.hotels?.data || []).find((h: any) => h.id === s.hotelId);
                        return {
                            hotelId: s.hotelId,
                            nights: Number(s.nights),
                            hotelInput: hotel?.name || '',
                            city: s.city || builderCity || '',
                            roomType: s.roomType || '',
                            rooms: Number(s.rooms || 1),
                            personsPerRoom: Number(s.personsPerRoom || 2),
                            extraBed: Number(s.extraBed || 0),
                            extraBedPrice: Number(s.extraBedPrice || 0),
                            childWithBed: Number(s.childWithBed || 0),
                            childWithBedPrice: Number(s.childWithBedPrice || 0),
                            childWithoutBed: Number(s.childWithoutBed || 0),
                            childWithoutBedPrice: Number(s.childWithoutBedPrice || 0),
                            mealPlan: s.mealPlan || '',
                            nightPrices: Array.isArray(s.nightPrices) ? s.nightPrices : undefined,
                            hotelBookingId: s.hotelBookingId || s.bookingCnf,
                            bookingCnf: s.bookingCnf || s.hotelBookingId,
                            specialInclusions: Array.isArray(s.specialInclusions)
                                ? s.specialInclusions.map((inc: any, i: number) => ({
                                      id: inc.id || `inc-${i}-${s.hotelId}`,
                                      name: inc.name || '',
                                      amount: inc.amount != null ? Number(inc.amount) : undefined,
                                  }))
                                : [],
                        };
                    })
            );
            setHotelSelectionConfirmed(true);
        } else if (q.hotelId) {
            const defaultNights = parseDurationNights(q.duration || livePreset.duration);
            const hotel = (db?.hotels?.data || []).find((h: any) => h.id === q.hotelId);
            setFormHotelStays([{
                hotelId: q.hotelId,
                nights: defaultNights,
                hotelInput: hotel?.name || '',
                city: builderCity || '',
                roomType: '',
                rooms: 1,
                personsPerRoom: 2,
                extraBed: 0,
                extraBedPrice: 0,
                childWithBed: 0,
                childWithBedPrice: 0,
                childWithoutBed: 0,
                childWithoutBedPrice: 0,
                mealPlan: q.hotelMealPlan || '',
            }]);
        } else {
            setFormHotelStays([]);
            setHotelSelectionConfirmed(false);
        }
        setFormTripId(q.tripId || q.trackingId || '');
        setFormFlightMeal({ optIn: false, type: 'Veg' });
        setFormNeedFlight(false);
        setCustomFlightTotal(null);
        setFormHotelMealPlan(q.hotelMealPlan || 'CP (Breakfast Only)');
        setFormQuoteNotes(q.quoteNotes || q.customizationRequest || '');
        setFormAdditionalActivities(normalizeAdditionalActivities(q.additionalActivities));
        setFormAdditionalServiceCharge(normalizeAdditionalServiceCharge(q.additionalServiceCharge));
        setFormTermsId(q.termsId || '');
        termsManuallySelectedRef.current = Boolean(q.termsId);
        setFormStatus(q.status || 'sent');
        setFormAgentId(q.agentId || '');
        setFormAgentName(q.agentName || '');

        // Parse lead phone into code and number
        const qPhone = q.phone || '';
        const matchedCode = COUNTRY_PHONE_DATA.find(c => qPhone.startsWith(c.code));
        if (matchedCode) {
            setFormCountryCode(matchedCode.code);
            setFormPhone(qPhone.slice(matchedCode.code.length).trim());
        } else {
            setFormCountryCode('+91');
            setFormPhone(qPhone.replace(/^\+\d+\s?/, ''));
        }

        // Restore builder country + city from destination, e.g. "Sydney, Australia"
        const destParts = parseDestinationParts(q.destination || '');
        setBuilderCountry(destParts.country);
        setBuilderCity(destParts.city);

        // Set ref BEFORE setting selectedPresetId and itinerary so the auto-rebuild effect is skipped
        isEditingExistingRef.current = true;

        // Hydrate/normalize itinerary from existing quote (supports old/broken records)
        const desiredDays =
            getDurationDays(q.duration) ||
            (presetFromQuote?.duration ? parseDurationNights(presetFromQuote.duration) + 1 : 1);

        setFormItinerary(normalizeItinerary(q.itinerary, desiredDays));

        const savedVehicleType = String(q.vehicleType || '').trim();
        if (savedVehicleType) {
            setFormVehicleType(savedVehicleType);
            setFormCarType(String(q.carType || '').trim());
            setFormVehicleOther(String(q.vehicleOther || '').trim());
        } else {
            const transport = String(q.transportation || '').trim();
            if (transport.startsWith('Car')) {
                setFormVehicleType('Car');
                const car = transport.includes('—')
                    ? transport.split('—').slice(1).join('—').trim()
                    : '';
                setFormCarType(car);
                setFormVehicleOther('');
            } else if (transport.startsWith('Other')) {
                setFormVehicleType('Other');
                setFormCarType('');
                setFormVehicleOther(
                    transport.includes('—')
                        ? transport.split('—').slice(1).join('—').trim()
                        : ''
                );
            } else if (ITINERARY_VEHICLE_TYPES.includes(transport as any)) {
                setFormVehicleType(transport);
                setFormCarType('');
                setFormVehicleOther('');
            } else {
                setFormVehicleType('');
                setFormCarType('');
                setFormVehicleOther('');
            }
        }
        setFormVehiclePrice(Math.max(0, Number(q.vehiclePrice) || 0));

        const quoteNights = Math.max(1, parseDurationNights(q.duration) || desiredDays - 1);
        setFormTripDurationUnit('nights');
        setFormTripDurationValue(quoteNights);

        // Open builder in edit mode
        setTripMode(
            q.tripMode === 'package' || q.source === 'Quotation'
                ? 'package'
                : findLeadForQuote(q, leads)?.source === 'Quotation'
                  ? 'package'
                  : 'custom'
        );
        setEditingQuoteId(q.id);
        setIsCreating(true);
    };

    useEffect(() => {
        const editMode = searchParams.get('editMode');
        const quoteId = searchParams.get('quoteId');
        if (editMode === 'true' && quoteId) {
            const quoteToEdit = db.quotations.data.find((q: any) => q.id === quoteId);
            if (quoteToEdit) {
                // Ensure UI is ready for edit
                setSelectedQuoteId(quoteId);
                handleEditMode(quoteToEdit);
                // Clear search params to prevent loop
                setSearchParams({});
            }
        }
    }, [searchParams, db.quotations.data]);

    useEffect(() => {
        const allLeads = db?.leads?.data || [];
        (db?.quotations?.data || []).forEach((q: any) => {
            if (backfilledQuoteIdsRef.current.has(q.id)) return;
            const matched = findLeadForQuote(q, allLeads);
            if (!matched?.id) return;

            const leadTripId = matched.trackingId || matched.tripId;
            const needsLeadIdRepair = !q.leadId || q.leadId !== matched.id;
            const needsTripRepair = Boolean(
                leadTripId && String(q.trackingId || q.tripId || '') !== String(leadTripId)
            );
            const needsEmailRepair =
                (!q.email || String(q.email).endsWith('@example.com')) && matched.email;
            if (!needsLeadIdRepair && !needsEmailRepair && !needsTripRepair) return;

            backfilledQuoteIdsRef.current.add(q.id);
            updateRecord('quotations', q.id, {
                ...(needsLeadIdRepair ? { leadId: matched.id } : {}),
                ...(needsTripRepair ? { tripId: leadTripId, trackingId: leadTripId } : {}),
                ...(needsEmailRepair
                    ? { email: matched.email, customerEmail: matched.email }
                    : {}),
            });
        });
    }, [db?.quotations?.data, db?.leads?.data, updateRecord]);

    const saveChanges = () => {
        if (editingQuote) {
            updateRecord('quotations', editingQuote.id, editingQuote);
            alert('Quotation updated successfully!');
        }
    };

    const statusOptions = [
        { value: 'draft', label: 'Draft', color: 'bg-slate-50 text-slate-500 border-slate-100' },
        { value: 'new', label: 'New Lead', color: 'bg-blue-50 text-blue-700 border-blue-200' },
        { value: 'contacted', label: 'Contacted', color: 'bg-amber-50 text-amber-700 border-amber-200' },
        { value: 'sent', label: 'Sent', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
        { value: 'itinerary', label: 'Itinerary Sent', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
        { value: 'negotiation', label: 'Negotiation', color: 'bg-purple-50 text-purple-700 border-purple-200' },
        { value: 'follow-up', label: 'Follow Up', color: 'bg-pink-50 text-pink-700 border-pink-200' },
        { value: 'pending', label: 'Booking Pending', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
        { value: 'confirmed', label: 'Confirmed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { value: 'completed', label: 'Trip Completed', color: 'bg-teal-50 text-teal-700 border-teal-200' },
        { value: 'lost', label: 'Lost/Rejected', color: 'bg-red-50 text-red-700 border-red-200' },
    ];

    // Custom Package Presets state (global from db)
    const customPresets = db?.customPresets?.data || [];
    const [isAddingPreset, setIsAddingPreset] = useState(false);
    const [newPreset, setNewPreset] = useState({
        name: '', destination: '', duration: '5 Nights / 6 Days',
        hotelCost: 100000, hotelDesc: 'Luxury Resort',
        flightCost: 80000, flightDesc: 'Return Flights',
        activityCost: 30000, activityDesc: 'Premium Tours',
        transferCost: 15000, transferDesc: 'Private Transfers',
        visaCost: 5000
    });

    const allPresets = useMemo(() => [...packagePresets, ...customPresets], [customPresets]);

    const applyLeadDestinationToBuilder = useCallback(
        (lead: any, existingQuote?: any | null) => {
            const boot = bootstrapLeadQuoteDestination(lead, allPresets, existingQuote);
            setSelectedPresetId(boot.selectedPresetId);
            setCustomDestination(boot.destination);
            setBuilderCountry(boot.builderCountry);
            setBuilderCity(boot.builderCity);
            return boot;
        },
        [allPresets]
    );
    const allActivities = useMemo(
        () => mergeActivityCatalog(db?.activities?.data || []),
        [db?.activities?.data]
    );
    const assignedActivityKeys = useMemo(
        () => getAssignedActivityKeys(formItinerary),
        [formItinerary]
    );

    const BUILTIN_HOTEL_TIERS = ['Standard', 'Deluxe', 'Luxury'];
    const BUILTIN_ROOM_TYPES = ['Standard Room', 'Deluxe Room', 'Suite Room'];
    const settingsRecord = db?.settings?.data?.[0];
    const customHotelTiers: string[] = Array.isArray(settingsRecord?.customHotelTiers)
        ? settingsRecord.customHotelTiers
        : [];
    const customRoomTypes: string[] = Array.isArray(settingsRecord?.customRoomTypes)
        ? settingsRecord.customRoomTypes
        : [];
    const customHotelTierMultipliers: Record<string, number> =
        settingsRecord?.customHotelTierMultipliers &&
        typeof settingsRecord.customHotelTierMultipliers === 'object'
            ? settingsRecord.customHotelTierMultipliers
            : {};
    const allHotelTiers = useMemo(() => {
        const seen = new Set<string>(BUILTIN_HOTEL_TIERS);
        const merged = [...BUILTIN_HOTEL_TIERS];
        customHotelTiers.forEach((tier) => {
            const t = String(tier || '').trim();
            if (t && !seen.has(t)) {
                seen.add(t);
                merged.push(t);
            }
        });
        if (formHotelTier && !seen.has(formHotelTier)) {
            merged.push(formHotelTier);
        }
        return merged;
    }, [customHotelTiers, formHotelTier]);

    const allRoomTypes = useMemo(() => {
        const seen = new Set<string>(BUILTIN_ROOM_TYPES);
        const merged = [...BUILTIN_ROOM_TYPES];
        customRoomTypes.forEach((roomType) => {
            const value = String(roomType || '').trim();
            if (value && !seen.has(value)) {
                seen.add(value);
                merged.push(value);
            }
        });
        formHotelStays.forEach((stay) => {
            const value = String(stay.roomType || '').trim();
            if (value && !seen.has(value)) {
                seen.add(value);
                merged.push(value);
            }
        });
        return merged;
    }, [customRoomTypes, formHotelStays]);

    // Filter unique destinations for the custom selector
    const customDestList = useMemo(() => {
        const seen = new Set();
        return allPresets.filter(p => {
            if (seen.has(p.destination)) return false;
            seen.add(p.destination);
            return true;
        }).map(p => ({ destination: p.destination, name: p.name, id: p.id }));
    }, [allPresets]);

    // Unique destinations from presets
    const destinations = useMemo(() => {
        return allPresets.map(p => ({ destination: p.destination, id: p.id, name: p.name, maxDays: parseDurationNights(p.duration) + 1 }));
    }, [allPresets]);

    // Catalog countries from libraries (merged into the full world list)
    const catalogCountries = useMemo(() => {
        const isCatalogCountry = (name: string) => {
            const normalized = name.trim().toLowerCase();
            return normalized.length > 0 && normalized !== 'global';
        };
        const countriesArr = new Set<string>();
        if (Array.isArray(allActivities)) {
            allActivities.forEach(a => {
                const c = a.country?.split(',').pop()?.trim() || a.country;
                if (c && isCatalogCountry(c)) countriesArr.add(c);
            });
        }
        if (Array.isArray(db?.hotels?.data)) {
            db.hotels.data.forEach((h: any) => {
                const c = h.destination?.split(',').pop()?.trim() || h.destination;
                if (c && isCatalogCountry(c)) countriesArr.add(c);
            });
        }
        if (Array.isArray(allPresets)) {
            allPresets.forEach(p => {
                const c = p.destination?.split(',').pop()?.trim() || p.destination;
                if (c && isCatalogCountry(c)) countriesArr.add(c);
            });
        }
        return Array.from(countriesArr);
    }, [allPresets, allActivities, db?.hotels?.data]);

    const allCountryOptions = useMemo(
        () => buildCountryOptions(catalogCountries),
        [catalogCountries]
    );

    const filteredCountryOptions = useMemo(
        () => filterLocationOptions(allCountryOptions, builderCountrySearch),
        [allCountryOptions, builderCountrySearch]
    );

    const filteredSourceCountryOptions = useMemo(
        () => filterLocationOptions(allCountryOptions, sourceCountrySearch),
        [allCountryOptions, sourceCountrySearch]
    );

    const normalizedBuilderCountry = useMemo(
        () => resolveWorldCountryName(builderCountry).toLowerCase(),
        [builderCountry]
    );

    const matchesBuilderCountry = useCallback(
        (label?: string) => {
            if (!normalizedBuilderCountry) return true;
            const raw = String(label || '').trim().toLowerCase();
            if (!raw) return false;
            const parts = parseDestinationParts(label);
            const country = resolveWorldCountryName(parts.country || raw).toLowerCase();
            return (
                country === normalizedBuilderCountry ||
                raw.includes(normalizedBuilderCountry) ||
                normalizedBuilderCountry.includes(country)
            );
        },
        [normalizedBuilderCountry]
    );

    const catalogCityExtras = useMemo(() => {
        if (!builderCountry?.trim()) return [] as string[];
        const extras = new Set<string>();

        (db?.destinations?.data || []).forEach((dest: any) => {
            const city = String(dest.name || '').trim();
            if (!city) return;
            if (matchesBuilderCountry(dest.country)) {
                extras.add(city);
            }
        });

        (db?.hotels?.data || []).forEach((hotel: any) => {
            const location = String(hotel.location || hotel.destination || '').trim();
            if (!location) return;
            const parts = parseDestinationParts(location);
            if (matchesBuilderCountry(parts.country || location)) {
                if (parts.city) extras.add(parts.city);
                else if (!location.includes(',')) extras.add(location);
            }
        });

        (allActivities || []).forEach((activity: any) => {
            const location = String(activity.location || activity.city || '').trim();
            const country = String(activity.country || '').split(',').pop()?.trim() || '';
            if (!location) return;
            if (matchesBuilderCountry(country)) {
                extras.add(location.split(',')[0]?.trim() || location);
            }
        });

        allPresets.forEach((preset: any) => {
            const parts = parseDestinationParts(preset.destination);
            if (matchesBuilderCountry(parts.country)) {
                if (parts.city) extras.add(parts.city);
            }
        });

        return Array.from(extras);
    }, [builderCountry, db?.destinations?.data, db?.hotels?.data, allActivities, allPresets, matchesBuilderCountry]);

    const builderCityOptions = useMemo(
        () => getCitiesForCountry(builderCountry, catalogCityExtras),
        [builderCountry, catalogCityExtras]
    );

    const filteredCityOptions = useMemo(
        () => filterLocationOptions(builderCityOptions, builderCity),
        [builderCityOptions, builderCity]
    );

    // Current preset & duration logic — never default to Bali when a lead destination is known
    const livePreset = useMemo(() => {
        if (selectedPresetId) {
            const byId = allPresets.find((preset) => preset.id === selectedPresetId);
            if (byId) return byId;
        }
        if (customDestination) {
            const byDestination = findPresetForDestination(customDestination, allPresets);
            if (byDestination) return byDestination;
        }
        if (leadContext) {
            const fromLead = findPresetForLead(leadContext, allPresets);
            if (fromLead) return fromLead;
        }
        return allPresets[0];
    }, [allPresets, selectedPresetId, customDestination, leadContext]);

    const builderDestination = useMemo(() => {
        if (builderCountry?.trim()) {
            const resolved = resolveBuilderDestinationFromCountry(
                builderCountry,
                allPresets,
                builderCity
            );
            if (builderCity?.trim()) {
                return formatDestinationLabel(builderCity, builderCountry);
            }
            return resolved.destination;
        }
        if (leadContext?.destination) {
            return resolveQuoteDestinationLabel(leadContext, allPresets, {
                matchedPreset: livePreset,
            });
        }
        return customDestination || livePreset?.destination || '';
    }, [builderCountry, builderCity, leadContext, allPresets, livePreset, customDestination]);

    const applyBuilderDestinationSelection = useCallback(
        (country: string, city: string = '') => {
            const resolved = resolveBuilderDestinationFromCountry(country, allPresets, city);
            const nextDestination = city.trim()
                ? formatDestinationLabel(city, country)
                : resolved.destination;
            setCustomDestination(nextDestination);
            if (resolved.selectedPresetId) {
                setSelectedPresetId(resolved.selectedPresetId);
                if (tripMode === 'package' && resolved.matchedPreset?.name) {
                    setFormPresetInput(resolved.matchedPreset.name);
                }
            } else {
                setSelectedPresetId('');
            }

            if (!leadContext?.id) return;

            const leadPatch: Record<string, unknown> = {
                destination: nextDestination,
            };
            if (resolved.selectedPresetId) {
                leadPatch.presetId = resolved.selectedPresetId;
            }
            updateRecord('leads', leadContext.id, leadPatch);
            setLeadContext((prev: any) =>
                prev ? { ...prev, destination: nextDestination, ...leadPatch } : prev
            );
        },
        [allPresets, leadContext, tripMode, updateRecord]
    );

    const handleBuilderCountrySelect = useCallback(
        (country: string) => {
            setBuilderCountry(country);
            setBuilderCity('');
            setBuilderCountrySearch('');
            setOpenCityDropdown(null);
            setIsRegionDropdownOpen(false);
            applyBuilderDestinationSelection(country, '');
        },
        [applyBuilderDestinationSelection]
    );

    const handleBuilderCityChange = useCallback(
        (city: string) => {
            setBuilderCity(city);
            if (!builderCountry?.trim()) return;
            applyBuilderDestinationSelection(builderCountry, city);
        },
        [applyBuilderDestinationSelection, builderCountry]
    );

    const createCityByName = useCallback(
        (cityName: string) => {
            const normalized = String(cityName || '').trim();
            const country = resolveWorldCountryName(builderCountry);
            if (!normalized || !country) return;

            const alreadyListed = builderCityOptions.some(
                (city) => city.toLowerCase() === normalized.toLowerCase()
            );
            if (alreadyListed) return;

            const existsInDb = (db?.destinations?.data || []).some((dest: any) => {
                const destCity = String(dest.name || '').trim().toLowerCase();
                const destCountry = resolveWorldCountryName(dest.country || '').toLowerCase();
                return destCity === normalized.toLowerCase() && destCountry === country.toLowerCase();
            });
            if (existsInDb) return;

            addRecord('destinations', {
                id: getNextId('destinations', 'DEST'),
                name: normalized,
                country,
                flag: '🌐',
                status: 'Active',
            });
        },
        [addRecord, builderCityOptions, builderCountry, db?.destinations?.data, getNextId]
    );

    const effectivePresetId =
        tripMode === 'package'
            ? selectedPresetId || livePreset?.id || ''
            : livePreset?.id || selectedPresetId || '';
    const packageMaxDays = parseDurationNights(livePreset.duration) + 1;

    const resolvedTripNights = useMemo(() => {
        if (formTripDurationUnit === 'nights') {
            return Math.max(1, formTripDurationValue);
        }
        return Math.max(1, formTripDurationValue - 1);
    }, [formTripDurationUnit, formTripDurationValue]);

    const resolvedTripDays = resolvedTripNights + 1;

    const sourceAirportOptions = useMemo(() => {
        const airports = getAirportsForCountry(formSourceCountry);
        return airports.map((airport) => ({
            value: `${airport.code} (${airport.city})`,
            label: `${airport.code} — ${airport.name}, ${airport.city}`,
        }));
    }, [formSourceCountry]);

    const applySourceCountryAirport = useCallback((country: string, preferredAirport?: string) => {
        const resolved = resolveWorldCountryName(country) || country;
        const airports = getAirportsForCountry(resolved);
        const preferred = String(preferredAirport || '').trim();
        if (preferred) {
            const preferredCode = preferred.split(' ')[0];
            const matched = airports.find((airport) => airport.code === preferredCode);
            return {
                country: resolved,
                airport: matched ? `${matched.code} (${matched.city})` : preferred,
            };
        }
        const first = airports[0];
        return {
            country: resolved,
            airport: first ? `${first.code} (${first.city})` : '',
        };
    }, []);

    const handleSourceCountrySelect = useCallback((nextCountry: string) => {
        const { country, airport } = applySourceCountryAirport(nextCountry);
        setFormSourceCountry(country);
        setFormSourceAirport(airport);
        setIsSourceCountryDropdownOpen(false);
        setSourceCountrySearch('');
    }, [applySourceCountryAirport]);

    const effectiveNights = isCreating
        ? resolvedTripNights
        : tripMode === 'package'
          ? parseDurationNights(livePreset.duration)
          : Math.max(1, resolvedTripDays - 1);
    const effectiveDuration = `${effectiveNights} Nights / ${effectiveNights + 1} Days`;

    const syncItineraryToTripDuration = useCallback((nights: number) => {
        const days = Math.max(1, nights) + 1;
        setFormItinerary(buildDefaultItinerary(days));
    }, []);

    const handleTripDurationChange = (value: number, unit?: 'nights' | 'days') => {
        const nextUnit = unit ?? formTripDurationUnit;
        const safeVal = Math.max(1, Math.min(60, value));
        setFormTripDurationUnit(nextUnit);
        setFormTripDurationValue(safeVal);
        const nights = nextUnit === 'nights' ? safeVal : Math.max(1, safeVal - 1);
        syncItineraryToTripDuration(nights);
    };

    const openDepartureDatePicker = () => {
        const el = departureDateRef.current;
        if (!el) return;
        if (typeof el.showPicker === 'function') {
            try {
                el.showPicker();
                return;
            } catch {
                /* Safari / unsupported */
            }
        }
        el.focus();
    };
    const itineraryVehicleLabel = formatItineraryVehicleLabel(
        formVehicleType,
        formCarType,
        formVehicleOther
    );
    const currentStayNights = formHotelStays.reduce((sum, s) => sum + Number(s.nights || 0), 0);
    const remainingStayNights = Math.max(0, effectiveNights - currentStayNights);
    const hotelsStayGrandTotal = formHotelStays.reduce((sum, stay) => sum + sumStayHotelTotal(stay), 0);
    const itineraryActivitiesTotal = formItinerary.reduce(
        (sum, day) =>
            sum +
            (day.activities || []).reduce(
                (daySum: number, act: any) => daySum + (Number(act.customPrice) || 0),
                0
            ),
        0
    );
    const itineraryVehicleCost = Math.max(0, Number(formVehiclePrice) || 0);
    const itineraryGrandTotal = itineraryActivitiesTotal + itineraryVehicleCost;
    const daysMissingActivities = formItinerary.filter(
        (day) => !(day.activities || []).length
    );
    const isItineraryActivitiesComplete =
        formItinerary.length > 0 && daysMissingActivities.length === 0;
    const canConfirmHotelSelection = isHotelSelectionComplete(
        formHotelStays,
        effectiveNights,
        formDepartureDate
    );
    const hotelSelectionIncompleteMessage = getHotelSelectionIncompleteMessage(
        formHotelStays,
        effectiveNights,
        formDepartureDate
    );

    useEffect(() => {
        if (!hotelSelectionConfirmed) return;
        if (!canConfirmHotelSelection) {
            setHotelSelectionConfirmed(false);
        }
    }, [hotelSelectionConfirmed, canConfirmHotelSelection]);

    useEffect(() => {
        if (!itineraryValidationAttempted) return;
        if (isItineraryActivitiesComplete) {
            setItineraryValidationAttempted(false);
        }
    }, [itineraryValidationAttempted, isItineraryActivitiesComplete]);
    const countryHotels = useMemo(() => {
        const cityQ = String(builderCity || '').trim().toLowerCase();
        return (db?.hotels?.data || []).filter((h: any) => {
            const label = String(h.location || h.destination || '').trim();
            if (!normalizedBuilderCountry) return true;
            if (!matchesBuilderCountry(label)) return false;
            if (!cityQ) return true;

            const parts = parseDestinationParts(label);
            const hotelCity = String(parts.city || '').trim().toLowerCase();
            const raw = label.toLowerCase();
            return (
                (hotelCity && (hotelCity === cityQ || hotelCity.includes(cityQ) || cityQ.includes(hotelCity))) ||
                raw.includes(cityQ)
            );
        });
    }, [db?.hotels?.data, normalizedBuilderCountry, matchesBuilderCountry, builderCity]);

    const findHotelByName = (name: string) => {
        const normalized = String(name || '').trim().toLowerCase();
        if (!normalized) return null;
        return countryHotels.find((h: any) => String(h.name || '').trim().toLowerCase() === normalized) || null;
    };
    const searchHotelsByName = (name: string) => {
        const normalized = String(name || '').trim().toLowerCase();
        if (!normalized) return countryHotels;
        return countryHotels.filter((h: any) => String(h.name || '').toLowerCase().includes(normalized));
    };

    const findRoomTypeByName = (name: string) => {
        const normalized = String(name || '').trim().toLowerCase();
        if (!normalized) return null;
        return allRoomTypes.find((roomType) => roomType.toLowerCase() === normalized) || null;
    };

    const searchRoomTypes = (name: string) => {
        const normalized = String(name || '').trim().toLowerCase();
        if (!normalized) return allRoomTypes;
        return allRoomTypes.filter((roomType) => roomType.toLowerCase().includes(normalized));
    };

    const findPresetByName = (name: string) => {
        const normalized = String(name || '').trim().toLowerCase();
        if (!normalized) return null;
        return (
            allPresets.find(
                (p) =>
                    String(p.name || '').trim().toLowerCase() === normalized ||
                    String(p.destination || '').trim().toLowerCase() === normalized
            ) || null
        );
    };

    const searchPresetsByName = (name: string) => {
        const normalized = String(name || '').trim().toLowerCase();
        const filtered = allPresets.filter((p) => {
            if (!builderCountry) return true;
            const dest = String(p.destination || '').toLowerCase();
            return (
                dest.includes(builderCountry.toLowerCase()) ||
                builderCountry.toLowerCase().includes(dest)
            );
        });
        if (!normalized) return filtered;
        return filtered.filter(
            (p) =>
                String(p.name || '').toLowerCase().includes(normalized) ||
                String(p.destination || '').toLowerCase().includes(normalized)
        );
    };

    const createPresetByName = (name: string) => {
        const normalizedName = String(name || '').trim();
        if (!normalizedName) return '';
        const existing = findPresetByName(normalizedName);
        if (existing) return existing.id;

        const nights = Math.max(1, effectiveNights || 4);
        const destination =
            builderCountry ||
            customDestination ||
            livePreset?.destination?.split(',').pop()?.trim() ||
            normalizedName;
        const id = `custom-p-${Date.now()}`;
        const preset = {
            id,
            name: normalizedName,
            destination: destination.includes(',') ? destination : `${normalizedName}, ${destination}`,
            duration: `${nights} Nights / ${nights + 1} Days`,
            hotelCost: 100000,
            hotelDesc: 'As quoted',
            flightCost: 80000,
            flightDesc: 'Return Flights',
            activityCost: 30000,
            activityDesc: 'Premium Tours',
            transferCost: 15000,
            transferDesc: 'Internal Transfers',
            visaCost: 5000,
        };
        addRecord('customPresets', preset);
        setSelectedPresetId(id);
        setFormPresetInput(preset.name);
        return id;
    };

    const addCustomHotelTier = (tierName: string) => {
        const normalized = String(tierName || '').trim();
        if (!normalized) return;
        setFormHotelTier(normalized);
        if (BUILTIN_HOTEL_TIERS.includes(normalized)) return;

        const settings = db?.settings?.data?.[0];
        const existing: string[] = Array.isArray(settings?.customHotelTiers)
            ? settings.customHotelTiers
            : [];
        if (existing.includes(normalized)) return;

        if (settings?.id) {
            updateRecord('settings', settings.id, {
                ...settings,
                customHotelTiers: [...existing, normalized],
            });
        }
    };

    const addCustomRoomType = (roomTypeName: string) => {
        const normalized = String(roomTypeName || '').trim();
        if (!normalized) return;
        if (BUILTIN_ROOM_TYPES.some((roomType) => roomType.toLowerCase() === normalized.toLowerCase())) {
            return;
        }

        const settings = db?.settings?.data?.[0];
        const existing: string[] = Array.isArray(settings?.customRoomTypes)
            ? settings.customRoomTypes
            : [];
        if (existing.some((roomType) => roomType.toLowerCase() === normalized.toLowerCase())) {
            return;
        }

        if (settings?.id) {
            updateRecord('settings', settings.id, {
                ...settings,
                customRoomTypes: [...existing, normalized],
            });
        }
    };

    const resetNewActivityForm = () => {
        setNewActivityTitle('');
        setNewActivityPrice(0);
        setNewActivityCategory('Leisure');
        setNewActivityDescription('');
        setNewActivityError('');
    };

    const createActivityFromForm = () => {
        const title = String(newActivityTitle || '').trim();
        const country = String(builderCountry || '').trim();
        const price = Math.max(0, Number(newActivityPrice) || 0);
        const category = String(newActivityCategory || 'Leisure').trim() || 'Leisure';
        const description = String(newActivityDescription || '').trim();

        if (!country) {
            setNewActivityError('Select a destination country in Customer Information first.');
            return null;
        }
        if (!title) {
            setNewActivityError('Activity title is required.');
            return null;
        }
        if (!description) {
            setNewActivityError('Description is required.');
            return null;
        }

        const existing = allActivities.find(
            (a) =>
                String(a.title || '').trim().toLowerCase() === title.toLowerCase() &&
                (matchesBuilderCountry(a.country || a.location || '') ||
                    String(a.country || '').toLowerCase() === country.toLowerCase())
        );
        if (existing) {
            setNewActivityError('An activity with this title already exists for this destination.');
            return existing;
        }

        const newId = getNextId ? getNextId('activities', 'ACT') : `ACT-${Date.now()}`;
        const activity = {
            id: newId,
            title,
            name: title,
            country,
            location: country,
            price,
            priceNum: price,
            category,
            description,
            duration: '4 Hours',
            status: 'Active',
        };
        addRecord('activities', activity);
        resetNewActivityForm();
        setShowNewActivityForm(false);
        return activity;
    };

    const addActivityToItineraryDay = useCallback(
        (dayIdx: number, activity: any) => {
            if (dayIdx < 0 || dayIdx >= formItinerary.length || !activity) return false;
            const draggedKey = getActivityAssignmentKey(activity);
            if (!isFreeDayActivity(activity)) {
                const alreadyAssigned = formItinerary.some((day) =>
                    (day.activities || []).some(
                        (act: any) => getActivityAssignmentKey(act) === draggedKey
                    )
                );
                if (alreadyAssigned) return false;
            }

            setFormItinerary((prev) => {
                const next = prev.map((day, i) => {
                    if (i !== dayIdx) return day;
                    return {
                        ...day,
                        activities: [
                            ...(day.activities || []),
                            {
                                ...activity,
                                customPrice: activity.price ?? activity.customPrice ?? 0,
                                ...(isFreeDayActivity(activity)
                                    ? {
                                          allowTitleEdit: true,
                                          instanceId: `${getActivityAssignmentKey(activity)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                                      }
                                    : {}),
                            },
                        ],
                    };
                });
                return next;
            });
            return true;
        },
        [formItinerary]
    );

    const filteredVaultActivities = useMemo(() => {
        const query = activitySearch.trim().toLowerCase();
        return (allActivities || []).filter((act) => {
            const countryStr = act.country || 'Global';
            const countryMatch =
                !builderCountry ||
                countryStr === 'Global' ||
                matchesBuilderCountry(countryStr);
            const searchMatch =
                !query ||
                (act.title || '').toLowerCase().includes(query) ||
                (act.category || '').toLowerCase().includes(query);
            return countryMatch && searchMatch;
        });
    }, [allActivities, activitySearch, builderCountry, matchesBuilderCountry]);

    const filteredPickerActivities = useMemo(() => {
        const query = activityPickerSearch.trim().toLowerCase();
        return (allActivities || []).filter((act) => {
            const countryStr = act.country || 'Global';
            const countryMatch =
                !builderCountry ||
                countryStr === 'Global' ||
                matchesBuilderCountry(countryStr);
            const searchMatch =
                !query ||
                (act.title || '').toLowerCase().includes(query) ||
                (act.category || '').toLowerCase().includes(query);
            return countryMatch && searchMatch;
        });
    }, [allActivities, activityPickerSearch, builderCountry, matchesBuilderCountry]);

    const createHotelByName = (name: string) => {
        const normalizedName = String(name || '').trim();
        if (!normalizedName) return '';
        const existing = findHotelByName(normalizedName);
        if (existing) return existing.id;

        const newHotelId = getNextId ? getNextId('hotels', 'HOTEL') : `HOTEL-${Date.now()}`;
        const fallbackCountry =
            builderCountry || livePreset.destination?.split(',').pop()?.trim() || 'Custom';
        const locationLabel = builderCity?.trim()
            ? formatDestinationLabel(builderCity, fallbackCountry)
            : fallbackCountry;
        addRecord('hotels', {
            id: newHotelId,
            name: normalizedName,
            location: locationLabel,
            destination: locationLabel,
            standardRate: 10000,
            deluxeRate: 13000,
            luxuryRate: 18000,
            baseRate: '10,000/night',
            description: 'Custom added hotel',
            status: 'Active',
        });
        return newHotelId;
    };

    const formatDay = (d: Date) => {
        const day = d.getDate();
        const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        return `${day}${suffix} ${month}`;
    };

    const getStayDateLabel = (idx: number) => {
        if (!formDepartureDate) return 'Set departure date';
        const stay = formHotelStays[idx];
        const nights = Math.max(1, Number(stay?.nights || 1));
        const offsetNights = formHotelStays
            .slice(0, idx)
            .reduce((sum, s) => sum + Math.max(1, Number(s.nights || 1)), 0);
        const start = new Date(formDepartureDate);
        if (Number.isNaN(start.getTime())) return 'Set departure date';
        start.setDate(start.getDate() + offsetNights);
        const end = new Date(start);
        end.setDate(end.getDate() + Math.max(0, nights - 1));
        return nights === 1 ? formatDay(start) : `${formatDay(start)} - ${formatDay(end)}`;
    };

    const getHotelRecord = (hotelId: string) =>
        (db?.hotels?.data || []).find((h: any) => h.id === hotelId);

    const syncStayNightPrices = (stay: (typeof formHotelStays)[number]) => {
        if (!stay.hotelId) return stay;
        const hotel = getHotelRecord(stay.hotelId);
        return {
            ...stay,
            nightPrices: buildNightPricesForStay(
                stay.nights,
                hotel,
                formHotelTier,
                stay.rooms || 1,
                stay.nightPrices,
                customHotelTierMultipliers
            ),
        };
    };

    const updateHotelStay = (idx: number, patch: Partial<(typeof formHotelStays)[number]>) => {
        setFormHotelStays((prev) =>
            prev.map((s, sIdx) => {
                if (sIdx !== idx) return s;
                return syncStayNightPrices({ ...s, ...patch });
            })
        );
    };

    const updateStayNightGiven = (stayIdx: number, nightIdx: number, given: number) => {
        setFormHotelStays((prev) =>
            prev.map((s, sIdx) => {
                if (sIdx !== stayIdx) return s;
                const hotel = getHotelRecord(s.hotelId);
                const prices = buildNightPricesForStay(
                    s.nights,
                    hotel,
                    formHotelTier,
                    s.rooms || 1,
                    s.nightPrices,
                    customHotelTierMultipliers
                );
                prices[nightIdx] = { ...prices[nightIdx], given: Math.max(0, given) };
                return { ...s, nightPrices: prices };
            })
        );
    };

    const updateStayNightInclusions = (
        stayIdx: number,
        nightIdx: number,
        specialInclusions: HotelSpecialInclusion[]
    ) => {
        setFormHotelStays((prev) =>
            prev.map((s, sIdx) => {
                if (sIdx !== stayIdx) return s;
                const hotel = getHotelRecord(s.hotelId);
                const prices = buildNightPricesForStay(
                    s.nights,
                    hotel,
                    formHotelTier,
                    s.rooms || 1,
                    s.nightPrices,
                    customHotelTierMultipliers
                );
                prices[nightIdx] = { ...prices[nightIdx], specialInclusions };
                return { ...s, nightPrices: prices };
            })
        );
    };

    const getStayNightRows = (stayIdx: number) => {
        const stay = formHotelStays[stayIdx];
        if (!stay) return [];
        const hotel = getHotelRecord(stay.hotelId);
        const prices = buildNightPricesForStay(
            stay.nights,
            hotel,
            formHotelTier,
            stay.rooms || 1,
            stay.nightPrices,
            customHotelTierMultipliers
        );
        const offsetNights = formHotelStays
            .slice(0, stayIdx)
            .reduce((sum, s) => sum + Math.max(1, Number(s.nights || 1)), 0);
        const baseDate = formDepartureDate ? new Date(formDepartureDate) : null;

        return prices.slice(0, Math.max(1, stay.nights)).map((np, nightIdx) => {
            let datePart = `Night ${nightIdx + 1}`;
            let day = '';
            if (baseDate && !Number.isNaN(baseDate.getTime())) {
                const d = new Date(baseDate);
                d.setDate(d.getDate() + offsetNights + nightIdx);
                const formatted = formatHotelNightDateLabel(d);
                datePart = formatted.datePart;
                day = formatted.day;
            }
            return { nightIdx, datePart, day, rate: np.rate, given: np.given };
        });
    };

    const formatInr = (amount: number) =>
        amount > 0 ? formatMoney(amount) : 'N/A';

    useEffect(() => {
        if (!isCreating) return;
        setFormHotelStays((prev) =>
            prev.map((stay) => (stay.hotelId ? syncStayNightPrices(stay) : stay))
        );
    }, [formHotelTier]);

    const livePrice = useMemo(() => {
        return calculateQuote({
            presetId: effectivePresetId,
            adults: formAdults,
            kids: formKids,
            kidsAges: parseKidsAges(formKidsAges),
            itinerary: isCreating ? formItinerary : undefined,
            flightMeal: formFlightMeal,
            hotelTier: formHotelTier,
            hotelId: formHotelId,
            hotelStays: formHotelStays,
            customHotelRate: customHotelRate || undefined,
            hotelMealPlan: formHotelMealPlan,
            needFlight: formNeedFlight,
            customFlightTotal: customFlightTotal || undefined,
            vehiclePrice: isCreating ? formVehiclePrice : undefined,
            tripMode,
        }, customPresets, db?.hotels?.data);
    }, [effectivePresetId, formAdults, formKids, formKidsAges, isCreating, formItinerary, customPresets, formFlightMeal, formHotelTier, formHotelId, formHotelStays, customHotelRate, formHotelMealPlan, formNeedFlight, customFlightTotal, formVehiclePrice, tripMode, db?.hotels?.data]);

    const hasUnsavedReviewDraft = useMemo(() => {
        if (!isCreating || editingQuoteId || builderStep !== 'review') return false;
        if (!formCustomer.trim() || !effectivePresetId || livePrice.total <= 0) return false;
        return true;
    }, [
        isCreating,
        editingQuoteId,
        builderStep,
        formCustomer,
        effectivePresetId,
        livePrice.total,
    ]);

    const formQuoteSnapshot = useMemo(
        () => ({
            presetId: effectivePresetId,
            destination: builderDestination,
            travelers:
                formKids > 0
                    ? `${formAdults} Adults, ${formKids} Kids`
                    : `${formAdults} Adults`,
            kidAges: parseKidsAges(formKidsAges),
            needFlight: formNeedFlight,
            hotelTier: formHotelTier,
            hotelStays: formHotelStays,
            itinerary: formItinerary,
            transportation: itineraryVehicleLabel || undefined,
            vehicleType: formVehicleType || undefined,
            vehiclePrice: formVehiclePrice,
            additionalActivities: normalizeAdditionalActivities(
                formAdditionalActivities.filter((row) => row.title.trim())
            ),
            additionalServiceCharge: buildAdditionalServiceChargePayload(formAdditionalServiceCharge),
            customFlightTotal: customFlightTotal || undefined,
            tripMode,
            source: tripMode === 'package' ? 'Quotation' : 'Custom Trip',
        }),
        [
            effectivePresetId,
            builderDestination,
            formAdults,
            formKids,
            formKidsAges,
            formNeedFlight,
            formHotelTier,
            formHotelStays,
            formItinerary,
            itineraryVehicleLabel,
            formVehicleType,
            formVehiclePrice,
            formAdditionalActivities,
            formAdditionalServiceCharge,
            customFlightTotal,
            tripMode,
        ]
    );

    /** Live preview while building; stored quote breakdown when viewing saved quotes. */
    const activeEstimate = useMemo(() => {
        if (!isCreating && selectedQuote) {
            return getQuotePricingDisplay(selectedQuote, db);
        }
        return getLiveQuoteEstimateDisplay(livePrice, formQuoteSnapshot, db);
    }, [isCreating, selectedQuote, db, livePrice, formQuoteSnapshot]);

    /** Quote being revised — looked up by editingQuoteId so it survives selection changes. */
    const editingParentQuote = useMemo(
        () => findQuoteById(editingQuoteId),
        [findQuoteById, editingQuoteId]
    );

    const nextEditVersion = useMemo(() => {
        if (!editingParentQuote) return null;
        const quoteLead = findLeadForQuote(editingParentQuote, leads) || editingParentQuote;
        const allRelevantQuotes = getQuotesForLeadVersioning(
            db?.quotations?.data || [],
            quoteLead,
            leads
        );
        return resolveChildQuoteVersion(editingParentQuote, allRelevantQuotes);
    }, [editingParentQuote, db?.quotations?.data, leads]);

    const availableTermsOptions = useMemo(
        () =>
            getAvailableQuoteTerms(
                db?.quoteTerms?.data || [],
                formAgentId || currentAgentId,
                userRole
            ),
        [db?.quoteTerms?.data, formAgentId, currentAgentId, userRole]
    );

    const suggestedTerms = useMemo(
        () =>
            resolveQuoteTerms(
                builderDestination,
                availableTermsOptions,
                formAgentId || currentAgentId
            ),
        [builderDestination, availableTermsOptions, formAgentId, currentAgentId]
    );

    const selectedBuilderTerms = useMemo(() => {
        if (formTermsId) {
            const found = availableTermsOptions.find((t) => t.id === formTermsId);
            if (found) return found;
        }
        if (suggestedTerms) return suggestedTerms;
        return getFallbackTermsRecord();
    }, [formTermsId, availableTermsOptions, suggestedTerms]);

    useEffect(() => {
        if (!isCreating || builderStep !== 'review') return;
        if (termsManuallySelectedRef.current) return;
        if (suggestedTerms?.id) {
            setFormTermsId(suggestedTerms.id);
        } else if (availableTermsOptions.length > 0) {
            setFormTermsId(availableTermsOptions[0].id);
        }
    }, [isCreating, builderStep, suggestedTerms?.id, availableTermsOptions]);

    useEffect(() => {
        if (!isCreating || termsManuallySelectedRef.current) return;
        if (suggestedTerms?.id && !formTermsId) {
            setFormTermsId(suggestedTerms.id);
        }
    }, [isCreating, suggestedTerms?.id, formTermsId]);

    const handleSelectQuoteTerms = (termsId: string) => {
        termsManuallySelectedRef.current = true;
        setFormTermsId(termsId);
    };

    const resolvedPreviewTerms = useMemo(() => {
        if (isCreating) {
            return selectedBuilderTerms;
        }
        return resolveTermsForQuote(editingQuote || selectedQuote);
    }, [
        isCreating,
        selectedBuilderTerms,
        editingQuote,
        selectedQuote,
        db?.quoteTerms?.data,
        currentAgentId,
        userRole,
    ]);

    // Auto-compute return date
    const computedReturnDate = useMemo(() => {
        if (!formDepartureDate) return '';
        const dep = new Date(formDepartureDate);
        dep.setDate(dep.getDate() + effectiveNights);
        return dep.toISOString().split('T')[0];
    }, [formDepartureDate, effectiveNights]);

    // AUTO-DURATION SYNC: When preset changes, rebuild itinerary
    // Skip this when loading an existing quote (isEditingExistingRef is set in handleEditMode)
    useEffect(() => {
        if (isCreating) {
            if (isEditingExistingRef.current) {
                // First run after edit-mode load — skip rebuild, clear flag for next preset change
                isEditingExistingRef.current = false;
                return;
            }

            // [FIX] Skip auto-rebuild if we are in a Negotiation/Revision flow (iterationParent)
            // This preserves the parent's customized itinerary
            if (iterationParent) return;

            const preset = allPresets.find(p => p.id === selectedPresetId);
            if (preset) {
                const nights = Math.max(1, parseDurationNights(preset.duration));
                setFormTripDurationUnit('nights');
                setFormTripDurationValue(nights);
                setFormItinerary(buildDefaultItinerary(nights + 1));
            }
        }
    }, [selectedPresetId, isCreating]);

    useEffect(() => {
        if (!selectedPresetId) return;
        const preset = allPresets.find((p) => p.id === selectedPresetId);
        if (preset?.name) setFormPresetInput(preset.name);
    }, [selectedPresetId, allPresets]);

    const parseLeadDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            // Extracts "Oct 1" from "Oct 1 - Oct 7" and assumes 2026
            const start = dateStr.split('-')[0].trim();
            const d = new Date(`${start}, 2026`);
            if (isNaN(d.getTime())) return '';
            return d.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    // When switching destination in custom mode, reset days to max of that dest
    const handleCustomDestChange = (dest: string) => {
        if (leadContext) return; // Prevent change if lead-locked
        setCustomDestination(dest);
        const match = destinations.find((d) => d.destination === dest);
        if (match?.maxDays) {
            const days = Math.max(1, match.maxDays);
            setFormTripDurationUnit('days');
            setFormTripDurationValue(days);
            syncItineraryToTripDuration(days - 1);
        }
    };

    const getShareContext = (quoteToShare: any) => {
        const allLeads = db?.leads?.data || [];
        const linkedLead = findLeadForQuote(quoteToShare, allLeads);
        const trackingId =
            quoteToShare.tripId || quoteToShare.trackingId || linkedLead?.trackingId || '-';
        return {
            linkedLead,
            trackingId,
            hotels: db?.hotels?.data || [],
            quoteTotal: getQuoteDisplayTotal(quoteToShare),
            terms: resolveTermsForQuote(quoteToShare),
        };
    };

    const handleWhatsAppShare = () => {
        const quoteToShare = editingQuote || selectedQuote;
        if (!quoteToShare) return;
        const { linkedLead, trackingId, hotels, quoteTotal, terms } = getShareContext(quoteToShare);
        const message = buildQuoteShareMessage({
            quote: quoteToShare,
            hotels,
            agencyName,
            quoteTotal,
            terms,
            trackingId,
            format: 'whatsapp',
            bankDetails: agencyBankDetails,
        });
        openWhatsAppShare(quoteToShare.phone || linkedLead?.phone || '', message);
    };

    const handleEmailShare = () => {
        const quoteToShare = editingQuote || selectedQuote;
        if (!quoteToShare) return;
        const leads = db?.leads?.data || [];
        const email = resolveCustomerEmail(quoteToShare, leads);
        if (!email) {
            alert(
                'No email address found for this customer. Please add an email on the lead record when the lead is created.'
            );
            return;
        }
        const { trackingId, hotels, quoteTotal, terms } = getShareContext(quoteToShare);
        const sender = resolveQuoteEmailSender(db, {
            quote: quoteToShare,
            userEmail: localStorage.getItem('userEmail') || '',
            currentAgentId: currentAgentId || '',
        });
        const emailParams = {
            quote: quoteToShare,
            hotels,
            agencyName: sender.fromName || agencyName,
            quoteTotal,
            terms,
            trackingId,
            presets: [...packagePresets, ...customPresets],
            fromEmail: sender.fromEmail,
            currency: currencySetting,
            bankDetails: agencyBankDetails,
        };
        const subject = buildQuoteEmailSubject(
            quoteToShare,
            sender.fromName || agencyName
        );
        setQuoteEmailSender(sender);
        setQuoteEmailDraft({
            to: email,
            subject,
            htmlBody: buildQuoteEmailHtml(emailParams),
            plainBody: buildQuoteEmailPlainText(emailParams),
            fromEmail: sender.fromEmail,
            customerName: quoteToShare.customer,
        });
    };

    const handleGenerate = (e: React.FormEvent) => {
        e.preventDefault();
    };

    const handleUpdateQuote = () => {
        if (!editingParentQuote) return;

        const parentQuote = editingParentQuote;
        // Quote issue/created date (not trip departure — that lives in departureDate)
        const dateDisplay = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        const matchingLeadForTrip =
            leadContext ||
            findLeadForQuote(parentQuote, db?.leads?.data || []) ||
            findLeadByContact(db?.leads?.data || [], {
                leadId: parentQuote.leadId,
                name: formCustomer,
                phone: `${formCountryCode} ${formPhone}`,
                email: parentQuote.email || parentQuote.customerEmail,
                tripId: formTripId || parentQuote.tripId || parentQuote.trackingId,
            });
        const tripId = ensureTripId(
            formTripId || parentQuote.tripId || matchingLeadForTrip?.trackingId,
            collectReferenceIds(db)
        );
        const hotelStaysForQuote = assignHotelBookingReferences(formHotelStays, tripId);

        const pricing = calculateQuote({
            presetId: effectivePresetId,
            adults: formAdults,
            kids: formKids,
            kidsAges: parseKidsAges(formKidsAges),
            itinerary: formItinerary,
            flightMeal: formFlightMeal,
            hotelTier: formHotelTier,
            hotelId: formHotelId,
            hotelStays: hotelStaysForQuote,
            customHotelRate: customHotelRate || undefined,
            hotelMealPlan: formHotelMealPlan,
            needFlight: formNeedFlight,
            customFlightTotal: customFlightTotal || undefined,
            vehiclePrice: formVehiclePrice,
            tripMode,
        }, customPresets, db?.hotels?.data);

        const preset = pricing.preset;
        const sourceCountryData = sourceCountries.find(c => c.name === formSourceCountry);
        const sourceFlag = sourceCountryData?.flag || '🇮🇳';
        const airportCode = formSourceAirport.split(' ')[0] || 'BOM';
        const selectedHotel = (db?.hotels?.data || []).find((h: any) => h.id === formHotelId);

        const quoteLead = matchingLeadForTrip || parentQuote;
        const allRelevantQuotes = getQuotesForLeadVersioning(
            db?.quotations?.data || [],
            quoteLead,
            db?.leads?.data || []
        );
        const newVersion = resolveChildQuoteVersion(parentQuote, allRelevantQuotes);
        const newQuoteId = getNextId('quotations', 'QT-2026');

        const additionalServiceCharge = buildAdditionalServiceChargePayload(formAdditionalServiceCharge);
        const pricingQuoteSnapshot = {
            presetId: effectivePresetId,
            destination: builderDestination || preset.destination,
            travelers: pricing.travelersLabel,
            kidAges: parseKidsAges(formKidsAges),
            needFlight: formNeedFlight,
            hotelTier: formHotelTier,
            hotelStays: hotelStaysForQuote,
            itinerary: formItinerary,
            vehiclePrice: formVehiclePrice,
            additionalActivities: normalizeAdditionalActivities(
                formAdditionalActivities.filter((row) => row.title.trim())
            ),
            additionalServiceCharge,
            customFlightTotal: customFlightTotal || undefined,
            tripMode,
            source: tripMode === 'package' ? 'Quotation' : 'Custom Trip',
        };
        const financials = resolveQuoteFinancials(pricingQuoteSnapshot, pricing, db);
        const baseItems = buildQuoteLineItems({
                pricing,
                travelerCount: formAdults + formKids || 1,
                hotelSub:
                    hotelStaysForQuote.length > 0
                        ? hotelStaysForQuote
                              .map((stay: any) => {
                                  const h = (db?.hotels?.data || []).find((row: any) => row.id === stay.hotelId);
                                  return `${stay.nights}N ${h?.name || 'Selected Hotel'}`;
                              })
                              .join(' • ')
                        : selectedHotel
                          ? `${selectedHotel.name} (${formHotelTier})`
                          : `${preset.hotelDesc} (${formHotelTier} Tier)`,
                flightDesc: preset.flightDesc,
                visaSub: 'Standard Processing Fee',
                activitiesSub: 'Package components',
                visaCost: preset.visaCost,
                formFlightMeal,
                formNeedFlight,
            });
        const items = appendServiceChargeAndGstLineItems(
            baseItems,
            financials.additionalServiceChargeAmount,
            financials.gstOnPackage || 0,
            financials.gstOnAdditional || 0
        );

        const revisedQuote = {
            customer: formCustomer,
            email: parentQuote.email || `${formCustomer.split(' ')[0].toLowerCase() || 'client'}@example.com`,
            customerEmail: parentQuote.customerEmail,
            phone: `${formCountryCode} ${formPhone}`,
            destination: builderDestination || preset.destination,
            duration: effectiveDuration,
            departureDate: formDepartureDate,
            date: dateDisplay,
            travelers: pricing.travelersLabel,
            kidAges: parseKidsAges(formKidsAges),
            presetId: effectivePresetId,
            subtotal: financials.subtotal,
            taxes: financials.taxes,
            total: financials.total,
            additionalServiceCharge,
            additionalServiceChargeAmount: financials.additionalServiceChargeAmount,
            status: formStatus,
            sourceCountry: formSourceCountry,
            sourceAirport: formSourceAirport,
            sourceCountryFlag: sourceFlag,
            sourceAirportCode: airportCode,
            agentId: formAgentId,
            agentName: formAgentName,
            itinerary: formItinerary,
            transportation: itineraryVehicleLabel || null,
            vehicleType: formVehicleType || null,
            carType: formVehicleType === 'Car' ? formCarType || null : null,
            vehicleOther: formVehicleType === 'Other' ? formVehicleOther || null : null,
            vehiclePrice: Math.max(0, Number(formVehiclePrice) || 0),
            tripId,
            trackingId: tripId,
            hotelTier: formHotelTier,
            hotelId: formHotelId,
            hotelStays: hotelStaysForQuote,
            customHotelRate: customHotelRate,
            flightMeal: formFlightMeal,
            hotelMealPlan: formHotelMealPlan,
            needFlight: formNeedFlight,
            customFlightTotal: customFlightTotal,
            quoteNotes: formQuoteNotes,
            customizationRequest: formQuoteNotes || parentQuote.customizationRequest || null,
            additionalActivities: normalizeAdditionalActivities(
                formAdditionalActivities.filter((row) => row.title.trim())
            ),
            termsId: formTermsId || parentQuote.termsId || null,
            flightDetails: {
                mealOpt: formFlightMeal.optIn,
                mealType: formFlightMeal.type,
                mealCharge: pricing.mealCharge
            },
            items,
            id: newQuoteId,
            version: newVersion,
            parentId: parentQuote.id,
            createdAt: new Date().toISOString(),
            leadId: parentQuote.leadId || matchingLeadForTrip?.id || leadContext?.id || null,
            tripMode,
            source: tripMode === 'package' ? 'Quotation' : 'Custom Trip',
            activityLog: appendQuoteActivityEntry(
                { activityLog: [] },
                {
                    type: 'revision',
                    title: `Revision created from v${normalizeQuoteVersion(parentQuote.version)}`,
                    detail: `Saved as version ${newVersion}`,
                    actor: formAgentName || parentQuote.agentName,
                }
            ),
        };

        addRecord('quotations', revisedQuote);

        updateRecord('quotations', parentQuote.id, {
            activityLog: appendQuoteActivityEntry(parentQuote, {
                type: 'revision',
                title: 'New revision saved',
                detail: `Version ${newVersion} created from edits`,
                actor: formAgentName || parentQuote.agentName,
            }),
        });

        setFormTripId(tripId);
        setFormHotelStays(hotelStaysForQuote);

        const matchingLead = leadContext || findLeadForQuote(revisedQuote, db?.leads?.data || []);
        if (matchingLead) {
            updateRecord('leads', matchingLead.id, {
                status: 'negotiation',
                budget: formatMoneyUtil(Math.round(revisedQuote.total || 0), currencySetting),
                travelers: revisedQuote.travelers,
                trackingId: tripId,
                tripId,
                ...buildLeadScheduleFromQuote(revisedQuote),
            });
        }

        setSelectedQuoteId(newQuoteId);
        setEditingQuoteId(null);
        setIsCreating(false);
        alert(`Quotation saved as v${newVersion}. The original v${normalizeQuoteVersion(parentQuote.version)} is unchanged.`);
    };

    const handleManualFinalize = () => {
        if (editingParentQuote) {
            handleUpdateQuote();
            return;
        }
        // Stale edit id (quote no longer exists) — save as a brand-new quote instead of doing nothing.
        if (editingQuoteId) setEditingQuoteId(null);

        const draft = buildCurrentQuoteOption();
        if (!draft) return;
        if (livePrice.total <= 0) {
            alert('The quote total is 0. Please complete the hotel and itinerary pricing before saving.');
            return;
        }

        const datesFormatted = draft.date || '';
        const pricing = {
            budgetFormatted: formatMoneyUtil(getQuoteDisplayTotal(draft), currencySetting),
            travelersLabel: draft.travelers,
        };

        finalizeNegotiationSet(
            [draft],
            leadContext || findLeadForQuote(draft, db?.leads?.data || []),
            pricing,
            datesFormatted,
            draft.duration,
            draft.presetId
        );
    };




    const finalizeNegotiationSet = (quotes: any[], lead: any, pricing: any, dates: string, duration: string, presetId: string) => {
        let resolvedLead = lead || leadContext || findLeadForQuote(quotes[quotes.length - 1], db?.leads?.data || []);
        const existingById = new Map<string, any>(
            (db?.quotations?.data || []).map((q: any) => [q.id, q])
        );
        const savedQuotes: any[] = [];
        const priorQuoteCount = resolvedLead?.id
            ? getQuotationsForLead(db, resolvedLead).length
            : 0;
        let createdNewVersion = false;
        let createdFirstQuote = false;

        quotes.forEach((q) => {
            let quoteToSave =
                resolvedLead?.id && !q.leadId ? { ...q, leadId: resolvedLead.id } : q;
            const existing = existingById.get(quoteToSave.id);
            if (!existing) {
                if (priorQuoteCount === 0) createdFirstQuote = true;
                quoteToSave = {
                    ...quoteToSave,
                    createdAt: quoteToSave.createdAt || new Date().toISOString(),
                };
                addRecord('quotations', quoteToSave);
                existingById.set(quoteToSave.id, quoteToSave);
                savedQuotes.push(quoteToSave);
            } else if (
                String(normalizeQuoteVersion(existing.version)) ===
                String(normalizeQuoteVersion(quoteToSave.version))
            ) {
                quoteToSave = {
                    ...quoteToSave,
                    createdAt:
                        existing.createdAt ||
                        quoteToSave.createdAt ||
                        new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                updateRecord('quotations', quoteToSave.id, quoteToSave);
                savedQuotes.push({ ...existing, ...quoteToSave });
            } else {
                createdNewVersion = true;
                const freshId = getNextId('quotations', 'QT-2026');
                quoteToSave = {
                    ...quoteToSave,
                    id: freshId,
                    createdAt: quoteToSave.createdAt || new Date().toISOString(),
                };
                addRecord('quotations', quoteToSave);
                existingById.set(freshId, quoteToSave);
                savedQuotes.push(quoteToSave);
            }
        });

        const lastQuote = savedQuotes[savedQuotes.length - 1] || quotes[quotes.length - 1];
        setSelectedQuoteId(lastQuote.id);
        setIsCreating(false);
        const latestTotal = formatMoneyUtil(Math.round(lastQuote.total || 0), currencySetting);
        const latestTravelers = lastQuote.travelers || pricing.travelersLabel;

        const nextLeadStatus = createdNewVersion
            ? 'negotiation'
            : createdFirstQuote
              ? 'itinerary'
              : resolvedLead?.status || 'new';
        const leadSchedule = buildLeadScheduleFromQuote(lastQuote);

        if (resolvedLead?.id) {
            updateRecord('leads', resolvedLead.id, {
                status: nextLeadStatus,
                budget: latestTotal,
                travelers: latestTravelers,
                trackingId: lastQuote.tripId || lastQuote.trackingId || resolvedLead.trackingId,
                tripId: lastQuote.tripId || lastQuote.trackingId || resolvedLead.tripId,
                ...leadSchedule,
            });
            resolvedLead = {
                ...resolvedLead,
                status: nextLeadStatus,
                budget: latestTotal,
                travelers: latestTravelers,
                ...leadSchedule,
            };
            setLeadContext(resolvedLead);
            setExpandedLeads((prev) => new Set([...prev, resolvedLead.id]));
            const matchingBooking = db?.bookings?.data?.find((b: any) =>
                b.quoteId === lastQuote.id ||
                b.customer === lastQuote.customer ||
                b.id === resolvedLead.bookingId
            );
            if (matchingBooking) {
                updateRecord('bookings', matchingBooking.id, {
                    total: latestTotal,
                    quoteId: lastQuote.id
                });
            }
        } else {
            const leadNums = (db?.leads?.data || []).map((l: any) => parseInt(l.id?.replace(/^LD-/, '') ?? '0')).filter((n: number) => !isNaN(n));
            const nextLeadNum = leadNums.length > 0 ? Math.max(...leadNums) + 1 : 1;
            const newLeadId = `LD-${String(nextLeadNum).padStart(3, '0')}`;
            const newLead = {
                id: newLeadId,
                name: formCustomer || lastQuote.customer,
                source: tripMode === 'package' ? 'Quotation' : 'Custom Trip',
                email: `${(formCustomer || lastQuote.customer).split(' ')[0].toLowerCase() || 'client'}@example.com`,
                phone: `${formCountryCode} ${formPhone}`,
                travelers: pricing.travelersLabel,
                destination: livePreset?.destination || lastQuote.destination,
                ...leadSchedule,
                dates: leadSchedule.dates || dates,
                duration: leadSchedule.duration || duration,
                budget: latestTotal,
                presetId: presetId,
                createdAt: new Date().toISOString(),
                status: 'itinerary',
                agentId: currentAgentId || lastQuote.agentId || null,
                agentName: currentAgent?.name || formAgentName || lastQuote.agentName || null,
                createdById:
                    resolveRecordCreatedById({
                        formAgentId,
                        userRole,
                        userEmail,
                        sessionAgentId: currentAgentId,
                        db,
                    }) ||
                    lastQuote.createdById ||
                    '',
            };
            addRecord('leads', newLead);
            resolvedLead = newLead;
            setLeadContext(newLead);
            setExpandedLeads((prev) => new Set([...prev, newLeadId]));
            quotes.forEach((q) => {
                if (!q.leadId) updateRecord('quotations', q.id, { leadId: newLeadId });
            });
        }

        const existingCustomer = db?.customers?.data?.find((c: any) => c.name === formCustomer);
        if (!existingCustomer) {
            addRecord('customers', {
                id: `CUST-00${(db?.customers?.data?.length || 0) + 1}`,
                name: formCustomer,
                email: `${formCustomer.split(' ')[0].toLowerCase() || 'client'}@example.com`,
                phone: '+91 98000 00000',
                bookings: '0'
            });
        }

        setFormDepartureDate('');
        setFormCustomer('');
        setFormAdults(2);
        setFormKids(0);
        setFormKidsAges('');
        setFormFlightMeal({ optIn: false, type: 'Veg' });
        setFormNeedFlight(false);
        setCustomFlightTotal(null);
        setCustomHotelRate(null);
        setFormHotelMealPlan('CP (Breakfast Only)');
        setFormHotelTier('Standard');
        setFormHotelInput('');
        setFormHotelStays([]);
        setFormTripId('');
        setFormVehicleType('');
        setFormCarType('');
        setFormVehicleOther('');
        setFormVehiclePrice(0);
        setHotelSelectionConfirmed(false);
        setHotelValidationAttempted(false);
        setItineraryValidationAttempted(false);
        setFormTermsId('');
        termsManuallySelectedRef.current = false;
        setFormAgentId('');
        setFormAgentName('');
        setEditingQuoteId(null);
    };

    const startNewQuotation = () => {
        setIterationParent(null);
        setLeadContext(null);
        setEditingQuoteId(null);
        setSelectedQuoteId(null);
        setFormCustomer('');
        setFormKidsAges('');
        setTripMode('custom');

        const boot = getDefaultBuilderBootstrap(allPresets);
        setSelectedPresetId(boot.presetId);
        setCustomDestination(boot.destination);
        setFormItinerary(boot.itinerary);
        const bootNights = Math.max(1, boot.itinerary.length - 1);
        setFormTripDurationUnit('nights');
        setFormTripDurationValue(bootNights);
        setBuilderCountry('');
        setBuilderCity('');
        setBuilderCountrySearch('');
        setFormHotelInput('');
        setFormHotelStays([]);
        setFormTripId('');
        setFormVehicleType('');
        setFormCarType('');
        setFormVehicleOther('');
        setFormVehiclePrice(0);
        setHotelSelectionConfirmed(false);
        setHotelValidationAttempted(false);
        setItineraryValidationAttempted(false);
        setFormQuoteNotes('');
        setFormAdditionalActivities([]);
        setFormAdditionalServiceCharge({
            enabled: false,
            percent: 0,
            fixedAmount: 0,
            gstOnPackageEnabled: false,
            gstOnAdditionalEnabled: false,
        });
        setFormTermsId('');
        termsManuallySelectedRef.current = false;
        setFormFlightMeal({ optIn: false, type: 'Veg' });
        setFormNeedFlight(false);
        setCustomFlightTotal(null);
        setBuilderStep('customer');
        setIsCreating(true);
    };

    const cancelNewQuotation = () => {
        const hasProgress =
            Boolean(editingQuoteId) ||
            builderStep !== 'customer' ||
            Boolean(formCustomer.trim());

        if (hasProgress) {
            const message = editingQuoteId
                ? 'Discard your changes and return to the quotation?'
                : 'Cancel this new quote? Any unsaved progress will be lost.';
            if (!window.confirm(message)) return;
        }

        const returnQuoteId = editingQuoteId || iterationParent?.id || null;

        setIterationParent(null);
        setEditingQuoteId(null);
        setIsCreating(false);
        setShowQuotePrintPreview(false);
        setBuilderStep('customer');
        termsManuallySelectedRef.current = false;

        if (returnQuoteId) {
            setSelectedQuoteId(returnQuoteId);
        } else if (leadContext) {
            const leadQuotes = getQuotesForLeadWorkbench(quotationsForHistory, leadContext, null, leads);
            if (leadQuotes.length > 0) {
                setSelectedQuoteId(leadQuotes[leadQuotes.length - 1].id);
            } else {
                setLeadContext(null);
                setSelectedQuoteId(null);
            }
        } else {
            setLeadContext(null);
            setSelectedQuoteId(null);
        }
    };

    const closeQuotePreview = () => {
        setShowQuotePrintPreview(false);
    };

    const handleQuotePdfDownload = useCallback(async () => {
        const el = quotePrintRef.current;
        if (!el || isQuotePdfDownloading) return;

        const quote = editingQuote || selectedQuote;
        if (!quote) return;

        const safeName = String(quote.customer || 'itinerary').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
        const safeDest = String(quote.destination || 'trip').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
        const filename = `Quote-${safeName || 'itinerary'}-${safeDest || 'trip'}.pdf`;

        setIsQuotePdfDownloading(true);
        try {
            await downloadElementAsMultiPagePdf(el, filename, {
                backgroundColor: '#ffffff',
                marginMm: 8,
            });
        } catch (error) {
            console.error('Quote PDF download failed:', error);
        } finally {
            setIsQuotePdfDownloading(false);
        }
    }, [editingQuote, selectedQuote, isQuotePdfDownloading]);

    const openLeadQuoteView = (quoteId: string, lead?: any) => {
        setSidebarAccordionOpen(false);
        setIsCreating(false);
        setSelectedQuoteId(quoteId);
        setEditingQuoteId(null);
        if (lead) setLeadContext(lead);
        setLeadWorkbenchTab('quotes');
        setShowQuotePrintPreview(false);
    };

    useEffect(() => {
        const quoteId = searchParams.get('highlightQuoteId');
        const focusTs = searchParams.get('focusTs');
        if (!quoteId || !focusTs) return;

        const quote = (db?.quotations?.data || []).find((q: any) => q.id === quoteId);
        if (!quote) return;

        const lead = findLeadForQuote(quote, leads);
        const groupKey = getQuoteLeadGroupKey(quote, leads);
        setExpandedLeads((prev) => new Set([...prev, groupKey]));
        setIsCreating(false);
        setSelectedQuoteId(quoteId);
        setEditingQuoteId(null);
        if (lead) setLeadContext(lead);
        setLeadWorkbenchTab('quotes');
        setShowQuotePrintPreview(false);
        setHighlightedQuoteId(quoteId);

        const scrollTimer = window.setTimeout(() => {
            const el = document.querySelector(`[data-quote-id="${quoteId}"]`) as HTMLElement | null;
            el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }, 220);

        const clearTimer = window.setTimeout(() => {
            setHighlightedQuoteId('');
        }, 3200);

        return () => {
            clearTimeout(scrollTimer);
            clearTimeout(clearTimer);
        };
    }, [searchParams, db?.quotations?.data, leads]);

    const handleDeleteQuote = (quote: any, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!quote?.id) return;

        const versionLabel = formatQuoteVersionLabel(quote.version);
        const customer = quote.customer || 'this client';
        const linkedLead = findLeadForQuote(quote, leads);
        const isConfirmed = linkedLead?.confirmedQuoteId === quote.id;

        let message = `Delete quotation v${versionLabel} for ${customer}? This cannot be undone.`;
        if (isConfirmed) {
            message +=
                '\n\nThis quote is marked as confirmed on the lead — that confirmation will be cleared.';
        }

        if (!window.confirm(message)) return;

        const remainingForLead = (db?.quotations?.data || [])
            .filter((q: any) => q.id !== quote.id)
            .filter((q: any) => {
                if (linkedLead?.id) {
                    return q.leadId === linkedLead.id || q.customer === linkedLead.name;
                }
                return q.customer === quote.customer;
            });

        if (linkedLead?.id && linkedLead.confirmedQuoteId === quote.id) {
            updateRecord('leads', linkedLead.id, { confirmedQuoteId: '' });
        }

        (db?.bookings?.data || [])
            .filter((b: any) => b.quoteId === quote.id)
            .forEach((booking: any) => {
                updateRecord('bookings', booking.id, { quoteId: '' });
            });

        deleteRecord('quotations', quote.id);

        if (selectedQuoteId === quote.id || editingQuoteId === quote.id) {
            const nextQuote = [...remainingForLead].sort((a, b) =>
                compareQuoteVersions(b.version, a.version)
            )[0];
            if (nextQuote) {
                openLeadQuoteView(nextQuote.id, linkedLead || undefined);
            } else {
                setSelectedQuoteId(null);
                setEditingQuoteId(null);
                setEditingQuote(null);
                setIsCreating(false);
                setShowQuotePrintPreview(false);
            }
        }
    };

    const prefillLeadForNewQuote = (lead: any, referenceQuote?: any) => {
        // New quote = next major version (v2, v3…). Revisions use iterationParent via Create Iteration / Edit.
        setIterationParent(null);
        setEditingQuoteId(null);
        setEditingQuote(null);
        setSelectedQuoteId(null);
        setFormCustomer(lead.name);
        setLeadContext(lead);
        const destBoot = applyLeadDestinationToBuilder(lead, referenceQuote);
        if (lead.trackingId || lead.tripId) {
            setFormTripId(lead.trackingId || lead.tripId);
        }
        const presetToUse = destBoot.matchedPreset;
        const presetDays = presetToUse?.duration ? parseDurationNights(presetToUse.duration) + 1 : 1;
        if (referenceQuote?.itinerary?.length) {
            setFormItinerary(normalizeItinerary(referenceQuote.itinerary, referenceQuote.itinerary.length));
            const parentNights = Math.max(1, referenceQuote.itinerary.length - 1);
            setFormTripDurationUnit('nights');
            setFormTripDurationValue(parentNights);
        } else {
            const leadNights = lead.duration
                ? Math.max(1, parseDurationNights(lead.duration))
                : Math.max(1, presetDays - 1);
            setFormTripDurationUnit('nights');
            setFormTripDurationValue(leadNights);
            setFormItinerary(buildDefaultItinerary(leadNights + 1));
        }
        if (lead.startDate) {
            setFormDepartureDate(lead.startDate);
        } else {
            const depDate = parseLeadDate(lead.dates);
            if (depDate) setFormDepartureDate(depDate);
        }
        const { adults, kids } = parseTravelers(lead.travelers);
        setFormAdults(adults);
        setFormKids(kids);
        setFormKidsAges(Array.isArray(lead.kidAges) ? lead.kidAges.join(', ') : '');
        if (lead.sourceCountry) {
            const sourceFromLead = applySourceCountryAirport(lead.sourceCountry, lead.sourceAirport);
            setFormSourceCountry(sourceFromLead.country);
            setFormSourceAirport(sourceFromLead.airport);
        }
        if (lead.phone) {
            const matchedCode = COUNTRY_PHONE_DATA.find((c) => lead.phone.startsWith(c.code));
            if (matchedCode) {
                setFormCountryCode(matchedCode.code);
                setFormPhone(lead.phone.slice(matchedCode.code.length).trim());
            } else {
                setFormCountryCode('+91');
                setFormPhone(String(lead.phone).replace(/^\+\d+\s?/, ''));
            }
        }
        if (lead.agentId) {
            setFormAgentId(lead.agentId);
            setFormAgentName(lead.agentName);
        }
        setFormFlightMeal({ optIn: false, type: 'Veg' });
        setFormNeedFlight(false);
        setCustomFlightTotal(null);
        if (lead.hotelMealPlan) setFormHotelMealPlan(lead.hotelMealPlan);
        if (lead.hotelTier) setFormHotelTier(lead.hotelTier);
        if (referenceQuote?.termsId) {
            setFormTermsId(referenceQuote.termsId);
            termsManuallySelectedRef.current = true;
        } else {
            setFormTermsId('');
            termsManuallySelectedRef.current = false;
        }
        setFormHotelStays([]);
        setHotelSelectionConfirmed(false);
        setTripMode('custom');
        setBuilderStep('customer');
        setIsCreating(true);
        setShowQuotePrintPreview(false);
    };

    useEffect(() => {
        const leadId = searchParams.get('leadId');
        const createQuote = searchParams.get('createQuote');
        const selectQuote = searchParams.get('selectQuote');
        if (!leadId || (createQuote !== 'true' && selectQuote !== 'true')) return;

        const lead = (db?.leads?.data || []).find((l: any) => l.id === leadId);
        if (!lead) return;

        setSearchParams({}, { replace: true });

        if (createQuote === 'true') {
            prefillLeadForNewQuote(lead);
            return;
        }

        setLeadContext(lead);
        setExpandedLeads((prev) => new Set([...prev, lead.id]));
        const leadQuotes = getQuotesForLeadWorkbench(quotationsForHistory, lead, null, leads);
        const latestQuote = [...leadQuotes].sort((a, b) =>
            compareQuoteVersions(b.version, a.version)
        )[0];
        if (latestQuote) {
            openLeadQuoteView(latestQuote.id, lead);
        } else {
            prefillLeadForNewQuote(lead);
        }
    }, [searchParams, db?.leads?.data, quotationsForHistory, leads]);

    const handleConvertQuote = (quote: any) => {
        if (!workbenchLead) return;
        if (
            !window.confirm(
                `Confirm proposal v${quote.version} for ${workbenchLead.name}? This will mark the lead as confirmed.`
            )
        ) {
            return;
        }
        const leadPatch = {
            status: 'confirmed',
            confirmedQuoteId: quote.id,
            travelers: quote.travelers || workbenchLead.travelers,
            ...buildLeadScheduleFromQuote(quote),
        };
        updateRecord('leads', workbenchLead.id, leadPatch);
        setLeadContext((prev: any) =>
            prev?.id === workbenchLead.id ? { ...prev, ...leadPatch } : { ...workbenchLead, ...leadPatch }
        );
        updateRecord('quotations', quote.id, {
            status: 'confirmed',
            leadId: workbenchLead.id,
            activityLog: appendQuoteActivityEntry(quote, {
                type: 'booking',
                title: 'Booking confirmed from quote',
                detail: `Quote v${quote.version} converted`,
                actor: quote.agentName,
            }),
        });
        syncConfirmedLeadBookingStatus(
            db,
            updateRecord,
            {
                ...workbenchLead,
                ...leadPatch,
            },
            quote.id,
            addRecord,
            getNextId
        );
        alert('Quote confirmed and linked to the lead.');
    };

    return (
        <div className="flex flex-col 2xl:flex-row flex-1 min-h-0 h-full gap-4 md:gap-6 overflow-y-auto 2xl:overflow-hidden">

            {/* Sidebar – accordion on laptop/tablet/mobile; always open on wide desktops */}
            <div className="flex w-full 2xl:w-80 flex-col bg-white rounded-2xl border border-slate-200 shadow-sm shrink-0 overflow-hidden print:hidden 2xl:h-full min-h-0">
                <button
                    type="button"
                    onClick={() => setSidebarAccordionOpen((open) => !open)}
                    aria-expanded={sidebarAccordionOpen}
                    className="2xl:hidden flex items-center justify-between gap-3 px-4 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white text-left w-full hover:bg-slate-50/80 transition-colors"
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-crm-100 text-crm-600 shrink-0">
                            <Filter size={14} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                                Filters &amp; Quotation History
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                                {historyLeadGroups.length} client{historyLeadGroups.length === 1 ? '' : 's'}
                                {(priorityDeskNewLeads.length > 0 || priorityDeskActiveLeads.length > 0)
                                    ? ` · ${priorityDeskNewLeads.length + priorityDeskActiveLeads.length} in priority desk`
                                    : ''}
                                {(dateFilterStart || dateFilterEnd || agentFilter !== 'all' || statusFilter !== 'all')
                                    ? ' · Filters active'
                                    : ''}
                            </p>
                        </div>
                    </div>
                    <DropdownChevron open={sidebarAccordionOpen} size={16} className="text-slate-400" />
                </button>

                <div
                    className={`flex-1 min-h-0 ${
                        sidebarAccordionOpen
                            ? 'max-2xl:block max-2xl:max-h-[min(70vh,600px)]'
                            : 'max-2xl:hidden'
                    } 2xl:block 2xl:max-h-none`}
                >
                <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0 h-full custom-scrollbar">
                    {/* Date Range Filter – redesigned */}
                    <div className="space-y-2 mb-3">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Range</h3>
                        <p className="text-[9px] text-slate-400 px-0.5">Filter by when the quote was created</p>
                        <div className="relative flex items-center gap-2">
                            <input type="date" value={dateFilterStart} onChange={e => setDateFilterStart(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs" />
                            <input type="date" value={dateFilterEnd} onChange={e => setDateFilterEnd(e.target.value)} min={dateFilterStart || undefined} className="flex-1 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs" />
                        </div>
                        {(dateFilterStart || dateFilterEnd) && (
                            <button
                                type="button"
                                onClick={clearDateFilters}
                                className="w-full py-1.5 text-[10px] font-bold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition-colors"
                            >
                                Clear date range
                            </button>
                        )}
                    </div>
                    {/* Agent Filter - Only for Admin/Agents */}
                    {userRole !== 'staff' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agent Portfolio</h3>
                                <Filter size={12} className="text-slate-300" />
                            </div>
                            <div className="relative crm-select-wrap">
                            <select
                                value={agentFilter}
                                onChange={(e) => setAgentFilter(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-9 text-xs font-bold text-slate-700 outline-none focus:border-crm-500 shadow-sm appearance-none cursor-pointer"
                            >
                                {userRole === 'admin' ? (
                                    <>
                                        <option value="all">All Active Agents</option>
                                        {portfolioAdminAgentOptions.map((agt: any) => (
                                            <option key={agt.id} value={agt.id}>{agt.name}</option>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <option value="all">All Team Members</option>
                                        <option value={currentAgentId || ''}>{currentAgent?.name || 'Me'} (You)</option>
                                        {portfolioStaffOptions.map((s: any) => (
                                            <option key={s.employeeId} value={s.employeeId}>Staff: {s.name}</option>
                                        ))}
                                        {portfolioSubAgentOptions.map((a: any) => (
                                            <option key={a.id} value={a.id}>Sub-Agent: {a.name}</option>
                                        ))}
                                    </>
                                )}
                            </select>
                            <DropdownChevron size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    )}

                    {/* Status Filter */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lead Status</h3>
                            <Filter size={12} className="text-slate-300" />
                        </div>
                        <div className="relative crm-select-wrap">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-9 text-xs font-bold text-slate-700 outline-none focus:border-crm-500 shadow-sm appearance-none cursor-pointer"
                        >
                            <option value="all">All Lead Statuses</option>
                            <option value="new">New Leads</option>
                            <option value="contacted">Contacted</option>
                            <option value="itinerary">Itinerary Sent</option>
                            <option value="negotiation">Negotiation</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                        </select>
                        <DropdownChevron size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* PRIORITY DESK - Actionable Requests */}
                    {(priorityDeskNewLeads.length > 0 || priorityDeskActiveLeads.length > 0) && (
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Priority Desk</h3>

                            {/* New/Contacted Leads - Pending first quote */}
                            {visiblePriorityDeskNewLeads.map((lead: any) => (
                                    <div key={lead.id} className="p-3 rounded-xl border border-blue-100 bg-blue-50/30">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-bold text-slate-800 text-xs">{lead.name}</div>
                                                {lead.trackingId && (
                                                    <div className="text-[9px] text-slate-400 font-semibold mt-0.5">ID {lead.trackingId}</div>
                                                )}
                                                {lead.email && (
                                                    <div className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate max-w-[160px] 2xl:max-w-[160px] max-2xl:max-w-full">{lead.email}</div>
                                                )}
                                            </div>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${lead.status === 'new' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {lead.status === 'new' ? 'New Lead' : 'Contacted'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mb-3 whitespace-nowrap overflow-hidden text-ellipsis">Destination: {lead.destination}</p>
                                        <button
                                            onClick={() => {
                                                setIterationParent(null);
                                                setEditingQuoteId(null);
                                                setEditingQuote(null);
                                                setFormCustomer(lead.name);
                                                setLeadContext(lead);
                                                if (lead.trackingId || lead.tripId) {
                                                    setFormTripId(lead.trackingId || lead.tripId);
                                                }

                                                const destBoot = applyLeadDestinationToBuilder(lead);
                                                const presetDays = destBoot.matchedPreset?.duration
                                                    ? parseDurationNights(destBoot.matchedPreset.duration) + 1
                                                    : 1;
                                                setFormItinerary(buildDefaultItinerary(presetDays));

                                                // PRIORITIZE ISO START DATE
                                                if (lead.startDate) {
                                                    setFormDepartureDate(lead.startDate);
                                                } else {
                                                    const depDate = parseLeadDate(lead.dates);
                                                    if (depDate) setFormDepartureDate(depDate);
                                                }

                                                const { adults, kids } = parseTravelers(lead.travelers);
                                                setFormAdults(adults);
                                                setFormKids(kids);
                                                setFormKidsAges(Array.isArray(lead.kidAges) ? lead.kidAges.join(', ') : '');

                                                if (lead.sourceCountry) setFormSourceCountry(lead.sourceCountry);
                                                if (lead.sourceAirport) setFormSourceAirport(lead.sourceAirport);
                                                if (lead.phone) {
                                                    const matchedCode = COUNTRY_PHONE_DATA.find(c => lead.phone.startsWith(c.code));
                                                    if (matchedCode) {
                                                        setFormCountryCode(matchedCode.code);
                                                        setFormPhone(lead.phone.slice(matchedCode.code.length).trim());
                                                    } else {
                                                        setFormCountryCode('+91');
                                                        setFormPhone(String(lead.phone).replace(/^\+\d+\s?/, ''));
                                                    }
                                                }

                                                // INHERIT AGENT
                                                if (lead.agentId) {
                                                    setFormAgentId(lead.agentId);
                                                    setFormAgentName(lead.agentName);
                                                }

                                                // INHERIT LOGISTICS (flight defaults to No for new quotes)
                                                setFormFlightMeal({ optIn: false, type: 'Veg' });
                                                setFormNeedFlight(false);
                                                setCustomFlightTotal(null);
                                                if (lead.hotelMealPlan) setFormHotelMealPlan(lead.hotelMealPlan);
                                                if (lead.hotelTier) setFormHotelTier(lead.hotelTier);
                                                setFormHotelId('');
                                                setFormHotelInput('');
                                                setFormHotelStays([]);
                                                setHotelSelectionConfirmed(false);
                                                if (lead.customHotelRate) setCustomHotelRate(lead.customHotelRate);

                                                setSidebarAccordionOpen(false);
                                                setIsCreating(true);
                                                setSelectedQuoteId(null);
                                            }}
                                            className="w-full py-1.5 bg-white border border-blue-200 text-blue-700 text-[10px] font-bold rounded-lg hover:bg-blue-100 transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <Plus size={14} /> Create First Proposal
                                        </button>
                                    </div>
                                ))}

                            {/* Negotiation/Itinerary - Adjustment Requests */}
                            {visiblePriorityDeskActiveLeads.map((lead: any) => {
                                    const latestQuote = getLatestQuoteForLead(
                                        quotationsForHistory,
                                        lead,
                                        leads
                                    );
                                    const leadQuotesForIteration = quotationsForHistory.filter((q: any) =>
                                        quoteBelongsToLead(q, lead, leads)
                                    );
                                    const nextIterationVersion = latestQuote
                                        ? resolveChildQuoteVersion(latestQuote, leadQuotesForIteration)
                                        : '1';

                                    return (
                                        <div key={lead.id} className="p-3 rounded-xl border border-purple-100 bg-purple-50/30">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-xs">{lead.name}</div>
                                                    {lead.trackingId && (
                                                        <div className="text-[9px] text-slate-400 font-semibold mt-0.5">ID {lead.trackingId}</div>
                                                    )}
                                                    {lead.email && (
                                                        <div className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate max-w-[160px] 2xl:max-w-[160px] max-2xl:max-w-full">{lead.email}</div>
                                                    )}
                                                </div>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                    lead.status === 'itinerary'
                                                        ? 'bg-indigo-100 text-indigo-700'
                                                        : lead.status === 'confirmed'
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {lead.status === 'itinerary'
                                                        ? 'Sent'
                                                        : lead.status === 'confirmed'
                                                            ? `Confirmed v${latestQuote?.version || '1'}`
                                                            : `Req v${latestQuote?.version || '1'}`}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                                                Destination: {latestQuote?.destination || lead.destination}
                                            </p>
                                            <p className="text-[11px] text-slate-600 line-clamp-2 italic mb-3">"{latestQuote?.customizationRequest || (lead.status === 'itinerary' ? 'Proposal sent, awaiting feedback' : lead.status === 'confirmed' ? 'Manage proposals and iterations' : 'Reviewing options...')}"</p>
                                            <button
                                                onClick={() => {
                                                    setIterationParent(latestQuote);
                                                    setEditingQuoteId(null);
                                                    setEditingQuote(null);
                                                    setFormCustomer(lead.name);
                                                    setLeadContext(lead);
                                                    setFormTripId(
                                                        latestQuote?.tripId ||
                                                            latestQuote?.trackingId ||
                                                            lead.trackingId ||
                                                            lead.tripId ||
                                                            ''
                                                    );
                                                    if (Array.isArray(latestQuote?.hotelStays) && latestQuote.hotelStays.length > 0) {
                                                        setHotelSelectionConfirmed(true);
                                                    }

                                                    applyLeadDestinationToBuilder(lead, latestQuote);

                                                    // PRIORITIZE DATES from Parent, then Lead ISO, then Lead String
                                                    if (latestQuote?.departureDate) {
                                                        setFormDepartureDate(latestQuote.departureDate);
                                                    } else if (lead.startDate) {
                                                        setFormDepartureDate(lead.startDate);
                                                    } else if (lead.dates) {
                                                        const depDate = parseLeadDate(lead.dates);
                                                        if (depDate) setFormDepartureDate(depDate);
                                                    }

                                                    // INHERIT LOGISTICS FROM LEAD OR PARENT QUOTE
                                                    if (lead.agentId) {
                                                        setFormAgentId(lead.agentId);
                                                        setFormAgentName(lead.agentName);
                                                    } else if (latestQuote?.agentId) {
                                                        setFormAgentId(latestQuote.agentId);
                                                        setFormAgentName(latestQuote.agentName);
                                                    }

                                                    setFormFlightMeal({ optIn: false, type: 'Veg' });
                                                    setFormNeedFlight(false);
                                                    setCustomFlightTotal(null);
                                                    const iterationSource = applySourceCountryAirport(
                                                        lead.sourceCountry || latestQuote?.sourceCountry || 'India',
                                                        lead.sourceAirport || latestQuote?.sourceAirport
                                                    );
                                                    setFormSourceCountry(iterationSource.country);
                                                    setFormSourceAirport(iterationSource.airport);
                                                    if (lead.hotelMealPlan) setFormHotelMealPlan(lead.hotelMealPlan);
                                                    else if (latestQuote?.hotelMealPlan) setFormHotelMealPlan(latestQuote.hotelMealPlan);

                                                    if (latestQuote?.hotelTier) setFormHotelTier(latestQuote.hotelTier);
                                                    else if (lead.hotelTier) setFormHotelTier(lead.hotelTier);

                                                    if (Array.isArray(latestQuote?.hotelStays) && latestQuote.hotelStays.length > 0) {
                                                        setFormHotelStays(
                                                            latestQuote.hotelStays
                                                                .filter((s: any) => s?.hotelId && Number(s.nights) > 0)
                                                                .map((s: any) => {
                                                                    const hotel = (db?.hotels?.data || []).find((h: any) => h.id === s.hotelId);
                                                                    return {
                                                                        hotelId: s.hotelId,
                                                                        nights: Number(s.nights),
                                                                        hotelInput: hotel?.name || '',
                                                                        city: s.city || builderCity || '',
                                                                        roomType: s.roomType || '',
                                                                        rooms: Number(s.rooms || 1),
                                                                        personsPerRoom: Number(s.personsPerRoom || 2),
                                                                        extraBed: Number(s.extraBed || 0),
                                                                        extraBedPrice: Number(s.extraBedPrice || 0),
                                                                        childWithBed: Number(s.childWithBed || 0),
                                                                        childWithBedPrice: Number(s.childWithBedPrice || 0),
                                                                        childWithoutBed: Number(s.childWithoutBed || 0),
                                                                        childWithoutBedPrice: Number(s.childWithoutBedPrice || 0),
                                                                        mealPlan: s.mealPlan || '',
                                                                    };
                                                                })
                                                        );
                                                        setFormHotelId(latestQuote.hotelStays[0]?.hotelId || latestQuote.hotelId || '');
                                                        const rootHotel = (db?.hotels?.data || []).find((h: any) => h.id === (latestQuote.hotelStays[0]?.hotelId || latestQuote.hotelId || ''));
                                                        setFormHotelInput(rootHotel?.name || '');
                                                    } else if (latestQuote?.hotelId) {
                                                        setFormHotelId(latestQuote.hotelId);
                                                        const quoteNights = parseDurationNights(latestQuote.duration);
                                                        const quoteHotel = (db?.hotels?.data || []).find((h: any) => h.id === latestQuote.hotelId);
                                                        setFormHotelInput(quoteHotel?.name || '');
                                                        setFormHotelStays([{
                                                            hotelId: latestQuote.hotelId,
                                                            nights: quoteNights,
                                                            hotelInput: quoteHotel?.name || '',
                                                            city: builderCity || '',
                                                            roomType: '',
                                                            rooms: 1,
                                                            personsPerRoom: 2,
                                                            extraBed: 0,
                                                            extraBedPrice: 0,
                                                            childWithBed: 0,
                                                            childWithBedPrice: 0,
                                                            childWithoutBed: 0,
                                                            childWithoutBedPrice: 0,
                                                            mealPlan: latestQuote.hotelMealPlan || '',
                                                        }]);
                                                    } else {
                                                        setFormHotelId('');
                                                        setFormHotelInput('');
                                                        setFormHotelStays([]);
                                                        setHotelSelectionConfirmed(false);
                                                    }

                                                    if (latestQuote?.customHotelRate) setCustomHotelRate(latestQuote.customHotelRate);
                                                    if (latestQuote?.customFlightTotal) setCustomFlightTotal(latestQuote.customFlightTotal);
                                                    else if (lead.customFlightTotal) setCustomFlightTotal(lead.customFlightTotal);
                                                    else setCustomFlightTotal(null);

                                                    const { adults, kids } = parseTravelers(lead.travelers || latestQuote?.travelers);
                                                    setFormAdults(adults);
                                                    setFormKids(kids);
                                                    setFormKidsAges(
                                                        Array.isArray(latestQuote?.kidAges)
                                                            ? latestQuote.kidAges.join(', ')
                                                            : Array.isArray(lead.kidAges)
                                                              ? lead.kidAges.join(', ')
                                                              : ''
                                                    );

                                                    // Carry forward contact number from lead (fallback to latest quote)
                                                    const mobileSource = lead.phone || latestQuote?.phone || '';
                                                    if (mobileSource) {
                                                        const matchedCode = COUNTRY_PHONE_DATA.find(c => mobileSource.startsWith(c.code));
                                                        if (matchedCode) {
                                                            setFormCountryCode(matchedCode.code);
                                                            setFormPhone(mobileSource.slice(matchedCode.code.length).trim());
                                                        } else {
                                                            setFormCountryCode('+91');
                                                            setFormPhone(String(mobileSource).replace(/^\+\d+\s?/, ''));
                                                        }
                                                    }

                                                    // Pre-fill itinerary from parent for seamless negotiation
                                                    const presetFromParent =
                                                        (latestQuote?.presetId && allPresets.find(p => p.id === latestQuote.presetId)) ||
                                                        allPresets.find(p => {
                                                            const dest = String(latestQuote?.destination || lead.destination || '').toLowerCase();
                                                            const presetDest = String(p.destination || '').toLowerCase();
                                                            return !!dest && (presetDest === dest || presetDest.includes(dest) || dest.includes(presetDest));
                                                        });

                                                    const parentDesiredDays =
                                                        getDurationDays(latestQuote?.duration) ||
                                                        (presetFromParent?.duration ? parseDurationNights(presetFromParent.duration) + 1 : 1);

                                                    setFormItinerary(normalizeItinerary(latestQuote?.itinerary, parentDesiredDays));

                                                    setSidebarAccordionOpen(false);
                                                    setIsCreating(true);
                                                    setSelectedQuoteId(null);
                                                }}
                                                className="w-full py-1.5 bg-white border border-purple-200 text-purple-700 text-[10px] font-bold rounded-lg hover:bg-purple-100 transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Plus size={14} /> Create Iteration v{nextIterationVersion}
                                            </button>
                                        </div>
                                    );
                                })}
                            <SidebarListControls
                                total={priorityDeskTotalCount}
                                visibleCount={priorityDeskVisibleCount}
                                onShowMore={showMorePriorityDesk}
                                onShowLess={showLessPriorityDesk}
                            />
                        </div>
                    )}

                    <div className="space-y-3 pt-2">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Quotation History</h3>

                        {visibleHistoryLeadGroups.map((group: any) => {
                                const groupQuotes = expandQuoteVersionFamily(group.quotes, quotationsForHistory);
                                const latestQuote = [...groupQuotes].sort((a, b) =>
                                    compareQuoteVersions(b.version, a.version)
                                )[0];
                                const groupKey = group.groupKey || getQuoteLeadGroupKey(latestQuote, leads);
                                const isExpanded = expandedLeads.has(groupKey);

                                // RENDER MINI-TREE FOR SIDEBAR
                                const buildQuoteTree = (flatQuotes: any[]) => {
                                    const quoteMap: { [key: string]: any } = {};
                                    const roots: any[] = [];
                                    const uniqueQuotes = Array.from(new Map(flatQuotes.map(q => [q.id, q])).values());
                                    uniqueQuotes.forEach(q => { quoteMap[q.id] = { ...q, children: [] }; });
                                    uniqueQuotes.forEach(q => {
                                        if (q.parentId && quoteMap[q.parentId]) quoteMap[q.parentId].children.push(quoteMap[q.id]);
                                        else roots.push(quoteMap[q.id]);
                                    });

                                    const sortFn = (a: any, b: any) => compareQuoteVersions(a.version, b.version);
                                    const sortDeep = (nodes: any[]) => {
                                        nodes.sort(sortFn);
                                        nodes.forEach(n => { if (n.children?.length > 0) sortDeep(n.children); });
                                    };
                                    sortDeep(roots);
                                    return roots;
                                };

                                const quoteTree = buildQuoteTree(groupQuotes);

                                const renderMiniNode = (node: any, depth = 0) => {
                                    const isSelected = selectedQuoteId === node.id && !isCreating;
                                    return (
                                        <div key={node.id} className="relative">
                                            {depth > 0 && (
                                                <div
                                                    className="absolute left-[-10px] top-[-15px] w-[10px] h-[30px] border-l border-b border-slate-200 rounded-bl-lg"
                                                    style={{ left: `-${12}px` }}
                                                />
                                            )}
                                            <div
                                                data-quote-id={node.id}
                                                onClick={(e) => { e.stopPropagation(); openLeadQuoteView(node.id, group.lead); }}
                                                style={{ marginLeft: `${depth * 16}px` }}
                                                className={`mb-2 p-2 rounded-lg cursor-pointer border transition-all text-[10px] font-bold ${
                                                    isSelected
                                                        ? 'bg-crm-600 text-white border-crm-600'
                                                        : highlightedQuoteId === node.id
                                                          ? 'bg-amber-50 border-amber-400 text-slate-700 ring-2 ring-amber-300'
                                                          : 'bg-white border-slate-100 hover:border-crm-300 text-slate-500'
                                                }`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span>V{formatQuoteVersionLabel(node.version)}</span>
                                                    <div className="flex items-center gap-1.5">
                                                        {agentFilter === 'all' && node.agentName && (
                                                            <span className="text-[8px] bg-white/20 px-1 rounded uppercase">{node.agentName.split(' ')[0]}</span>
                                                        )}
                                                        <span>{formatMoney(getQuoteDisplayTotal(node))}</span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDeleteQuote(node, e)}
                                                            className={`p-0.5 rounded transition-colors ${
                                                                isSelected
                                                                    ? 'text-white/70 hover:text-white hover:bg-white/20'
                                                                    : 'text-slate-300 hover:text-red-600 hover:bg-red-50'
                                                            }`}
                                                            title="Delete quotation"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            {node.children.map((child: any) => renderMiniNode(child, depth + 1))}
                                        </div>
                                    );
                                };

                                return (
                                    <div
                                        key={groupKey}
                                        className={`p-1 rounded-2xl border transition-all ${isExpanded ? 'border-slate-200 bg-slate-50/50' : 'border-transparent hover:bg-slate-50'}`}
                                    >
                                        <div
                                            onClick={() => toggleLead(groupKey)}
                                            className={`p-3 rounded-xl cursor-pointer transition-all ${isExpanded ? 'bg-white shadow-sm border border-slate-100' : ''}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex flex-col">
                                                    <h4 className="font-bold text-slate-800 text-sm truncate max-w-[140px] 2xl:max-w-[140px] max-2xl:max-w-full">{group.lead.name}</h4>
                                                    {(group.lead.trackingId || group.lead.email) && (
                                                        <span className="text-[9px] text-slate-400 font-semibold truncate max-w-[180px] 2xl:max-w-[180px] max-2xl:max-w-full">
                                                            {[group.lead.trackingId && `ID ${group.lead.trackingId}`, group.lead.email]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                        </span>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-crm-600 bg-crm-50 px-1.5 py-0.5 rounded uppercase">v{latestQuote.version}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 capitalize">{group.quotes.length} Iterations</span>
                                                    </div>
                                                </div>
                                                <div className={`p-1 rounded-md transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-slate-100 text-slate-600' : 'text-slate-300'}`}>
                                                    <DropdownChevron size={14} />
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                                <MapPin size={10} /> {latestQuote.destination}
                                            </p>
                                        </div>

                                        {isExpanded && (
                                            <div className="px-4 py-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                                                <div className="space-y-1">
                                                    {quoteTree.map((root: any) => renderMiniNode(root))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        <SidebarListControls
                            total={historyLeadGroups.length}
                            visibleCount={historyVisibleCount}
                            onShowMore={showMoreHistory}
                            onShowLess={showLessHistory}
                        />
                    </div>
                    {quotationsForHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm">
                            <FileText size={24} className="text-slate-200 mb-2" />
                            No quotations yet
                        </div>
                    ) : historyLeadGroups.length === 0 && (dateFilterStart || dateFilterEnd || agentFilter !== 'all' || statusFilter !== 'all') ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm text-center px-4">
                            <FileText size={24} className="text-slate-200 mb-2" />
                            No quotations match the selected filters
                        </div>
                    ) : null}
                </div>
                </div>
            </div>

            {/* Main workbench – full height below accordion on smaller screens; beside sidebar on wide desktops */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

                {!isCreating && !selectedQuote && selectedQuoteId && (
                    <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 text-center">
                        <FileText size={40} className="text-slate-200 mb-4" />
                        <p className="text-sm font-bold text-slate-600">Loading quotation…</p>
                    </div>
                )}

                {!isCreating && !selectedQuoteId && (
                    <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
                        <FileText size={48} className="text-slate-200 mb-4" />
                        <p className="text-sm font-bold text-slate-600 mb-1">No quotation open</p>
                        <p className="text-xs text-slate-400 mb-6">Pick a client from Quotation History or start a new package.</p>
                        <button
                            type="button"
                            onClick={startNewQuotation}
                            className="px-6 py-2.5 bg-crm-600 text-white text-sm font-bold rounded-xl hover:bg-crm-700"
                        >
                            New Quotation
                        </button>
                    </div>
                )}

                {!isCreating && selectedQuote && workbenchLead && (
                    <LeadQuoteWorkbench
                        lead={workbenchLead}
                        quotes={workbenchLeadQuotes}
                        selectedQuoteId={selectedQuoteId || selectedQuote.id}
                        activeTab={leadWorkbenchTab}
                        onTabChange={setLeadWorkbenchTab}
                        onSelectQuote={(id) => setSelectedQuoteId(id)}
                        onNewQuote={() => prefillLeadForNewQuote(workbenchLead, selectedQuote)}
                        onEditQuote={() => handleEditMode(selectedQuote)}
                        onShareWhatsApp={canShareQuotes ? handleWhatsAppShare : undefined}
                        onShareEmail={canShareQuotes ? handleEmailShare : undefined}
                        customerEmail={resolveCustomerEmail(selectedQuote, db?.leads?.data || [])}
                        onPrint={canDownloadQuotePdf ? () => setShowQuotePrintPreview(true) : undefined}
                        onDeleteQuote={
                            selectedQuote ? () => handleDeleteQuote(selectedQuote) : undefined
                        }
                        onConvert={workbenchLead.id ? handleConvertQuote : undefined}
                        db={db}
                        agencyName={agencySettings?.agencyName || agencyName}
                    />
                )}

                {isCreating && (
                    <div className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden w-full">
                        <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">
                                <span className="text-crm-600">Building Package</span>
                            </h2>
                            <p className="text-sm text-slate-500">Curating a personalized experience for {formCustomer || 'New Client'}</p>
                        </div>
                        <form onSubmit={handleGenerate} noValidate className="flex flex-col flex-1 min-h-0">
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 space-y-8 custom-scrollbar" data-quote-builder-scroll>
                            {/* ── Mode Switcher ── */}
                            <div className="flex justify-center mb-8">
                                <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTripMode('custom');
                                            setSelectedPresetId('');
                                        }}
                                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${tripMode === 'custom' ? 'bg-white text-crm-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Edit3 size={14} /> Build Custom Plan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTripMode('package')}
                                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${tripMode === 'package' ? 'bg-white text-crm-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Briefcase size={14} /> Use a Template
                                    </button>
                                </div>
                            </div>

                            <div className="mb-6">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                                    {builderSteps.map((step, index) => (
                                        <button
                                            key={step.id}
                                            type="button"
                                            onClick={() => navigateToBuilderStep(step.id)}
                                            className={`text-left px-3 py-2 rounded-xl border transition-all ${
                                                builderStep === step.id
                                                    ? 'bg-crm-50 border-crm-300 text-crm-700'
                                                    : isBuilderStepCompleted(step.id)
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="text-[10px] font-black uppercase tracking-wider">Step {index + 1}</div>
                                            <div className="text-[11px] font-bold leading-tight mt-0.5">{step.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {iterationParent?.customizationRequest && (
                                <div className="bg-amber-50 border-2 border-dashed border-amber-200 rounded-[24px] p-5 animate-in slide-in-from-top-4 duration-500 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Edit3 size={60} className="text-amber-600 rotate-12" />
                                    </div>
                                    <div className="flex items-start gap-4 h-full relative z-10">
                                        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200 text-amber-700 shadow-sm animate-pulse">
                                            <Calculator size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-[2px]">Revision Request Active</span>
                                                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                                            </div>
                                            <p className="text-slate-800 text-sm font-bold leading-relaxed italic pr-12">
                                                "{iterationParent.customizationRequest}"
                                            </p>
                                            <div className="mt-3 flex items-center gap-2">
                                                <span className="text-[9px] font-bold text-amber-600/70 uppercase">Design Guideline from Lead Profile</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* ── Section 1: Customer & Destination Header ── */}
                            {builderStep === 'customer' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <div>
                                    <label className="form-label">Client Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formCustomer}
                                        onChange={e => setFormCustomer(e.target.value)}
                                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-crm-500 hover:bg-white transition-all"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="lg:col-span-1">
                                    <label className="form-label">Assigned Agent</label>
                                    <div className="relative group crm-select-wrap">
                                        <select
                                            value={formAgentId}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setFormAgentId(val);
                                                const agentObj = (db?.travelAgents?.data || []).find((a: any) => a.id === val);
                                                if (agentObj) {
                                                    setFormAgentName(agentObj.name);
                                                } else {
                                                    const staffObj = (db?.staff?.data || []).find((s: any) => s.employeeId === val);
                                                    setFormAgentName(staffObj ? staffObj.name : '');
                                                }
                                            }}
                                            className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-crm-500 appearance-none transition-all hover:bg-white"
                                        >
                                            <option value="">{userRole === 'admin' ? 'Direct / Unassigned' : 'Me (Direct Handling)'}</option>
                                            {userRole === 'admin' ? (
                                                (db?.travelAgents?.data || []).map((agent: any) => (
                                                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                                                ))
                                            ) : (
                                                <>
                                                    {filterStaffForAgentSession(db?.staff?.data || [], currentAgentId, db).map((member: any) => (
                                                        <option key={member.id} value={member.employeeId}>Staff: {member.name} ({member.role})</option>
                                                    ))}
                                                    {(db?.travelAgents?.data || []).filter((a: any) => a.parentId === currentAgentId).map((subAgent: any) => (
                                                        <option key={subAgent.id} value={subAgent.id}>Sub-Agent: {subAgent.name}</option>
                                                    ))}
                                                </>
                                            )}
                                        </select>
                                        <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-crm-500 transition-colors" />
                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <DropdownChevron size={16} />
                                        </div>
                                    </div>
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="form-label">Client Mobile</label>
                                    <div className="flex gap-2">
                                        <div className="relative w-36 shrink-0 group crm-select-wrap">
                                            <select
                                                value={formCountryCode}
                                                onChange={(e) => {
                                                    setFormCountryCode(e.target.value);
                                                    setFormPhone('');
                                                    setPhoneError('');
                                                }}
                                                className={`w-full pl-3 pr-8 py-3 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-crm-500 appearance-none cursor-pointer hover:bg-white transition-all ${
                                                    phoneError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                                                }`}
                                            >
                                                {COUNTRY_PHONE_DATA.map(c => (
                                                    <option key={c.code} value={c.code}>
                                                        {getCountryPhoneLabel(c.code)}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <DropdownChevron size={14} />
                                            </div>
                                        </div>
                                        <div className="relative flex-1">
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                autoComplete="tel-national"
                                                required
                                                value={formPhone}
                                                onChange={(e) => {
                                                    setFormPhone(sanitizeLocalPhoneDigits(e.target.value, formCountryCode));
                                                    setPhoneError('');
                                                }}
                                                className={`w-full px-3 py-3 pr-14 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-crm-500 hover:bg-white transition-all font-mono tracking-widest ${
                                                    phoneError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                                                }`}
                                                placeholder={`${getPhoneDigitLimit(formCountryCode)} digits`}
                                                aria-invalid={Boolean(phoneError)}
                                                aria-describedby={phoneError ? 'quote-phone-error' : undefined}
                                            />
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                                    formPhone.length === getPhoneDigitLimit(formCountryCode)
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-slate-200 text-slate-500'
                                                }`}>
                                                    {formPhone.length}/{getPhoneDigitLimit(formCountryCode)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {phoneError && (
                                        <p id="quote-phone-error" className="mt-2 text-xs font-semibold text-rose-600">
                                            {phoneError}
                                        </p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="form-label">Adults</label>
                                        <NumberInput
                                            min={1}
                                            value={formAdults}
                                            onChange={e => setFormAdults(parseInt(e.target.value) || 1)}
                                            className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-center font-bold text-slate-700 outline-none focus:border-crm-500 hover:bg-white transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Kids</label>
                                        <NumberInput
                                            min={0}
                                            value={formKids}
                                            onChange={e => {
                                                const val = parseInt(e.target.value) || 0;
                                                setFormKids(val);
                                                const parsed = parseKidsAges(formKidsAges).slice(0, val);
                                                setFormKidsAges(parsed.join(', '));
                                            }}
                                            className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-center font-bold text-slate-700 outline-none focus:border-crm-500 hover:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Kids Ages</label>
                                    <input
                                        type="text"
                                        value={formKidsAges}
                                        onChange={e => {
                                            const raw = e.target.value.replace(/[^0-9,\s]/g, '');
                                            setFormKidsAges(raw);
                                            const parsed = parseKidsAges(raw);
                                            if (parsed.length !== formKids && parsed.length > 0) {
                                                setFormKids(parsed.length);
                                            }
                                            if (raw.trim().length === 0) {
                                                setFormKids(0);
                                            }
                                        }}
                                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-crm-500 hover:bg-white transition-all"
                                        placeholder="e.g. 4, 8"
                                    />
                                    <p className="form-hint">Use comma-separated ages. Pricing adjusts by age bands.</p>
                                </div>
                                <div>
                                    <label className="form-label">
                                        Package duration
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative crm-select-wrap w-[96px] shrink-0">
                                        <select
                                            value={formTripDurationUnit}
                                            onChange={(e) => {
                                                const unit = e.target.value as 'nights' | 'days';
                                                const displayVal =
                                                    unit === 'nights' ? resolvedTripNights : resolvedTripDays;
                                                handleTripDurationChange(displayVal, unit);
                                            }}
                                            className="w-full px-2 py-3 pr-7 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-crm-500 hover:bg-white appearance-none cursor-pointer"
                                        >
                                            <option value="nights">Nights</option>
                                            <option value="days">Days</option>
                                        </select>
                                        <DropdownChevron size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                        <NumberInput
                                            min={1}
                                            max={60}
                                            value={formTripDurationValue}
                                            onChange={(e) =>
                                                handleTripDurationChange(
                                                    Math.max(1, parseInt(e.target.value, 10) || 1)
                                                )
                                            }
                                            className="flex-1 min-w-0 px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 text-center outline-none focus:border-crm-500 hover:bg-white transition-all"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        {resolvedTripNights} night{resolvedTripNights !== 1 ? 's' : ''} ·{' '}
                                        {resolvedTripDays} day{resolvedTripDays !== 1 ? 's' : ''} — sets itinerary length
                                        {tripMode === 'package' && livePreset?.duration ? (
                                            <span className="text-slate-500">
                                                {' '}
                                                (template: {livePreset.duration})
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                                <div>
                                    <label className="form-label">Departure Date</label>
                                    <div
                                        className="relative cursor-pointer"
                                        onClick={openDepartureDatePicker}
                                        role="presentation"
                                    >
                                        <input
                                            ref={departureDateRef}
                                            type="date"
                                            required
                                            value={formDepartureDate}
                                            onChange={(e) => setFormDepartureDate(e.target.value)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (typeof e.currentTarget.showPicker === 'function') {
                                                    try {
                                                        e.currentTarget.showPicker();
                                                    } catch {
                                                        /* unsupported */
                                                    }
                                                }
                                            }}
                                            className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-crm-500 hover:bg-white transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Include Flight</label>
                                    <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => setFormNeedFlight(true)}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                                formNeedFlight ? 'bg-white text-crm-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            Yes
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormNeedFlight(false);
                                                setFormFlightMeal((prev) => ({ ...prev, optIn: false }));
                                                setCustomFlightTotal(null);
                                            }}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                                !formNeedFlight ? 'bg-white text-crm-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            No
                                        </button>
                                    </div>
                                </div>
                                {formNeedFlight && (
                                    <>
                                        <div>
                                            <label className="form-label">
                                                Source Country
                                            </label>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setIsSourceCountryDropdownOpen((open) => {
                                                            if (!open) setSourceCountrySearch('');
                                                            return !open;
                                                        });
                                                    }}
                                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-crm-500 hover:bg-white transition-all cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                                                        <CountryFlag country={formSourceCountry} size={18} />
                                                        <span className="truncate">{formSourceCountry}</span>
                                                    </div>
                                                    <DropdownChevron
                                                        open={isSourceCountryDropdownOpen}
                                                        className="text-slate-400"
                                                        size={14}
                                                    />
                                                </button>

                                                {isSourceCountryDropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-[2500] bg-slate-900/5 backdrop-blur-[1px]" onClick={() => setIsSourceCountryDropdownOpen(false)}/>
                                                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[2600] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300" onClick={(e) => e.stopPropagation()}>
                                                            <div className="p-2 border-b border-slate-100">
                                                                <div className="relative">
                                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                    <input
                                                                        type="text"
                                                                        value={sourceCountrySearch}
                                                                        onChange={(e) => setSourceCountrySearch(e.target.value)}
                                                                        placeholder="Search countries..."
                                                                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-crm-500"
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="p-2 max-h-[280px] overflow-y-auto custom-scrollbar">
                                                                <CountryGroupedOptions
                                                                    options={filteredSourceCountryOptions}
                                                                    selected={formSourceCountry}
                                                                    onSelect={handleSourceCountrySelect}
                                                                />
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="form-label">
                                                Departure Airport
                                            </label>
                                            <div className="relative crm-select-wrap">
                                            <select
                                                value={formSourceAirport}
                                                onChange={(e) => setFormSourceAirport(e.target.value)}
                                                className="w-full px-3 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-crm-500 hover:bg-white transition-all appearance-none cursor-pointer"
                                            >
                                                {sourceAirportOptions.length === 0 ? (
                                                    <option value={formSourceAirport || ''}>
                                                        {formSourceAirport || 'Select airport'}
                                                    </option>
                                                ) : (
                                                    <>
                                                        {!sourceAirportOptions.some(
                                                            (opt) => opt.value === formSourceAirport
                                                        ) &&
                                                            formSourceAirport && (
                                                                <option value={formSourceAirport}>
                                                                    {formSourceAirport}
                                                                </option>
                                                            )}
                                                        {sourceAirportOptions.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </>
                                                )}
                                            </select>
                                            <DropdownChevron size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    </>
                                )}
                                {formNeedFlight && (
                                    <div>
                                        <label className="form-label">Flight Price</label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">
                                                {currencySymbol}
                                            </span>
                                            <NumberInput
                                                min={0}
                                                step={priceInputStep}
                                                value={customFlightTotal ? formatInputValue(customFlightTotal) : ''}
                                                onChange={(e) => {
                                                    const val = parseInputValue(e.target.value);
                                                    setCustomFlightTotal(val > 0 ? val : null);
                                                }}
                                                placeholder="Enter total flight price"
                                                className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 tabular-nums text-right outline-none focus:border-crm-500 hover:bg-white transition-all"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Total flight cost for this quote. Leave blank to use the default calculated rate.
                                        </p>
                                    </div>
                                )}
                                {formNeedFlight && (
                                    <div>
                                        <label className="form-label">Flight Meals</label>
                                        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => setFormFlightMeal((prev) => ({ ...prev, optIn: true }))}
                                                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                                    formFlightMeal.optIn ? 'bg-white text-crm-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                Yes
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormFlightMeal((prev) => ({ ...prev, optIn: false }))}
                                                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                                    !formFlightMeal.optIn ? 'bg-white text-crm-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                No
                                            </button>
                                        </div>
                                        {formFlightMeal.optIn && (
                                            <div className="relative crm-select-wrap mt-2">
                                            <select
                                                value={formFlightMeal.type}
                                                onChange={(e) =>
                                                    setFormFlightMeal((prev) => ({
                                                        ...prev,
                                                        type: e.target.value as 'Veg' | 'Non-Veg' | 'Vegan',
                                                    }))
                                                }
                                                className="w-full px-3 py-2.5 pr-9 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-crm-500 hover:bg-white transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="Veg">Veg</option>
                                                <option value="Non-Veg">Non-Veg</option>
                                                <option value="Vegan">Vegan</option>
                                            </select>
                                            <DropdownChevron size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className={`${tripMode === 'package' ? 'lg:col-span-1' : 'lg:col-span-1'}`}>
                                    <label className="form-label">Destination Country</label>
                                    <div className="relative z-[2]">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setIsRegionDropdownOpen(!isRegionDropdownOpen);
                                                if (!isRegionDropdownOpen) setBuilderCountrySearch('');
                                            }}
                                            className="w-full flex items-center justify-between px-4 py-[11px] bg-slate-50 border border-slate-200 rounded-2xl shadow-sm hover:border-crm-400 transition-all focus:ring-2 focus:ring-crm-500/20 outline-none group relative z-[2]"
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <CountryFlag country={builderCountry || null} size={22} global={!builderCountry} />
                                                <span className={`text-xs font-black uppercase truncate ${builderCountry ? 'text-slate-700' : 'text-slate-400'}`}>
                                                    {builderCountry || 'Select Country'}
                                                </span>
                                            </div>
                                            <DropdownChevron open={isRegionDropdownOpen} className="text-slate-400" size={14} />
                                        </button>

                                        {isRegionDropdownOpen && (
                                            <>
                                                <div className="fixed inset-0 z-[2500] bg-slate-900/5 backdrop-blur-[1px]" onClick={() => setIsRegionDropdownOpen(false)}></div>
                                                <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[2600] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300" onClick={(e) => e.stopPropagation()}>
                                                    <div className="p-3 border-b border-slate-100">
                                                        <div className="relative">
                                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                            <input
                                                                type="text"
                                                                value={builderCountrySearch}
                                                                onChange={(e) => setBuilderCountrySearch(e.target.value)}
                                                                placeholder="Search countries..."
                                                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-crm-500"
                                                                autoFocus
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                        <CountryGroupedOptions
                                                            options={filteredCountryOptions}
                                                            selected={builderCountry}
                                                            onSelect={handleBuilderCountrySelect}
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            )}

                            {/* ── Section 2: Accommodation & Luxury Preferences ── */}
                            {builderStep === 'hotel' && (
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5 bg-crm-50/20 rounded-2xl border border-crm-100 mb-6">
                                {tripMode === 'package' && (
                                    <div className="md:col-span-3">
                                        <label className="form-label">Apply Itinerary Preset</label>
                                        <div className="relative group crm-select-wrap">
                                            <FileText size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-crm-300 group-focus-within:text-crm-500 z-10 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={formPresetInput}
                                                onChange={(e) => {
                                                    const typed = e.target.value;
                                                    setFormPresetInput(typed);
                                                    setOpenPresetDropdown(true);
                                                    const matched = findPresetByName(typed);
                                                    if (matched) {
                                                        setSelectedPresetId(matched.id);
                                                    } else {
                                                        setSelectedPresetId('');
                                                    }
                                                }}
                                                onFocus={() => setOpenPresetDropdown(true)}
                                                onBlur={() =>
                                                    window.setTimeout(() => setOpenPresetDropdown(false), 120)
                                                }
                                                placeholder="Search or type package name..."
                                                className="w-full pl-10 pr-10 py-3 bg-white border border-crm-200 rounded-2xl text-sm font-bold text-crm-700 outline-none focus:border-crm-500 hover:bg-white transition-all shadow-sm"
                                            />
                                            <DropdownChevron
                                                open={openPresetDropdown}
                                                size={14}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                            />
                                            {openPresetDropdown && (
                                                <div className="absolute z-[120] top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                                                    <button
                                                        type="button"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => {
                                                            setSelectedPresetId('');
                                                            setFormPresetInput('');
                                                            setOpenPresetDropdown(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border-b border-slate-100"
                                                    >
                                                        Manual / Custom Plan
                                                    </button>
                                                    {searchPresetsByName(formPresetInput).map((p) => (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => {
                                                                setSelectedPresetId(p.id);
                                                                setFormPresetInput(p.name);
                                                                setOpenPresetDropdown(false);
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                                        >
                                                            <span className="block">{p.name}</span>
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                {p.destination} · {p.duration}
                                                            </span>
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => {
                                                            setOpenPresetDropdown(false);
                                                            setIsAddingPreset(true);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm font-bold text-crm-700 hover:bg-crm-50 border-t border-slate-100"
                                                    >
                                                        + Add new package (full details)
                                                    </button>
                                                    {formPresetInput.trim() && !findPresetByName(formPresetInput) && (
                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => {
                                                                createPresetByName(formPresetInput);
                                                                setOpenPresetDropdown(false);
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-sm font-bold text-crm-600 hover:bg-crm-50 border-t border-slate-100"
                                                        >
                                                            + Add &quot;{formPresetInput.trim()}&quot;
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="md:col-span-12">
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                                        <div className="mb-3">
                                            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Hotel Stay Split by Nights</p>
                                            <p className="text-[10px] text-slate-400">
                                                Total package nights: {effectiveNights} • Assigned: {currentStayNights} • Remaining: {remainingStayNights}
                                            </p>
                                            {!canConfirmHotelSelection && hotelSelectionIncompleteMessage && (
                                                <p className={`mt-1 text-[10px] font-semibold ${hotelValidationAttempted ? 'text-rose-600' : 'text-amber-600'}`}>
                                                    {hotelSelectionIncompleteMessage}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-4">
                                            {formHotelStays.map((stay, idx) => {
                                                const stayHotel = getHotelRecord(stay.hotelId);
                                                const nightRows = getStayNightRows(idx);
                                                const stayGivenTotal = sumStayGivenTotal(stay);
                                                const extraBedTotal = sumStayExtraBedTotal(stay);
                                                const childWithBedTotal = sumStayChildWithBedTotal(stay);
                                                const childWithoutBedTotal = sumStayChildWithoutBedTotal(stay);
                                                const inclusionsTotal = sumStaySpecialInclusionsTotal(stay);
                                                const stayHotelTotal = sumStayHotelTotal(stay);
                                                const givenColumnTotal = nightRows.reduce((s, r) => s + r.given, 0);
                                                const stayCityValue = String(stay.city ?? builderCity ?? '');
                                                const childWithBedPriceInvalid =
                                                    hotelValidationAttempted &&
                                                    (stay.childWithBed || 0) > 0 &&
                                                    !(Number(stay.childWithBedPrice) > 0);
                                                const childWithoutBedPriceInvalid =
                                                    hotelValidationAttempted &&
                                                    (stay.childWithoutBed || 0) > 0 &&
                                                    !(Number(stay.childWithoutBedPrice) > 0);

                                                return (
                                                <div key={`${idx}-${stay.hotelId}`} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                                                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(22rem,28rem)] divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                                                        {/* Hotel details */}
                                                        <div className="p-4 space-y-3">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                                                    Stay block {idx + 1} • {getStayDateLabel(idx)}
                                                                </p>
                                                            </div>

                                                            <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-2 items-start">
                                                                <div className="relative min-w-0">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">City / Place</p>
                                                                    <div className="relative">
                                                                        <input
                                                                            type="text"
                                                                            value={stayCityValue}
                                                                            disabled={!builderCountry}
                                                                            onChange={(e) => {
                                                                                const city = e.target.value;
                                                                                updateHotelStay(idx, { city });
                                                                                handleBuilderCityChange(city);
                                                                                setOpenCityDropdown(idx);
                                                                            }}
                                                                            onFocus={() => {
                                                                                if (builderCountry) setOpenCityDropdown(idx);
                                                                            }}
                                                                            onBlur={() =>
                                                                                window.setTimeout(
                                                                                    () => setOpenCityDropdown((prev) => (prev === idx ? null : prev)),
                                                                                    120
                                                                                )
                                                                            }
                                                                            placeholder={
                                                                                builderCountry
                                                                                    ? 'Search or select city / place'
                                                                                    : 'Select destination country in Customer Information first'
                                                                            }
                                                                            className={`w-full py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 bg-white outline-none focus:border-crm-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                                                                                stayCityValue.trim() ? 'pl-3 pr-16' : 'pl-3 pr-10'
                                                                            }`}
                                                                        />
                                                                        <DropdownChevron
                                                                            open={openCityDropdown === idx && Boolean(builderCountry)}
                                                                            size={14}
                                                                            className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${
                                                                                stayCityValue.trim() ? 'right-9' : 'right-2.5'
                                                                            }`}
                                                                        />
                                                                        {stayCityValue.trim() && (
                                                                            <button
                                                                                type="button"
                                                                                onMouseDown={(e) => e.preventDefault()}
                                                                                onClick={() => {
                                                                                    updateHotelStay(idx, { city: '' });
                                                                                    handleBuilderCityChange('');
                                                                                    setOpenCityDropdown(null);
                                                                                }}
                                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50"
                                                                                title="Clear city"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {openCityDropdown === idx && builderCountry && (
                                                                        <div className="absolute z-[120] top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                                                                            {filteredCityOptions.map((city) => (
                                                                                <button
                                                                                    key={city}
                                                                                    type="button"
                                                                                    onMouseDown={(e) => e.preventDefault()}
                                                                                    onClick={() => {
                                                                                        updateHotelStay(idx, { city });
                                                                                        handleBuilderCityChange(city);
                                                                                        setOpenCityDropdown(null);
                                                                                    }}
                                                                                    className={`w-full text-left px-3 py-2 text-sm font-semibold hover:bg-slate-50 ${
                                                                                        stayCityValue.trim().toLowerCase() === city.toLowerCase()
                                                                                            ? 'bg-crm-50 text-crm-700'
                                                                                            : 'text-slate-700'
                                                                                    }`}
                                                                                >
                                                                                    {city}
                                                                                </button>
                                                                            ))}
                                                                            {stayCityValue.trim() &&
                                                                                !builderCityOptions.some(
                                                                                    (city) =>
                                                                                        city.toLowerCase() ===
                                                                                        stayCityValue.trim().toLowerCase()
                                                                                ) && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                                        onClick={() => {
                                                                                            const name = stayCityValue.trim();
                                                                                            createCityByName(name);
                                                                                            updateHotelStay(idx, { city: name });
                                                                                            handleBuilderCityChange(name);
                                                                                            setOpenCityDropdown(null);
                                                                                        }}
                                                                                        className="w-full text-left px-3 py-2 text-sm font-bold text-crm-600 hover:bg-crm-50 border-t border-slate-100"
                                                                                    >
                                                                                        + Add &quot;{stayCityValue.trim()}&quot;
                                                                                    </button>
                                                                                )}
                                                                            {!stayCityValue.trim() && filteredCityOptions.length === 0 && (
                                                                                <p className="px-3 py-3 text-[11px] font-semibold text-slate-400">
                                                                                    Type a city or place name
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {!builderCountry && (
                                                                        <p className="mt-1 text-[10px] text-amber-600 font-semibold">
                                                                            Select a destination country in Customer Information first.
                                                                        </p>
                                                                    )}
                                                                    {builderCountry && (
                                                                        <p className="mt-1 text-[10px] text-slate-400">
                                                                            Top cities for {builderCountry}. Search or quick-add a new place.
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Nights</p>
                                                                    <div className="flex items-center justify-center gap-2 h-[42px] px-1 rounded-lg border border-slate-200 bg-white">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateHotelStay(idx, { nights: Math.max(1, stay.nights - 1) })}
                                                                            className="w-9 h-9 rounded-lg text-base font-black text-slate-600 hover:bg-slate-50 leading-none"
                                                                            title="Decrease nights"
                                                                        >
                                                                            −
                                                                        </button>
                                                                        <span className="text-[10px] font-bold text-slate-800 min-w-[2.5rem] text-center tabular-nums">
                                                                            {stay.nights}N
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (remainingStayNights <= 0) return;
                                                                                updateHotelStay(idx, { nights: stay.nights + 1 });
                                                                            }}
                                                                            disabled={remainingStayNights <= 0}
                                                                            className="w-9 h-9 rounded-lg text-base font-black text-slate-600 hover:bg-slate-50 leading-none disabled:opacity-40"
                                                                            title="Increase nights"
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                <div className="relative">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Hotel</p>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        value={stay.hotelInput || ''}
                                                                        onChange={(e) => {
                                                                            const typed = e.target.value;
                                                                            const matched = findHotelByName(typed);
                                                                            setOpenHotelDropdown(idx);
                                                                            if (matched) {
                                                                                updateHotelStay(idx, { hotelInput: typed, hotelId: matched.id });
                                                                            } else {
                                                                                setFormHotelStays((prev) =>
                                                                                    prev.map((s, sIdx) =>
                                                                                        sIdx === idx ? { ...s, hotelInput: typed, hotelId: '' } : s
                                                                                    )
                                                                                );
                                                                            }
                                                                        }}
                                                                        onFocus={() => setOpenHotelDropdown(idx)}
                                                                        onBlur={() => window.setTimeout(() => setOpenHotelDropdown((prev) => (prev === idx ? null : prev)), 120)}
                                                                        className={`w-full py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 bg-white ${
                                                                            stay.hotelInput?.trim() ? 'pl-3 pr-16' : 'pl-3 pr-10'
                                                                        }`}
                                                                        placeholder="Type hotel name, then Add new"
                                                                    />
                                                                    <DropdownChevron
                                                                        open={openHotelDropdown === idx}
                                                                        size={14}
                                                                        className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${
                                                                            stay.hotelInput?.trim() ? 'right-9' : 'right-2.5'
                                                                        }`}
                                                                    />
                                                                    {stay.hotelInput?.trim() && (
                                                                        <button
                                                                            type="button"
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                            onClick={() => {
                                                                                updateHotelStay(idx, { hotelInput: '', hotelId: '' });
                                                                                setOpenHotelDropdown(null);
                                                                            }}
                                                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50"
                                                                            title="Clear hotel"
                                                                        >
                                                                            <X size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {stayHotel && (stayHotel.location || stayHotel.destination) && (
                                                                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500">
                                                                        <span className="inline-flex items-center gap-1 text-crm-600">
                                                                            <HotelIcon size={12} /> {stayHotel.location || stayHotel.destination}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {openHotelDropdown === idx && (
                                                                    <div className="absolute z-[120] top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                                                                        {stayCityValue?.trim() && (
                                                                            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 bg-slate-50">
                                                                                Hotels in {stayCityValue}
                                                                                {builderCountry ? `, ${builderCountry}` : ''}
                                                                            </div>
                                                                        )}
                                                                        {searchHotelsByName(stay.hotelInput || '').map((h: any) => (
                                                                            <button
                                                                                key={h.id}
                                                                                type="button"
                                                                                onMouseDown={(e) => e.preventDefault()}
                                                                                onClick={() => {
                                                                                    updateHotelStay(idx, { hotelInput: h.name, hotelId: h.id });
                                                                                    setOpenHotelDropdown(null);
                                                                                }}
                                                                                className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                                                            >
                                                                                <span className="block">{h.name}</span>
                                                                                {(h.location || h.destination) && (
                                                                                    <span className="text-[10px] font-medium text-slate-400">
                                                                                        {h.location || h.destination}
                                                                                    </span>
                                                                                )}
                                                                            </button>
                                                                        ))}
                                                                        {searchHotelsByName(stay.hotelInput || '').length === 0 && (
                                                                            <p className="px-3 py-3 text-[11px] font-semibold text-slate-400">
                                                                                {stayCityValue?.trim()
                                                                                    ? `No hotels found for ${stayCityValue}. Add a new hotel below.`
                                                                                    : 'No hotels match. Add a new hotel below.'}
                                                                            </p>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            disabled={!stay.hotelInput?.trim()}
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                            onClick={() => {
                                                                                const name = String(stay.hotelInput || '').trim();
                                                                                if (!name) return;
                                                                                const existing = findHotelByName(name);
                                                                                if (existing) {
                                                                                    updateHotelStay(idx, { hotelInput: existing.name, hotelId: existing.id });
                                                                                    setOpenHotelDropdown(null);
                                                                                    return;
                                                                                }
                                                                                const newHotelId = createHotelByName(name);
                                                                                if (!newHotelId) return;
                                                                                updateHotelStay(idx, { hotelId: newHotelId, hotelInput: name });
                                                                                setOpenHotelDropdown(null);
                                                                            }}
                                                                            className={`w-full text-left px-3 py-2 text-sm font-bold border-t border-slate-100 ${
                                                                                stay.hotelInput?.trim()
                                                                                    ? 'text-crm-600 hover:bg-crm-50'
                                                                                    : 'text-slate-300 cursor-not-allowed'
                                                                            }`}
                                                                        >
                                                                            {stay.hotelInput?.trim()
                                                                                ? `+ Add "${stay.hotelInput.trim()}"`
                                                                                : '+ Add new hotel'}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                                <div className="relative">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Room Type / Category</p>
                                                                    <div className="relative">
                                                                        <input
                                                                            type="text"
                                                                            value={stay.roomType || ''}
                                                                            onChange={(e) => {
                                                                                updateHotelStay(idx, { roomType: e.target.value });
                                                                                setOpenRoomTypeDropdown(idx);
                                                                            }}
                                                                            onFocus={() => setOpenRoomTypeDropdown(idx)}
                                                                            onBlur={() =>
                                                                                window.setTimeout(
                                                                                    () => setOpenRoomTypeDropdown((prev) => (prev === idx ? null : prev)),
                                                                                    120
                                                                                )
                                                                            }
                                                                            placeholder="Type room type, then Add new"
                                                                            className={`w-full py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white ${
                                                                                stay.roomType?.trim() ? 'pl-2.5 pr-16' : 'pl-2.5 pr-8'
                                                                            }`}
                                                                        />
                                                                        <DropdownChevron
                                                                            open={openRoomTypeDropdown === idx}
                                                                            size={12}
                                                                            className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${
                                                                                stay.roomType?.trim() ? 'right-8' : 'right-2'
                                                                            }`}
                                                                        />
                                                                        {stay.roomType?.trim() && (
                                                                            <button
                                                                                type="button"
                                                                                onMouseDown={(e) => e.preventDefault()}
                                                                                onClick={() => {
                                                                                    updateHotelStay(idx, { roomType: '' });
                                                                                    setOpenRoomTypeDropdown(null);
                                                                                }}
                                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50"
                                                                                title="Clear room type"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {openRoomTypeDropdown === idx && (
                                                                        <div className="absolute z-[120] top-full left-0 mt-1 w-full min-w-[180px] bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                                            {searchRoomTypes(stay.roomType || '').map((roomType) => (
                                                                                <button
                                                                                    key={roomType}
                                                                                    type="button"
                                                                                    onMouseDown={(e) => e.preventDefault()}
                                                                                    onClick={() => {
                                                                                        updateHotelStay(idx, { roomType });
                                                                                        setOpenRoomTypeDropdown(null);
                                                                                    }}
                                                                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                                                >
                                                                                    {roomType}
                                                                                </button>
                                                                            ))}
                                                                            <button
                                                                                type="button"
                                                                                disabled={!stay.roomType?.trim()}
                                                                                onMouseDown={(e) => e.preventDefault()}
                                                                                onClick={() => {
                                                                                    const name = String(stay.roomType || '').trim();
                                                                                    if (!name) return;
                                                                                    const existing = findRoomTypeByName(name);
                                                                                    if (existing) {
                                                                                        updateHotelStay(idx, { roomType: existing });
                                                                                        setOpenRoomTypeDropdown(null);
                                                                                        return;
                                                                                    }
                                                                                    addCustomRoomType(name);
                                                                                    updateHotelStay(idx, { roomType: name });
                                                                                    setOpenRoomTypeDropdown(null);
                                                                                }}
                                                                                className={`w-full text-left px-3 py-2 text-xs font-bold border-t border-slate-100 ${
                                                                                    stay.roomType?.trim()
                                                                                        ? 'text-crm-600 hover:bg-crm-50'
                                                                                        : 'text-slate-300 cursor-not-allowed'
                                                                                }`}
                                                                            >
                                                                                {stay.roomType?.trim()
                                                                                    ? `+ Add "${stay.roomType.trim()}"`
                                                                                    : '+ Add new room type'}
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="relative">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Meal Plan</p>
                                                                    <div className="relative crm-select-wrap">
                                                                        <select
                                                                            value={stay.mealPlan || ''}
                                                                            onChange={(e) => updateHotelStay(idx, { mealPlan: e.target.value })}
                                                                            className={`w-full py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white appearance-none cursor-pointer ${
                                                                                stay.mealPlan ? 'pl-2.5 pr-9' : 'pl-2.5 pr-8'
                                                                            }`}
                                                                        >
                                                                            <option value="">Select meal plan</option>
                                                                            <option value="EP (Room Only)">EP</option>
                                                                            <option value="CP (Breakfast Only)">CP</option>
                                                                            <option value="MAP (Half Board)">MAP</option>
                                                                            <option value="AP (Full Board)">AP</option>
                                                                        </select>
                                                                        {!stay.mealPlan && (
                                                                            <DropdownChevron size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                                        )}
                                                                        {stay.mealPlan && (
                                                                            <DropdownChevron size={12} className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                                        )}
                                                                        {stay.mealPlan && (
                                                                            <button
                                                                                type="button"
                                                                                onMouseDown={(e) => e.preventDefault()}
                                                                                onClick={() => updateHotelStay(idx, { mealPlan: '' })}
                                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50"
                                                                                title="Clear meal plan"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Pax/Room</p>
                                                                    <NumberInput
                                                                        min={1}
                                                                        value={stay.personsPerRoom || 2}
                                                                        onChange={(e) => updateHotelStay(idx, { personsPerRoom: Math.max(1, parseInt(e.target.value) || 1) })}
                                                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-center bg-white"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Number of Rooms</p>
                                                                    <NumberInput
                                                                        min={1}
                                                                        value={stay.rooms || 1}
                                                                        onChange={(e) => updateHotelStay(idx, { rooms: Math.max(1, parseInt(e.target.value) || 1) })}
                                                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-center bg-white"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Extra Beds</p>
                                                                    <NumberInput
                                                                        min={0}
                                                                        value={stay.extraBed || 0}
                                                                        onChange={(e) => {
                                                                            const beds = Math.max(0, parseInt(e.target.value) || 0);
                                                                            updateHotelStay(idx, {
                                                                                extraBed: beds,
                                                                                ...(beds === 0 ? { extraBedPrice: 0 } : {}),
                                                                            });
                                                                        }}
                                                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-center bg-white"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p className={`text-[10px] font-black uppercase mb-1 ${hotelValidationAttempted && stayMissingExtraBedPrice(stay) ? 'text-rose-600' : 'text-slate-500'}`}>
                                                                        Extra Bed Price ({currencySymbol}/night)
                                                                    </p>
                                                                    <NumberInput
                                                                        min={0}
                                                                        value={formatInputValue(stay.extraBedPrice || 0)}
                                                                        placeholder="0"
                                                                        step={priceInputStep}
                                                                        disabled={(stay.extraBed || 0) === 0}
                                                                        onChange={(e) => updateHotelStay(idx, { extraBedPrice: parseInputValue(e.target.value) })}
                                                                        className={`crm-price-field px-2 py-2 border rounded-lg text-xs font-bold bg-white disabled:bg-slate-50 disabled:text-slate-400 ${
                                                                            hotelValidationAttempted && stayMissingExtraBedPrice(stay)
                                                                                ? 'border-rose-400 ring-1 ring-rose-200'
                                                                                : 'border-slate-200'
                                                                        }`}
                                                                    />
                                                                    {hotelValidationAttempted && stayMissingExtraBedPrice(stay) && (
                                                                        <p className="mt-1 text-[10px] font-semibold text-rose-600">
                                                                            Extra bed price is required
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Child with Bed</p>
                                                                    <NumberInput
                                                                        min={0}
                                                                        value={stay.childWithBed || 0}
                                                                        onChange={(e) => {
                                                                            const count = Math.max(0, parseInt(e.target.value) || 0);
                                                                            updateHotelStay(idx, {
                                                                                childWithBed: count,
                                                                                ...(count === 0 ? { childWithBedPrice: 0 } : {}),
                                                                            });
                                                                        }}
                                                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-center bg-white"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p className={`text-[10px] font-black uppercase mb-1 ${childWithBedPriceInvalid ? 'text-rose-600' : 'text-slate-500'}`}>
                                                                        Child with Bed Price ({currencySymbol}/night)
                                                                    </p>
                                                                    <NumberInput
                                                                        min={0}
                                                                        value={formatInputValue(stay.childWithBedPrice || 0)}
                                                                        placeholder="0"
                                                                        step={priceInputStep}
                                                                        disabled={(stay.childWithBed || 0) === 0}
                                                                        onChange={(e) => updateHotelStay(idx, { childWithBedPrice: parseInputValue(e.target.value) })}
                                                                        className={`crm-price-field px-2 py-2 border rounded-lg text-xs font-bold bg-white disabled:bg-slate-50 disabled:text-slate-400 ${
                                                                            childWithBedPriceInvalid
                                                                                ? 'border-rose-400 ring-1 ring-rose-200'
                                                                                : 'border-slate-200'
                                                                        }`}
                                                                    />
                                                                    {childWithBedPriceInvalid && (
                                                                        <p className="mt-1 text-[10px] font-semibold text-rose-600">
                                                                            Child with bed price is required
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Child without Bed</p>
                                                                    <NumberInput
                                                                        min={0}
                                                                        value={stay.childWithoutBed || 0}
                                                                        onChange={(e) => {
                                                                            const count = Math.max(0, parseInt(e.target.value) || 0);
                                                                            updateHotelStay(idx, {
                                                                                childWithoutBed: count,
                                                                                ...(count === 0 ? { childWithoutBedPrice: 0 } : {}),
                                                                            });
                                                                        }}
                                                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-center bg-white"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p className={`text-[10px] font-black uppercase mb-1 ${childWithoutBedPriceInvalid ? 'text-rose-600' : 'text-slate-500'}`}>
                                                                        Child without Bed Price ({currencySymbol}/night)
                                                                    </p>
                                                                    <NumberInput
                                                                        min={0}
                                                                        value={formatInputValue(stay.childWithoutBedPrice || 0)}
                                                                        placeholder="0"
                                                                        step={priceInputStep}
                                                                        disabled={(stay.childWithoutBed || 0) === 0}
                                                                        onChange={(e) => updateHotelStay(idx, { childWithoutBedPrice: parseInputValue(e.target.value) })}
                                                                        className={`crm-price-field px-2 py-2 border rounded-lg text-xs font-bold bg-white disabled:bg-slate-50 disabled:text-slate-400 ${
                                                                            childWithoutBedPriceInvalid
                                                                                ? 'border-rose-400 ring-1 ring-rose-200'
                                                                                : 'border-slate-200'
                                                                        }`}
                                                                    />
                                                                    {childWithoutBedPriceInvalid && (
                                                                        <p className="mt-1 text-[10px] font-semibold text-rose-600">
                                                                            Child without bed price is required
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Prices panel */}
                                                        <div className="bg-slate-50/80 p-4 flex flex-col min-h-[220px]">
                                                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-3">Prices</p>
                                                            <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1 text-[10px] font-bold text-slate-400 uppercase mb-2 pr-1">
                                                                <span>Date</span>
                                                                <span className="text-right crm-price-amount">Rate / Night</span>
                                                            </div>
                                                            <div className="flex-1 space-y-2 overflow-y-auto max-h-[240px] pr-1">
                                                                {nightRows.map((row) => {
                                                                    const nightInclusions =
                                                                        stay.nightPrices?.[row.nightIdx]?.specialInclusions || [];
                                                                    return (
                                                                    <div key={row.nightIdx} className="pb-2 border-b border-slate-100 last:border-0">
                                                                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-0.5 items-center">
                                                                            <div>
                                                                                <p className="text-xs font-bold text-slate-800">{row.datePart}</p>
                                                                                {row.day && <p className="text-[10px] text-slate-400">{row.day}</p>}
                                                                            </div>
                                                                            <div className="crm-price-field-wrap">
                                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{currencySymbol}</span>
                                                                                <NumberInput
                                                                                    min={0}
                                                                                    step={priceInputStep}
                                                                                    value={formatInputValue(row.given || 0)}
                                                                                    onChange={(e) => updateStayNightGiven(idx, row.nightIdx, parseInputValue(e.target.value))}
                                                                                    className="crm-price-field pl-6 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white focus:outline-none focus:border-slate-300"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <HotelSpecialInclusionsSection
                                                                            variant="night"
                                                                            inclusions={nightInclusions}
                                                                            onChange={(specialInclusions) =>
                                                                                updateStayNightInclusions(idx, row.nightIdx, specialInclusions)
                                                                            }
                                                                        />
                                                                    </div>
                                                                    );
                                                                })}
                                                                {nightRows.length === 0 && (
                                                                    <p className="text-[11px] text-slate-400 italic">Select a hotel to load nightly rates.</p>
                                                                )}
                                                            </div>
                                                            {(stay.extraBed || 0) > 0 && (
                                                                <div className="pt-3 mt-2 border-t border-slate-200 space-y-1.5">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Extra bed</p>
                                                                    <div className="grid grid-cols-[1fr_auto] gap-x-2 items-center text-xs">
                                                                        <span className="text-slate-600 font-semibold">
                                                                            {stay.extraBed} bed{(stay.extraBed || 0) > 1 ? 's' : ''} × {stay.nights} night{stay.nights > 1 ? 's' : ''}
                                                                        </span>
                                                                        <span className="text-right font-bold text-crm-700 crm-price-amount">
                                                                            {extraBedTotal > 0 ? formatInr(extraBedTotal) : '—'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400">
                                                                        {formatInr(stay.extraBedPrice || 0)} per bed per night
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {(stay.childWithBed || 0) > 0 && (
                                                                <div className="pt-3 mt-2 border-t border-slate-200 space-y-1.5">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Child with bed</p>
                                                                    <div className="grid grid-cols-[1fr_auto] gap-x-2 items-center text-xs">
                                                                        <span className="text-slate-600 font-semibold">
                                                                            {stay.childWithBed} × {stay.nights} night{stay.nights > 1 ? 's' : ''}
                                                                        </span>
                                                                        <span className="text-right font-bold text-crm-700 crm-price-amount">
                                                                            {childWithBedTotal > 0 ? formatInr(childWithBedTotal) : '—'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400">
                                                                        {formatInr(stay.childWithBedPrice || 0)} per child per night
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {(stay.childWithoutBed || 0) > 0 && (
                                                                <div className="pt-3 mt-2 border-t border-slate-200 space-y-1.5">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Child without bed</p>
                                                                    <div className="grid grid-cols-[1fr_auto] gap-x-2 items-center text-xs">
                                                                        <span className="text-slate-600 font-semibold">
                                                                            {stay.childWithoutBed} × {stay.nights} night{stay.nights > 1 ? 's' : ''}
                                                                        </span>
                                                                        <span className="text-right font-bold text-crm-700 crm-price-amount">
                                                                            {childWithoutBedTotal > 0 ? formatInr(childWithoutBedTotal) : '—'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400">
                                                                        {formatInr(stay.childWithoutBedPrice || 0)} per child per night
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {inclusionsTotal > 0 && (
                                                                <div className="pt-3 mt-2 border-t border-slate-200 space-y-1.5">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Special services</p>
                                                                    <div className="grid grid-cols-[1fr_auto] gap-x-2 items-center text-xs">
                                                                        <span className="text-slate-600 font-semibold">Added inclusions</span>
                                                                        <span className="text-right font-bold text-crm-700 crm-price-amount">
                                                                            {formatInr(inclusionsTotal)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {nightRows.length > 0 && (
                                                                <div className="grid grid-cols-[1fr_auto] gap-x-2 pt-3 mt-2 border-t border-slate-200 text-xs font-black">
                                                                    <span className="text-slate-500 uppercase tracking-wider">Room total</span>
                                                                    <span className="text-right text-crm-700 crm-price-amount">{formatInr(givenColumnTotal)}</span>
                                                                </div>
                                                            )}
                                                            {stayHotelTotal > 0 && (
                                                                <div className="grid grid-cols-[1fr_auto] gap-x-2 pt-2 mt-1 text-xs font-black">
                                                                    <span className="text-slate-600 uppercase tracking-wider">Sub total</span>
                                                                    <span className="text-right text-crm-800 crm-price-amount">{formatInr(stayHotelTotal)}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-200">
                                                                <button
                                                                    type="button"
                                                                    disabled={remainingStayNights <= 0}
                                                                    onClick={() => {
                                                                        if (remainingStayNights <= 0) return;
                                                                        updateHotelStay(idx, { nights: stay.nights + 1 });
                                                                    }}
                                                                    className="text-[10px] font-bold text-crm-600 hover:text-crm-800 disabled:text-slate-300"
                                                                >
                                                                    + Next Night
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (remainingStayNights <= 0) return;
                                                                        const duplicated = syncStayNightPrices({
                                                                            ...stay,
                                                                            nights: Math.min(1, remainingStayNights),
                                                                        });
                                                                        setFormHotelStays((prev) => [...prev.slice(0, idx + 1), duplicated, ...prev.slice(idx + 1)]);
                                                                    }}
                                                                    disabled={remainingStayNights <= 0}
                                                                    className="text-[10px] font-bold text-slate-500 hover:text-slate-700 disabled:text-slate-300 inline-flex items-center gap-1"
                                                                >
                                                                    <Copy size={11} /> Duplicate
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormHotelStays((prev) => prev.filter((_, sIdx) => sIdx !== idx))}
                                                                    className="text-[10px] font-bold text-red-500 hover:text-red-700 ml-auto"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                            {stayHotelTotal > 0 && (
                                                                <p className="text-[10px] text-slate-400 mt-2 text-right">
                                                                    Included in quote: <span className="font-black text-crm-700">{formatInr(stayHotelTotal)}</span>
                                                                    <span className="text-slate-400">
                                                                        {' '}
                                                                        (rooms {formatInr(stayGivenTotal)}
                                                                        {extraBedTotal > 0 && ` + extra bed ${formatInr(extraBedTotal)}`}
                                                                        {childWithBedTotal > 0 && ` + child with bed ${formatInr(childWithBedTotal)}`}
                                                                        {childWithoutBedTotal > 0 && ` + child without bed ${formatInr(childWithoutBedTotal)}`}
                                                                        {inclusionsTotal > 0 && ` + services ${formatInr(inclusionsTotal)}`}
                                                                        )
                                                                    </span>
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                );
                                            })}
                                            {formHotelStays.length === 0 && (
                                                <div className="text-[11px] text-slate-400 italic border border-dashed border-slate-200 rounded-xl px-3 py-3 text-center">
                                                    No split configured. You can add multiple hotels by nights.
                                                </div>
                                            )}
                                            {formHotelStays.length > 0 && hotelsStayGrandTotal > 0 && (
                                                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-crm-200 bg-crm-50/60">
                                                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                                        Stay total
                                                    </span>
                                                    <span className="text-sm font-black text-crm-800 crm-price-amount">
                                                        {formatInr(hotelsStayGrandTotal)}
                                                    </span>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (remainingStayNights <= 0) return;
                                                    setFormHotelStays((prev) => [
                                                        ...prev,
                                                        {
                                                            hotelId: '',
                                                            nights: 1,
                                                            hotelInput: '',
                                                            city: builderCity || '',
                                                            roomType: '',
                                                            rooms: 1,
                                                            personsPerRoom: 2,
                                                            extraBed: 0,
                                                            extraBedPrice: 0,
                                                            childWithBed: 0,
                                                            childWithBedPrice: 0,
                                                            childWithoutBed: 0,
                                                            childWithoutBedPrice: 0,
                                                            mealPlan: ''
                                                        }
                                                    ]);
                                                }}
                                                disabled={remainingStayNights <= 0}
                                                title={remainingStayNights <= 0 ? 'Package night limit reached' : 'Add another hotel stay'}
                                                className={`w-full px-3 py-2.5 text-[11px] font-bold rounded-xl border transition-all ${
                                                    remainingStayNights <= 0
                                                        ? 'border-slate-200 text-slate-300 bg-slate-100 cursor-not-allowed'
                                                        : 'border-crm-200 text-crm-600 hover:bg-crm-50 border-dashed'
                                                }`}
                                            >
                                                + Add Hotel Stay
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="md:col-span-12">
                                    <p className="text-[11px] text-slate-500 mb-3">
                                        When stays and nightly rates are set, confirm to generate your <strong>Trip ID</strong> and{' '}
                                        <strong>Hotel Booking IDs</strong> for guest check-in (use the button in the footer).
                                    </p>
                                </div>
                            </div>
                            )}

                            {builderStep === 'itinerary' && (
                            <div className="space-y-6 border-t border-slate-100 pt-8">
                                <div className="p-4 bg-white border border-slate-200 rounded-2xl">
                                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                                        <div className="flex-1 min-w-0">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 block">
                                                Travel vehicle for activities
                                            </label>
                                            <div className="relative crm-select-wrap">
                                                <select
                                                    value={formVehicleType}
                                                    onChange={(e) => {
                                                        const next = e.target.value;
                                                        setFormVehicleType(next);
                                                        if (next !== 'Car') setFormCarType('');
                                                        if (next !== 'Other') setFormVehicleOther('');
                                                    }}
                                                    className={`w-full py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white appearance-none cursor-pointer outline-none focus:border-crm-500 ${
                                                        formVehicleType ? 'pl-3 pr-9' : 'pl-3 pr-8'
                                                    }`}
                                                >
                                                    <option value="">Select vehicle</option>
                                                    {ITINERARY_VEHICLE_TYPES.map((type) => (
                                                        <option key={type} value={type}>
                                                            {type}
                                                        </option>
                                                    ))}
                                                </select>
                                                <DropdownChevron
                                                    size={14}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                                />
                                            </div>
                                            <p className="mt-1.5 text-[10px] text-slate-400">
                                                Ground transport only (no flights or trains). Applies to activity travel for this itinerary.
                                            </p>
                                            {itineraryVehicleLabel && (
                                                <p className="mt-1 text-[11px] font-semibold text-crm-700">
                                                    Selected: {itineraryVehicleLabel}
                                                    {formVehiclePrice > 0 ? ` · ${formatMoney(formVehiclePrice)}` : ''}
                                                </p>
                                            )}
                                        </div>
                                        {formVehicleType === 'Car' && (
                                            <div className="flex-1 min-w-0 space-y-2.5">
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 block">
                                                        Car type
                                                    </label>
                                                    <div className="relative crm-select-wrap">
                                                        <select
                                                            value={formCarType}
                                                            onChange={(e) => setFormCarType(e.target.value)}
                                                            className={`w-full py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white appearance-none cursor-pointer outline-none focus:border-crm-500 ${
                                                                formCarType ? 'pl-3 pr-9' : 'pl-3 pr-8'
                                                            }`}
                                                        >
                                                            <option value="">Select car type</option>
                                                            {ITINERARY_CAR_TYPES.map((type) => (
                                                                <option key={type} value={type}>
                                                                    {type}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <DropdownChevron
                                                            size={14}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0 whitespace-nowrap">
                                                        Vehicle price
                                                    </label>
                                                    <div className="relative crm-price-field-wrap flex-1 min-w-0">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                            {currencySymbol}
                                                        </span>
                                                        <NumberInput
                                                            min={0}
                                                            step={priceInputStep}
                                                            value={
                                                                formVehiclePrice > 0
                                                                    ? formatInputValue(formVehiclePrice)
                                                                    : '0'
                                                            }
                                                            onChange={(e) =>
                                                                setFormVehiclePrice(parseInputValue(e.target.value))
                                                            }
                                                            className="crm-price-field w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white outline-none focus:border-crm-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {formVehicleType === 'Other' && (
                                            <div className="flex-1 min-w-0 space-y-2.5">
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 block">
                                                        Specify vehicle
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={formVehicleOther}
                                                        onChange={(e) => setFormVehicleOther(e.target.value)}
                                                        placeholder="e.g. Jeep, Cable car, Tuk-tuk"
                                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white outline-none focus:border-crm-500"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0 whitespace-nowrap">
                                                        Vehicle price
                                                    </label>
                                                    <div className="relative crm-price-field-wrap flex-1 min-w-0">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                            {currencySymbol}
                                                        </span>
                                                        <NumberInput
                                                            min={0}
                                                            step={priceInputStep}
                                                            value={
                                                                formVehiclePrice > 0
                                                                    ? formatInputValue(formVehiclePrice)
                                                                    : '0'
                                                            }
                                                            onChange={(e) =>
                                                                setFormVehiclePrice(parseInputValue(e.target.value))
                                                            }
                                                            className="crm-price-field w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white outline-none focus:border-crm-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {formVehicleType &&
                                            formVehicleType !== 'Car' &&
                                            formVehicleType !== 'Other' && (
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 sm:mt-[22px]">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0 whitespace-nowrap">
                                                        Vehicle price
                                                    </label>
                                                    <div className="relative crm-price-field-wrap flex-1 min-w-0">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                            {currencySymbol}
                                                        </span>
                                                        <NumberInput
                                                            min={0}
                                                            step={priceInputStep}
                                                            value={
                                                                formVehiclePrice > 0
                                                                    ? formatInputValue(formVehiclePrice)
                                                                    : '0'
                                                            }
                                                            onChange={(e) =>
                                                                setFormVehiclePrice(parseInputValue(e.target.value))
                                                            }
                                                            className="crm-price-field w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white outline-none focus:border-crm-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            <div className="lg:grid lg:grid-cols-[280px_1fr] gap-8">
                                {/* Activity Vault Sidebar — desktop only (drag & drop) */}
                                <div className="hidden lg:block space-y-4">
                                    <div className="sticky top-4">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                                            <Calculator size={14} /> Activity Vault
                                        </h3>
                                        <div className="relative mb-3">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input
                                                type="text"
                                                placeholder="Search sites..."
                                                value={activitySearch}
                                                onChange={e => setActivitySearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-crm-500 outline-none"
                                            />
                                        </div>

                                        {!showNewActivityForm ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowNewActivityForm(true);
                                                    setNewActivityError('');
                                                }}
                                                className="w-full mb-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold text-crm-700 bg-crm-50 border border-dashed border-crm-200 rounded-xl hover:bg-crm-100 transition-colors"
                                            >
                                                <Plus size={13} /> Add new activity
                                            </button>
                                        ) : (
                                            <div className="mb-3 p-3 space-y-2.5 bg-white border border-crm-200 rounded-xl shadow-sm">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-crm-700">New activity</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowNewActivityForm(false);
                                                            resetNewActivityForm();
                                                        }}
                                                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                                                        title="Close"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Destination country</label>
                                                    <div className="mt-1 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700">
                                                        {builderCountry || 'Not selected'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Title *</label>
                                                    <input
                                                        type="text"
                                                        value={newActivityTitle}
                                                        onChange={(e) => setNewActivityTitle(e.target.value)}
                                                        placeholder="Activity name"
                                                        className="mt-1 w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-crm-500"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Price *</label>
                                                        <NumberInput
                                                            min={0}
                                                            step={priceInputStep}
                                                            value={formatInputValue(newActivityPrice || 0)}
                                                            onChange={(e) => setNewActivityPrice(parseInputValue(e.target.value))}
                                                            className="mt-1 w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-crm-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Category *</label>
                                                        <div className="relative crm-select-wrap mt-1">
                                                            <select
                                                                value={newActivityCategory}
                                                                onChange={(e) => setNewActivityCategory(e.target.value)}
                                                                className="w-full px-2.5 py-2 pr-8 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-crm-500 appearance-none cursor-pointer bg-white"
                                                            >
                                                                <option>Nature</option>
                                                                <option>Adventure</option>
                                                                <option>Culture</option>
                                                                <option>Leisure</option>
                                                                <option>Dining</option>
                                                                <option>Modern</option>
                                                            </select>
                                                            <DropdownChevron size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Description *</label>
                                                    <textarea
                                                        value={newActivityDescription}
                                                        onChange={(e) => setNewActivityDescription(e.target.value)}
                                                        rows={2}
                                                        placeholder="Short description"
                                                        className="mt-1 w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-crm-500 resize-none"
                                                    />
                                                </div>
                                                {newActivityError && (
                                                    <p className="text-[10px] font-semibold text-rose-600">{newActivityError}</p>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const created = createActivityFromForm();
                                                        if (created) {
                                                            setDraggedActivity(created);
                                                            setActivitySearch(created.title || '');
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 text-[11px] font-black uppercase tracking-wide text-white bg-crm-600 hover:bg-crm-700 rounded-lg"
                                                >
                                                    Save activity
                                                </button>
                                            </div>
                                        )}

                                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar pb-10">
                                            {filteredVaultActivities.map(act => {
                                                    const isAssigned =
                                                        !isFreeDayActivity(act) &&
                                                        assignedActivityKeys.has(getActivityAssignmentKey(act));
                                                    return (
                                                    <div
                                                        key={act.id}
                                                        draggable={!isAssigned}
                                                        onDragStart={() => {
                                                            if (!isAssigned) setDraggedActivity(act);
                                                        }}
                                                        className={`p-3 border rounded-xl transition-all group ${
                                                            isAssigned
                                                                ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed'
                                                                : 'bg-white border-slate-200 cursor-grab active:cursor-grabbing hover:border-crm-300 hover:shadow-md'
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[11px] font-bold text-slate-800 line-clamp-1">{act.title}</span>
                                                            {isAssigned ? (
                                                                <span className="text-[9px] font-black uppercase text-slate-400 shrink-0 ml-1">Assigned</span>
                                                            ) : isFreeDayActivity(act) ? (
                                                                <span className="text-[9px] font-black uppercase text-emerald-600 shrink-0 ml-1">Reusable</span>
                                                            ) : (
                                                                <GripVertical size={12} className="text-slate-300 group-hover:text-crm-400" />
                                                            )}
                                                        </div>
                                                        <div className="flex justify-between items-baseline">
                                                            <span className="text-[10px] text-slate-400 uppercase font-medium">{act.category}</span>
                                                            <span className="text-[11px] font-bold text-crm-600">{formatMoney(act.price)}</span>
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                            {activitySearch.trim() &&
                                                !allActivities.some(
                                                    (a) =>
                                                        String(a.title || '')
                                                            .trim()
                                                            .toLowerCase() ===
                                                        activitySearch.trim().toLowerCase()
                                                ) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowNewActivityForm(true);
                                                            setNewActivityTitle(activitySearch.trim());
                                                            setNewActivityError('');
                                                        }}
                                                        className="w-full text-left px-3 py-2.5 text-sm font-bold text-crm-600 hover:bg-crm-50 border border-dashed border-crm-200 rounded-xl"
                                                    >
                                                        + Add &quot;{activitySearch.trim()}&quot; as new activity
                                                    </button>
                                                )}
                                        </div>
                                    </div>
                                </div>

                                {/* Main Itinerary Builder Area */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            <MapPin size={18} className="text-crm-600" /> Itinerary Design
                                        </h3>
                                    </div>
                                    <p className="text-[11px] text-slate-500 lg:hidden -mt-3">
                                        Tap <span className="font-bold text-crm-600">+</span> on a day to add activities from the list.
                                    </p>

                                    <div className="space-y-4">
                                        {formItinerary.map((day, idx) => (
                                            <div
                                                key={day.id}
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    if (!draggedActivity) return;
                                                    addActivityToItineraryDay(idx, draggedActivity);
                                                    setDraggedActivity(null);
                                                }}
                                                className={`p-4 rounded-2xl border-2 border-dashed bg-white transition-all group ${
                                                    itineraryValidationAttempted && !(day.activities || []).length
                                                        ? 'border-rose-300 hover:border-rose-400 ring-1 ring-rose-100'
                                                        : 'border-slate-200 hover:border-crm-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-full bg-crm-600 text-white flex items-center justify-center font-bold text-xs ring-4 ring-crm-50 shrink-0">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex flex-col gap-0.5">
                                                        <button
                                                            type="button"
                                                            disabled={idx === 0}
                                                            onClick={() => {
                                                                const newIt = [...formItinerary];
                                                                [newIt[idx], newIt[idx - 1]] = [newIt[idx - 1], newIt[idx]];

                                                                // Re-index Day numbers if they follow "Day X:" pattern
                                                                const fixedIt = newIt.map((d, i) => {
                                                                    if (d.title.match(/^Day \d+:/)) {
                                                                        return { ...d, title: `Day ${i + 1}: ${d.title.split(':').slice(1).join(':').trim()}` };
                                                                    }
                                                                    return d;
                                                                });
                                                                setFormItinerary(fixedIt);
                                                            }}
                                                            className="text-slate-300 hover:text-crm-500 disabled:opacity-0 transition-all font-bold"
                                                        >
                                                            <ChevronDown size={14} className="rotate-180" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={idx === formItinerary.length - 1}
                                                            onClick={() => {
                                                                const newIt = [...formItinerary];
                                                                [newIt[idx], newIt[idx + 1]] = [newIt[idx + 1], newIt[idx]];

                                                                // Re-index Day numbers if they follow "Day X:" pattern
                                                                const fixedIt = newIt.map((d, i) => {
                                                                    if (d.title.match(/^Day \d+:/)) {
                                                                        return { ...d, title: `Day ${i + 1}: ${d.title.split(':').slice(1).join(':').trim()}` };
                                                                    }
                                                                    return d;
                                                                });
                                                                setFormItinerary(fixedIt);
                                                            }}
                                                            className="text-slate-300 hover:text-crm-500 disabled:opacity-0 transition-all font-bold"
                                                        >
                                                            <ChevronDown size={14} />
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={day.title}
                                                        onChange={e => {
                                                            const newIt = [...formItinerary];
                                                            newIt[idx].title = e.target.value;
                                                            setFormItinerary(newIt);
                                                        }}
                                                        className="flex-1 min-w-0 font-bold text-slate-800 border-none focus:ring-0 p-0 text-sm bg-transparent"
                                                    />
                                                    {/* Tablet: add activity via popup */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActivityPickerDayIndex(idx);
                                                            setActivityPickerSearch('');
                                                        }}
                                                        className="lg:hidden p-2 rounded-xl bg-crm-50 text-crm-600 border border-crm-200 hover:bg-crm-100 transition-all shrink-0"
                                                        title="Add activity"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (window.confirm('Remove this day?')) {
                                                                setFormItinerary(formItinerary.filter(d => d.id !== day.id));
                                                            }
                                                        }}
                                                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                <div className="space-y-2 pl-0 sm:pl-11 min-h-[40px]">
                                                    {day.activities.map((act: any, aIdx: number) => (
                                                        <div key={aIdx} className="flex gap-3 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 group/item">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-crm-500" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    {(act.allowTitleEdit === true || isFreeDayActivity(act)) ? (
                                                                        <input
                                                                            type="text"
                                                                            value={act.title || ''}
                                                                            onChange={(e) => {
                                                                                const newIt = [...formItinerary];
                                                                                newIt[idx].activities[aIdx].title = e.target.value;
                                                                                newIt[idx].activities[aIdx].allowTitleEdit = true;
                                                                                setFormItinerary(newIt);
                                                                            }}
                                                                            className="text-[11px] font-bold text-slate-700 bg-transparent border-none p-0 focus:ring-0 outline-none w-full mr-2"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-[11px] font-bold text-slate-700 w-full mr-2">{act.title}</span>
                                                                    )}
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Cost:</span>
                                                                        <div className="relative crm-price-field-wrap">
                                                                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">{currencySymbol}</span>
                                                                            <NumberInput
                                                                                min={0}
                                                                                step={priceInputStep}
                                                                                value={formatInputValue(act.customPrice || 0)}
                                                                                onChange={(e) => {
                                                                                    const newIt = [...formItinerary];
                                                                                    newIt[idx].activities[aIdx].customPrice = parseInputValue(e.target.value);
                                                                                    setFormItinerary(newIt);
                                                                                }}
                                                                                className="crm-price-field-compact pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 focus:border-crm-500 outline-none"
                                                                            />
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const newIt = [...formItinerary];
                                                                                newIt[idx].activities.splice(aIdx, 1);
                                                                                setFormItinerary(newIt);
                                                                            }}
                                                                            className="p-1 text-slate-300 hover:text-red-500 transition-all opacity-100 lg:opacity-0 lg:group-hover/item:opacity-100"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                        <div className="hidden sm:flex flex-col gap-0.5 opacity-0 group-hover/item:opacity-100 transition-all ml-1 border-l border-slate-200 pl-1">
                                                                            <button
                                                                                type="button"
                                                                                disabled={aIdx === 0}
                                                                                onClick={() => {
                                                                                    const newIt = [...formItinerary];
                                                                                    const activities = [...newIt[idx].activities];
                                                                                    [activities[aIdx], activities[aIdx - 1]] = [activities[aIdx - 1], activities[aIdx]];
                                                                                    newIt[idx].activities = activities;
                                                                                    setFormItinerary(newIt);
                                                                                }}
                                                                                className="text-slate-300 hover:text-crm-500 disabled:opacity-0 transition-all"
                                                                            >
                                                                                <ChevronDown size={10} className="rotate-180" />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                disabled={aIdx === day.activities.length - 1}
                                                                                onClick={() => {
                                                                                    const newIt = [...formItinerary];
                                                                                    const activities = [...newIt[idx].activities];
                                                                                    [activities[aIdx], activities[aIdx + 1]] = [activities[aIdx + 1], activities[aIdx]];
                                                                                    newIt[idx].activities = activities;
                                                                                    setFormItinerary(newIt);
                                                                                }}
                                                                                className="text-slate-300 hover:text-crm-500 disabled:opacity-0 transition-all"
                                                                            >
                                                                                <ChevronDown size={10} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 line-clamp-1">{act.description}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {day.activities.length === 0 && (
                                                        <div className={`py-4 text-center text-[10px] font-medium italic border border-dashed rounded-xl ${
                                                            itineraryValidationAttempted
                                                                ? 'text-rose-600 border-rose-200 bg-rose-50/50'
                                                                : 'text-slate-400 border-slate-100'
                                                        }`}>
                                                            {itineraryValidationAttempted
                                                                ? 'Add at least one activity to this day'
                                                                : (
                                                                    <>
                                                                        <span className="hidden lg:inline">Drag an activity here from the vault</span>
                                                                        <span className="lg:hidden">Tap + to add an activity</span>
                                                                    </>
                                                                )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex flex-col items-end gap-2 pt-3 mt-1 border-t border-slate-200">
                                            {itineraryValidationAttempted && !isItineraryActivitiesComplete && (
                                                <p className="text-[11px] font-semibold text-rose-600 w-full text-right">
                                                    Every day needs at least one activity before continuing.
                                                </p>
                                            )}
                                            <div className="w-full sm:w-auto sm:min-w-[16rem] space-y-1.5 text-right">
                                                <div className="flex items-baseline justify-between gap-6 text-[11px] font-semibold text-slate-500">
                                                    <span className="uppercase tracking-wider">Activity Cost Total</span>
                                                    <span className="tabular-nums text-slate-700 crm-price-amount">
                                                        {formatMoney(itineraryActivitiesTotal)}
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline justify-between gap-6 text-[11px] font-semibold text-slate-500">
                                                    <span className="uppercase tracking-wider">Vehicle</span>
                                                    <span className="tabular-nums text-slate-700 crm-price-amount">
                                                        {formatMoney(itineraryVehicleCost)}
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline justify-between gap-6 pt-2 border-t border-slate-200 text-xs font-black text-slate-700">
                                                    <span className="uppercase tracking-wider">Total</span>
                                                    <span className="text-base text-crm-800 tabular-nums crm-price-amount">
                                                        {formatMoney(itineraryGrandTotal)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </div>
                            )}

                            {/* Tablet activity picker popup */}
                            {activityPickerDayIndex !== null && (
                                <div className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center lg:hidden">
                                    <div
                                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                                        onClick={() => setActivityPickerDayIndex(null)}
                                    />
                                    <div className="relative w-full sm:max-w-md max-h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
                                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                                            <div className="min-w-0">
                                                <h3 className="text-base font-black text-slate-900 tracking-tight">
                                                    Add Activity
                                                </h3>
                                                <p className="text-[11px] text-slate-500 font-medium truncate">
                                                    {formItinerary[activityPickerDayIndex]?.title || `Day ${activityPickerDayIndex + 1}`}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setActivityPickerDayIndex(null)}
                                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                        <div className="px-4 py-3 border-b border-slate-50 shrink-0">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                <input
                                                    type="text"
                                                    value={activityPickerSearch}
                                                    onChange={(e) => setActivityPickerSearch(e.target.value)}
                                                    placeholder="Search activities..."
                                                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-crm-500"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                            {filteredPickerActivities.map((act) => {
                                                const isAssigned =
                                                    !isFreeDayActivity(act) &&
                                                    assignedActivityKeys.has(getActivityAssignmentKey(act));
                                                return (
                                                    <button
                                                        key={act.id}
                                                        type="button"
                                                        disabled={isAssigned}
                                                        onClick={() => {
                                                            if (isAssigned) return;
                                                            const added = addActivityToItineraryDay(activityPickerDayIndex, act);
                                                            if (added) setActivityPickerDayIndex(null);
                                                        }}
                                                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                                                            isAssigned
                                                                ? 'bg-slate-50 border-slate-100 opacity-55 cursor-not-allowed'
                                                                : 'bg-white border-slate-200 hover:border-crm-300 hover:bg-crm-50/40 active:scale-[0.99]'
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-start gap-2 mb-1">
                                                            <span className="text-sm font-bold text-slate-800">{act.title}</span>
                                                            {isAssigned ? (
                                                                <span className="text-[9px] font-black uppercase text-slate-400 shrink-0">Assigned</span>
                                                            ) : (
                                                                <span className="text-xs font-bold text-crm-600 shrink-0">{formatMoney(act.price)}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] text-slate-400 uppercase font-medium">{act.category}</span>
                                                            {isFreeDayActivity(act) && (
                                                                <span className="text-[10px] font-bold text-emerald-600">Reusable</span>
                                                            )}
                                                            {isAssigned && (
                                                                <span className="text-[10px] text-slate-400">Already in itinerary</span>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            {filteredPickerActivities.length === 0 && (
                                                <p className="py-8 text-center text-xs text-slate-400 font-medium">
                                                    No activities match your search
                                                </p>
                                            )}
                                            {activityPickerSearch.trim() &&
                                                !allActivities.some(
                                                    (a) =>
                                                        String(a.title || '')
                                                            .trim()
                                                            .toLowerCase() ===
                                                        activityPickerSearch.trim().toLowerCase()
                                                ) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowNewActivityForm(true);
                                                            setNewActivityTitle(activityPickerSearch.trim());
                                                            setNewActivityError('');
                                                            setActivityPickerDayIndex(null);
                                                        }}
                                                        className="w-full text-left px-3 py-3 text-sm font-bold text-crm-600 hover:bg-crm-50 border border-dashed border-crm-200 rounded-xl"
                                                    >
                                                        + Add &quot;{activityPickerSearch.trim()}&quot; as new activity
                                                    </button>
                                                )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {builderStep === 'additional' && (
                                <div className="space-y-5 border-t border-slate-100 pt-6">
                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:col-span-2">
                                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800">Activities &amp; rates</h3>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    Add optional activities, extras, or fees to show on the quotation.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setFormAdditionalActivities((prev) => [
                                                        ...prev,
                                                        createAdditionalActivity(),
                                                    ])
                                                }
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-crm-700 bg-crm-50 border border-crm-200 hover:bg-crm-100 transition-colors"
                                            >
                                                <Plus size={14} /> Add activity
                                            </button>
                                        </div>

                                        {formAdditionalActivities.length === 0 ? (
                                            <div className="text-xs text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-8 text-center">
                                                No activities added yet. Click &quot;Add activity&quot; to create line items with a name, description, and rate.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="hidden sm:grid sm:grid-cols-[1fr_minmax(11rem,13rem)_40px] gap-2 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <span>Activity details</span>
                                                    <span className="text-right">Rate ({currencySymbol})</span>
                                                    <span />
                                                </div>
                                                {formAdditionalActivities.map((row) => (
                                                    <div
                                                        key={row.id}
                                                        className="grid grid-cols-1 sm:grid-cols-[1fr_minmax(11rem,13rem)_40px] gap-2 items-start bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5"
                                                    >
                                                        <div className="space-y-2 min-w-0">
                                                            <input
                                                                type="text"
                                                                value={row.title}
                                                                onChange={(e) =>
                                                                    setFormAdditionalActivities((prev) =>
                                                                        prev.map((r) =>
                                                                            r.id === row.id
                                                                                ? { ...r, title: e.target.value }
                                                                                : r
                                                                        )
                                                                    )
                                                                }
                                                                placeholder="e.g. Scuba diving"
                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 bg-white outline-none focus:border-crm-400"
                                                            />
                                                            <textarea
                                                                value={row.description}
                                                                onChange={(e) =>
                                                                    setFormAdditionalActivities((prev) =>
                                                                        prev.map((r) =>
                                                                            r.id === row.id
                                                                                ? { ...r, description: e.target.value }
                                                                                : r
                                                                        )
                                                                    )
                                                                }
                                                                rows={2}
                                                                placeholder="Add a short description (duration, inclusions, notes…)"
                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white outline-none focus:border-crm-400 resize-none"
                                                            />
                                                        </div>
                                                        <div className="relative crm-price-field-wrap sm:pt-0.5">
                                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                                                                {currencySymbol}
                                                            </span>
                                                            <NumberInput
                                                                min={0}
                                                                step={priceInputStep}
                                                                value={formatInputValue(row.rate || 0)}
                                                                onChange={(e) =>
                                                                    setFormAdditionalActivities((prev) =>
                                                                        prev.map((r) =>
                                                                            r.id === row.id
                                                                                ? {
                                                                                      ...r,
                                                                                      rate: parseInputValue(e.target.value),
                                                                                  }
                                                                                : r
                                                                        )
                                                                    )
                                                                }
                                                                placeholder="0"
                                                                className="crm-price-field pl-7 pr-2 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 bg-white outline-none focus:border-crm-400"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setFormAdditionalActivities((prev) =>
                                                                    prev.filter((r) => r.id !== row.id)
                                                                )
                                                            }
                                                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 justify-self-end sm:justify-self-start sm:mt-0.5"
                                                            title="Remove"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <p className="text-right text-xs font-black text-crm-700 pt-2">
                                                    Subtotal:{' '}
                                                    {formatMoney(
                                                        formAdditionalActivities.reduce(
                                                            (sum, r) => sum + (Number(r.rate) || 0),
                                                            0
                                                        )
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                                        <h3 className="text-sm font-bold text-slate-800 mb-3">Notes & Special Requests</h3>
                                        <textarea
                                            value={formQuoteNotes}
                                            onChange={(e) => setFormQuoteNotes(e.target.value)}
                                            rows={5}
                                            placeholder="Special inclusions, honeymoon requests, internal notes..."
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 resize-none focus:ring-2 focus:ring-crm-400/30 focus:border-crm-400 outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ── Section 4: Live Price Summary & Branching Loop ── */}
                            {builderStep === 'review' && (
                            <div className="space-y-6 pt-4 border-t border-slate-100">
                                <QuoteBuilderReviewPreview
                                    onEditStep={navigateToBuilderStep}
                                    customerName={formCustomer}
                                    phone={formPhone}
                                    countryCode={formCountryCode}
                                    adults={formAdults}
                                    kids={formKids}
                                    kidsAges={formKidsAges}
                                    departureDate={formDepartureDate}
                                    returnDate={computedReturnDate}
                                    agentName={formAgentName}
                                    sourceCountry={formSourceCountry}
                                    sourceAirport={formSourceAirport}
                                    destination={builderDestination}
                                    packageName={livePreset?.name || formPresetInput}
                                    tripMode={tripMode}
                                    duration={effectiveDuration}
                                    tripId={formTripId}
                                    hotelStays={formHotelStays}
                                    hotelSelectionConfirmed={hotelSelectionConfirmed}
                                    getStayDateLabel={getStayDateLabel}
                                    getHotelName={(id) => getHotelRecord(id)?.name || 'Hotel'}
                                    itinerary={formItinerary}
                                    transportation={itineraryVehicleLabel}
                                    vehiclePrice={formVehiclePrice}
                                    hotelMealPlan={formHotelMealPlan}
                                    needFlight={formNeedFlight}
                                    flightMeal={formFlightMeal}
                                    customFlightTotal={customFlightTotal}
                                    additionalActivities={formAdditionalActivities}
                                />

                                <QuoteAdditionalServiceChargeSection
                                    value={formAdditionalServiceCharge}
                                    onChange={setFormAdditionalServiceCharge}
                                    servicesTotal={activeEstimate.breakdown.services}
                                    chargeAmount={activeEstimate.additionalServiceCharge}
                                    packageBase={
                                        activeEstimate.subtotal +
                                        activeEstimate.additionalServiceCharge
                                    }
                                    gstOnPackageAmount={activeEstimate.gstOnPackage || 0}
                                    gstOnAdditionalAmount={activeEstimate.gstOnAdditional || 0}
                                />

                                <QuoteTermsSelector
                                    termsOptions={availableTermsOptions}
                                    selectedTermsId={formTermsId || selectedBuilderTerms.id}
                                    onSelect={handleSelectQuoteTerms}
                                    selectedTerms={selectedBuilderTerms}
                                    suggestedTermsId={suggestedTerms?.id}
                                    destinationLabel={
                                        builderCountry ||
                                        builderDestination?.split(',').pop()?.trim() ||
                                        builderDestination
                                    }
                                />

                            <div className="flex flex-col md:flex-row gap-6 items-end">
                                <div className="flex-1 bg-slate-900 rounded-2xl p-5 text-white w-full">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                                            {activeEstimate.total === 0 ? 'Drafting Itinerary...' : 'Total Estimate'}
                                        </span>
                                        {activeEstimate.total > 0 && <span className="text-xs text-crm-400 font-bold">{formatMoney(activeEstimate.perPersonBase)} / PP</span>}
                                    </div>
                                    <div className="flex justify-between items-baseline mb-4">
                                        <h4 className={`text-3xl font-black tracking-tight transition-all ${activeEstimate.total === 0 ? 'text-slate-700' : 'text-white'}`}>
                                            {formatMoney(activeEstimate.total)}
                                        </h4>
                                        <div className="text-right">
                                            {activeEstimate.total > 0 ? (
                                                <>
                                                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-tighter italic">Fully Loaded Package Price</span>
                                                    <span className="text-xs text-emerald-400 font-black">{activeEstimate.travelersLabel}</span>
                                                </>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Select Package to Begin</span>
                                            )}
                                        </div>
                                    </div>

                                    {activeEstimate.total > 0 && (() => {
                                        const showBaseTravel =
                                            tripMode === 'package' && activeEstimate.breakdown.baseTravel > 0;
                                        const servicesLabel =
                                            tripMode === 'custom' ? 'Hotel + itinerary' : 'Services';
                                        const estimateRows = [
                                            ...(showBaseTravel
                                                ? [
                                                      {
                                                          key: 'base-travel',
                                                          label: 'Base Travel',
                                                          amount: activeEstimate.breakdown.baseTravel,
                                                          className: 'text-slate-200',
                                                      },
                                                  ]
                                                : []),
                                            {
                                                key: 'services',
                                                label: servicesLabel,
                                                amount: activeEstimate.breakdown.services,
                                                className: 'text-slate-200',
                                            },
                                            ...(activeEstimate.additionalServiceCharge > 0
                                                ? [
                                                      {
                                                          key: 'service-charge',
                                                          label: 'Additional Service Charge',
                                                          amount: activeEstimate.additionalServiceCharge,
                                                          className: 'text-crm-400',
                                                      },
                                                  ]
                                                : []),
                                            ...((activeEstimate.gstOnPackage || 0) > 0
                                                ? [
                                                      {
                                                          key: 'gst-package',
                                                          label: 'GST on Package (5%)',
                                                          amount: activeEstimate.gstOnPackage || 0,
                                                          className: 'text-emerald-400',
                                                      },
                                                  ]
                                                : []),
                                            ...((activeEstimate.gstOnAdditional || 0) > 0
                                                ? [
                                                      {
                                                          key: 'gst-additional',
                                                          label: 'GST on Additional (18%)',
                                                          amount: activeEstimate.gstOnAdditional || 0,
                                                          className: 'text-emerald-400',
                                                      },
                                                  ]
                                                : []),
                                        ];

                                        return (
                                            <div
                                                className="grid gap-4 pt-4 border-t border-slate-800"
                                                style={{
                                                    gridTemplateColumns: `repeat(${estimateRows.length}, minmax(0, 1fr))`,
                                                }}
                                            >
                                                {estimateRows.map((row) => (
                                                    <div key={row.key}>
                                                        <span className="block text-[8px] text-slate-500 uppercase font-black tracking-[1px] mb-1">
                                                            {row.label}
                                                        </span>
                                                        <span className={`text-sm font-bold ${row.className}`}>
                                                            {formatMoney(row.amount)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="flex gap-3 w-full md:w-fit">
                                    <button
                                        type="button"
                                        onClick={handleManualFinalize}
                                        className="flex-1 md:flex-none px-8 py-3 bg-crm-600 hover:bg-crm-700 text-white shadow-lg shadow-crm-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {editingParentQuote
                                            ? `Save as v${nextEditVersion || '…'}`
                                            : 'Finish and Send'}
                                    </button>
                                </div>
                            </div>
                            </div>
                            )}
                        </div>
                        {renderBuilderStepFooter()}
                        </form>
                    </div>
                )}

            {/* Immersive Quotation Preview Modal (PDF / print) */}
            {!isCreating && selectedQuote && showQuotePrintPreview && (
                <div className="quote-print-modal fixed inset-0 z-[2000] flex flex-col items-center print:bg-white print:p-0">
                    {/* Premium Black Glass Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-[20px] -z-10 transition-all duration-500 print:hidden"
                        onClick={closeQuotePreview}
                    ></div>

                    {/* Fixed Controls */}
                    <div className="fixed top-8 right-8 flex gap-4 z-[2020] print:hidden">
                        <button 
                            onClick={() => handleEditMode()} 
                            className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl backdrop-blur-md border border-white/20 shadow-2xl transition-all flex items-center gap-3 active:scale-95 font-bold"
                        >
                            <Edit3 size={18} /> Modify
                        </button>
                        {canShareQuotes && (
                            <>
                                <button
                                    onClick={handleWhatsAppShare}
                                    className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-emerald-700 transition-all flex items-center gap-3 active:scale-95"
                                >
                                    <Send size={18} /> WhatsApp
                                </button>
                                <button
                                    onClick={handleEmailShare}
                                    className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-blue-700 transition-all flex items-center gap-3 active:scale-95"
                                >
                                    <Mail size={18} /> Email
                                </button>
                            </>
                        )}
                        {canDownloadQuotePdf && (
                            <>
                                <button
                                    onClick={handleQuotePdfDownload}
                                    disabled={isQuotePdfDownloading}
                                    className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-slate-50 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <Download size={18} /> {isQuotePdfDownloading ? 'Preparing…' : 'Download PDF'}
                                </button>
                                <button
                                    onClick={() => window.print()}
                                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl backdrop-blur-md border border-white/20 shadow-2xl transition-all flex items-center gap-3 active:scale-95 font-bold"
                                >
                                    <FileText size={18} /> Print
                                </button>
                            </>
                        )}
                        <button 
                            onClick={closeQuotePreview} 
                            className="bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-2xl transition-all active:scale-95"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Scrollable Document Container — block layout so quote can grow past one page */}
                    <div className="quote-print-scroll w-full h-full overflow-y-auto py-12 px-4 print:overflow-visible print:h-auto">
                        <div 
                            ref={quotePrintRef}
                            id="printable-quote" 
                            className="quote-print-document block bg-white w-[210mm] max-w-full mx-auto p-16 shadow-[0_0_80px_rgba(0,0,0,0.5)] rounded-[40px] overflow-visible print:block print:overflow-visible print:rounded-none print:shadow-none print:w-full print:max-w-none print:p-0 print:m-0 print:min-h-0 print:h-auto"
                            style={{
                                minHeight: '297mm',
                                height: 'fit-content',
                                backgroundColor: '#ffffff',
                                flexShrink: 0,
                            }}
                        >
                            {/* Repeats on every printed page — same header format */}
                            <header className="quote-print-running-header hidden print:flex">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 bg-slate-900 text-white rounded-md flex items-center justify-center text-xs font-black shrink-0 overflow-hidden">
                                        {quoteBranding?.logoUrl ? (
                                            <img src={quoteBranding.logoUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            (quoteBranding?.name || agencyName).charAt(0)
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black text-slate-900 uppercase tracking-tight truncate leading-tight">
                                            {quoteBranding?.name || agencyName}
                                        </p>
                                        <p className="text-[6px] font-black text-crm-600 uppercase tracking-[0.2em]">
                                            Premium Itinerary
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 pl-4">
                                    <p className="text-[8px] font-black text-slate-900 uppercase">
                                        {(editingQuote || selectedQuote)?.customer}
                                    </p>
                                    <p className="text-[6px] font-bold text-slate-500 uppercase tracking-widest">
                                        {(editingQuote || selectedQuote)?.destination}
                                    </p>
                                </div>
                            </header>

                            <footer className="quote-print-running-footer hidden print:flex">
                                <p className="font-bold uppercase tracking-wider">
                                    Valid until:{' '}
                                    {new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')}
                                </p>
                                <p className="font-bold uppercase tracking-wider text-center">
                                    {(editingQuote || selectedQuote)?.agentName || quoteBranding?.name || agencyName}
                                </p>
                                <p className="quote-print-page-num font-bold uppercase tracking-wider" />
                            </footer>

                            <div className="quote-print-body block w-full h-auto">
                            {/* Letterhead — screen preview only; PDF uses running header on every page */}
                            <div className="print:hidden flex justify-between items-start mb-12 border-b-4 border-slate-900 pb-8">
                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex items-center justify-center text-3xl font-black shadow-xl overflow-hidden">
                                            {quoteBranding?.logoUrl ? (
                                                <img src={quoteBranding.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                (quoteBranding?.name || agencyName).charAt(0)
                                            )}
                                        </div>
                                        <div>
                                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{quoteBranding?.name || agencyName}</h1>
                                            <p className="text-[10px] font-black text-crm-600 tracking-[0.3em] uppercase mt-1">Premium Itinerary Design</p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest space-y-1">
                                        <p className="text-slate-900 font-black tracking-widest">Valid Until: {new Date(new Date().getTime() + 7*24*60*60*1000).toLocaleDateString('en-GB')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-5xl font-black text-slate-100 uppercase tracking-tighter mb-4 leading-none italic">ITINERARY</h2>
                                    <div className="space-y-1">
                                        <p className="text-base font-black text-slate-900 uppercase">{(editingQuote || selectedQuote)?.customer}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            DATE:{' '}
                                            {(() => {
                                                const q = editingQuote || selectedQuote;
                                                const created = q?.createdAt
                                                    ? new Date(q.createdAt)
                                                    : null;
                                                if (created && !Number.isNaN(created.getTime())) {
                                                    return created.toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    });
                                                }
                                                return q?.date || '';
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Trip Overview Cards */}
                            <div className="print-break-avoid grid grid-cols-4 gap-3 mb-8 print:mb-6 items-stretch">
                                <div className="pdf-break-avoid bg-slate-50 px-3 py-3 rounded-2xl border border-slate-100 overflow-visible min-w-0">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Destination</p>
                                    <p className="text-[11px] font-black text-slate-900 leading-snug break-words whitespace-normal">
                                        {(editingQuote || selectedQuote)?.destination}
                                    </p>
                                </div>
                                <div className="pdf-break-avoid bg-slate-50 px-3 py-3 rounded-2xl border border-slate-100 overflow-visible min-w-0">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Duration</p>
                                    <p className="text-[11px] font-black text-slate-900 leading-snug break-words whitespace-normal">
                                        {getDurationDaysLabel((editingQuote || selectedQuote)?.duration)}
                                    </p>
                                </div>
                                <div className="pdf-break-avoid bg-slate-50 px-3 py-3 rounded-2xl border border-slate-100 overflow-visible min-w-0">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Travelers</p>
                                    <p className="text-[11px] font-black text-slate-900 leading-snug break-words whitespace-normal">
                                        {(editingQuote || selectedQuote)?.travelers}
                                    </p>
                                </div>
                                <div className="pdf-break-avoid bg-slate-900 text-white px-3 py-3 rounded-2xl overflow-visible min-w-0">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Quote</p>
                                    <p className="text-[11px] font-black text-crm-400 leading-snug break-words whitespace-normal">
                                        {formatMoney(editingQuote ? editingQuote.total : getQuoteDisplayTotal(selectedQuote))}
                                    </p>
                                </div>
                            </div>

                            {(() => {
                                const printQuote = editingQuote || selectedQuote;
                                if (!printQuote) return null;
                                const printPricing = getQuotePricingDisplay(printQuote, db);
                                const printStays = (printQuote.hotelStays || []).filter(
                                    (s: any) => s?.hotelId || s?.hotelInput
                                );
                                const formatPrintStayDay = (d: Date) => {
                                    const day = d.getDate();
                                    const suffix =
                                        day % 10 === 1 && day !== 11
                                            ? 'st'
                                            : day % 10 === 2 && day !== 12
                                              ? 'nd'
                                              : day % 10 === 3 && day !== 13
                                                ? 'rd'
                                                : 'th';
                                    const month = d.toLocaleDateString('en-US', { month: 'short' });
                                    return `${day}${suffix} ${month}`;
                                };
                                const getPrintStayDateLabel = (stayIdx: number) => {
                                    if (!printQuote.departureDate) return '';
                                    const allStays = printQuote.hotelStays || [];
                                    const stay = allStays[stayIdx];
                                    const nights = Math.max(1, Number(stay?.nights || 1));
                                    const offset = allStays
                                        .slice(0, stayIdx)
                                        .reduce(
                                            (sum: number, s: any) =>
                                                sum + Math.max(1, Number(s?.nights || 1)),
                                            0
                                        );
                                    const start = new Date(printQuote.departureDate);
                                    if (Number.isNaN(start.getTime())) return '';
                                    start.setDate(start.getDate() + offset);
                                    const end = new Date(start);
                                    end.setDate(end.getDate() + Math.max(0, nights - 1));
                                    return nights === 1
                                        ? formatPrintStayDay(start)
                                        : `${formatPrintStayDay(start)} - ${formatPrintStayDay(end)}`;
                                };
                                const getPrintNightStart = (stayIdx: number) => {
                                    if (!printQuote.departureDate) return null;
                                    const allStays = printQuote.hotelStays || [];
                                    const offset = allStays
                                        .slice(0, stayIdx)
                                        .reduce(
                                            (sum: number, s: any) =>
                                                sum + Math.max(1, Number(s?.nights || 1)),
                                            0
                                        );
                                    const start = new Date(printQuote.departureDate);
                                    if (Number.isNaN(start.getTime())) return null;
                                    start.setDate(start.getDate() + offset);
                                    return start;
                                };

                                return (
                                    <div className="w-full h-auto">
                                        {/* Hotel Selection */}
                                        {printStays.length > 0 && (
                                            <div className="mb-8">
                                                <h3 className="quote-print-section-title text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 border-b-2 border-slate-100 pb-2">
                                                    Hotel Stays
                                                </h3>
                                                <div className="space-y-4">
                                                    {(printQuote.hotelStays || []).map(
                                                        (stay: any, idx: number) => {
                                                            if (!stay?.hotelId && !stay?.hotelInput) {
                                                                return null;
                                                            }
                                                            const hotel = (
                                                                db?.hotels?.data || []
                                                            ).find(
                                                                (h: any) => h.id === stay.hotelId
                                                            );
                                                            const hotelName =
                                                                stay.hotelInput?.trim() ||
                                                                hotel?.name ||
                                                                'Hotel';
                                                            const nights = Math.max(
                                                                1,
                                                                Number(stay.nights) || 1
                                                            );
                                                            const stayDates =
                                                                getPrintStayDateLabel(idx);
                                                            const nightStart =
                                                                getPrintNightStart(idx);
                                                            const stayTotal =
                                                                sumStayHotelTotal(stay);
                                                            const nightPrices = Array.isArray(
                                                                stay.nightPrices
                                                            )
                                                                ? stay.nightPrices.slice(0, nights)
                                                                : [];
                                                            const inclusions = (
                                                                stay.specialInclusions || []
                                                            ).filter((s: any) => s?.name?.trim());
                                                            return (
                                                                <div
                                                                    key={stay.hotelId || idx}
                                                                    className="bg-slate-50 rounded-2xl border border-slate-100 p-5 overflow-visible"
                                                                >
                                                                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pdf-break-avoid">
                                                                        <div>
                                                                            <p className="text-[9px] font-black text-crm-600 uppercase tracking-widest mb-1">
                                                                                Stay {idx + 1}
                                                                                {stayDates
                                                                                    ? ` · ${stayDates}`
                                                                                    : ''}
                                                                            </p>
                                                                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                                                                {hotelName}
                                                                            </h4>
                                                                            <p className="text-[10px] font-bold text-slate-500 mt-1">
                                                                                {nights} night
                                                                                {nights > 1
                                                                                    ? 's'
                                                                                    : ''}
                                                                                {(stay.city ||
                                                                                    hotel?.city) &&
                                                                                    ` · ${stay.city || hotel?.city}`}
                                                                            </p>
                                                                        </div>
                                                                        {stayTotal > 0 && (
                                                                            <p className="text-sm font-black text-crm-600">
                                                                                {formatMoney(
                                                                                    stayTotal
                                                                                )}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                                                        <div>
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                                                Room
                                                                            </p>
                                                                            <p className="text-[10px] font-black text-slate-800">
                                                                                {stay.roomType ||
                                                                                    'Standard'}
                                                                            </p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                                                Meal plan
                                                                            </p>
                                                                            <p className="text-[10px] font-black text-slate-800">
                                                                                {stay.mealPlan ||
                                                                                    printQuote.hotelMealPlan ||
                                                                                    '—'}
                                                                            </p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                                                Rooms / Pax
                                                                            </p>
                                                                            <p className="text-[10px] font-black text-slate-800">
                                                                                {stay.rooms || 1}{' '}
                                                                                room ·{' '}
                                                                                {stay.personsPerRoom ||
                                                                                    2}{' '}
                                                                                pax/room
                                                                            </p>
                                                                        </div>
                                                                        {(stay.extraBed || 0) >
                                                                            0 && (
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                                                    Extra beds
                                                                                </p>
                                                                                <p className="text-[10px] font-black text-slate-800">
                                                                                    {stay.extraBed}{' '}
                                                                                    @{' '}
                                                                                    {formatMoney(
                                                                                        stay.extraBedPrice ||
                                                                                            0
                                                                                    )}
                                                                                    /night
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                        {(stay.childWithBed || 0) >
                                                                            0 && (
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                                                    Child with bed
                                                                                </p>
                                                                                <p className="text-[10px] font-black text-slate-800">
                                                                                    {
                                                                                        stay.childWithBed
                                                                                    }{' '}
                                                                                    @{' '}
                                                                                    {formatMoney(
                                                                                        stay.childWithBedPrice ||
                                                                                            0
                                                                                    )}
                                                                                    /night
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                        {(stay.childWithoutBed ||
                                                                            0) > 0 && (
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                                                    Child w/o bed
                                                                                </p>
                                                                                <p className="text-[10px] font-black text-slate-800">
                                                                                    {
                                                                                        stay.childWithoutBed
                                                                                    }{' '}
                                                                                    @{' '}
                                                                                    {formatMoney(
                                                                                        stay.childWithoutBedPrice ||
                                                                                            0
                                                                                    )}
                                                                                    /night
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {nightPrices.length > 0 && (
                                                                        <div className="pt-3 border-t border-slate-200/80">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                                                Night-wise stays
                                                                            </p>
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                {nightPrices.map(
                                                                                    (
                                                                                        np: any,
                                                                                        nIdx: number
                                                                                    ) => {
                                                                                        const nightDate =
                                                                                            nightStart
                                                                                                ? new Date(
                                                                                                      nightStart
                                                                                                  )
                                                                                                : null;
                                                                                        if (
                                                                                            nightDate
                                                                                        ) {
                                                                                            nightDate.setDate(
                                                                                                nightDate.getDate() +
                                                                                                    nIdx
                                                                                            );
                                                                                        }
                                                                                        const dateLabel =
                                                                                            nightDate
                                                                                                ? formatHotelNightDateLabel(
                                                                                                      nightDate
                                                                                                  )
                                                                                                : null;
                                                                                        const amount =
                                                                                            Number.isFinite(
                                                                                                Number(
                                                                                                    np?.given
                                                                                                )
                                                                                            )
                                                                                                ? Number(
                                                                                                      np.given
                                                                                                  )
                                                                                                : Number(
                                                                                                      np?.rate
                                                                                                  ) ||
                                                                                                  0;
                                                                                        return (
                                                                                            <div
                                                                                                key={
                                                                                                    nIdx
                                                                                                }
                                                                                                className="pdf-break-avoid flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2"
                                                                                            >
                                                                                                <span className="text-[9px] font-bold text-slate-700">
                                                                                                    Night{' '}
                                                                                                    {nIdx +
                                                                                                        1}
                                                                                                    {dateLabel
                                                                                                        ? ` · ${dateLabel.datePart}`
                                                                                                        : ''}
                                                                                                </span>
                                                                                                <span className="text-[9px] font-black text-crm-600">
                                                                                                    {formatMoney(
                                                                                                        amount
                                                                                                    )}
                                                                                                </span>
                                                                                            </div>
                                                                                        );
                                                                                    }
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {inclusions.length > 0 && (
                                                                        <ul className="mt-3 space-y-1">
                                                                            {inclusions.map(
                                                                                (s: any) => (
                                                                                    <li
                                                                                        key={
                                                                                            s.id ||
                                                                                            s.name
                                                                                        }
                                                                                        className="text-[9px] font-medium text-slate-600"
                                                                                    >
                                                                                        + {s.name}
                                                                                        {s.amount !=
                                                                                            null &&
                                                                                        s.amount > 0
                                                                                            ? ` (${formatMoney(s.amount)})`
                                                                                            : ''}
                                                                                    </li>
                                                                                )
                                                                            )}
                                                                        </ul>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Detailed Itinerary */}
                                        {printQuote.itinerary?.length > 0 && (
                                            <div className="mb-8">
                                                <h3 className="quote-print-section-title text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 border-b-2 border-slate-100 pb-2">
                                                    Planned Itinerary
                                                </h3>
                                                {(printQuote.transportation ||
                                                    (Number(printQuote.vehiclePrice) || 0) >
                                                        0) && (
                                                    <p className="text-[10px] font-bold text-slate-600 mb-4">
                                                        {printQuote.transportation
                                                            ? `Travel vehicle: ${printQuote.transportation}`
                                                            : ''}
                                                        {(Number(printQuote.vehiclePrice) || 0) >
                                                            0 &&
                                                            ` · ${formatMoney(Number(printQuote.vehiclePrice) || 0)}`}
                                                    </p>
                                                )}
                                                <div className="space-y-6">
                                                    {printQuote.itinerary.map(
                                                        (day: any, idx: number) => {
                                                            const dayTitle =
                                                                day.title || `Day ${idx + 1}`;
                                                            const titleParts = dayTitle.split(':');
                                                            const dayLabel = titleParts[0];
                                                            const dayTheme =
                                                                titleParts
                                                                    .slice(1)
                                                                    .join(':')
                                                                    .trim() || 'Sightseeing';
                                                            const activities = Array.isArray(
                                                                day.activities
                                                            )
                                                                ? day.activities
                                                                : [];
                                                            return (
                                                                <div
                                                                    key={day.id || idx}
                                                                    className="relative pl-8 border-l-2 border-slate-100 last:border-l-0"
                                                                >
                                                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-slate-900" />
                                                                    <div className="pdf-break-avoid mb-3">
                                                                        <span className="text-[9px] font-black text-crm-600 uppercase tracking-widest">
                                                                            {dayLabel}
                                                                        </span>
                                                                        <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight leading-snug">
                                                                            {dayTheme}
                                                                        </h4>
                                                                    </div>
                                                                    {activities.length > 0 ? (
                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            {activities.map(
                                                                                (
                                                                                    act: any,
                                                                                    aIdx: number
                                                                                ) => (
                                                                                    <div
                                                                                        key={aIdx}
                                                                                        className="pdf-break-avoid bg-slate-50 rounded-xl p-3 border border-slate-100 overflow-visible"
                                                                                    >
                                                                                        <p className="text-[10px] font-black text-slate-800 mb-1 leading-snug break-words">
                                                                                            {act.title ||
                                                                                                act.name ||
                                                                                                'Activity'}
                                                                                        </p>
                                                                                        {act.description && (
                                                                                            <p className="text-[9px] text-slate-500 font-medium leading-relaxed break-words">
                                                                                                {
                                                                                                    act.description
                                                                                                }
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest italic">
                                                                            Leisure / Free time
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Pricing: services, additional charge, GST, total */}
                                        <div className="print-break-avoid mt-12 pt-8 border-t-4 border-slate-900">
                                            <h3 className="quote-print-section-title text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6">
                                                Quote Summary
                                            </h3>
                                            <div className="space-y-3 mb-6">
                                                <div className="flex justify-between items-center gap-4">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                        Hotel + Itinerary
                                                    </p>
                                                    <p className="text-xs font-black text-slate-800">
                                                        {formatMoney(printPricing.subtotal)}
                                                    </p>
                                                </div>
                                                {printPricing.additionalServiceCharge > 0 && (
                                                    <div className="flex justify-between items-center gap-4">
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                            Additional Service Charge
                                                        </p>
                                                        <p className="text-xs font-black text-slate-800">
                                                            {formatMoney(
                                                                printPricing.additionalServiceCharge
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                                {(printPricing.gstOnPackage || 0) > 0 && (
                                                    <div className="flex justify-between items-center gap-4">
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                            GST on Package (5%)
                                                        </p>
                                                        <p className="text-xs font-black text-slate-800">
                                                            {formatMoney(
                                                                printPricing.gstOnPackage || 0
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                                {(printPricing.gstOnAdditional || 0) > 0 && (
                                                    <div className="flex justify-between items-center gap-4">
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                            GST on Additional (18%)
                                                        </p>
                                                        <p className="text-xs font-black text-slate-800">
                                                            {formatMoney(
                                                                printPricing.gstOnAdditional || 0
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-end gap-4 pt-4 border-t border-slate-200">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">
                                                        Inclusions
                                                    </p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase max-w-sm">
                                                        Premium Stay, Flights, Guided Tours, Private
                                                        Transfers, and All Applicable Taxes.
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                        Total Quote
                                                    </p>
                                                    <h4 className="text-4xl font-black text-crm-600 tracking-tighter">
                                                        {formatMoney(printPricing.total)}
                                                    </h4>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Document Footer */}
                            <div className="print-break-avoid pt-12 border-t border-slate-100 mt-12 flex justify-between items-start gap-8 print:pt-8 print:mt-8">
                                <div className="min-w-0 flex-auto">
                                    <QuoteTermsSection terms={resolvedPreviewTerms} variant="print" />
                                </div>
                                <div className="text-right shrink-0 print:hidden">
                                    <div className="inline-block border-b-2 border-slate-400 w-48 mb-3 h-12 opacity-20"></div>
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Travel Consultant</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{(editingQuote || selectedQuote)?.agentName || quoteBranding?.name || agencyName}</p>
                                </div>
                            </div>
                            <AgencyBankDetailsBlock details={agencyBankDetails} variant="print" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            </div>

            {/* ── Add New Destination Modal ── */}
            {isAddingPreset && (
                <div className="fixed inset-0 z-[2400] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[40px] shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-10 py-8 border-b border-slate-50 bg-white flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800">Add New Destination Package</h3>
                                <p className="text-xs text-slate-500">Create a reusable package for quotations</p>
                            </div>
                            <button onClick={() => setIsAddingPreset(false)} className="text-slate-400 hover:text-slate-600 p-1">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-2">Package Name</label>
                                    <input type="text" value={newPreset.name} onChange={e => setNewPreset({ ...newPreset, name: e.target.value })} placeholder="e.g. Tokyo Discovery" className="input-field" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-2">Destination</label>
                                    <input type="text" value={newPreset.destination} onChange={e => setNewPreset({ ...newPreset, destination: e.target.value })} placeholder="e.g. Tokyo, Japan" className="input-field" />
                                </div>
                                <div>
                                    <label className="form-label">Default Duration</label>
                                    <input type="text" value={newPreset.duration} onChange={e => setNewPreset({ ...newPreset, duration: e.target.value })} placeholder="e.g. 5 Nights / 6 Days" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-crm-500 outline-none" />
                                </div>
                            </div>

                            <div className="pt-2">
                                <h4 className="text-xs font-bold text-crm-700 mb-3 flex items-center gap-2">
                                    <Calculator size={14} /> Base Cost Setup (Per 2 Adults)
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="form-label font-semibold">Hotel Cost & Description</label>
                                            <NumberInput value={newPreset.hotelCost} onChange={e => setNewPreset({ ...newPreset, hotelCost: parseInt(e.target.value) || 0 })} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm mb-1.5" />
                                            <input type="text" value={newPreset.hotelDesc} onChange={e => setNewPreset({ ...newPreset, hotelDesc: e.target.value })} placeholder="Hotel Name" className="w-full px-3 py-1.5 border border-slate-100 rounded-lg text-[11px] bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="form-label font-semibold">Flight Cost & Description</label>
                                            <NumberInput value={newPreset.flightCost} onChange={e => setNewPreset({ ...newPreset, flightCost: parseInt(e.target.value) || 0 })} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm mb-1.5" />
                                            <input type="text" value={newPreset.flightDesc} onChange={e => setNewPreset({ ...newPreset, flightDesc: e.target.value })} placeholder="Airline info" className="w-full px-3 py-1.5 border border-slate-100 rounded-lg text-[11px] bg-slate-50" />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="form-label font-semibold">Visa Cost (Per Adult)</label>
                                            <NumberInput value={newPreset.visaCost} onChange={e => setNewPreset({ ...newPreset, visaCost: parseInt(e.target.value) || 0 })} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="form-label font-semibold">Activity Cost & Description</label>
                                            <NumberInput value={newPreset.activityCost} onChange={e => setNewPreset({ ...newPreset, activityCost: parseInt(e.target.value) || 0 })} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm mb-1.5" />
                                            <input type="text" value={newPreset.activityDesc} onChange={e => setNewPreset({ ...newPreset, activityDesc: e.target.value })} placeholder="Activity highlights" className="w-full px-3 py-1.5 border border-slate-100 rounded-lg text-[11px] bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="form-label font-semibold">Transfer Cost</label>
                                            <NumberInput value={newPreset.transferCost} onChange={e => setNewPreset({ ...newPreset, transferCost: parseInt(e.target.value) || 0 })} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setIsAddingPreset(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
                            <button
                                onClick={() => {
                                    const id = `custom-p-${Date.now()}`;
                                    const preset = { ...newPreset, id, transferDesc: 'Internal Transfers' };
                                    addRecord('customPresets', preset);
                                    setSelectedPresetId(id);
                                    setIsAddingPreset(false);
                                    setNewPreset({ name: '', destination: '', duration: '5 Nights / 6 Days', hotelCost: 100000, hotelDesc: 'Luxury Resort', flightCost: 80000, flightDesc: 'Return Flights', activityCost: 30000, activityDesc: 'Premium Tours', transferCost: 15000, transferDesc: 'Private Transfers', visaCost: 5000 });
                                }}
                                disabled={!newPreset.name || !newPreset.destination}
                                className="bg-crm-600 hover:bg-crm-700 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md shadow-crm-200 transition-all disabled:opacity-50 disabled:shadow-none"
                            >
                                Create & Select Package
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {quoteEmailDraft && quoteEmailSender && (
                <QuoteEmailSendModal
                    draft={quoteEmailDraft}
                    sender={quoteEmailSender}
                    onClose={() => {
                        setQuoteEmailDraft(null);
                        setQuoteEmailSender(null);
                    }}
                />
            )}
        </div>
    );
};

export default Quotations;
