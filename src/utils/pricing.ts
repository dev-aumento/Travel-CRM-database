// Shared package presets & pricing logic used across Quotations, Leads, and Bookings.
// Any change to traveler counts must flow through calculateQuote() to guarantee consistency.

export const packagePresets = [
    {
        id: 'p1',
        name: "Bali Luxury Escape",
        destination: "Bali, Indonesia",
        duration: "5 Nights / 6 Days",
        hotelCost: 98000, hotelDesc: "The Kayon Resort (Jungle Pool Villa)",
        flightCost: 140000, flightDesc: "Return Flights (Economy)",
        activityCost: 35000, activityDesc: "Ubud Tour & Uluwatu Sunset",
        transferCost: 24000, transferDesc: "Private AC Car (6 days)",
        visaCost: 3500 // per person
    },
    {
        id: 'p2',
        name: "Paris Romance",
        destination: "Paris, France",
        duration: "4 Nights / 5 Days",
        hotelCost: 150000, hotelDesc: "Hotel Pullman Paris (Eiffel View)",
        flightCost: 98000, flightDesc: "Return Flights (Direct)",
        activityCost: 54000, activityDesc: "Louvre Tour & River Cruise Dinner",
        transferCost: 14000, transferDesc: "Airport Luxury Transfers",
        visaCost: 8500 // per person
    },
    {
        id: 'p3',
        name: "Dubai Skyline VIP",
        destination: "Dubai, UAE",
        duration: "6 Nights / 7 Days",
        hotelCost: 195000, hotelDesc: "Atlantis The Palm (Ocean View)",
        flightCost: 155000, flightDesc: "Emirates (Economy)",
        activityCost: 68000, activityDesc: "Burj Khalifa VIP & Desert Safari",
        transferCost: 25000, transferDesc: "G-Class Private Chauffeur",
        visaCost: 6500 // per person
    },
    {
        id: 'p4',
        name: "Swiss Alps Adventure",
        destination: "Zurich & Zermatt, Switzerland",
        duration: "7 Nights / 8 Days",
        hotelCost: 230000, hotelDesc: "Omnia Mountain Lodge",
        flightCost: 115000, flightDesc: "SWISS Air (Economy)",
        activityCost: 78000, activityDesc: "Ski Pass & Glacier Express Tickets",
        transferCost: 32000, transferDesc: "Swiss Travel Pass (1st Class)",
        visaCost: 9000 // per person
    },
    {
        id: 'p5',
        name: "Maldives Overwater Bliss",
        destination: "Malé, Maldives",
        duration: "4 Nights / 5 Days",
        hotelCost: 280000, hotelDesc: "Soneva Jani (Overwater Villa)",
        flightCost: 85000, flightDesc: "Indigo/Maldivian (Direct)",
        activityCost: 45000, activityDesc: "Sunset Dolphin Cruise & Snorkeling",
        transferCost: 42000, transferDesc: "Seaplane Transfers",
        visaCost: 0 // on arrival
    },
    {
        id: 'p6',
        name: "Singapore City Lights",
        destination: "Singapore",
        duration: "3 Nights / 4 Days",
        hotelCost: 120000, hotelDesc: "Marina Bay Sands",
        flightCost: 65000, flightDesc: "Singapore Airlines",
        activityCost: 38000, activityDesc: "Gardens by the Bay & Universal Studios",
        transferCost: 12000, transferDesc: "Private Mercedes Transfer",
        visaCost: 3500
    },
    {
        id: 'p7',
        name: "London Royal Heritage",
        destination: "London, UK",
        duration: "5 Nights / 6 Days",
        hotelCost: 190000, hotelDesc: "The Savoy",
        flightCost: 125000, flightDesc: "British Airways",
        activityCost: 55000, activityDesc: "London Eye & Windsor Castle Tour",
        transferCost: 18000, transferDesc: "Private Black Cab Service",
        visaCost: 12000
    },
    {
        id: 'p8',
        name: "New York Skyline",
        destination: "New York, USA",
        duration: "6 Nights / 7 Days",
        hotelCost: 210000, hotelDesc: "The Plaza Hotel",
        flightCost: 165000, flightDesc: "Air India/United (Direct)",
        activityCost: 62000, activityDesc: "Empire State & Statue of Liberty VIP",
        transferCost: 22000, transferDesc: "Private SUV Chauffeur",
        visaCost: 15500
    },
    {
        id: 'p9',
        name: "Phuket Tropical Nest",
        destination: "Phuket, Thailand",
        duration: "5 Nights / 6 Days",
        hotelCost: 165000, hotelDesc: "Keemala Phuket (Treehouse Pool Villa)",
        flightCost: 88000, flightDesc: "Thai Airways (Return)",
        activityCost: 42000, activityDesc: "Phi Phi Island & Elephant Sanctuary",
        transferCost: 18000, transferDesc: "Private PVT Transfer",
        visaCost: 2500
    },
    {
        id: 'p10',
        name: "Bangkok Metropolitan Luxury",
        destination: "Bangkok, Thailand",
        duration: "4 Nights / 5 Days",
        hotelCost: 85000, hotelDesc: "Banyan Tree Bangkok (Serenity Club)",
        flightCost: 72000, flightDesc: "Air India (Direct)",
        activityCost: 32000, activityDesc: "Grand Palace & Floating Market",
        transferCost: 15000, transferDesc: "VIP Mercedes S-Class",
        visaCost: 2500
    },
    {
        id: 'p11',
        name: "Maldives Underwater Magic",
        destination: "Malé, Maldives",
        duration: "5 Nights / 6 Days",
        hotelCost: 420000, hotelDesc: "Anantara Kihavah (Beach Pool Villa)",
        flightCost: 95000, flightDesc: "SriLankan Airlines (Business)",
        activityCost: 85000, activityDesc: "Underwater Dining & Manta Ray Snorkeling",
        transferCost: 55000, transferDesc: "Private Seaplane",
        visaCost: 0
    },
    {
        id: 'p12',
        name: "Zermatt Peak Luxury",
        destination: "Zermatt, Switzerland",
        duration: "6 Nights / 7 Days",
        hotelCost: 380000, hotelDesc: "The Omnia (Matterhorn Suite)",
        flightCost: 145000, flightDesc: "Lufthansa (Economy Premium)",
        activityCost: 95000, activityDesc: "Matterhorn Glacier Paradise & Glacier Express",
        transferCost: 42000, transferDesc: "Swiss Rail Pass (1st Class)",
        visaCost: 9000
    },
    {
        id: 'p13',
        name: "New York Fifth Ave Elite",
        destination: "New York, USA",
        duration: "5 Nights / 6 Days",
        hotelCost: 320000, hotelDesc: "The Plaza New York (Legacy Suite)",
        flightCost: 185000, flightDesc: "United Airlines (Business)",
        activityCost: 75000, activityDesc: "Broadway Front Row & Summit One Vanderbilt",
        transferCost: 35000, transferDesc: "Private Cadillac Escalade",
        visaCost: 15500
    },
    {
        id: 'p14',
        name: "Santorini Sunset Dream",
        destination: "Santorini, Greece",
        duration: "4 Nights / 5 Days",
        hotelCost: 380000, hotelDesc: "Canaves Oia Luxury Suites",
        flightCost: 110000, flightDesc: "Emirates (Return)",
        activityCost: 45000, activityDesc: "Private Yacht & Oia Sunset Dinner",
        transferCost: 22000, transferDesc: "Private VIP Minivan",
        visaCost: 9000
    },
    {
        id: 'p15',
        name: "Tokyo & Kyoto Explorer",
        destination: "Tokyo & Kyoto, Japan",
        duration: "7 Nights / 8 Days",
        hotelCost: 480000, hotelDesc: "Park Hyatt Tokyo & Ritz Kyoto",
        flightCost: 165000, flightDesc: "JAL First Class (Return)",
        activityCost: 110000, activityDesc: "Skytree, TeamLab, & Gion Tea Ceremony",
        transferCost: 35000, transferDesc: "Shinkansen Green Pass",
        visaCost: 4500
    },
    {
        id: 'p16',
        name: "Sydney & Great Reef",
        destination: "Sydney & Cairns, Australia",
        duration: "8 Nights / 9 Days",
        hotelCost: 420000, hotelDesc: "Park Hyatt Sydney & Silky Oaks",
        flightCost: 195000, flightDesc: "Qantas (Premium)",
        activityCost: 135000, activityDesc: "Opera House VIP & Reef Helicopter",
        transferCost: 45000, transferDesc: "Private Chauffeur Service",
        visaCost: 6500
    },
    {
        id: 'p17',
        name: "Italian Heritage Grand",
        destination: "Rome & Venice, Italy",
        duration: "6 Nights / 7 Days",
        hotelCost: 295000, hotelDesc: "Hotel Artemide & St. Regis Venice",
        flightCost: 125000, flightDesc: "Air France (Business)",
        activityCost: 85000, activityDesc: "Colosseum VIP & Private Gondola",
        transferCost: 32000, transferDesc: "Private Water Taxi & High-Speed Rail",
        visaCost: 9000
    },
    {
        id: 'p18',
        name: "Vietnam Heritage Discovery",
        destination: "Da Nang & Ha Long, Vietnam",
        duration: "5 Nights / 6 Days",
        hotelCost: 195000, hotelDesc: "InterContinental Danang & Heritage Line",
        flightCost: 75000, flightDesc: "VietJet (Business)",
        activityCost: 55000, activityDesc: "Ba Na Hills & Ha Long Bay Luxury Cruise",
        transferCost: 18000, transferDesc: "Private VIP Transfer",
        visaCost: 2500
    },
    {
        id: 'p19',
        name: "Cappadocia Magic",
        destination: "Cappadocia, Turkey",
        duration: "4 Nights / 5 Days",
        hotelCost: 145000, hotelDesc: "Argos in Cappadocia (Cave Suite)",
        flightCost: 95000, flightDesc: "Turkish Airlines (Direct)",
        activityCost: 48000, activityDesc: "Hot Air Balloon & Red Valley Trek",
        transferCost: 12000, transferDesc: "Private PVT Transfer",
        visaCost: 5500
    }
];

