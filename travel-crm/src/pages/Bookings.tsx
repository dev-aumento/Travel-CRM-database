import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Calendar, CheckCircle2, Clock, X, Eye, FileText, Download, User, Building, Edit2, Plus, Mail, Phone, Ban, Hotel, Lock } from 'lucide-react';
import DropdownChevron from '../components/DropdownChevron';
import HotelVoucherSendModal from '../components/HotelVoucherSendModal';
import VisibleScrollArea from '../components/VisibleScrollArea';
import { resolveBookingVoucherContext } from '../utils/hotelVoucherShare';
import CancelTripModal, { type CancelTripTarget } from '../components/CancelTripModal';
import { useDatabase } from '../context/DatabaseContext';
import {
    getUnifiedBudgetForBooking,
    getBookingPaymentDetails,
    buildBookingPaymentPatch,
    PAYMENT_STATUS_OPTIONS,
    getPaymentStatusLabel,
    getPaymentStatusColorClasses,
    type PaymentSettlementStatus,
} from '../utils/pricingConsistency';
import {
    applyTripCancellation,
    canUserEditConfirmedBooking,
    buildLeadLookupIndex,
    filterBookingsFromConfirmedLeads,
    findLeadForBookingIndexed,
    getBookingDisplayStatus,
    getPipelineStatusLabel,
    normalizePipelineStatus,
    BOOKING_PIPELINE_STATUS_OPTIONS,
    recordVisibleToSession,
    sortBookingsNewestFirst,
} from '../utils/databaseSync';
import { useAgencyBranding } from '../hooks/useAgencyBranding';
import { useCurrency } from '../hooks/useCurrency';
import { formatTrackingId } from '../utils/trackingId';
import AgencyBankDetailsBlock from '../components/AgencyBankDetailsBlock';
import { resolveAgencyBankDetails } from '../utils/agencyBankDetails';

const STATUS_OPTIONS = BOOKING_PIPELINE_STATUS_OPTIONS;

