import React from 'react';
import { FileText, MapPin, Sparkles } from 'lucide-react';
import QuoteTermsSection from './QuoteTermsSection';
import DropdownChevron from './DropdownChevron';
import type { QuoteTermsRecord } from '../utils/quoteTerms';

type Props = {
    termsOptions: QuoteTermsRecord[];
    selectedTermsId: string;
    onSelect: (termsId: string) => void;
    selectedTerms: QuoteTermsRecord | null;
    suggestedTermsId?: string;
    destinationLabel?: string;
};

const QuoteTermsSelector: React.FC<Props> = ({
    termsOptions,
    selectedTermsId,
    onSelect,
    selectedTerms,
    suggestedTermsId,
    destinationLabel,
}) => {
    const hasOptions = termsOptions.length > 0;

    return (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
                            <FileText size={18} />
                        </span>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                Terms &amp; conditions
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Choose which terms appear on this quotation and when shared with the customer.
                            </p>
                        </div>
                    </div>
                    {suggestedTermsId && selectedTermsId === suggestedTermsId && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-crm-50 text-crm-700 border border-crm-200">
                            <Sparkles size={11} />
                            Auto-matched
                            {destinationLabel ? ` · ${destinationLabel}` : ''}
                        </span>
                    )}
                </div>
            </div>

            <div className="p-5 space-y-4">
                {hasOptions ? (
                    <>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Select terms template
                            </label>
                            <div className="relative crm-select-wrap">
                                <select
                                    value={selectedTermsId}
                                    onChange={(e) => onSelect(e.target.value)}
                                    className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-crm-400/30 focus:border-crm-400 outline-none appearance-none cursor-pointer"
                                >
                                {termsOptions.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.title}
                                        {t.location ? ` — ${t.location}` : ''}
                                        {t.id === suggestedTermsId ? ' (suggested)' : ''}
                                        {t.isDefault ? ' · Default' : ''}
                                    </option>
                                ))}
                                </select>
                                <DropdownChevron
                                    size={16}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                />
                            </div>
                            {suggestedTermsId &&
                                selectedTermsId !== suggestedTermsId &&
                                termsOptions.some((t) => t.id === suggestedTermsId) && (
                                    <button
                                        type="button"
                                        onClick={() => onSelect(suggestedTermsId)}
                                        className="mt-2 text-xs font-bold text-crm-600 hover:text-crm-800"
                                    >
                                        Use suggested match for {destinationLabel || 'this destination'}
                                    </button>
                                )}
                        </div>

                        {selectedTerms && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1 font-semibold">
                                    <MapPin size={12} className="text-slate-400" />
                                    {selectedTerms.location}
                                </span>
                                {(selectedTerms.locations || []).length > 0 && (
                                    <span className="text-slate-400">
                                        Also: {(selectedTerms.locations || []).join(', ')}
                                    </span>
                                )}
                            </div>
                        )}

                        <QuoteTermsSection terms={selectedTerms} variant="compact" />
                    </>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                        <p className="text-sm text-slate-600 font-semibold">No terms templates found</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Add terms under Settings → Terms &amp; Conditions, then return here to select them.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default QuoteTermsSelector;