export interface PackagePreset {
    id: string;
    name: string;
    destination: string;
    duration: string;
    hotelCost: number;
    hotelDesc: string;
    flightCost: number;
    flightDesc: string;
    activityCost: number;
    activityDesc: string;
    transferCost: number;
    transferDesc: string;
    visaCost: number;
}

export const MEAL_RATES = {
    'Veg': 0,
    'Non-Veg': 0,
    'Vegan': 0
};

export const HOTEL_MEAL_RATES = {
    'EP (Room Only)': 0,
    'CP (Breakfast Only)': 450,
    'MAP (Half Board)': 1250,
    'AP (Full Board)': 2200
};

export const HOTEL_TIER_MULTIPLIERS = {
    'Standard': 1.0,
    'Deluxe': 1.3,
    'Luxury': 1.8
};

export interface PricingInput {
    presetId: string;
    adults: number;
    kids: number;
    kidsAges?: number[];
    itinerary?: any[]; // Dynamic days from builder
    flightMeal?: {
        optIn: boolean;
        type: 'Veg' | 'Non-Veg' | 'Vegan';
    };
    hotelTier?: string;
    hotelId?: string;
    customHotelRate?: number;
    hotelStays?: Array<{
        hotelId: string;
        nights: number;
        rooms?: number;
        extraBed?: number;
        extraBedPrice?: number;
        childWithBed?: number;
        childWithBedPrice?: number;
        childWithoutBed?: number;
        childWithoutBedPrice?: number;
        nightPrices?: Array<{ rate?: number; given?: number }>;
    }>;
    hotelMealPlan?: string;
    needFlight?: boolean;
    customFlightTotal?: number;
    /** Travel vehicle for itinerary activities (flat package rate). */
    vehiclePrice?: number;
    /** package = Use Template; custom = Build Custom Plan */
    tripMode?: 'package' | 'custom';
}

