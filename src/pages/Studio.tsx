import React, { useState, useMemo, useEffect } from 'react';
import NumberInput from '../components/NumberInput';
import { sourceCountries } from '../utils/aviationData';
import CountryFlag from '../components/CountryFlag';
import DropdownChevron from '../components/DropdownChevron';
import CountryGroupedOptions from '../components/CountryGroupedOptions';
import { resolveWorldCountryName, sortCountriesWithTrending } from '../utils/worldLocations';
import {
    Hotel,
    Palmtree,
    Zap,
    Plus,
    Search,
    Edit2,
    Trash2,
    Save,
    X,
    Star,
    MapPin,
    IndianRupee,
    Box,
    Layers,
    Activity,
    CheckCircle2,
    Globe,
    Crown,
    Shield,
    Users,
    UserPlus,
} from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { packagePresets } from '../utils/pricing';
import { sortPlansByPriceAsc } from '../utils/agentPlan';
import {
    convertPlanInrToUsd,
    formatInrPlanPrice,
    formatUsdPlanPrice,
    getPlanPeriodLabel,
    getPlanPriceInr,
    getPlatformInrPerUsd,
    getYearlySavingsPercent,
    isFreePlan,
    useInrUsdRate,
} from '../utils/planPricing';
import { PLAN_FEATURES, getPlanFeatureLabels } from '../utils/planFeatures';

const TAB_SINGULAR: Record<string, string> = {
    hotels: 'Hotel',
    activities: 'Activity',
    presets: 'Preset',
    plans: 'Plan',
};

type StudioTab = 'hotels' | 'activities' | 'presets' | 'plans';

const PLAN_FEATURE_CATALOG: string[] = PLAN_FEATURES.map((f) => f.label);

const planIcon = (name: string) => {
    if (name === 'Lite') return <Zap className="text-blue-500" size={22} />;
    if (name === 'Growth') return <Shield className="text-crm-600" size={22} />;
    return <Crown className="text-amber-500" size={22} />;
};

const planCardAccent = (name: string) => {
    if (name === 'Lite') return 'border-blue-100 bg-blue-50/40';
    if (name === 'Growth') return 'border-crm-200 bg-crm-50/50';
    return 'border-amber-100 bg-amber-50/40';
};

const getActivityPrice = (item: any) =>
    Number(item.price ?? item.priceNum ?? 0) || 0;

const getHotelTierRates = (item: any) => {
    const fromRow = (key: 'standardRate' | 'deluxeRate' | 'luxuryRate') => {
        const n = Number(item[key]);
        return Number.isFinite(n) && n > 0 ? n : 0;
    };
    return {
        standard: fromRow('standardRate'),
        deluxe: fromRow('deluxeRate'),
        luxury: fromRow('luxuryRate'),
    };
};

const getActivityTitle = (item: any) => item.title || item.name || 'Untitled Activity';

const getActivityLocation = (item: any) => item.country || item.location || '—';

const formatStudioInr = (value: number) => `₹${value.toLocaleString('en-IN')}`;

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

