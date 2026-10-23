import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PLATFORM_NAME } from '../constants/platform';
import { User, Mail, Lock, LogIn, ArrowRight, Key, Shield, X, AlertCircle, Globe, Settings, Users, ChevronRight, LayoutDashboard, UserPlus, Briefcase, ChevronLeft, Zap } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import {
    agentLoginEmail,
    findMainAgentByCredentials,
    findStaffMemberByCredentials,
    findSubAgentByCredentials,
    findTravelAgentByCredentials,
    getAgencyDisabledLoginBlockReason,
    getDisabledLoginBlockReason,
    getDisabledStaffLoginBlockReason,
    getPlanExpiryLoginBlockReason,
    LOGIN_BLOCK_REASON_KEY,
    normalizeLoginEmail,
} from '../utils/authLogin';
import { getAssignedPermissions, SUB_AGENT_STAFF_PERMISSIONS } from '../utils/permissions';

interface LoginProps {
    onLogin: (
        email: string,
        role: 'admin' | 'agent' | 'staff',
        agentId?: string,
        options?: {
            requireOnboarding?: boolean;
            permissions?: import('../utils/permissions').PermissionKey[];
            sessionUserId?: string;
        }
    ) => void;
    initialPortal?: 'admin' | null;
}

type AuthMode = 'portal_selection' | 'login' | 'register' | 'forgot' | 'otp' | 'staff_login';
type PortalType = 'admin' | 'agent' | null;