export interface PricingResult {
    perPersonBase: number;
    adultTotal: number;
    kidTotal: number;
    subtotal: number;
    taxes: number;
    total: number;
    travelersLabel: string;
    budgetFormatted: string;
    preset: PackagePreset;
    mealCharge: number;
    activitySum: number;
    breakdown: {
        hotel: number;
        flights: number;
        visa: number;
        activity: number;
        transfer: number;
        vehicle?: number;
        meals?: number;
        flightMeals?: number;
        hotelMeals?: number;
        hotelExtras?: number;
    };
}

import {
    getHotelTierMultiplier,
    sumStayGivenTotal,
    sumStayExtraBedTotal,
    sumStayChildWithBedTotal,
    sumStayChildWithoutBedTotal,
    sumStaySpecialInclusionsTotal,
} from './hotelStayPricing';

/**
 * Central pricing engine v3.0 (Dynamic)
 * Hotel is calculated per night based on itinerary length.
 * Activities are summed individually from the itinerary.
 * Kids pricing is age-weighted.
 */
export function calculateQuote(input: PricingInput, customPresets?: PackagePreset[], customHotels?: any[]): PricingResult {
    const all = customPresets ? [...packagePresets, ...customPresets] : packagePresets;
    const hotels = customHotels || [];

    if (!input.presetId) {
        return {
            perPersonBase: 0, adultTotal: 0, kidTotal: 0, subtotal: 0, taxes: 0, total: 0,
            travelersLabel: `${input.adults} Adults`,
            budgetFormatted: '₹ 0',
            preset: all[0], // Keep a valid preset object for structure, but zero out values
            mealCharge: 0,
            activitySum: 0,
            breakdown: { hotel: 0, hotelExtras: 0, flights: 0, visa: 0, activity: 0, transfer: 0 }
        };
    }

    const preset = all.find(p => p.id === input.presetId) || all.find(p => p.id === guessPresetFromDestination(input.presetId));

    if (!preset) {
        const fallbackPreset = all[0]; // Bali as absolute safety
        return {
            perPersonBase: 0, adultTotal: 0, kidTotal: 0, subtotal: 0, taxes: 0, total: 0,
            travelersLabel: `${input.adults} Adults`,
            budgetFormatted: '₹ 0',
            preset: fallbackPreset,
            mealCharge: 0,
            activitySum: 0,
            breakdown: { hotel: 0, hotelExtras: 0, flights: 0, visa: 0, activity: 0, transfer: 0 }
        };
    }

    // Determine Nights: From Itinerary (Days - 1) or Preset Default
    const nights = (input.itinerary && input.itinerary.length > 0)
        ? input.itinerary.length - 1
        : parseDurationNights(preset.duration);

    // Dynamic Activity Summing (Sum of all activities in all days)
    let totalActivityCharge = 0;
    if (input.itinerary && input.itinerary.length > 0) {
        input.itinerary.forEach(day => {
            if (day.activities && Array.isArray(day.activities)) {
                day.activities.forEach((act: any) => {
                    // Uses 'customPrice' if set by user, otherwise fallback to library base price
                    totalActivityCharge += (act.customPrice ?? act.price ?? 0);
                });
            }
        });
    }

    const getHotelRatePerPersonPerNight = (hotelId?: string) => {
        const selectedHotel = (hotels as any[]).find(h => h.id === hotelId);
        if (input.customHotelRate) return input.customHotelRate;
        if (selectedHotel) {
            const tier = input.hotelTier || 'Standard';
            const standard = selectedHotel.standardRate || 5000;
            if (tier === 'Luxury') return (selectedHotel.luxuryRate || standard * 1.8) / 2;
            if (tier === 'Deluxe') return (selectedHotel.deluxeRate || standard * 1.3) / 2;
            if (tier === 'Standard') return standard / 2;
            return (standard * getHotelTierMultiplier(tier)) / 2;
        }
        const presetNightsValue = parseDurationNights(preset.duration);
        let fallbackRate = ((preset.hotelCost || 100000) / 2) / presetNightsValue;
        fallbackRate *= getHotelTierMultiplier(input.hotelTier || 'Standard');
        return fallbackRate;
    };

    const flightRatePerPerson = (preset.flightCost || 120000) / 2;
    const visaRatePerPerson = (preset.visaCost || 5000);
    const transferRatePerPerson = ((preset.transferCost || 20000) / 2); // Base transfer

    const getKidFactor = (age?: number) => {
        if (typeof age !== 'number' || Number.isNaN(age)) return 0.6;
        if (age <= 2) return 0.1;    // infant
        if (age <= 5) return 0.4;    // toddler
        if (age <= 11) return 0.6;   // child
        if (age <= 17) return 0.85;  // teen
        return 1.0;                  // adult-equivalent fallback
    };
    const normalizedKidsAges = Array.from({ length: Math.max(0, input.kids || 0) }, (_, idx) => {
        const age = input.kidsAges?.[idx];
        return typeof age === 'number' && !Number.isNaN(age) ? age : undefined;
    });
    const kidsFactorSum: number = normalizedKidsAges.reduce<number>(
        (sum: number, age) => sum + getKidFactor(age),
        0
    );
    const travelerFactor: number = input.adults + kidsFactorSum;
    const totalTravelers = input.adults + input.kids;

    const validHotelStays = (input.hotelStays || []).filter((s) => s && s.hotelId && Number(s.nights) > 0);
    const plannedNights = validHotelStays.reduce((sum, s) => sum + Number(s.nights || 0), 0);
    const normalizedHotelStays = validHotelStays.length > 0
        ? (() => {
            const capped: Array<{
                hotelId: string;
                nights: number;
                rooms?: number;
                extraBed?: number;
                extraBedPrice?: number;
                childWithBed?: number;
                childWithBedPrice?: number;
                childWithoutBed?: number;
                childWithoutBedPrice?: number;
                nightPrices?: Array<{ rate?: number; given?: number }>;
            }> = [];
            let used = 0;
            for (const stay of validHotelStays) {
                if (used >= nights) break;
                const remaining = nights - used;
                const stayNights = Math.min(remaining, Number(stay.nights || 0));
                if (stayNights > 0) {
                    capped.push({
                        hotelId: stay.hotelId,
                        nights: stayNights,
                        rooms: stay.rooms,
                        extraBed: stay.extraBed,
                        extraBedPrice: stay.extraBedPrice,
                        childWithBed: stay.childWithBed,
                        childWithBedPrice: stay.childWithBedPrice,
                        childWithoutBed: stay.childWithoutBed,
                        childWithoutBedPrice: stay.childWithoutBedPrice,
                        nightPrices: stay.nightPrices,
                    });
                    used += stayNights;
                }
            }
            return capped;
        })()
        : [];
    const sumStayAccommodation = (stay: (typeof normalizedHotelStays)[number]) => {
        const roomTotal = sumStayGivenTotal(stay as any);
        if (roomTotal > 0) return roomTotal;
        const rate = getHotelRatePerPersonPerNight(stay.hotelId);
        return rate * stay.nights * travelerFactor;
    };

    const sumStayExtras = (stay: (typeof normalizedHotelStays)[number]) => {
        if (sumStayGivenTotal(stay as any) <= 0) return 0;
        return (
            sumStayExtraBedTotal(stay as any) +
            sumStayChildWithBedTotal(stay as any) +
            sumStayChildWithoutBedTotal(stay as any) +
            sumStaySpecialInclusionsTotal(stay as any)
        );
    };

    let hotelAccommodationTotal = 0;
    let hotelExtrasTotal = 0;

    if (plannedNights > 0) {
        hotelAccommodationTotal = normalizedHotelStays.reduce(
            (sum, stay) => sum + sumStayAccommodation(stay),
            0
        );
        hotelExtrasTotal = normalizedHotelStays.reduce((sum, stay) => sum + sumStayExtras(stay), 0);
        const usedNights = normalizedHotelStays.reduce((sum, stay) => sum + stay.nights, 0);
        const remainingNights = Math.max(0, nights - usedNights);
        const fallbackStayHotelId = normalizedHotelStays[0]?.hotelId || input.hotelId;
        hotelAccommodationTotal +=
            getHotelRatePerPersonPerNight(fallbackStayHotelId) * remainingNights * travelerFactor;
    } else {
        hotelAccommodationTotal =
            getHotelRatePerPersonPerNight(input.hotelId) * nights * travelerFactor;
    }

    const hotelTotal = Math.round(hotelAccommodationTotal);
    const hotelExtras = Math.round(hotelExtrasTotal);
    const flightTotal = Math.round(flightRatePerPerson * travelerFactor);
    const visaTotal =
        input.needFlight !== false ? Math.round(visaRatePerPerson * travelerFactor) : 0;
    const hasCustomHotelPlan = validHotelStays.length > 0;
    const isCustomPlan = input.tripMode !== 'package';
    const transferTotal =
        hasCustomHotelPlan && isCustomPlan
            ? 0
            : Math.round(transferRatePerPerson * travelerFactor);

    // Summing activities: if itinerary is provided but still empty, keep preset baseline
    // so totals stay aligned with lead pricing until custom activities are added.
    const hasChosenActivities = !!(input.itinerary && input.itinerary.some(day => Array.isArray(day.activities) && day.activities.length > 0));
    // Itinerary activity prices are package/booking rates (not per-person multipliers).
    const finalActivityTotal = hasChosenActivities
        ? Math.round(totalActivityCharge)
        : Math.round(((preset.activityCost || 0) / 2) * travelerFactor);
    const vehicleTotal = Math.round(Math.max(0, Number(input.vehiclePrice) || 0));

    // Flight Meal Logic
    const flightMealChargePerPerson = (input.needFlight !== false && input.flightMeal?.optIn) ? (MEAL_RATES[input.flightMeal.type] || 0) : 0;
    const flightMealTotal = Math.round(flightMealChargePerPerson * totalTravelers);

    // Hotel meal supplements are not charged — meal plan is included in the hotel rate.
    const hotelMealTotal = 0;

    // Toggle Flight Cost
    let finalFlightTotal = input.needFlight !== false ? flightTotal : 0;
    if (input.needFlight !== false && input.customFlightTotal && input.customFlightTotal > 0) {
        finalFlightTotal = Math.round(input.customFlightTotal);
    }

    const subtotal =
        hotelTotal +
        hotelExtras +
        finalFlightTotal +
        visaTotal +
        finalActivityTotal +
        vehicleTotal +
        transferTotal +
        flightMealTotal +
        hotelMealTotal;
    const taxes = 0;
    const total = subtotal;

    const perPersonBase = Math.round(subtotal / (input.adults + input.kids));

    const travelersLabel = input.kids > 0
        ? `${input.adults} Adults, ${input.kids} Kids`
        : `${input.adults} Adults`;

    const budgetFormatted = `₹ ${total.toLocaleString('en-IN')}`;

    return {
        perPersonBase,
        adultTotal: Math.round(subtotal * (input.adults / travelerFactor)),
        kidTotal: Math.round(subtotal * (kidsFactorSum / travelerFactor)),
        subtotal,
        taxes,
        total,
        travelersLabel,
        budgetFormatted,
        preset,
        mealCharge: flightMealTotal + hotelMealTotal,
        activitySum: finalActivityTotal,
        breakdown: {
            hotel: hotelTotal,
            hotelExtras,
            flights: finalFlightTotal,
            visa: visaTotal,
            activity: finalActivityTotal,
            transfer: transferTotal,
            vehicle: vehicleTotal,
            meals: flightMealTotal + hotelMealTotal,
            flightMeals: flightMealTotal,
            hotelMeals: hotelMealTotal,
        }
    };
}

