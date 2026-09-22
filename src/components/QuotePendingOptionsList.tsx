import React from 'react';
import { FileText, Send, Sparkles } from 'lucide-react';
import { useCurrency } from '../hooks/useCurrency';

export type PendingQuoteRow = {
    id: string;
    version: string;
    destination?: string;
    duration?: string;
    total: number;
    date?: string;
    isDraft?: boolean;
    optionIndex?: number;
};

type Props = {
    customerName: string;
    quotes: PendingQuoteRow[];
};

const QuotePendingOptionsList: React.FC<Props> = ({ customerName, quotes }) => {
    const { formatMoney } = useCurrency();
    if (quotes.length === 0) return null;

    return (
        <section className="bg-white border border-crm-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 bg-crm-50/80 border-b border-crm-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-crm-600 text-white flex items-center justify-center shrink-0">
                        <Send size={18} />
                    </span>
                    <div className="min-w-0">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                            Ready to send
                        </h3>
                        <p className="text-xs text-slate-500 truncate">
                            {quotes.length} quotation{quotes.length !== 1 ? 's' : ''} for{' '}
                            <span className="font-semibold text-slate-700">{customerName}</span>
                        </p>
                    </div>
                </div>
            </div>
            <ul className="divide-y divide-slate-100">
                {quotes.map((q, idx) => (
                    <li
                        key={q.id}
                        className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 ${
                            q.isDraft ? 'bg-amber-50/50' : 'bg-white'
                        }`}
                    >
                        <div className="flex items-start gap-3 min-w-0">
                            <span
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                    q.isDraft
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                            >
                                {q.optionIndex ?? idx + 1}
                            </span>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-black text-slate-800">
                                        Option {q.optionIndex ?? idx + 1}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                        v{q.version}
                                    </span>
                                    {q.isDraft && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                            <Sparkles size={10} />
                                            Current (review)
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                                    <FileText size={12} className="shrink-0 text-slate-400" />
                                    {q.destination || 'Package'}
                                    {q.duration ? ` · ${q.duration}` : ''}
                                </p>
                                {q.date && (
                                    <p className="text-[10px] text-slate-400 mt-0.5">Departure {q.date}</p>
                                )}
                            </div>
                        </div>
                        <p className="text-base font-black text-crm-700 shrink-0">{formatMoney(q.total || 0)}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default QuotePendingOptionsList;
