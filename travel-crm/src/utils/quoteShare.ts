import {
    formatTermsForEmail,
    formatTermsForWhatsApp,
    type QuoteTermsRecord,
} from './quoteTerms';

const getDurationDays = (duration?: string) => {
    if (!duration) return 0;
    const dayMatch = duration.match(/(\d+)\s*Day/i);
    if (dayMatch) return parseInt(dayMatch[1], 10);
    const nightMatch = duration.match(/(\d+)\s*Night/i);
    if (nightMatch) return parseInt(nightMatch[1], 10) + 1;
    return 0;
};

const getDurationDaysLabel = (duration?: string) => {
    const days = getDurationDays(duration);
    return days > 0 ? `${days} Days` : duration || 'N/A';
};

const resolveHotelName = (hotelId: string, hotels: any[] = [], fallback?: string) => {
    const h = hotels.find((row: any) => row.id === hotelId);
    return h?.name || fallback || 'Selected Hotel';
};

type QuoteHotelDetail = {
    name: string;
    nights: number | null;
    roomType: string | null;
    mealPlan?: string;
};

const getQuoteHotelDetails = (quote: any, hotels: any[] = []): QuoteHotelDetail[] => {
    if (!quote) return [];
    const stays = Array.isArray(quote.hotelStays)
        ? quote.hotelStays.filter((s: any) => s?.hotelId && Number(s.nights) > 0)
        : [];
    if (stays.length > 0) {
        return stays.map((stay: any) => ({
            name: resolveHotelName(stay.hotelId, hotels, stay.hotelInput),
            nights: Number(stay.nights),
            roomType: stay.roomType || 'Standard Room',
            mealPlan: stay.mealPlan || quote.hotelMealPlan,
        }));
    }
    if (quote.hotelId) {
        const nights = Math.max(1, getDurationDays(quote.duration) - 1);
        return [{
            name: resolveHotelName(quote.hotelId, hotels),
            nights,
            roomType: 'Standard Room',
            mealPlan: quote.hotelMealPlan,
        }];
    }
    const hotelItem = quote.items?.find((i: any) => i.desc?.toLowerCase().includes('hotel'));
    if (hotelItem?.sub) {
        return [{ name: hotelItem.sub, nights: null, roomType: null, mealPlan: quote.hotelMealPlan }];
    }
    return [];
};

const formatItinerarySection = (itinerary: any[], format: 'whatsapp' | 'email') => {
    if (!Array.isArray(itinerary) || itinerary.length === 0) return '';
    return itinerary
        .map((day: any, idx: number) => {
            const dayLabel = day.title || `Day ${idx + 1}`;
            const heading = format === 'whatsapp' ? `*${dayLabel}*` : dayLabel;
            const acts = (day.activities || [])
                .map((a: any) => `  • ${a.title || a.name || 'Activity'}`)
                .join('\n');
            return acts ? `${heading}\n${acts}` : `${heading}\n  • Leisure / Free time`;
        })
        .join('\n\n');
};

const formatHotelSection = (quote: any, hotels: any[] = [], format: 'whatsapp' | 'email') => {
    const tripId = quote.tripId || quote.trackingId;
    const stays = Array.isArray(quote.hotelStays)
        ? quote.hotelStays.filter((s: any) => s?.hotelId && Number(s.nights) > 0)
        : [];
    const bold = (text: string) => (format === 'whatsapp' ? `*${text}*` : text);

    if (stays.length > 0) {
        const lines = stays.map((stay: any) => {
            const h = hotels.find((row: any) => row.id === stay.hotelId);
            const name = h?.name || stay.hotelInput || 'Hotel';
            const bookingId = stay.hotelBookingId || stay.bookingCnf || '—';
            const hotelLine =
                format === 'whatsapp'
                    ? `🏨 ${bold(name)} (${stay.nights}N)`
                    : `${name} (${stay.nights} night${stay.nights > 1 ? 's' : ''})`;
            return `${hotelLine}\n   Booking ID: ${bold(String(bookingId))} | ${stay.roomType || 'Room'} | ${stay.mealPlan || ''}`;
        });
        const tripLine = tripId ? `\nTrip ID: ${tripId}` : '';
        const tierLine = quote.hotelTier ? `\nCategory: ${quote.hotelTier}` : '';
        return lines.join('\n') + tripLine + tierLine;
    }

    const details = getQuoteHotelDetails(quote, hotels);
    if (details.length === 0) {
        return quote.hotelTier ? `Category: ${quote.hotelTier} Tier` : '';
    }
    const lines = details.map((d: QuoteHotelDetail) => {
        const nightsPart = d.nights ? ` (${d.nights} Night${d.nights > 1 ? 's' : ''})` : '';
        const roomPart = d.roomType ? ` | ${d.roomType}` : '';
        const mealPart = d.mealPlan ? ` | ${d.mealPlan}` : '';
        const label = format === 'whatsapp' ? `🏨 ${bold(d.name)}` : d.name;
        return `${label}${nightsPart}${roomPart}${mealPart}`;
    });
    const tierLine = quote.hotelTier ? `\nCategory: ${quote.hotelTier}` : '';
    const tripLine = tripId ? `\nTrip ID: ${tripId}` : '';
    return lines.join('\n') + tripLine + tierLine;
};

