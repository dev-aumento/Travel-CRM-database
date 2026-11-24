export interface AiItineraryActivityInput {
    id?: string;
    title?: string;
    description?: string;
    price?: number;
    category?: string;
    country?: string;
}

export interface AiItineraryHotelInput {
    name?: string;
    city?: string;
    nights?: number;
}

export interface AiItineraryInput {
    days: number;
    destination?: string;
    city?: string;
    country?: string;
    departureDate?: string;
    travelers?: string;
    hotels?: AiItineraryHotelInput[];
    activities?: AiItineraryActivityInput[];
}

export interface AiItineraryDraftActivity {
    catalogId?: string;
    title: string;
    description: string;
}

export interface AiItineraryDraftDay {
    title: string;
    activities: AiItineraryDraftActivity[];
}

export interface AiItineraryResult {
    source: 'ai' | 'library';
    days: AiItineraryDraftDay[];
}

const clampDays = (days: number) => {
    const n = Math.round(Number(days));
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(60, n));
};

const activityId = (activity: AiItineraryActivityInput) => String(activity.id || '').trim().toLowerCase();

const isArrivalTransfer = (activity: AiItineraryActivityInput) => {
    const id = activityId(activity);
    if (id === 'global-2') return true;
    return /airport arrival/i.test(String(activity.title || ''));
};

const isDepartureTransfer = (activity: AiItineraryActivityInput) => {
    const id = activityId(activity);
    if (id === 'global-3') return true;
    return /airport departure/i.test(String(activity.title || ''));
};

const isFreeDay = (activity: AiItineraryActivityInput) => {
    const id = activityId(activity);
    if (id === 'global-1') return true;
    return /free day|exploring on your own/i.test(String(activity.title || ''));
};