/** Package-only stay + flights (no custom hotels, activities, or meal upsells). */
export function calculatePackageBaseTravel(
    input: Pick<
        PricingInput,
        'presetId' | 'adults' | 'kids' | 'kidsAges' | 'needFlight' | 'customFlightTotal' | 'hotelTier'
    >,
    customPresets?: PackagePreset[]
): number {
    const result = calculateQuote(
        {
            presetId: input.presetId,
            adults: input.adults,
            kids: input.kids,
            kidsAges: input.kidsAges,
            hotelTier: input.hotelTier || 'Standard',
            needFlight: input.needFlight !== false,
            customFlightTotal: input.customFlightTotal,
            itinerary: [],
            hotelStays: [],
            hotelId: '',
            hotelMealPlan: 'EP (Room Only)',
            flightMeal: { optIn: false, type: 'Veg' },
        },
        customPresets,
        []
    );
    return result.breakdown.hotel + result.breakdown.flights;
}

/** @deprecated Use buildQuoteEstimateBuckets in pricingConsistency for quote-aware splits. */
export const getQuoteEstimateBuckets = (
    pricing: PricingResult,
    packageBaseTravel?: number
) => {
    const baseTravel =
        packageBaseTravel != null && packageBaseTravel > 0
            ? packageBaseTravel
            : pricing.breakdown.hotel + pricing.breakdown.flights;
    const services = Math.max(0, pricing.subtotal - baseTravel);
    return {
        baseTravel,
        services,
        subtotal: pricing.subtotal,
        taxes: pricing.taxes,
        total: pricing.total,
    };
};

