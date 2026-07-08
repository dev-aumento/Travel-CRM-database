import React from 'react';
import { Check, Shield, Zap, Crown, Users, UserPlus, FileText, ChevronRight } from 'lucide-react';

import { useDatabase } from '../context/DatabaseContext';
import { resolveMainAgencyAgent } from '../utils/databaseSync';
import { buildApprovalPlanFields, sortPlansByPriceAsc } from '../utils/agentPlan';

const Plans = () => {
    const { db, updateRecord } = useDatabase();
    const userRole = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    const sessionAgentId = localStorage.getItem('agentId');

    const currentAgent = resolveMainAgencyAgent(db, {
        sessionAgentId,
        userEmail,
    });
    const currentAgentPlan = currentAgent?.plan || 'Lite';

    const [upgradingTo, setUpgradingTo] = React.useState<string | null>(null);
    const [showSuccess, setShowSuccess] = React.useState(false);
    const syncSubAgentPlans = (planName: string, planFields: Record<string, unknown> = {}) => {
        if (!currentAgent?.id) return;
        const subAgents = (db.travelAgents?.data || []).filter(
            (agent: any) => agent.parentId === currentAgent.id
        );
        subAgents.forEach((sub: any) => {
            updateRecord('travelAgents', sub.id, {
                plan: planName,
                ...planFields,
            });
        });
    };

    const handleUpgrade = (planName: string) => {
        if (userRole !== 'agent') {
            alert('Only Agency Owners can manage subscriptions.');
            return;
        }

        if (!currentAgent) {
            alert('Agency record not found. Please try logging in again.');
            return;
        }
        
        setUpgradingTo(planName);
        
        // Simulate a premium processing delay
        setTimeout(() => {
            try {
                if (currentAgent) {
                    const planFields = buildApprovalPlanFields(
                        { ...currentAgent, plan: planName, isTrial: false },
                        db.plans?.data || []
                    );
                    updateRecord('travelAgents', currentAgent.id, {
                        plan: planName,
                        planRenewedAt: new Date().toISOString(),
                        isTrial: false,
                        trialEndsAt: null,
                        ...planFields,
                    });
                    syncSubAgentPlans(planName, {
                        isTrial: false,
                        trialEndsAt: null,
                        ...planFields,
                    });
                    setShowSuccess(true);
                    // Hide success message after 3 seconds
                    setTimeout(() => setShowSuccess(false), 3000);
                }
            } catch (error) {
                console.error('Upgrade failed:', error);
                alert('Upgrade failed. Please try again.');
            } finally {
                setUpgradingTo(null);
            }
        }, 1500);
    };

    const handleStartTrial = (planName: string) => {
        if (!currentAgent) return;
        updateRecord('travelAgents', currentAgent.id, {
            plan: planName,
            isTrial: true,
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            planRenewedAt: new Date().toISOString(),
        });
        syncSubAgentPlans(planName, {
            isTrial: true,
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };
    const dbPlans = sortPlansByPriceAsc(db.plans?.data || []);
    
    const plans = dbPlans.map((p: any) => ({
        name: p.name,
        tagline: p.tagline,
        price: p.price,
        period: p.period,
        icon: p.name === 'Lite' ? <Zap className="text-blue-500" size={24} /> : 
              p.name === 'Growth' ? <Shield className="text-crm-600" size={24} /> : 
              <Crown className="text-amber-500" size={24} />,
        color: p.name === 'Lite' ? 'blue' : p.name === 'Growth' ? 'crm' : 'amber',
        popular: p.name === 'Growth',
        limits: {
            staff: p.staffLimit >= 9999 ? 'Unlimited' : p.staffLimit,
            subAgents: 'Unlimited',
            quotations: 'Unlimited'
        },
        features: (p.features || '').split(','),
        buttonText: `Upgrade to ${p.name}`
    }));

    return (
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
            {/* Premium Success Notification */}
            {showSuccess && (
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-500 fill-mode-forwards">
                    <div className="bg-slate-900 text-white px-8 py-4 rounded-[24px] shadow-2xl shadow-slate-900/40 flex items-center gap-4 border border-white/10 backdrop-blur-xl">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <Check className="text-white" size={20} strokeWidth={4} />
                        </div>
                        <div>
                            <p className="text-sm font-black tracking-tight">Success!</p>
                            <p className="text-[11px] text-slate-400 font-medium">Your plan has been updated successfully.</p>
                        </div>
                    </div>
                </div>
            )}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Subscription Plans</h1>
                <p className="text-slate-500">Manage your agency limits and choose the plan that scales with your team.</p>
            </div>

            {/* High-Impact Promo Banner */}
            <div className="mb-12 relative overflow-hidden bg-gradient-to-r from-crm-600 via-crm-700 to-indigo-800 rounded-[40px] shadow-2xl shadow-crm-500/30 group">
                {/* Content Container */}
                <div className="relative z-20 p-8 md:p-12 flex flex-col lg:flex-row items-center justify-between gap-10">
                    <div className="max-w-2xl text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6 border border-white/20 text-amber-300">
                            <Zap size={14} className="fill-current" /> Limited Time Promotion
                        </div>
                        <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-[1.1] tracking-tight">
                            Try Any Plan <span className="text-amber-400 underline underline-offset-8 decoration-white/20">Free for 30 Days</span>
                        </h2>
                        <p className="text-lg md:text-xl text-white/80 font-medium mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                            Experience the full power of our Growth or Enterprise tools with zero risk. No credit card required to start your journey.
                        </p>
                        <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                            <button 
                                onClick={() => handleStartTrial('Enterprise')}
                                className="px-10 py-5 bg-white text-crm-700 font-black rounded-2xl hover:bg-slate-50 transition-all shadow-xl shadow-slate-900/20 active:scale-95 text-sm uppercase tracking-wider"
                            >
                                Claim Enterprise Trial
                            </button>
                            <div className="flex items-center gap-3 px-6 py-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                                <Shield size={20} className="text-amber-400" />
                                <span className="text-sm font-bold text-white">Verified Secure Signup</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative hidden lg:block shrink-0 animate-in zoom-in duration-1000">
                        <div className="w-72 h-72 bg-white/10 rounded-full blur-3xl absolute -top-10 -right-10"></div>
                        <Crown size={220} className="text-white/10 rotate-12 group-hover:rotate-0 transition-all duration-700" />
                    </div>
                </div>
                
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-white/5 to-transparent skew-x-12 translate-x-1/4"></div>
                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-400/10 rounded-full blur-[120px]"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]"></div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 max-w-7xl mx-auto w-full pb-12">
                {plans.map((plan: any) => {
                    const isCurrent = currentAgentPlan === plan.name;
                    return (
                        <div 
                            key={plan.name}
                            className={`relative flex flex-col bg-white rounded-[32px] border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden ${plan.popular ? 'border-crm-500 shadow-xl shadow-crm-500/10' : 'border-slate-100 hover:border-slate-200'} ${isCurrent ? 'ring-4 ring-crm-500/10 border-crm-200 bg-slate-50/20' : ''}`}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 right-0">
                                    <div className="bg-crm-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl">
                                        Most Popular
                                    </div>
                                </div>
                            )}

                            {isCurrent && (
                                <div className="absolute top-0 left-0">
                                    <div className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-br-2xl flex items-center gap-1.5">
                                        <Check size={12} strokeWidth={4} /> Current Plan
                                    </div>
                                </div>
                            )}

                            {plan.name !== 'Lite' && !isCurrent && (
                                <div className="absolute top-0 left-0">
                                    <div className="bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-br-2xl flex items-center gap-1.5 animate-pulse">
                                        <Zap size={12} strokeWidth={4} fill="currentColor" /> 30 Day Trial Available
                                    </div>
                                </div>
                            )}

                            <div className="p-8">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 mt-4 ${
                                    plan.color === 'blue' ? 'bg-blue-50' : 
                                    plan.color === 'crm' ? 'bg-crm-50' : 'bg-amber-50'
                                }`}>
                                    {plan.icon}
                                </div>

                                <h3 className="text-2xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                                <p className="text-sm text-slate-500 mb-6 leading-relaxed">{plan.tagline}</p>

                                <div className="flex items-baseline gap-1 mb-8">
                                    <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                                    <span className="text-slate-400 font-medium">{plan.period}</span>
                                </div>

                                {/* Plan Regulation (Staff & Agents) */}
                                <div className="space-y-4 mb-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-xl text-slate-400 shadow-sm">
                                                <Users size={16} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-600">Team Staff</span>
                                        </div>
                                        <span className={`text-sm font-black ${plan.limits.staff === 'Unlimited' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                            {plan.limits.staff} Users
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-xl text-slate-400 shadow-sm">
                                                <UserPlus size={16} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-600">Sub-Agents</span>
                                        </div>
                                        <span className={`text-sm font-black ${plan.limits.subAgents === 'Unlimited' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                            {plan.limits.subAgents === 'Unlimited'
                                                ? 'Unlimited'
                                                : plan.limits.subAgents === 0
                                                  ? 'None'
                                                  : `${plan.limits.subAgents} Agents`}
                                        </span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => !isCurrent && !upgradingTo && handleUpgrade(plan.name)}
                                    disabled={!!upgradingTo}
                                    className={`w-full py-4 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 mb-3 ${
                                        isCurrent 
                                        ? 'bg-emerald-50 text-emerald-600 cursor-default border border-emerald-100' 
                                        : upgradingTo === plan.name
                                        ? 'bg-slate-200 text-slate-400 cursor-wait'
                                        : plan.popular
                                        ? 'bg-crm-600 text-white hover:bg-crm-700 shadow-lg shadow-crm-600/20 active:scale-[0.98]'
                                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 active:scale-[0.98]'
                                    }`}
                                >
                                    {isCurrent ? 'Your Active Plan' : upgradingTo === plan.name ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                            Processing...
                                        </div>
                                    ) : plan.buttonText}
                                    {!isCurrent && !upgradingTo && <ChevronRight size={18} />}
                                </button>

                                {!isCurrent && plan.name !== 'Lite' && (
                                    <button 
                                        onClick={() => handleStartTrial(plan.name)}
                                        className="w-full py-3 rounded-2xl font-bold text-xs text-crm-600 border-2 border-crm-100 hover:bg-crm-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Zap size={14} className="fill-current" /> Start 30-Day Free Trial
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 bg-slate-50/50 p-8 border-t border-slate-100">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">What's Included</h4>
                                <ul className="space-y-4">
                                    {plan.features.map((feature: any, i: number) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <div className="mt-1 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                                <Check className="text-emerald-600" size={12} strokeWidth={3} />
                                            </div>
                                            <span className="text-sm text-slate-600 font-medium leading-tight">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Help Section */}
            <div className="mt-4 p-8 bg-white border border-slate-100 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-6 max-w-7xl w-full mx-auto shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                        <FileText size={28} />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-800">Need a custom plan for your agency?</h4>
                        <p className="text-sm text-slate-500">If you have more than 50 staff members or unique requirements, we can build a tailor-made plan for you.</p>
                    </div>
                </div>
                <button className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all shrink-0">
                    Talk to Support
                </button>
            </div>
        </div>
    );
};

export default Plans;
