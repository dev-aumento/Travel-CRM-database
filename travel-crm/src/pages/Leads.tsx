import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Plus, MoreVertical, MapPin, Calendar, X, CheckCircle2, User, Users, Phone, Mail, Edit2, Edit3, Trash2, FileText, Download, Filter, LayoutGrid, List, Clock, ArrowRight, ChevronRight, Globe, Plane, PlusSquare, Ban } from 'lucide-react';
import DropdownChevron from '../components/DropdownChevron';
import CopyableText from '../components/CopyableText';
import CountryFlag from '../components/CountryFlag';
import CancelTripModal, { type CancelTripTarget } from '../components/CancelTripModal';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDatabase } from '../context/DatabaseContext';
import { packagePresets, calculateQuote, parseTravelers, guessPresetFromDestination, parseDurationNights } from '../utils/pricing';
import { sourceCountries, internationalAirports } from '../utils/aviationData';
import { getQuotePricingDisplay, getUnifiedBudgetForLead, getUnifiedTotalForQuote, isTemplatePackageQuote } from '../utils/pricingConsistency';
import { useCurrency } from '../hooks/useCurrency';
import {
    applyTripCancellation,
    ensureCustomerRecord,
    filterStaffForAgentSession,
    getAgentFieldsFromLead,
    leadVisibleToUser,
    recordVisibleToSession,
    resolveLeadAgentId,
    resolveLeadAssigneeFormValue,
    syncConfirmedLeadBookingStatus,
    isDeletedLead,
    leadMatchesKanbanColumn,
    resolveLeadKanbanColumn,
    hasLeadHighlightOrFollowUp,
    getQuotationsForLead,
    getConfirmedQuoteForLead,
    canConfirmLead,
} from '../utils/databaseSync';
import { formatTrackingId, generateTrackingId, normalizeTrackingId } from '../utils/trackingId';
import { compareQuoteVersions, formatQuoteVersionLabel } from '../utils/quoteActivities';
import {
    COUNTRY_PHONE_DATA,
    getCountryPhoneLabel,
    getPhoneDigitLimit,
    sanitizeLocalPhoneDigits,
    validateLocalPhone,
} from '../utils/countryPhoneData';
// Provide DESTINATIONS constant for flag lookup (maps country name to flag)
const DESTINATIONS = sourceCountries.map(sc => ({ country: sc.name, flag: sc.flag }));

// Manual flag overrides for countries not present in sourceCountries
const FLAGS: { [key: string]: string } = {
    'UAE': '🇦🇪', 'Dubai': '🇦🇪', 'Indonesia': '🇮🇩', 'Bali': '🇮🇩',
    'Thailand': '🇹🇭', 'Singapore': '🇸🇬', 'France': '🇫🇷', 'Switzerland': '🇨🇭',
    'USA': '🇺🇸', 'UK': '🇬🇧', 'Italy': '🇮🇹', 'Greece': '🇬🇷',
    'Japan': '🇯🇵', 'Australia': '🇦🇺', 'Vietnam': '🇻🇳', 'Turkey': '🇹🇷',
    'Maldives': '🇲🇻', 'Malé': '🇲🇻'
};

const getFlag = (destination: string) => {
    if (!destination) return '🌍';
    const loc = destination.split(',').pop()?.trim() || destination;
    return FLAGS[loc] || DESTINATIONS.find(d => d.country === loc)?.flag || '🌍';
};

const getLeadDestinationLabel = (destination?: string | null) => {
    const value = String(destination || '').trim();
    if (!value) return '';
    return value.split(',')[0]?.trim() || value;
};

const hasLeadDestination = (destination?: string | null) =>
    Boolean(String(destination || '').trim());

const LEADS_VIEW_STORAGE_KEY = 'leads-view-mode';

const parseLeadsViewMode = (value: string | null | undefined): 'pipeline' | 'list' =>
    value === 'list' ? 'list' : 'pipeline';

const formatLeadScheduleDate = (lead: any): string => {
    if (lead?.startDate) {
        try {
            const date = new Date(`${lead.startDate}T12:00:00`);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                });
            }
        } catch {
            /* fall through */
        }
    }
    if (lead?.dates && typeof lead.dates === 'string') {
        const start = lead.dates.split(' - ')[0]?.trim();
        if (start) return start;
    }
    return 'TBD';
};

