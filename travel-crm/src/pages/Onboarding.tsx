import React, { useState } from 'react';
import { Building2, Globe, Mail, MapPin, CheckCircle2, ArrowRight, Loader2, ShieldCheck, LogOut } from 'lucide-react';
import DropdownChevron from '../components/DropdownChevron';
import { useDatabase } from '../context/DatabaseContext';
import { PENDING_AGENT_ONBOARDING_KEY } from '../utils/databaseSync';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../utils/currency';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from '../utils/timezoneData';

interface OnboardingProps {
    userEmail: string;
    onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ userEmail, onComplete }) => {
    const { addRecord } = useDatabase();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const [form, setForm] = useState({
        agencyName: '',
        supportEmail: userEmail,
        agencyAddress: '',
        currency: DEFAULT_CURRENCY,
        timezone: DEFAULT_TIMEZONE,
        businessType: 'Agency'
    });

    const handleLogout = () => {
        localStorage.clear();
        window.location.reload();
    };

    const handleNext = () => {
        if (step < 3) setStep(step + 1);
        else handleFinish();
    };

    const handleFinish = () => {
        setIsLoading(true);
        // Simulate saving
        setTimeout(() => {
            addRecord('settings', {
                id: `SET-${Date.now()}`,
                email: userEmail,
                agencyName: form.agencyName,
                supportEmail: form.supportEmail,
                agencyAddress: form.agencyAddress,
                currency: form.currency,
                timezone: form.timezone
            });
            localStorage.removeItem(PENDING_AGENT_ONBOARDING_KEY);
            setIsLoading(false);
            onComplete();
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-crm-100/20 via-slate-50 to-white font-sans">
            <div className="w-full max-w-2xl">
                {/* Header with Logout */}
                <div className="flex justify-between items-center mb-12">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-crm-600 rounded-xl flex items-center justify-center shadow-lg shadow-crm-200">
                            <ShieldCheck className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Agency Setup</h2>
                            <p className="text-sm text-slate-500">Configure your workspace</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-400 hover:text-red-500 transition-colors group"
                    >
                        <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                        Sign Out
                    </button>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden transition-all duration-500">
                    {/* Progress Indicator */}
                    <div className="h-2 bg-slate-100 w-full overflow-hidden">
                        <div 
                            className="h-full bg-crm-600 transition-all duration-1000 ease-out" 
                            style={{ width: `${(step / 3) * 100}%` }}
                        />
                    </div>

                    <div className="p-10">
                        <div className="mb-8">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-crm-600 mb-2 block">Step {step} of 3</span>
                            <h3 className="text-2xl font-bold text-slate-800">
                                {step === 1 && 'Your Agency Basics'}
                                {step === 2 && 'Business Location'}
                                {step === 3 && 'Regional Preferences'}
                            </h3>
                        </div>

                        {step === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <p className="text-slate-500">Let's start with the name of your travel business.</p>
                                <div className="space-y-4 pt-4">
                                    <div className="group">
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Agency Name</label>
                                        <div className="relative">
                                            <Building2 className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-crm-600 transition-colors" size={20} />
                                            <input 
                                                type="text" 
                                                value={form.agencyName}
                                                onChange={(e) => setForm({ ...form, agencyName: e.target.value })}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-crm-500 focus:ring-4 focus:ring-crm-500/10 outline-none transition-all font-medium"
                                                placeholder="e.g. Wanderlust Holidays"
                                            />
                                        </div>
                                    </div>
                                    <div className="group">
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Support Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-3.5 text-slate-400" size={20} />
                                            <input 
                                                type="email" 
                                                value={form.supportEmail}
                                                readOnly
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-slate-500 cursor-not-allowed font-medium"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2 font-medium italic">This email will be shown on your quotations.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <p className="text-slate-500">Where is your primary office located?</p>
                                <div className="pt-4">
                                    <div className="group">
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Full Office Address</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-4 top-4 text-slate-400 group-focus-within:text-crm-600 transition-colors" size={20} />
                                            <textarea 
                                                rows={3}
                                                value={form.agencyAddress}
                                                onChange={(e) => setForm({ ...form, agencyAddress: e.target.value })}
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-crm-500 focus:ring-4 focus:ring-crm-500/10 outline-none transition-all font-medium resize-none"
                                                placeholder="Enter full address with City and Pincode"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <p className="text-slate-500">Set your default currency and timezone for reports and quotations.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                    <div className="group">
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Default Currency</label>
                                        <div className="relative crm-select-wrap">
                                            <Globe className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-crm-600 transition-colors" size={20} />
                                            <select 
                                                value={form.currency}
                                                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                                                className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-crm-500 focus:ring-4 focus:ring-crm-500/10 outline-none transition-all font-medium appearance-none cursor-pointer">
                                                {CURRENCY_OPTIONS.map((option) => (
                                                    <option key={option.code} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <DropdownChevron size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="group">
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Local Timezone</label>
                                        <div className="relative crm-select-wrap">
                                            <Globe className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-crm-600 transition-colors" size={20} />
                                            <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-crm-500 focus:ring-4 focus:ring-crm-500/10 outline-none transition-all font-medium appearance-none cursor-pointer">
                                                {TIMEZONE_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <DropdownChevron size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-12 flex items-center justify-between">
                            <button 
                                onClick={() => step > 1 && setStep(step - 1)}
                                className={`px-6 py-3 font-black uppercase tracking-widest text-xs text-slate-400 hover:text-slate-800 transition-colors ${step === 1 ? 'invisible' : 'visible'}`}
                            >
                                Back
                            </button>
                            <button 
                                onClick={handleNext}
                                disabled={isLoading || (step === 1 && !form.agencyName) || (step === 2 && !form.agencyAddress)}
                                className="px-8 py-4 bg-crm-600 hover:bg-crm-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl flex items-center gap-3 shadow-xl shadow-crm-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Saving Profile...
                                    </>
                                ) : (
                                    <>
                                        {step === 3 ? 'Complete Setup' : 'Next Step'}
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-50 px-10 py-6 border-t border-slate-100 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <CheckCircle2 size={20} />
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
                            Your information is encrypted and securely stored. You can update these details anytime from the Platform Settings menu.
                        </p>
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 3s ease-in-out infinite;
                }
            ` }} />
        </div>
    );
};

export default Onboarding;