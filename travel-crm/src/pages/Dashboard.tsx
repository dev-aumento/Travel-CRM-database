import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    MapPin,
    TrendingUp,
    IndianRupee,
    ArrowUpRight,
    DollarSign,
    Briefcase,
    Zap,
    Crown,
    FileText,
} from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { getUnifiedTotalForBooking, getUnifiedTotalForQuote } from '../utils/pricingConsistency';
import { isBookingFromConfirmedLead, isMainAgencyOwnerSession, recordVisibleToSession, resolveMainAgencyAgent } from '../utils/databaseSync';
import { buildAgentSubscriptionRows } from '../utils/agentSubscriptionFinance';
import { getAgentTrialInfo, isMainAgencyAgent } from '../utils/agentPlan';
import { canAccessRoute, getStoredPermissions } from '../utils/permissions';
import { useCurrency } from '../hooks/useCurrency';
import AgentAvatar from '../components/AgentAvatar';

const StatCard = ({ title, value, change, icon: Icon, trend, showChange = true }: any) => (
    <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-crm-50 text-crm-600 rounded-xl">
                <Icon size={24} strokeWidth={2} />
            </div>
            {showChange && change && (
                <div className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full ${trend === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                    }`}>
                    <ArrowUpRight size={16} className={trend === 'down' ? 'rotate-90' : ''} />
                    {change}
                </div>
            )}
        </div>
        <div>
            <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h2>
        </div>
    </div>
);

const getInitials = (name: string) =>
    String(name || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase() || '?';

const parseRecordDate = (value?: string): number => {
    if (!value) return 0;
    const iso = new Date(value);
    if (!Number.isNaN(iso.getTime())) return iso.getTime();
    const parts = value.split(' ');
    if (parts.length === 3) {
        const monthMap: Record<string, number> = {
            Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
            Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
        };
        const month = monthMap[parts[0]];
        const day = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);
        const year = parseInt(parts[2], 10);
        if (month != null && !Number.isNaN(day) && !Number.isNaN(year)) {
            return new Date(year, month, day).getTime();
        }
    }
    return 0;
};

const formatQuoteStatusLabel = (status?: string) => {
    const s = String(status || 'draft').toLowerCase();
    if (s === 'confirmed') return 'Confirmed';
    if (s === 'sent') return 'Sent to Client';
    return 'Draft Quotation';
};

const quoteStatusClass = (status?: string) => {
    const s = String(status || 'draft').toLowerCase();
    if (s === 'confirmed') return 'text-emerald-700 bg-emerald-50';
    if (s === 'sent') return 'text-crm-700 bg-crm-50';
    return 'text-amber-700 bg-amber-50';
};

const subscriptionStatusClass = (status: string) => {
    if (status === 'paid') return 'text-emerald-700 bg-emerald-50';
    if (status === 'trial') return 'text-amber-700 bg-amber-50';
    return 'text-rose-700 bg-rose-50';
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { db } = useDatabase();
    const { formatCompact, formatMoney } = useCurrency();
    const userRole = localStorage.getItem('userRole');
    const currentAgentId = localStorage.getItem('agentId');
    const userEmail = localStorage.getItem('userEmail');

    const sessionScope = React.useMemo(
        () => ({ userRole, userEmail, sessionAgentId: currentAgentId }),
        [userRole, userEmail, currentAgentId]
    );

    const currentAgent = useMemo(() => {
        return resolveMainAgencyAgent(db, {
            sessionAgentId: currentAgentId,
            userEmail,
        });
    }, [db, userEmail, currentAgentId]);

    const trialInfo = useMemo(() => getAgentTrialInfo(currentAgent), [currentAgent]);

    const stats = React.useMemo(() => {
        const allLeads = db.leads?.data || [];
        const allBookings = (db.bookings?.data || []).filter((b: any) =>
            isBookingFromConfirmedLead(b, db)
        );

        let filteredLeads = allLeads;
        let filteredBookings = allBookings;

        if (userRole !== 'admin' && currentAgentId) {
            filteredLeads = allLeads.filter((l: any) =>
                recordVisibleToSession('leads', l, db, sessionScope)
            );
            filteredBookings = allBookings.filter((b: any) =>
                recordVisibleToSession('bookings', b, db, sessionScope)
            );
        }

        let totalRevenue = 0;
        filteredBookings.forEach((b: any) => {
            totalRevenue += getUnifiedTotalForBooking(b, db);
        });

        const activeLeads = filteredLeads.filter(
            (l: any) => l.status !== 'converted' && l.status !== 'lost' && l.status !== 'deleted' && l.status !== 'canceled'
        ).length;
        const convRate = filteredLeads.length > 0 ? (filteredBookings.length / filteredLeads.length) * 100 : 0;

        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const periodConvRate = (start: number, end: number) => {
            const leadsInPeriod = filteredLeads.filter((l: any) => {
                const t = parseRecordDate(l.createdAt);
                return t > 0 && t >= start && t < end;
            });
            if (leadsInPeriod.length === 0) return null;
            const leadNames = new Set(leadsInPeriod.map((l: any) => l.name));
            const bookingsForLeads = filteredBookings.filter((b: any) => leadNames.has(b.customer));
            return (bookingsForLeads.length / leadsInPeriod.length) * 100;
        };

        const currentPeriodConv = periodConvRate(now - THIRTY_DAYS_MS, now);
        const previousPeriodConv = periodConvRate(now - 2 * THIRTY_DAYS_MS, now - THIRTY_DAYS_MS);
        let conversionChange: number | null = null;
        if (currentPeriodConv != null && previousPeriodConv != null) {
            conversionChange = currentPeriodConv - previousPeriodConv;
        }

        return {
            leads: activeLeads,
            bookings: filteredBookings.length,
            revenue: totalRevenue,
            conversion: convRate.toFixed(1),
            conversionRate: convRate,
            conversionChange,
        };
    }, [db.leads?.data, db.bookings?.data, userRole, currentAgentId, db, sessionScope]);

    const recentSubscriptions = useMemo(() => {
        return buildAgentSubscriptionRows(db.travelAgents?.data || [], db.plans?.data || []).slice(0, 5);
    }, [db.travelAgents?.data, db.plans?.data]);

    const adminStats = useMemo(() => {
        const mainAgents = (db.travelAgents?.data || []).filter(isMainAgencyAgent);
        const planCatalog = db.plans?.data || [];
        const subscriptionRows = buildAgentSubscriptionRows(mainAgents, planCatalog);

        const activeTrials = mainAgents.filter((agent: any) => {
            const trial = getAgentTrialInfo(agent);
            return trial?.active;
        }).length;

        const paidSubscriptions = subscriptionRows.filter((row) => row.payment.status === 'paid').length;

        const subscriptionRevenue = subscriptionRows.reduce(
            (sum, row) => sum + row.payment.amountPaid,
            0
        );

        return {
            totalAgents: mainAgents.length,
            activeTrials,
            paidSubscriptions,
            subscriptionRevenue,
        };
    }, [db.travelAgents?.data, db.plans?.data]);

    const adminPlanDistribution = useMemo(() => {
        const mainAgents = (db.travelAgents?.data || []).filter(isMainAgencyAgent);
        const counts: Record<string, number> = {};
        mainAgents.forEach((agent: any) => {
            const plan = agent?.plan || 'Lite';
            counts[plan] = (counts[plan] || 0) + 1;
        });

        const total = Object.values(counts).reduce((sum, count) => sum + count, 0) || 1;
        const colors = ['bg-slate-500', 'bg-crm-500', 'bg-indigo-500', 'bg-amber-500'];
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, count], index) => ({
                name,
                value: Math.round((count / total) * 100),
                color: colors[index % colors.length],
            }));
    }, [db.travelAgents?.data]);

    const recentQuotations = useMemo(() => {
        const all = db.quotations?.data || [];
        const leads = db.leads?.data || [];

        const filtered = all.filter((q: any) => {
            if (userRole === 'admin') return true;
            return recordVisibleToSession('quotations', q, db, sessionScope);
        });

        return filtered
            .sort((a: any, b: any) => parseRecordDate(b.date) - parseRecordDate(a.date))
            .slice(0, 5);
    }, [db.quotations?.data, db.leads?.data, userRole, sessionScope, db]);

    const topRegions = useMemo(() => {
        const allBookings = (db.bookings?.data || []).filter((b: any) =>
            isBookingFromConfirmedLead(b, db)
        );
        let bookings = allBookings;
        if (userRole !== 'admin') {
            bookings = allBookings.filter((b: any) =>
                recordVisibleToSession('bookings', b, db, sessionScope)
            );
        }

        const counts: Record<string, number> = {};
        bookings.forEach((b: any) => {
            const dest = String(b.package || b.destination || 'Other').trim();
            if (dest) counts[dest] = (counts[dest] || 0) + 1;
        });

        const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
        const colors = ['bg-crm-500', 'bg-indigo-500', 'bg-teal-500', 'bg-rose-500'];
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, count], i) => ({
                name,
                value: Math.round((count / total) * 100),
                color: colors[i % colors.length],
            }));
    }, [db.bookings?.data, db, userRole, sessionScope]);

    const formatCurrency = (amount: number) => formatCompact(amount);

    const formatQuoteAmount = (quote: any) => {
        const total = getUnifiedTotalForQuote(quote, db);
        return formatMoney(total);
    };

    const isAdmin = userRole === 'admin';
    const canViewFinance =
        isAdmin ||
        (userRole === 'agent' && canAccessRoute('agent', [], '/finance')) ||
        (userRole === 'staff' && canAccessRoute('staff', getStoredPermissions(), '/finance'));
    const showTrialBanner = isMainAgencyOwnerSession(userRole, currentAgentId, db) && trialInfo?.active;

    return (
        <div className="h-full flex flex-col gap-6 overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {isAdmin ? 'Platform Overview' : 'Agency Overview'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {isAdmin
                            ? 'Monitor travel agencies, trials, and subscription activity.'
                            : "Here's what's happening today."}
                    </p>
                </div>
                {canViewFinance && (
                    <button
                        onClick={() => navigate(isAdmin ? '/finance?view=subscriptions' : '/finance')}
                        className="btn-primary flex items-center gap-2 shadow-crm-500/30"
                    >
                        <DollarSign size={18} />
                        Finance Center
                    </button>
                )}
            </div>
            {showTrialBanner && (
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-[24px] p-4 text-white flex items-center justify-between shadow-lg shadow-amber-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <Zap size={20} className="fill-current" />
                        </div>
                        <div>
                            <p className="text-sm font-bold">Free Trial Active: {trialInfo.daysLeft} days remaining</p>
                            <p className="text-[11px] text-white/80">You are currently experiencing the {currentAgent?.plan} plan features.</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/plans')} className="px-4 py-2 bg-white text-orange-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all">
                        View All Plans
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {isAdmin ? (
                        <>
                            <StatCard title="Travel Agents" value={adminStats.totalAgents} icon={Users} showChange={false} />
                            <StatCard title="Active Trials" value={adminStats.activeTrials} icon={Zap} showChange={false} />
                            <StatCard title="Paid Plans" value={adminStats.paidSubscriptions} icon={Crown} showChange={false} />
                            <StatCard
                                title="Subscription Revenue"
                                value={formatCurrency(adminStats.subscriptionRevenue)}
                                icon={IndianRupee}
                                showChange={false}
                            />
                        </>
                    ) : (
                        <>
                            <StatCard title="Active Leads" value={stats.leads} change="+12%" icon={Users} trend="up" showChange={stats.leads > 0} />
                            <StatCard title="Confirm Bookings" value={stats.bookings} change="+5%" icon={Briefcase} trend="up" showChange={stats.bookings > 0} />
                            <StatCard
                                title="Conv. Rate"
                                value={`${stats.conversion}%`}
                                change={
                                    stats.conversionChange != null
                                        ? `${stats.conversionChange >= 0 ? '+' : ''}${Math.round(stats.conversionChange)}%`
                                        : undefined
                                }
                                icon={TrendingUp}
                                trend={(stats.conversionChange ?? 0) >= 0 ? 'up' : 'down'}
                                showChange={
                                    stats.conversionRate > 0 &&
                                    stats.conversionRate < 100 &&
                                    stats.conversionChange != null &&
                                    Math.abs(stats.conversionChange) >= 0.5
                                }
                            />
                            <StatCard title="Total Revenue" value={formatCurrency(stats.revenue)} change="+18%" icon={IndianRupee} trend="up" showChange={stats.revenue > 0} />
                        </>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                {isAdmin ? 'Recent Subscriptions' : 'Recent Quotations'}
                            </h2>
                            <button
                                onClick={() =>
                                    navigate(isAdmin ? '/finance?view=subscriptions' : '/quotations')
                                }
                                className="text-sm font-bold text-crm-600 hover:text-crm-700"
                            >
                                {isAdmin ? 'View All Subscriptions' : 'View All Records'}
                            </button>
                        </div>

                        {isAdmin ? (
                            <div className="space-y-4">
                                {recentSubscriptions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <Crown size={32} className="text-slate-200 mb-3" />
                                        <p className="text-sm font-medium">No paid agent subscriptions yet</p>
                                    </div>
                                ) : (
                                    recentSubscriptions.map((row) => (
                                        <div
                                            key={row.id}
                                            onClick={() => navigate('/finance?view=subscriptions')}
                                            className="flex items-center justify-between p-5 rounded-3xl border border-slate-100 hover:border-crm-100 hover:bg-crm-50/50 dark:hover:border-slate-600 dark:hover:bg-slate-700/60 transition-colors cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-5 min-w-0">
                                                <AgentAvatar
                                                    agent={row.agent}
                                                    className="w-12 h-12"
                                                    roundedClassName="rounded-2xl"
                                                    fallbackClassName="bg-indigo-100 text-indigo-600"
                                                    textClassName="text-sm"
                                                />
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-slate-900 truncate">
                                                        {row.agent?.name || 'Agent'}
                                                    </h4>
                                                    <p className="text-xs text-slate-400 dark:text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300 font-medium flex items-center gap-1.5 mt-1 truncate">
                                                        <Crown size={14} className="text-slate-300 dark:text-slate-500 group-hover:text-crm-500 dark:group-hover:text-crm-400 transition-colors shrink-0" />
                                                        {row.planName} Plan · Purchased {row.purchasedAt}
                                                    </p>
                                                    {row.agent?.businessName && (
                                                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{row.agent.businessName}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-4">
                                                <div className="font-black text-slate-900 text-lg">{row.payment.totalFormatted}</div>
                                                <div className={`text-[10px] font-black px-3 py-1 rounded-full mt-1.5 inline-block uppercase tracking-wider ${subscriptionStatusClass(row.payment.status)}`}>
                                                    {row.payment.status === 'trial' ? 'Trial Active' : row.payment.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentQuotations.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <FileText size={32} className="text-slate-200 mb-3" />
                                        <p className="text-sm font-medium">No quotations in your portfolio yet</p>
                                        <button
                                            onClick={() => navigate('/quotations')}
                                            className="mt-3 text-sm font-bold text-crm-600 hover:text-crm-700"
                                        >
                                            Create a quotation
                                        </button>
                                    </div>
                                ) : (
                                    recentQuotations.map((quote: any) => (
                                        <div
                                            key={quote.id}
                                            onClick={() => navigate('/quotations')}
                                            className="flex items-center justify-between p-5 rounded-3xl border border-slate-100 hover:border-crm-100 hover:bg-crm-50/50 dark:hover:border-slate-600 dark:hover:bg-slate-700/60 transition-colors cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-5 min-w-0">
                                                <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-black text-sm shrink-0">
                                                    {getInitials(quote.customer)}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-slate-900 truncate">{quote.customer}</h4>
                                                    <p className="text-xs text-slate-400 dark:text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300 font-medium flex items-center gap-1.5 mt-1 truncate">
                                                        <MapPin size={14} className="text-slate-300 dark:text-slate-500 group-hover:text-crm-500 dark:group-hover:text-crm-400 transition-colors shrink-0" />
                                                        {quote.destination}
                                                        {quote.duration ? ` · ${quote.duration.split('/')[0]?.trim()}` : ''}
                                                    </p>
                                                    {quote.version && (
                                                        <p className="text-[10px] text-slate-400 dark:text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300 mt-0.5">Version {quote.version}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-4">
                                                <div className="font-black text-slate-900 text-lg">{formatQuoteAmount(quote)}</div>
                                                <div className={`text-[10px] font-black px-3 py-1 rounded-full mt-1.5 inline-block uppercase tracking-wider ${quoteStatusClass(quote.status)}`}>
                                                    {formatQuoteStatusLabel(quote.status)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                {isAdmin ? 'Plan Distribution' : 'Top Regions'}
                            </h2>
                        </div>
                        <div className="space-y-6">
                            {(isAdmin ? adminPlanDistribution : topRegions).length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-8">
                                    {isAdmin ? 'No travel agents yet' : 'No booking data yet'}
                                </p>
                            ) : (
                                (isAdmin ? adminPlanDistribution : topRegions).map((dest) => (
                                    <div key={dest.name}>
                                        <div className="justify-between text-xs mb-2 flex items-center">
                                            <span className="font-bold text-slate-700 uppercase tracking-wider truncate pr-2">{dest.name}</span>
                                            <span className="text-slate-400 font-black shrink-0">{dest.value}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div className={`${dest.color} h-full rounded-full transition-all duration-1000`} style={{ width: `${dest.value}%` }}></div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
