import React, { useMemo, useState } from 'react';
import NumberInput from '../components/NumberInput';
import {
    DollarSign,
    TrendingUp,
    CreditCard,
    FileText,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    Download,
    Eye,
    Search,
    Filter,
    CheckCircle2,
    Clock,
    AlertCircle,
    Building,
    User,
    X
} from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import VisibleScrollArea from '../components/VisibleScrollArea';
import {
    getBookingPaymentDetails,
    getUnifiedBudgetForBooking,
    buildBookingPaymentPatch,
    buildBookingPartialPaidPatch,
    PAYMENT_STATUS_OPTIONS,
    getPaymentStatusLabel,
    getPaymentStatusColorClasses,
    type BookingPaymentDetails,
    type PaymentSettlementStatus,
} from '../utils/pricingConsistency';
import { useAgencyBranding } from '../hooks/useAgencyBranding';
import { useCurrency } from '../hooks/useCurrency';
import { getAgentIdsForScope } from '../utils/databaseSync';
import { PLATFORM_NAME } from '../constants/platform';
import DropdownChevron from '../components/DropdownChevron';
import AgencyBankDetailsBlock from '../components/AgencyBankDetailsBlock';
import { resolveAgencyBankDetails } from '../utils/agencyBankDetails';
import { usePlanFeatures } from '../utils/planFeatures';

type InvoiceRow = { booking: any; payment: BookingPaymentDetails };

