import { Router } from 'express';

const router = Router();

const keyOf = (name) => String(process.env[name] || '').trim();

const clampDays = (days) => {
    const count = Math.round(Number(days));
    if (!Number.isFinite(count)) return 1;
    return Math.max(1, Math.min(60, count));
};

const extractJson = (text) => {
    const raw = String(text || '').trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : raw;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
        return JSON.parse(body.slice(start, end + 1));
    } catch {
        return null;
    }
};

const isStandardTransfer = (activity) => {
    const id = String(activity?.id || '').trim().toLowerCase();
    if (id === 'global-1' || id === 'global-2' || id === 'global-3') return true;
    return /airport arrival|airport departure|free day|exploring on your own/i.test(String(activity?.title || ''));
};

const vaultActivityCount = (body) => {
    const keys = new Set(
        (Array.isArray(body?.activities) ? body.activities : [])
            .filter((activity) => String(activity?.title || '').trim() && !isStandardTransfer(activity))
            .map((activity) => {
                const id = String(activity?.id || '').trim().toLowerCase();
                if (id) return `id:${id}`;
                const title = String(activity?.title || '').trim().toLowerCase();
                return title ? `title:${title}` : '';
            })
            .filter(Boolean)
    );
    return keys.size;
};

const reuseRule = (body) => {
    const count = vaultActivityCount(body);
    if (count > 0 && count <= 6) {
        return 'The activity library has only a few activities (6 or fewer). You may use the same sightseeing activity again on another day when you run out of different ones. Do not place the same activity twice on the same day. Airport arrival and airport departure are used once only.';
    }
    return 'The activity library has more than 6 activities. Use each library activity on one day only. Do not repeat a catalogId or title on any other day.';
};

const buildPrompt = (body) => {
    const days = clampDays(body?.days);
    const destination = String(body?.destination || body?.city || body?.country || 'the destination').trim();
    const travelers = String(body?.travelers || '').trim();
    const hotels = Array.isArray(body?.hotels) ? body.hotels : [];
    const hotelLines = hotels
        .map((hotel) => {
            const name = String(hotel?.name || '').trim();
            const city = String(hotel?.city || '').trim();
            const nights = Number(hotel?.nights) || 0;
            if (!name && !city) return '';
            return `- ${name || 'Hotel'}${city ? `, ${city}` : ''}${nights ? ` (${nights} nights)` : ''}`;
        })
        .filter(Boolean);
    const activities = (Array.isArray(body?.activities) ? body.activities : [])
        .slice(0, 40)
        .map((activity) => {
            const id = String(activity?.id || '').trim();
            const title = String(activity?.title || '').trim();
            const description = String(activity?.description || '').trim();
            if (!title) return '';
            return `- id: ${id || 'none'} | ${title}${description ? ` — ${description}` : ''}`;
        })
        .filter(Boolean);

    return `Create a travel itinerary as JSON only.
Destination: ${destination}
Days: ${days}
Departure date: ${String(body?.departureDate || 'not set')}
Travelers: ${travelers || 'not set'}
Hotels:
${hotelLines.join('\n') || '- not selected'}
Activity library (prefer these titles and copy their id into catalogId when you use one):
${activities.join('\n') || '- none'}

Rules:
- Return exactly ${days} days.
- Day 1 title must be "Day 1: Arrival". Its activities must cover airport arrival, hotel check-in, and an easy evening.
- The last day title must be "Day ${days}: Departure". Its activities must cover hotel check-out and airport departure.
- If there is only 1 day, the title must be "Day 1: Arrival & Departure" and include both arrival and departure.
- Every day needs 2 or 3 activities.
- Middle days are sightseeing in this destination.
- ${reuseRule(body)}
- Each activity has title, description, and catalogId (the library id, or an empty string if you write a new activity).
- Descriptions are one or two sentences a travel agent can show a customer.

Return this shape and nothing else:
{"days":[{"title":"Day 1: Arrival","activities":[{"catalogId":"","title":"","description":""}]}]}`;
};

const callGemini = async (prompt) => {
    const key = keyOf('GEMINI_API_KEY');
    if (!key) return null;
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
            }),
        }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || 'Gemini could not draft the itinerary.';
        throw new Error(message);
    }
    return payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
};

const callOpenAi = async (prompt) => {
    const key = keyOf('OPENAI_API_KEY');
    if (!key) return null;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.7,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'You write travel itineraries and reply with JSON only.' },
                { role: 'user', content: prompt },
            ],
        }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || 'OpenAI could not draft the itinerary.';
        throw new Error(message);
    }
    return payload?.choices?.[0]?.message?.content || '';
};

router.post('/ai/itinerary', async (req, res) => {
    try {
        const hasKey = Boolean(keyOf('GEMINI_API_KEY') || keyOf('OPENAI_API_KEY'));
        if (!hasKey) {
            return res.json({ source: 'library', days: [] });
        }

        const prompt = buildPrompt(req.body || {});
        const text = (await callGemini(prompt)) || (await callOpenAi(prompt));
        const parsed = extractJson(text);
        const days = Array.isArray(parsed?.days) ? parsed.days : [];
        if (!days.length) {
            return res.json({ source: 'library', days: [] });
        }

        return res.json({
            source: 'ai',
            days: days.map((day) => ({
                title: String(day?.title || '').trim(),
                activities: (Array.isArray(day?.activities) ? day.activities : [])
                    .map((activity) => ({
                        catalogId: String(activity?.catalogId || activity?.id || '').trim(),
                        title: String(activity?.title || '').trim(),
                        description: String(activity?.description || '').trim(),
                    }))
                    .filter((activity) => activity.title),
            })),
        });
    } catch (error) {
        console.error('AI itinerary failed:', error);
        return res.json({ source: 'library', days: [] });
    }
});

export default router;
