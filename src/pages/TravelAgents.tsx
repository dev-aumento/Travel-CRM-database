import React, { useState } from 'react';
import { Users, Building, Mail, Phone, CreditCard, Plus, Edit2, Trash2, Search, X, CheckCircle2, Globe, Landmark, Fingerprint } from 'lucide-react';
import DropdownChevron from '../components/DropdownChevron';
import { useDatabase } from '../context/DatabaseContext';
import {
    COUNTRY_PHONE_DATA,
    DEFAULT_COUNTRY_CODE,
    PHONE_LIMITS,
    formatStoredAgentPhone,
    getPhoneDigitLimit,
    parseStoredAgentPhone,
    sanitizeLocalPhoneDigits,
} from '../utils/countryPhoneData';
import AgentAvatar from '../components/AgentAvatar';

const REQUIRED_AGENT_FIELDS = ['name', 'businessName', 'email', 'phone'] as const;
type RequiredAgentField = (typeof REQUIRED_AGENT_FIELDS)[number];

const TravelAgents = () => {
    const { db, addRecord, updateRecord, deleteRecord } = useDatabase();
    const agents = db.travelAgents?.data || [];

    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [form, setForm] = useState({
        name: '',
        businessName: '',
        gstDetails: '',
        email: '',
        phone: '',
        countryCode: DEFAULT_COUNTRY_CODE,
        bankName: '',
        holderName: '',
        branchName: '',
        ifscCode: '',
        accountNumber: ''
    });
    const [errors, setErrors] = useState<Partial<Record<RequiredAgentField, string>>>({});
    const requiredPhoneDigits = getPhoneDigitLimit(form.countryCode);
    const hasMissingRequiredField = REQUIRED_AGENT_FIELDS.some(field => form[field].trim() === '');
    const isPhoneValidLength = form.phone.length === requiredPhoneDigits;

    const validateForm = () => {
        const nextErrors: Partial<Record<RequiredAgentField, string>> = {};
        if (!form.name.trim()) nextErrors.name = 'Agent full name is required';
        if (!form.businessName.trim()) nextErrors.businessName = 'Business / agency name is required';
        if (!form.email.trim()) nextErrors.email = 'Primary email is required';
        if (!form.phone.trim()) {
            nextErrors.phone = 'Mobile number is required';
        } else if (!isPhoneValidLength) {
            nextErrors.phone = `Mobile number must be exactly ${requiredPhoneDigits} digits`;
        }
        return nextErrors;
    };

    const resetForm = () => {
        setForm({
            name: '',
            businessName: '',
            gstDetails: '',
            email: '',
            phone: '',
            countryCode: DEFAULT_COUNTRY_CODE,
            bankName: '',
            holderName: '',
            branchName: '',
            ifscCode: '',
            accountNumber: ''
        });
        setIsAdding(false);
        setEditingId(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const nextErrors = validateForm();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        const fullPhone = formatStoredAgentPhone(form.countryCode, form.phone);
        
        if (editingId) {
            updateRecord('travelAgents', editingId, { ...form, phone: fullPhone });
        } else {
            addRecord('travelAgents', {
                id: `AGT-${Date.now().toString(36).toUpperCase()}`,
                ...form,
                phone: fullPhone
            });
        }
        resetForm();
    };

    const handleEdit = (agent: any) => {
        const parsedPhone = parseStoredAgentPhone(agent.phone);
        setForm({
            ...agent,
            countryCode: parsedPhone.countryCode,
            phone: parsedPhone.phone,
        });
        setEditingId(agent.id);
        setIsAdding(true);
    };

    const filteredAgents = agents.filter((agent: any) => 
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.businessName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Users className="text-crm-600" size={28} /> Travel <span className="text-crm-600">Agents</span>
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Manage your travel agents and settlements</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-crm-600" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search agents..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-crm-500 outline-none w-full md:w-64 transition-all shadow-sm"
                        />
                    </div>
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-xl shadow-crm-600/20 active:scale-95 transition-all"
                    >
                        <Plus size={18} /> Add Agent
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Agent List (LEFT) */}
                <div className="lg:col-span-8 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {filteredAgents.map((agent: any) => (
                        <div key={agent.id} className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-crm-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(agent)} className="p-2 text-slate-400 hover:text-crm-600 hover:bg-crm-50 rounded-lg transition-all">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => { if(window.confirm('Delete Agent?')) deleteRecord('travelAgents', agent.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* General Info Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <AgentAvatar
                                            agent={agent}
                                            className="w-12 h-12"
                                            textClassName="text-lg"
                                        />
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                                {agent.name}
                                                {agent.gstDetails && <CheckCircle2 size={14} className="text-emerald-500" />}
                                            </h3>
                                            <p className="text-xs font-bold text-crm-600 uppercase tracking-widest">{agent.businessName}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 border-t border-slate-50 pt-3">
                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                            <Mail size={14} className="text-slate-400" /> {agent.email}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                            <Phone size={14} className="text-slate-400" /> {agent.phone}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                            <Fingerprint size={14} className="text-slate-400" /> GST: <span className="text-slate-800 font-bold">{agent.gstDetails}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bank Info Section */}
                                <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 space-y-3">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Landmark size={12} /> Bank Information
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium">Bank Name</span>
                                            <span className="text-slate-800 font-bold">{agent.bankName}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium">Holder</span>
                                            <span className="text-slate-800 font-bold max-w-[150px] truncate" title={agent.holderName}>{agent.holderName}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium">IFSC Code</span>
                                            <span className="text-crm-700 font-mono font-bold">{agent.ifscCode}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm mt-2">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Account No.</span>
                                            <span className="text-sm font-black text-slate-900 font-mono tracking-tight">{agent.accountNumber}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredAgents.length === 0 && (
                        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                            <Users size={48} className="text-slate-200 mb-4" />
                            <p className="text-slate-400 font-bold">No agents found in your network</p>
                        </div>
                    )}
                </div>

                {/* Agent Form (RIGHT/MODAL) */}
                {isAdding && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[40px] shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                            <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-white shrink-0">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                        {editingId ? 'Refine Agent' : 'Register New Agent'}
                                    </h2>
                                    <p className="text-xs text-slate-400 font-medium mt-1">Capture agent profiling and financial metrics</p>
                                </div>
                                <button onClick={resetForm} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-500 transition-all active:scale-90">
                                    <X size={24} />
                                </button>
                            </div>
                            
                            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                                {/* Section 1: General Intelligence */}
                                <div className="space-y-6">
                                    <h3 className="text-xs font-bold text-crm-600 uppercase tracking-[4px] flex items-center gap-3">
                                        <Building size={16} /> 01. General Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-2">Agent Full Name</label>
                                                <div className="relative">
                                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                                    <input value={form.name} onChange={e => { setForm({...form, name: e.target.value}); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })); }} type="text" required className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:ring-1 focus:ring-crm-500 outline-none font-medium ${errors.name ? 'border-red-400' : 'border-slate-200'}`} placeholder="Ex: Rahul Sharma" />
                                                </div>
                                                {errors.name && <p className="mt-1 text-[11px] font-semibold text-red-600">{errors.name}</p>}
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Business / Agency Name</label>
                                                <div className="relative">
                                                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                                    <input value={form.businessName} onChange={e => { setForm({...form, businessName: e.target.value}); if (errors.businessName) setErrors(prev => ({ ...prev, businessName: undefined })); }} type="text" required className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:ring-1 focus:ring-crm-500 outline-none font-medium ${errors.businessName ? 'border-red-400' : 'border-slate-200'}`} placeholder="Ex: Global Tours & Travels" />
                                                </div>
                                                {errors.businessName && <p className="mt-1 text-[11px] font-semibold text-red-600">{errors.businessName}</p>}
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">GST Details (Optional)</label>
                                                <div className="relative">
                                                    <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                                    <input value={form.gstDetails} onChange={e => setForm({...form, gstDetails: e.target.value})} type="text" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-crm-500 outline-none font-bold placeholder:font-normal" placeholder="Ex: 27AAAAA0000A1Z5" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Primary Email</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                                    <input value={form.email} onChange={e => { setForm({...form, email: e.target.value}); if (errors.email) setErrors(prev => ({ ...prev, email: undefined })); }} type="email" required className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:ring-1 focus:ring-crm-500 outline-none font-medium ${errors.email ? 'border-red-400' : 'border-slate-200'}`} placeholder="Ex: agent@example.com" />
                                                </div>
                                                {errors.email && <p className="mt-1 text-[11px] font-semibold text-red-600">{errors.email}</p>}
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Mobile Number</label>
                                                <div className="flex gap-2">
                                                    {/* Country Code Dropdown — shows all countries with name + code */}
                                                    <div className="w-48 shrink-0 relative crm-select-wrap">
                                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" size={14} />
                                                        <select
                                                            value={form.countryCode}
                                                            onChange={e => setForm({ ...form, countryCode: e.target.value, phone: '' })}
                                                            className="w-full pl-8 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-crm-500 outline-none appearance-none cursor-pointer"
                                                        >
                                                            {COUNTRY_PHONE_DATA.map(country => (
                                                                <option key={country.code} value={country.code}>
                                                                    {country.name} ({country.code})
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <DropdownChevron size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                    </div>
                                                    {/* Phone Number Input with live digit counter */}
                                                    <div className="w-72 relative">
                                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                                        <input
                                                            value={form.phone}
                                                            onChange={e => {
                                                                // Strip ALL non-digit characters (spaces, dashes, parentheses, etc.)
                                                                setForm({
                                                                    ...form,
                                                                    phone: sanitizeLocalPhoneDigits(e.target.value, form.countryCode),
                                                                });
                                                                if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
                                                            }}
                                                            type="text"
                                                            inputMode="numeric"
                                                            required
                                                            maxLength={PHONE_LIMITS[form.countryCode]?.digits ?? 15}
                                                            className={`w-full pl-10 pr-16 py-2.5 bg-slate-50 border rounded-xl text-sm focus:ring-1 focus:ring-crm-500 outline-none font-bold tracking-widest transition-colors ${
                                                                errors.phone
                                                                    ? 'border-red-400 bg-red-50/30'
                                                                    : form.phone.length > 0 && form.phone.length < (PHONE_LIMITS[form.countryCode]?.digits ?? 15)
                                                                    ? 'border-amber-300 bg-amber-50/30'
                                                                    : form.phone.length === (PHONE_LIMITS[form.countryCode]?.digits ?? 15)
                                                                    ? 'border-emerald-300 bg-emerald-50/30'
                                                                    : 'border-slate-200'
                                                            }`}
                                                            placeholder={`${PHONE_LIMITS[form.countryCode]?.digits ?? '—'} digits`}
                                                        />
                                                        {/* Live digit counter badge */}
                                                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black tabular-nums ${
                                                            form.phone.length === (PHONE_LIMITS[form.countryCode]?.digits ?? 15)
                                                                ? 'text-emerald-500'
                                                                : form.phone.length > 0
                                                                ? 'text-amber-500'
                                                                : 'text-slate-300'
                                                        }`}>
                                                            {form.phone.length}/{PHONE_LIMITS[form.countryCode]?.digits ?? 15}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Validation hint */}
                                                {form.phone.length > 0 && form.phone.length < (PHONE_LIMITS[form.countryCode]?.digits ?? 15) && (
                                                    <p className="text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                                                        ⚠ {PHONE_LIMITS[form.countryCode]?.name} numbers require exactly {PHONE_LIMITS[form.countryCode]?.digits} digits
                                                    </p>
                                                )}
                                                {form.phone.length === (PHONE_LIMITS[form.countryCode]?.digits ?? 15) && form.phone.length > 0 && (
                                                    <p className="text-[10px] text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
                                                        ✓ Valid {PHONE_LIMITS[form.countryCode]?.name} number
                                                    </p>
                                                )}
                                                {errors.phone && <p className="text-[11px] font-semibold text-red-600 mt-1.5">{errors.phone}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Settlement Metrics */}
                                <div className="space-y-6">
                                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-[4px] flex items-center gap-3">
                                        <Landmark size={16} /> 02. Bank Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-indigo-50/30 rounded-2xl border border-indigo-100">
                                        <div className="col-span-1">
                                            <label className="block text-[11px] font-bold text-indigo-500 uppercase mb-2 text-[9px]">Bank Name</label>
                                            <input value={form.bankName} onChange={e => setForm({...form, bankName: e.target.value})} type="text" className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 outline-none font-bold" placeholder="Ex: HDFC Bank" />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-[11px] font-bold text-indigo-500 uppercase mb-2 text-[9px]">A/C Holder Name</label>
                                            <input value={form.holderName} onChange={e => setForm({...form, holderName: e.target.value})} type="text" className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 outline-none font-bold" placeholder="As per passbook" />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-[11px] font-bold text-indigo-500 uppercase mb-2 text-[9px]">Branch Name</label>
                                            <input value={form.branchName} onChange={e => setForm({...form, branchName: e.target.value})} type="text" className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 outline-none font-bold" placeholder="Branch location" />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-[11px] font-bold text-indigo-500 uppercase mb-2 text-[9px]">IFSC Code</label>
                                            <input value={form.ifscCode} onChange={e => setForm({...form, ifscCode: e.target.value})} type="text" className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 outline-none font-bold font-mono tracking-widest" placeholder="HDFC0001234" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[11px] font-bold text-indigo-500 uppercase mb-2 text-[9px]">Account Number</label>
                                            <div className="relative">
                                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300" size={16} />
                                                <input value={form.accountNumber} onChange={e => setForm({...form, accountNumber: e.target.value})} type="text" className="w-full pl-10 pr-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 outline-none font-black font-mono tracking-wider" placeholder="0000 0000 0000 0000" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Form Action Bar */}
                                <div className="pt-2 flex gap-4">
                                    <button 
                                        type="submit"
                                        className="flex-1 py-4 bg-crm-600 hover:bg-crm-700 text-white rounded-2xl text-base font-black shadow-2xl shadow-crm-600/30 transition-all active:scale-[0.98]"
                                    >
                                        {editingId ? 'Synchronize Agent Data' : 'Initialize Agent Account'}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={resetForm}
                                        className="px-10 py-4 border border-slate-200 text-slate-500 rounded-2xl text-base font-bold hover:bg-slate-50 transition-all"
                                    >
                                        Abort
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TravelAgents;
