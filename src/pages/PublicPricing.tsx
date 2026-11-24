import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Crown, Users, UserPlus, ChevronRight } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { sortPlansByPriceAsc } from '../utils/agentPlan';
import { PLAN_FEATURES, getPlanFeatureKeys } from '../utils/planFeatures';
import {
    type BillingCycle,
    formatPlanPrice,
    getPlanPeriodLabel,
    getPlatformInrPerUsd,
    getYearlySavingsPercent,
    isFreePlan,
    useInrUsdRate,
    useViewerPlanCurrency,
} from '../utils/planPricing';
import { savePendingPlanSignup, clearPendingPlanSignup } from '../utils/pendingPlanSignup';
import { PLATFORM_NAME } from '../constants/platform';
import PlanCardSlider from '../components/PlanCardSlider';
import PlanFeatureList from '../components/PlanFeatureList';

const PublicPricing = () => {
    const navigate = useNavigate();
    const { db } = useDatabase();
    const [billingCycle, setBillingCycle] = React.useState<BillingCycle>('monthly');

    const { currency: viewerCurrency } = useViewerPlanCurrency();
    const { rate: usdPerInr, loading: rateLoading } = useInrUsdRate(getPlatformInrPerUsd(db));
    const planCurrency = viewerCurrency === 'USD' && usdPerInr == null && !rateLoading ? 'INR' : viewerCurrency;

    const plans = sortPlansByPriceAsc(db.plans?.data || []).map((p: any) => ({
        name: p.name,
        tagline: p.tagline,
        price: formatPlanPrice(p, planCurrency, usdPerInr, billingCycle),
        period: getPlanPeriodLabel(p, billingCycle),
        isFree: isFreePlan(p),
        yearlySavings: getYearlySavingsPercent(p),
        icon: p.name === 'Lite' ? <Zap className="text-blue-500" size={24} /> :
              p.name === 'Growth' ? <Shield className="text-crm-600" size={24} /> :
              <Crown className="text-amber-500" size={24} />,
        color: p.name === 'Lite' ? 'blue' : p.name === 'Growth' ? 'crm' : 'amber',
        popular: p.name === 'Growth',
        features: PLAN_FEATURES.filter((f) => getPlanFeatureKeys(p).has(f.key)).map((f) => f.label),
        includesStaff: getPlanFeatureKeys(p).has('teamStaff'),
        includesSubAgents: getPlanFeatureKeys(p).has('subAgents'),
    }));
    const maxYearlySavings = Math.max(0, ...plans.map((p) => p.yearlySavings));

    const choosePlan = (planName: string) => {
        if (localStorage.getItem('isAuthenticated') === 'true') {
            navigate('/plans');
            return;
        }
        savePendingPlanSignup({ planName, billingCycle });
        navigate(`/register?plan=${encodeURIComponent(planName)}&cycle=${billingCycle}`);
    };

    const startTrialRegistration = () => {
        clearPendingPlanSignup();
        navigate('/register');
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button type="button" onClick={() => navigate('/')} className="flex items-center" aria-label={PLATFORM_NAME}>
                        <img src="/crm-logo.png" alt={PLATFORM_NAME} className="h-9 object-contain" />
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-crm-700 hover:bg-crm-50"
                    >
                        Login
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Pricing</h1>
                    <p className="mt-2 text-slate-500">Choose a plan, create your agency account, and pay when you join.</p>
                </div>

                <div className="mb-12 relative overflow-hidden bg-gradient-to-r from-crm-600 via-crm-700 to-indigo-800 rounded-[40px] shadow-2xl shadow-crm-500/30">
                    <div className="relative z-20 p-8 md:p-12 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6 border border-white/20 text-amber-300">
                            <Zap size={14} className="fill-current" /> Limited Time Promotion
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-[1.1] tracking-tight">
                            Try Any Plan <span className="text-amber-400">Free for 30 Days</span>
                        </h2>
                        <p className="text-lg text-white/80 font-medium mb-8 max-w-xl mx-auto lg:mx-0">
                            Start with a trial and add a paid plan later. No payment is taken for the free trial.
                        </p>
                        <button
                            type="button"
                            onClick={startTrialRegistration}
                            className="px-10 py-5 bg-white text-crm-700 font-black rounded-2xl hover:bg-slate-50 transition-all shadow-xl active:scale-95 text-sm uppercase tracking-wider"
                        >
                            Start 30-Day Free Trial
                        </button>
                    </div>
                </div>

                <div className="flex justify-center mb-10">
                    <div className="inline-flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                        {(['monthly', 'yearly'] as const).map((cycle) => (
                            <button
                                key={cycle}
                                type="button"
                                onClick={() => setBillingCycle(cycle)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${billingCycle === cycle ? 'bg-white text-crm-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                                {cycle === 'yearly' && maxYearlySavings > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                                        Save up to {maxYearlySavings}%
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <PlanCardSlider className="w-full pb-12">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative flex flex-col bg-white rounded-[32px] border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden ${plan.popular ? 'border-crm-500 shadow-xl shadow-crm-500/10' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 right-0">
                                    <div className="bg-crm-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl">
                                        Most Popular
                                    </div>
                                </div>
                            )}
                            {!plan.isFree && (
                                <div className="absolute top-0 left-0">
                                    <div className="bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-br-2xl flex items-center gap-1.5">
                                        <Zap size={12} strokeWidth={4} fill="currentColor" /> Pay when you join
                                    </div>
                                </div>
                            )}

                            <div className="p-8">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 mt-2 ${
                                        plan.color === 'blue' ? 'bg-blue-50' : plan.color === 'crm' ? 'bg-crm-50' : 'bg-amber-50'
                                    }`}>
                                        {plan.icon}
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-800">{plan.name}</h3>
                                </div>
                                <p className="text-sm text-slate-500 mb-4 leading-relaxed">{plan.tagline}</p>
                                <div className="flex items-baseline gap-1 mb-5">
                                    <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                                    <span className="text-slate-400 font-medium">{plan.period}</span>
                                    <span className="ml-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">{planCurrency}</span>
                                </div>
                                {billingCycle === 'yearly' && plan.yearlySavings > 0 && (
                                    <p className="-mt-3 mb-6 text-xs font-bold text-emerald-600">
                                        Save {plan.yearlySavings}% vs. paying monthly
                                    </p>
                                )}

                                <div className="space-y-4 mb-6 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-xl text-slate-400 shadow-sm"><Users size={16} /></div>
                                            <span className="text-sm font-bold text-slate-600">Team Staff</span>
                                        </div>
                                        <span className={`text-sm font-black ${plan.includesStaff ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {plan.includesStaff ? 'Unlimited Users' : 'Not included'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-xl text-slate-400 shadow-sm"><UserPlus size={16} /></div>
                                            <span className="text-sm font-bold text-slate-600">Sub-Agents</span>
                                        </div>
                                        <span className={`text-sm font-black ${plan.includesSubAgents ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {plan.includesSubAgents ? 'Unlimited' : 'Not included'}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => choosePlan(plan.name)}
                                    className={`w-full py-4 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                                        plan.popular
                                            ? 'bg-crm-600 text-white hover:bg-crm-700 shadow-lg shadow-crm-600/20 active:scale-[0.98]'
                                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 active:scale-[0.98]'
                                    }`}
                                >
                                    Choose this plan
                                    <ChevronRight size={18} />
                                </button>
                            </div>

                            <div className="flex-1 bg-slate-50/50 p-8 border-t border-slate-100">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">What's Included</h4>
                                <PlanFeatureList features={plan.features} />
                            </div>
                        </div>
                    ))}
                </PlanCardSlider>
            </main>
        </div>
    );
};

export default PublicPricing;
