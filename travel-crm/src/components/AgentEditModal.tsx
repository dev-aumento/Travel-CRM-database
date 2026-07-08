import React, { useEffect, useMemo, useState } from 'react';
import { User, Building, Mail, Key, Phone, MapPin, X } from 'lucide-react';
import DropdownChevron from './DropdownChevron';
import { useDatabase } from '../context/DatabaseContext';
import { buildApprovalPlanFields, sortPlansByPriceAsc } from '../utils/agentPlan';

const toDateInputValue = (iso?: string) => (iso ? String(iso).split('T')[0] : '');

const emptyForm = () => ({
    name: '',
    businessName: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    status: 'approved',
    plan: 'Lite',
    planExpiresAt: '',
    trialEndsAt: '',
    isTrial: false,
});

export interface AgentEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pass agent record to edit; omit for create */
    agent?: any | null;
    onSaved?: () => void;
}

const AgentEditModal: React.FC<AgentEditModalProps> = ({ isOpen, onClose, agent, onSaved }) => {
    const { db, addRecord, updateRecord, getNextId } = useDatabase();
    const isEdit = !!agent?.id;

    const [agentForm, setAgentForm] = useState(emptyForm);

    const planOptions = useMemo(
        () => sortPlansByPriceAsc(db.plans?.data || []).map((p: any) => p.name).filter(Boolean),
        [db.plans?.data]
    );

    useEffect(() => {
        if (!isOpen) return;
        if (agent?.id) {
            setAgentForm({
                name: agent.name || '',
                businessName: agent.businessName || '',
                email: agent.email || '',
                password: agent.password || '',
                phone: agent.phone || '',
                address: agent.address || '',
                status:
                    agent.status === 'disabled'
                        ? 'disabled'
                        : agent.status === 'rejected'
                          ? 'rejected'
                          : 'approved',
                plan: agent.plan || 'Lite',
                planExpiresAt: toDateInputValue(agent.planExpiresAt),
                trialEndsAt: toDateInputValue(agent.trialEndsAt),
                isTrial: !!agent.isTrial, 
            });
        } else {
            setAgentForm(emptyForm());
        }
    }, [isOpen, agent]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const payload: Record<string, unknown> = {
            name: agentForm.name.trim(),
            businessName: agentForm.businessName.trim(),
            email: agentForm.email.trim(),
            password: agentForm.password.trim(),
            phone: agentForm.phone?.trim() || '',
            address: agentForm.address?.trim() || '',
            status: agentForm.status,
            plan: agentForm.plan || 'Lite',
            isTrial: agentForm.isTrial,
            planExpiresAt: agentForm.planExpiresAt
                ? new Date(agentForm.planExpiresAt).toISOString()
                : null,
            trialEndsAt:
                agentForm.isTrial && agentForm.trialEndsAt
                    ? new Date(agentForm.trialEndsAt).toISOString()
                    : null,
        };

        if (isEdit) {
            const existing = (db.travelAgents?.data || []).find((a: any) => a.id === agent.id);
            const planChanged =
                existing?.plan !== payload.plan ||
                String(existing?.planExpiresAt || '') !== String(payload.planExpiresAt || '');
            updateRecord('travelAgents', agent.id, {
                ...payload,
                parentId: existing?.parentId ?? null,
                joinedDate: existing?.joinedDate,
                ...(planChanged ? { planRenewedAt: new Date().toISOString() } : {}),
            });
        } else {
            const planFields = buildApprovalPlanFields(
                {
                    plan: agentForm.plan || 'Lite',
                    isTrial: agentForm.isTrial,
                    trialEndsAt: agentForm.trialEndsAt,
                    planExpiresAt: agentForm.planExpiresAt,
                },
                db.plans?.data || []
            );
            addRecord('travelAgents', {
                id: getNextId('travelAgents', 'AGT'),
                ...payload,
                status: 'approved',
                joinedDate: new Date().toISOString().split('T')[0],
                parentId: null,
                planExpiresAt:
                    agentForm.planExpiresAt
                        ? new Date(agentForm.planExpiresAt).toISOString()
                        : (planFields.planExpiresAt as string) || null,
                trialEndsAt:
                    agentForm.isTrial && agentForm.trialEndsAt
                        ? new Date(agentForm.trialEndsAt).toISOString()
                        : (planFields.trialEndsAt as string) || null,
                ...planFields,
            });
        }

        onSaved?.();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="p-10">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                {isEdit ? 'Edit Agent' : 'Add New Agent'}
                            </h2>
                            <p className="text-sm text-slate-500">
                                {isEdit
                                    ? 'Update Agent details and access'
                                    : 'Create a new travel agency'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                    Agent Full Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                    <input
                                        required
                                        value={agentForm.name}
                                        onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                                        type="text"
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold"
                                        placeholder="Ex: Amit Patel"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                    Agency / Business Name
                                </label>
                                <div className="relative">
                                    <Building className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                    <input
                                        required
                                        value={agentForm.businessName}
                                        onChange={(e) =>
                                            setAgentForm({ ...agentForm, businessName: e.target.value })
                                        }
                                        type="text"
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold"
                                        placeholder="Ex: FlyHigh Travels"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                        <input
                                            required
                                            value={agentForm.email}
                                            onChange={(e) =>
                                                setAgentForm({ ...agentForm, email: e.target.value })
                                            }
                                            type="email"
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <Key className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                        <input
                                            required
                                            value={agentForm.password}
                                            onChange={(e) =>
                                                setAgentForm({ ...agentForm, password: e.target.value })
                                            }
                                            type="text"
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                        Phone Number
                                    </label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                        <input
                                            value={agentForm.phone}
                                            onChange={(e) =>
                                                setAgentForm({ ...agentForm, phone: e.target.value })
                                            }
                                            type="text"
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                        Office Address
                                    </label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                        <input
                                            value={agentForm.address}
                                            onChange={(e) =>
                                                setAgentForm({ ...agentForm, address: e.target.value })
                                            }
                                            type="text"
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                    Subscription Plan
                                </label>
                                <div className="relative crm-select-wrap">
                                <select
                                    value={agentForm.plan}
                                    onChange={(e) => setAgentForm({ ...agentForm, plan: e.target.value })}
                                    className="w-full px-4 py-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold appearance-none cursor-pointer"
                                >
                                    {(planOptions.length ? planOptions : ['Lite', 'Growth', 'Enterprise']).map(
                                        (p: string) => (
                                            <option key={p} value={p}>
                                                {p}
                                            </option>
                                        )
                                    )}
                                </select>
                                <DropdownChevron size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                        Plan Expires
                                    </label>
                                    <input
                                        type="date"
                                        value={agentForm.planExpiresAt}
                                        onChange={(e) =>
                                            setAgentForm({ ...agentForm, planExpiresAt: e.target.value })
                                        }
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                        Trial Ends
                                    </label>
                                    <input
                                        type="date"
                                        value={agentForm.trialEndsAt}
                                        disabled={!agentForm.isTrial}
                                        onChange={(e) =>
                                            setAgentForm({ ...agentForm, trialEndsAt: e.target.value })
                                        }
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold disabled:opacity-50 disabled:dark:opacity-100 disabled:dark:text-slate-200 disabled:dark:bg-slate-700 disabled:dark:border-slate-500"
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={agentForm.isTrial}
                                    onChange={(e) =>
                                        setAgentForm({ ...agentForm, isTrial: e.target.checked })
                                    }
                                    className="w-4 h-4 rounded border-slate-300 text-crm-600"
                                />
                                <span className="text-xs font-bold text-slate-600">Trial account</span>
                            </label>
                            {isEdit && (
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                        Account Status
                                    </label>
                                    <div className="relative crm-select-wrap">
                                    <select
                                        value={agentForm.status}
                                        onChange={(e) =>
                                            setAgentForm({ ...agentForm, status: e.target.value })
                                        }
                                        className="w-full px-4 py-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold appearance-none cursor-pointer"
                                    >
                                        <option value="approved">Active</option>
                                        <option value="disabled">Disabled</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                    <DropdownChevron size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="w-full py-4 bg-crm-600 hover:bg-crm-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-crm-200 active:scale-[0.98] transition-all"
                        >
                            {isEdit ? 'Save Changes' : 'Create Agent'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AgentEditModal;