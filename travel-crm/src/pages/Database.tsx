import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, X, CheckCircle2 } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { useNavigate } from 'react-router-dom';
import DropdownChevron from '../components/DropdownChevron';
import {
    getUnifiedBudgetForBooking,
    getUnifiedBudgetForLead,
    getUnifiedBudgetForQuote,
    PAYMENT_STATUS_OPTIONS,
    getPaymentStatusColorClasses,
} from '../utils/pricingConsistency';
import {
    filterStaffForAgentSession,
    filterSubAgentsForAgentSession,
    getAgentIdsForScope,
    recordBelongsToAgent,
    resolveMainAgencyAgentId,
} from '../utils/databaseSync';

const DatabasePage = () => {
    const { db, addRecord, updateRecord, deleteRecord, getNextId } = useDatabase();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<string>('customers');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCountry, setSelectedCountry] = useState<string>('');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    // Auth context
    const userRole = localStorage.getItem('userRole');
    const currentAgentId = localStorage.getItem('agentId');

    // Column label → stored data key (where label ≠ auto camelCase)
    const KEY_OVERRIDES: Record<string, string> = {
        'ID': 'id',
        'Business': 'businessName',
        'Mobile': 'phone',
        'Agent': 'agentName',
        'GST': 'gstDetails',
        'Holder Name': 'holderName',
        'Branch Name': 'branchName',
        'IFSC Code': 'ifscCode',
        'Account Number': 'accountNumber',
        'Bank Name': 'bankName',
        'Star Rating': 'stars',
        'Base Rate': 'baseRate',
        'Travel Dates': 'dates',
        'Total Amount': 'total',
        'Payment Status': 'paymentStatus',
        'Location': 'location',
        'Stars': 'stars',
        'Price': 'price',
        'Name': 'name',
        'Country': 'country',
        'Duration': 'duration'
    };
    const colToKey = (col: string) =>
        KEY_OVERRIDES[col] ?? (col === 'ID' ? 'id' : col.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_m, chr) => chr.toUpperCase()));

    const currentTable = db[activeTab] || { name: activeTab, columns: [], data: [] };
    const leadsData = db?.leads?.data || [];

    const uniqueCountries = useMemo(() => {
        if (!currentTable || !currentTable.data) return [];
        const countries = new Set<string>();
        currentTable.data.forEach((row: any) => {
            const loc = row.location || row.country || row.destination;
            if (loc) {
                // Try to extract country if it's "City, Country"
                const parts = String(loc).split(',');
                const country = parts.length > 1 ? parts[parts.length - 1].trim() : String(loc).trim();
                countries.add(country);
            }
        });
        return Array.from(countries).sort();
    }, [currentTable]);

    const filteredData = useMemo(() => {
        if (!currentTable || !currentTable.data) return [];
        let data = currentTable.data;

        // Role-based filter (aligned with Bookings/Leads pages — include records linked via lead)
        if (userRole !== 'admin' && currentAgentId) {
            if (['leads', 'quotations', 'bookings'].includes(activeTab)) {
                data = (data || []).filter((row: any) =>
                    recordBelongsToAgent(activeTab, row, db, currentAgentId)
                );
            } else if (activeTab === 'customers') {
                const teamIds = getAgentIdsForScope(db, currentAgentId);
                const agentLeads = (db.leads?.data || []).filter((l: any) => teamIds.includes(l.agentId));
                const agentBookings = (db.bookings?.data || []).filter((b: any) =>
                    recordBelongsToAgent('bookings', b, db, currentAgentId)
                );
                const agentCustomerNames = new Set([
                    ...agentLeads.map((l: any) => l.name),
                    ...agentBookings.map((b: any) => b.customer)
                ]);
                data = (data || []).filter((row: any) => agentCustomerNames.has(row.name));
            } else if (activeTab === 'staff') {
                data = filterStaffForAgentSession(data || [], currentAgentId, db);
            } else if (activeTab === 'travelAgents') {
                data = filterSubAgentsForAgentSession(data || [], currentAgentId, db);
            }
        }


        // Apply Country Filter
        if (selectedCountry) {
            data = data.filter((row: any) => {
                const loc = row.location || row.country || row.destination;
                if (!loc) return false;

                // Extract country part
                const parts = String(loc).split(',');
                const country = parts.length > 1 ? parts[parts.length - 1].trim() : String(loc).trim();

                return country.toLowerCase() === selectedCountry.toLowerCase();
            });
        }

        // Apply Search Query
        if (searchQuery) {
            data = data.filter((row: any) =>
                Object.values(row).some((val: any) =>
                    String(val).toLowerCase().includes(searchQuery.toLowerCase())
                )
            );
        }
        return data;
    }, [currentTable, searchQuery, selectedCountry, activeTab, db, userRole, currentAgentId]);

    const renderValue = (val: any) => {
        if (val === null || val === undefined) return '-';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const getBookingsFallbackValue = (row: any, keyName: string) => {
        if (activeTab !== 'bookings') return row[keyName];

        const directValue = row[keyName];
        if (directValue !== undefined && directValue !== null && String(directValue).trim() !== '') {
            return directValue;
        }

        const linkedLead = leadsData.find(
            (lead: any) => lead.name === row.customer || lead.bookingId === row.id
        );
        if (!linkedLead) return directValue;

        if (keyName === 'email') return linkedLead.email;
        if (keyName === 'phone') return linkedLead.phone;
        return directValue;
    };

    const getUnifiedValue = (row: any, keyName: string) => {
        if (activeTab === 'leads' && keyName === 'budget') return getUnifiedBudgetForLead(row, db);
        if (activeTab === 'quotations' && keyName === 'total') return getUnifiedBudgetForQuote(row, db);
        if (activeTab === 'bookings' && keyName === 'total') return getUnifiedBudgetForBooking(row, db);
        if (activeTab === 'customPresets' && keyName === 'totalBase') {
            const totalBase =
                Number(row.hotelCost || 0) +
                Number(row.flightCost || 0) +
                Number(row.activityCost || 0) +
                Number(row.transferCost || 0) +
                Number(row.visaCost || 0);
            return `₹ ${totalBase.toLocaleString('en-IN')}`;
        }
        return null;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const openAddModal = () => {
        setFormData({});
        setIsEditing(false);
        setShowModal(true);
    };

    const openEditModal = (row: any) => {
        // For Travel Agents, redirect to the rich dedicated form
        if (activeTab === 'travelAgents') {
            navigate(`/my-team?editId=${row.id}`);
            return;
        }
        setFormData(row);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleSaveItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditing) {
            updateRecord(activeTab, formData.id, formData);
        } else {
            const prefix = activeTab === 'travelAgents' ? 'AGT' :
                activeTab === 'leads' ? 'LD' :
                    activeTab === 'bookings' ? 'BK' :
                        activeTab === 'customers' ? 'CUST' :
                            activeTab.substring(0, 3).toUpperCase();
            const nextId = getNextId(activeTab, prefix);
            const agencyId =
                userRole !== 'admin' && currentAgentId
                    ? resolveMainAgencyAgentId(currentAgentId, db)
                    : formData.agentId;
            const newItem = {
                id: nextId,
                ...formData,
                agentId:
                    userRole !== 'admin' && ['leads', 'quotations', 'bookings', 'staff'].includes(activeTab)
                        ? activeTab === 'staff'
                            ? agencyId
                            : currentAgentId
                        : formData.agentId,
                parentId:
                    userRole === 'agent' && activeTab === 'travelAgents'
                        ? agencyId || currentAgentId
                        : formData.parentId,
                // Add default password for travel agents if not present
                ...(activeTab === 'travelAgents' ? { password: formData.password || 'password123' } : {})
            };
            addRecord(activeTab, newItem);
        }
        setFormData({});
        setShowModal(false);
    };

    const getInputType = (colName: string): string => {
        const lower = colName.toLowerCase();
        // Use text for 'Dates' (range), date for single 'Date'
        if (lower === 'date' || lower.includes('departure') || lower.includes('due')) return 'date';
        if (lower.includes('email')) return 'email';
        return 'text';
    };

    const getStatusOptions = (colName: string) => {
        const lower = colName.toLowerCase();
        if (!lower.includes('status')) return null;

        if (lower.includes('payment')) {
            return PAYMENT_STATUS_OPTIONS.map((o) => o.value);
        }

        switch (activeTab) {
            case 'leads': return ['new', 'contacted', 'itinerary', 'negotiation', 'confirmed', 'lost'];
            case 'quotations': return ['draft', 'sent', 'confirmed', 'expired'];
            case 'bookings': return ['pending', 'confirmed', 'completed', 'cancelled'];
            case 'travelAgents': return ['Active', 'Inactive', 'Blocked'];
            default: return ['Active', 'Inactive', 'Pending'];
        }
    };

    const shouldShowColumn = (colName: string) => {
        if (activeTab === 'activities' && colName.toLowerCase() === 'duration') return false;
        if (activeTab === 'hotels' && ['email', 'phone'].includes(colName.toLowerCase())) return false;
        return true;
    };

    const getRowSummary = (row: any) => {
        const status = row.status || row.paymentStatus || '';
        switch (activeTab) {
            case 'leads': return { title: row.name, sub: row.destination, tag: status, extra: `${row.dates}${row.agentName ? ` • ${row.agentName}` : ''}` };
            case 'quotations': return { title: row.customer, sub: row.destination, tag: status, extra: row.date };
            case 'bookings': return { title: row.customer, sub: row.package, tag: status, extra: row.dates };
            case 'travelAgents': return { title: row.name, sub: row.businessName, tag: row.phone, extra: '' };
            case 'customers': return { title: row.name, sub: row.email, tag: (row.bookings || '0') + ' Bookings', extra: '' };
            case 'destinations': return { title: row.name || row.Name, sub: row.country || row.Country, tag: status, extra: '' };
            case 'hotels': return { title: row.name || row.title || row.Name, sub: row.location || row.destination || row.Location, tag: row.stars || row.Stars || row.rating, extra: row.baseRate || row.BaseRate || row.standardRate };
            case 'activities': return { title: row.name || row.title || row.Name, sub: row.location || row.country || row.Location, tag: row.duration || row.Duration, extra: row.price || row.Price || row.priceNum };
            case 'customPresets': return { title: row.name || row.Name, sub: row.destination || row.Destination, tag: row.duration || row.Duration, extra: row.id };
            default: return { title: row.name || row.title || row.Name || row.id, sub: row.destination || row.location || row.country || '', tag: status || '', extra: '' };
        }
    };

    const getStatusColor = (status: string) => {
        const s = (status || '').toLowerCase();
        if (['active', 'confirmed', 'paid', 'completed'].includes(s)) return 'bg-green-100 text-green-700 border-green-200';
        if (['new', 'pending', 'sent', 'itinerary', 'partial'].includes(s)) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (['inactive', 'negotiation', 'unpaid', 'draft'].includes(s)) return 'bg-amber-100 text-amber-700 border-amber-200';
        if (['refunded'].includes(s)) return 'bg-sky-100 text-sky-700 border-sky-200';
        if (['blocked', 'lost', 'cancelled', 'expired'].includes(s)) return 'bg-red-100 text-red-700 border-red-200';
        return 'bg-slate-100 text-slate-600 border-slate-200';
    };

    // Reset search when changing tabs
    React.useEffect(() => {
        setSearchQuery('');
        setSelectedCountry('');
        setExpandedRow(null);
    }, [activeTab]);

    return (
        <div className="h-full flex flex-col gap-6 overflow-hidden">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Database Management</h1>
                    <p className="text-slate-500 mt-1">Manage core system data tables and records.</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={18} />
                    Add New {activeTab === 'travelAgents' && userRole === 'agent' ? 'Sub-Agent' : currentTable.name.slice(0, currentTable.name.endsWith('s') ? -1 : undefined)}
                </button>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-0">
                {/* Sidebar Tabs - Horizontal on mobile, Vertical on MD+ */}
                <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50 p-3 md:p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0 scrollbar-hide">
                    <p className="hidden md:block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">Data Tables</p>
                    {Object.keys(db).filter(key => {
                        if (key === 'settings' || key === 'customPresets') return false;
                        if (key === 'plans' && userRole !== 'admin') return false;
                        if (key === 'travelAgents' && userRole !== 'admin' && userRole !== 'agent') return false;
                        return db[key] && db[key].columns && db[key].data;
                    }).map((key) => {
                        let tabCount = db[key].data.length;
                        if (userRole !== 'admin' && currentAgentId) {
                            if (['leads', 'quotations', 'bookings'].includes(key)) {
                                tabCount = (db[key].data || []).filter((row: any) =>
                                    recordBelongsToAgent(key, row, db, currentAgentId)
                                ).length;
                            } else if (key === 'customers') {
                                const teamIds = getAgentIdsForScope(db, currentAgentId);
                                const agentLeads = (db.leads?.data || []).filter((l: any) => teamIds.includes(l.agentId));
                                const agentBookings = (db.bookings?.data || []).filter((b: any) =>
                                    recordBelongsToAgent('bookings', b, db, currentAgentId)
                                );
                                const agentCustomerNames = new Set([
                                    ...agentLeads.map((l: any) => l.name),
                                    ...agentBookings.map((b: any) => b.customer)
                                ]);
                                tabCount = (db[key].data || []).filter((row: any) => agentCustomerNames.has(row.name)).length;
                            } else if (key === 'staff') {
                                tabCount = filterStaffForAgentSession(db[key].data || [], currentAgentId, db).length;
                            } else if (key === 'travelAgents') {
                                tabCount = filterSubAgentsForAgentSession(db[key].data || [], currentAgentId, db).length;
                            }
                        }
                        
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`whitespace-nowrap md:w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === key
                                    ? 'bg-crm-600 text-white shadow-md scale-[1.02]'
                                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 border border-transparent'
                                    }`}
                            >
                                <span className="flex items-center justify-between gap-3">
                                    {key === 'travelAgents' && userRole === 'agent' ? 'Sub-Agents' : db[key].name}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === key ? 'bg-crm-700/50 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                        {tabCount}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Data Grid */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
                        <h2 className="font-semibold text-slate-800 text-lg">
                            {activeTab === 'travelAgents' && userRole === 'agent' ? 'Sub-Agents' : currentTable.name} Records
                        </h2>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={`Search ${currentTable.name}...`}
                                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-crm-500 focus:ring-1 focus:ring-crm-500 w-48 md:w-64"
                                />
                            </div>

                            {uniqueCountries.length > 0 && (
                                <div className="relative crm-select-wrap">
                                <select
                                    value={selectedCountry}
                                    onChange={(e) => setSelectedCountry(e.target.value)}
                                    className="px-3 py-2 pr-9 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-crm-500 focus:ring-1 focus:ring-crm-500 bg-slate-50 text-slate-700 font-medium cursor-pointer appearance-none"
                                >
                                    <option value="">All Regions</option>
                                    {uniqueCountries.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <DropdownChevron size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Data Grid — accordion for Travel Agents, table for all others */}
                    {/* Data Grid — Generic Accordion for all tables */}
                    <div className="flex-1 overflow-auto bg-slate-50/30">
                        <div className="divide-y divide-slate-100">
                            {filteredData.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <Search size={32} className="text-slate-300" />
                                    </div>
                                    <p className="text-slate-400 text-sm">
                                        {searchQuery ? `No records matching "${searchQuery}".` : `No ${currentTable.name.toLowerCase()} yet.`}
                                    </p>
                                </div>
                            ) : (
                                filteredData.map((row: any) => {
                                    const isOpen = expandedRow === row.id;
                                    const summary = getRowSummary(row);

                                    return (
                                        <div key={row.id} className="bg-white hover:bg-slate-50/60 transition-all">
                                            {/* Accordion Header — Key Info */}
                                            <div
                                                onClick={() => setExpandedRow(isOpen ? null : row.id)}
                                                className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-all select-none border-l-4 ${isOpen ? 'border-crm-500 bg-crm-50/30' : 'border-transparent'}`}
                                            >
                                                {/* Chevron */}
                                                <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>

                                                {/* ID Tag */}
                                                <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded tracking-wider shrink-0 uppercase">{row.id}</span>

                                                {/* Main Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline gap-2 mb-0.5">
                                                        <h3 className="font-bold text-slate-900 text-sm md text-base truncate">{summary.title}</h3>
                                                        <span className="text-xs text-slate-400 font-normal truncate hidden sm:inline">({summary.sub})</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {summary.extra && (
                                                            <span className="text-[11px] text-slate-500 font-medium truncate">
                                                                {summary.extra}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Desktop Summary Tooltip — show non-standard info if any */}
                                                <div className="hidden lg:flex items-center gap-6 text-xs text-slate-400 font-medium mr-4">
                                                    {activeTab === 'leads' && <span>{row.source}</span>}
                                                    {activeTab === 'travelAgents' && <span>{row.agentId}</span>}
                                                </div>

                                                {/* Global Actions */}
                                                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => openEditModal(row)} className="p-2 text-slate-400 hover:text-crm-600 hover:bg-crm-50 rounded-lg transition-all" title="Edit"><Edit2 size={16} /></button>
                                                    <button onClick={() => { if (window.confirm('Delete this record?')) deleteRecord(activeTab, row.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 size={16} /></button>
                                                </div>
                                            </div>

                                            {/* Expanded Body */}
                                            {isOpen && (
                                                <div className="px-14 pb-6 pt-2 bg-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-6 max-w-5xl">
                                                        {/* Dynamic Section Mapping */}
                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-5">
                                                            {currentTable.columns.filter((c: string) => c !== 'ID' && shouldShowColumn(c)).map((col: string, idx: number) => {
                                                                const keyName = colToKey(col);
                                                                const unifiedValue = getUnifiedValue(row, keyName);
                                                                const value = unifiedValue ?? getBookingsFallbackValue(row, keyName) ?? row[col] ?? '-';
                                                                return (
                                                                    <div key={idx}>
                                                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{col}</label>
                                                                        <div className="text-sm text-slate-700 font-medium break-all">
                                                                            {col.toLowerCase().includes('payment') && col.toLowerCase().includes('status') ? (
                                                                                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getPaymentStatusColorClasses(String(value), 'badge')}`}>
                                                                                    {String(value).toUpperCase()}
                                                                                </span>
                                                                            ) : col.toLowerCase().includes('status') ? (
                                                                                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusColor(value)}`}>
                                                                                    {String(value).toUpperCase()}
                                                                                </span>
                                                                            ) : col === 'Email' ? (
                                                                                <a href={`mailto:${value}`} className="text-crm-600 hover:underline">{value}</a>
                                                                            ) : (
                                                                                renderValue(value)
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Special Section: Agent Bank Details (if Travel Agent) */}
                                                        {activeTab === 'travelAgents' && (
                                                            <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Bank Information</label>
                                                                    <p className="text-sm font-bold text-slate-800">{row.bankName} • {row.branchName}</p>
                                                                    <p className="text-xs text-slate-500 font-mono tracking-wider">{row.ifscCode}</p>
                                                                </div>
                                                                <div className="md:text-right border-t md:border-t-0 md:border-l border-indigo-100 pt-3 md:pt-0 md:pl-4">
                                                                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Account Number</label>
                                                                    <p className="text-lg font-black text-indigo-700 font-mono tracking-widest">{row.accountNumber}</p>
                                                                    <p className="text-xs text-slate-400">{row.holderName}</p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Description Section */}
                                                        {row.description && (
                                                            <div className="mt-4 p-6 bg-slate-50 rounded-[24px] border border-slate-100 italic">
                                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description / Private Notes</label>
                                                                <p className="text-sm text-slate-600 leading-relaxed font-medium">"{row.description}"</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-white shrink-0">
                            <h3 className="font-black text-slate-900 text-xl tracking-tight flex items-center gap-3">
                                {isEditing ? <Edit2 size={22} className="text-crm-500" /> : <Plus size={22} className="text-crm-500" />}
                                {isEditing ? 'Edit' : 'Add New'} {activeTab === 'travelAgents' && userRole === 'agent' ? 'Sub-Agent' : currentTable.name.slice(0, currentTable.name.endsWith('s') ? -1 : undefined)}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="p-2.5 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all active:scale-90"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveItem} className="p-6 overflow-y-auto flex-1 flex flex-col">
                            <div className="space-y-4 flex-1">
                                {currentTable.columns.slice(1).filter((c: string) => shouldShowColumn(c)).map((col: string, i: number) => {
                                    const keyName = colToKey(col);
                                    return (
                                        <div key={i}>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-2">{col}</label>
                                            {getStatusOptions(col) ? (
                                                <div className="relative crm-select-wrap">
                                                <select
                                                    name={keyName}
                                                    value={formData[keyName] || ''}
                                                    onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })}
                                                    className={`w-full px-3 py-2.5 pr-10 border rounded-xl text-sm font-bold focus:outline-none appearance-none cursor-pointer ${
                                                        col.toLowerCase().includes('payment') && formData[keyName]
                                                            ? getPaymentStatusColorClasses(String(formData[keyName]), 'select')
                                                            : 'border-slate-200 focus:border-crm-500 focus:ring-1 focus:ring-crm-500 bg-white text-slate-800'
                                                    }`}
                                                >
                                                    <option value="">Select {col}</option>
                                                    {getStatusOptions(col)?.map(opt => {
                                                        const paymentLabel = PAYMENT_STATUS_OPTIONS.find(o => o.value === opt)?.label;
                                                        const label = paymentLabel || `${opt.charAt(0).toUpperCase()}${opt.slice(1)}`;
                                                        return (
                                                            <option key={opt} value={opt}>{label}</option>
                                                        );
                                                    })}
                                                </select>
                                                <DropdownChevron size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                </div>
                                            ) : (
                                                <input
                                                    type={getInputType(col)}
                                                    name={keyName}
                                                    value={(() => {
                                                        const val = formData[keyName] || '';
                                                        // Convert display date "Oct 1, 2026" to "2026-10-01" for date input
                                                        if (getInputType(col) === 'date' && typeof val === 'string' && val.length > 5 && !val.includes('-')) {
                                                            try {
                                                                const d = new Date(val);
                                                                if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
                                                            } catch (e) { }
                                                        }
                                                        return val;
                                                    })()}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-crm-500 focus:ring-1 focus:ring-crm-500 bg-white text-slate-800"
                                                    placeholder={`Enter ${col.toLowerCase()}`}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-8 pt-4 border-t border-slate-100 flex gap-3 justify-end shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-crm-600 hover:bg-crm-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    <CheckCircle2 size={16} />
                                    {isEditing ? 'Save Changes' : 'Save Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatabasePage;
