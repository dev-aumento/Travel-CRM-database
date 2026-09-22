import React, { useEffect, useMemo, useRef, useState } from 'react';
import AgentEditModal from '../components/AgentEditModal';
import {
    Users,
    Mail,
    Calendar,
    Crown,
    Building2,
    Plus,
    Edit2,
    LayoutGrid,
    List,
    Phone,
    User,
    Clock,
} from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import type { AgentInsightCategory } from '../utils/agentPlan';
import {
    agentInsightLabel,
    daysUntil,
    getAgentInsightCategories,
    getAgentPlanExpiryDisplay,
    isMainAgencyAgent,
    isNewAgent,
    isPlanRenewedRecently,
    planExpiryBadgeClass,
} from '../utils/agentPlan';

type EnrichedAgent = {
    agent: any;
    categories: AgentInsightCategory[];
    expiry: ReturnType<typeof getAgentPlanExpiryDisplay>;
    column: AgentInsightCategory;
};

const AGENT_COLUMNS: { id: AgentInsightCategory; title: string; color: string }[] = [
    { id: 'new', title: 'New Agents', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'active', title: 'Active Agents', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { id: 'expiring_soon', title: 'Expiring Soon', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: 'expired', title: 'Plan Expired', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { id: 'renewed', title: 'Plan Renewed', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { id: 'disabled', title: 'Disabled', color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

const COLUMN_PRIORITY: AgentInsightCategory[] = [
    'disabled',
    'expired',
    'expiring_soon',
    'renewed',
    'new',
    'active',
];

const resolveKanbanColumn = (categories: AgentInsightCategory[]): AgentInsightCategory => {
    for (const id of COLUMN_PRIORITY) {
        if (categories.includes(id)) return id;
    }
    return 'active';
};

const statusBadgeClass = (column: AgentInsightCategory): string => {
    switch (column) {
        case 'new':
            return 'bg-blue-50 text-blue-700 border-blue-100';
        case 'active':
            return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        case 'expiring_soon':
            return 'bg-amber-50 text-amber-700 border-amber-100';
        case 'expired':
            return 'bg-rose-50 text-rose-700 border-rose-100';
        case 'renewed':
            return 'bg-indigo-50 text-indigo-700 border-indigo-100';
        case 'disabled':
            return 'bg-slate-50 text-slate-500 border-slate-100';
        default:
            return 'bg-slate-50 text-slate-500 border-slate-100';
    }
};

const AgentPipelineCard = ({
    agent,
    column,
    expiry,
    onEdit,
}: {
    agent: any;
    column: AgentInsightCategory;
    expiry: ReturnType<typeof getAgentPlanExpiryDisplay>;
    onEdit: () => void;
}) => {
    const trialDays = agent.isTrial && agent.trialEndsAt ? daysUntil(agent.trialEndsAt) : null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 hover:border-crm-300 hover:shadow-md transition-all mb-3 group overflow-hidden">
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-slate-800">{agent.name}</h4>
                    <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusBadgeClass(column)}`}
                    >
                        {agentInsightLabel[column]}
                    </span>
                </div>

                <div className="text-xs text-slate-500 space-y-1.5 mb-3">
                    <div className="flex items-center gap-2 w-full">
                        <Building2 size={14} className="text-crm-500 shrink-0" />
                        <span className="truncate text-[13px] text-slate-700 font-medium">{agent.businessName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Mail size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{agent.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-slate-400 shrink-0" />
                        <span>Joined {agent.joinedDate || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-50">
                        <Crown size={12} className="text-indigo-400 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                            Plan:{' '}
                            <span className="text-indigo-600 font-black">
                                {agent.isTrial ? `Trial · ${agent.plan || 'Lite'}` : agent.plan || 'Lite'}
                            </span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock size={12} className="text-slate-400 shrink-0" />
                        <span
                            className={`text-[10px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded border ${planExpiryBadgeClass(expiry.tone)}`}
                        >
                            {expiry.label}: {expiry.text}
                        </span>
                    </div>
                    {isNewAgent(agent) && (
                        <div className="flex items-center gap-2 mt-1">
                            <User size={12} className="text-blue-400" />
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">
                                New registration
                            </span>
                        </div>
                    )}
                    {isPlanRenewedRecently(agent) && (
                        <div className="flex items-center gap-2 mt-1">
                            <Crown size={12} className="text-emerald-400" />
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                                Recent plan renewal
                            </span>
                        </div>
                    )}
                    {trialDays != null && trialDays > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                            <Clock size={12} className="text-indigo-400" />
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                                {trialDays} days trial left
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 pt-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        type="button"
                        onClick={onEdit}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white text-slate-500 hover:text-crm-600 hover:bg-crm-50 rounded-lg text-[10px] font-bold transition-all border border-slate-200"
                    >
                        <Edit2 size={12} /> Edit Agent
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdminAgentLeadsHub = () => {
    const { db } = useDatabase();
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<any | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollIntervalRef = useRef<number | null>(null);

    const enrichedAgents = useMemo((): EnrichedAgent[] => {
        const mainAgents = (db.travelAgents?.data || []).filter((a: any) => isMainAgencyAgent(a));
        return mainAgents.map((agent: any) => {
            const categories = getAgentInsightCategories(agent);
            return {
                agent,
                categories,
                expiry: getAgentPlanExpiryDisplay(agent),
                column: resolveKanbanColumn(categories),
            };
        });
    }, [db.travelAgents?.data]);

    const filteredAgents = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return enrichedAgents;
        return enrichedAgents.filter(({ agent }) => {
            const haystack = [agent.name, agent.businessName, agent.email, agent.plan, agent.joinedDate, agent.id]
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [enrichedAgents, search]);

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
        if (x < scrollZoneWidth) startScroll('left');
        else if (x > rect.width - scrollZoneWidth) startScroll('right');
        else stopScroll();
    };

    useEffect(() => () => stopScroll(), []);

    const openEditModal = (agent: any) => {
        setEditingAgent(agent);
        setModalOpen(true);
    };

    const openAddModal = () => {
        setEditingAgent(null);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingAgent(null);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Users className="text-crm-600" size={28} />
                        Leads
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">
                        Agent network pipeline — onboarding, subscriptions & renewals
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search agents..."
                        className="hidden md:block w-48 lg:w-56 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-crm-300"
                    />
                    <button
                        type="button"
                        onClick={openAddModal}
                        className="btn-primary flex items-center gap-2 shadow-crm-600/20"
                    >
                        <Plus size={18} /> Add Agent
                    </button>
                    <div className="flex items-center bg-white border border-slate-200 p-1 rounded-lg shadow-sm">
                        <button
                            type="button"
                            onClick={() => setViewMode('pipeline')}
                            className={`p-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all ${
                                viewMode === 'pipeline'
                                    ? 'bg-crm-50 text-crm-600 shadow-inner'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                            }`}
                            title="Pipeline View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all ${
                                viewMode === 'list'
                                    ? 'bg-crm-50 text-crm-600 shadow-inner'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                            }`}
                            title="List View"
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="md:hidden mb-4 shrink-0">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search agents..."
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-crm-300"
                />
            </div>

            {viewMode === 'pipeline' ? (
                <div
                    ref={scrollContainerRef}
                    onMouseMove={handleMouseMoveOrDrag}
                    onMouseLeave={stopScroll}
                    onDragOver={handleMouseMoveOrDrag}
                    onDragLeave={stopScroll}
                    className="flex-1 flex gap-6 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                    {AGENT_COLUMNS.map((column) => {
                        const colAgents = filteredAgents.filter((row) => row.column === column.id);

                        return (
                            <div key={column.id} className="min-w-[320px] w-[320px] flex flex-col">
                                <div
                                    className={`px-4 py-2.5 rounded-t-xl font-medium border-b-2 flex justify-between items-center ${column.color}`}
                                >
                                    <span className="text-sm uppercase tracking-wider font-semibold">
                                        {column.title}
                                    </span>
                                    <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs font-bold">
                                        {colAgents.length}
                                    </span>
                                </div>
                                <div className="flex-1 bg-slate-100/50 p-3 rounded-b-xl border border-t-0 border-slate-200 overflow-y-auto custom-scrollbar min-h-[120px]">
                                    {colAgents.map(({ agent, expiry, column: col }) => (
                                        <AgentPipelineCard
                                            key={agent.id}
                                            agent={agent}
                                            column={col}
                                            expiry={expiry}
                                            onEdit={() => openEditModal(agent)}
                                        />
                                    ))}
                                    {colAgents.length === 0 && (
                                        <div className="h-24 flex items-center justify-center text-sm font-medium text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                            No agents here
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-300 min-h-0">
                    <div className="overflow-x-auto flex-1 text-[13px] custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4">Agent</th>
                                    <th className="px-6 py-4">Contact</th>
                                    <th className="px-6 py-4">Joined</th>
                                    <th className="px-6 py-4">Plan</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-center">Expiry</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredAgents.map(({ agent, expiry, column }) => (
                                    <tr key={agent.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-bold text-slate-800">{agent.name}</div>
                                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mt-0.5">
                                                {agent.id}
                                            </div>
                                            <div className="text-xs text-crm-600 font-bold mt-1">{agent.businessName}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Mail size={14} className="text-slate-400" />
                                                {agent.email}
                                            </div>
                                            {agent.phone && (
                                                <div className="flex items-center gap-2 text-slate-500 mt-1">
                                                    <Phone size={14} className="text-slate-400" />
                                                    {agent.phone}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                                            {agent.joinedDate || '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-bold text-indigo-600">
                                                {agent.isTrial ? `Trial · ${agent.plan || 'Lite'}` : agent.plan || 'Lite'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span
                                                className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border inline-block ${statusBadgeClass(column)}`}
                                            >
                                                {agentInsightLabel[column]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span
                                                className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${planExpiryBadgeClass(expiry.tone)}`}
                                            >
                                                {expiry.text}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => openEditModal(agent)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-crm-600 hover:bg-crm-50 rounded-lg border border-slate-200 transition-all"
                                            >
                                                <Edit2 size={12} /> Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredAgents.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-16 text-center text-slate-400 font-medium">
                                            No agents match your search
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <AgentEditModal
                isOpen={modalOpen}
                onClose={closeModal}
                agent={editingAgent}
            />
        </div>
    );
};

export default AdminAgentLeadsHub;
