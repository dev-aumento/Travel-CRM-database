import React from 'react';
import {
    formatAgencyBankDetailsLines,
    hasAgencyBankDetails,
    type AgencyBankDetails,
} from '../utils/agencyBankDetails';
import { usePlanFeatures } from '../utils/planFeatures';

type Props = {
    details?: AgencyBankDetails | null;
    className?: string;
    /** Compact styling for invoices / print PDFs */
    variant?: 'print' | 'screen';
};

/** Renders agency bank details at the end of quotes/invoices (not hotel vouchers). */
const AgencyBankDetailsBlock: React.FC<Props> = ({
    details,
    className = '',
    variant = 'print',
}) => {
    const { hasFeature } = usePlanFeatures();
    if (!hasFeature('bankDetails') || !hasAgencyBankDetails(details)) return null;
    const lines = formatAgencyBankDetailsLines(details);

    if (variant === 'screen') {
        return (
            <div className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Bank details
                </p>
                <ul className="space-y-1">
                    {lines.map((line) => (
                        <li key={line} className="text-xs font-semibold text-slate-700">
                            {line}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <div
            className={`print-break-avoid mt-10 pt-6 border-t border-slate-200 ${className}`}
        >
            <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-3">
                Bank details
            </p>
            <ul className="space-y-1.5">
                {lines.map((line) => (
                    <li
                        key={line}
                        className="text-[11px] font-bold text-slate-700 tracking-wide"
                    >
                        {line}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default AgencyBankDetailsBlock;
