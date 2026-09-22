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
        // Preserve an explicit given amount (including 0) once the night row exists.
        const given =
            prev != null && prev.given != null && Number.isFinite(Number(prev.given))
                ? Math.max(0, Number(prev.given))
                : rate;
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
    return stay.nightPrices.slice(0, nights).reduce((sum, np) => {
        const given = Number(np.given);
        if (Number.isFinite(given)) return sum + given;
        return sum + (Number(np.rate) || 0);
    }, 0);
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

/** Child with bed: count × price per night × stay nights. */
export const sumStayChildWithBedTotal = (stay: {
    nights?: number;
    childWithBed?: number;
    childWithBedPrice?: number;
}): number => {
    const count = Math.max(0, Number(stay.childWithBed) || 0);
    const price = Math.max(0, Number(stay.childWithBedPrice) || 0);
    const nights = Math.max(0, Number(stay.nights) || 0);
    if (count === 0 || price === 0 || nights === 0) return 0;
    return count * price * nights;
};

/** Child without bed: count × price per night × stay nights. */
export const sumStayChildWithoutBedTotal = (stay: {
    nights?: number;
    childWithoutBed?: number;
    childWithoutBedPrice?: number;
}): number => {
    const count = Math.max(0, Number(stay.childWithoutBed) || 0);
    const price = Math.max(0, Number(stay.childWithoutBedPrice) || 0);
    const nights = Math.max(0, Number(stay.nights) || 0);
    if (count === 0 || price === 0 || nights === 0) return 0;
    return count * price * nights;
};

export const sumStayHotelTotal = (stay: {
    nights: number;
    nightPrices?: HotelNightPrice[];
    extraBed?: number;
    extraBedPrice?: number;
    childWithBed?: number;
    childWithBedPrice?: number;
    childWithoutBed?: number;
    childWithoutBedPrice?: number;
    specialInclusions?: HotelNightInclusion[];
}): number =>
    sumStayGivenTotal(stay) +
    sumStayExtraBedTotal(stay) +
    sumStayChildWithBedTotal(stay) +
    sumStayChildWithoutBedTotal(stay) +
    sumStaySpecialInclusionsTotal(stay);

export const formatHotelNightDateLabel = (date: Date) => {
    const day = date.toLocaleDateString('en-US', { weekday: 'long' });
    const datePart = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    return { datePart, day };
};

export type HotelStaySelection = {
    hotelId?: string;
    nights?: number;
    extraBed?: number;
    extraBedPrice?: number;
    childWithBed?: number;
    childWithBedPrice?: number;
    childWithoutBed?: number;
    childWithoutBedPrice?: number;
};

export const getAssignedHotelNights = (stays: HotelStaySelection[]): number =>
    stays.reduce((sum, stay) => sum + Number(stay.nights || 0), 0);

/** Extra beds require a per-bed nightly price before hotel selection can be confirmed. */
export const stayMissingExtraBedPrice = (stay: HotelStaySelection): boolean => {
    const beds = Math.max(0, Number(stay.extraBed) || 0);
    if (beds <= 0) return false;
    return !(Number(stay.extraBedPrice) > 0);
};

export const stayMissingChildBedPrice = (stay: HotelStaySelection): boolean => {
    const withBed = Math.max(0, Number(stay.childWithBed) || 0);
    if (withBed > 0 && !(Number(stay.childWithBedPrice) > 0)) return true;
    const withoutBed = Math.max(0, Number(stay.childWithoutBed) || 0);
    if (withoutBed > 0 && !(Number(stay.childWithoutBedPrice) > 0)) return true;
    return false;
};

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

    if (stays.some(stayMissingExtraBedPrice)) return false;
    if (stays.some(stayMissingChildBedPrice)) return false;

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

    if (stays.some(stayMissingExtraBedPrice)) {
        return 'Please enter an extra bed price for every stay that includes extra beds.';
    }

    if (stays.some(stayMissingChildBedPrice)) {
        return 'Please enter a price for every child with bed / without bed count you added.';
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
