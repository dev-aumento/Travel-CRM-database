import type { PricingResult } from './pricing';
import { parseTravelers } from './pricing';

export type QuoteLineItem = {
    desc: string;
    sub: string;
    qty: string;
    price: number;
    total: number;
};

export const buildQuoteLineItems = (params: {
    pricing: PricingResult;
    travelerCount: number;
    hotelSub: string;
    flightDesc: string;
    visaSub: string;
    activitiesSub: string;
    visaCost: number;
    formFlightMeal: { optIn: boolean; type: string };
    formNeedFlight: boolean;
}): QuoteLineItem[] => {
    const {
        pricing,
        travelerCount,
        hotelSub,
        flightDesc,
        visaSub,
        activitiesSub,
        visaCost,
        formFlightMeal,
        formNeedFlight,
    } = params;
    const items: QuoteLineItem[] = [
        {
            desc: 'Hotel Accommodation',
            sub: hotelSub,
            qty: pricing.travelersLabel,
            price: Math.round(pricing.breakdown.hotel / travelerCount),
            total: pricing.breakdown.hotel,
        },
    ];
    if (formNeedFlight !== false) {
        items.push({
            desc: 'Return Flights',
            sub: flightDesc,
            qty: pricing.travelersLabel,
            price: Math.round(pricing.breakdown.flights / travelerCount),
            total: pricing.breakdown.flights,
        });
        if (formFlightMeal.optIn) {
            const flightMealsTotal = pricing.breakdown.flightMeals ?? 0;
            items.push({
                desc: 'Flight Meals',
                sub: `${formFlightMeal.type} Meals`,
                qty: pricing.travelersLabel,
                price: Math.round(flightMealsTotal / travelerCount),
                total: flightMealsTotal,
            });
        }
    }
    if (formNeedFlight !== false && (pricing.breakdown.visa || 0) > 0) {
        items.push({
            desc: 'Visa Charges',
            sub: visaSub,
            qty: pricing.travelersLabel,
            price: visaCost,
            total: pricing.breakdown.visa,
        });
    }
    items.push({
        desc: 'Activities',
        sub: activitiesSub,
        qty: '1',
        price: pricing.breakdown.activity,
        total: pricing.breakdown.activity,
    });
    if ((pricing.breakdown.vehicle || 0) > 0) {
        items.push({
            desc: 'Travel Vehicle',
            sub: 'Vehicle for itinerary activities',
            qty: '1',
            price: pricing.breakdown.vehicle || 0,
            total: pricing.breakdown.vehicle || 0,
        });
    }
    if ((pricing.breakdown.transfer || 0) > 0) {
        items.push({
            desc: 'Transfers',
            sub: 'Ground / seaplane transfers',
            qty: '1',
            price: pricing.breakdown.transfer,
            total: pricing.breakdown.transfer,
        });
    }
    if ((pricing.breakdown.hotelExtras || 0) > 0) {
        items.push({
            desc: 'Hotel Extras',
            sub: 'Extra bed & special inclusions',
            qty: '1',
            price: pricing.breakdown.hotelExtras || 0,
            total: pricing.breakdown.hotelExtras || 0,
        });
    }
    return items;
};

export const buildAdditionalActivityLineItems = (quote: any): QuoteLineItem[] =>
    (quote?.additionalActivities || [])
        .filter((row: any) => String(row?.title || '').trim())
        .map((row: any) => {
            const total = Math.max(0, Number(row?.rate) || 0);
            return {
                desc: String(row.title).trim(),
                sub: String(row.description || '').trim() || 'Additional activity',
                qty: '1',
                price: total,
                total,
            };
        });

export const buildHotelSubLabel = (quote: any, db: any, preset: any, hotelTier: string) => {
    const hotelStays = quote?.hotelStays || [];
    if (hotelStays.length > 0) {
        return hotelStays
            .map((stay: any) => {
                const hotel = (db?.hotels?.data || []).find((row: any) => row.id === stay.hotelId);
                return `${stay.nights}N ${hotel?.name || 'Selected Hotel'}`;
            })
            .join(' • ');
    }
    const selectedHotel = (db?.hotels?.data || []).find((h: any) => h.id === quote?.hotelId);
    if (selectedHotel) {
        return `${selectedHotel.name} (${hotelTier})`;
    }
    return `${preset?.hotelDesc || 'Hotel'} (${hotelTier} Tier)`;
};

export const buildQuoteLineItemsFromQuote = (
    quote: any,
    pricing: PricingResult,
    db: any
): QuoteLineItem[] => {
    const travelers = parseTravelers(quote?.travelers);
    const travelerCount = Math.max(1, travelers.adults + travelers.kids);
    const preset = pricing.preset;
    const flightMeal = quote?.flightMeal || quote?.flightDetails
        ? {
              optIn: Boolean(quote?.flightMeal?.optIn ?? quote?.flightDetails?.mealOpt),
              type: quote?.flightMeal?.type || quote?.flightDetails?.mealType || 'Veg',
          }
        : { optIn: false, type: 'Veg' };

    return [
        ...buildQuoteLineItems({
            pricing,
            travelerCount,
            hotelSub: buildHotelSubLabel(quote, db, preset, quote?.hotelTier || 'Standard'),
            flightDesc: preset?.flightDesc || 'Return Flights',
            visaSub: 'Standard Processing Fee',
            activitiesSub: 'Curated experiences & transfers',
            visaCost: preset?.visaCost || 0,
            formFlightMeal: flightMeal,
            formNeedFlight: quote?.needFlight !== false,
        }),
        ...buildAdditionalActivityLineItems(quote),
    ];
};
