import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Crown } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { isMainAgencyOwnerSession } from '../utils/databaseSync';
import { PLAN_FEATURE_LABELS, type PlanFeatureKey } from '../utils/planFeatures';

interface PlanFeatureLockedProps {
    features: PlanFeatureKey[];
    /** Compact inline notice instead of a full-page block */
    inline?: boolean;
}

/** Shown in place of a module or action that the agency's subscription plan doesn't include. */
const PlanFeatureLocked: React.FC<PlanFeatureLockedProps> = ({ features, inline = false }) => {
    const { db } = useDatabase();
    const canUpgrade = isMainAgencyOwnerSession(
        localStorage.getItem('userRole') || '',
        localStorage.getItem('agentId'),
        db
    );
    const featureName = features.map((key) => PLAN_FEATURE_LABELS[key]).join(' / ');
    const message = canUpgrade
        ? 'Upgrade your subscription to unlock it.'
        : 'Ask your agency owner to upgrade the subscription to unlock it.';

    if (inline) {
        return (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm">
                <Lock size={16} className="text-amber-600 shrink-0" />
                <p className="text-amber-800 font-medium flex-1">
                    <b>{featureName}</b> isn't included in your current plan. {message}
                </p>
                {canUpgrade && (
                    <Link to="/plans" className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold whitespace-nowrap hover:bg-slate-800">
                        View Plans
                    </Link>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-[2rem] shadow-xl shadow-slate-200/50 p-10 text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-50 flex items-center justify-center">
                    <Lock size={28} className="text-amber-500" />
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2">Not included in your plan</h2>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                    <b className="text-slate-700">{featureName}</b> isn't part of your current subscription. {message}
                </p>
                {canUpgrade && (
                    <Link
                        to="/plans"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all"
                    >
                        <Crown size={16} /> View Plans
                    </Link>
                )}
            </div>
        </div>
    );
};

export default PlanFeatureLocked;
