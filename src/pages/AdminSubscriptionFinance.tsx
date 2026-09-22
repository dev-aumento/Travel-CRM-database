import React, { useMemo, useState } from 'react';
import { useCurrency } from '../hooks/useCurrency';
import {
    DollarSign,
    TrendingUp,
    FileText,
    ArrowUpRight,
    Download,
    Eye,
    Search,
    CheckCircle2,
    Clock,
    AlertCircle,
    User,
    X,
    Crown,
    Calendar,
} from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import type {
    AgentSubscriptionRow,
    SalesReportDatePreset,
    SubscriptionSettlementStatus,
} from '../utils/agentSubscriptionFinance';
import {
    buildAgentSubscriptionRows,
    filterSubscriptionRowsByDateRange,
    resolveSalesReportDateRange,
    summarizeSubscriptionRows,
} from '../utils/agentSubscriptionFinance';
import { PLATFORM_NAME } from '../constants/platform';
import AgentAvatar from '../components/AgentAvatar';

const AdminSubscriptionFinance = () => {
    const { formatMoney } = useCurrency();
    const { db } = useDatabase();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionSettlementStatus>('all');
    const [selectedRow, setSelectedRow] = useState<AgentSubscriptionRow | null>(null);
    const [showSalesReport, setShowSalesReport] = useState(false);
    const [reportPeriod, setReportPeriod] = useState<SalesReportDatePreset>('last_month');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const agencyName = db?.settings?.data?.[0]?.agencyName || PLATFORM_NAME;

    const allSubscriptionRows = useMemo(
        () => buildAgentSubscriptionRows(db.travelAgents?.data || [], db.plans?.data || []),
        [db.travelAgents?.data, db.plans?.data]
    );

    const reportDateRange = useMemo(
        () => resolveSalesReportDateRange(reportPeriod, customStartDate, customEndDate),
        [reportPeriod, customStartDate, customEndDate]
    );

    const reportRows = useMemo(
        () => filterSubscriptionRowsByDateRange(allSubscriptionRows, reportDateRange),
        [allSubscriptionRows, reportDateRange]
    );

    const subscriptionRows = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return reportRows.filter((row) => {
            if (statusFilter !== 'all' && row.payment.status !== statusFilter) return false;
            if (!q) return true;
            const haystack = [
                row.agent.name,
                row.agent.businessName,
                row.agent.email,
                row.planName,
                row.id,
                row.agent.id,
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [reportRows, searchQuery, statusFilter]);

    const reportMetrics = useMemo(() => summarizeSubscriptionRows(reportRows), [reportRows]);

    const formatCurrency = (amount: number) => formatMoney(amount);

    const csvCell = (value: unknown) => {
        const text = String(value ?? '');
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    };

    const downloadSalesReportCsv = () => {
        const headers = [
            'Invoice ID',
            'Agent',
            'Business',
            'Plan',
            'Purchased',
            'Total',
            'Paid',
            'Status',
        ];
        const rows = reportRows.map((r) => [
            r.id,
            r.agent.name,
            r.agent.businessName,
            r.planName,
            r.purchasedAt,
            r.payment.total,
            r.payment.amountPaid,
            r.payment.status,
        ]);
        const csv = [
            [`Report Period: ${reportDateRange.label}`],
            [`Generated: ${new Date().toLocaleString('en-GB')}`],
            [],
            headers,
            ...rows,
        ]
            .map((line) => line.map(csvCell).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `subscription-report-${reportPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
    };

    const reportPeriodOptions: { id: SalesReportDatePreset; label: string }[] = [
        { id: 'last_week', label: 'Last Week' },
        { id: 'last_month', label: 'Last Month' },
        { id: 'last_year', label: 'Last Year' },
        { id: 'custom', label: 'Custom Range' },
    ];

    const settlementBadge = (status: SubscriptionSettlementStatus) => {
        const styles =
            status === 'paid'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                : status === 'trial'
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                  : 'bg-red-50 text-red-600 border-red-100';
        const Icon = status === 'paid' ? CheckCircle2 : status === 'trial' ? Clock : AlertCircle;
        const label = status === 'trial' ? 'trial' : status;
        return (
            <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles}`}
            >
                <Icon size={12} />
                {label}
            </div>
        );
    };

    React.useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            @media print {
                @page { size: A4; margin: 5mm; }
                body * { visibility: hidden; }
                #printable-invoice, #printable-invoice *,
                #printable-report, #printable-report * { visibility: visible; }
                #printable-invoice, #printable-report {
                    position: absolute; left: 0; top: 0; width: 200mm;
                    margin: 0; padding: 10mm; box-shadow: none !important;
                }
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    React.useEffect(() => {
        document.body.style.overflow = selectedRow || showSalesReport ? 'hidden' : 'auto';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [selectedRow, showSalesReport]);

    return (
        <div className="h-full flex flex-col gap-6 overflow-hidden font-sans pb-8 min-h-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <DollarSign className="text-crm-600" size={28} />
                        Financial Control Center
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">
                        Subscription revenue from agents on paid plans (Growth & Enterprise)
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowSalesReport(true)}
                    className="btn-secondary flex items-center gap-2 py-3"
                >
                    <Download size={18} /> Export Sales Report
                </button>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 shrink-0">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar size={16} className="text-crm-600" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Report Period</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {reportPeriodOptions.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setReportPeriod(option.id)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                reportPeriod === option.id
                                    ? 'bg-crm-600 text-white border-crm-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {reportPeriod === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 max-w-xl">
                        <label className="flex flex-col gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Start Date
                            </span>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="bg-slate-50 text-slate-900 rounded-xl px-4 py-2.5 text-sm font-medium border border-slate-200 focus:outline-none focus:border-crm-500"
                            />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                End Date
                            </span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="bg-slate-50 text-slate-900 rounded-xl px-4 py-2.5 text-sm font-medium border border-slate-200 focus:outline-none focus:border-crm-500"
                            />
                        </label>
                    </div>
                )}
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                    <span className="font-bold text-slate-800">{reportDateRange.label}</span>
                    <span>{reportRows.length} subscriptions</span>
                    <span>Revenue: {formatCurrency(reportMetrics.totalRevenue)}</span>
                    <span>Collected: {formatCurrency(reportMetrics.collectedAmount)}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-500">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                        Subscription Revenue
                    </p>
                    <h3 className="text-3xl font-black text-slate-900">{formatCurrency(reportMetrics.totalRevenue)}</h3>
                    <div className="mt-4 flex items-center gap-1.5 text-emerald-600 font-bold text-xs bg-emerald-50 w-fit px-2 py-1 rounded-full">
                        <ArrowUpRight size={14} /> {reportRows.length} paid plans
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-500">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Collected</p>
                    <h3 className="text-3xl font-black text-slate-900">{formatCurrency(reportMetrics.collectedAmount)}</h3>
                    <div className="mt-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
                        {((reportMetrics.collectedAmount / reportMetrics.totalRevenue) * 100 || 0).toFixed(1)}% collection rate
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-500">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Outstanding</p>
                    <h3 className="text-3xl font-black text-amber-600">{formatCurrency(reportMetrics.pendingAmount)}</h3>
                    <div className="mt-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Trials & renewals due
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm border-l-4 border-l-crm-500">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Active Paid</p>
                    <h3 className="text-3xl font-black text-slate-900">{reportMetrics.activeSubscriptions}</h3>
                    <div className="mt-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Agents with live subscriptions
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col gap-6">
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-4 top-3 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search agent, business, or invoice #"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-crm-500 font-medium"
                            />
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {(['all', 'paid', 'trial', 'unpaid'] as const).map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setStatusFilter(f)}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                        statusFilter === f ? 'bg-white text-crm-600 shadow-sm' : 'text-slate-500'
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Invoice / Agent
                                    </th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Plan
                                    </th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Purchased
                                    </th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Plan Amount
                                    </th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Collected
                                    </th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Settlement
                                    </th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {subscriptionRows.map((row) => (
                                    <tr key={row.id} className="group hover:bg-slate-50/80 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <AgentAvatar
                                                    agent={row.agent}
                                                    fallback="icon"
                                                    fallbackClassName="bg-slate-100 text-slate-500"
                                                />
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{row.agent.name}</div>
                                                    <div className="text-[10px] font-black text-crm-600 tracking-widest">
                                                        #{row.id}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-medium">
                                                        {row.agent.businessName}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                                <Crown size={14} className="text-amber-500" />
                                                {row.planName}
                                                {row.agent.isTrial && (
                                                    <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                        Trial
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-bold mt-1">{row.period}</div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                                <Calendar size={12} /> {row.purchasedAt}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium mt-1">{row.expiresLabel}</div>
                                        </td>
                                        <td className="px-8 py-5 font-black text-slate-900 text-sm">
                                            {row.payment.totalFormatted}
                                        </td>
                                        <td
                                            className={`px-8 py-5 font-black text-sm ${
                                                row.payment.amountPaid > 0 ? 'text-emerald-600' : 'text-slate-500'
                                            }`}
                                        >
                                            {formatCurrency(row.payment.amountPaid)}
                                        </td>
                                        <td className="px-8 py-5">{settlementBadge(row.payment.status)}</td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRow(row)}
                                                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-crm-600 hover:border-crm-200 transition-all shadow-sm"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedRow(row);
                                                        setTimeout(() => window.print(), 500);
                                                    }}
                                                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-crm-600 hover:border-crm-200 transition-all shadow-sm"
                                                    title="Print invoice"
                                                >
                                                    <Download size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {subscriptionRows.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200">
                                                    <FileText size={32} />
                                                </div>
                                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                                                    No subscriptions in this period
                                                </p>
                                                <p className="text-slate-400 text-xs max-w-sm">
                                                    Only agents on Growth or Enterprise plans appear here. Lite (free) agents are excluded.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {selectedRow && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center print:bg-white">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-[20px] -z-10"
                        onClick={() => setSelectedRow(null)}
                    />
                    <div className="fixed top-8 right-8 flex gap-4 z-[120] print:hidden">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center gap-3"
                        >
                            <Download size={18} /> Print / Save PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedRow(null)}
                            className="bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl border border-white/20"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <div className="w-full h-full overflow-y-auto flex flex-col items-center py-12 px-4">
                        <div
                            id="printable-invoice"
                            className="bg-white w-[210mm] min-h-[297mm] p-16 shadow-2xl flex flex-col rounded-[40px] print:rounded-none print:w-[200mm] print:p-8"
                        >
                            <div className="flex justify-between items-start mb-12 border-b-4 border-slate-900 pb-8">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                                        {agencyName}
                                    </h1>
                                    <p className="text-[10px] font-black text-crm-600 tracking-[0.3em] uppercase mt-1">
                                        Platform Subscription Invoice
                                    </p>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-5xl font-black text-slate-100 uppercase tracking-tighter mb-4">
                                        INVOICE
                                    </h2>
                                    <p className="text-base font-black text-slate-900">NO: #{selectedRow.id}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase">
                                        DATE: {new Date().toLocaleDateString('en-GB')}
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-12 mb-12">
                                <div className="bg-slate-50 p-6 rounded-[1.5rem]">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                        Agent / Agency
                                    </p>
                                    <h3 className="text-xl font-black text-slate-900 mb-1">{selectedRow.agent.name}</h3>
                                    <p className="text-sm font-bold text-crm-600">{selectedRow.agent.businessName}</p>
                                    <p className="text-[10px] text-slate-500 mt-2">{selectedRow.agent.email}</p>
                                </div>
                                <div className="p-6">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                        Subscription
                                    </p>
                                    <h3 className="text-lg font-black text-slate-800">
                                        {selectedRow.planName} Plan {selectedRow.period}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-bold mt-2">{selectedRow.expiresLabel}</p>
                                </div>
                            </div>
                            <table className="w-full text-left mb-10">
                                <thead>
                                    <tr className="border-y-4 border-slate-900">
                                        <th className="py-4 text-[10px] font-black uppercase">Description</th>
                                        <th className="py-4 text-[10px] font-black uppercase text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="py-6 font-bold text-slate-900">
                                            CRM {selectedRow.planName} subscription
                                        </td>
                                        <td className="py-6 text-right font-black">
                                            {selectedRow.payment.totalFormatted}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="flex justify-end">
                                <div className="w-72 border-4 border-slate-900 p-6 rounded-2xl">
                                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                                        <span>Paid</span>
                                        <span className="text-emerald-600">
                                            {formatCurrency(selectedRow.payment.amountPaid)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black uppercase mb-4">
                                        <span>Due</span>
                                        <span className="text-amber-600">
                                            {formatCurrency(selectedRow.payment.amountDue)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pt-4 border-t-4 border-slate-900">
                                        <span className="text-[11px] font-black uppercase">Total</span>
                                        <span className="text-2xl font-black text-crm-600">
                                            {selectedRow.payment.totalFormatted}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showSalesReport && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-[20px] -z-10"
                        onClick={() => setShowSalesReport(false)}
                    />
                    <div className="fixed top-8 right-8 flex gap-4 z-[120] print:hidden">
                        <button
                            type="button"
                            onClick={downloadSalesReportCsv}
                            disabled={reportRows.length === 0}
                            className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={18} /> Download CSV
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowSalesReport(false)}
                            className="bg-white/10 text-white p-4 rounded-2xl border border-white/20"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <div className="w-full h-full overflow-y-auto flex flex-col items-center py-12 px-4">
                        <div
                            id="printable-report"
                            className="bg-white w-[210mm] min-h-[297mm] p-16 shadow-2xl rounded-[40px] print:w-[200mm] print:p-8"
                        >
                            <h1 className="text-2xl font-black mb-2">Agent Subscription Report</h1>
                            <p className="text-sm font-bold text-slate-700 mb-1">Period: {reportDateRange.label}</p>
                            <p className="text-sm text-slate-500 mb-6">
                                Generated {new Date().toLocaleString('en-GB')}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 text-sm">
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Subscriptions</p>
                                    <p className="text-xl font-black">{reportRows.length}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Revenue</p>
                                    <p className="text-xl font-black">{formatCurrency(reportMetrics.totalRevenue)}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Collected</p>
                                    <p className="text-xl font-black">{formatCurrency(reportMetrics.collectedAmount)}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Outstanding</p>
                                    <p className="text-xl font-black text-amber-600">
                                        {formatCurrency(reportMetrics.pendingAmount)}
                                    </p>
                                </div>
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b-2 border-slate-900">
                                        <th className="py-2 font-black uppercase text-[10px]">Agent</th>
                                        <th className="py-2 font-black uppercase text-[10px]">Plan</th>
                                        <th className="py-2 font-black uppercase text-[10px]">Purchased</th>
                                        <th className="py-2 font-black uppercase text-[10px] text-right">Amount</th>
                                        <th className="py-2 font-black uppercase text-[10px] text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportRows.map((r) => (
                                        <tr key={r.id}>
                                            <td className="py-3 font-bold">{r.agent.name}</td>
                                            <td className="py-3">{r.planName}</td>
                                            <td className="py-3 text-slate-500">{r.purchasedAt}</td>
                                            <td className="py-3 text-right font-black">{r.payment.totalFormatted}</td>
                                            <td className="py-3 text-right uppercase text-[10px] font-black">
                                                {r.payment.status}
                                            </td>
                                        </tr>
                                    ))}
                                    {reportRows.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                                                No subscriptions found for the selected period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSubscriptionFinance;