const formatTripDate = (departureDate: string | undefined, offset: number) => {
    if (!departureDate) return '';
    const date = new Date(departureDate);
    if (Number.isNaN(date.getTime())) return '';
    date.setDate(date.getDate() + offset);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const hotelForDay = (hotels: AiItineraryHotelInput[] | undefined, dayIndex: number, totalDays: number) => {
    const stays = (hotels || []).filter((hotel) => hotel?.name || hotel?.city);
    if (!stays.length) return null;
    if (dayIndex >= totalDays - 1) return stays[stays.length - 1];
    let cursor = 0;
    for (const stay of stays) {
        const nights = Math.max(1, Number(stay.nights) || 1);
        if (dayIndex < cursor + nights) return stay;
        cursor += nights;
    }
    return stays[stays.length - 1];
};

const placeLabel = (input: AiItineraryInput, hotel?: AiItineraryHotelInput | null) =>
    String(hotel?.city || input.city || input.destination || input.country || 'the destination').trim();

const hotelLabel = (hotel: AiItineraryHotelInput | null, place: string) =>
    String(hotel?.name || '').trim() || `your hotel in ${place}`;

const fromCatalog = (activity: AiItineraryActivityInput): AiItineraryDraftActivity => ({
    catalogId: activity.id ? String(activity.id) : undefined,
    title: String(activity.title || 'Activity').trim(),
    description: String(activity.description || '').trim(),
});

const dayTitle = (index: number, total: number, theme?: string) => {
    const day = index + 1;
    if (index === 0 && total === 1) return 'Day 1: Arrival & Departure';
    if (index === 0) return 'Day 1: Arrival';
    if (index === total - 1) return `Day ${total}: Departure`;
    const clean = String(theme || 'Sightseeing').replace(/^Day \d+:\s*/i, '').trim() || 'Sightseeing';
    return `Day ${day}: ${clean}`;
};

/** A short vault (about 5–6 activities) may repeat on later days. A larger vault is used once. */
const LIMITED_VAULT_COUNT = 6;

const activityReuseKey = (activity: { id?: string; catalogId?: string; title?: string }) => {
    const id = String(activity.catalogId || activity.id || '').trim().toLowerCase();
    if (id) return `id:${id}`;
    const title = String(activity.title || '').trim().toLowerCase();
    return title ? `title:${title}` : '';
};

const titledCatalog = (activities: AiItineraryActivityInput[] | undefined) =>
    (activities || []).filter((activity) => String(activity.title || '').trim());

const sightseeingPool = (activities: AiItineraryActivityInput[] | undefined) =>
    titledCatalog(activities).filter(
        (activity) => !isArrivalTransfer(activity) && !isDepartureTransfer(activity) && !isFreeDay(activity)
    );

const vaultAllowsReuse = (activities: AiItineraryActivityInput[] | undefined) => {
    const keys = new Set(sightseeingPool(activities).map((activity) => activityReuseKey(activity)).filter(Boolean));
    return keys.size > 0 && keys.size <= LIMITED_VAULT_COUNT;
};

const findCatalogMatch = (activity: AiItineraryDraftActivity, catalog: AiItineraryActivityInput[]) => {
    const catalogId = String(activity.catalogId || '').trim().toLowerCase();
    const titleKey = String(activity.title || '').trim().toLowerCase();
    return catalog.find((item) => {
        const id = activityId(item);
        const title = String(item.title || '').trim().toLowerCase();
        return (catalogId && id === catalogId) || (titleKey && title === titleKey);
    });
};

const canonicalReuseKey = (activity: AiItineraryDraftActivity, catalog: AiItineraryActivityInput[]) => {
    const match = findCatalogMatch(activity, catalog);
    if (match) return activityReuseKey(match);
    const title = String(activity.title || '').trim().toLowerCase();
    return title ? `custom:${title}` : '';
};

const isOnceOnlyDraft = (activity: AiItineraryDraftActivity, catalog: AiItineraryActivityInput[]) => {
    const match = findCatalogMatch(activity, catalog);
    const probe: AiItineraryActivityInput = match || { id: activity.catalogId, title: activity.title };
    return isArrivalTransfer(probe) || isDepartureTransfer(probe);
};

/**
 * Large vaults: each activity is used on one day only.
 * Vaults of about 6 or fewer: the same sightseeing activity may be used again on another day,
 * but not twice on the same day. Airport arrival and departure stay once either way.
 */
export const enforceActivityReuse = (
    days: AiItineraryDraftDay[],
    catalog: AiItineraryActivityInput[] | undefined
): AiItineraryDraftDay[] => {
    const library = titledCatalog(catalog);
    const allowReuse = vaultAllowsReuse(library);
    const pool = sightseeingPool(library);
    const usedGlobally = new Set<string>();

    const accept = (activity: AiItineraryDraftActivity, usedThisDay: Set<string>) => {
        const key = canonicalReuseKey(activity, library);
        if (!key) return true;
        if (usedThisDay.has(key)) return false;
        const blockRepeat = isOnceOnlyDraft(activity, library) || !allowReuse;
        if (blockRepeat && usedGlobally.has(key)) return false;
        usedThisDay.add(key);
        usedGlobally.add(key);
        return true;
    };

    const filtered = days.map((day) => {
        const usedThisDay = new Set<string>();
        return {
            ...day,
            activities: (day.activities || []).filter((activity) => accept(activity, usedThisDay)),
        };
    });

    const middleIndexes = filtered
        .map((_, index) => index)
        .filter((index) => index > 0 && index < filtered.length - 1);
    const keysOnDay = (index: number) =>
        new Set(filtered[index].activities.map((activity) => canonicalReuseKey(activity, library)).filter(Boolean));

    if (allowReuse) {
        for (const index of middleIndexes) {
            let guard = 0;
            while (filtered[index].activities.length < 2 && pool.length && guard < pool.length) {
                guard += 1;
                const usedThisDay = keysOnDay(index);
                const candidate = pool.find((activity) => !usedThisDay.has(activityReuseKey(activity)));
                if (!candidate) break;
                const draft = fromCatalog(candidate);
                if (!accept(draft, usedThisDay)) break;
                filtered[index].activities.push(draft);
            }
        }
    } else {
        const unused = pool.filter((activity) => !usedGlobally.has(activityReuseKey(activity)));
        const giveNext = (index: number) => {
            const next = unused.shift();
            if (!next) return false;
            const draft = fromCatalog(next);
            const usedThisDay = keysOnDay(index);
            if (!accept(draft, usedThisDay)) {
                unused.unshift(next);
                return false;
            }
            filtered[index].activities.push(draft);
            return true;
        };

        for (const index of middleIndexes) {
            const hasCatalogActivity = filtered[index].activities.some((activity) => findCatalogMatch(activity, library));
            if (hasCatalogActivity || !unused.length) continue;
            filtered[index].activities = filtered[index].activities.filter(
                (activity) => !/^Day \d+ at leisure$/i.test(String(activity.title || ''))
            );
            if (!giveNext(index)) break;
        }
        for (const index of middleIndexes) {
            const catalogOnDay = filtered[index].activities.filter((activity) => findCatalogMatch(activity, library)).length;
            if (catalogOnDay >= 2 || !unused.length) continue;
            if (!giveNext(index)) break;
        }
    }

    return filtered.map((day, index) => {
        if (day.activities.length) return day;
        const isMiddleDay = index > 0 && index < filtered.length - 1;
        const fallback: AiItineraryDraftActivity = isMiddleDay
            ? {
                  title: `Day ${index + 1} at leisure`,
                  description: 'Open time to explore on your own.',
              }
            : index === 0
              ? {
                    title: 'Airport arrival transfer',
                    description: 'Private transfer from the airport to the hotel.',
                }
              : {
                    title: 'Airport departure transfer',
                    description: 'Private transfer from the hotel to the airport.',
                };
        return { ...day, activities: [fallback] };
    });
};

/** Day-by-day plan from the quote destination, hotels, and activity library. */
export const buildLibraryItinerary = (input: AiItineraryInput): AiItineraryDraftDay[] => {
    const total = clampDays(input.days);
    const activities = input.activities || [];
    const arrival = activities.find(isArrivalTransfer);
    const departure = activities.find(isDepartureTransfer);
    const pool = sightseeingPool(activities);
    const allowReuse = vaultAllowsReuse(activities);
    const plannedSightseeing: AiItineraryDraftActivity[][] = Array.from({ length: total }, () => []);

    if (allowReuse) {
        let poolCursor = 0;
        for (let index = 1; index < total - 1; index += 1) {
            const usedThisDay = new Set<string>();
            let steps = 0;
            const maxSteps = Math.max(pool.length, 1) * 2;
            while (plannedSightseeing[index].length < 2 && pool.length && steps < maxSteps) {
                const activity = pool[poolCursor % pool.length];
                poolCursor += 1;
                steps += 1;
                const key = activityReuseKey(activity);
                if (usedThisDay.has(key)) continue;
                usedThisDay.add(key);
                plannedSightseeing[index].push(fromCatalog(activity));
            }
        }
    } else {
        const queue: typeof pool = [];
        const seen = new Set<string>();
        for (const activity of pool) {
            const key = activityReuseKey(activity);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            queue.push(activity);
        }
        const middleIndexes = [];
        for (let index = 1; index < total - 1; index += 1) middleIndexes.push(index);
        const takeNext = () => queue.shift();
        for (const index of middleIndexes) {
            const next = takeNext();
            if (!next) break;
            plannedSightseeing[index].push(fromCatalog(next));
        }
        for (const index of middleIndexes) {
            const next = takeNext();
            if (!next) break;
            plannedSightseeing[index].push(fromCatalog(next));
        }
    }

    const days = Array.from({ length: total }, (_, index) => {
        const hotel = hotelForDay(input.hotels, index, total);
        const place = placeLabel(input, hotel);
        const stay = hotelLabel(hotel, place);
        const when = formatTripDate(input.departureDate, index);
        const whenText = when ? ` on ${when}` : '';

        if (index === 0) {
            const lines: AiItineraryDraftActivity[] = [
                arrival
                    ? fromCatalog(arrival)
                    : {
                          title: 'Airport arrival transfer',
                          description: `Private transfer from the airport to ${stay} in ${place}.`,
                      },
                {
                    title: 'Hotel check-in',
                    description: `Arrive${whenText} and check in at ${stay}. Time to settle in after the journey to ${place}.`,
                },
                {
                    title: 'Evening at leisure',
                    description: `An easy evening in ${place}, with dinner near ${stay}.`,
                },
            ];
            if (total === 1) {
                lines.push({
                    title: 'Hotel check-out',
                    description: `Check out from ${stay} before the onward journey.`,
                });
                lines.push(
                    departure
                        ? fromCatalog(departure)
                        : {
                              title: 'Airport departure transfer',
                              description: `Private transfer from ${stay} to the airport.`,
                          }
                );
            }
            return { title: dayTitle(0, total), activities: lines };
        }

        if (index === total - 1) {
            return {
                title: dayTitle(index, total),
                activities: [
                    {
                        title: 'Hotel check-out',
                        description: `Check out from ${stay}${whenText} and keep the morning free before departure from ${place}.`,
                    },
                    departure
                        ? fromCatalog(departure)
                        : {
                              title: 'Airport departure transfer',
                              description: `Private transfer from ${stay} to the airport.`,
                          },
                ],
            };
        }

        const sightseeing = [...plannedSightseeing[index]];
        if (!sightseeing.length) {
            sightseeing.push({
                title: `Day ${index + 1} at leisure`,
                description: `Open time in ${place}${whenText} to explore around ${stay}.`,
            });
        }
        return {
            title: dayTitle(index, total, sightseeing[0]?.title),
            activities: sightseeing,
        };
    });
    return enforceActivityReuse(days, activities);
};

const withRequiredDayTitles = (days: AiItineraryDraftDay[]): AiItineraryDraftDay[] =>
    days.map((day, index) => ({
        ...day,
        title: dayTitle(index, days.length, index === 0 || index === days.length - 1 ? undefined : day.title),
        activities: (day.activities || []).filter((activity) => String(activity?.title || '').trim()),
    }));

/** Keep the library plan wherever the model left a day empty, and lock arrival and departure titles. */
export const mergeAiDays = (
    aiDays: AiItineraryDraftDay[] | undefined,
    libraryDays: AiItineraryDraftDay[],
    catalog: AiItineraryActivityInput[] = []
): AiItineraryDraftDay[] => {
    const merged = libraryDays.map((libraryDay, index) => {
        const aiDay = aiDays?.[index];
        const activities =
            Array.isArray(aiDay?.activities) && aiDay.activities.some((activity) => String(activity?.title || '').trim())
                ? aiDay.activities
                : libraryDay.activities;
        return {
            title: String(aiDay?.title || libraryDay.title),
            activities,
        };
    });
    return enforceActivityReuse(withRequiredDayTitles(merged), catalog);
};

export const requestAiItinerary = async (input: AiItineraryInput): Promise<AiItineraryResult> => {
    const libraryDays = buildLibraryItinerary(input);
    try {
        const response = await fetch('/api/ai/itinerary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...input,
                days: libraryDays.length,
            }),
        });
        if (!response.ok) {
            return { source: 'library', days: libraryDays };
        }
        const payload = await response.json().catch(() => ({}));
        if (payload?.source !== 'ai' || !Array.isArray(payload?.days)) {
            return { source: 'library', days: libraryDays };
        }
        return { source: 'ai', days: mergeAiDays(payload.days, libraryDays, input.activities || []) };
    } catch {
        return { source: 'library', days: libraryDays };
    }
};

export const draftDaysToFormItinerary = (
    days: AiItineraryDraftDay[],
    catalog: AiItineraryActivityInput[],
    existing: any[] = []
) => {
    const now = Date.now();
    return days.map((day, index) => ({
        id: existing[index]?.id ?? now + index,
        title: day.title,
        activities: (day.activities || []).map((activity, activityIndex) => {
            const catalogId = String(activity.catalogId || '').trim().toLowerCase();
            const titleKey = String(activity.title || '').trim().toLowerCase();
            const match = catalog.find((item) => {
                const id = String(item.id || '').trim().toLowerCase();
                const title = String(item.title || '').trim().toLowerCase();
                return (catalogId && id === catalogId) || (titleKey && title === titleKey);
            });
            const title = String(match?.title || activity.title || 'Activity').trim();
            const price = Number(match?.price) || 0;
            return {
                ...(match || {}),
                id: match?.id || `ai-${now}-${index}-${activityIndex}`,
                title,
                name: title,
                description: String(activity.description || match?.description || '').trim(),
                price,
                customPrice: price,
                category: match?.category || 'Leisure',
                allowTitleEdit: !match,
                instanceId: `ai-${now}-${index}-${activityIndex}`,
            };
        }),
    }));
};
