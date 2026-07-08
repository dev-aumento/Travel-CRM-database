import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useCurrency } from '../hooks/useCurrency';

export type HotelSpecialInclusion = {
    id: string;
    name: string;
    amount?: number;
};

type Props = {
    inclusions: HotelSpecialInclusion[];
    onChange: (inclusions: HotelSpecialInclusion[]) => void;
    /** `night` — compact block under a single night row; `stay` — full section under a hotel stay */
    variant?: 'stay' | 'night';
};

const newInclusion = (): HotelSpecialInclusion => ({
    id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    amount: undefined,
});

const HotelSpecialInclusionsSection: React.FC<Props> = ({
    inclusions,
    onChange,
    variant = 'stay',
}) => {
    const { currencySymbol, formatInputValue, parseInputValue, priceInputStep } = useCurrency();
    const isNight = variant === 'night';
    const addService = () => onChange([...inclusions, newInclusion()]);

    const updateService = (id: string, patch: Partial<HotelSpecialInclusion>) => {
        onChange(inclusions.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    };

    const removeService = (id: string) => {
        onChange(inclusions.filter((row) => row.id !== id));
    };

    return (
        <div
            className={
                isNight
                    ? 'mt-2 pt-2 border-t border-dashed border-slate-200'
                    : 'border-t border-slate-200 bg-slate-50/40 px-4 py-4'
            }
        >
            {!isNight && (
                <>
                    <h4 className="text-sm font-bold text-slate-800">Any special inclusions in hotels</h4>
                    <p className="text-xs text-slate-500 mt-1">
                        Add any extra services for hotels e.g. special dinner, honeymoon cake etc.
                    </p>
                </>
            )}

            {inclusions.length > 0 && (
                <div className={isNight ? 'space-y-1.5' : 'mt-3 space-y-2'}>
                    {inclusions.map((row) => (
                        <div
                            key={row.id}
                            className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg p-2"
                        >
                            <input
                                type="text"
                                value={row.name}
                                onChange={(e) => updateService(row.id, { name: e.target.value })}
                                placeholder="e.g. Honeymoon cake, candlelight dinner"
                                className="flex-1 min-w-[180px] px-2.5 py-1.5 border border-slate-200 rounded-md text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-crm-400"
                            />
                            <div className="relative crm-price-field-wrap shrink-0">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                                    {currencySymbol}
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    step={priceInputStep}
                                    value={formatInputValue(row.amount || 0)}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        updateService(row.id, {
                                            amount: raw === '' ? undefined : parseInputValue(raw),
                                        });
                                    }}
                                    placeholder="Cost"
                                    className="crm-price-field pl-6 pr-2 py-1.5 border border-slate-200 rounded-md text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-crm-400"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => removeService(row.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50"
                                title="Remove service"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <button
                type="button"
                onClick={addService}
                className={`inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 ${
                    isNight ? 'mt-1.5 text-[10px]' : 'mt-3 text-sm'
                }`}
            >
                <Plus size={isNight ? 12 : 14} strokeWidth={2.5} />
                Add Service
            </button>
        </div>
    );
};

export default HotelSpecialInclusionsSection;