const Login: React.FC<LoginProps> = ({ onLogin, initialPortal = null }) => {
    const navigate = useNavigate();
    const { db, addRecord, getNextId, mongoConnected } = useDatabase();
    const [mode, setMode] = useState<AuthMode>(initialPortal ? 'login' : 'portal_selection');
    const [portalType, setPortalType] = useState<PortalType>(initialPortal);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState<string | null>(
        () => sessionStorage.getItem(LOGIN_BLOCK_REASON_KEY)
    );
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [devOtp, setDevOtp] = useState<string | null>(null);

    React.useEffect(() => {
        if (sessionStorage.getItem(LOGIN_BLOCK_REASON_KEY)) {
            sessionStorage.removeItem(LOGIN_BLOCK_REASON_KEY);
        }
    }, []);

    const rejectExpiredPlanLogin = (agents: any[], sessionAgentId: string) => {
        const blockReason = getPlanExpiryLoginBlockReason(agents, sessionAgentId);
        if (blockReason) {
            setError(blockReason);
            setIsLoading(false);
            return true;
        }
        return false;
    };

    const rejectDisabledAgencyLogin = (sessionAgentId: string) => {
        const blockReason = getAgencyDisabledLoginBlockReason(db, sessionAgentId);
        if (blockReason) {
            setError(blockReason);
            setIsLoading(false);
            return true;
        }
        return false;
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        setTimeout(() => {
            if (portalType === 'admin') {
                if (email === 'admin@aumento.com' && password === 'admin123') {
                    onLogin(email, 'admin');
                } else {
                    setError('Invalid Admin credentials. Use admin@aumento.com / admin123 on the Master Admin login page.');
                    setIsLoading(false);
                }
                return;
            }

            const agents = db?.travelAgents?.data || [];

            if (agents.length === 0) {
                setError(
                    mongoConnected
                        ? 'No travel agents found. Register as a new agent or contact your administrator.'
                        : 'Cannot reach the database. Check your connection and refresh this page.'
                );
                setIsLoading(false);
                return;
            }

            if (normalizeLoginEmail(email) === 'admin@aumento.com') {
                setError('Admin accounts must use the Master Admin login page (/admin/login), not the Agent Portal.');
                setIsLoading(false);
                return;
            }

            const disabledReason = getDisabledLoginBlockReason(agents, email, password);
            if (disabledReason) {
                setError(disabledReason);
                setIsLoading(false);
                return;
            }

            const agent = findTravelAgentByCredentials(agents, email, password);

            if (agent) {
                const loginEmail = agentLoginEmail(agent) || normalizeLoginEmail(agent.email);
                if (rejectDisabledAgencyLogin(agent.id)) return;
                if (rejectExpiredPlanLogin(agents, agent.id)) return;

                if (agent.parentId) {
                    onLogin(loginEmail, 'staff', agent.id, {
                        permissions: getAssignedPermissions(agent.permissions),
                        sessionUserId: agent.id,
                    });
                } else {
                    onLogin(loginEmail, 'agent', agent.id, { sessionUserId: agent.id });
                }
                return;
            }

            setError('Invalid Agent credentials. Please check your email and password.');
            setIsLoading(false);
        }, 1500);
    };

    const handleStaffLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        
        setTimeout(() => {
            const agents = db?.travelAgents?.data || [];
            const staff = db?.staff?.data || [];

            const disabledReason = getDisabledStaffLoginBlockReason(
                agents,
                staff,
                employeeId,
                password
            );
            if (disabledReason) {
                setError(disabledReason);
                setIsLoading(false);
                return;
            }

            const member = findStaffMemberByCredentials(staff, employeeId, password);
            if (member) {
                if (rejectDisabledAgencyLogin(member.agentId)) return;
                if (rejectExpiredPlanLogin(agents, member.agentId)) return;
                onLogin(member.employeeId, 'staff', member.agentId, {
                    permissions: getAssignedPermissions(member.permissions),
                    sessionUserId: member.id,
                });
                return;
            }

            const subAgent = findSubAgentByCredentials(agents, employeeId, password);
            if (subAgent) {
                if (rejectDisabledAgencyLogin(subAgent.id)) return;
                if (rejectExpiredPlanLogin(agents, subAgent.id)) return;
                onLogin(agentLoginEmail(subAgent), 'staff', subAgent.id, {
                    permissions: getAssignedPermissions(subAgent.permissions),
                    sessionUserId: subAgent.id,
                });
                return;
            }

            const mainAgent = findMainAgentByCredentials(agents, employeeId, password);
            if (mainAgent) {
                if (rejectDisabledAgencyLogin(mainAgent.id)) return;
                if (rejectExpiredPlanLogin(agents, mainAgent.id)) return;
                onLogin(agentLoginEmail(mainAgent), 'agent', mainAgent.id, {
                    sessionUserId: mainAgent.id,
                });
                return;
            }

            const inactiveStaff = staff.find(
                (s: any) =>
                    normalizeLoginEmail(s?.employeeId) === normalizeLoginEmail(employeeId) &&
                    String(s?.password || '').trim() === password.trim()
            );
            if (inactiveStaff) {
                setError('Access Denied. Your staff account has been deactivated by your agent.');
                setIsLoading(false);
                return;
            }

            setError('Invalid Employee ID or Password.');
            setIsLoading(false);
        }, 1500);
    };

    const handleRegister = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        if (password !== confirmPassword) { setError('Passwords do not match.'); setIsLoading(false); return; }
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        setTimeout(() => { setMode('otp'); setDevOtp(newOtp); setIsLoading(false); setSuccessMessage(`Security code sent to ${email}`); }, 1500);
    };

    const handleVerifyOtp = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const enteredOtp = otp.join('');
        if (enteredOtp !== devOtp) { setError('Invalid code.'); setIsLoading(false); return; }
        setTimeout(() => {
            const newId = getNextId('travelAgents', 'AGT');
            const normalizedEmail = email.trim().toLowerCase();
            const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            addRecord('travelAgents', {
                id: newId,
                name,
                email: normalizedEmail,
                password,
                status: 'approved',
                joinedDate: new Date().toISOString().split('T')[0],
                businessName: `${name} Agencies`,
                plan: 'Lite',
                isTrial: true,
                trialEndsAt,
                parentId: null,
            });
            setIsLoading(false);
            setDevOtp(null);
            onLogin(normalizedEmail, 'agent', newId, {
                requireOnboarding: true,
                sessionUserId: newId,
            });
        }, 1500);
    };

    const selectPortal = (type: PortalType) => {
        setPortalType(type);
        setMode('login');
        setError(null);
        setSuccessMessage(null);
    };

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) value = value[value.length - 1];
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
    };

    if (mode === 'portal_selection') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-crm-100/20 via-slate-50 to-white">
                <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-crm-600 rounded-3xl shadow-2xl shadow-crm-200 mb-6">
                        <Shield className="text-white" size={40} />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">{PLATFORM_NAME}</h1>
                    <p className="text-slate-500 font-semibold text-lg">Identity Access Management</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
                    <button onClick={() => selectPortal('agent')} className="group relative bg-white p-10 rounded-[2.5rem] border-2 border-transparent hover:border-crm-500 shadow-xl shadow-slate-200/50 transition-all duration-500 hover:-translate-y-2 text-left overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-crm-50 rounded-full -mr-16 -mt-16 group-hover:bg-crm-100 transition-colors" />
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-crm-600 text-white rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                                <Users size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-3">Agent Portal</h3>
                            <p className="text-slate-500 font-medium leading-relaxed mb-8">Travel design tools, lead management, and staff administration.</p>
                            <div className="flex items-center text-crm-600 font-bold">Enter Agent <ChevronRight size={20} className="ml-1" /></div>
                        </div>
                    </button>

                    <button onClick={() => { setPortalType('agent'); setMode('staff_login'); }} className="group relative bg-white p-10 rounded-[2.5rem] border-2 border-transparent hover:border-slate-900 shadow-xl shadow-slate-200/50 transition-all duration-500 hover:-translate-y-2 text-left overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:bg-slate-100 transition-colors" />
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-slate-800 text-white rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                                <Briefcase size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-3">Staff Entrance</h3>
                            <p className="text-slate-500 font-medium leading-relaxed mb-8">Login with your Employee ID and access your assigned workspace.</p>
                            <div className="flex items-center text-crm-600 font-bold">Enter Staff <ChevronRight size={20} className="ml-1" /></div>
                        </div>
                    </button>
                </div>

                <div className="mt-12 max-w-4xl w-full px-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                    <div className="bg-gradient-to-r from-crm-600 to-indigo-700 rounded-[32px] p-8 text-white flex flex-col lg:flex-row items-center justify-between gap-6 shadow-2xl shadow-crm-200/50 relative overflow-hidden group">
                        <div className="relative z-10 flex items-center gap-6">
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
                                <Zap className="text-amber-400 fill-current" size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">New Agency? Experience Enterprise for Free!</h3>
                                <p className="text-sm text-white/80">Start your 30-day trial today and unlock unlimited staff, sub-agents, and advanced tools.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => { setPortalType('agent'); setMode('register'); }}
                            className="relative z-10 px-8 py-4 bg-white text-crm-600 font-black rounded-xl hover:bg-slate-50 transition-all shadow-lg active:scale-95 whitespace-nowrap"
                        >
                            Start 30-Day Free Trial
                        </button>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-white/10 transition-colors"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-700 ${portalType === 'admin' ? 'bg-slate-900' : 'bg-slate-50'} font-sans`}>
            <div className="w-full max-w-md relative">
                {/* Prominent Back Button */}
                <button 
                    onClick={() => {
                        if (portalType === 'admin') {
                            navigate('/');
                            return;
                        }
                        setMode('portal_selection');
                    }}
                    className={`absolute -top-12 left-0 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] transition-all hover:-translate-x-1 ${portalType === 'admin' ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
                >
                    <ChevronLeft size={16} /> Switch Portal
                </button>

                {devOtp && (
                    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right-full duration-500 max-w-sm">
                        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-md">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-crm-500 flex items-center justify-center shrink-0"><Mail className="text-white" size={20} /></div>
                                <div>
                                    <h4 className="font-bold text-sm">Auth Notification (Dev)</h4>
                                    <div className="mt-3 bg-white/10 p-3 rounded-lg"><p className="text-2xl font-black tracking-[0.2em] text-crm-400">{devOtp}</p></div>
                                </div>
                                <button onClick={() => setDevOtp(null)}><X size={16} /></button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="text-center mb-8 animate-in fade-in zoom-in duration-500">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg mb-4 ${portalType === 'admin' ? 'bg-white text-slate-900' : 'bg-crm-600 text-white shadow-crm-200'}`}>
                        {portalType === 'admin' ? <LayoutDashboard size={32} /> : <Users size={32} />}
                    </div>
                    <h1 className={`text-3xl font-black tracking-tight ${portalType === 'admin' ? 'text-white' : 'text-slate-900'}`}>{PLATFORM_NAME}</h1>
                    <p className={`mt-2 font-bold uppercase tracking-widest text-xs ${portalType === 'admin' ? 'text-crm-400' : 'text-slate-500'}`}>
                        {mode === 'staff_login' ? 'Staff Entry Terminal' : portalType === 'admin' ? 'System Administrator' : 'Licensed Agent'}
                    </p>
                </div>

                <div className={`rounded-[2.5rem] border shadow-2xl overflow-hidden transition-all duration-500 ${portalType === 'admin' ? 'bg-slate-800/50 border-white/10 backdrop-blur-xl' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                    <div className="p-10">
                        <div className="mb-10">
                            <h2 className={`text-2xl font-bold ${portalType === 'admin' ? 'text-white' : 'text-slate-800'}`}>
                                {mode === 'login' && 'Identity Access'}
                                {mode === 'staff_login' && 'Employee Login'}
                                {mode === 'register' && 'Agent Registration'}
                                {mode === 'otp' && 'Security Code'}
                            </h2>
                        </div>

                        {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-2xl flex items-center gap-3 animate-in shake duration-500"><AlertCircle size={18} />{error}</div>}
                        {successMessage && <div className={`mb-6 p-4 border text-sm rounded-2xl ${portalType === 'admin' ? 'bg-crm-500/10 text-crm-400' : 'bg-emerald-50 text-emerald-700'}`}>{successMessage}</div>}
                        {!mongoConnected && mode === 'login' && portalType === 'agent' && (
                            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl">
                                API server offline — run <code className="font-mono text-xs">npm run server</code> before agent login.
                            </div>
                        )}

                        {mode === 'login' && (
                            <form onSubmit={handleLogin} className="space-y-6">
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${portalType === 'admin' ? 'text-slate-400' : 'text-slate-500'}`}>Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-crm-600 transition-colors" size={20} />
                                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full pl-12 pr-4 py-3.5 rounded-2xl text-sm outline-none transition-all ${portalType === 'admin' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                                    </div>
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${portalType === 'admin' ? 'text-slate-400' : 'text-slate-500'}`}>Password Key</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-crm-600 transition-colors" size={20} />
                                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full pl-12 pr-4 py-3.5 rounded-2xl text-sm outline-none transition-all ${portalType === 'admin' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                                    </div>
                                </div>
                                <button type="submit" disabled={isLoading} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${portalType === 'admin' ? 'bg-white text-slate-900 shadow-white/10' : 'bg-crm-600 text-white shadow-crm-200'}`}>
                                    {isLoading ? <Loader2 className="animate-spin" /> : <LogIn size={18} />} Authorized Entry
                                </button>
                                
                                {portalType === 'agent' && (
                                    <div className="space-y-4 pt-4">
                                        <button type="button" onClick={() => setMode('staff_login')} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-crm-600"><Briefcase size={16}/> Employee Login ID</button>
                                        <button type="button" onClick={() => setMode('register')} className="w-full text-xs font-bold text-crm-600 underline underline-offset-4">Join as New Agent</button>
                                    </div>
                                )}
                            </form>
                        )}

                        {mode === 'staff_login' && (
                            <form onSubmit={handleStaffLogin} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500">Employee Login ID</label>
                                    <div className="relative"><Briefcase className="absolute left-4 top-3.5 text-slate-400" size={20} /><input type="text" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none" placeholder="e.g. E-101 or sub-agent email" /></div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500">Password</label>
                                    <div className="relative"><Lock className="absolute left-4 top-3.5 text-slate-400" size={20} /><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none" /></div>
                                </div>
                                <button type="submit" disabled={isLoading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl">
                                    {isLoading ? <Loader2 className="animate-spin" /> : <Shield size={18} />} Staff Entry
                                </button>
                                <button type="button" onClick={() => setMode('login')} className="w-full text-xs font-bold text-slate-400 mt-4">Back to Agent Login</button>
                            </form>
                        )}

                        {mode === 'register' && (
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Legal Name</label><div className="relative"><User className="absolute left-4 top-3.5 text-slate-400" size={20} /><input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none" /></div></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Business Email</label><div className="relative"><Mail className="absolute left-4 top-3.5 text-slate-400" size={20} /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none" /></div></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Set Password</label><div className="relative"><Lock className="absolute left-4 top-3.5 text-slate-400" size={20} /><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none" /></div></div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Confirm Password</label><div className="relative"><Key className="absolute left-4 top-3.5 text-slate-400" size={20} /><input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none" /></div></div>
                                <button type="submit" disabled={isLoading} className="w-full py-4 bg-crm-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest mt-4 shadow-xl">Join as Travel Agent</button>
                                <button type="button" onClick={() => setMode('login')} className="w-full text-xs font-bold text-slate-400 mt-6">Already Enrolled? Login</button>
                            </form>
                        )}

                        {mode === 'otp' && (
                            <form onSubmit={handleVerifyOtp} className="space-y-8">
                                <div className="flex justify-between gap-3">{otp.map((digit, idx) => ( <input key={idx} id={`otp-${idx}`} type="text" maxLength={1} value={digit} onChange={(e) => handleOtpChange(idx, e.target.value)} className="w-full h-14 text-center text-xl font-black bg-slate-50 border border-slate-200 rounded-2xl outline-none" /> ))}</div>
                                <button type="submit" disabled={isLoading} className="w-full py-4 bg-crm-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Verify & Submit Application</button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake { animation: shake 0.4s ease-in-out; }
            ` }} />
        </div>
    );
};

const Loader2 = ({ className }: { className?: string }) => <svg className={`animate-spin h-5 w-5 ${className}`} viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;

export default Login;
