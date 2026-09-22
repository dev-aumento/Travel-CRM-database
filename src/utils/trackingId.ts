export const TRACKING_ID_LENGTH = 6;

const randomDigits = (length: number) => {
    let out = '';
    for (let i = 0; i < length; i += 1) {
        out += Math.floor(Math.random() * 10).toString();
    }
    // keep first digit non-zero for cleaner IDs
    if (out[0] === '0') {
        out = `${Math.floor(Math.random() * 9) + 1}${out.slice(1)}`;
    }
    return out;
};

/** Normalize numeric tracking IDs to a fixed 6-digit format. */
export const normalizeTrackingId = (value?: string | null): string => {
    const digits = String(value || '').trim().replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length > TRACKING_ID_LENGTH) {
        return digits.slice(-TRACKING_ID_LENGTH);
    }
    return digits.padStart(TRACKING_ID_LENGTH, '0');
};

/** Display helper — always shows the canonical 6-digit tracking ID. */
export const formatTrackingId = (value?: string | null): string => {
    const normalized = normalizeTrackingId(value);
    return normalized || '-';
};

export const trackingIdsMatch = (a?: string | null, b?: string | null): boolean => {
    const left = normalizeTrackingId(a);
    const right = normalizeTrackingId(b);
    return !!left && !!right && left === right;
};

const isValidTrackingId = (value: string) =>
    /^\d+$/.test(value) && value.length === TRACKING_ID_LENGTH;

export const generateTrackingId = (existingIds: string[] = []) => {
    const taken = new Set(
        existingIds
            .map((id) => normalizeTrackingId(id))
            .filter((id) => isValidTrackingId(id))
    );
    for (let i = 0; i < 100; i += 1) {
        const candidate = randomDigits(TRACKING_ID_LENGTH);
        if (!taken.has(candidate)) return candidate;
    }
    return randomDigits(TRACKING_ID_LENGTH);
};

export const ensureTrackingId = (value?: string | null, existingIds: string[] = []) => {
    const taken = new Set(
        existingIds
            .map((id) => normalizeTrackingId(id))
            .filter((id) => isValidTrackingId(id))
    );
    const normalized = normalizeTrackingId(value);
    if (normalized && isValidTrackingId(normalized) && !taken.has(normalized)) {
        return normalized;
    }
    return generateTrackingId(existingIds);
};
