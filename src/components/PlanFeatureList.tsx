import React, { useState } from 'react';
import { Check } from 'lucide-react';

const VISIBLE_COUNT = 5;

const featureRow = (feature: string) => (
    <li key={feature} className="flex items-start gap-3">
        <div className="mt-1 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Check className="text-emerald-600" size={12} strokeWidth={3} />
        </div>
        <span className="text-sm text-slate-600 font-medium leading-tight">{feature}</span>
    </li>
);

const PlanFeatureList = ({ features }: { features: string[] }) => {
    const [expanded, setExpanded] = useState(false);
    const hiddenCount = Math.max(0, features.length - VISIBLE_COUNT);
    const preview = features.slice(0, VISIBLE_COUNT);
    const rest = features.slice(VISIBLE_COUNT);

    return (
        <div>
            <ul className="space-y-4">
                {preview.map(featureRow)}
                {rest.map((feature) => (
                    <li
                        key={feature}
                        className={`items-start gap-3 ${expanded ? 'flex' : 'hidden xl:flex'}`}
                    >
                        <div className="mt-1 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <Check className="text-emerald-600" size={12} strokeWidth={3} />
                        </div>
                        <span className="text-sm text-slate-600 font-medium leading-tight">{feature}</span>
                    </li>
                ))}
            </ul>
            {hiddenCount > 0 && (
                <div className="mt-4 flex justify-center xl:hidden">
                    <button
                        type="button"
                        onClick={() => setExpanded((open) => !open)}
                        className="text-sm font-bold text-crm-600 hover:text-crm-700"
                    >
                        {expanded ? 'Show less' : `+ more ${hiddenCount}`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default PlanFeatureList;
