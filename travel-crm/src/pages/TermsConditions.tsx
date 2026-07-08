import React, { useMemo, useState } from 'react';
import { Plus, MapPin, Edit3, Trash2, X, FileText, Globe, CheckCircle2 } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import type { QuoteTermsRecord } from '../utils/quoteTerms';
import TermsRichTextEditor from '../components/TermsRichTextEditor';
import {
    isTermsHtml,
    plainTermsToHtml,
    sanitizeTermsHtml,
    termsContentIsEmpty,
} from '../utils/termsRichText';

const EMPTY_FORM = {
    title: '',
    location: '',
    locations: '',
    content: '',
    isDefault: false,
    status: 'Active',
};

const TermsConditions = () => {
    const { db, addRecord, updateRecord, deleteRecord } = useDatabase();
    const userRole = localStorage.getItem('userRole');
    const currentAgentId = localStorage.getItem('agentId');

    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    const destinationOptions = useMemo(() => {
        const fromDb = (db?.destinations?.data || []).map((d: any) => d.country || d.name).filter(Boolean);
        const fromHotels = Array.from(
            new Set((db?.hotels?.data || []).map((h: any) => h.destination || h.location).filter(Boolean))
        );
        return Array.from(new Set([...fromDb, ...fromHotels])).sort();
    }, [db?.destinations?.data, db?.hotels?.data]);

    const visibleTerms = useMemo(() => {
        let rows: QuoteTermsRecord[] = db?.quoteTerms?.data || [];
        if (userRole === 'agent' || userRole === 'staff') {
            rows = rows.filter((t) => !t.agentId || t.agentId === currentAgentId);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            rows = rows.filter(
                (t) =>
                    t.title?.toLowerCase().includes(q) ||
                    t.location?.toLowerCase().includes(q) ||
                    t.content?.toLowerCase().includes(q)
            );
        }
        return rows.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
    }, [db?.quoteTerms?.data, userRole, currentAgentId, search]);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const openEdit = (record: QuoteTermsRecord) => {
        setEditingId(record.id);
        setForm({
            title: record.title || '',
            location: record.location || '',
            locations: (record.locations || []).join(', '),
            content: plainTermsToHtml(record.content || ''),
            isDefault: Boolean(record.isDefault),
            status: record.status || 'Active',
        });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        const sanitizedContent = sanitizeTermsHtml(form.content);
        if (!form.title.trim() || !form.location.trim() || termsContentIsEmpty(sanitizedContent)) {
            alert('Please fill title, location, and terms content.');
            return;
        }

        const payload: QuoteTermsRecord = {
            id: editingId || `TC-${Date.now()}`,
            title: form.title.trim(),
            location: form.location.trim(),
            locations: form.locations
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            content: sanitizedContent,
            agentId: userRole === 'admin' ? null : currentAgentId || null,
            isDefault: form.isDefault,
            status: form.status,
            updatedAt: new Date().toISOString(),
        };

        if (form.isDefault) {
            (db?.quoteTerms?.data || []).forEach((t: QuoteTermsRecord) => {
                const sameScope =
                    userRole === 'admin' ? !t.agentId : t.agentId === currentAgentId || !t.agentId;
                if (sameScope && t.isDefault && t.id !== payload.id) {
                    updateRecord('quoteTerms', t.id, { ...t, isDefault: false });
                }
            });
        }

        if (editingId) {
            updateRecord('quoteTerms', editingId, payload);
        } else {
            addRecord('quoteTerms', payload);
        }

        setIsModalOpen(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    };

    return (
        <div className="w-full h-full flex flex-col gap-6 min-h-0">
            <div className="shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Terms & Conditions</h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        Create location-specific terms. They appear automatically on quotations, print PDFs, and WhatsApp messages.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-crm-600 hover:bg-crm-700 text-white rounded-xl text-sm font-bold shadow-md"
                >
                    <Plus size={18} /> Add Terms
                </button>
            </div>

            <div className="shrink-0">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by location or title..."
                    className="w-full max-w-md px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {visibleTerms.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
                        <FileText size={40} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-slate-500 font-bold">No terms configured yet</p>
                        <p className="text-sm text-slate-400 mt-1">Add terms for Dubai, Paris, Bali, or a global default.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {visibleTerms.map((record) => (
                            <div
                                key={record.id}
                                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-crm-200 transition-all"
                            >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <h3 className="font-black text-slate-800 truncate">{record.title}</h3>
                                            {record.isDefault && (
                                                <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                                    Default
                                                </span>
                                            )}
                                            <span
                                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                    record.status === 'Active'
                                                        ? 'bg-sky-50 text-sky-700'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}
                                            >
                                                {record.status || 'Active'}
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-crm-600 flex items-center gap-1">
                                            <MapPin size={12} /> {record.location}
                                            {(record.locations || []).length > 0 && (
                                                <span className="text-slate-400 font-medium">
                                                    • also: {(record.locations || []).join(', ')}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => openEdit(record)}
                                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm('Delete these terms?')) deleteRecord('quoteTerms', record.id);
                                            }}
                                            className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 max-h-[140px] overflow-y-auto custom-scrollbar">
                                    {isTermsHtml(record.content || '') ? (
                                        <div
                                            className="terms-rich-content text-xs text-slate-600"
                                            dangerouslySetInnerHTML={{
                                                __html: sanitizeTermsHtml(record.content || '').slice(0, 800),
                                            }}
                                        />
                                    ) : (
                                        (record.content || '').split('\n').slice(0, 6).map((line, idx) => (
                                            <p key={idx} className="text-xs text-slate-600 leading-relaxed">
                                                • {line.replace(/^[\s•\-*]+/, '')}
                                            </p>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-slate-800">
                                    {editingId ? 'Edit Terms' : 'New Terms & Conditions'}
                                </h3>
                                <p className="text-xs text-slate-500">Matched by destination when sharing quotes</p>
                            </div>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Title</label>
                                <input
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="e.g. Dubai & UAE Package Terms"
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Primary Location</label>
                                    <input
                                        list="terms-locations"
                                        value={form.location}
                                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                                        placeholder="e.g. UAE, France, Bali"
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
                                    />
                                    <datalist id="terms-locations">
                                        {destinationOptions.map((opt) => (
                                            <option key={opt} value={opt} />
                                        ))}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Also match (comma separated)</label>
                                    <input
                                        value={form.locations}
                                        onChange={(e) => setForm({ ...form, locations: e.target.value })}
                                        placeholder="Dubai, Paris, Himachal"
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                    Terms content
                                </label>
                                <p className="text-[11px] text-slate-400 mb-2">
                                    Use headings, bold text, and bullet or numbered lists. Legacy plain-text terms are converted automatically when you edit them.
                                </p>
                                <TermsRichTextEditor
                                    key={editingId || 'new-terms'}
                                    value={form.content}
                                    onChange={(html) => setForm({ ...form, content: html })}
                                    placeholder="Add section headings, bullet points, and policy details…"
                                />
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isDefault}
                                        onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                                        className="rounded border-slate-300"
                                    />
                                    <Globe size={16} /> Use as default fallback
                                </label>
                                <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-600">
                                    Status
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                                        className="px-2 py-1 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="px-6 py-2.5 bg-crm-600 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2"
                            >
                                <CheckCircle2 size={16} /> Save Terms
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TermsConditions;