const Finance = () => {
    const userRole = localStorage.getItem('userRole');

    const { db, updateRecord } = useDatabase();
    const { hasFeature: hasPlanFeature } = usePlanFeatures();
    const { formatMoney, currencySymbol, formatInputValue, parseInputValue, toInputAmount, priceInputStep } =
        useCurrency();
    const currentAgentId = localStorage.getItem('agentId');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [showSalesReport, setShowSalesReport] = useState(false);

    const agencyBranding = useAgencyBranding();
    const agencyName = agencyBranding.name;
    const agencyBankDetails = useMemo(
        () => resolveAgencyBankDetails(agencyBranding.settings),
        [agencyBranding.settings]
    );

    // Resolve the active agency details for the selected invoice
    const invoiceBranding = useMemo(() => {
        if (!selectedInvoice) return null;

        const settings = agencyBranding.settings;
        let invoiceAgent = null;

        // 1. Try to find the agent via booking's agentId
        const bookingAgentId = selectedInvoice.agentId;
        if (bookingAgentId) {
            // First check if it matches travel agent id
            invoiceAgent = (db?.travelAgents?.data || []).find((a: any) => a.id === bookingAgentId);
            
            // If not found, check if it's staff employeeId
            if (!invoiceAgent) {
                const staffObj = (db?.staff?.data || []).find(
                    (s: any) => s.employeeId === bookingAgentId || s.id === bookingAgentId
                );
                if (staffObj?.agentId) {
                    invoiceAgent = (db?.travelAgents?.data || []).find((a: any) => a.id === staffObj.agentId);
                }
            }
        }

        // 2. Fallback: If not found, try the logged-in user context
        if (!invoiceAgent && userRole !== 'admin') {
            if (currentAgentId) {
                invoiceAgent = (db?.travelAgents?.data || []).find((a: any) => a.id === currentAgentId);
            }
        }

        // 3. Extract resolved fields
        if (invoiceAgent) {
            return {
                name: invoiceAgent.businessName || invoiceAgent.name || 'Travel Agency',
                logoUrl: invoiceAgent.avatar || (invoiceAgent as any).logoUrl || '',
                address: invoiceAgent.address || invoiceAgent.businessAddress || 'No office address specified',
                email: invoiceAgent.email || 'support@agency.com',
                gstDetails: invoiceAgent.gstDetails || ''
            };
        }

        // Fallback to Admin Settings
        return {
            name: settings?.agencyName || PLATFORM_NAME,
            logoUrl: settings?.logoUrl || '',
            address: settings?.agencyAddress || 'Main Headquarters',
            email: settings?.supportEmail || settings?.email || 'admin@aumento.com',
            gstDetails: settings?.gstDetails || ''
        };
    }, [selectedInvoice, db, userRole, currentAgentId, agencyBranding]);

    // Print Style Injection
    React.useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            @media print {
                @page {
                    size: A4;
                    margin: 5mm;
                }
                body * { visibility: hidden; }
                #printable-invoice, #printable-invoice *, #printable-report, #printable-report * { visibility: visible; }
                #printable-invoice, #printable-report { 
                    position: absolute; 
                    left: 0; 
                    top: 0; 
                    width: 200mm;
                    margin: 0;
                    padding: 10mm;
                    box-shadow: none !important;
                    min-height: auto !important;
                }
                /* Hide browser headers/footers */
                header, footer, .print-hide { display: none !important; }
            }
        `;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    // Body Scroll Lock
    React.useEffect(() => {
        if (selectedInvoice || showSalesReport) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [selectedInvoice, showSalesReport]);

    const getTrackingId = (booking: any) => {
        if (booking?.trackingId) return booking.trackingId;
        const linkedLead = (db?.leads?.data || []).find(
            (l: any) => l.id === booking?.leadId || l.name === booking?.customer || l.bookingId === booking?.id
        );
        return linkedLead?.trackingId || '-';
    };

    // Filtered bookings for financial calculations
    const bookings = useMemo(() => {
        const allBookings = db.bookings?.data || [];
        const allLeads = db.leads?.data || [];

        let filtered = allBookings;
        if (userRole !== 'admin') {
            const teamIds = getAgentIdsForScope(db, currentAgentId || '');

            filtered = allBookings.filter((b: any) => {
                const linkedLead = allLeads.find((l: any) => l.name === b.customer || l.id === b.leadId);
                return teamIds.includes(b.agentId) || (linkedLead && teamIds.includes(linkedLead.agentId));
            });
        }

        if (searchQuery) {
            filtered = filtered.filter((b: any) =>
                b.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                getTrackingId(b).toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return filtered;
    }, [db.bookings?.data, db.leads?.data, userRole, currentAgentId, searchQuery]);

    // Settlement derived from amount paid vs total (not stale paymentStatus labels)
    // NOTE: invoiceRows always contains ALL rows (for stable headline metrics),
    // while visibleInvoiceRows applies the current payment-status filter for the table/report only.
    const invoiceRows = useMemo((): InvoiceRow[] => {
        return bookings.map((b: any): InvoiceRow => ({
            booking: b,
            payment: getBookingPaymentDetails(b, db),
        }));
    }, [bookings, db]);

    const visibleInvoiceRows = useMemo((): InvoiceRow[] => {
        if (statusFilter === 'all') return invoiceRows;
        return invoiceRows.filter((row: InvoiceRow) => row.payment.status === statusFilter);
    }, [invoiceRows, statusFilter]);

    // Financial Metrics
    const metrics = useMemo(() => {
        let totalRevenue = 0;
        let collectedAmount = 0;
        let pendingAmount = 0;
        let confirmedCount = 0;

        invoiceRows.forEach(({ booking: b, payment }: InvoiceRow) => {
            const isCanceledTrip =
                payment.status === 'refunded' ||
                b.status === 'cancelled' ||
                b.status === 'canceled';
            if (!isCanceledTrip) {
                totalRevenue += payment.total;
                collectedAmount += payment.amountPaid;
                pendingAmount += payment.amountDue;
            }
            if (b.status === 'confirmed' || b.status === 'completed') {
                confirmedCount++;
            }
        });

        return {
            totalRevenue,
            collectedAmount,
            pendingAmount,
            confirmedCount,
            revenueTarget: totalRevenue * 1.2, // Dummy target for visual
            growth: 12.5 // Dummy growth
        };
    }, [invoiceRows]);

    const settlementBadge = (status: PaymentSettlementStatus) => {
        const Icon =
            status === 'paid' ? CheckCircle2 : status === 'partial' ? Clock : status === 'refunded' ? FileText : AlertCircle;
        return (
            <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getPaymentStatusColorClasses(status, 'badge')}`}
            >
                <Icon size={12} />
                {getPaymentStatusLabel(status)}
            </div>
        );
    };

    const handlePaymentStatusChange = (booking: any, newStatus: PaymentSettlementStatus) => {
        const patch = buildBookingPaymentPatch(booking, db, newStatus);
        updateRecord('bookings', booking.id, patch);
    };

    const handlePartialPaidAmountChange = (booking: any, rawValue: string) => {
        const amountInInr = parseInputValue(rawValue);
        const patch = buildBookingPartialPaidPatch(booking, db, amountInInr);
        updateRecord('bookings', booking.id, patch);
    };

    const formatCurrency = (amount: number) => formatMoney(amount);

    return (
        <div className="h-full flex flex-col gap-3 sm:gap-4 overflow-hidden font-sans min-h-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
                <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <DollarSign className="text-crm-600 shrink-0" size={20} />
                        Financial Control Center
                    </h1>
                    <p className="text-slate-500 text-xs font-medium mt-0.5">
                        Manage revenue, invoices, and payment settlements
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                        onClick={() => setShowSalesReport(true)}
                        className="flex items-center gap-1.5 py-2 px-3 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap rounded-xl text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                    >
                        <Download size={14} /> Export Sales Report
                    </button>
                </div>
            </div>

            {/* Metrics Grid — compact so the invoice table gets more room */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 shrink-0">
                <div className="bg-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-1 right-1 opacity-10 pointer-events-none">
                        <TrendingUp size={28} className="text-crm-600" />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Gross Volume</p>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">{formatCurrency(metrics.totalRevenue)}</h3>
                    <div className="mt-1.5 flex items-center gap-1 text-emerald-600 font-bold text-[10px] bg-emerald-50 w-fit px-1.5 py-0.5 rounded-full">
                        <ArrowUpRight size={11} /> +{metrics.growth}% from last month
                    </div>
                </div>

                <div className="bg-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-1 right-1 opacity-10 pointer-events-none">
                        <CheckCircle2 size={28} className="text-emerald-600" />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Collected</p>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">{formatCurrency(metrics.collectedAmount)}</h3>
                    <div className="mt-1.5 text-slate-400 text-[9px] font-bold uppercase tracking-widest">
                        {((metrics.collectedAmount / metrics.totalRevenue) * 100 || 0).toFixed(1)}% Settlement Rate
                    </div>
                </div>

                <div className="bg-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-1 right-1 opacity-10 pointer-events-none">
                        <AlertCircle size={28} className="text-amber-600" />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Pending Balance</p>
                    <h3 className="text-sm sm:text-base font-black text-amber-600 leading-tight">{formatCurrency(metrics.pendingAmount)}</h3>
                    <div className="mt-1.5 text-slate-400 text-[9px] font-bold uppercase tracking-widest">
                        Awaiting from {invoiceRows.filter((row: InvoiceRow) => row.payment.status !== 'paid').length} clients
                    </div>
                </div>

                <div className="bg-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden border-l-4 border-l-crm-500">
                    <div className="absolute top-1 right-1 opacity-10 pointer-events-none">
                        <FileText size={28} className="text-crm-600" />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Active Invoices</p>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">{invoiceRows.length}</h3>
                    <div className="mt-1.5 text-slate-400 text-[9px] font-bold uppercase tracking-widest">
                        {metrics.confirmedCount} Fully Confirmed
                    </div>
                </div>
            </div>

            {/* Main Section */}
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                    {/* Toolbar */}
                    <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 flex flex-col md:flex-row gap-2 sm:gap-3 items-center justify-between shrink-0">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Search by customer or invoice #"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-crm-500 font-medium"
                            />
                        </div>
                        <div className="flex items-center gap-2 self-end max-w-full overflow-x-auto">
                            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                        statusFilter === 'all'
                                            ? 'bg-white text-crm-600 shadow-sm'
                                            : 'text-slate-500'
                                    }`}
                                >
                                    All
                                </button>
                                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setStatusFilter(opt.value)}
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                            statusFilter === opt.value
                                                ? 'bg-white text-crm-600 shadow-sm'
                                                : 'text-slate-500'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <VisibleScrollArea>
                        {/* Table */}
                        <table className="w-full min-w-[1100px] text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Invoice / Customer</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Package Details</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Managed By</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Total Bill</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Amount Paid</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Settlement</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {visibleInvoiceRows.map(({ booking: b, payment }: InvoiceRow) => {
                                    const paidDisplay = formatCurrency(payment.amountPaid);

                                    return (
                                        <tr key={b.id} className="group hover:bg-slate-50/80 transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-white transition-colors"><User size={20} /></div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800">{b.customer}</div>
                                                        <div className="text-[10px] font-black text-crm-600 tracking-widest">{getTrackingId(b)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                                    <Building size={14} className="text-slate-400" />
                                                    {b.package}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1">
                                                    <Calendar size={12} /> {b.dates}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="text-xs font-bold text-slate-700">{b.agentName || 'Agency'}</div>
                                                <div className="text-[10px] text-slate-400 font-medium">Internal ID: {b.agentId}</div>
                                            </td>
                                            <td className="px-8 py-5 font-black text-slate-900 text-sm whitespace-nowrap">
                                                {formatCurrency(payment.total)}
                                            </td>
                                            <td className="px-8 py-5">
                                                {payment.status === 'partial' ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="relative w-40">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                                                                {currencySymbol}
                                                            </span>
                                                            <NumberInput
                                                                min={toInputAmount(1)}
                                                                max={toInputAmount(Math.max(1, payment.total - 1))}
                                                                step={priceInputStep}
                                                                defaultValue={formatInputValue(payment.amountPaid)}
                                                                key={`partial-paid-${b.id}-${payment.amountPaid}`}
                                                                onBlur={(e) => handlePartialPaidAmountChange(b, e.target.value)}
                                                                className="w-full pl-7 pr-3 py-2 border border-amber-200 rounded-xl text-sm font-black text-emerald-600 bg-amber-50/50 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-100"
                                                                title="Enter amount received so far"
                                                            />
                                                        </div>
                                                        <span className="text-[9px] text-slate-400 font-semibold">
                                                            Pending: {formatCurrency(payment.amountDue)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span
                                                        className={`font-black text-sm whitespace-nowrap ${payment.amountPaid > 0 ? 'text-emerald-600' : 'text-slate-500'}`}
                                                    >
                                                        {paidDisplay}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="relative inline-flex crm-select-wrap">
                                                <select
                                                    value={payment.status}
                                                    onChange={(e) =>
                                                        handlePaymentStatusChange(
                                                            b,
                                                            e.target.value as PaymentSettlementStatus
                                                        )
                                                    }
                                                    className={`min-w-[150px] px-3 py-2 pr-8 border rounded-xl text-xs font-bold focus:outline-none appearance-none cursor-pointer ${getPaymentStatusColorClasses(payment.status, 'select')}`}
                                                    title="Payment status"
                                                >
                                                    {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <DropdownChevron size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-70" />
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setSelectedInvoice(b)}
                                                        className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-crm-600 hover:border-crm-200 transition-all shadow-sm"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedInvoice(b);
                                                            setTimeout(() => window.print(), 500);
                                                        }}
                                                        className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-crm-600 hover:border-crm-200 transition-all shadow-sm"
                                                        title="Download Invoice"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {visibleInvoiceRows.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200">
                                                    <FileText size={32} />
                                                </div>
                                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No financial records found</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </VisibleScrollArea>
                </div>
            </div>

            {/* Professional Paper-Style Invoice Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center print:bg-white print:p-0">
                    {/* Premium Black Glass Backdrop (Blurred & Tinted) */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-[20px] -z-10 transition-all duration-500"
                        onClick={() => setSelectedInvoice(null)}
                    ></div>

                    {/* Fixed Controls (Floating Above Everything) */}
                    <div className="fixed top-8 right-8 flex gap-4 z-[120] print:hidden">
                        <button
                            onClick={() => window.print()}
                            className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:bg-slate-50 transition-all flex items-center gap-3 active:scale-95"
                        >
                            <Download size={18} /> Print / Save PDF
                        </button>
                        <button
                            onClick={() => setSelectedInvoice(null)}
                            className="bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-2xl transition-all active:scale-95"
                            title="Exit Preview"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Scrollable Document Container */}
                    <div className="w-full h-full overflow-y-auto flex flex-col items-center py-12 px-4">
                        {/* The Paper (A4-Style Container) */}
                        <div
                            id="printable-invoice"
                            className="bg-white w-[210mm] min-h-[297mm] p-16 shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col rounded-[40px] overflow-hidden print:rounded-none print:shadow-none print:w-[200mm] print:p-8 print:m-0"
                        >
                            {/* Letterhead Header */}
                            <div className="flex justify-between items-start mb-12 border-b-4 border-slate-900 pb-8">
                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex items-center justify-center text-3xl font-black shadow-xl overflow-hidden">
                                            {invoiceBranding?.logoUrl ? (
                                                <img src={invoiceBranding.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                (invoiceBranding?.name || agencyName).charAt(0)
                                            )}
                                        </div>
                                        <div>
                                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{invoiceBranding?.name || agencyName}</h1>
                                            <p className="text-[10px] font-black text-crm-600 tracking-[0.3em] uppercase mt-1">Premium Travel Management</p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest space-y-1 leading-relaxed">
                                        {invoiceBranding?.address && <p>{invoiceBranding.address}</p>}
                                        {invoiceBranding?.email && <p>Support: {invoiceBranding.email}</p>}
                                        {invoiceBranding?.gstDetails && (
                                            <p className="text-slate-900 font-black">GSTIN: {invoiceBranding.gstDetails}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-5xl font-black text-slate-100 uppercase tracking-tighter mb-4 leading-none">INVOICE</h2>
                                    <div className="space-y-1">
                                        <p className="text-base font-black text-slate-900">NO: {getTrackingId(selectedInvoice)}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DATE: {new Date().toLocaleDateString('en-GB')}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Client & Itinerary */}
                            <div className="grid grid-cols-2 gap-12 mb-12">
                                <div className="bg-slate-50 p-6 rounded-[1.5rem]">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">Client Information</p>
                                    <h3 className="text-xl font-black text-slate-900 mb-1">{selectedInvoice.customer}</h3>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">{selectedInvoice.customer.toLowerCase().replace(/\s/g, '.')}@example.com</p>
                                </div>
                                <div className="p-6">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">Itinerary Details</p>
                                    <h3 className="text-lg font-black text-slate-800 mb-1">{selectedInvoice.package}</h3>
                                    <p className="text-xs text-slate-500 font-bold italic">{selectedInvoice.dates}</p>
                                </div>
                            </div>

                            {/* Invoice Table */}
                            <div className="flex-1">
                                <table className="w-full text-left mb-10">
                                    <thead>
                                        <tr className="border-y-4 border-slate-900">
                                            <th className="py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Service Description</th>
                                            <th className="py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center">Qty</th>
                                            <th className="py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="py-8">
                                                <div className="font-black text-slate-900 text-sm mb-1">{selectedInvoice.package}</div>
                                                <p className="text-[10px] text-slate-400 font-bold leading-relaxed max-w-sm">
                                                    Complete travel package with airfare and accommodation.
                                                </p>
                                            </td>
                                            <td className="py-8 text-center text-xs font-black text-slate-600">01</td>
                                            <td className="py-8 text-right text-sm font-black text-slate-900">{getUnifiedBudgetForBooking(selectedInvoice, db)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-4">
                                                <div className="font-bold text-slate-700 text-[10px]">Taxes & Service Fees</div>
                                            </td>
                                            <td className="py-4 text-center text-[10px] font-bold text-slate-500">01</td>
                                            <td className="py-4 text-right text-[10px] font-bold text-slate-500">₹0</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Totals Section */}
                                <div className="flex justify-end mb-12">
                                    <div className="w-72 border-4 border-slate-900 p-6 rounded-2xl">
                                        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                            <span>Subtotal</span>
                                            <span className="text-slate-900">{getUnifiedBudgetForBooking(selectedInvoice, db)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                                            <span>Taxes (0%)</span>
                                            <span className="text-slate-900">₹0</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-4 border-t-4 border-slate-900">
                                            <span className="text-[11px] font-black uppercase tracking-tighter">Grand Total</span>
                                            <span className="text-2xl font-black text-crm-600">{getUnifiedBudgetForBooking(selectedInvoice, db)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Signatory */}
                            <div className="grid grid-cols-2 gap-10 items-end pt-10 border-t-2 border-slate-100 mt-auto">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Important Notes</p>
                                    <ul className="text-[8px] text-slate-400 font-bold uppercase space-y-1 list-none">
                                        <li>• System generated document.</li>
                                        {invoiceBranding?.address ? (
                                            <li>• Subject to local jurisdiction.</li>
                                        ) : (
                                            <li>• Subject to jurisdiction.</li>
                                        )}
                                    </ul>
                                </div>
                                <div className="text-right">
                                    <div className="inline-block border-b-2 border-slate-400 w-56 mb-3 h-16 opacity-30"></div>
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Authorized Signatory</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Accounts Dept.</p>
                                </div>
                            </div>
                            <AgencyBankDetailsBlock details={agencyBankDetails} variant="print" />
                        </div>
                    </div>
                </div>
            )}
            {/* Consolidated Sales Report Modal */}
            {showSalesReport && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center print:bg-white print:p-0">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-[20px] -z-10 transition-all duration-500"
                        onClick={() => setShowSalesReport(false)}
                    ></div>

                    {/* Fixed Controls */}
                    <div className="fixed top-8 right-8 flex gap-4 z-[120] print:hidden">
                        {hasPlanFeature('csvExport') && (
                        <button
                            onClick={() => {
                                const headers = ['Tracking ID', 'Booking Ref', 'Customer', 'Package', 'Agent', 'Total Bill', 'Paid', 'Status', 'Date'];
                                const rows = visibleInvoiceRows.map(({ booking: b, payment }: InvoiceRow) => [
                                    `"${getTrackingId(b)}"`,
                                    `"${b.id}"`,
                                    `"${b.customer}"`,
                                    `"${b.package}"`,
                                    `"${b.agentName || 'Agency'}"`,
                                    `"${payment.total}"`,
                                    `"${payment.amountPaid}"`,
                                    `"${payment.status}"`,
                                    `"${b.dates}"`
                                ]);
                                const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.setAttribute('href', url);
                                link.setAttribute('download', `sales-report-${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-emerald-700 transition-all flex items-center gap-3 active:scale-95"
                        >
                            <Download size={18} /> Download CSV
                        </button>
                        )}
                        <button
                            onClick={() => window.print()}
                            className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-slate-50 transition-all flex items-center gap-3 active:scale-95"
                        >
                            <FileText size={18} /> Print Report
                        </button>
                        <button
                            onClick={() => setShowSalesReport(false)}
                            className="bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-2xl transition-all active:scale-95"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Scrollable Document */}
                    <div className="w-full h-full overflow-y-auto flex flex-col items-center py-12 px-4">
                        <div
                            id="printable-report"
                            className="bg-white w-[210mm] min-h-[297mm] p-16 shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col rounded-[40px] overflow-hidden print:rounded-none print:shadow-none print:w-[200mm] print:p-8 print:m-0"
                        >
                            {/* Report Header */}
                            <div className="flex justify-between items-start mb-12 border-b-4 border-slate-900 pb-8">
                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex items-center justify-center text-3xl font-black shadow-xl">
                                            {agencyName.charAt(0)}
                                        </div>
                                        <div>
                                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{agencyName}</h1>
                                            <p className="text-[10px] font-black text-crm-600 tracking-[0.3em] uppercase mt-1">Consolidated Financial Report</p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest space-y-1">
                                        <p>Report Period: {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                                        <p>Generated On: {new Date().toLocaleDateString('en-GB')} at {new Date().toLocaleTimeString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-5xl font-black text-slate-100 uppercase tracking-tighter mb-4 leading-none">REPORT</h2>
                                    <p className="text-xs font-black text-slate-900">REF: SR-{Math.floor(Math.random() * 10000)}</p>
                                </div>
                            </div>

                            {/* Summary Cards in Report */}
                            <div className="grid grid-cols-3 gap-6 mb-12">
                                <div className="bg-slate-900 text-white p-6 rounded-3xl">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Gross Volume</p>
                                    <h4 className="text-xl font-black text-crm-400">{formatCurrency(metrics.totalRevenue)}</h4>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Collected</p>
                                    <h4 className="text-xl font-black text-emerald-600">{formatCurrency(metrics.collectedAmount)}</h4>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Outstanding Dues</p>
                                    <h4 className="text-xl font-black text-red-600">{formatCurrency(metrics.pendingAmount)}</h4>
                                </div>
                            </div>

                            {/* Detailed Table */}
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Detailed Transaction Log</p>
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-y-2 border-slate-900">
                                            <th className="py-4 text-[9px] font-black text-slate-900 uppercase tracking-widest">Date / ID</th>
                                            <th className="py-4 text-[9px] font-black text-slate-900 uppercase tracking-widest">Customer / Agent</th>
                                            <th className="py-4 text-[9px] font-black text-slate-900 uppercase tracking-widest text-right">Status</th>
                                            <th className="py-4 text-[9px] font-black text-slate-900 uppercase tracking-widest text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {visibleInvoiceRows.map(({ booking: b, payment }: InvoiceRow) => (
                                            <tr key={b.id}>
                                                <td className="py-4">
                                                    <div className="font-black text-slate-900 text-[10px]">{b.dates}</div>
                                                    <p className="text-[8px] text-crm-600 font-black">{getTrackingId(b)}</p>
                                                    <p className="text-[8px] text-slate-400 font-bold">Ref: {b.id}</p>
                                                </td>
                                                <td className="py-4">
                                                    <div className="font-bold text-slate-700 text-[10px]">{b.customer}</div>
                                                    <p className="text-[8px] text-slate-400 font-medium">Agent: {b.agentName || 'Main'}</p>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${getPaymentStatusColorClasses(payment.status, 'badge')}`}>
                                                        {getPaymentStatusLabel(payment.status)}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-right font-black text-slate-900 text-[10px] whitespace-nowrap">
                                                    {formatCurrency(payment.total)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Report Footer */}
                            <div className="pt-10 border-t-2 border-slate-100 mt-auto flex justify-between items-end">
                                <div>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Confidential Financial Data</p>
                                    <p className="text-[8px] text-slate-300 font-bold uppercase italic">This report is strictly for internal agency use only.</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Aumento Finance Engine</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Verified Digital Record</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Finance;