const getStatusColor = (status: string) => {
    const normalized = normalizePipelineStatus(status);
    switch (normalized) {
        case 'confirmed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'completed': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'new': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'contacted': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'itinerary': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'negotiation': return 'bg-purple-50 text-purple-700 border-purple-200';
        case 'canceled': return 'bg-rose-50 text-rose-700 border-rose-200';
        default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
};

const getPaymentBadge = (status: string) => {
    if (!status) return null;
    return (
        <span
            className={`font-semibold px-2 py-0.5 rounded text-xs border ${getPaymentStatusColorClasses(status, 'badge')}`}
        >
            {getPaymentStatusLabel(status)}
        </span>
    );
};

const BookingRow = ({ bk, leadIndex, db, updateRecord, onViewInvoice, onSendHotelVoucher, onCancelTrip, canEdit, isHighlighted }: any) => {
    const { formatMoney } = useCurrency();
    const [isExpanded, setIsExpanded] = useState(false);

    // Resolve linked lead by ID first — never pick the wrong person when names duplicate
    const linkedLead = findLeadForBookingIndexed(bk, leadIndex);
    const contactEmail = linkedLead?.email || bk.email || '';
    const contactPhone = linkedLead?.phone || bk.phone || '';
    const trackingId = formatTrackingId(bk.trackingId || linkedLead?.trackingId);
    const displayStatus = getBookingDisplayStatus(bk, linkedLead);
    const displayTotal = getUnifiedBudgetForBooking(bk, db);
    const voucherContext = useMemo(() => resolveBookingVoucherContext(bk, db), [bk, db]);

    const handlePaymentStatusChange = (status: PaymentSettlementStatus) => {
        if (!canEdit) return;
        const patch = buildBookingPaymentPatch(bk, db, status);
        updateRecord('bookings', bk.id, patch);
    };

    const handleFieldChange = (field: string, value: string) => {
        if (!canEdit) return;
        if (field === 'paymentStatus') {
            handlePaymentStatusChange(value as PaymentSettlementStatus);
            return;
        }

        if (field === 'status') {
            const pipelineStatus = normalizePipelineStatus(value);
            updateRecord('bookings', bk.id, { status: pipelineStatus });

            if (linkedLead) {
                updateRecord('leads', linkedLead.id, { status: pipelineStatus });
            }

            const quotationMatch =
                (bk.quoteId && (db.quotations?.data || []).find((q: any) => q.id === bk.quoteId)) ||
                (linkedLead?.confirmedQuoteId &&
                    (db.quotations?.data || []).find((q: any) => q.id === linkedLead.confirmedQuoteId));
            if (quotationMatch) {
                updateRecord('quotations', quotationMatch.id, { status: pipelineStatus });
            }
            return;
        }

        updateRecord('bookings', bk.id, { [field]: value });
    };

    return (
        <>
            <tr
                data-booking-id={bk.id}
                onClick={() => setIsExpanded(!isExpanded)}
                className={`border-b border-slate-100 group cursor-pointer transition-colors ${
                    isExpanded ? 'bg-crm-50/40' : 'hover:bg-slate-50 bg-white'
                } ${isHighlighted ? 'bg-crm-50/60 ring-2 ring-inset ring-crm-400' : ''}`}
            >
                <td className="px-6 py-4 font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                        <DropdownChevron open={isExpanded} size={15} className="text-slate-400" />
                        <div>
                            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded inline-block">#{trackingId}</span>
                        </div>
                    </div>
                </td>
                <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{bk.customer}</div>
                    {contactEmail && <div className="text-xs text-slate-400 mt-0.5">{contactEmail}</div>}
                </td>
                <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate" title={bk.package}>{bk.package}</td>
                <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{bk.dates}</td>
                <td className="px-6 py-4 font-bold text-slate-700">{displayTotal}</td>
                <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Status pill with integrated dropdown — hides native arrow */}
                        <div className="relative flex items-center shrink-0 crm-select-wrap">
                            {canEdit ? (
                                <>
                                    <select
                                        value={displayStatus}
                                        onChange={e => handleFieldChange('status', e.target.value)}
                                        className={`appearance-none booking-status-select text-xs font-semibold pl-3 pr-7 py-1.5 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-crm-400 ${getStatusColor(displayStatus)}`}
                                        style={{ WebkitAppearance: 'none', MozAppearance: 'none' } as any}
                                    >
                                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                    <DropdownChevron size={12} className="absolute right-2 pointer-events-none opacity-60" />
                                </>
                            ) : (
                                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${getStatusColor(displayStatus)}`}>
                                    {getPipelineStatusLabel(displayStatus)}
                                </span>
                            )}
                        </div>
                        {voucherContext && canEdit && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onSendHotelVoucher(bk); }}
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-emerald-700 bg-white p-1.5 rounded-md border border-emerald-200 shadow-sm text-emerald-600"
                                title="Send hotel voucher"
                            >
                                <Hotel size={15} />
                            </button>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); onViewInvoice(bk); }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-crm-600 bg-white p-1.5 rounded-md border border-slate-200 shadow-sm text-slate-500"
                            title="View Invoice"
                        >
                            <Eye size={15} />
                        </button>
                    </div>
                </td>
            </tr>

            {isExpanded && (
                <tr className="bg-slate-50/80 border-b border-slate-200">
                    <td colSpan={6} className="p-0">
                        <div className="px-8 py-5 animate-in slide-in-from-top-2 duration-250">
                            <div className="flex gap-5 items-start">

                                {/* ── Contact Info ── */}
                                <div className="flex-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                                    <h4 className="font-bold text-slate-700 flex items-center gap-2 pb-3 border-b border-slate-100 text-sm">
                                        <User size={15} className="text-crm-500" /> Booking Details
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8 text-sm">
                                        <div>
                                            <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Tracking ID</span>
                                            <span className="font-semibold text-crm-700">{trackingId}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Customer</span>
                                            <span className="font-medium text-slate-800">{bk.customer}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Package</span>
                                            <span className="font-medium text-slate-700 flex items-center gap-1.5 truncate" title={bk.package}><Building size={13} className="text-slate-400" />{bk.package}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Dates</span>
                                            <span className="font-medium text-slate-800 flex items-center gap-1.5"><Calendar size={13} className="text-slate-400" />{bk.dates}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Travelers</span>
                                            <span className="font-medium text-slate-800">{bk.travelers || linkedLead?.travelers || 'N/A'}</span>
                                        </div>

                                        <div>
                                            <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Source</span>
                                            <span className="font-medium text-slate-800">{bk.source || linkedLead?.source || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Airport</span>
                                            <span className="font-medium text-slate-800">{bk.sourceAirport || linkedLead?.sourceAirport || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Total Amount</span>
                                            <span className="font-bold text-slate-800 text-base">{displayTotal}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Status</span>
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black border uppercase ${getStatusColor(displayStatus)}`}>
                                                {getPipelineStatusLabel(displayStatus)}
                                            </span>
                                        </div>

                                        {contactEmail && (
                                            <div className="md:col-span-2">
                                                <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Email Address</span>
                                                <a href={`mailto:${contactEmail}`} className="font-medium text-crm-600 flex items-center gap-1.5 hover:underline">
                                                    <Mail size={13} className="text-slate-400" />{contactEmail}
                                                </a>
                                            </div>
                                        )}
                                        {contactPhone && (
                                            <div className="md:col-span-2">
                                                <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">Phone Number</span>
                                                <a href={`tel:${contactPhone}`} className="font-medium text-crm-600 flex items-center gap-1.5 hover:underline">
                                                    <Phone size={13} className="text-slate-400" />{contactPhone}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Day-wise Itinerary ── */}
                                {bk.itinerary && bk.itinerary.length > 0 && (
                                    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 max-w-[400px]">
                                        <h4 className="font-bold text-slate-700 flex items-center gap-2 pb-3 border-b border-slate-100 text-sm">
                                            <Calendar size={15} className="text-crm-500" /> Planned Itinerary
                                        </h4>
                                        <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                                            {(bk.itinerary || []).map((day: any, dIdx: number) => (
                                                <div key={dIdx} className="border border-slate-100 rounded-lg overflow-hidden">
                                                    <div className="bg-slate-50 px-3 py-2 flex justify-between items-center">
                                                        <span className="text-xs font-bold text-slate-700">{day.title}</span>
                                                        <span className="text-[10px] text-slate-400">{day.date}</span>
                                                    </div>
                                                    {day.activities && day.activities.length > 0 ? (
                                                        <div className="px-3 py-2 space-y-1.5">
                                                            {(day.activities || []).map((act: any, aIdx: number) => (
                                                                <div key={aIdx} className="flex items-center justify-between text-xs">
                                                                    <span className="text-slate-600 truncate flex-1 mr-2">
                                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-crm-400 mr-1.5 relative top-[-0.5px]"></span>
                                                                        {act.title}
                                                                    </span>
                                                                    {act.price > 0 && (
                                                                        <span className="text-crm-600 font-bold shrink-0">{formatMoney(act.price || 0)}</span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="px-3 py-2 text-[11px] text-slate-400 italic">No activities planned</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── Administration Controls ── */}
                                <div className="w-[300px] shrink-0 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                                    <h4 className="font-bold text-slate-700 flex items-center gap-2 pb-3 border-b border-slate-100 text-sm">
                                        {canEdit ? (
                                            <><Edit2 size={15} className="text-crm-500" /> Administration</>
                                        ) : (
                                            <><Lock size={15} className="text-slate-400" /> View Only</>
                                        )}
                                    </h4>

                                    {!canEdit && (
                                        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
                                            This booking is locked. Only the main agency agent can make changes after confirmation.
                                        </p>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Pipeline Stage</label>
                                        {canEdit ? (
                                            <>
                                                <select
                                                    value={displayStatus}
                                                    onChange={e => handleFieldChange('status', e.target.value)}
                                                    className="w-full booking-status-select px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-crm-500 bg-slate-50 font-medium text-slate-700"
                                                >
                                                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                                <p className="text-[10px] text-slate-400 mt-1">Changes sync to Leads pipeline live.</p>
                                            </>
                                        ) : (
                                            <div className={`w-full px-3 py-2 border rounded-lg text-sm font-medium ${getStatusColor(displayStatus)}`}>
                                                {getPipelineStatusLabel(displayStatus)}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Payment Clearance</label>
                                        {canEdit ? (
                                            <select
                                                value={getBookingPaymentDetails(bk, db).status}
                                                onChange={e => handlePaymentStatusChange(e.target.value as PaymentSettlementStatus)}
                                                className={`w-full px-3 py-2 border rounded-lg text-sm font-bold focus:outline-none ${getPaymentStatusColorClasses(getBookingPaymentDetails(bk, db).status, 'select')}`}
                                            >
                                                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className={`w-full px-3 py-2 border rounded-lg text-sm font-bold ${getPaymentStatusColorClasses(getBookingPaymentDetails(bk, db).status, 'select')}`}>
                                                {getPaymentStatusLabel(getBookingPaymentDetails(bk, db).status)}
                                            </div>
                                        )}
                                    </div>

                                    {voucherContext && canEdit && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSendHotelVoucher(bk);
                                            }}
                                            className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors"
                                        >
                                            <Hotel size={16} /> Send hotel voucher
                                        </button>
                                    )}

                                    {canEdit && normalizePipelineStatus(bk.status) !== 'canceled' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCancelTrip(bk, linkedLead);
                                            }}
                                            className="mt-auto flex items-center justify-center gap-2 w-full py-2 border border-amber-200 text-amber-800 rounded-lg text-sm font-semibold hover:bg-amber-50 transition-colors"
                                        >
                                            <Ban size={14} /> Cancel Trip
                                        </button>
                                    )}
                                </div>

                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

const Bookings = () => {
    const { db, updateRecord } = useDatabase();
    const { formatMoney } = useCurrency();
    const [searchParams] = useSearchParams();
    const [highlightedBookingId, setHighlightedBookingId] = useState('');
    
    // Auth context
    const userRole = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    const currentAgentId = localStorage.getItem('agentId');

    const sessionScope = useMemo(
        () => ({ userRole, userEmail, sessionAgentId: currentAgentId }),
        [userRole, userEmail, currentAgentId]
    );

    const bookingsData = db?.bookings?.data || [];
    const leadsData = db?.leads?.data || [];

    const leadIndex = useMemo(() => buildLeadLookupIndex(leadsData), [leadsData]);

    const bookings = useMemo(() => {
        const confirmed = filterBookingsFromConfirmedLeads(bookingsData, leadIndex, db);
        const filtered =
            userRole === 'admin'
                ? confirmed
                : confirmed.filter((b: any) =>
                      recordVisibleToSession('bookings', b, db, sessionScope)
                  );
        return sortBookingsNewestFirst(filtered, db, leadIndex);
    }, [bookingsData, leadIndex, db, userRole, sessionScope]);

    const agencyBranding = useAgencyBranding();
    const agencyName = agencyBranding.name;
    const agencyBankDetails = useMemo(
        () => resolveAgencyBankDetails(agencyBranding.settings),
        [agencyBranding.settings]
    );
    const [selectedBooking, setSelectedBooking] = useState<any>(null);
    const [voucherBooking, setVoucherBooking] = useState<any>(null);
    const [cancelTarget, setCancelTarget] = useState<CancelTripTarget | null>(null);

    const voucherModalContext = useMemo(
        () => (voucherBooking ? resolveBookingVoucherContext(voucherBooking, db) : null),
        [voucherBooking, db]
    );

    const canEditBooking = (booking: any, linkedLead?: any) =>
        canUserEditConfirmedBooking(userRole, currentAgentId, db, booking, linkedLead);

    useEffect(() => {
        const bookingId = searchParams.get('highlightBookingId');
        const focusTs = searchParams.get('focusTs');
        if (!bookingId || !focusTs) return;

        setHighlightedBookingId(bookingId);

        const scrollTimer = window.setTimeout(() => {
            const el = document.querySelector(`[data-booking-id="${bookingId}"]`) as HTMLElement | null;
            el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }, 160);

        const clearTimer = window.setTimeout(() => {
            setHighlightedBookingId('');
        }, 3200);

        return () => {
            clearTimeout(scrollTimer);
            clearTimeout(clearTimer);
        };
    }, [searchParams]);

    const openHotelVoucherModal = (booking: any) => {
        const linkedLead = findLeadForBookingIndexed(booking, leadIndex);
        if (!canEditBooking(booking, linkedLead)) return;
        const ctx = resolveBookingVoucherContext(booking, db);
        if (!ctx) {
            alert('No hotel stays found for this booking. Confirm a quote with hotels first.');
            return;
        }
        setVoucherBooking(booking);
    };
    const getBookingDisplayTotal = (booking: any) => getUnifiedBudgetForBooking(booking, db);

    const openCancelModal = (booking: any, linkedLead?: any) => {
        if (!canEditBooking(booking, linkedLead)) return;
        setCancelTarget({
            kind: 'booking',
            id: booking.id,
            trackingId: booking.trackingId || linkedLead?.trackingId,
            customerName: booking.customer,
            destination: linkedLead?.destination || booking.package,
            duration: linkedLead?.duration,
            breadcrumb: [
                booking.trackingId || linkedLead?.trackingId,
                booking.customer,
                linkedLead?.destination?.split(',')[0] || booking.package,
            ].filter(Boolean).join(' • '),
        });
    };

    const handleConfirmCancel = (payload: { reason: string; contactReminderOn: string; notes: string }) => {
        if (!cancelTarget) return;
        const booking = bookings.find((b: any) => b.id === cancelTarget.id);
        const linkedLead = findLeadForBookingIndexed(booking, leadIndex);
        if (!canEditBooking(booking, linkedLead)) return;
        applyTripCancellation(db, updateRecord, {
            bookingId: cancelTarget.id,
            leadId: linkedLead?.id,
            customerName: cancelTarget.customerName,
            payload,
        });
        if (selectedBooking?.id === cancelTarget.id) {
            setSelectedBooking(null);
        }
        setCancelTarget(null);
        alert('Trip marked as canceled.');
    };

    const handleDownloadReport = () => {
        if (bookings.length === 0) return;
        
        // Define columns
        const headers = ["Booking ID", "Tracking ID", "Customer", "Email", "Phone", "Package", "Dates", "Source", "Airport", "Total", "Status", "Payment Status", "Travelers"];
        
        // Build rows
        const rows = bookings.map((bk: any) => {
            const linkedLead = findLeadForBookingIndexed(bk, leadIndex);
            const contactEmail = linkedLead?.email || bk.email || '-';
            const contactPhone = linkedLead?.phone || bk.phone || '-';
            return [
                bk.id,
                bk.trackingId || linkedLead?.trackingId || '',
                `"${bk.customer}"`,
                `"${contactEmail}"`,
                `"${contactPhone}"`,
                `"${bk.package}"`,
                `"${bk.dates}"`,
                `"${bk.source || linkedLead?.source || '-'}"`,
                `"${bk.sourceAirport || linkedLead?.sourceAirport || '-'}"`,
                `"${getBookingDisplayTotal(bk)}"`,
                bk.status,
                bk.paymentStatus,
                `"${bk.travelers || linkedLead?.travelers || ''}"`
            ];
        });

        // Create CSV content
        const csvContent = [
            headers.join(","),
            ...rows.map((r: string[]) => r.join(","))
        ].join("\n");

        // Trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Kiro_One_Bookings_Report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6 shrink-0">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Bookings</h1>
                    <p className="text-slate-500 mt-1 text-sm">Confirmed leads only — appears here after a lead reaches Booking Confirmed in the pipeline.</p>
                </div>
                <div className="flex gap-3 shrink-0">
                    <button onClick={handleDownloadReport} className="btn-secondary flex items-center gap-2 whitespace-nowrap">
                        <Download size={18} /> Download Report
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <VisibleScrollArea>
                    <table className="w-full min-w-[960px] text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap">Booking ID</th>
                                <th className="px-6 py-4 whitespace-nowrap">Customer</th>
                                <th className="px-6 py-4 whitespace-nowrap">Package</th>
                                <th className="px-6 py-4 whitespace-nowrap">Dates</th>
                                <th className="px-6 py-4 whitespace-nowrap">Total</th>
                                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bookings.map((bk: any) => {
                                const linkedLead = findLeadForBookingIndexed(bk, leadIndex);
                                return (
                                    <BookingRow
                                        key={bk.id}
                                        bk={bk}
                                        leadIndex={leadIndex}
                                        db={db}
                                        updateRecord={updateRecord}
                                        canEdit={canEditBooking(bk, linkedLead)}
                                        onViewInvoice={setSelectedBooking}
                                        onSendHotelVoucher={openHotelVoucherModal}
                                        onCancelTrip={openCancelModal}
                                        isHighlighted={highlightedBookingId === bk.id}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </VisibleScrollArea>
            </div>



            <CancelTripModal
                target={cancelTarget}
                onClose={() => setCancelTarget(null)}
                onConfirm={handleConfirmCancel}
            />

            {voucherModalContext && (
                <HotelVoucherSendModal
                    context={voucherModalContext}
                    db={db}
                    updateRecord={updateRecord}
                    onClose={() => setVoucherBooking(null)}
                />
            )}

            {selectedBooking && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-hidden print:bg-white print:p-0">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl flex flex-col max-h-[95vh] print:max-w-none print:max-h-none print:shadow-none print:rounded-none">
                        <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-white shrink-0 print:hidden">
                            <h3 className="font-black text-slate-900 text-xl tracking-tight flex items-center gap-3"><FileText className="text-crm-500" size={22} />Invoice {formatTrackingId(selectedBooking.trackingId)}</h3>
                            <div className="flex gap-2">
                                <button onClick={() => window.print()} className="px-3 py-1.5 bg-crm-600 text-white text-sm font-medium rounded-lg hover:bg-crm-700 flex items-center gap-2"><Download size={16} /> Print PDF</button>
                                <button type="button" onClick={() => setSelectedBooking(null)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"><X size={20} /></button>
                            </div>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1 bg-white print:p-0" id="invoice-print-area">
                            {(() => {
                                const linkedLeadInvoice = findLeadForBookingIndexed(selectedBooking, leadIndex);
                                const invoiceCanEdit = canEditBooking(selectedBooking, linkedLeadInvoice);
                                const invoiceEmail = linkedLeadInvoice?.email || selectedBooking.email || '';
                                const invoicePhone = linkedLeadInvoice?.phone || selectedBooking.phone || '';
                                return (
                                    <>
                                        <div className="flex justify-between items-start mb-10">
                                            <div>
                                                <h2 className="text-2xl font-bold text-crm-800">{agencyName}</h2>
                                                <p className="text-slate-500">Invoice / Receipt {formatTrackingId(selectedBooking.trackingId)}</p>
                                            </div>
                                            <div className="text-right">
                                                <h3 className="font-semibold text-slate-800">{selectedBooking.customer}</h3>
                                                {invoiceEmail && (
                                                    <p className="text-slate-400 text-xs">{invoiceEmail}</p>
                                                )}
                                                {invoicePhone && (
                                                    <p className="text-slate-400 text-xs">{invoicePhone}</p>
                                                )}
                                                <p className="text-slate-500 text-sm mt-1">{selectedBooking.package}</p>
                                                <p className="text-slate-500 text-sm">Travel Dates: {selectedBooking.dates}</p>
                                                <p className="text-crm-700 text-xs font-semibold mt-1">Tracking ID: {formatTrackingId(selectedBooking.trackingId || linkedLeadInvoice?.trackingId)}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-8 border-l-4 border-l-crm-500">
                                            <div className="grid grid-cols-2 gap-y-6 text-sm">
                                                <div>
                                                    <p className="text-slate-500 mb-1 font-medium uppercase tracking-wider text-[10px]">Origin / Departure From</p>
                                                    <p className="font-bold text-slate-800 text-base flex items-center gap-2">
                                                        {(selectedBooking as any).sourceCountryFlag || '🇮🇳'} 
                                                        {String(selectedBooking.sourceAirport || linkedLeadInvoice?.sourceAirport || (selectedBooking as any).sourceAirportCode || 'BOM').split(' ')[0]}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500 mb-1 font-medium uppercase tracking-wider text-[10px]">Payment Status</p>
                                                    {invoiceCanEdit ? (
                                                        <select
                                                            value={getBookingPaymentDetails(selectedBooking, db).status}
                                                            onChange={(e) => {
                                                                const patch = buildBookingPaymentPatch(
                                                                    selectedBooking,
                                                                    db,
                                                                    e.target.value as PaymentSettlementStatus
                                                                );
                                                                updateRecord('bookings', selectedBooking.id, patch);
                                                                setSelectedBooking({ ...selectedBooking, ...patch });
                                                            }}
                                                            className={`w-full px-3 py-2 border rounded-lg text-sm font-bold focus:outline-none ${getPaymentStatusColorClasses(getBookingPaymentDetails(selectedBooking, db).status, 'select')}`}
                                                        >
                                                            {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <p className={`w-full px-3 py-2 border rounded-lg text-sm font-bold ${getPaymentStatusColorClasses(getBookingPaymentDetails(selectedBooking, db).status, 'select')}`}>
                                                            {getPaymentStatusLabel(getBookingPaymentDetails(selectedBooking, db).status)}
                                                        </p>
                                                    )}
                                                </div>
                                                <div><p className="text-slate-500 mb-1 font-medium uppercase tracking-wider text-[10px]">Total Disbursement</p><p className="font-bold text-crm-600 text-lg">{getBookingDisplayTotal(selectedBooking)}</p></div>
                                                <div><p className="text-slate-500 mb-1 font-medium uppercase tracking-wider text-[10px]">Settlement Status</p><p className="font-bold text-slate-800 capitalize text-base">{selectedBooking.status}</p></div>
                                                <div className="pt-2 border-t border-slate-100"><p className="text-slate-500 mb-0.5 text-[10px] uppercase font-bold">Amount Paid</p><p className="font-bold text-emerald-600">{getBookingPaymentDetails(selectedBooking, db).amountPaidFormatted || formatMoney(0)}</p></div>
                                                <div className="pt-2 border-t border-slate-100"><p className="text-slate-500 mb-0.5 text-[10px] uppercase font-bold">Due Installment</p><p className="font-bold text-red-600">{selectedBooking.nextDue !== '-' ? selectedBooking.nextDue : 'No Action Required'}</p></div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                            <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                        <tr><th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold text-right">Amount</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr><td className="px-4 py-4">Total Package Disbursement</td><td className="px-4 py-4 text-right font-medium">{getBookingDisplayTotal(selectedBooking)}</td></tr>
                                    </tbody>
                                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-800">
                                        <tr><td className="px-4 py-3 text-right">Grand Total</td><td className="px-4 py-3 text-right">{getBookingDisplayTotal(selectedBooking)}</td></tr>
                                    </tfoot>
                                </table>
                            </div>
                            <p className="text-sm text-slate-500"><span className="font-semibold text-slate-700">Terms: </span>Balances must be settled before departure. This invoice is electronically generated by {agencyName}.</p>
                            <AgencyBankDetailsBlock details={agencyBankDetails} variant="print" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Bookings;