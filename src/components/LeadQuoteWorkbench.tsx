import React from 'react';
import {
    Calendar,
    Users,
    Phone,
    Mail,
    MapPin,
    Edit3,
    Send,
    Download,
    Plus,
    Tag,
    Clock,
    Hotel as HotelIcon,
    Plane,
    FileText,
    Pencil,
    CheckCircle2,
    Trash2,
} from 'lucide-react';
import {
    buildQuoteActivityLog,
    compareQuoteVersions,
    filterQuoteItemsForDisplay,
    formatQuoteTimestamp,
    resolveQuoteTimestamp,
    quoteVersionDepth,
} from '../utils/quoteActivities';
import { getQuotePricingDisplay, getUnifiedTotalForQuote, isTemplatePackageQuote } from '../utils/pricingConsistency';
import { formatHotelNightDateLabel, sumStayHotelTotal } from '../utils/hotelStayPricing';
import { useCurrency } from '../hooks/useCurrency';
import { parseTravelers } from '../utils/pricing';
import { resolveQuoteTermsForQuote, getFallbackTermsRecord } from '../utils/quoteTerms';
import QuoteTermsSection from './QuoteTermsSection';

const formatStayDayLabel = (d: Date) => {
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

const getQuoteStayDateLabel = (quote: any, stayIdx: number): string => {
    const departure = quote?.departureDate;
    if (!departure) return '';
    const stays = Array.isArray(quote?.hotelStays) ? quote.hotelStays : [];
    const stay = stays[stayIdx];
    const nights = Math.max(1, Number(stay?.nights || 1));
    const offsetNights = stays
        .slice(0, stayIdx)
        .reduce((sum: number, s: any) => sum + Math.max(1, Number(s?.nights || 1)), 0);
    const start = new Date(departure);
    if (Number.isNaN(start.getTime())) return '';
    start.setDate(start.getDate() + offsetNights);
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(0, nights - 1));
    return nights === 1
        ? formatStayDayLabel(start)
        : `${formatStayDayLabel(start)} - ${formatStayDayLabel(end)}`;
};

const getQuoteStayNightStart = (quote: any, stayIdx: number): Date | null => {
    const departure = quote?.departureDate;
    if (!departure) return null;
    const stays = Array.isArray(quote?.hotelStays) ? quote.hotelStays : [];
    const offsetNights = stays
        .slice(0, stayIdx)
        .reduce((sum: number, s: any) => sum + Math.max(1, Number(s?.nights || 1)), 0);
    const start = new Date(departure);
    if (Number.isNaN(start.getTime())) return null;
    start.setDate(start.getDate() + offsetNights);
    return start;
};

export type LeadWorkbenchTab = 'basic' | 'quotes' | 'new-quote' | 'activities';

const LEAD_STATUS_LABELS: Record<string, { label: string; className: string }> = {
    new: { label: 'New Lead', className: 'bg-blue-100 text-blue-700' },
    contacted: { label: 'Contacted', className: 'bg-amber-100 text-amber-700' },
    itinerary: { label: 'Quote Given', className: 'bg-sky-100 text-sky-700' },
    negotiation: { label: 'In Negotiation', className: 'bg-purple-100 text-purple-700' },
    confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-700' },
    completed: { label: 'Completed', className: 'bg-slate-100 text-slate-600' },
    canceled: { label: 'Canceled', className: 'bg-red-100 text-red-700' },
};

type Props = {
    lead: any;
    quotes: any[];
    selectedQuoteId: string;
    activeTab: LeadWorkbenchTab;
    onTabChange: (tab: LeadWorkbenchTab) => void;
    onSelectQuote: (quoteId: string) => void;
    onNewQuote: () => void;
    onEditQuote: () => void;
    /** Omitted when the agency's plan doesn't include quote sharing */
    onShareWhatsApp?: () => void;
    onShareEmail?: () => void;
    customerEmail?: string | null;
    /** Omitted when the agency's plan doesn't include quotation PDFs */
    onPrint?: () => void;
    onDeleteQuote?: () => void;
    onConvert?: (quote: any) => void;
    db: any;
    agencyName: string;
};