/**
 * Parse an existing travelers string like "2 Adults, 1 Kids" into { adults, kids }.
 */
export function parseTravelers(str: string | undefined): { adults: number; kids: number } {
    if (!str) return { adults: 2, kids: 0 };
    const adultMatch = str.match(/(\d+)\s*Adult/i);
    const kidMatch = str.match(/(\d+)\s*Kid/i);
    return {
        adults: adultMatch ? parseInt(adultMatch[1]) : 2,
        kids: kidMatch ? parseInt(kidMatch[1]) : 0
    };
}

/**
 * Try to guess the presetId from a destination string.
 * Falls back to 'p1' (Bali) if no match.
 */
export function guessPresetFromDestination(destination: string | undefined): string {
    if (!destination) return 'p1';
    const lower = destination.toLowerCase();
    if (lower.includes('bali') || lower.includes('indonesia')) return 'p1';
    if (lower.includes('paris') || lower.includes('france')) return 'p2';
    if (lower.includes('dubai') || lower.includes('uae')) return 'p3';
    if (lower.includes('swiss') || lower.includes('zurich') || lower.includes('zermatt')) return 'p4';
    if (lower.includes('maldives') || lower.includes('male')) return 'p5';
    if (lower.includes('singapore')) return 'p6';
    if (lower.includes('london') || lower.includes('uk')) return 'p7';
    if (lower.includes('new york') || lower.includes('usa')) return 'p8';
    if (lower.includes('japan') || lower.includes('tokyo')) return 'p15';
    return 'p1';
}

/**
 * Extract the number of nights from a duration string like "5 Nights / 6 Days".
 * Returns the number (e.g. 5). Falls back to 5 if parsing fails.
 */
export function parseDurationNights(duration: string | undefined): number {
    if (!duration) return 5;
    const match = duration.match(/(\d+)\s*Night/i);
    return match ? parseInt(match[1]) : 5;
}