const Studio = () => {
    const { db, addRecord, updateRecord, deleteRecord, getNextId } = useDatabase();
    const userRole = localStorage.getItem('userRole');
    const isAdmin = userRole === 'admin';
    const [activeTab, setActiveTab] = useState<StudioTab>(isAdmin ? 'plans' : 'hotels');
    const [searchQuery, setSearchQuery] = useState('');
    const [countryFilter, setCountryFilter] = useState('');
    const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);

    // Connect to centralized database
    const hotels = db.hotels?.data || [];
    const activities = db.activities?.data || [];
    const subscriptionPlans = db.plans?.data || [];
    const presets = useMemo(() => {
        const custom = db.customPresets?.data || [];
        const customIds = new Set(custom.map((p: any) => p.id));
        const system = packagePresets
            .filter((p) => !customIds.has(p.id))
            .map((p) => ({
                ...p,
                isSystem: true,
                description: [p.hotelDesc, p.flightDesc, p.activityDesc, p.transferDesc]
                    .filter(Boolean)
                    .join(' • '),
            }));
        return [...system, ...custom];
    }, [db.customPresets?.data]);

    const uniqueCountries = useMemo(() => {
        const countriesArr = new Set<string>();
        if (Array.isArray(hotels)) {
            hotels.forEach((h: any) => {
                const hotelLoc = h.location || h.destination || '';
                const loc = hotelLoc.split(',').pop()?.trim() || hotelLoc;
                if (loc) countriesArr.add(loc);
            });
        }
        if (Array.isArray(activities)) {
            activities.forEach((a: any) => {
                const loc = a.country?.split(',').pop()?.trim() || a.country;
                if (loc) countriesArr.add(loc);
            });
        }
        if (Array.isArray(presets)) {
            presets.forEach((p: any) => {
                const loc = p.destination?.split(',').pop()?.trim() || p.destination;
                if (loc) countriesArr.add(loc);
            });
        }
        return sortCountriesWithTrending(
            Array.from(countriesArr).map((c) => resolveWorldCountryName(c) || c)
        );
    }, [hotels, activities, presets]);

    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [planInrDraft, setPlanInrDraft] = useState('');
    const {
        rate: usdPerInr,
        fetchedAt: rateFetchedAt,
        loading: rateLoading,
        isManual: isManualRate,
    } = useInrUsdRate(getPlatformInrPerUsd(db));
    const formatLiveUsd = (amountInInr: number) =>
        usdPerInr == null
            ? rateLoading ? 'Fetching rate…' : 'Rate unavailable'
            : formatUsdPlanPrice(convertPlanInrToUsd(amountInInr, usdPerInr));
    const rateNote = !usdPerInr
        ? ''
        : isManualRate
          ? `1 USD = ₹${(1 / usdPerInr).toFixed(2)} · set in Platform Settings`
          : `1 USD = ₹${(1 / usdPerInr).toFixed(2)} · live rate, updated ${new Date(rateFetchedAt || Date.now()).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`;

    const [planYearlyInrDraft, setPlanYearlyInrDraft] = useState('');
    const planYearlySavings = getYearlySavingsPercent({
        priceInr: Number(planInrDraft) || 0,
        priceYearlyInr: Number(planYearlyInrDraft) || 0,
    });

    const [planFeaturesDraft, setPlanFeaturesDraft] = useState<string[]>([]);
    const planFeatureOptions = PLAN_FEATURE_CATALOG;

    const togglePlanFeature = (feature: string) =>
        setPlanFeaturesDraft((prev) =>
            prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
        );

    useEffect(() => {
        if (!showModal) return;
        setPlanInrDraft(editingItem ? String(getPlanPriceInr(editingItem, 'monthly')) : '');
        setPlanYearlyInrDraft(editingItem ? String(getPlanPriceInr(editingItem, 'yearly')) : '');
        // Features saved before the catalog existed are dropped; only real CRM features stay ticked
        setPlanFeaturesDraft(getPlanFeatureLabels(editingItem));
    }, [showModal, editingItem]);

    const filteredData = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const tab = isAdmin ? 'plans' : activeTab;
        let items: any[] = [];

        if (tab === 'hotels') {
            items = hotels.filter((h: any) => {
                const name = (h.name || h.title || '').toLowerCase();
                const hotelLoc = String(h.location || h.destination || '').toLowerCase();
                return name.includes(query) || hotelLoc.includes(query);
            });
        } else if (tab === 'activities') {
            items = activities.filter((a: any) => {
                const name = (a.name || a.title || '').toLowerCase();
                const loc = (a.location || a.country || '').toLowerCase();
                return name.includes(query) || loc.includes(query);
            });
        } else if (tab === 'plans') {
            items = sortPlansByPriceAsc(
                subscriptionPlans.filter((p: any) => {
                    const haystack = [p.name, p.tagline, p.price, p.period, p.features, p.id]
                        .join(' ')
                        .toLowerCase();
                    return haystack.includes(query);
                })
            );
        } else {
            items = presets.filter((p: any) => {
                const name = (p.name || p.title || '').toLowerCase();
                const dest = (p.destination || '').toLowerCase();
                return name.includes(query) || dest.includes(query);
            });
        }

        if (countryFilter && tab !== 'plans') {
            items = items.filter(item => {
                const locationRaw = String(item.location || item.destination || item.country || '').toLowerCase();
                const loc = locationRaw.split(',').pop()?.trim() || locationRaw;
                const target = countryFilter.toLowerCase();
                return loc === target || locationRaw.includes(target) || target.includes(loc);
            });
        }
        return items;
    }, [activeTab, searchQuery, countryFilter, hotels, activities, presets, subscriptionPlans, isAdmin]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const data = Object.fromEntries(formData.entries());

        if (activeTab === 'hotels') {
            const hotelObj = {
                id: editingItem?.id || getNextId('hotels', 'HTL'),
                name: data.name as string,
                location: data.destination as string,
                destination: data.destination as string,
                standardRate: Number(data.standardRate),
                deluxeRate: Number(data.deluxeRate),
                luxuryRate: Number(data.luxuryRate),
                baseRate: `${Number(data.standardRate).toLocaleString()}/night`,
                description: data.description as string,
                rating: Number(data.rating),
                stars: `${data.rating} Star`,
                status: 'Active'
            };
            if (editingItem) updateRecord('hotels', editingItem.id, hotelObj);
            else addRecord('hotels', hotelObj);
        } else if (activeTab === 'activities') {
            const activityObj = {
                id: editingItem?.id || getNextId('activities', 'ACT'),
                title: data.title as string,
                name: data.title as string, // Database.tsx often uses .name
                country: data.country as string,
                location: data.country as string,
                price: Number(data.price),
                priceNum: Number(data.price),
                category: data.category as any,
                description: data.description as string,
                duration: '4 Hours' // Defaulting duration for now
            };
            if (editingItem) updateRecord('activities', editingItem.id, activityObj);
            else addRecord('activities', activityObj);
        } else if (activeTab === 'presets') {
            const destName = data.destination as string;
            // Auto-detect and add new destination to the global library
            const exists = (db.destinations?.data || []).some((d: any) =>
                (d.name || '').toLowerCase() === destName.split(',')[0].trim().toLowerCase() ||
                (d.country || '').toLowerCase() === destName.split(',').slice(-1)[0].trim().toLowerCase()
            );

            if (!exists) {
                const parts = destName.split(',');
                const country = parts.length > 1 ? parts[parts.length - 1].trim() : destName.trim();
                const city = parts.length > 1 ? parts[0].trim() : destName.split(' ')[0].trim();

                addRecord('destinations', {
                    id: getNextId('destinations', 'DEST'),
                    name: city,
                    country: country,
                    flag: '🌐', // Default flag for auto-created destinations
                    status: 'Active'
                });
            }

            const presetObj = {
                id: editingItem?.id || getNextId('customPresets', 'PR'),
                name: data.name as string,
                destination: destName,
                duration: (data.duration as string) || '5 Nights / 6 Days',
                hotelCost: Number(data.hotelCost) || 0,
                activityCost: Number(data.activityCost) || 0,
                flightCost: Number(data.flightCost) || 0,
                transferCost: Number(data.transferCost) || 0,
                visaCost: Number(data.visaCost) || 0,
                description: data.description as string
            };
            if (editingItem && !editingItem.isSystem) {
                updateRecord('customPresets', editingItem.id, presetObj);
            } else {
                addRecord('customPresets', presetObj);
            }
        } else if (activeTab === 'plans') {
            if (planFeaturesDraft.length === 0) {
                alert('Select at least one feature for this plan.');
                return;
            }
            const priceInr = Math.max(0, Math.round(Number(data.priceInr) || 0));
            const priceYearlyInr = Math.max(0, Math.round(Number(data.priceYearlyInr) || 0));
            const planObj = {
                id: editingItem?.id || getNextId('plans', 'PLAN'),
                name: String(data.name || '').trim(),
                tagline: String(data.tagline || '').trim(),
                // `price` keeps the monthly INR display string for sorting
                price: formatInrPlanPrice(priceInr),
                priceInr,
                priceYearlyInr,
                // Paid plans renew (monthly or yearly per agent); free plans never expire
                period: priceInr === 0 && priceYearlyInr === 0 ? '/forever' : '/month',
                staffLimit: Number(data.staffLimit) || 0,
                subAgentLimit: Number(data.subAgentLimit) || 0,
                // Saved in checklist order so plan cards list features consistently
                features: planFeatureOptions.filter((f) => planFeaturesDraft.includes(f)).join(','),
            };
            if (editingItem) updateRecord('plans', editingItem.id, planObj);
            else addRecord('plans', planObj);
        }

        setShowModal(false);
        setEditingItem(null);
    };

    const deleteItem = (item: any) => {
        if (item.isSystem) {
            alert('Built-in master presets cannot be deleted. Duplicate it as a custom preset to customize.');
            return;
        }
        if (activeTab === 'plans') {
            const agentsOnPlan = (db.travelAgents?.data || []).filter(
                (a: any) => a.plan === item.name
            ).length;
            const message =
                agentsOnPlan > 0
                    ? `${agentsOnPlan} agent(s) are on "${item.name}". Delete this plan anyway?`
                    : 'Delete this subscription plan?';
            if (window.confirm(message)) deleteRecord('plans', item.id);
            return;
        }
        const table = activeTab === 'hotels' ? 'hotels' : activeTab === 'activities' ? 'activities' : 'customPresets';
        if (window.confirm('Are you sure you want to delete this catalog component?')) {
            deleteRecord(table, item.id);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        {isAdmin ? (
                            <Crown className="text-crm-600 shrink-0" />
                        ) : (
                            <Box className="text-crm-600 shrink-0" />
                        )}{' '}
                        {isAdmin ? 'Subscription Plans' : 'Package Studio'}
                    </h1>
                    <p className="text-slate-500 font-medium">
                        {isAdmin
                            ? 'Create and manage platform subscription plans for travel agencies.'
                            : 'Customize master pricing and component libraries.'}
                    </p>
                </div>
                {!isAdmin && (
                <div className="flex flex-nowrap items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner w-full max-w-full overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('hotels')}
                        className={`flex items-center gap-2 px-4 lg:px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'hotels' ? 'bg-white text-crm-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Palmtree size={18} className="shrink-0" /> Hotels
                    </button>
                    <button
                        onClick={() => setActiveTab('activities')}
                        className={`flex items-center gap-2 px-4 lg:px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'activities' ? 'bg-white text-crm-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Zap size={18} className="shrink-0" /> Activities
                    </button>
                    <button
                        onClick={() => setActiveTab('presets')}
                        className={`flex items-center gap-2 px-4 lg:px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === 'presets' ? 'bg-white text-crm-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <Layers size={18} className="shrink-0" /> Presets
                    </button>
                </div>
                )}
            </div>

            <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col">
                <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
                    {(isAdmin || activeTab === 'plans') ? (
                        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                            <div className="relative w-full group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-crm-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder={isAdmin ? 'Search plans...' : `Search ${activeTab}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:border-crm-500 outline-none transition-all"
                                />
                            </div>
                            <p className="text-xs font-bold text-slate-500 sm:max-w-md shrink-0">
                                Changes apply to the Plans page and agent billing across the platform.
                            </p>
                            <button
                                onClick={() => { setEditingItem(null); setShowModal(true); }}
                                className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transform active:scale-95 transition-all shadow-lg shadow-slate-900/20 whitespace-nowrap shrink-0"
                            >
                                <Plus size={18} className="shrink-0" /> Add New Plan
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-nowrap items-center gap-3 w-full">
                                <div className="relative shrink-0 min-w-0">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsRegionDropdownOpen(!isRegionDropdownOpen); }}
                                        className="flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-crm-400 hover:shadow-md transition-all focus:ring-2 focus:ring-crm-500/20 outline-none group whitespace-nowrap"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <CountryFlag
                                                country={countryFilter || null}
                                                size={24}
                                                global={!countryFilter}
                                            />
                                            <div className="text-left min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1 whitespace-nowrap">Catalog Focus</p>
                                                <p className="text-sm font-black text-slate-800 uppercase tracking-tight whitespace-nowrap truncate max-w-[140px] sm:max-w-none">
                                                    {countryFilter || 'Global Inventory'}
                                                </p>
                                            </div>
                                        </div>
                                        <DropdownChevron open={isRegionDropdownOpen} className="text-slate-400 shrink-0" size={16} />
                                    </button>

                                    {isRegionDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-[2500] bg-slate-900/5 backdrop-blur-[1px]" onClick={() => setIsRegionDropdownOpen(false)}></div>
                                            <div className="absolute top-full left-0 mt-2 w-full min-w-[240px] bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[2600] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                                                    <button
                                                        onClick={() => { setCountryFilter(''); setIsRegionDropdownOpen(false); }}
                                                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${!countryFilter ? 'bg-crm-50 text-crm-700' : 'hover:bg-slate-50 text-slate-500'}`}
                                                    >
                                                        <CountryFlag global size={24} />
                                                        <div className="text-left">
                                                            <p className="text-xs font-black uppercase tracking-tight">Global Catalog</p>
                                                            <p className="text-[10px] opacity-70">Master inventory view</p>
                                                        </div>
                                                    </button>
                                                    <CountryGroupedOptions
                                                        options={uniqueCountries || []}
                                                        selected={countryFilter}
                                                        onSelect={(c) => {
                                                            setCountryFilter(c);
                                                            setIsRegionDropdownOpen(false);
                                                        }}
                                                        emptyMessage="No catalog countries yet"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setEditingItem(null); setShowModal(true); }}
                                    className="ml-auto px-4 sm:px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transform active:scale-95 transition-all shadow-lg shadow-slate-900/20 whitespace-nowrap shrink-0"
                                >
                                    <Plus size={18} className="shrink-0" /> Add New {TAB_SINGULAR[activeTab]}
                                </button>
                            </div>
                            <div className="relative w-full group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-crm-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder={`Search ${activeTab}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:border-crm-500 outline-none transition-all"
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredData.length === 0 && (
                            <div className="col-span-full py-16 text-center text-slate-400">
                                <p className="font-bold text-slate-600">
                                    {isAdmin
                                        ? 'No subscription plans match your search.'
                                        : `No ${activeTab} match your search or region filter.`}
                                </p>
                                <p className="text-sm mt-2">
                                    {isAdmin
                                        ? 'Add a new plan to get started.'
                                        : `Try clearing filters or add a new ${TAB_SINGULAR[activeTab].toLowerCase()}.`}
                                </p>
                            </div>
                        )}
                        {filteredData.map((item: any) => (
                            <div key={item.id} className="group relative bg-white border border-slate-200 rounded-2xl p-4 md:p-5 hover:shadow-xl hover:shadow-crm-500/10 hover:border-crm-200 transition-all duration-300 min-w-0">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={() => { setEditingItem(item); setShowModal(true); }} className="p-2 bg-white text-slate-500 hover:text-crm-600 rounded-xl border border-slate-100 shadow-md transform hover:scale-110 transition-all">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => deleteItem(item)} className="p-2 bg-white text-slate-500 hover:text-red-600 rounded-xl border border-slate-100 shadow-md transform hover:scale-110 transition-all">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {activeTab === 'hotels' && !isAdmin && (
                                    <>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-1 text-amber-500">
                                                {Array.from({ length: Math.min(Math.max(Number(item.rating || 5), 1), 5) }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.id}</span>
                                        </div>
                                        <h3 className="text-base md:text-lg font-black text-slate-800 mb-1 truncate">{item.name}</h3>
                                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-3 min-w-0">
                                            {/* Flag for destination */}
                                            {(() => {
                                                const destStr = item.location || item.destination || '';
                                                const loc = destStr.split(',').pop()?.trim() || destStr;
                                                const flag = FLAGS[loc] || DESTINATIONS.find(d => d.country === loc)?.flag || '📍';
                                                return <span className="text-base mr-0.5 shrink-0">{flag}</span>;
                                            })()}
                                            <MapPin size={12} className="shrink-0" />
                                            <span className="truncate">{item.location || item.destination}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1.5 min-w-0">
                                            {(() => {
                                                const rates = getHotelTierRates(item);
                                                return (
                                                    <>
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center min-w-0">
                                                <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 leading-none">Std</p>
                                                <p className="text-[10px] md:text-xs font-bold text-slate-800 tabular-nums truncate" title={formatStudioInr(rates.standard)}>{formatStudioInr(rates.standard)}</p>
                                            </div>
                                            <div className="bg-crm-50 p-2 rounded-lg border border-crm-100 text-center min-w-0">
                                                <p className="text-[8px] font-bold text-crm-500 uppercase mb-0.5 leading-none">Del</p>
                                                <p className="text-[10px] md:text-xs font-bold text-crm-700 tabular-nums truncate" title={formatStudioInr(rates.deluxe)}>{formatStudioInr(rates.deluxe)}</p>
                                            </div>
                                            <div className="bg-slate-900 p-2 rounded-lg text-center min-w-0">
                                                <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 leading-none">Lux</p>
                                                <p className="text-[10px] md:text-xs font-bold text-white tabular-nums truncate" title={formatStudioInr(rates.luxury)}>{formatStudioInr(rates.luxury)}</p>
                                            </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </>
                                )}

                                {activeTab === 'activities' && !isAdmin && (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${item.category === 'Adventure' ? 'bg-orange-100 text-orange-600' :
                                                item.category === 'Culture' ? 'bg-purple-100 text-purple-600' :
                                                    item.category === 'Dining' ? 'bg-pink-100 text-pink-600' :
                                                        item.category === 'Nature' ? 'bg-green-100 text-green-700' :
                                                            item.category === 'Leisure' ? 'bg-sky-100 text-sky-700' :
                                                                'bg-blue-100 text-blue-600'
                                                }`}>
                                                {item.category || 'Experience'}
                                            </span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.id}</span>
                                        </div>
                                        <h3 className="text-base md:text-lg font-black text-slate-800 mb-1 truncate">{getActivityTitle(item)}</h3>
                                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-2 min-w-0">
                                            <MapPin size={14} className="shrink-0" />
                                            <span className="line-clamp-1">{getActivityLocation(item)}</span>
                                        </div>
                                        {item.description && (
                                            <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">{item.description}</p>
                                        )}
                                        <div className="flex items-center justify-between gap-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 min-w-0">
                                            <span className="text-[10px] font-bold text-emerald-700 shrink-0">Base / Person</span>
                                            <span className="text-xs md:text-sm font-bold text-emerald-800 tabular-nums truncate" title={formatStudioInr(getActivityPrice(item))}>
                                                {formatStudioInr(getActivityPrice(item))}
                                            </span>
                                        </div>
                                    </>
                                )}

                                {(activeTab === 'plans' || isAdmin) && (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className={`p-3 rounded-2xl border ${planCardAccent(item.name)}`}>
                                                {planIcon(item.name)}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {item.id}
                                            </span>
                                        </div>
                                        <h3 className="text-lg md:text-xl font-black text-slate-800 mb-1 truncate">{item.name}</h3>
                                        <p className="text-xs text-slate-500 font-medium mb-3 line-clamp-2">{item.tagline}</p>
                                        <div className="space-y-1 mb-3" title={rateNote}>
                                            {(isFreePlan(item) ? (['monthly'] as const) : (['monthly', 'yearly'] as const)).map((cycle) => (
                                                <div key={cycle} className="flex items-baseline gap-1.5 min-w-0">
                                                    <span className="text-lg md:text-xl font-black text-slate-900 truncate">
                                                        {formatInrPlanPrice(getPlanPriceInr(item, cycle))}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-400 shrink-0">{getPlanPeriodLabel(item, cycle)}</span>
                                                    <span className="text-xs font-bold text-slate-500 truncate">
                                                        · {formatLiveUsd(getPlanPriceInr(item, cycle))}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                                                <Users size={12} className="mx-auto text-slate-400 mb-0.5" />
                                                <p className="text-[8px] font-bold text-slate-400 uppercase">Staff</p>
                                                <p className="text-xs font-bold text-slate-800">
                                                    {Number(item.staffLimit) >= 9999 ? '∞' : item.staffLimit}
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                                                <UserPlus size={12} className="mx-auto text-slate-400 mb-0.5" />
                                                <p className="text-[8px] font-bold text-slate-400 uppercase">Sub-Agents</p>
                                                <p className="text-xs font-bold text-slate-800">∞</p>
                                            </div>
                                        </div>
                                        <div className="border-t border-slate-100 pt-3">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                {getPlanFeatureLabels(item).length} of {PLAN_FEATURE_CATALOG.length} features
                                            </p>
                                            <ul className="space-y-1.5">
                                                {getPlanFeatureLabels(item).map((feature) => (
                                                    <li
                                                        key={feature}
                                                        className="text-[11px] text-slate-600 font-medium flex items-start gap-2"
                                                    >
                                                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                                                        <span className="line-clamp-1">{feature}</span>
                                                    </li>
                                                ))}
                                                {getPlanFeatureLabels(item).length === 0 && (
                                                    <li className="text-[11px] font-bold text-amber-600">
                                                        No features selected yet — edit this plan to choose them.
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'presets' && !isAdmin && (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.duration}</span>
                                                {item.isSystem && (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-500">Master</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.id}</span>
                                        </div>
                                        <h3 className="text-base md:text-lg font-black text-slate-800 mb-1 truncate">{item.name}</h3>
                                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-3 min-w-0">
                                            <MapPin size={12} className="shrink-0" /> <span className="truncate">{item.destination}</span>
                                        </div>
                                        <div className="space-y-0.5 mb-3 min-w-0">
                                            <div className="flex justify-between gap-2 text-[10px] py-0.5 border-b border-slate-50 min-w-0">
                                                <span className="text-slate-500 font-medium shrink-0">Hotels</span>
                                                <span className="font-bold text-slate-800 tabular-nums truncate text-right">{formatStudioInr(Number(item.hotelCost || 0))}</span>
                                            </div>
                                            <div className="flex justify-between gap-2 text-[10px] py-0.5 border-b border-slate-50 min-w-0">
                                                <span className="text-slate-500 font-medium shrink-0">Flights</span>
                                                <span className="font-bold text-slate-800 tabular-nums truncate text-right">{formatStudioInr(Number(item.flightCost || 0))}</span>
                                            </div>
                                            <div className="flex justify-between gap-2 text-[10px] py-0.5 border-b border-slate-50 min-w-0">
                                                <span className="text-slate-500 font-medium shrink-0">Activities</span>
                                                <span className="font-bold text-slate-800 tabular-nums truncate text-right">{formatStudioInr(Number(item.activityCost || 0))}</span>
                                            </div>
                                            <div className="flex justify-between gap-2 text-[10px] py-0.5 border-b border-slate-50 min-w-0">
                                                <span className="text-slate-500 font-medium shrink-0">Transfers</span>
                                                <span className="font-bold text-slate-800 tabular-nums truncate text-right">{formatStudioInr(Number(item.transferCost || 0))}</span>
                                            </div>
                                            <div className="flex justify-between gap-2 text-[10px] py-0.5 border-b border-slate-50 min-w-0">
                                                <span className="text-slate-500 font-medium shrink-0">Visa / Person</span>
                                                <span className="font-bold text-slate-800 tabular-nums truncate text-right">{formatStudioInr(Number(item.visaCost || 0))}</span>
                                            </div>
                                            <div className="flex justify-between gap-2 text-[11px] pt-1.5 min-w-0">
                                                <span className="text-slate-800 font-black uppercase tracking-tighter shrink-0">Total Base</span>
                                                <span className="font-bold text-crm-600 tabular-nums truncate text-right">
                                                    {formatStudioInr(
                                                        Number(item.hotelCost || 0) +
                                                        Number(item.flightCost || 0) +
                                                        Number(item.activityCost || 0) +
                                                        Number(item.transferCost || 0) +
                                                        Number(item.visaCost || 0)
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                        {item.description && (
                                            <p className="text-[11px] text-slate-400 italic line-clamp-2 mt-2 border-t border-slate-50 pt-2">
                                                {item.description}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Editor Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-300">
                    <div className={`bg-white rounded-[2rem] shadow-2xl w-full ${(activeTab === 'plans' || isAdmin) ? 'max-w-3xl' : 'max-w-xl'} overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-slate-200`}>
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                {editingItem ? <Edit2 className="text-crm-500" /> : <Plus className="text-crm-500" />}
                                {editingItem ? `Edit ${isAdmin ? 'Plan' : TAB_SINGULAR[activeTab]}` : `Add New ${isAdmin ? 'Plan' : TAB_SINGULAR[activeTab]}`}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-8 overflow-y-auto flex-1">
                            <div className="space-y-6">
                                {activeTab === 'hotels' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hotel Name</label>
                                                <input name="name" defaultValue={editingItem?.name} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" placeholder="e.g. Ritz Carlton" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destination</label>
                                                <div className="relative">
                                                    <input
                                                        name="destination"
                                                        defaultValue={editingItem?.location || editingItem?.destination}
                                                        required
                                                        className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none transition-all"
                                                        placeholder="e.g. Dubai, UAE"
                                                    />
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                                        {(() => {
                                                            const destStr = editingItem?.location || editingItem?.destination || '';
                                                            const loc = destStr.split(',').pop()?.trim() || destStr;
                                                            const flag = FLAGS[loc] || DESTINATIONS.find(d => d.country === loc)?.flag || '';
                                                            return flag ? <span className="text-xl">{flag}</span> : null;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Std Rate</label>
                                                <div className="relative">
                                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                    <NumberInput name="standardRate" defaultValue={editingItem?.standardRate} required className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deluxe Rate</label>
                                                <div className="relative">
                                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                    <NumberInput name="deluxeRate" defaultValue={editingItem?.deluxeRate} required className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Luxury Rate</label>
                                                <div className="relative">
                                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                    <NumberInput name="luxuryRate" defaultValue={editingItem?.luxuryRate} required className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rating (1-5)</label>
                                            <NumberInput name="rating" min="1" max="5" defaultValue={editingItem?.rating || 5} required className="w-64 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" />
                                        </div>
                                    </>
                                )}

                                {activeTab === 'activities' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Activity Title</label>
                                            <input name="title" defaultValue={editingItem?.title || editingItem?.name} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" placeholder="e.g. Scuba Diving" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
                                                <input name="country" defaultValue={editingItem?.country || editingItem?.location} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" placeholder="e.g. Thailand" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Base Price / Person</label>
                                                <NumberInput name="price" defaultValue={getActivityPrice(editingItem || {})} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                                            <div className="relative crm-select-wrap">
                                            <select name="category" defaultValue={editingItem?.category || 'Nature'} className="w-full px-4 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none appearance-none cursor-pointer">
                                                <option>Nature</option>
                                                <option>Adventure</option>
                                                <option>Culture</option>
                                                <option>Leisure</option>
                                                <option>Dining</option>
                                                <option>Modern</option>
                                            </select>
                                            <DropdownChevron size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    </>
                                )}
                                {(activeTab === 'plans' || isAdmin) && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                Plan Name
                                            </label>
                                            <input
                                                name="name"
                                                defaultValue={editingItem?.name}
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none"
                                                placeholder="e.g. Growth"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                Tagline
                                            </label>
                                            <input
                                                name="tagline"
                                                defaultValue={editingItem?.tagline}
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none"
                                                placeholder="Short description for agents"
                                            />
                                        </div>
                                        {([
                                            { cycle: 'monthly', label: 'Monthly', name: 'priceInr', value: planInrDraft, setValue: setPlanInrDraft, placeholder: '1999' },
                                            { cycle: 'yearly', label: 'Yearly', name: 'priceYearlyInr', value: planYearlyInrDraft, setValue: setPlanYearlyInrDraft, placeholder: '19999' },
                                        ] as const).map((row) => (
                                            <div key={row.cycle} className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                        {row.label} Price (INR ₹) — India
                                                    </label>
                                                    <input
                                                        name={row.name}
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        value={row.value}
                                                        onChange={(e) => row.setValue(e.target.value)}
                                                        required
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none"
                                                        placeholder={row.placeholder}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                        {row.label} Price (USD $) — Outside India
                                                    </label>
                                                    <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600">
                                                        {formatLiveUsd(Number(row.value) || 0)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <p className="text-[10px] text-slate-400 font-medium ml-1 -mt-2">
                                            USD is converted at the {isManualRate ? 'rate set in Platform Settings' : 'live rate'} and rounded to the nearest dollar. Set both prices to 0 for a free plan.
                                            {rateNote && <><br />{rateNote}</>}
                                            {planYearlySavings > 0 && (
                                                <><br /><span className="text-emerald-600 font-bold">Yearly saves {planYearlySavings}% vs. paying monthly</span></>
                                            )}
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                    Staff Limit
                                                </label>
                                                <NumberInput
                                                    name="staffLimit"
                                                    min={0}
                                                    defaultValue={editingItem?.staffLimit ?? 5}
                                                    required
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none"
                                                />
                                                <p className="text-[10px] text-slate-400 font-medium">Use 9999 for unlimited</p>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                    Sub-Agent Limit
                                                </label>
                                                <NumberInput
                                                    name="subAgentLimit"
                                                    min={0}
                                                    defaultValue={editingItem?.subAgentLimit ?? 2}
                                                    required
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2 ml-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    Features Included
                                                </label>
                                                <span className="text-[10px] font-black text-crm-600 uppercase tracking-widest">
                                                    {planFeaturesDraft.length} of {planFeatureOptions.length} selected
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                                                {planFeatureOptions.map((feature) => {
                                                    const checked = planFeaturesDraft.includes(feature);
                                                    return (
                                                        <label
                                                            key={feature}
                                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${checked ? 'bg-white border-crm-200 shadow-sm' : 'border-transparent hover:bg-white/70'}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => togglePlanFeature(feature)}
                                                                className="w-4 h-4 accent-crm-600 shrink-0 cursor-pointer"
                                                            />
                                                            <span className={`text-sm font-bold ${checked ? 'text-slate-800' : 'text-slate-500'}`}>
                                                                {feature}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'presets' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preset Name</label>
                                                <input name="name" defaultValue={editingItem?.name} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" placeholder="e.g. Bali Luxury Escape" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destination</label>
                                                <input name="destination" defaultValue={editingItem?.destination} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" placeholder="e.g. Bali, Indonesia" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hotel Cost (Base)</label>
                                                <div className="relative">
                                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                    <NumberInput name="hotelCost" defaultValue={editingItem?.hotelCost || 0} required className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Flight Cost</label>
                                                <div className="relative">
                                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                    <NumberInput name="flightCost" defaultValue={editingItem?.flightCost || 0} required className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Activity Cost</label>
                                                <div className="relative">
                                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                    <NumberInput name="activityCost" defaultValue={editingItem?.activityCost || 0} required className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transfer Cost</label>
                                                <div className="relative">
                                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                    <NumberInput name="transferCost" defaultValue={editingItem?.transferCost || 0} required className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Visa Cost / Person</label>
                                                <div className="relative">
                                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                    <NumberInput name="visaCost" defaultValue={editingItem?.visaCost || 0} required className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duration (e.g. 5 Nights / 6 Days)</label>
                                                <input name="duration" defaultValue={editingItem?.duration || '5 Nights / 6 Days'} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none" placeholder="e.g. 5 Nights / 6 Days" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeTab !== 'plans' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Short Description</label>
                                        <textarea name="description" defaultValue={editingItem?.description} rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-crm-500 outline-none resize-none" placeholder="Tell more about this..." />
                                    </div>
                                )}
                            </div>

                            <button type="submit" className="w-full mt-8 py-4 bg-crm-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-crm-700 transform active:scale-95 transition-all shadow-xl shadow-crm-600/30 uppercase tracking-tighter">
                                <CheckCircle2 size={20} /> {(activeTab === 'plans' || isAdmin) ? 'Save Plan' : 'Save Component'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Studio;