const formatLeadCreatedDate = (lead: any): string => {
    if (!lead?.createdAt) return '—';
    try {
        const date = new Date(lead.createdAt);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
};

// Dynamic destinations are now loaded from the database context inside the component

const countryDialCodes = [
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+61', country: 'Australia', flag: '🇦🇺' },
    { code: '+971', country: 'UAE', flag: '🇦🇪' },
];

// Aviation data is now imported from utils/aviationData

const columns = [
    { id: 'new', title: 'New Leads', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'contacted', title: 'Contacted', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: 'itinerary', title: 'Itinerary Sent', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { id: 'negotiation', title: 'In Discussion', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { id: 'confirmed', title: 'Confirmed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { id: 'completed', title: 'Trip Completed', color: 'bg-teal-50 text-teal-700 border-teal-200' },
    { id: 'canceled', title: 'Canceled', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { id: 'deleted', title: 'Deleted', color: 'bg-slate-100 text-slate-600 border-slate-300' },
];

/** Pipeline/list columns shown in the UI — deleted leads stay in DB but are hidden. */
const visibleColumns = columns.filter((column) => column.id !== 'deleted');

const ProposalHubModal = ({ lead, quotes, onClose, onSelectQuote, confirmedQuoteId, db }: any) => {
    const { formatMoney } = useCurrency();
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(quotes.map((q: any) => q.id))); // Default all expanded

    if (!lead || !quotes) return null;

    const toggleNode = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedNodes(newExpanded);
    };

    const expandAll = () => setExpandedNodes(new Set(quotes.map((q: any) => q.id)));
    const collapseAll = () => setExpandedNodes(new Set());

    // BUILD HIERARCHICAL TREE
    const buildQuoteTree = (flatQuotes: any[]) => {
        const quoteMap: { [key: string]: any } = {};
        const roots: any[] = [];

        // DE-DUPLICATE BY ID FIRST (Safety Guard against Ghost Duplicates)
        const uniqueQuotes = Array.from(new Map(flatQuotes.map(q => [q.id, q])).values());

        // Initialize map
        uniqueQuotes.forEach(q => {
            quoteMap[q.id] = { ...q, children: [] };
        });

        // Build hierarchy
        uniqueQuotes.forEach(q => {
            if (q.parentId && quoteMap[q.parentId]) {
                quoteMap[q.parentId].children.push(quoteMap[q.id]);
            } else {
                roots.push(quoteMap[q.id]);
            }
        });

        // Sort roots by version
        return roots.sort((a, b) => compareQuoteVersions(a.version, b.version));
    };

    const quoteTree = buildQuoteTree(quotes);

    const renderQuoteNode = (node: any, depth = 0) => {
        const isConfirmed = confirmedQuoteId === node.id;
        const loc = node.destination?.split(',').pop()?.trim() || '';
        const destFlag = FLAGS[loc] || DESTINATIONS.find(d => d.country === loc)?.flag || '🌍';
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div key={node.id} className="relative">
                {/* Visual Thread Lines */}
                {depth > 0 && (
                    <div
                        className="absolute left-[-20px] top-[-25px] w-[20px] h-[50px] border-l-2 border-b-2 border-slate-200 rounded-bl-xl z-0"
                        style={{ left: `-${24}px` }}
                    />
                )}

                <div style={{ marginLeft: `${depth * 32}px` }} className="mb-4 relative z-10">
                    <button
                        onClick={() => onSelectQuote(node)}
                        className={`group relative w-full text-left p-5 rounded-2xl border-2 transition-all hover:scale-[1.01] active:scale-[0.99] ${isConfirmed ? 'bg-emerald-50 border-emerald-500 shadow-md ring-1 ring-emerald-500' : 'bg-white border-slate-100 hover:border-crm-400 hover:shadow-xl'}`}
                    >
                        <div className="flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4 flex-1">
                                {hasChildren && (
                                    <div
                                        onClick={(e) => toggleNode(node.id, e)}
                                        className={`p-2 rounded-xl transition-all cursor-pointer ${isExpanded ? 'bg-slate-800 text-white rotate-180' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                                    >
                                        <ChevronRight size={16} />
                                    </div>
                                )}
                                <div className={`h-14 min-w-[56px] px-2 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 transition-all ${isConfirmed ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-crm-600 group-hover:text-white transition-colors'}`}>
                                    <span className="text-[10px] uppercase opacity-60">Ver</span>
                                    <span className={`${formatQuoteVersionLabel(node.version).length > 5 ? 'text-xs' : formatQuoteVersionLabel(node.version).length > 3 ? 'text-sm' : 'text-lg'} leading-none tracking-tight`}>
                                        {formatQuoteVersionLabel(node.version)}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xl leading-none">{destFlag}</span>
                                        <span className="text-base font-black text-slate-800 tracking-tight">{node.destination}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        <span className="flex items-center gap-1"><Clock size={12} /> {node.duration}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1 text-crm-600">{formatMoney(getUnifiedTotalForQuote(node, db))}</span>
                                    </div>
                                </div>
                            </div>
                            <div className={`p-2 rounded-full transition-all shrink-0 ${isConfirmed ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-50 text-slate-300 border border-slate-100 group-hover:bg-crm-100 group-hover:text-crm-600'}`}>
                                {isConfirmed ? <CheckCircle2 size={24} /> : <ChevronRight size={24} />}
                            </div>
                        </div>
                        {isConfirmed && (
                            <div className="absolute -top-3 -right-3 px-3 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-full shadow-lg border-2 border-white">
                                Mobilized Target
                            </div>
                        )}
                    </button>
                </div>

                {/* Recursive Children Rendering */}
                {hasChildren && isExpanded && (
                    <div className="relative">
                        {/* Parent-to-Child Connective Spine */}
                        <div
                            className="absolute bg-slate-200 w-[2px] z-0"
                            style={{
                                left: `${depth * 32 + (hasChildren ? 60 : 28)}px`,
                                top: '-4px',
                                bottom: '24px'
                            }}
                        />
                        {node.children.map((child: any) => renderQuoteNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2100] flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 flex flex-col"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div>
                        <h3 className="font-black text-slate-800 text-xl tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                <List size={20} />
                            </div>
                            Proposal Selection Hub
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Reviewing customized options for <span className="font-bold text-slate-700">{lead.name}</span></p>
                        {lead?.leadNote && (
                            <p className="mt-2 inline-flex items-center text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                                {lead.leadNote}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/30">
                    <div className="space-y-2">
                        {quoteTree.map((rootNode: any) => renderQuoteNode(rootNode))}
                    </div>
                </div>

                <div className="px-8 py-6 bg-slate-900 border-t border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="text-slate-400 text-xs font-bold uppercase tracking-[2px]">
                            {quotes.length} Options Generated
                        </div>
                        <div className="h-4 w-px bg-slate-700"></div>
                        <div className="flex gap-2">
                            <button onClick={expandAll} className="text-[10px] font-black text-slate-500 hover:text-white uppercase transition-colors">Expand All</button>
                            <span className="text-slate-700">•</span>
                            <button onClick={collapseAll} className="text-[10px] font-black text-slate-500 hover:text-white uppercase transition-colors">Collapse All</button>
                        </div>
                    </div>
                    <button onClick={onClose} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase transition-all">
                        Exit Portal
                    </button>
                </div>
            </div>
        </div>
    );
};

const QuoteDetailModal = ({ quote, onClose, onConfirm, onCustomise, db }: any) => {
    const { formatMoney } = useCurrency();
    const [custRequest, setCustRequest] = useState('');
    const [showCustForm, setShowCustForm] = useState(false);
    const navigate = useNavigate();

    if (!quote) return null;

    const loc = String(quote.destination || '').split(',').pop()?.trim() || quote.destination || '';
    const destFlag = FLAGS[loc] || DESTINATIONS.find(d => d.country === loc)?.flag || '🌍';
    const linkedLead = (db?.leads?.data || []).find((l: any) => l.id === quote.leadId || l.name === quote.customer);
    const trackingId = formatTrackingId(linkedLead?.trackingId);
    const leadNote = linkedLead?.leadNote || '';
    const quotePricing = getQuotePricingDisplay(quote, db);
    const isPackageQuote = isTemplatePackageQuote(quote);
    const showBaseTravel = isPackageQuote && quotePricing.breakdown.baseTravel > 0;
    const servicesLabel = isPackageQuote
        ? 'Services (Stay, Activities & More)'
        : 'Hotel + itinerary';

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2200] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Header Container */}
                <div className="relative h-48 shrink-0 bg-slate-900 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent z-10" />
                    <div className="absolute bottom-6 left-8 z-20">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-crm-600 text-white text-[10px] font-bold rounded-full uppercase tracking-widest shadow-lg shadow-crm-600/30 border border-crm-500">
                                Proposal Option {quote.version}
                            </span>
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold rounded-full uppercase tracking-widest border border-white/20">
                                {destFlag} {quote.destination}
                            </span>
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-tight">{quote.customer}'s <span className="text-crm-400">Dream Getaway</span></h2>
                        <p className="text-slate-300 text-sm flex items-center gap-2 mt-1">
                            <Calendar size={14} className="text-crm-400" /> Planned for {quote.departureDate ? new Date(quote.departureDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Setting Dates...'}
                        </p>
                        <p className="text-slate-200 text-xs mt-2 font-semibold uppercase tracking-wider">
                            Tracking ID:{' '}
                            <CopyableText
                                value={trackingId}
                                className="text-crm-300 hover:text-crm-200"
                                stopPropagation={false}
                            />
                        </p>
                        {leadNote && (
                            <p className="mt-2 inline-flex items-center text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                                {leadNote}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 z-30 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all border border-white/10"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/50">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Itinerary Section */}
                        <div className="lg:col-span-2 space-y-6">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <Clock size={16} className="text-crm-600" /> Day-Wise Experience Plan
                            </h3>
                            <div className="space-y-4">
                                {(quote.itinerary || []).map((day: any, idx: number) => (
                                    <div key={day.id} className="relative pl-8 pb-4 group">
                                        <div className="absolute left-[11px] top-4 bottom-0 w-[2px] bg-slate-200 group-last:bg-transparent" />
                                        <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white border-2 border-crm-500 flex items-center justify-center text-[10px] font-bold text-crm-700 z-10 shadow-sm">
                                            {idx + 1}
                                        </div>

                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-crm-200">
                                            <h4 className="font-bold text-slate-800 text-sm mb-3">{day.title}</h4>
                                            <div className="space-y-2">
                                                {(day.activities || []).map((act: any, aIdx: number) => (
                                                    <div key={aIdx} className="flex gap-3 items-start">
                                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-crm-400 shrink-0" />
                                                        <span className="text-xs text-slate-600 leading-relaxed">{act.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!quote.itinerary || quote.itinerary.length === 0) && (
                                    <div className="p-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 italic text-sm">
                                        Standard package activities included.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sidebar Details */}
                        <div className="space-y-6">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <User size={14} className="text-indigo-500" /> Package Scope
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Travelers</span>
                                        <span className="font-bold text-slate-800">{quote.travelers}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Duration</span>
                                        <span className="font-bold text-slate-800">{quote.duration}</span>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100 space-y-2">
                                        {/* Detailed Pricing Breakdown */}
                                        {showBaseTravel && (
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-slate-500">Base Travel (Package)</span>
                                                <span className="font-bold text-slate-700">
                                                    {formatMoney(quotePricing.breakdown.baseTravel)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-[11px]">
                                            <span className="text-slate-500">{servicesLabel}</span>
                                            <span className="font-bold text-slate-700">
                                                {formatMoney(quotePricing.breakdown.services)}
                                            </span>
                                        </div>
                                        {quotePricing.additionalServiceCharge > 0 && (
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-slate-500">Additional Service Charge</span>
                                                <span className="font-bold text-slate-700">
                                                    {formatMoney(quotePricing.additionalServiceCharge)}
                                                </span>
                                            </div>
                                        )}
                                        {quotePricing.taxes > 0 && (
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-slate-500">GST</span>
                                                <span className="font-bold text-emerald-700">
                                                    {formatMoney(quotePricing.taxes)}
                                                </span>
                                            </div>
                                        )}

                                        <div className="pt-2 mt-1 border-t border-slate-100 flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-800">Total Investment</span>
                                            <span className="text-xl font-black text-slate-900 tracking-tight">{formatMoney(quotePricing.total)}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1 text-right italic">*Fully inclusive professional quote</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action Bar */}
                <div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-between items-center shrink-0">
                    <div className="hidden md:block">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Negotiation Round</span>
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                            Proposal Version {quote.version || '1'} <ArrowRight size={14} className="text-crm-500" /> Stage: {(quote.status || 'draft').toUpperCase()}
                        </span>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto items-center">
                        <button
                            onClick={() => {
                                onClose();
                                navigate(`/quotations?editMode=true&quoteId=${quote.id}`);
                            }}
                            className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-all text-[11px] font-bold uppercase tracking-widest border border-slate-800 rounded-lg hover:border-slate-600"
                        >
                            <Edit3 size={14} /> Modify Content
                        </button>
                        <div className="h-8 w-px bg-slate-800 mx-1 hidden md:block"></div>
                        {!showCustForm ? (
                            <>
                                <button
                                    onClick={() => setShowCustForm(true)}
                                    className="flex-1 md:flex-none px-6 py-3 border border-slate-700 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800 transition-all font-mono"
                                >
                                    /special_request
                                </button>
                                <button
                                    onClick={() => onConfirm(quote)}
                                    className="flex-1 md:flex-none px-10 py-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-900/20 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                    Confirm Package <CheckCircle2 size={18} />
                                </button>
                            </>
                        ) : (
                            <div className="flex gap-3 w-full animate-in slide-in-from-right-4">
                                <input
                                    autoFocus
                                    value={custRequest}
                                    onChange={e => setCustRequest(e.target.value)}
                                    placeholder="Describe your adjustments here..."
                                    className="flex-1 bg-slate-800 border-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-crm-500"
                                />
                                <button
                                    onClick={() => onCustomise(quote, custRequest)}
                                    className="px-6 py-3 bg-crm-600 hover:bg-crm-700 text-white rounded-xl text-sm font-bold transition-all"
                                >
                                    Send Feedback
                                </button>
                                <button
                                    onClick={() => setShowCustForm(false)}
                                    className="px-4 py-3 text-slate-500 hover:text-white transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const LeadCard = ({ lead, onDragStart, onEdit, onDelete, onCancel, isHighlighted }: any) => {
    const { db, updateRecord, addRecord, getNextId } = useDatabase();
    const userRole = localStorage.getItem('userRole');
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<any>(null);
    const pipelineStatus = resolveLeadKanbanColumn(db, lead);

    // Find all quotations for this lead
    const leadQuotes = getQuotationsForLead(db, lead);

    // Group by version (sort primary versions first)
    const sortedQuotes = [...leadQuotes].sort((a, b) =>
        compareQuoteVersions(a.version, b.version)
    );

    const handleConfirm = (quote: any) => {
        if (window.confirm(`Are you absolutely sure you want to confirm Proposal ${quote.version} for ${lead.name}? This will mobilize the booking engine.`)) {
            updateRecord('leads', lead.id, { status: 'confirmed', confirmedQuoteId: quote.id });
            updateRecord('quotations', quote.id, { status: 'confirmed', leadId: lead.id });
            syncConfirmedLeadBookingStatus(
                db,
                updateRecord,
                { ...lead, status: 'confirmed', confirmedQuoteId: quote.id },
                quote.id,
                addRecord,
                getNextId
            );
            setSelectedQuote(null);
            alert("Execution Successful! Booking synchronized with confirmed package.");
        }
    };

    const handleCustomise = (quote: any, feedback: string) => {
        if (!feedback.trim()) return alert("Please specify the adjustments needed in your proposal.");

        updateRecord('quotations', quote.id, {
            customizationRequest: feedback,
            status: 'negotiation'
        });
        updateRecord('leads', lead.id, { status: 'negotiation' });

        setSelectedQuote(null);
        alert("Strategic Feedback Dispatched! Our team will refine Option " + quote.version + " based on your requests.");
    };

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, lead.id)}
            data-lead-id={lead.id}
            className={`bg-white rounded-xl shadow-sm border hover:border-crm-300 hover:shadow-md transition-all mb-3 group overflow-hidden ${
                isHighlighted ? 'ring-2 ring-crm-500 border-crm-400 shadow-lg' : 'border-slate-200'
            }`}
        >
            <div className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-slate-800">{lead.name}</h4>
                    <div className="flex flex-col items-end gap-1 max-w-[44%]">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${pipelineStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            pipelineStatus === 'negotiation' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                pipelineStatus === 'canceled' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                    isDeletedLead(lead) ? 'bg-slate-100 text-slate-600 border-slate-300' :
                                'bg-slate-50 text-slate-500 border-slate-100'
                            }`}>
                            {pipelineStatus}
                        </span>
                        {lead.leadNote && (
                            <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md max-w-full truncate">
                                {lead.leadNote}
                            </span>
                        )}
                    </div>
                </div>

                <div className="text-xs text-slate-500 space-y-1.5 mb-3">
                    <div className="inline-flex items-center gap-1 rounded-md bg-crm-50 border border-crm-100 text-crm-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                        ID:{' '}
                        <CopyableText
                            value={formatTrackingId(lead.trackingId)}
                            className="text-crm-700 hover:text-crm-800"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                        <Clock size={12} className="text-slate-400 shrink-0" />
                        <span>Created {formatLeadCreatedDate(lead)}</span>
                    </div>
                    <div className="flex items-center gap-2 w-full">
                        <MapPin size={14} className="text-crm-500 shrink-0" />
                        {hasLeadDestination(lead.destination) ? (
                            <div className="flex items-center gap-1.5 truncate flex-1 text-[13px] text-slate-700">
                                {lead.source && (
                                    <>
                                        <span className="truncate text-slate-500">{lead.source?.split(' - ')[0]}</span>
                                        <span className="shrink-0 text-slate-300 font-bold">→</span>
                                    </>
                                )}
                                <span className="flex items-center gap-1 truncate">
                                    <span>{getFlag(lead.destination)}</span>
                                    <span className="truncate">{getLeadDestinationLabel(lead.destination)}</span>
                                </span>
                            </div>
                        ) : (
                            <span className="text-[12px] text-slate-400 italic">Destination not selected</span>
                        )}
                    </div>
                    {(() => {
                        const agent = (db.travelAgents?.data || []).find((a: any) => a.id === lead.agentId || a.businessName === lead.agentName);
                        const settings = db?.settings?.data?.[0];

                        let displayName = agent?.businessName || agent?.name || lead.agentName || '';

                        // Fallback to global settings if it's the main agency or if lookup fails
                        if (!displayName || displayName === 'Holidays Hub') {
                            displayName = settings?.agencyName || 'Holidays Hub';
                        }

                        return (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-50">
                                <User size={12} className="text-indigo-400" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                    Handled by: <span className="text-indigo-600 font-black">{displayName}</span>
                                </span>
                            </div>
                        );
                    })()}
                    {userRole !== 'admin' && lead.createdByName && (
                        <div className="flex items-center gap-2 mt-1">
                            <Clock size={12} className="text-emerald-400" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                                Created by: <span className="text-emerald-600 font-bold">{lead.createdByName}</span>
                            </span>
                        </div>
                    )}
                </div>

                {/* PROPOSAL HUB TRIGGER */}
                {leadQuotes.length > 0 && (
                    <div className="mt-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                            className="w-full py-4 px-4 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl flex flex-col items-center justify-center gap-2 group/btn hover:bg-white hover:border-indigo-500 hover:shadow-xl transition-all active:scale-95"
                        >
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-md group-hover/btn:bg-indigo-600 group-hover/btn:text-white transition-all transform group-hover/btn:rotate-12">
                                <FileText size={24} />
                            </div>
                            <div className="text-center">
                                <span className="block text-[11px] font-black text-indigo-700 uppercase tracking-widest">Manage Proposals</span>
                                <span className="block text-[10px] text-indigo-400 font-bold uppercase">{leadQuotes.length} Options Iterated</span>
                            </div>
                        </button>
                    </div>
                )}

                {/* MODAL SYSTEM */}
                {isExpanded && leadQuotes.length > 0 && (
                    <ProposalHubModal
                        lead={lead}
                        quotes={sortedQuotes}
                        confirmedQuoteId={lead.confirmedQuoteId}
                        db={db}
                        onClose={() => setIsExpanded(false)}
                        onSelectQuote={(quote: any) => {
                            setSelectedQuote(quote);
                        }}
                    />
                )}

                {selectedQuote && (
                    <QuoteDetailModal
                        quote={selectedQuote}
                        db={db}
                        onClose={() => setSelectedQuote(null)}
                        onConfirm={handleConfirm}
                        onCustomise={handleCustomise}
                    />
                )}

                <div className="flex gap-2 pt-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(lead); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white text-slate-500 hover:text-crm-600 hover:bg-crm-50 rounded-lg text-[10px] font-bold transition-all border border-slate-200"
                    >
                        <Edit2 size={12} /> Edit Lead
                    </button>
                    {lead.status !== 'canceled' && onCancel && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onCancel(lead); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg text-[10px] font-bold transition-all border border-amber-200"
                        >
                            <Ban size={12} /> Cancel Trip
                        </button>
                    )}
                    {!isDeletedLead(lead) && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-[10px] font-bold transition-all border border-slate-200"
                    >
                        <Trash2 size={12} /> Delete
                    </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 text-[11px] text-slate-500 space-y-1.5 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <Mail size={12} className="text-slate-400" />
                        <a href={`mailto:${lead.email}`} className="hover:text-crm-600 transition-colors">{lead.email}</a>
                    </div>
                    <div className="flex items-center gap-2">
                        <Phone size={12} className="text-slate-400" />
                        <a href={`tel:${lead.phone}`} className="hover:text-crm-600 transition-colors">{lead.phone}</a>
                    </div>
                </div>
            )}
        </div>
    );
};

const AgentLeadsView = () => {
    const { db, addRecord, updateRecord, deleteRecord, softDeleteLead, getNextId } = useDatabase();
    const userRole = localStorage.getItem('userRole');
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [highlightedLeadId, setHighlightedLeadId] = useState('');

    // Auth context
    const userEmail = localStorage.getItem('userEmail');
    const currentAgentId = localStorage.getItem('agentId');

    const bookings = useMemo(() => {
        const allBookings = db.bookings?.data || [];
        if (userRole === 'admin') return allBookings;
        return allBookings.filter((b: any) =>
            recordVisibleToSession('bookings', b, db, {
                userRole,
                userEmail,
                sessionAgentId: currentAgentId,
            })
        );
    }, [db.bookings?.data, db, userRole, userEmail, currentAgentId]);

    const leads = useMemo(() => {
        const allLeads = db.leads?.data || [];
        return allLeads.filter(
            (l: any) =>
                leadVisibleToUser(l, db, userRole, userEmail, currentAgentId) &&
                !isDeletedLead(l)
        );
    }, [db, userRole, userEmail, currentAgentId]);

    // Harvest ALL destinations from across the entire catalog (Match Studio behavior)
    const activeDestinations = useMemo(() => {
        const uniqueDests = new Set<string>();

        // Collect from all catalog sources
        (db.hotels?.data || []).forEach((h: any) => uniqueDests.add(h.location?.split(',').pop()?.trim() || h.destination?.split(',').pop()?.trim() || ''));
        (db.activities?.data || []).forEach((a: any) => uniqueDests.add(a.location?.split(',').pop()?.trim() || a.country?.split(',').pop()?.trim() || ''));
        (db.customPresets?.data || []).forEach((p: any) => uniqueDests.add(p.destination?.split(',').pop()?.trim() || ''));

        return Array.from(uniqueDests)
            .filter(Boolean)
            .filter((countryName) => countryName.toLowerCase() !== 'global')
            .sort()
            .map(countryName => {
                // Find matching master destination for flag and data
                const masterDest = (db.destinations?.data || []).find(
                    (d: any) =>
                        String(d.country || '').toLowerCase() === countryName.toLowerCase() ||
                        String(d.name || '').toLowerCase() === countryName.toLowerCase()
                );
                const masterFlag = masterDest?.flag;
                const sourceFlag = sourceCountries.find(sc => sc.name.toLowerCase() === countryName.toLowerCase())?.flag;

                // Find matching preset
                const matchedPreset = (db.customPresets?.data || []).find((p: any) => p.destination?.toLowerCase().includes(countryName.toLowerCase()));

                return {
                    id: matchedPreset?.id || countryName, // Use countryName as fallback ID
                    presetId: matchedPreset?.id || '',
                    country: countryName,
                    name: masterDest?.name || countryName,
                    flag: masterFlag || sourceFlag || '🌐',
                    destination: matchedPreset?.destination || countryName
                };
            });
    }, [db.hotels?.data, db.activities?.data, db.customPresets?.data, db.destinations?.data]);

    const [showModal, setShowModal] = useState(false);
    const [editingLead, setEditingLead] = useState<any>(null);
    const [viewMode, setViewModeState] = useState<'pipeline' | 'list'>(() => {
        const fromUrl = searchParams.get('view');
        if (fromUrl === 'list' || fromUrl === 'pipeline') return fromUrl;
        return parseLeadsViewMode(sessionStorage.getItem(LEADS_VIEW_STORAGE_KEY));
    });
    const [listStatusFilter, setListStatusFilter] = useState<string>('all');

    const setViewMode = useCallback(
        (mode: 'pipeline' | 'list') => {
            setViewModeState(mode);
            sessionStorage.setItem(LEADS_VIEW_STORAGE_KEY, mode);
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    if (mode === 'pipeline') {
                        next.delete('view');
                    } else {
                        next.set('view', mode);
                    }
                    return next;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    useEffect(() => {
        sessionStorage.setItem(LEADS_VIEW_STORAGE_KEY, viewMode);
    }, [viewMode]);

    const listViewLeads = useMemo(() => {
        if (listStatusFilter === 'all') return leads;
        return leads.filter((l: any) => leadMatchesKanbanColumn(l, listStatusFilter, db));
    }, [leads, listStatusFilter, db]);

    const leadNoteHistory: any[] = Array.isArray(editingLead?.leadNoteHistory)
        ? editingLead.leadNoteHistory
        : [];

    const [startDateInput, setStartDateInput] = useState('');

    // Traveler state for form
    const [formAdults, setFormAdults] = useState(2);
    const [formKids, setFormKids] = useState(0);
    const [formSourceCountry, setFormSourceCountry] = useState('India');
    const [formSourceAirport, setFormSourceAirport] = useState('BOM (Mumbai)');
    const [formPresetId, setFormPresetId] = useState('');
    const [formFlightMeal, setFormFlightMeal] = useState({ optIn: true, type: 'Veg' as any });
    const [formHotelTier, setFormHotelTier] = useState<'Standard' | 'Deluxe' | 'Luxury'>('Standard');
    // Stores the full destination string like "Dubai, UAE" (same as preset.destination)
    const [formDestinationCountry, setFormDestinationCountry] = useState('');
    const [formCountryCode, setFormCountryCode] = useState('+91');
    const [formPhone, setFormPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [formAgentId, setFormAgentId] = useState('');
    const [formNeedFlight, setFormNeedFlight] = useState(true);
    const [formHotelMealPlan, setFormHotelMealPlan] = useState('CP (Breakfast Only)');
    const [formHotelId, setFormHotelId] = useState('');
    const [formLeadNote, setFormLeadNote] = useState('');
    const [isDestinationDropdownOpen, setIsDestinationDropdownOpen] = useState(false);

    const [showReportModal, setShowReportModal] = useState(false);
    const [reportTimeframe, setReportTimeframe] = useState('month');
    const [cancelTarget, setCancelTarget] = useState<CancelTripTarget | null>(null);
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');

    useEffect(() => {
        const leadId = searchParams.get('highlightLeadId');
        const focusTs = searchParams.get('focusTs');
        if (!leadId || !focusTs) return;

        setHighlightedLeadId(leadId);

        const timer = window.setTimeout(() => {
            const el = document.querySelector(`[data-lead-id="${leadId}"]`) as HTMLElement | null;
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
        }, 120);

        const clearTimer = window.setTimeout(() => {
            setHighlightedLeadId('');
        }, 3200);

        return () => {
            clearTimeout(timer);
            clearTimeout(clearTimer);
        };
    }, [searchParams]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollIntervalRef = useRef<number | null>(null);
    const startDateRef = useRef<HTMLInputElement>(null);

    const openScheduleDatePicker = () => {
        const input = startDateRef.current;
        if (!input) return;
        try {
            input.showPicker();
        } catch {
            input.focus();
        }
    };

    const getLeadBudgetDisplay = (lead: any) => getUnifiedBudgetForLead(lead, db);

    // Filters & Graph Computations
    const filteredLeads = useMemo(() => {
        if (reportTimeframe === 'custom') {
            const from = customDateFrom ? new Date(customDateFrom) : null;
            const to = customDateTo ? new Date(customDateTo + 'T23:59:59') : null;
            return leads.filter((l: any) => {
                if (!l.createdAt) return false;
                const d = new Date(l.createdAt);
                if (from && d < from) return false;
                if (to && d > to) return false;
                return true;
            });
        }
        const daysMap: Record<string, number> = { week: 7, month: 30, year: 365 };
        const days = daysMap[reportTimeframe];
        if (!days) return leads;
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - days);
        return leads.filter((l: any) => l.createdAt && new Date(l.createdAt) >= threshold);
    }, [leads, reportTimeframe, customDateFrom, customDateTo]);

    const pipelineData = useMemo(() => {
        const counts = { new: 0, contacted: 0, itinerary: 0, negotiation: 0, confirmed: 0, completed: 0, canceled: 0 };
        filteredLeads.forEach((l: any) => {
            const column = resolveLeadKanbanColumn(db, l);
            if (counts[column as keyof typeof counts] !== undefined) {
                counts[column as keyof typeof counts]++;
            }
        });
        const max = Math.max(...Object.values(counts), 1);
        return { counts, max };
    }, [filteredLeads, db]);


    const startScroll = (direction: 'left' | 'right') => {
        if (scrollIntervalRef.current) return;
        scrollIntervalRef.current = window.setInterval(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft += direction === 'left' ? -8 : 8;
            }
        }, 16);
    };

    const stopScroll = () => {
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
    };

    const handleMouseMoveOrDrag = (e: React.MouseEvent | React.DragEvent) => {
        if (!scrollContainerRef.current) return;
        const rect = scrollContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;

        const scrollZoneWidth = 100;
        if (x < scrollZoneWidth) {
            startScroll('left');
        } else if (x > rect.width - scrollZoneWidth) {
            startScroll('right');
        } else {
            stopScroll();
        }
    };

    useEffect(() => {
        return () => stopScroll();
    }, []);

    const openAddModal = () => {
        setEditingLead(null);
        setStartDateInput('');
        setFormAdults(2);
        setFormKids(0);
        setFormSourceCountry('India');
        setFormSourceAirport('BOM (Mumbai)');
        setFormPresetId('');
        setFormDestinationCountry('');
        // Auto-assign to current staff member, or "Me" for agents
        setFormAgentId(userRole === 'staff' ? (userEmail || '') : '');
        setFormNeedFlight(true);
        setFormFlightMeal({ optIn: true, type: 'Veg' });
        setFormHotelTier('Standard');
        setFormHotelMealPlan('CP (Breakfast Only)');
        setFormHotelId('');
        setFormCountryCode('+91');
        setFormPhone('');
        setPhoneError('');
        setFormLeadNote('');
        setIsDestinationDropdownOpen(false);
        setShowModal(true);
    };

    const openEditModal = (lead: any) => {
        setEditingLead(lead);

        // Match Source Country from lead.source if available
        if (lead.sourceCountry) {
            setFormSourceCountry(lead.sourceCountry);
            setFormSourceAirport(lead.sourceAirport || '');
        } else if (lead.source && typeof lead.source === 'string' && lead.source.includes(' - ')) {
            const parts = lead.source.split(' - ');
            setFormSourceCountry(parts[0]);
            setFormSourceAirport(parts[1]);
        } else {
            setFormSourceCountry('India');
            setFormSourceAirport('BOM (Mumbai)');
        }

        // Parse existing dates
        if (lead.dates && typeof lead.dates === 'string') {
            const parts = lead.dates.split(' - ');
            if (parts.length >= 1) {
                const year = new Date().getFullYear();
                const tryDate = new Date(`${parts[0].trim()}, ${year}`);
                if (!isNaN(tryDate.getTime())) {
                    setStartDateInput(tryDate.toISOString().split('T')[0]);
                } else {
                    setStartDateInput('');
                }
            }
        } else {
            setStartDateInput('');
        }

        // Parse existing travelers
        const { adults, kids } = parseTravelers(lead.travelers);
        setFormAdults(adults);
        setFormKids(kids);
        const leadDest = String(lead.destination || '').trim();
        const resolvedPresetId =
            lead.presetId ||
            (leadDest ? leadDest.split(',').pop()?.trim() : '') ||
            leadDest;
        setFormPresetId(resolvedPresetId || '');

        // Restore full destination
        const matchedDest = activeDestinations.find(
            (d) => (resolvedPresetId && d.id === resolvedPresetId) || (leadDest && d.country === leadDest)
        );
        setFormDestinationCountry(matchedDest?.destination || leadDest || '');
        setFormAgentId(resolveLeadAssigneeFormValue(lead, db));
        setFormNeedFlight(lead.needFlight !== undefined ? lead.needFlight : true);
        setFormFlightMeal(lead.flightMeal || { optIn: true, type: 'Veg' });
        setFormHotelTier(lead.hotelTier || 'Standard');
        setFormHotelMealPlan(lead.hotelMealPlan || 'CP (Breakfast Only)');
        setFormHotelId(lead.hotelId || '');
        setFormLeadNote(lead.leadNote || '');

        // Parse lead phone into code and number
        const leadPhone = lead.phone || '';
        const matchedCode = COUNTRY_PHONE_DATA.find(c => leadPhone.startsWith(c.code));
        if (matchedCode) {
            setFormCountryCode(matchedCode.code);
            setFormPhone(sanitizeLocalPhoneDigits(leadPhone.slice(matchedCode.code.length).trim(), matchedCode.code));
        } else {
            setFormCountryCode('+91');
            setFormPhone(sanitizeLocalPhoneDigits(leadPhone.replace(/^\+\d+\s?/, ''), '+91'));
        }

        setPhoneError('');
        setIsDestinationDropdownOpen(false);
        setShowModal(true);
    };

    const selectedDestination = activeDestinations.find((d) => d.id === formPresetId) || null;

    const handleDeleteLead = (id: string) => {
        if (window.confirm('Move this lead to Deleted? You can still find it in the Deleted column.')) {
            softDeleteLead(id);
        }
    };

    const openCancelModal = (lead: any) => {
        setCancelTarget({
            kind: 'lead',
            id: lead.id,
            trackingId: formatTrackingId(lead.trackingId),
            customerName: lead.name,
            destination: lead.destination,
            duration: lead.duration,
            breadcrumb: [formatTrackingId(lead.trackingId), lead.name, lead.destination?.split(',')[0]].filter((part) => part && part !== '-').join(' • '),
        });
    };

    const handleConfirmCancel = (payload: { reason: string; contactReminderOn: string; notes: string }) => {
        if (!cancelTarget) return;
        applyTripCancellation(db, updateRecord, {
            leadId: cancelTarget.id,
            customerName: cancelTarget.customerName,
            payload,
        });
        setCancelTarget(null);
        alert('Trip marked as canceled.');
    };

    const handleSaveLead = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const phoneValidationError = validateLocalPhone(formCountryCode, formPhone);
        if (phoneValidationError) {
            setPhoneError('Please enter a correct mobile number.');
            return;
        }
        setPhoneError('');

        const startDateValue = formData.get('startDate') as string;
        if (!startDateValue) return;

        const startDate = new Date(startDateValue);
        const selectedPreset = (db.customPresets?.data || []).find((p: any) => p.id === formPresetId);
        const destinationValue = String(selectedPreset?.destination || formDestinationCountry || '').trim();
        const resolvedPresetId = destinationValue ? formPresetId : '';
        const nights = parseDurationNights(selectedPreset?.duration || '');
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + nights);

        const durationStr = selectedPreset?.duration || `${nights} Nights / ${nights + 1} Days`;
        const datesFormatted = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        // Use shared pricing to compute budget
        const pricing = calculateQuote({
            presetId: formPresetId,
            adults: formAdults,
            kids: formKids,
            flightMeal: formFlightMeal,
            hotelTier: formHotelTier,
            hotelId: formHotelId,
            hotelMealPlan: formHotelMealPlan,
            needFlight: formNeedFlight
        }, db.customPresets?.data || [], db.hotels?.data || []);
        const preset = pricing.preset;

        const sourceCountryData = sourceCountries.find(c => c.name === formSourceCountry);
        const sourceFlag = sourceCountryData?.flag || '🇮🇳';
        const airportCode = formSourceAirport.split(' ')[0] || 'BOM';

        // Find the current main agent if the user is an agent
        const currentAgent = (db.travelAgents?.data || []).find((a: any) => a.email === userEmail);
        const agentId = currentAgent?.id;

        const resolvedAgentId = resolveLeadAgentId(userRole, formAgentId, currentAgentId, db, userEmail);

        const newLeadNote = formLeadNote.trim();
        const oldLeadNote = editingLead?.leadNote || '';

        const safeExistingLeadNoteHistory = Array.isArray(editingLead?.leadNoteHistory)
            ? editingLead?.leadNoteHistory
            : [];

        const nextLeadNoteHistory = (() => {
            const entry = (payload: { from: any; to: any }) => ({
                id: `LN-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                at: new Date().toISOString(),
                from: payload.from ?? '',
                to: payload.to ?? '',
                updatedBy: userEmail || 'System',
            });

            if (!editingLead) {
                // Seed history on first save if the user entered a note.
                if (!newLeadNote) return [];
                return [entry({ from: '', to: newLeadNote })];
            }

            // Only add an entry when the note actually changes.
            if (String(oldLeadNote) === String(newLeadNote)) return safeExistingLeadNoteHistory;

            return [
                entry({ from: oldLeadNote, to: newLeadNote }),
                ...safeExistingLeadNoteHistory,
            ];
        })();

        let leadStatus = editingLead ? editingLead.status : 'new';
        const leadHasQuotes = editingLead
            ? getQuotationsForLead(db, editingLead).length > 0
            : false;

        if (!leadHasQuotes) {
            leadStatus = newLeadNote ? 'contacted' : 'new';
        } else if (
            editingLead?.status === 'new' &&
            newLeadNote &&
            String(oldLeadNote) !== String(newLeadNote)
        ) {
            leadStatus = 'contacted';
        }

        const data: any = {
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            phone: `${formCountryCode} ${formPhone}`,
            travelers: pricing.travelersLabel,
            sourceCountry: formSourceCountry,
            sourceAirport: formSourceAirport,
            sourceCountryFlag: sourceFlag,
            sourceAirportCode: airportCode,
            source: `${formSourceCountry} - ${formSourceAirport}`,
            // Store the full destination from the matched preset (e.g. "Dubai, UAE"), not just a country label
            destination: destinationValue,
            startDate: startDateValue,
            dates: datesFormatted,
            duration: durationStr,
            budget: pricing.budgetFormatted,
            presetId: resolvedPresetId,
            flightMeal: formFlightMeal,
            hotelTier: formHotelTier,
            hotelMealPlan: formHotelMealPlan,
            hotelId: formHotelId,
            needFlight: formNeedFlight,
            createdAt: editingLead?.createdAt || new Date().toISOString(),
            status: leadStatus,
            agentId: resolvedAgentId,
            agentName: (() => {
                const agent = (db.travelAgents?.data || []).find((a: any) => a.id === resolvedAgentId);
                if (agent) return agent.businessName || agent.name || 'Holidays Hub';
                const staffMember = (db.staff?.data || []).find(
                    (s: any) => s.employeeId === resolvedAgentId || s.id === resolvedAgentId
                );
                if (staffMember) {
                    const parentAgent = (db.travelAgents?.data || []).find((a: any) => a.id === staffMember.agentId);
                    return parentAgent?.businessName || parentAgent?.name || 'Holidays Hub';
                }
                return 'Holidays Hub';
            })(),
            createdById: formAgentId || userEmail || '',
            createdByRole: userRole,
            createdByName: (() => {
                // Try finding the name of the selected agent/staff member
                const selectedAgent = (db.travelAgents?.data || []).find((a: any) => a.id === formAgentId);
                const selectedStaff = (db.staff?.data || []).find((s: any) => s.employeeId === formAgentId || s.id === formAgentId);

                if (selectedAgent) return selectedAgent.name;
                if (selectedStaff) return selectedStaff.name;

                // Fallback to logged-in user name
                return (db.staff?.data?.find((s: any) => s.employeeId === userEmail)?.name) ||
                    (db.travelAgents?.data?.find((a: any) => a.email === userEmail)?.name) || 'System';
            })(),
            trackingId: editingLead?.trackingId
                ? normalizeTrackingId(editingLead.trackingId)
                : generateTrackingId((db?.leads?.data || []).map((l: any) => l.trackingId)),
            leadNote: newLeadNote,
            leadNoteHistory: nextLeadNoteHistory,
        };

        if (editingLead) {
            updateRecord('leads', editingLead.id, data);

            const quotationMatch = (db.quotations?.data || []).find((q: any) => q.customer === editingLead.name);
            if (quotationMatch) {
                updateRecord('quotations', quotationMatch.id, {
                    customer: data.name,
                    destination: data.destination,
                    total: pricing.total,
                    status: data.status
                });
            }

            // Sync to matching booking
            const bookingMatch = (db.bookings?.data || []).find((b: any) => b.customer === editingLead.name);
            if (bookingMatch) {
                updateRecord('bookings', bookingMatch.id, {
                    customer: data.name,
                    package: preset.name,
                    dates: data.dates,
                    total: pricing.budgetFormatted,
                    travelers: pricing.travelersLabel,
                    presetId: resolvedPresetId,
                    sourceCountry: data.sourceCountry,
                    sourceAirport: data.sourceAirport,
                    source: data.source,
                    sourceCountryFlag: sourceFlag,
                    sourceAirportCode: airportCode,
                    status: data.status
                });
            }
        } else {
            const nextId = getNextId('leads', 'LD');
            addRecord('leads', { id: nextId, ...data });

            ensureCustomerRecord(db, addRecord, getNextId, data);
        }

        setShowModal(false);
    };

    const handleDragStart = (e: React.DragEvent, leadId: string) => {
        e.dataTransfer.setData('leadId', leadId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const requestQuotationForConfirmation = (lead: any) => {
        const leadQuotes = getQuotationsForLead(db, lead);
        if (leadQuotes.length === 0) {
            window.alert(
                'A quotation is required before confirming this lead. You will be redirected to create one.'
            );
            navigate(`/quotations?leadId=${encodeURIComponent(lead.id)}&createQuote=true`);
            return;
        }
        window.alert(
            'Select a package quotation and confirm it before moving this lead to Confirmed. Opening quotations…'
        );
        navigate(`/quotations?leadId=${encodeURIComponent(lead.id)}&selectQuote=true`);
    };

    const requestQuotationBeforeLeavingNew = (lead: any) => {
        window.alert(
            'Create a quotation before moving this lead out of New Leads. You will be redirected to create one.'
        );
        navigate(`/quotations?leadId=${encodeURIComponent(lead.id)}&createQuote=true`);
    };

    const handleCreateQuotationFromEdit = () => {
        if (!editingLead?.id) return;
        setShowModal(false);
        navigate(`/quotations?leadId=${encodeURIComponent(editingLead.id)}&createQuote=true`);
    };

    const handleStatusChange = (leadId: string, statusId: string) => {
        const lead = leads.find((l: any) => l.id === leadId);
        const currentColumn = lead ? resolveLeadKanbanColumn(db, lead) : '';
        if (!lead || currentColumn === statusId) return;

        if (statusId === 'canceled') {
            openCancelModal(lead);
            return;
        }

        if (statusId === 'deleted') {
            softDeleteLead(leadId);
            return;
        }

        if (
            getQuotationsForLead(db, lead).length === 0 &&
            statusId !== 'new' &&
            statusId !== 'contacted'
        ) {
            requestQuotationBeforeLeavingNew(lead);
            return;
        }

        if (statusId === 'contacted' && !hasLeadHighlightOrFollowUp(lead)) {
            window.alert(
                'Add a lead highlight or follow-up note before moving this lead to Contacted.'
            );
            return;
        }

        if ((statusId === 'confirmed' || statusId === 'completed') && !canConfirmLead(db, lead)) {
            requestQuotationForConfirmation(lead);
            return;
        }

        updateRecord('leads', leadId, { status: statusId });

        const quotationMatches = getQuotationsForLead(db, lead);

        if (statusId === 'confirmed' || statusId === 'completed') {
            const confirmedQuote = getConfirmedQuoteForLead(db, lead);
            if (confirmedQuote) {
                updateRecord('quotations', confirmedQuote.id, {
                    status: 'confirmed',
                    leadId: lead.id,
                });
            }
            syncConfirmedLeadBookingStatus(
                db,
                updateRecord,
                { ...lead, status: statusId },
                lead.confirmedQuoteId,
                addRecord,
                getNextId
            );
        } else {
            quotationMatches.forEach((q: any) => {
                if (q.status !== 'confirmed' && q.status !== 'canceled' && q.status !== 'cancelled') {
                    updateRecord('quotations', q.id, { status: statusId });
                }
            });
        }
    };

    const handleDrop = (e: React.DragEvent, statusId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const leadId = e.dataTransfer.getData('leadId');
        if (!leadId) return;
        if (statusId === 'canceled') {
            const lead = leads.find((l: any) => l.id === leadId);
            if (lead) openCancelModal(lead);
            return;
        }
        if (statusId === 'deleted') {
            softDeleteLead(leadId);
            return;
        }
        handleStatusChange(leadId, statusId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    return (
        <div className="h-full min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Users className="text-crm-600" size={28} />
                        Leads
                    </h1>
                    {(userRole === 'admin' || userRole === 'agent') && (
                    <p className="text-slate-500 text-sm font-medium">
                        {userRole === 'admin' ? 'Master Global Lead Control' :
                            'Agency Lead Pipeline & Performance'}
                        {' · '}
                        {leads.length === (db?.leads?.data?.length || 0)
                            ? `${leads.length} lead${leads.length === 1 ? '' : 's'} from database`
                            : `${leads.length} of ${db?.leads?.data?.length || 0} leads (your agency scope)`}
                    </p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={openAddModal} className="btn-primary flex items-center gap-2 shadow-crm-600/20">
                        <Plus size={18} /> Add Lead
                    </button>
                    <div className="flex items-center bg-white border border-slate-200 p-1 rounded-lg shadow-sm mr-2">
                        <button
                            onClick={() => setViewMode('pipeline')}
                            className={`p-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all ${viewMode === 'pipeline' ? 'bg-crm-50 text-crm-600 shadow-inner' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            title="Pipeline View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-crm-50 text-crm-600 shadow-inner' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            title="List View"
                        >
                            <List size={18} />
                        </button>
                    </div>
                    <button
                        onClick={() => setShowReportModal(true)}
                        className="btn-secondary flex items-center gap-2 bg-white border border-slate-200 shadow-sm"
                    >
                        <FileText size={18} className="text-slate-500" />
                        Reports
                    </button>
                </div>
            </div>

            {viewMode === 'pipeline' ? (
                <div
                    ref={scrollContainerRef}
                    onMouseMove={handleMouseMoveOrDrag}
                    onMouseLeave={stopScroll}
                    onDragOver={(e) => {
                        handleDragOver(e);
                        handleMouseMoveOrDrag(e);
                    }}
                    onDragLeave={stopScroll}
                    className="flex-1 min-h-0 flex gap-6 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                    {visibleColumns.map(column => {
                        const colLeads = leads.filter((l: any) => leadMatchesKanbanColumn(l, column.id, db));

                        return (
                            <div key={column.id} className="min-w-[320px] w-[320px] flex flex-col">
                                <div className={`px-4 py-2.5 rounded-t-xl font-medium border-b-2 flex justify-between items-center ${column.color}`}>
                                    <span className="text-sm uppercase tracking-wider font-semibold">{column.title}</span>
                                    <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs font-bold">{colLeads.length}</span>
                                </div>
                                <div
                                    className="flex-1 bg-slate-100/50 p-3 rounded-b-xl border border-t-0 border-slate-200 overflow-y-auto"
                                    onDrop={(e) => handleDrop(e, column.id)}
                                    onDragOver={handleDragOver}
                                >
                                    {colLeads.map((lead: any, idx: number) => (
                                        <LeadCard
                                            key={`${lead.id}-${idx}`}
                                            lead={lead}
                                            onDragStart={handleDragStart}
                                            onEdit={openEditModal}
                                            onDelete={handleDeleteLead}
                                            onCancel={openCancelModal}
                                            isHighlighted={highlightedLeadId === lead.id}
                                        />
                                    ))}

                                    {colLeads.length === 0 && (
                                        <div className="h-24 flex items-center justify-center text-sm font-medium text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                            Drop leads here
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-300">
                    <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => setListStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                listStatusFilter === 'all'
                                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                            }`}
                        >
                            All ({leads.length})
                        </button>
                        {visibleColumns.map((column) => {
                            const count = leads.filter((l: any) =>
                                leadMatchesKanbanColumn(l, column.id, db)
                            ).length;
                            return (
                                <button
                                    key={column.id}
                                    type="button"
                                    onClick={() => setListStatusFilter(column.id)}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                        listStatusFilter === column.id
                                            ? `${column.color} shadow-sm ring-1 ring-inset ring-black/5`
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                                    }`}
                                >
                                    {column.title} ({count})
                                </button>
                            );
                        })}
                    </div>
                    <div className="overflow-x-auto flex-1 text-[13px]">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4">Lead Name</th>
                                    <th className="px-6 py-4">Contact Info</th>
                                    <th className="px-6 py-4">Route Info</th>
                                    <th className="px-6 py-4">Trip Details</th>
                                    <th className="px-6 py-4 text-center">Budget</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {listViewLeads.map((lead: any) => {
                                    const effectiveStatus = resolveLeadKanbanColumn(db, lead);
                                    const statusCol = columns.find((c) => c.id === effectiveStatus);
                                    return (
                                        <tr
                                            key={lead.id}
                                            data-lead-id={lead.id}
                                            className={`hover:bg-slate-50/80 transition-colors group ${
                                                highlightedLeadId === lead.id ? 'bg-crm-50/60 ring-1 ring-inset ring-crm-300' : ''
                                            }`}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-bold text-slate-800">{lead.name}</div>
                                                <CopyableText
                                                    value={lead.id}
                                                    className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mt-0.5"
                                                />
                                                <CopyableText
                                                    value={formatTrackingId(lead.trackingId)}
                                                    className="text-[10px] text-crm-600 uppercase tracking-wider font-semibold mt-0.5"
                                                    title="Copy tracking ID"
                                                />
                                                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                    <Clock size={10} className="shrink-0" />
                                                    Created {formatLeadCreatedDate(lead)}
                                                </div>
                                                <div className="flex flex-col gap-1 mt-1">
                                                    {lead.agentName && (
                                                        <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold border border-indigo-100 uppercase tracking-tighter self-start">Agent: {lead.agentName}</span>
                                                    )}
                                                    {lead.createdByName && lead.createdByRole === 'staff' && (
                                                        <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold border border-emerald-100 uppercase tracking-tighter self-start">By: {lead.createdByName}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <Mail size={14} className="text-crm-400" />
                                                        <a href={`mailto:${lead.email}`} className="hover:text-crm-600 transition-colors text-[13px]">{lead.email}</a>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <Phone size={14} className="text-crm-400" />
                                                        <a href={`tel:${lead.phone}`} className="hover:text-crm-600 transition-colors text-[13px]">{lead.phone}</a>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 font-medium text-slate-800">
                                                        <span className="text-base leading-none">{sourceCountries.find(c => c.name === lead.sourceCountry)?.flag || '🌍'}</span>
                                                        <span className="truncate max-w-[110px]">{lead.sourceAirport?.split(' ')[0] || lead.source?.split(' - ')[1]?.split(' ')[0]}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-px w-3 bg-slate-200"></div>
                                                        {hasLeadDestination(lead.destination) ? (
                                                            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                                                                <span>{getFlag(lead.destination)}</span>
                                                                <span>{getLeadDestinationLabel(lead.destination)}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400 italic normal-case tracking-normal font-medium">
                                                                Destination not selected
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-700 font-medium flex items-center gap-2">
                                                    <Calendar size={14} className="text-slate-400 shrink-0" />
                                                    {formatLeadScheduleDate(lead)}
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                                    <User size={10} className="shrink-0" />
                                                    {lead.travelers || 'Unknown'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="font-bold text-green-700 px-2.5 py-1.5 bg-green-50 border border-green-100 rounded-lg shadow-sm">
                                                    {getLeadBudgetDisplay(lead)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <select
                                                    value={effectiveStatus}
                                                    onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                                                    className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-full border shadow-sm inline-block outline-none cursor-pointer transition-all ${statusCol?.color || 'bg-slate-50 text-slate-600'}`}
                                                >
                                                    {visibleColumns.map(col => (
                                                        <option key={col.id} value={col.id} className="bg-white text-slate-700">{col.title}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 transition-all duration-200">
                                                    {lead.status !== 'canceled' && (
                                                        <button onClick={() => openCancelModal(lead)} className="p-2 rounded-lg bg-white text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-all border border-amber-100 shadow-sm" title="Cancel Trip">
                                                            <Ban size={15} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => openEditModal(lead)} className="p-2 rounded-lg bg-white text-slate-500 hover:bg-crm-50 hover:text-crm-600 hover:border-crm-200 transition-all border border-slate-200 shadow-sm" title="Edit Lead">
                                                        <Edit2 size={15} />
                                                    </button>
                                                    {!isDeletedLead(lead) && (
                                                    <button onClick={() => handleDeleteLead(lead.id)} className="p-2 rounded-lg bg-white text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all border border-slate-200 shadow-sm" title="Delete Lead">
                                                        <Trash2 size={15} />
                                                    </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {listViewLeads.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <LayoutGrid size={48} className="text-slate-200 mb-4" />
                                                <p className="text-lg font-medium text-slate-500">
                                                    {listStatusFilter === 'all'
                                                        ? 'No leads found in the database.'
                                                        : 'No leads match this filter.'}
                                                </p>
                                                <p className="text-sm mt-1">
                                                    {listStatusFilter === 'all'
                                                        ? 'Start by adding a new lead to populate your pipeline.'
                                                        : 'Try another status filter or select All to see every lead.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* LEADS MODAL ADD/EDIT */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[2000] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl flex flex-col max-h-[95vh] overflow-hidden">
                        <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-white shrink-0">
                            <h3 className="font-black text-slate-900 text-2xl tracking-tight flex items-center gap-3">
                                {editingLead ? <Edit2 size={24} className="text-crm-500" /> : <Plus size={24} className="text-crm-500" />}
                                {editingLead ? 'Edit Lead' : 'Add New Lead'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all active:scale-90"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveLead} className="p-8 overflow-y-auto flex-1 flex flex-col">
                            <div className="space-y-8">
                                {/* Identity Section */}
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] flex items-center gap-2 mb-2">
                                            <User size={14} className="text-crm-500" /> Primary Lead Identity
                                        </label>
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                                            <div className="md:col-span-12 relative group">
                                                <input
                                                    type="text"
                                                    name="name"
                                                    defaultValue={editingLead?.name}
                                                    required
                                                    className="w-full pl-12 pr-4 py-[15px] bg-slate-50 border border-slate-200 rounded-[22px] text-sm font-bold text-slate-800 focus:border-crm-500 outline-none placeholder:text-slate-400 transition-all shadow-sm"
                                                    placeholder="Customer Full Name"
                                                />
                                                <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-crm-500 transition-colors" />
                                            </div>

                                            <div className="md:col-span-6">
                                                <div className="relative group">
                                                    <input
                                                        type="email"
                                                        name="email"
                                                        defaultValue={editingLead?.email}
                                                        required
                                                        className="w-full pl-12 pr-4 py-[15px] bg-slate-50 border border-slate-200 rounded-[22px] text-sm font-bold text-slate-800 focus:border-crm-500 outline-none placeholder:text-slate-400 transition-all shadow-sm"
                                                        placeholder="Primary Email Address"
                                                    />
                                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-crm-500 transition-colors" />
                                                </div>
                                            </div>

                                            <div className="md:col-span-6">
                                                <div className="flex gap-2">
                                                    <div className="relative w-40 shrink-0 crm-select-wrap">
                                                        <select
                                                            value={formCountryCode}
                                                            onChange={(e) => {
                                                                const nextCode = e.target.value;
                                                                setFormCountryCode(nextCode);
                                                                setFormPhone((current) => sanitizeLocalPhoneDigits(current, nextCode));
                                                                setPhoneError('');
                                                            }}
                                                            className={`w-full pl-4 pr-8 py-[15px] bg-slate-50 border rounded-[22px] text-sm font-bold text-slate-700 outline-none appearance-none cursor-pointer transition-all shadow-sm ${
                                                                phoneError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-crm-500'
                                                            }`}
                                                        >
                                                            {COUNTRY_PHONE_DATA.map(c => (
                                                                <option key={c.code} value={c.code}>{getCountryPhoneLabel(c.code)}</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                            <DropdownChevron size={14} />
                                                        </div>
                                                    </div>
                                                    <div className="relative flex-1 group">
                                                        <input
                                                            type="tel"
                                                            inputMode="numeric"
                                                            autoComplete="tel-national"
                                                            value={formPhone}
                                                            onChange={(e) => {
                                                                setFormPhone(sanitizeLocalPhoneDigits(e.target.value, formCountryCode));
                                                                setPhoneError('');
                                                            }}
                                                            className={`w-full pl-12 pr-16 py-[15px] bg-slate-50 border rounded-[22px] text-sm font-bold text-slate-800 outline-none placeholder:text-slate-300 transition-all font-mono tracking-widest shadow-sm ${
                                                                phoneError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-crm-500'
                                                            }`}
                                                            placeholder={`${getPhoneDigitLimit(formCountryCode)} digits`}
                                                            aria-invalid={Boolean(phoneError)}
                                                            aria-describedby={phoneError ? 'lead-phone-error' : undefined}
                                                        />
                                                        <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-crm-500 transition-colors" />
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${formPhone.length === getPhoneDigitLimit(formCountryCode) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                                                {formPhone.length}/{getPhoneDigitLimit(formCountryCode)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {phoneError && (
                                                    <p id="lead-phone-error" className="mt-2 text-xs font-semibold text-rose-600">
                                                        {phoneError}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="md:col-span-12 relative group">
                                                <input
                                                    type="text"
                                                    value={formLeadNote}
                                                    onChange={(e) => setFormLeadNote(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-[15px] bg-slate-50 border border-slate-200 rounded-[22px] text-sm font-bold text-slate-800 focus:border-crm-500 outline-none placeholder:text-slate-400 transition-all shadow-sm"
                                                    placeholder="Lead Highlight / Follow-up Note (e.g. Call after 6 PM)"
                                                />
                                                <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-crm-500 transition-colors" />
                                            </div>
                                        </div>
                                    </div>

                                    {editingLead && (
                                        <div className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl p-4">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                                Lead Highlight / Follow-up Note History
                                            </div>
                                            {leadNoteHistory.length === 0 ? (
                                                <div className="text-[11px] text-slate-400 italic">
                                                    No history recorded yet.
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {leadNoteHistory.slice(0, 5).map((h: any, idx: number) => (
                                                        <div
                                                            key={h?.id || idx}
                                                            className="p-3 bg-white border border-slate-100 rounded-2xl"
                                                        >
                                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                                                <span>
                                                                    {h?.at
                                                                        ? new Date(h.at).toLocaleString('en-IN', {
                                                                              day: '2-digit',
                                                                              month: 'short',
                                                                              year: 'numeric',
                                                                              hour: '2-digit',
                                                                              minute: '2-digit',
                                                                              hour12: true,
                                                                          })
                                                                        : '—'}
                                                                </span>
                                                                <span className="text-slate-300 font-semibold">•</span>
                                                                <span className="truncate">{h?.updatedBy || 'System'}</span>
                                                            </div>
                                                            <div className="text-xs font-bold text-slate-700 mt-1 line-clamp-2">
                                                                {h?.to || '—'}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 items-end">
                                        {userRole !== 'staff' && (
                                            <div className="space-y-3">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] flex items-center gap-2 mb-2">
                                                    <Users size={14} className="text-indigo-500" />
                                                    {userRole === 'admin' ? 'Assigned Agent/Sub-agent' : 'Assign to Team Member'}
                                                </label>
                                                <div className="relative group crm-select-wrap">
                                                    <select
                                                        value={formAgentId}
                                                        onChange={e => setFormAgentId(e.target.value)}
                                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:border-crm-500 outline-none appearance-none cursor-pointer transition-all shadow-sm"
                                                    >
                                                        <option value="">{userRole === 'admin' ? 'Direct Lead (No Agent)' : 'Me (Direct Handling)'}</option>
                                                        {userRole === 'admin' ? (
                                                            (db.travelAgents?.data || []).map((agent: any) => (
                                                                <option key={agent.id} value={agent.id}>{agent.name} — {agent.businessName}</option>
                                                            ))
                                                        ) : (
                                                            <>
                                                                {filterStaffForAgentSession(db.staff?.data || [], currentAgentId, db).map((member: any) => (
                                                                    <option key={member.id} value={member.employeeId}>Staff: {member.name} ({member.role})</option>
                                                                ))}
                                                                {(db.travelAgents?.data || []).filter((a: any) => a.parentId === currentAgentId).map((subAgent: any) => (
                                                                    <option key={subAgent.id} value={subAgent.id}>Sub-agent: {subAgent.name} — {subAgent.businessName}</option>
                                                                ))}
                                                            </>
                                                        )}
                                                    </select>
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                        <DropdownChevron size={16} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] flex items-center gap-2 mb-2">
                                                <PlusSquare size={14} className="text-emerald-500" /> Traveler Configuration
                                            </label>
                                            <div className="flex gap-4">
                                                <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-200 items-center justify-between flex hover:border-crm-300 transition-all group h-[58px] shadow-sm">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[1px] group-hover:text-crm-500">Adults</span>
                                                    <input type="number" name="adults" min="1" value={formAdults} onChange={e => setFormAdults(parseInt(e.target.value) || 1)} className="w-10 bg-transparent border-none text-right font-black text-slate-800 p-0 focus:ring-0" />
                                                </div>
                                                <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-200 items-center justify-between flex hover:border-crm-300 transition-all group h-[58px] shadow-sm">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[1px] group-hover:text-crm-500">Kids</span>
                                                    <input type="number" name="kids" min="0" value={formKids} onChange={e => setFormKids(parseInt(e.target.value) || 0)} className="w-10 bg-transparent border-none text-right font-black text-slate-800 p-0 focus:ring-0" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Logistics Section */}
                                <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] flex items-center gap-2">
                                            <MapPin size={14} className="text-crm-500" /> Primary Destination
                                        </label>
                                        <div className="bg-slate-50/40 border border-slate-100 rounded-2xl p-4">
                                            <div className="relative z-[60]">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setIsDestinationDropdownOpen((open) => !open);
                                                    }}
                                                    className="w-full flex items-center justify-between gap-3 pl-4 pr-4 py-[15px] bg-white border border-slate-200 rounded-[22px] text-xs font-bold text-slate-700 hover:border-crm-400 focus:border-crm-500 outline-none transition-all shadow-sm"
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden text-left">
                                                        <CountryFlag
                                                            country={selectedDestination?.country || null}
                                                            size={22}
                                                            global={!selectedDestination}
                                                        />
                                                        <span className="truncate">
                                                            {selectedDestination
                                                                ? `${selectedDestination.country} (${selectedDestination.name})`
                                                                : 'Select Destination Hub'}
                                                        </span>
                                                    </div>
                                                    <DropdownChevron
                                                        open={isDestinationDropdownOpen}
                                                        className="text-slate-400"
                                                        size={16}
                                                    />
                                                </button>

                                                {isDestinationDropdownOpen && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-[2500] bg-slate-900/5 backdrop-blur-[1px]"
                                                            onClick={() => setIsDestinationDropdownOpen(false)}
                                                        />
                                                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[2600] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                            <div className="p-2 space-y-1 max-h-[380px] overflow-y-auto custom-scrollbar">
                                                                {activeDestinations.map((dest) => (
                                                                    <button
                                                                        key={dest.id + dest.country}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setFormPresetId(dest.id);
                                                                            setFormDestinationCountry(dest.destination);
                                                                            setIsDestinationDropdownOpen(false);
                                                                        }}
                                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                                                                            formPresetId === dest.id
                                                                                ? 'bg-crm-50 text-crm-700'
                                                                                : 'hover:bg-slate-50 text-slate-600'
                                                                        }`}
                                                                    >
                                                                        <CountryFlag country={dest.country} size={22} />
                                                                        <div className="text-left min-w-0">
                                                                            <p className="text-[11px] font-black uppercase tracking-tight truncate">
                                                                                {dest.country}
                                                                            </p>
                                                                            <p className="text-[10px] opacity-70 truncate">{dest.name}</p>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label htmlFor="lead-schedule-date" className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] flex items-center gap-2">
                                            <Calendar size={14} className="text-crm-500" /> Schedule Date
                                        </label>
                                        <div className="bg-slate-50/40 border border-slate-100 rounded-2xl p-4 cursor-pointer" onClick={openScheduleDatePicker}>
                                            <div className="relative group">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-crm-500 pointer-events-none z-10">
                                                    <Calendar size={14} />
                                                </div>
                                                <input ref={startDateRef} id="lead-schedule-date" type="date"
                                                    name="startDate" required value={startDateInput} onChange={e => setStartDateInput(e.target.value)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openScheduleDatePicker();
                                                    }} onFocus={openScheduleDatePicker} className="w-full pl-9 pr-3 py-[15px] bg-white border border-slate-200 rounded-[22px] text-xs font-bold text-slate-700 focus:border-crm-500 outline-none transition-all shadow-sm cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100"/>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3 justify-between items-center shrink-0">
                                {editingLead ? (
                                    <button
                                        type="button"
                                        onClick={handleCreateQuotationFromEdit}
                                        className="px-5 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                                    >
                                        <FileText size={18} />
                                        Create Quotation
                                    </button>
                                ) : (
                                    <span />
                                )}
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-6 py-2.5 text-sm font-medium text-white bg-crm-600 hover:bg-crm-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
                                        <CheckCircle2 size={18} />
                                        {editingLead ? 'Update Lead' : 'Create Lead'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showReportModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[2050] flex items-center justify-center p-4 sm:p-6 overflow-hidden print:bg-white print:p-0">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh] print:max-w-none print:max-h-none print:shadow-none print:rounded-none border border-slate-200">
                        <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-white shrink-0 print:hidden rounded-t-[40px]">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                <FileText className="text-crm-500" size={20} />
                                Pipeline Performance Report
                            </h3>
                            <div className="flex gap-2 items-center">
                                <div className="flex items-center gap-2 mr-4 text-sm text-slate-600 font-medium">
                                    <Filter size={16} className="text-slate-400" />
                                    Filter:
                                    <div className="relative crm-select-wrap">
                                    <select
                                        value={reportTimeframe}
                                        onChange={(e) => setReportTimeframe(e.target.value)}
                                        className="px-2 py-1.5 pr-8 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-crm-500 bg-white font-medium appearance-none cursor-pointer"
                                    >
                                        <option value="week">Last Week</option>
                                        <option value="month">Last Month</option>
                                        <option value="year">Last Year</option>
                                        <option value="custom">Custom Range</option>
                                    </select>
                                    <DropdownChevron size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                    {reportTimeframe === 'custom' && (
                                        <div className="flex items-center gap-1.5 ml-1">
                                            <input
                                                type="date"
                                                value={customDateFrom}
                                                onChange={e => setCustomDateFrom(e.target.value)}
                                                className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-crm-500 bg-white w-[130px]"
                                            />
                                            <span className="text-slate-400 text-xs">to</span>
                                            <input
                                                type="date"
                                                value={customDateTo}
                                                onChange={e => setCustomDateTo(e.target.value)}
                                                min={customDateFrom || undefined}
                                                className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-crm-500 bg-white w-[130px]"
                                            />
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => window.print()} className="px-4 py-2 bg-crm-600 text-white text-sm font-medium rounded-lg hover:bg-crm-700 transition flex items-center gap-2">
                                    <Download size={16} /> Print / Export
                                </button>
                                <button type="button" onClick={() => setShowReportModal(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors ml-2">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 overflow-y-auto flex-1 bg-white print:p-0 print:overflow-visible" id="invoice-print-area">
                            <div className="flex justify-between items-start mb-10 pb-6 border-b border-slate-100">
                                <div>
                                    <h2 className="text-2xl font-bold text-crm-800">Travel CRM</h2>
                                    <p className="text-slate-500 mt-1">Lead Pipeline Abstract</p>
                                </div>
                                <div className="text-right">
                                    <h3 className="font-semibold text-slate-800">Pipeline Report</h3>
                                    <p className="text-sm text-slate-500 mt-2">Generated: {new Date().toLocaleDateString()}</p>
                                    <p className="text-sm text-slate-500 mt-0.5 font-medium">Applied Filter: <span className="text-crm-600">{reportTimeframe === 'week' ? 'Last Week' : reportTimeframe === 'month' ? 'Last Month' : reportTimeframe === 'year' ? 'Last Year' : customDateFrom && customDateTo ? `${new Date(customDateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(customDateTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Custom Range'}</span></p>
                                </div>
                            </div>

                            {/* Graphical Distribution */}
                            <div className="mb-10 pb-8 border-b border-slate-100 print:hidden">
                                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-8">Pipeline Volume Trajectory ({filteredLeads.length} Matching Leads)</h4>
                                <div className="flex items-end gap-3 h-32 px-4">
                                    {Object.entries(pipelineData.counts).map(([status, count]) => {
                                        const hPct = (count / pipelineData.max) * 100;
                                        const isActive = count > 0;
                                        return (
                                            <div key={status} className="flex-1 flex flex-col justify-end items-center gap-2 group relative">
                                                {isActive && (
                                                    <div className="absolute -top-10 bg-slate-800 text-white text-[11px] px-2.5 py-1 rounded-md font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                                                        {count} Lead{count !== 1 && 's'} Found
                                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                                    </div>
                                                )}
                                                <div
                                                    className={`w-full max-w-[70px] rounded-t-md flex items-end justify-center pb-2 text-sm font-bold transition-all duration-700 shadow-sm
                                                        ${isActive
                                                            ? status === 'new' ? 'bg-blue-200 text-blue-800 cursor-pointer hover:bg-blue-300' :
                                                                status === 'contacted' ? 'bg-amber-200 text-amber-800 cursor-pointer hover:bg-amber-300' :
                                                                    status === 'itinerary' ? 'bg-indigo-200 text-indigo-800 cursor-pointer hover:bg-indigo-300' :
                                                                        status === 'negotiation' ? 'bg-purple-200 text-purple-800 cursor-pointer hover:bg-purple-300' :
                                                                            status === 'canceled' ? 'bg-rose-200 text-rose-800 cursor-pointer hover:bg-rose-300' :
                                                                                status === 'deleted' ? 'bg-slate-200 text-slate-700 cursor-pointer hover:bg-slate-300' :
                                                                                    status === 'completed' ? 'bg-teal-200 text-teal-800 cursor-pointer hover:bg-teal-300' :
                                                                                        'bg-emerald-200 text-emerald-800 cursor-pointer hover:bg-emerald-300'
                                                            : 'bg-slate-50 border border-slate-100'}`}
                                                    style={{ height: isActive ? `${Math.max(15, hPct)}%` : '4px' }}
                                                >
                                                    {isActive && <span className="drop-shadow-sm">{count}</span>}
                                                </div>
                                                <span className="text-[10px] text-slate-400 uppercase font-bold text-center tracking-wider leading-tight w-full truncate border-t border-slate-100 pt-2">
                                                    {status}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                        <tr>
                                            <th className="px-5 py-3.5">Lead ID / Created</th>
                                            <th className="px-5 py-3.5">Customer Name</th>
                                            <th className="px-5 py-3.5">Package / Destination</th>
                                            <th className="px-5 py-3.5">Total Amount</th>
                                            <th className="px-5 py-3.5 text-right">Pipeline Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredLeads.map((lead: any) => {
                                            const presetMatch = lead.presetId ? packagePresets.find(p => p.id === lead.presetId) : null;
                                            return (
                                                <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-5 py-4 font-medium text-slate-800">
                                                        <CopyableText value={lead.id} className="font-medium text-slate-800" />
                                                        <CopyableText
                                                            value={formatTrackingId(lead.trackingId)}
                                                            className="text-[10px] text-crm-600 font-semibold mt-0.5"
                                                            title="Copy tracking ID"
                                                        />
                                                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{formatLeadCreatedDate(lead)}</div>
                                                    </td>
                                                    <td className="px-5 py-4 font-medium">
                                                        {lead.name}
                                                        {lead.agentName && <div className="text-[9px] text-indigo-500 font-bold mt-0.5 uppercase tracking-tighter italic">Source: {lead.agentName}</div>}
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-500">
                                                        <div className="text-[12px] font-semibold text-slate-700">{presetMatch?.name || 'Custom'}</div>
                                                        <div className="text-[11px] text-slate-400">
                                                            {hasLeadDestination(lead.destination) ? lead.destination : '—'}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 font-bold text-slate-700">{getLeadBudgetDisplay(lead)}</td>
                                                    <td className="px-5 py-4 text-right">
                                                        <span className="uppercase tracking-widest text-[10px] font-bold px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600 shadow-sm">{resolveLeadKanbanColumn(db, lead)}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredLeads.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-16 text-center text-slate-400">
                                                    <Filter size={32} className="mx-auto text-slate-200 mb-3" />
                                                    <p className="font-medium text-slate-500 text-base">No Leads Extracted</p>
                                                    <p className="text-sm mt-1">No recorded leads match the selected temporal filter.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <CancelTripModal
                target={cancelTarget}
                onClose={() => setCancelTarget(null)}
                onConfirm={handleConfirmCancel}
            />
        </div>
    );
};

const Leads = () => <AgentLeadsView />;

export default Leads;
