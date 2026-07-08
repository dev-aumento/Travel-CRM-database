import {
    formatVoucherDateTime,
    getStayCheckDates,
    mealPlanVoucherLabel,
} from './hotelBookingIds';
import { findLeadForBooking } from './databaseSync';
import {
    resolveQuoteEmailSender,
    sendQuoteEmail,
    type EmailJsConfig,
    type QuoteEmailDraft,
} from './quoteShareEmail';

const escapeHtml = (value: unknown) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

export type BookingVoucherContext = {
    booking: any;
    quote: any | null;
    lead: any | null;
    hotelStays: any[];
    tripId: string;
    departureDate: string;
    customerName: string;
    travelers: string;
    hotelTier: string;
    agencyName: string;
    agencyAddress?: string;
    agencyPhone?: string;
    agencyEmail?: string;
    customerEmail: string | null;
};

/** Resolve hotel stays and trip details for a confirmed booking. */
export const resolveBookingVoucherContext = (booking: any, db: any): BookingVoucherContext | null => {
    if (!booking) return null;

    const leads = db?.leads?.data || [];
    const quotations = db?.quotations?.data || [];
    const settings = db?.settings?.data?.[0];

    const lead = findLeadForBooking(booking, leads) || null;

    let quote: any =
        (booking.quoteId && quotations.find((q: any) => q.id === booking.quoteId)) ||
        quotations.find(
            (q: any) =>
                (q.leadId === lead?.id || q.customer === booking.customer) &&
                (q.status === 'confirmed' || q.id === lead?.confirmedQuoteId)
        ) ||
        quotations
            .filter((q: any) => q.customer === booking.customer)
            .sort((a: any, b: any) =>
                String(b.version || '1').localeCompare(String(a.version || '1'), undefined, {
                    numeric: true,
                })
            )[0] ||
        null;

    const hotelStays = (
        Array.isArray(booking.hotelStays) && booking.hotelStays.length > 0
            ? booking.hotelStays
            : quote?.hotelStays
    )?.filter((s: any) => s?.hotelId && Number(s.nights) > 0) || [];

    if (hotelStays.length === 0 && !quote?.hotelTier && !booking.hotelTier) {
        return null;
    }

    const tripId =
        booking.trackingId ||
        booking.tripId ||
        quote?.tripId ||
        quote?.trackingId ||
        lead?.trackingId ||
        '—';

    const departureDate =
        booking.departureDate ||
        quote?.departureDate ||
        lead?.startDate ||
        '';

    const customerEmail =
        lead?.email ||
        booking.email ||
        quote?.email ||
        quote?.customerEmail ||
        null;

    const agent = resolveQuoteEmailSender(db, {
        quote: quote || { agentId: booking.agentId, customer: booking.customer },
        userEmail: booking.agentId,
        currentAgentId: booking.agentId,
    });

    return {
        booking,
        quote,
        lead,
        hotelStays,
        tripId: String(tripId),
        departureDate,
        customerName: booking.customer || quote?.customer || lead?.name || 'Guest',
        travelers: booking.travelers || quote?.travelers || lead?.travelers || '—',
        hotelTier: quote?.hotelTier || booking.hotelTier || 'Standard',
        agencyName: settings?.agencyName || 'Travel Agency',
        agencyAddress: settings?.agencyAddress,
        agencyPhone: settings?.phone || settings?.supportPhone,
        agencyEmail: settings?.supportEmail || settings?.email,
        customerEmail: customerEmail && !String(customerEmail).endsWith('@example.com') ? customerEmail : null,
    };
};

const buildStayVoucherHtml = (
    stay: any,
    stayIdx: number,
    allStays: any[],
    ctx: BookingVoucherContext,
    hotels: any[]
) => {
    const hotel = hotels.find((h: any) => h.id === stay.hotelId);
    const hotelName = hotel?.name || stay.hotelInput || 'Hotel';
    const bookingId = stay.hotelBookingId || stay.bookingCnf || '—';
    const { checkIn, checkOut } = getStayCheckDates(ctx.departureDate, stayIdx, allStays);
    const checkInLabel = formatVoucherDateTime(checkIn, '12:00 hrs');
    const checkOutLabel = formatVoucherDateTime(checkOut, '10:00 hrs');
    const mealPlan = mealPlanVoucherLabel(stay.mealPlan);
    const roomDesc = `${stay.rooms || 1} ${stay.roomType || 'Room'} (${stay.personsPerRoom || 2} Pax${
        (stay.extraBed || 0) > 0 ? ` + ${stay.extraBed} extra bed` : ''
    })`;

    return `
    <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#0f172a;color:#fff;padding:12px 16px;font-weight:bold;font-size:14px;">
        Hotel Voucher — ${escapeHtml(hotelName)}
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;width:36%;color:#64748b;font-weight:bold;">Trip ID</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(ctx.tripId)}</strong></td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:bold;">Hotel Booking ID</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(bookingId)}</strong></td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:bold;">Guest Name</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(ctx.customerName)}</strong></td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:bold;">Travelers</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(ctx.travelers)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:bold;">Hotel</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(hotelName)}${hotel?.location ? ` — ${escapeHtml(hotel.location)}` : ''}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:bold;">Check-in</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(checkInLabel)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:bold;">Check-out</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(checkOutLabel)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:bold;">Room / Pax</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(roomDesc)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:bold;">Meal Plan</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(mealPlan)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;color:#64748b;font-weight:bold;">Category</td>
          <td style="padding:10px 12px;">${escapeHtml(ctx.hotelTier)} Tier</td>
        </tr>
      </table>
    </div>`;
};