export type BuildQuoteShareParams = {
    quote: any;
    hotels: any[];
    agencyName: string;
    quoteTotal: number;
    terms: QuoteTermsRecord | null;
    trackingId: string;
    format: 'whatsapp' | 'email';
};

export const buildQuoteShareMessage = ({
    quote,
    hotels,
    agencyName,
    quoteTotal,
    terms,
    trackingId,
    format,
}: BuildQuoteShareParams): string => {
    const customerName = quote.customer || 'Traveler';
    const firstName = customerName.split(' ')[0];
    const hotelSection = formatHotelSection(quote, hotels, format);
    const itinerarySection = formatItinerarySection(quote.itinerary || [], format);
    const inclusions = (quote.items || [])
        .map((i: any) => i.desc)
        .filter(Boolean)
        .join(', ');
    const termsSection =
        format === 'whatsapp' ? formatTermsForWhatsApp(terms) : formatTermsForEmail(terms);

    const isWa = format === 'whatsapp';

    const messageParts = [
        isWa
            ? `✨ *Your Dream Trip to ${quote.destination} Awaits!* ✨`
            : `Your Dream Trip to ${quote.destination} Awaits!`,
        `Hi ${firstName},`,
        isWa
            ? `We've curated an exclusive, unforgettable ${getDurationDaysLabel(quote.duration)} experience just for you! 🌍✈️`
            : `We've curated an exclusive ${getDurationDaysLabel(quote.duration)} experience just for you.`,
        isWa
            ? `*🧾 Tracking ID:* ${trackingId}\n*📍 Destination:* ${quote.destination}\n*📅 Duration:* ${quote.duration || getDurationDaysLabel(quote.duration)}\n*👥 Travelers:* ${quote.travelers}`
            : `Tracking ID: ${trackingId}\nDestination: ${quote.destination}\nDuration: ${quote.duration || getDurationDaysLabel(quote.duration)}\nTravelers: ${quote.travelers}`,
        hotelSection ? `${isWa ? '*🏨 Your Stay:*' : 'YOUR STAY'}\n${hotelSection}` : '',
        itinerarySection
            ? `${isWa ? '*📅 Day-Wise Itinerary:*' : 'DAY-WISE ITINERARY'}\n${itinerarySection}`
            : '',
        inclusions ? `${isWa ? '*🌟 Package Includes:*' : 'Package includes:'} ${inclusions}` : '',
        isWa
            ? `💰 *Total VIP Investment:* *₹${quoteTotal.toLocaleString('en-IN')}*\n_(Includes all premier accommodations, fees, and taxes)_`
            : `Total investment: ₹${quoteTotal.toLocaleString('en-IN')}\n(Includes accommodations, fees, and taxes as quoted.)`,
        termsSection || '',
        isWa
            ? "Let me know if you'd like to secure this package before availability changes, or if you'd like to customize anything to make it even more perfect. 🥂"
            : "Let me know if you'd like to secure this package or customize anything further.",
        isWa ? `Best,\n*Your Travel Designers at ${agencyName}* ✈️` : `Best regards,\nYour Travel Designers at ${agencyName}`,
    ].filter(Boolean);

    return messageParts.join('\n\n');
};

export {
    buildQuoteEmailHtml,
    buildQuoteEmailPlainText,
    buildQuoteEmailSubject,
    resolveCustomerEmail,
    resolveEmailJsConfig,
    resolveQuoteEmailSender,
    sendQuoteEmail,
    type QuoteEmailDraft,
    type EmailJsConfig,
    type QuoteEmailSender,
} from './quoteShareEmail';

export const openWhatsAppShare = (phone: string, message: string) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) {
        alert('No phone number on this quote. Add a phone number on the lead or quotation.');
        return;
    }
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank');
};

