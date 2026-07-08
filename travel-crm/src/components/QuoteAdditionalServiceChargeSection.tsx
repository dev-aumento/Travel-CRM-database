import React from 'react';
import { Percent, Receipt } from 'lucide-react';
import { useCurrency } from '../hooks/useCurrency';

export type AdditionalServiceChargeForm = {
    enabled: boolean;
    percent: number;
    fixedAmount: number;
    gstEnabled: boolean;
    gstPercent: number;
};

type Props = {
    value: AdditionalServiceChargeForm;
    onChange: (next: AdditionalServiceChargeForm) => void;
    servicesTotal: number;
    chargeAmount: number;
    gstAmount?: number;
};

const QuoteAdditionalServiceChargeSection: React.FC<Props> = ({
    value,
    onChange,
    servicesTotal,
    chargeAmount,
    gstAmount = 0,
}) => {
    const { formatMoney } = useCurrency();

    return (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-crm-600 shrink-0">
                        <Receipt size={16} />
                    </span>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                            Additional Service Charge
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Add percentage or fixed amount
                        </p>
                    </div>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                        Apply charge
                    </span>
                    <input
                        type="checkbox"
                        checked={value.enabled}
                        onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-crm-600 focus:ring-crm-400"
                    />
                </label>
            </div>

            <div className="p-5 space-y-4">
                {value.enabled ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    Percentage (%)
                                </label>
                                <div className="relative">
                                    <Percent
                                        size={14}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.1}
                                        value={value.percent || ''}
                                        onChange={(e) =>
                                            onChange({
                                                ...value,
                                                percent: Math.max(0, Number(e.target.value) || 0),
                                            })
                                        }
                                        placeholder="e.g. 5"
                                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-crm-400/30 focus:border-crm-400 outline-none"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Calculated on services total ({formatMoney(servicesTotal)})
                                </p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    Fixed amount
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={value.fixedAmount || ''}
                                    onChange={(e) =>
                                        onChange({
                                            ...value,
                                            fixedAmount: Math.max(0, Number(e.target.value) || 0),
                                        })
                                    }
                                    placeholder="e.g. 5000"
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 tabular-nums text-right focus:ring-2 focus:ring-crm-400/30 focus:border-crm-400 outline-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Used when no percentage is set
                                </p>
                            </div>
                        </div>

                        {chargeAmount > 0 && (
                            <div className="flex items-center justify-between gap-3 rounded-xl bg-crm-50 border border-crm-100 px-4 py-3">
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                    Charge amount
                                </span>
                                <span className="text-sm font-black text-crm-700">
                                    {formatMoney(chargeAmount)}
                                </span>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-slate-400 italic">
                        Enable the charge and enter a percentage or a fixed amount on the
                        services total. If both are entered, the percentage is used.
                    </p>
                )}

                <div className="pt-4 border-t border-slate-100 space-y-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={value.gstEnabled}
                            onChange={(e) =>
                                onChange({ ...value, gstEnabled: e.target.checked })
                            }
                            className="w-4 h-4 rounded border-slate-300 text-crm-600 focus:ring-crm-400"
                        />
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                            Apply GST
                        </span>
                    </label>

                    {value.gstEnabled && (
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                GST percentage (%)
                            </label>
                            <div className="relative max-w-xs">
                                <Percent
                                    size={14}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={value.gstPercent || ''}
                                    onChange={(e) =>
                                        onChange({
                                            ...value,
                                            gstPercent: Math.max(0, Number(e.target.value) || 0),
                                        })
                                    }
                                    placeholder="e.g. 18"
                                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-crm-400/30 focus:border-crm-400 outline-none"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                                Calculated on additional service charge only
                                {chargeAmount > 0
                                    ? ` (${formatMoney(chargeAmount)})`
                                    : ' — enable a service charge first'}
                            </p>
                            {gstAmount > 0 && (
                                <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 mt-3">
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                        GST amount
                                    </span>
                                    <span className="text-sm font-black text-emerald-700">
                                        {formatMoney(gstAmount)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default QuoteAdditionalServiceChargeSection;

export const normalizeAdditionalServiceCharge = (
    raw: unknown
): AdditionalServiceChargeForm => {
    if (!raw || typeof raw !== 'object') {
        return { enabled: false, percent: 0, fixedAmount: 0, gstEnabled: false, gstPercent: 0 };
    }
    const row = raw as Record<string, unknown>;
    return {
        enabled: Boolean(row.enabled),
        percent: Math.max(0, Number(row.percent) || 0),
        fixedAmount: Math.max(0, Number(row.fixedAmount) || 0),
        gstEnabled: Boolean(row.gstEnabled),
        gstPercent: Math.max(0, Number(row.gstPercent) || 0),
    };
};

export const buildAdditionalServiceChargePayload = (
    form: AdditionalServiceChargeForm
) => ({
    enabled: form.enabled,
    percent: form.enabled ? Math.max(0, Number(form.percent) || 0) : 0,
    fixedAmount: form.enabled ? Math.max(0, Number(form.fixedAmount) || 0) : 0,
    gstEnabled: form.gstEnabled,
    gstPercent: form.gstEnabled ? Math.max(0, Number(form.gstPercent) || 0) : 0,
});