const sortQuotesNewestFirst = (quotes: any[]) =>
    [...quotes].sort((a, b) => compareQuoteVersions(b.version, a.version));

const resolveParentVersionLabel = (quote: any, allQuotes: any[]): string | null => {
    if (!quote?.parentId) return null;
    const parent = allQuotes.find((q) => q.id === quote.parentId);
    return parent?.version ? `v${parent.version}` : null;
};

const LeadQuoteWorkbench: React.FC<Props> = ({
    lead,
    quotes,
    selectedQuoteId,
    activeTab,
    onTabChange,
    onSelectQuote,
    onNewQuote,
    onEditQuote,
    onShareWhatsApp,
    onShareEmail,
    customerEmail,
    onPrint,
    onDeleteQuote,
    onConvert,
    db,
    agencyName,
}) => {
    const { formatMoney, currencyLabel } = useCurrency();

    const sortedQuotes = sortQuotesNewestFirst(quotes);
    const selectedQuote =
        sortedQuotes.find((q) => q.id === selectedQuoteId) || sortedQuotes[0] || null;
    const latestQuote = sortedQuotes[0] || null;
    const displayQuote = selectedQuote || latestQuote;
    const activeQuote = displayQuote;
    const quotePricing = activeQuote ? getQuotePricingDisplay(activeQuote, db) : null;
    const displayTotal = quotePricing?.total ?? 0;
    const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;
    const resolvedTerms = activeQuote
        ? resolveQuoteTermsForQuote(
              {
                  termsId: activeQuote.termsId,
                  destination: activeQuote.destination || '',
                  agentId: activeQuote.agentId,
              },
              db?.quoteTerms?.data || [],
              userRole
          ) || getFallbackTermsRecord()
        : null;
    const subtotal = quotePricing?.subtotal ?? Math.round(displayTotal / 1.05);
    const statusMeta = LEAD_STATUS_LABELS[lead?.status] || LEAD_STATUS_LABELS.itinerary;
    const activities = buildQuoteActivityLog(lead, quotes, db?.hotels?.data || []);
    const travelers = activeQuote ? parseTravelers(activeQuote.travelers) : parseTravelers(lead?.travelers || '2 Adults');
    const isLeadConverted =
        lead?.status === 'confirmed' ||
        lead?.status === 'completed' ||
        Boolean(String(lead?.confirmedQuoteId || '').trim());

    const formatTripDates = () => {
        if (displayQuote?.departureDate) {
            try {
                const dep = new Date(displayQuote.departureDate);
                const dur = displayQuote.duration || lead?.duration || '';
                const nightsMatch = dur.match(/(\d+)\s*N/i);
                const nights = nightsMatch ? parseInt(nightsMatch[1], 10) : 0;
                const ret = new Date(dep);
                if (nights) ret.setDate(ret.getDate() + nights);
                const fmt = (d: Date) =>
                    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                return `${fmt(dep)}${nights ? ` – ${fmt(ret)}` : ''}`;
            } catch {
                return displayQuote.departureDate;
            }
        }
        return lead?.dates || lead?.startDate || '—';
    };

    const paxLabel = () => {
        const parts: string[] = [];
        if (travelers.adults) parts.push(`${travelers.adults} Adult${travelers.adults > 1 ? 's' : ''}`);
        if (travelers.kids) {
            const ages = Array.isArray(displayQuote?.kidAges)
                ? displayQuote.kidAges
                : Array.isArray(lead?.kidAges)
                  ? lead.kidAges
                  : [];
            const ageSuffix = ages.length ? ` (${ages.join('y, ')}y)` : '';
            parts.push(`${travelers.kids} Child${travelers.kids > 1 ? 'ren' : ''}${ageSuffix}`);
        }
        return parts.join(', ') || displayQuote?.travelers || lead?.travelers || '—';
    };

    const tabs: { id: LeadWorkbenchTab; label: string; badge?: number }[] = [
        { id: 'basic', label: 'Basic Details' },
        { id: 'quotes', label: 'All Quotes', badge: quotes.length || undefined },
        { id: 'new-quote', label: 'New Quote' },
        { id: 'activities', label: 'Activities' },
    ];

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Lead header */}
            <div className="shrink-0 px-6 py-5 border-b border-slate-100 bg-white">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-400">
                                # {lead?.trackingId || lead?.tripId || lead?.id?.slice(-7) || '—'}
                            </span>
                            <h2 className="text-xl font-black text-slate-900 truncate">{lead?.name || displayQuote?.customer}</h2>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${statusMeta.className}`}>
                                {statusMeta.label}
                            </span>
                        </div>
                        <p className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
                            <MapPin size={14} className="text-slate-400 shrink-0" />
                            {displayQuote?.destination || lead?.destination || '—'}
                            {lead?.agentName && (
                                <span className="text-slate-400 font-medium"> • {agencyName || lead.agentName}</span>
                            )}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-bold text-slate-500">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                <Calendar size={14} className="text-crm-500" />
                                {formatTripDates()}
                            </span>
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                <Clock size={14} className="text-crm-500" />
                                {displayQuote?.duration || lead?.duration || '—'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                <Users size={14} className="text-crm-500" />
                                {paxLabel()}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>Guest: {lead?.guestName || 'N/A'}</span>
                            {lead?.agentName && (
                                <span className="inline-flex items-center gap-2">
                                    {lead.agentName}
                                    {lead.phone && (
                                        <a href={`tel:${lead.phone}`} className="text-crm-600 hover:text-crm-700">
                                            <Phone size={13} />
                                        </a>
                                    )}
                                    {lead.email && (
                                        <a href={`mailto:${lead.email}`} className="text-crm-600 hover:text-crm-700">
                                            <Mail size={13} />
                                        </a>
                                    )}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        <p className="text-3xl font-black text-slate-900 whitespace-nowrap">
                            {formatMoney(displayTotal)}
                            <span className="text-sm font-bold text-slate-400 ml-1">exc. Taxes</span>
                        </p>
                        <div className="flex items-center gap-2 text-slate-400">
                            <Tag size={14} />
                            <span className="text-xs font-bold">{(lead?.tags || []).length ? (lead.tags as string[]).join(', ') : 'No Tags'}</span>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <button
                                type="button"
                                onClick={onEditQuote}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                            >
                                <Edit3 size={14} className="inline mr-1" />
                                Modify
                            </button>
                            {onShareWhatsApp && (
                            <button
                                type="button"
                                onClick={onShareWhatsApp}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 whitespace-nowrap"
                            >
                                <Send size={14} className="inline mr-1" />
                                WhatsApp
                            </button>
                            )}
                            {onShareEmail && (
                            <button
                                type="button"
                                onClick={onShareEmail}
                                title={
                                    customerEmail || lead?.email
                                        ? `Send to ${customerEmail || lead?.email}`
                                        : 'Add customer email on the lead'
                                }
                                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Mail size={14} className="inline mr-1" />
                                Email
                            </button>
                            )}
                            {onPrint && (
                            <button
                                type="button"
                                onClick={onPrint}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 whitespace-nowrap"
                            >
                                <Download size={14} className="inline mr-1" />
                                PDF
                            </button>
                            )}
                            {onDeleteQuote && (
                                <button
                                    type="button"
                                    onClick={onDeleteQuote}
                                    className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 whitespace-nowrap"
                                    title="Delete this quotation"
                                >
                                    <Trash2 size={14} className="inline mr-1" />
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 px-6 border-b border-slate-200 bg-slate-50/50">
                <div className="flex gap-1 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                                if (tab.id === 'new-quote') onNewQuote();
                                else onTabChange(tab.id);
                            }}
                            className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                                activeTab === tab.id
                                    ? 'border-crm-600 text-crm-700 bg-white'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab.label}
                            {tab.badge != null && tab.badge > 0 && (
                                <span className="ml-1.5 text-[10px] font-black bg-crm-100 text-crm-700 px-1.5 py-0.5 rounded-full">
                                    [{tab.badge}]
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab panels */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {activeTab === 'basic' && (
                    <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Lead Information</h3>
                                <dl className="space-y-3 text-sm">
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500 font-bold">Client</dt>
                                        <dd className="font-bold text-slate-800 text-right">{lead?.name}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500 font-bold">Destination</dt>
                                        <dd className="font-bold text-slate-800 text-right">{lead?.destination}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500 font-bold">Travel dates</dt>
                                        <dd className="font-bold text-slate-800 text-right">{formatTripDates()}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500 font-bold">Pax</dt>
                                        <dd className="font-bold text-slate-800 text-right">{paxLabel()}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-slate-500 font-bold">Assigned agent</dt>
                                        <dd className="font-bold text-slate-800 text-right">{lead?.agentName || '—'}</dd>
                                    </div>
                                </dl>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Latest Package</h3>
                                {latestQuote ? (
                                    <>
                                        <p className="text-2xl font-black text-crm-600">
                                            {formatMoney(getUnifiedTotalForQuote(latestQuote, db))}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">Quote v{latestQuote.version} • {latestQuote.duration}</p>
                                        <button
                                            type="button"
                                            onClick={() => onTabChange('quotes')}
                                            className="mt-4 text-xs font-bold text-crm-600 hover:underline"
                                        >
                                            View all {quotes.length} quote{quotes.length !== 1 ? 's' : ''} →
                                        </button>
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">No quotes yet</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'quotes' && (
                    <div className="h-full flex min-h-0">
                        {/* Quote list */}
                        <div className="w-full max-w-[220px] shrink-0 border-r border-slate-200 overflow-y-auto custom-scrollbar bg-slate-50/30">
                            {sortedQuotes.map((q, idx) => {
                                const total = getUnifiedTotalForQuote(q, db);
                                const isSelected = q.id === (selectedQuote?.id || '');
                                const isLatest = idx === 0;
                                const depth = quoteVersionDepth(q.version);
                                const parentVer = resolveParentVersionLabel(q, sortedQuotes);
                                return (
                                    <button
                                        key={q.id}
                                        type="button"
                                        onClick={() => onSelectQuote(q.id)}
                                        style={{ paddingLeft: `${12 + depth * 10}px` }}
                                        className={`w-full text-left py-4 pr-4 border-b border-slate-100 transition-all relative ${
                                            isSelected
                                                ? 'bg-white border-r-4 border-r-crm-600'
                                                : 'hover:bg-white/80'
                                        }`}
                                    >
                                        {isSelected && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-crm-600" />
                                        )}
                                        {depth > 0 && (
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 text-xs">
                                                └
                                            </span>
                                        )}
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">
                                            Quote v{q.version || '1'}
                                            {parentVer ? (
                                                <span className="normal-case font-bold text-slate-400">
                                                    {' '}
                                                    · revision of {parentVer}
                                                </span>
                                            ) : null}
                                        </p>
                                        <p
                                            className={`font-black text-crm-600 leading-none ${isLatest ? 'text-2xl' : 'text-lg'}`}
                                        >
                                            {formatMoney(total)}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-500 mt-2 leading-snug">
                                            {q.departureDate
                                                ? new Date(q.departureDate).toLocaleDateString('en-IN', {
                                                      day: 'numeric',
                                                      month: 'short',
                                                      year: 'numeric',
                                                  })
                                                : q.date}
                                            , {q.duration}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{q.travelers}</p>
                                        <p className="text-[10px] text-slate-400 italic mt-1">{formatQuoteTimestamp(resolveQuoteTimestamp(q))}</p>
                                        {isLatest && (
                                            <span className="inline-block mt-2 text-[9px] font-black uppercase text-crm-600 bg-crm-50 px-2 py-0.5 rounded">
                                                Latest Quote
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                            {sortedQuotes.length === 0 && (
                                <p className="p-4 text-xs text-slate-400 italic">No quotes for this lead</p>
                            )}
                        </div>

                        {/* Quote detail */}
                        <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-6">
                            {activeQuote ? (
                                <div className="max-w-3xl">
                                    <div className="flex items-start justify-between gap-4 mb-6">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <h3 className="text-lg font-black text-slate-800">Package Quote Price</h3>
                                                <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                    v{activeQuote.version || '1'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={onEditQuote}
                                                    className="p-1 text-slate-400 hover:text-crm-600"
                                                    title="Edit entire quote (saves as new version)"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                            </div>
                                            <p className="text-3xl font-black text-crm-600">
                                                {currencyLabel} {formatMoney(displayTotal, { includeSymbol: false })}
                                                <span className="text-sm font-bold text-slate-400 ml-2">(exc. Taxes)</span>
                                            </p>
                                    <p className="text-sm font-bold text-slate-400 mt-1">
                                        {currencyLabel} {formatMoney(subtotal, { includeSymbol: false })} (cost price)
                                    </p>
                                    {quotePricing && activeQuote && (() => {
                                        const isPackageQuote = isTemplatePackageQuote(activeQuote);
                                        const showBaseTravel =
                                            isPackageQuote && quotePricing.breakdown.baseTravel > 0;
                                        const servicesLabel = isPackageQuote ? 'Services' : 'Hotel + itinerary';
                                        const breakdownRows = [
                                            ...(showBaseTravel
                                                ? [
                                                      {
                                                          key: 'base-travel',
                                                          label: 'Base Travel',
                                                          amount: quotePricing.breakdown.baseTravel,
                                                          className: 'text-slate-700',
                                                      },
                                                  ]
                                                : []),
                                            {
                                                key: 'services',
                                                label: servicesLabel,
                                                amount: quotePricing.breakdown.services,
                                                className: 'text-slate-700',
                                            },
                                            ...(quotePricing.additionalServiceCharge > 0
                                                ? [
                                                      {
                                                          key: 'service-charge',
                                                          label: 'Additional Service Charge',
                                                          amount: quotePricing.additionalServiceCharge,
                                                          className: 'text-crm-600',
                                                      },
                                                  ]
                                                : []),
                                            ...((quotePricing.gstOnPackage || 0) > 0
                                                ? [
                                                      {
                                                          key: 'gst-package',
                                                          label: 'GST on Package (5%)',
                                                          amount: quotePricing.gstOnPackage || 0,
                                                          className: 'text-emerald-700',
                                                      },
                                                  ]
                                                : []),
                                            ...((quotePricing.gstOnAdditional || 0) > 0
                                                ? [
                                                      {
                                                          key: 'gst-additional',
                                                          label: 'GST on Additional (18%)',
                                                          amount: quotePricing.gstOnAdditional || 0,
                                                          className: 'text-emerald-700',
                                                      },
                                                  ]
                                                : []),
                                        ];

                                        return (
                                            <div
                                                className="grid gap-3 mt-4 pt-4 border-t border-slate-100"
                                                style={{
                                                    gridTemplateColumns: `repeat(${breakdownRows.length}, minmax(0, 1fr))`,
                                                }}
                                            >
                                                {breakdownRows.map((row) => (
                                                    <div key={row.key}>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                                            {row.label}
                                                        </p>
                                                        <p className={`text-sm font-bold ${row.className}`}>
                                                            {formatMoney(row.amount)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                                        {activeQuote.id === latestQuote?.id && (
                                            <span className="text-[10px] font-black uppercase text-crm-600 bg-crm-50 border border-crm-200 px-3 py-1 rounded-full shrink-0">
                                                Latest Quote
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-2 mb-6">
                                        {filterQuoteItemsForDisplay(activeQuote.items, activeQuote).map((item: any, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                                <span>
                                                    {formatMoney(Number(item.price || 0))} / {item.qty}
                                                </span>
                                                <span className="font-medium text-slate-400"> — {item.desc}</span>
                                                {Number(item.total) > 0 && (
                                                    <span className="text-[11px] font-bold text-slate-400 ml-auto shrink-0">
                                                        Total {formatMoney(Number(item.total))}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                        {(!activeQuote.items || activeQuote.items.length === 0) && (
                                            <p className="text-sm text-slate-500">
                                                {activeQuote.destination} • {activeQuote.duration}
                                            </p>
                                        )}
                                    </div>

                                    <p className="text-xs text-slate-400 mb-6">
                                        Created {formatQuoteTimestamp(resolveQuoteTimestamp(activeQuote))} by{' '}
                                        <span className="font-bold text-slate-600">{activeQuote.agentName || 'Agent'}</span>
                                    </p>

                                    {onConvert && (
                                        isLeadConverted ? (
                                            <button
                                                type="button"
                                                disabled
                                                className="mb-8 px-6 py-3 bg-slate-100 text-slate-400 rounded-xl text-sm font-black shadow-none whitespace-nowrap cursor-not-allowed border border-slate-200"
                                            >
                                                Converted · Confirmed
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => onConvert(activeQuote)}
                                                className="mb-8 px-6 py-3 bg-crm-600 hover:bg-crm-700 text-white rounded-xl text-sm font-black shadow-md whitespace-nowrap"
                                            >
                                                Convert using Quote
                                            </button>
                                        )
                                    )}

                                    <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-500 pb-4 border-b border-slate-100 mb-6">
                                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                            <Calendar size={14} /> {formatTripDates()}
                                        </span>
                                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                            <Users size={14} /> {paxLabel()}
                                        </span>
                                    </div>

                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">Services</h4>
                                    <div className="space-y-5">
                                        {(activeQuote.hotelStays || []).filter((s: any) => s?.hotelId || s?.hotelInput)
                                            .length > 0 && (
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                    Hotel stays
                                                </p>
                                                {(activeQuote.hotelStays || []).map(
                                                    (stay: any, idx: number) => {
                                                        if (!stay?.hotelId && !stay?.hotelInput) {
                                                            return null;
                                                        }
                                                        const hotel = (db?.hotels?.data || []).find(
                                                            (h: any) => h.id === stay.hotelId
                                                        );
                                                        const hotelName =
                                                            stay.hotelInput?.trim() ||
                                                            hotel?.name ||
                                                            'Hotel';
                                                        const stayDates = getQuoteStayDateLabel(
                                                            activeQuote,
                                                            idx
                                                        );
                                                        const nightStart = getQuoteStayNightStart(
                                                            activeQuote,
                                                            idx
                                                        );
                                                        const nights = Math.max(
                                                            1,
                                                            Number(stay.nights) || 1
                                                        );
                                                        const stayTotal = sumStayHotelTotal(stay);
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
                                                                className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
                                                            >
                                                                <div className="flex items-start gap-3 mb-3">
                                                                    <HotelIcon
                                                                        size={18}
                                                                        className="text-crm-600 shrink-0 mt-0.5"
                                                                    />
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                                                            <div>
                                                                                <p className="text-sm font-black text-slate-800">
                                                                                    {hotelName}
                                                                                </p>
                                                                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                                                                    Stay {idx + 1}
                                                                                    {stayDates
                                                                                        ? ` · ${stayDates}`
                                                                                        : ''}
                                                                                    {' · '}
                                                                                    {nights} night
                                                                                    {nights > 1
                                                                                        ? 's'
                                                                                        : ''}
                                                                                </p>
                                                                            </div>
                                                                            {stayTotal > 0 && (
                                                                                <span className="text-sm font-black text-crm-700 shrink-0">
                                                                                    {formatMoney(
                                                                                        stayTotal
                                                                                    )}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-xs">
                                                                            {(stay.city ||
                                                                                hotel?.city) && (
                                                                                <div>
                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                                                        City / Place
                                                                                    </p>
                                                                                    <p className="font-semibold text-slate-700 mt-0.5">
                                                                                        {stay.city ||
                                                                                            hotel?.city}
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                            <div>
                                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                                                    Room
                                                                                </p>
                                                                                <p className="font-semibold text-slate-700 mt-0.5">
                                                                                    {stay.roomType ||
                                                                                        'Standard'}
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                                                    Meal plan
                                                                                </p>
                                                                                <p className="font-semibold text-slate-700 mt-0.5">
                                                                                    {stay.mealPlan ||
                                                                                        activeQuote.hotelMealPlan ||
                                                                                        '—'}
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                                                    Rooms / Pax
                                                                                </p>
                                                                                <p className="font-semibold text-slate-700 mt-0.5">
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
                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                                                        Extra beds
                                                                                    </p>
                                                                                    <p className="font-semibold text-slate-700 mt-0.5">
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
                                                                            {(stay.childWithBed ||
                                                                                0) > 0 && (
                                                                                <div>
                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                                                        Child with bed
                                                                                    </p>
                                                                                    <p className="font-semibold text-slate-700 mt-0.5">
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
                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                                                        Child w/o bed
                                                                                    </p>
                                                                                    <p className="font-semibold text-slate-700 mt-0.5">
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
                                                                            <div className="mt-3 pt-3 border-t border-slate-200/80">
                                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">
                                                                                    Night-wise stays
                                                                                </p>
                                                                                <ul className="space-y-1.5">
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
                                                                                                <li
                                                                                                    key={
                                                                                                        nIdx
                                                                                                    }
                                                                                                    className="flex items-center justify-between gap-3 text-xs"
                                                                                                >
                                                                                                    <span className="font-semibold text-slate-700">
                                                                                                        Night{' '}
                                                                                                        {nIdx +
                                                                                                            1}
                                                                                                        {dateLabel
                                                                                                            ? ` · ${dateLabel.datePart} (${dateLabel.day})`
                                                                                                            : ''}
                                                                                                    </span>
                                                                                                    <span className="font-black text-crm-700 shrink-0">
                                                                                                        {formatMoney(
                                                                                                            amount
                                                                                                        )}
                                                                                                    </span>
                                                                                                </li>
                                                                                            );
                                                                                        }
                                                                                    )}
                                                                                </ul>
                                                                            </div>
                                                                        )}

                                                                        {inclusions.length > 0 && (
                                                                            <ul className="mt-3 text-[11px] text-slate-600 space-y-0.5">
                                                                                {inclusions.map(
                                                                                    (s: any) => (
                                                                                        <li
                                                                                            key={
                                                                                                s.id ||
                                                                                                s.name
                                                                                            }
                                                                                        >
                                                                                            +{' '}
                                                                                            {s.name}
                                                                                            {s.amount !=
                                                                                                null &&
                                                                                            s.amount >
                                                                                                0
                                                                                                ? ` (${formatMoney(s.amount)})`
                                                                                                : ''}
                                                                                        </li>
                                                                                    )
                                                                                )}
                                                                            </ul>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}

                                        {activeQuote.needFlight !== false && (
                                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <Plane size={18} className="text-crm-600 shrink-0" />
                                                <p className="text-sm font-bold text-slate-800">
                                                    Flights included
                                                </p>
                                            </div>
                                        )}

                                        {activeQuote.itinerary?.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <FileText
                                                        size={16}
                                                        className="text-crm-600 shrink-0"
                                                    />
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                        Itinerary — {activeQuote.itinerary.length}{' '}
                                                        day
                                                        {activeQuote.itinerary.length !== 1
                                                            ? 's'
                                                            : ''}
                                                    </p>
                                                </div>
                                                {(activeQuote.transportation ||
                                                    (Number(activeQuote.vehiclePrice) || 0) >
                                                        0) && (
                                                    <p className="text-xs font-semibold text-slate-600">
                                                        {activeQuote.transportation ? (
                                                            <>
                                                                Travel vehicle:{' '}
                                                                <span className="text-crm-700 font-black">
                                                                    {activeQuote.transportation}
                                                                </span>
                                                            </>
                                                        ) : null}
                                                        {(Number(activeQuote.vehiclePrice) || 0) >
                                                            0 && (
                                                            <span
                                                                className={
                                                                    activeQuote.transportation
                                                                        ? ' ml-1'
                                                                        : ''
                                                                }
                                                            >
                                                                {activeQuote.transportation
                                                                    ? '· '
                                                                    : ''}
                                                                {formatMoney(
                                                                    Number(
                                                                        activeQuote.vehiclePrice
                                                                    ) || 0
                                                                )}
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                                <div className="space-y-3">
                                                    {activeQuote.itinerary.map(
                                                        (day: any, dIdx: number) => {
                                                            const dayTitle =
                                                                day.title || `Day ${dIdx + 1}`;
                                                            const activities = Array.isArray(
                                                                day.activities
                                                            )
                                                                ? day.activities
                                                                : [];
                                                            return (
                                                                <div
                                                                    key={day.id || dIdx}
                                                                    className="rounded-xl border border-slate-100 overflow-hidden bg-white"
                                                                >
                                                                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                                                                        <span className="text-xs font-black text-slate-800">
                                                                            {dayTitle}
                                                                        </span>
                                                                        {day.date && (
                                                                            <span className="text-[10px] text-slate-400 font-semibold">
                                                                                {day.date}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {activities.length > 0 ? (
                                                                        <ul className="divide-y divide-slate-50 px-4 py-1">
                                                                            {activities.map(
                                                                                (
                                                                                    act: any,
                                                                                    aIdx: number
                                                                                ) => {
                                                                                    const price =
                                                                                        Number(
                                                                                            act.customPrice ??
                                                                                                act.price ??
                                                                                                0
                                                                                        );
                                                                                    return (
                                                                                        <li
                                                                                            key={
                                                                                                act.id ||
                                                                                                aIdx
                                                                                            }
                                                                                            className="py-2.5"
                                                                                        >
                                                                                            <div className="flex items-start justify-between gap-3">
                                                                                                <p className="text-xs font-bold text-slate-800">
                                                                                                    •{' '}
                                                                                                    {act.title ||
                                                                                                        act.name ||
                                                                                                        'Activity'}
                                                                                                </p>
                                                                                                {price >
                                                                                                    0 && (
                                                                                                    <span className="text-xs font-black text-crm-600 shrink-0">
                                                                                                        {formatMoney(
                                                                                                            price
                                                                                                        )}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            {act.description?.trim() && (
                                                                                                <p className="text-[11px] text-slate-500 mt-1 ml-3 leading-relaxed whitespace-pre-wrap">
                                                                                                    {
                                                                                                        act.description
                                                                                                    }
                                                                                                </p>
                                                                                            )}
                                                                                        </li>
                                                                                    );
                                                                                }
                                                                            )}
                                                                        </ul>
                                                                    ) : (
                                                                        <p className="px-4 py-3 text-[11px] text-slate-400 italic">
                                                                            Leisure / free time
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <QuoteTermsSection terms={resolvedTerms} variant="screen" />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                    <FileText size={40} className="mb-3 opacity-30" />
                                    <p className="text-sm font-bold">Select a quote from the list</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'activities' && (
                    <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Change log</h3>
                        {activities.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No activity recorded yet.</p>
                        ) : (
                            <div className="space-y-3 max-w-2xl">
                                {activities.map((act) => (
                                    <div
                                        key={act.id}
                                        className="flex gap-4 p-4 bg-white border border-slate-100 rounded-xl shadow-sm"
                                    >
                                        <div
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                act.type === 'hotel'
                                                    ? 'bg-amber-50 text-amber-600'
                                                    : act.type === 'booking'
                                                      ? 'bg-emerald-50 text-emerald-600'
                                                      : act.type === 'revision'
                                                        ? 'bg-purple-50 text-purple-600'
                                                        : 'bg-crm-50 text-crm-600'
                                            }`}
                                        >
                                            {act.type === 'hotel' ? (
                                                <HotelIcon size={18} />
                                            ) : act.type === 'booking' ? (
                                                <CheckCircle2 size={18} />
                                            ) : (
                                                <Clock size={18} />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-slate-800">{act.title}</p>
                                            {act.detail && (
                                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{act.detail}</p>
                                            )}
                                            <p className="text-[10px] text-slate-400 mt-2">
                                                {formatQuoteTimestamp(act.at)}
                                                {act.actor ? ` • ${act.actor}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'new-quote' && (
                    <div className="h-full flex items-center justify-center p-6">
                        <button
                            type="button"
                            onClick={onNewQuote}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-crm-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-crm-700"
                        >
                            <Plus size={20} />
                            Start New Quote
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeadQuoteWorkbench;
