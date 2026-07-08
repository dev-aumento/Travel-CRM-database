export type HotelNightInclusion = {
    id: string;
    name: string;
    amount?: number;
};

export type HotelNightPrice = {
    rate: number;
    given: number;
    specialInclusions?: HotelNightInclusion[];
};

const BUILTIN_TIER_MULTIPLIERS: Record<string, number> = {
    Standard: 1,
    Deluxe: 1.3,
    Luxury: 1.8,
};

/** Multiplier for preset fallback pricing and custom agent-defined tiers. */
export const getHotelTierMultiplier = (
    tier?: string,
    customMultipliers?: Record<string, number>
): number => {
    const key = String(tier || 'Standard').trim();
    if (!key) return 1;
    if (customMultipliers?.[key] != null) return Number(customMultipliers[key]) || 1;
    if (BUILTIN_TIER_MULTIPLIERS[key] != null) return BUILTIN_TIER_MULTIPLIERS[key];
    return 1.15;
};

export const getHotelTierRoomRate = (
    hotel: any,
    tier?: string,
    customMultipliers?: Record<string, number>
): number => {
    if (!hotel) return 0;
    const standard = Number(hotel.standardRate) || 0;
    const normalized = String(tier || 'Standard').trim();
    if (normalized === 'Luxury') return Number(hotel.luxuryRate) || standard * 1.8;
    if (normalized === 'Deluxe') return Number(hotel.deluxeRate) || standard * 1.3;
    if (normalized === 'Standard') return standard;
    return standard * getHotelTierMultiplier(normalized, customMultipliers);
};

export const buildNightPricesForStay = (
    nights: number,
    hotel: any,
    tier: string,
    rooms: number,
    existing?: HotelNightPrice[],
    customTierMultipliers?: Record<string, number>
): HotelNightPrice[] => {
    const safeNights = Math.max(1, nights);
    const catalog =
        getHotelTierRoomRate(hotel, tier, customTierMultipliers) * Math.max(1, rooms || 1);
    return Array.from({ length: safeNights }, (_, i) => {
        const prev = existing?.[i];
        const rate = Number(prev?.rate) > 0 ? Number(prev?.rate) : catalog;
        const given = Number(prev?.given) > 0 ? Number(prev!.given) : rate;
        return {
            rate,
            given,
            specialInclusions: prev?.specialInclusions,
        };
    });
};

export const sumStayGivenTotal = (stay: { nights: number; nightPrices?: HotelNightPrice[] }): number => {
    const nights = Math.max(0, Number(stay.nights) || 0);
    if (!stay.nightPrices?.length || nights === 0) return 0;
    return stay.nightPrices
        .slice(0, nights)
        .reduce((sum, np) => sum + (Number(np.given) || Number(np.rate) || 0), 0);
};

const sumInclusionRows = (rows?: HotelNightInclusion[]): number =>
    (rows || []).reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);

/** Special services added per night (and legacy stay-level rows). */
export const sumStaySpecialInclusionsTotal = (stay: {
    nights: number;
    nightPrices?: HotelNightPrice[];
    specialInclusions?: HotelNightInclusion[];
}): number => {
    const nights = Math.max(0, Number(stay.nights) || 0);
    const fromNights =
        stay.nightPrices?.slice(0, nights).reduce((sum, np) => sum + sumInclusionRows(np.specialInclusions), 0) ||
        0;
    const fromStay = sumInclusionRows(stay.specialInclusions);
    return fromNights + fromStay;
};

/** Extra bed charge: count × price per bed per night × stay nights. */
export const sumStayExtraBedTotal = (stay: {
    nights?: number;
    extraBed?: number;
    extraBedPrice?: number;
}): number => {
    const beds = Math.max(0, Number(stay.extraBed) || 0);
    const pricePerBedNight = Math.max(0, Number(stay.extraBedPrice) || 0);
    const nights = Math.max(0, Number(stay.nights) || 0);
    if (beds === 0 || pricePerBedNight === 0 || nights === 0) return 0;
    return beds * pricePerBedNight * nights;
};

export const sumStayHotelTotal = (stay: {
    nights: number;
    nightPrices?: HotelNightPrice[];
    extraBed?: number;
    extraBedPrice?: number;
    specialInclusions?: HotelNightInclusion[];
}): number =>
    sumStayGivenTotal(stay) +
    sumStayExtraBedTotal(stay) +
    sumStaySpecialInclusionsTotal(stay);

export const formatHotelNightDateLabel = (date: Date) => {
    const day = date.toLocaleDateString('en-US', { weekday: 'long' });
    const datePart = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    return { datePart, day };
};

export type HotelStaySelection = {
    hotelId?: string;
    nights?: number;
};

export const getAssignedHotelNights = (stays: HotelStaySelection[]): number =>
    stays.reduce((sum, stay) => sum + Number(stay.nights || 0), 0);

export const isHotelSelectionComplete = (
    stays: HotelStaySelection[],
    requiredNights: number,
    departureDate?: string
): boolean => {
    if (!departureDate?.trim() || requiredNights <= 0) return false;

    const validStays = stays.filter((stay) => stay.hotelId && Number(stay.nights) > 0);
    if (validStays.length === 0) return false;

    const hasIncompleteStays = stays.some((stay) => Number(stay.nights) > 0 && !stay.hotelId);
    if (hasIncompleteStays) return false;

    return getAssignedHotelNights(stays) === requiredNights;
};

export const getHotelSelectionIncompleteMessage = (
    stays: HotelStaySelection[],
    requiredNights: number,
    departureDate?: string
): string | null => {
    if (!departureDate?.trim()) {
        return 'Please set a departure date in Customer Information before confirming hotels.';
    }
    if (requiredNights <= 0) {
        return 'Package duration is not set. Complete customer details first.';
    }

    const validStays = stays.filter((stay) => stay.hotelId && Number(stay.nights) > 0);
    if (validStays.length === 0) {
        return 'Please add at least one hotel stay with a selected hotel and nights.';
    }

    const hasIncompleteStays = stays.some((stay) => Number(stay.nights) > 0 && !stay.hotelId);
    if (hasIncompleteStays) {
        return 'Every stay block with nights must have a hotel selected.';
    }

    const assignedNights = getAssignedHotelNights(stays);
    if (assignedNights < requiredNights) {
        const remaining = requiredNights - assignedNights;
        return `Please assign all ${requiredNights} package nights to hotels (${remaining} night${remaining === 1 ? '' : 's'} remaining).`;
    }
    if (assignedNights > requiredNights) {
        return `Hotel nights (${assignedNights}) exceed the package duration (${requiredNights} nights). Adjust stay blocks.`;
    }

    return null;
};