export const buildHotelVoucherEmailHtml = (ctx: BookingVoucherContext, db: any): string => {
    const hotels = db?.hotels?.data || [];
    const stays = ctx.hotelStays;

    const stayBlocks =
        stays.length > 0
            ? stays
                  .map((stay, idx) => buildStayVoucherHtml(stay, idx, stays, ctx, hotels))
                  .join('')
            : `<p style="font-family:Arial,sans-serif;font-size:14px;color:#334155;">${escapeHtml(ctx.hotelTier)} tier accommodation as per confirmed booking.</p>`;

    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#f8fafc;">
  <div style="max-width:640px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;">
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#64748b;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.1em;">${escapeHtml(ctx.agencyName)}</p>
    <h1 style="font-family:Arial,sans-serif;font-size:20px;color:#0f172a;margin:0 0 8px;">Hotel Voucher — Booking Confirmed</h1>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#475569;margin:0 0 20px;">
      Dear ${escapeHtml(ctx.customerName)},<br/>
      Please find your hotel confirmation details below. Present this voucher at check-in.
    </p>
    ${stayBlocks}
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;margin-top:24px;">
      ${ctx.agencyPhone ? `Phone: ${escapeHtml(ctx.agencyPhone)}<br/>` : ''}
      ${ctx.agencyEmail ? `Email: ${escapeHtml(ctx.agencyEmail)}` : ''}
    </p>
  </div>
</body>
</html>`;
};

export const buildHotelVoucherEmailPlainText = (ctx: BookingVoucherContext, db: any): string => {
    const html = buildHotelVoucherEmailHtml(ctx, db);
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

export const buildHotelVoucherEmailSubject = (ctx: BookingVoucherContext) =>
    `Hotel Voucher — ${ctx.customerName} — Trip ${ctx.tripId}`;

export const buildHotelVoucherDraft = (
    ctx: BookingVoucherContext,
    db: any,
    sender: { fromEmail: string },
    subjectOverride?: string
): QuoteEmailDraft => ({
    to: ctx.customerEmail || '',
    subject: subjectOverride?.trim() || buildHotelVoucherEmailSubject(ctx),
    htmlBody: buildHotelVoucherEmailHtml(ctx, db),
    plainBody: buildHotelVoucherEmailPlainText(ctx, db),
    fromEmail: sender.fromEmail,
    customerName: ctx.customerName,
});

export const buildHotelVoucherWhatsappText = (ctx: BookingVoucherContext): string => {
    const stays = (ctx.hotelStays || []).map((stay: any) => {
        const bookingId = stay.hotelBookingId || stay.bookingCnf || '—';
        const nights = Number(stay.nights) || 1;
        const roomType = stay.roomType || 'Room';
        const mealPlan = mealPlanVoucherLabel(stay.mealPlan);
        return `• Booking ID ${bookingId}: ${nights} night(s), ${roomType}, ${mealPlan}`;
    });

    const details = stays.length > 0 ? stays.join('\n') : '• Hotel stay details as per your confirmed booking';

    return [
        `Hello ${ctx.customerName},`,
        '',
        `Your hotel voucher is ready for Trip ${ctx.tripId}.`,
        `Travelers: ${ctx.travelers}`,
        '',
        details,
        '',
        `Regards,`,
        `${ctx.agencyName}`,
    ].join('\n');
};

export const sendHotelVoucherEmail = async (
    ctx: BookingVoucherContext,
    db: any,
    emailJsConfig: EmailJsConfig | null,
    sender: { fromName: string; fromEmail: string },
    subjectOverride?: string
) => {
    if (!ctx.customerEmail) {
        return {
            ok: false,
            method: 'emailjs' as const,
            error: 'No customer email on this booking. Add an email on the lead record.',
        };
    }

    const draft = buildHotelVoucherDraft(ctx, db, sender, subjectOverride);

    return sendQuoteEmail(draft, { fromName: sender.fromName, fromEmail: sender.fromEmail }, emailJsConfig);
};
