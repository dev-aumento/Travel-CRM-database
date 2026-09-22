import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Hotel, Send, Loader2, CheckCircle2, AlertCircle, Download, MessageCircle } from 'lucide-react';
import HotelVoucherCard from './HotelVoucherCard';
import {
    buildHotelVoucherDraft,
    buildHotelVoucherEmailSubject,
    buildHotelVoucherWhatsappText,
    sendHotelVoucherEmail,
    type BookingVoucherContext,
} from '../utils/hotelVoucherShare';
import {
    openMailAppDraft,
    resolveEmailJsConfig,
    resolveQuoteEmailSender,
} from '../utils/quoteShareEmail';
import { canManageAgencyProfile } from '../utils/databaseSync';

type Props = {
    context: BookingVoucherContext;
    db: any;
    onClose: () => void;
    onSent?: () => void;
    updateRecord?: (table: string, id: string, updates: any) => void;
};

const mergeStayBookingIds = (stays: any[], bookingIds: string[]) =>
    stays.map((stay, idx) => {
        const cnf = String(bookingIds[idx] ?? stay.bookingCnf ?? stay.hotelBookingId ?? '').trim();
        return {
            ...stay,
            bookingCnf: cnf,
            hotelBookingId: cnf,
        };
    });

const HotelVoucherSendModal: React.FC<Props> = ({ context, db, onClose, onSent, updateRecord }) => {
    const [subject, setSubject] = useState(buildHotelVoucherEmailSubject(context));
    const [sending, setSending] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);
    const voucherPreviewRef = useRef<HTMLDivElement | null>(null);

    const sender = useMemo(
        () =>
            resolveQuoteEmailSender(db, {
                quote: context.quote || { agentId: context.booking.agentId },
                userEmail: localStorage.getItem('userEmail') || '',
                currentAgentId: localStorage.getItem('agentId') || '',
            }),
        [db, context]
    );

    const canOpenAgencyProfile = canManageAgencyProfile(
        localStorage.getItem('userRole'),
        localStorage.getItem('agentId'),
        db
    );

    const emailJsConfig = useMemo(() => {
        const agentRecord = (db?.travelAgents?.data || []).find(
            (a: any) => a.id === context.booking.agentId || a.email === context.booking.agentId
        );
        return resolveEmailJsConfig(agentRecord) || resolveEmailJsConfig(db?.settings?.data?.[0]);
    }, [db, context.booking.agentId]);

    const canSendViaApi = Boolean(
        emailJsConfig?.serviceId && emailJsConfig?.templateId && emailJsConfig?.publicKey
    );

    const hotels = db?.hotels?.data || [];
    const voucherStays = context.hotelStays;
    const canShare = voucherStays.length > 0;

    const [stayBookingIds, setStayBookingIds] = useState<string[]>(() =>
        voucherStays.map((stay) => String(stay.bookingCnf || stay.hotelBookingId || '').trim())
    );
    const stayBookingIdsRef = useRef(stayBookingIds);
    stayBookingIdsRef.current = stayBookingIds;

    useEffect(() => {
        setStayBookingIds(
            voucherStays.map((stay) => String(stay.bookingCnf || stay.hotelBookingId || '').trim())
        );
    }, [context.booking?.id, context.quote?.id, voucherStays]);

    const effectiveContext = useMemo(
        () => ({
            ...context,
            hotelStays: mergeStayBookingIds(voucherStays, stayBookingIds),
        }),
        [context, voucherStays, stayBookingIds]
    );

    const persistBookingIds = (ids: string[]) => {
        if (!updateRecord) return;
        const mergedStays = mergeStayBookingIds(voucherStays, ids);
        if (context.quote?.id) {
            updateRecord('quotations', context.quote.id, { hotelStays: mergedStays });
        }
        if (context.booking?.id) {
            updateRecord('bookings', context.booking.id, { hotelStays: mergedStays });
        }
    };

    const handleBookingIdChange = (stayIdx: number, value: string) => {
        setStayBookingIds((prev) => {
            const next = [...prev];
            next[stayIdx] = value;
            return next;
        });
    };

    const handleBookingIdBlur = () => {
        persistBookingIds(stayBookingIdsRef.current);
    };

    const draft = useMemo(
        () =>
            buildHotelVoucherDraft(
                { ...effectiveContext, customerEmail: effectiveContext.customerEmail || '' },
                db,
                { fromEmail: sender.fromEmail },
                subject
            ),
        [effectiveContext, db, sender.fromEmail, subject]
    );

    const handleSend = async () => {
        setError('');
        if (!context.customerEmail) {
            setError('Add a valid customer email on the lead or booking before sending.');
            return;
        }
        setSending(true);
        try {
            persistBookingIds(stayBookingIds);
            const result = await sendHotelVoucherEmail(
                { ...effectiveContext, customerEmail: effectiveContext.customerEmail },
                db,
                emailJsConfig,
                { fromName: sender.fromName, fromEmail: sender.fromEmail },
                subject
            );
            if (!result.ok) {
                setError(result.error || 'Could not send voucher email.');
                return;
            }
            setSent(true);
            onSent?.();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unexpected error while sending.');
        } finally {
            setSending(false);
        }
    };

    const handleDownloadPdf = async () => {
        setError('');
        if (!voucherPreviewRef.current || !canShare) {
            setError('No voucher preview is available to download.');
            return;
        }
        setDownloadingPdf(true);
        try {
            const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf'),
            ]);

            const source = voucherPreviewRef.current;
            let cloneHost: HTMLDivElement | null = null;
            cloneHost = document.createElement('div');
            cloneHost.style.position = 'fixed';
            cloneHost.style.left = '-100000px';
            cloneHost.style.top = '0';
            cloneHost.style.width = `${source.scrollWidth || source.clientWidth}px`;
            cloneHost.style.background = '#f8fafc';
            cloneHost.style.padding = '0';
            cloneHost.style.margin = '0';
            cloneHost.style.zIndex = '-1';

            const clone = source.cloneNode(true) as HTMLDivElement;
            clone.style.overflow = 'visible';
            clone.style.maxHeight = 'none';
            clone.style.height = 'auto';
            clone.style.minHeight = 'auto';
            clone.style.width = `${source.scrollWidth || source.clientWidth}px`;

            cloneHost.appendChild(clone);
            document.body.appendChild(cloneHost);

            const captureWidth = clone.scrollWidth || source.scrollWidth || source.clientWidth;
            const captureHeight = clone.scrollHeight || source.scrollHeight || source.clientHeight;

            const canvas = await html2canvas(clone, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#f8fafc',
                logging: false,
                width: captureWidth,
                height: captureHeight,
                windowWidth: captureWidth,
                windowHeight: captureHeight,
            });
            if (cloneHost.parentNode) {
                cloneHost.parentNode.removeChild(cloneHost);
            }

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const contentWidth = pageWidth - margin * 2;
            const imgHeight = (canvas.height * contentWidth) / canvas.width;

            let heightLeft = imgHeight;
            let y = margin;

            pdf.addImage(imgData, 'PNG', margin, y, contentWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pageHeight - margin * 2;

            while (heightLeft > 0) {
                pdf.addPage();
                y = margin - (imgHeight - heightLeft);
                pdf.addImage(imgData, 'PNG', margin, y, contentWidth, imgHeight, undefined, 'FAST');
                heightLeft -= pageHeight - margin * 2;
            }

            const fileSafeCustomer = String(context.customerName || 'guest')
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-')
                .toLowerCase();
            const fileSafeTrip = String(context.tripId || 'trip').replace(/[^\w-]/g, '');
            const filename = `hotel-voucher-${fileSafeCustomer || 'guest'}-${fileSafeTrip || 'trip'}.pdf`;
            pdf.save(filename);
        } catch (e) {
            setError(
                e instanceof Error
                    ? `Could not generate PDF: ${e.message}`
                    : 'Could not generate PDF.'
            );
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleOpenMailApp = () => {
        setError('');
        if (!context.customerEmail) {
            setError('Add a valid customer email on the lead or booking before opening mail app.');
            return;
        }
        const result = openMailAppDraft(draft);
        if (!result.ok) {
            setError(result.error || 'Could not open mail app.');
        } else if (result.hint) {
            setError(result.hint);
        }
    };

    const handleShareWhatsapp = () => {
        setError('');
        const phoneRaw = String(context.booking?.phone || context.lead?.phone || '').replace(/[^\d+]/g, '');
        const phone = phoneRaw.startsWith('+') ? phoneRaw.slice(1) : phoneRaw;
        persistBookingIds(stayBookingIds);
        const text = buildHotelVoucherWhatsappText(effectiveContext);
        const url = phone
            ? `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`
            : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={sending || sent ? undefined : onClose}
                aria-hidden
            />
            <div
                role="dialog"
                aria-labelledby="hotel-voucher-modal-title"
                className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
                <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                            <Hotel size={20} />
                        </div>
                        <div>
                            <h2 id="hotel-voucher-modal-title" className="text-lg font-bold text-slate-900">
                                Send hotel voucher
                            </h2>
                            <p className="text-xs text-slate-500">
                                {context.customerName} · Trip {context.tripId}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={sending}
                        className="p-2 rounded-xl text-slate-400 hover:bg-slate-200"
                    >
                        <X size={22} />
                    </button>
                </div>

                <div className="shrink-0 px-6 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-100 bg-white">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">To</label>
                        <p className="text-sm font-semibold text-slate-800">
                            {context.customerEmail || (
                                <span className="text-amber-600">No email — add on lead</span>
                            )}
                        </p>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">From</label>
                        <p className="text-sm font-semibold text-slate-800">
                            {sender.fromName}
                            <span className="text-slate-500 font-normal"> &lt;{sender.fromEmail}&gt;</span>
                        </p>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            disabled={sent || sending}
                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-slate-50"
                        />
                    </div>
                </div>

                {!canSendViaApi && !sent && (
                    <div className="shrink-0 mx-6 mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 dark:bg-amber-900/30 dark:border-amber-700/50 dark:text-white">
                        {canOpenAgencyProfile ? (
                            <>
                                Configure EmailJS under{' '}
                                <Link to="/settings" className="font-bold underline dark:text-white" onClick={onClose}>
                                    Agency Profile → Integrations
                                </Link>{' '}
                                to send vouchers directly from the CRM.
                            </>
                        ) : (
                            <>Ask your main agency agent to configure EmailJS under Agency Profile → Integrations.</>
                        )}
                    </div>
                )}

                {error && (
                    <div className="shrink-0 mx-6 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700 flex gap-2">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {sent && (
                    <div className="shrink-0 mx-6 mt-3 px-3 py-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 size={18} />
                        Hotel voucher sent to <strong>{context.customerEmail}</strong>.
                    </div>
                )}

                <div ref={voucherPreviewRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 bg-slate-50 space-y-6">
                    {voucherStays.length === 0 ? (
                        <p className="text-sm text-slate-500 italic text-center py-8">
                            No hotel stays found on this booking. Confirm a quote with hotels first.
                        </p>
                    ) : (
                        effectiveContext.hotelStays.map((stay, idx) => (
                            <HotelVoucherCard
                                key={`${stay.hotelId || stay.hotelBookingId || idx}-${idx}`}
                                stay={stay}
                                stayIdx={idx}
                                allStays={effectiveContext.hotelStays}
                                tripId={effectiveContext.tripId}
                                customerName={effectiveContext.customerName}
                                travelers={effectiveContext.travelers}
                                departureDate={effectiveContext.departureDate}
                                hotelRecord={hotels.find((h: any) => h.id === stay.hotelId)}
                                hotelTier={effectiveContext.hotelTier}
                                agencyName={effectiveContext.agencyName}
                                agencyAddress={effectiveContext.agencyAddress}
                                agencyPhone={effectiveContext.agencyPhone}
                                agencyEmail={effectiveContext.agencyEmail}
                                bookingId={stayBookingIds[idx] ?? ''}
                                onBookingIdChange={(value) => handleBookingIdChange(idx, value)}
                                onBookingIdBlur={handleBookingIdBlur}
                                editableBookingId={!sent && !sending}
                            />
                        ))
                    )}
                </div>

                <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex flex-wrap justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                            disabled={sending || downloadingPdf}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100"
                    >
                        {sent ? 'Close' : 'Cancel'}
                    </button>
                    {!sent && (
                        <>
                        <button
                            type="button"
                            onClick={handleDownloadPdf}
                            disabled={!canShare || downloadingPdf}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
                        >
                            {downloadingPdf ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Generating PDF...
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    Download PDF
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleShareWhatsapp}
                            disabled={!canShare}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 disabled:opacity-50 flex items-center gap-2"
                        >
                            <MessageCircle size={16} />
                            WhatsApp
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenMailApp}
                            disabled={!context.customerEmail || !canShare}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-blue-700 border border-blue-200 hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Send size={16} />
                            Email app
                        </button>
                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={
                                sending ||
                                !canSendViaApi ||
                                !context.customerEmail ||
                                voucherStays.length === 0
                            }
                            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {sending ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Sending…
                                </>
                            ) : (
                                <>
                                    <Send size={18} />
                                    Send via CRM email
                                </>
                            )}
                        </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HotelVoucherSendModal;
