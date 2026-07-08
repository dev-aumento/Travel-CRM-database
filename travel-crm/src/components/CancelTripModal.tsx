import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Search, X } from 'lucide-react';
import DropdownChevron from './DropdownChevron';

export const CANCELLATION_REASONS = [
    'Plan Dropped',
    'Fake Query',
    'Booked with Someone else',
    'Destination Changed',
    'Postponed',
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export type CancelTripTarget = {
    kind: 'lead' | 'booking';
    id: string;
    trackingId?: string;
    customerName: string;
    destination?: string;
    duration?: string;
    breadcrumb?: string;
};

type CancelTripModalProps = {
    target: CancelTripTarget | null;
    onClose: () => void;
    onConfirm: (payload: {
        reason: CancellationReason;
        contactReminderOn: string;
        notes: string;
    }) => void;
};

const formatReminderDisplay = (iso: string) => {
    if (!iso) return '';
    try {
        return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
};

const CancelTripModal = ({ target, onClose, onConfirm }: CancelTripModalProps) => {
    const [reasonSearch, setReasonSearch] = useState('');
    const [selectedReason, setSelectedReason] = useState<CancellationReason | ''>('');
    const [contactReminderOn, setContactReminderOn] = useState('');
    const [notes, setNotes] = useState('');
    const [reasonOpen, setReasonOpen] = useState(false);
    const reasonRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!target) return;
        setReasonSearch('');
        setSelectedReason('');
        setContactReminderOn('');
        setNotes('');
        setReasonOpen(false);
    }, [target?.id]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (reasonRef.current && !reasonRef.current.contains(e.target as Node)) {
                setReasonOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredReasons = useMemo(() => {
        const q = reasonSearch.trim().toLowerCase();
        if (!q) return [...CANCELLATION_REASONS];
        return CANCELLATION_REASONS.filter((r) => r.toLowerCase().includes(q));
    }, [reasonSearch]);

    if (!target) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReason) return;
        onConfirm({
            reason: selectedReason,
            contactReminderOn,
            notes: notes.trim(),
        });
    };

    const contextLine =
        target.breadcrumb ||
        [target.trackingId, target.customerName, target.destination?.split(',')[0]]
            .filter(Boolean)
            .join(' • ');

    return (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-labelledby="cancel-trip-title"
            >
                <div className="px-8 pt-8 pb-6 border-b border-slate-100 shrink-0">
                    {contextLine && (
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                            Trips &gt; {contextLine} &gt; Cancel
                        </p>
                    )}
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <h2
                                id="cancel-trip-title"
                                className="text-xl font-black text-amber-900 tracking-tight"
                            >
                                Mark Lead/Query as Canceled
                            </h2>
                            <p className="text-sm text-slate-500 mt-2 max-w-xl leading-relaxed">
                                Leads/Queries can be cancelled because of reasons like client not interested,
                                plan changed, or the client is already converted by someone else.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="px-8 py-6 overflow-y-auto flex-1 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div ref={reasonRef} className="relative">
                                <label className="block text-xs font-bold text-slate-700 mb-2">
                                    Reason for Cancellation <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Search
                                        size={16}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                    />
                                    <input
                                        type="text"
                                        value={reasonOpen ? reasonSearch : selectedReason || reasonSearch}
                                        onChange={(e) => {
                                            setReasonSearch(e.target.value);
                                            setReasonOpen(true);
                                            if (!e.target.value) setSelectedReason('');
                                        }}
                                        onFocus={() => setReasonOpen(true)}
                                        placeholder="e.g. Plan Dropped"
                                        className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                                        autoComplete="off"
                                    />
                                    <DropdownChevron
                                        open={reasonOpen}
                                        size={16}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                    />
                                </div>
                                {reasonOpen && (
                                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                        {filteredReasons.length === 0 ? (
                                            <p className="px-4 py-3 text-sm text-slate-400 italic">No matching reasons</p>
                                        ) : (
                                            filteredReasons.map((reason) => (
                                                <button
                                                    key={reason}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedReason(reason);
                                                        setReasonSearch(reason);
                                                        setReasonOpen(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-amber-50 transition-colors border-b border-slate-50 last:border-0 ${
                                                        selectedReason === reason ? 'bg-amber-50' : ''
                                                    }`}
                                                >
                                                    <span
                                                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                                            selectedReason === reason
                                                                ? 'border-amber-500'
                                                                : 'border-slate-300'
                                                        }`}
                                                    >
                                                        {selectedReason === reason && (
                                                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                        )}
                                                    </span>
                                                    {reason}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">
                                    Contact Reminder On{' '}
                                    <span className="text-slate-400 font-medium">(Optional)</span>
                                </label>
                                <div className="relative">
                                    <Calendar
                                        size={16}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                    />
                                    <input
                                        type="date"
                                        value={contactReminderOn}
                                        onChange={(e) => setContactReminderOn(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                                    Setup a reminder for contacting in case of postponing or rescheduling
                                    {contactReminderOn && (
                                        <span className="block text-amber-700 font-semibold mt-1">
                                            {formatReminderDisplay(contactReminderOn)}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">
                                Additional Notes/Comments
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={5}
                                placeholder="Internal notes about this cancellation..."
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                            />
                        </div>
                    </div>

                    <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/80 flex items-center gap-4 shrink-0">
                        <button
                            type="submit"
                            disabled={!selectedReason}
                            className="px-6 py-2.5 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-amber-950 font-bold text-sm rounded-lg shadow-sm transition-all"
                        >
                            Mark as Canceled
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                        >
                            Back
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CancelTripModal;
