/** Trip + per-stay hotel booking reference IDs for vouchers and check-in. */

const isNumericId = (value: string, minLen: number, maxLen: number) =>
    new RegExp(`^\\d{${minLen},${maxLen}}$`).test(value);

export const generateTripId = (existingIds: string[] = []): string => {
    const taken = new Set(existingIds.map((id) => String(id || '').trim()).filter(Boolean));
    for (let i = 0; i < 60; i += 1) {
        const candidate = String(Math.floor(1_000_000 + Math.random() * 9_000_000));
        if (!taken.has(candidate)) return candidate;
    }
    return String(Date.now()).slice(-7);
};

export const generateHotelBookingId = (existingIds: string[] = []): string => {
    const taken = new Set(existingIds.map((id) => String(id || '').trim()).filter(Boolean));
    for (let i = 0; i < 60; i += 1) {
        const candidate = String(Math.floor(10_000 + Math.random() * 90_000));
        if (!taken.has(candidate)) return candidate;
    }
    return String(Date.now()).slice(-5);
};

export const ensureTripId = (value?: string | null, existingIds: string[] = []) => {
    const normalized = String(value || '').trim();
    if (isNumericId(normalized, 6, 8)) return normalized;
    return generateTripId(existingIds);
};

export const ensureHotelBookingId = (value?: string | null, existingIds: string[] = []) => {
    const normalized = String(value || '').trim();
    if (isNumericId(normalized, 4, 6)) return normalized;
    return generateHotelBookingId(existingIds);
};

export const collectReferenceIds = (db: any): string[] => {
    const ids: string[] = [];
    (db?.leads?.data || []).forEach((l: any) => {
        if (l.trackingId) ids.push(String(l.trackingId));
        if (l.tripId) ids.push(String(l.tripId));
    });
    (db?.quotations?.data || []).forEach((q: any) => {
        if (q.tripId) ids.push(String(q.tripId));
        if (q.trackingId) ids.push(String(q.trackingId));
        (q.hotelStays || []).forEach((s: any) => {
            if (s.hotelBookingId) ids.push(String(s.hotelBookingId));
            if (s.bookingCnf) ids.push(String(s.bookingCnf));
        });
    });
    (db?.bookings?.data || []).forEach((b: any) => {
        if (b.trackingId) ids.push(String(b.trackingId));
    });
    return ids;
};

export const getStayCheckDates = (
    departureDate: string,
    stayIdx: number,
    stays: Array<{ nights: number }>
) => {
    const offset = stays
        .slice(0, stayIdx)
        .reduce((sum, s) => sum + Math.max(1, Number(s.nights) || 1), 0);
    const nights = Math.max(1, Number(stays[stayIdx]?.nights) || 1);
    const checkIn = departureDate ? new Date(departureDate) : new Date();
    if (Number.isNaN(checkIn.getTime())) {
        return { checkIn: new Date(), checkOut: new Date(), nights };
    }
    checkIn.setDate(checkIn.getDate() + offset);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + nights);
    return { checkIn, checkOut, nights };
};

export const formatVoucherDateTime = (date: Date, time: string) => {
    const datePart = date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    return `${datePart} at ${time}`;
};

export const mealPlanVoucherLabel = (mealPlan?: string) => {
    const plan = String(mealPlan || '').toUpperCase();
    if (plan.includes('MAP')) return 'Dinner + Breakfast';
    if (plan.includes('AP')) return 'Breakfast + Lunch + Dinner';
    if (plan.includes('CP')) return 'Breakfast';
    if (plan.includes('EP')) return 'Room Only';
    return mealPlan || 'As per plan';
};
