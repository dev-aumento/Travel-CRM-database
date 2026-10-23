import { parseTermsLines, type QuoteTermsRecord } from './quoteTerms';
import { isTermsHtml, termsContentIsEmpty, termsHtmlToEmailInner } from './termsRichText';
import { parseTravelers } from './pricing';
import { formatMoneyAmount, getCurrencyCodeLabel } from './currency';
import { resolveMainAgencyAgent } from './databaseSync';
import { getAgencyPlanFeatures } from './planFeatures';
import {
    formatAgencyBankDetailsLines,
    hasAgencyBankDetails,
    type AgencyBankDetails,
} from './agencyBankDetails';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HEADER_BG = '#e0f2fe';
const HEADER_COLOR = '#000000';
const DAY_BAR_BG = '#e9ecef';
const HIGHLIGHT_BG = '#fff3cd';
const BORDER = '#dee2e6';

const DEFAULT_INCLUSIONS = [
    'Accommodation as per selected hotels',
    'Meet & Greet on arrival',
    'Meal plan as per mentioned above',
    'Pick up and drop as per itinerary',
    'All sightseeing as per given itinerary above',
    'Fuel charges, Driver Bata, Driver allowance',
    'Toll taxes charges',
];

const DEFAULT_EXCLUSIONS = [
    'Flight / Train / Helicopter Fare (unless specified in package)',
    'Activity fees or entry tickets not mentioned in inclusions',
    'Any cost arising due to landslide, road closure, or political disturbance',
    'Personal expenses (heater, laundry, extra meals, etc.)',
    'NOTE: Anything not mentioned in the inclusions is excluded.',
];

export type BuildQuoteEmailParams = {
    quote: any;
    hotels: any[];
    agencyName: string;
    quoteTotal: number;
    terms: QuoteTermsRecord | null;
    trackingId: string;
    presets?: any[];
    fromEmail?: string;
    currency?: string;
    bankDetails?: AgencyBankDetails | null;
};

const escapeHtml = (value: unknown) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const formatQuoteMoney = (n: number, currency?: string) =>
    formatMoneyAmount(n, currency || 'INR (₹)');

const formatStartDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatNightLabel = (date: Date) =>
    date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const formatDayHeadingDate = (date: Date) => {
    const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
    const day = date.getDate();
    const month = date.toLocaleDateString('en-GB', { month: 'long' });
    return `${weekday} ${ordinal(day)} ${month}`;
};

const mealPlanLabel = (mealPlan?: string) => {
    const mp = String(mealPlan || '').toUpperCase();
    if (mp.includes('MAP')) return 'Dinner + Breakfast (MAP)';
    if (mp.includes('AP')) return 'All Meals (AP)';
    if (mp.includes('CP')) return 'Breakfast (CP)';
    if (mp.includes('EP')) return 'Room Only (EP)';
    return mealPlan || 'As per hotel';
};

const resolveHotelName = (hotelId: string, hotels: any[] = [], fallback?: string) => {
    const h = hotels.find((row: any) => row.id === hotelId);
    return h?.name || fallback || 'Selected Hotel';
};

const resolveCity = (hotel: any, stay: any) => {
    const loc = hotel?.location || hotel?.destination || stay?.hotelInput || '';
    const part = String(loc).split(',')[0]?.trim();
    return part || '—';
};

const formatPaxLabel = (quote: any) => {
    const { adults, kids } = parseTravelers(quote.travelers);
    const parts: string[] = [];
    if (adults) parts.push(`${adults} Adult${adults > 1 ? 's' : ''}`);
    if (kids) {
        const ages = Array.isArray(quote.kidAges) ? quote.kidAges : [];
        const agePart =
            ages.length > 0 ? ` (${ages.map((a: number) => `${a}y`).join(', ')})` : '';
        parts.push(`${kids} Child${kids > 1 ? 'ren' : ''}${agePart}`);
    }
    return parts.join(', ') || quote.travelers || '—';
};

const buildStayRouteSummary = (quote: any, hotels: any[]) => {
    const stays = Array.isArray(quote.hotelStays)
        ? quote.hotelStays.filter((s: any) => s?.hotelId && Number(s.nights) > 0)
        : [];
    if (stays.length === 0) return '';
    return stays
        .map((stay: any) => {
            const hotel = hotels.find((h: any) => h.id === stay.hotelId);
            const city = resolveCity(hotel, stay);
            const n = Number(stay.nights) || 1;
            return `${city} ${n} Night${n > 1 ? 's' : ''}`;
        })
        .join(' / ');
};

const getTransportationLabel = (quote: any, presets: any[] = []) => {
    if (quote.transportation) return String(quote.transportation);
    const preset = presets.find((p: any) => p.id === quote.presetId);
    if (preset?.transferDesc) return preset.transferDesc;
    const transferItem = (quote.items || []).find((i: any) =>
        String(i.desc || '').toLowerCase().includes('transfer')
    );
    if (transferItem?.sub) return transferItem.sub;
    return 'Private vehicle as per itinerary';
};

const buildInclusionsList = (quote: any) => {
    const fromItems = (quote.items || [])
        .map((i: any) => i.desc)
        .filter((d: string) => d && !/visa|tax/i.test(d));
    const merged = [...DEFAULT_INCLUSIONS];
    fromItems.forEach((item: string) => {
        if (!merged.some((m) => m.toLowerCase().includes(item.toLowerCase()))) {
            merged.push(item);
        }
    });
    return merged;
};

const buildDayDescription = (day: any) => {
    const activities = Array.isArray(day.activities) ? day.activities : [];
    if (activities.length === 0) {
        return 'Leisure day / free time at your own pace. Overnight as per itinerary.';
    }
    return activities
        .map((act: any) => {
            const title = act.title || act.name || 'Activity';
            const desc = act.description ? ` ${act.description}` : '';
            return `${title}.${desc}`.trim();
        })
        .join(' ');
};

const sectionHeader = (title: string) => `
  <tr>
    <td colspan="100%" style="background:${HEADER_BG};color:${HEADER_COLOR};font-weight:bold;text-align:center;padding:10px 12px;font-size:14px;border:1px solid ${BORDER};">
      ${escapeHtml(title)}
    </td>
  </tr>`;

const tableOpen = (width = '100%') =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${width}" style="border-collapse:collapse;width:${width};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222;margin-bottom:16px;">`;

const buildPackageOverviewTable = (params: BuildQuoteEmailParams) => {
    const { quote, trackingId } = params;
    const routeSummary = buildStayRouteSummary(quote, params.hotels);
    const destinationCell = routeSummary
        ? `<strong>${escapeHtml(quote.destination || '—')}</strong><br/>
           <span style="display:inline-block;margin-top:6px;padding:4px 8px;background:${HIGHLIGHT_BG};font-size:12px;">${escapeHtml(routeSummary)}</span>`
        : `<strong>${escapeHtml(quote.destination || '—')}</strong>`;

    const rows = [
        ['Trip ID', trackingId],
        ['Destination', destinationCell],
        ['Start Date', formatStartDate(quote.departureDate)],
        ['Trip Duration', quote.duration || '—'],
        ['Pax', formatPaxLabel(quote)],
    ];

    const bodyRows = rows
        .map(
            ([label, value]) => `
    <tr>
      <td style="border:1px solid ${BORDER};padding:8px 10px;width:32%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="border:1px solid ${BORDER};padding:8px 10px;vertical-align:top;">${typeof value === 'string' && value.includes('<strong>') ? value : `<strong>${escapeHtml(value)}</strong>`}</td>
    </tr>`
        )
        .join('');

    return `${tableOpen()}
    ${sectionHeader('Package Overview')}
    ${bodyRows}
  </table>`;
};

const buildItinerarySection = (quote: any) => {
    const itinerary = Array.isArray(quote.itinerary) ? quote.itinerary : [];
    if (itinerary.length === 0) return '';

    const baseDate = quote.departureDate ? new Date(quote.departureDate) : null;
    const dayBlocks = itinerary
        .map((day: any, idx: number) => {
            const title = day.title || `Day ${idx + 1}`;
            const theme = title.includes(':') ? title.split(':').slice(1).join(':').trim() : title;
            let datePart = `Day ${idx + 1}`;
            if (baseDate && !Number.isNaN(baseDate.getTime())) {
                const d = new Date(baseDate);
                d.setDate(d.getDate() + idx);
                datePart = formatDayHeadingDate(d);
            }
            const heading = `${ordinal(idx + 1)} Day (${datePart}) : ${theme}`;
            const description = escapeHtml(buildDayDescription(day));
            return `
    <tr>
      <td style="border:1px solid ${BORDER};padding:0;">
        <div style="background:${DAY_BAR_BG};color:${HEADER_COLOR};font-weight:bold;padding:8px 10px;font-size:13px;">${escapeHtml(heading)}</div>
        <div style="padding:10px 12px;line-height:1.55;font-size:13px;">${description}</div>
      </td>
    </tr>`;
        })
        .join('');

    return `${tableOpen()}
    ${sectionHeader('Day Wise Itinerary')}
    ${dayBlocks}
  </table>`;
};

type HotelRowGroup = {
    nightsLabels: string[];
    city: string;
    hotelName: string;
    stars: string;
    mealPlan: string;
    accommodation: string;
};

const buildHotelRowGroups = (params: BuildQuoteEmailParams): HotelRowGroup[] => {
    const { quote, hotels } = params;
    const stays = Array.isArray(quote.hotelStays)
        ? quote.hotelStays.filter((s: any) => s?.hotelId && Number(s.nights) > 0)
        : [];

    const baseDate = quote.departureDate ? new Date(quote.departureDate) : null;
    let nightOffset = 0;

    if (stays.length === 0) {
        const details = quote.hotelId
            ? [{ name: resolveHotelName(quote.hotelId, hotels), nights: 1 }]
            : [];
        if (details.length === 0) return [];
        return details.map((d) => ({
            nightsLabels: ['—'],
            city: quote.destination?.split(',')[0] || '—',
            hotelName: d.name,
            stars: '',
            mealPlan: mealPlanLabel(quote.hotelMealPlan),
            accommodation: quote.hotelTier ? `${quote.hotelTier} Tier` : 'As quoted',
        }));
    }

    return stays.map((stay: any) => {
        const hotel = hotels.find((h: any) => h.id === stay.hotelId);
        const nights = Math.max(1, Number(stay.nights) || 1);
        const nightLabels: string[] = [];
        for (let i = 0; i < nights; i++) {
            if (baseDate && !Number.isNaN(baseDate.getTime())) {
                const d = new Date(baseDate);
                d.setDate(d.getDate() + nightOffset + i);
                nightLabels.push(`${ordinal(nightOffset + i + 1)} (${formatNightLabel(d)})`);
            } else {
                nightLabels.push(`${ordinal(nightOffset + i + 1)} Night`);
            }
        }
        nightOffset += nights;

        const inclusionNames = [
            ...(stay.specialInclusions || []).map((s: any) => s.name).filter(Boolean),
            ...(stay.nightPrices || []).flatMap((np: any) =>
                (np.specialInclusions || []).map((s: any) => s.name).filter(Boolean)
            ),
        ];
        const extraBed = Number(stay.extraBed) || 0;
        let accommodation = `<strong>${escapeHtml(stay.rooms || 1)} ${escapeHtml(stay.roomType || 'Room')}</strong>`;
        accommodation += ` (${stay.personsPerRoom || 2} Pax`;
        if (extraBed > 0) accommodation += ` + ${extraBed} Extra Bed/Mattress`;
        accommodation += ')';
        if (inclusionNames.length) {
            accommodation += `<br/><span style="font-size:12px;color:#555;">Includes: ${escapeHtml(inclusionNames.join(', '))}</span>`;
        }

        const hotelLabel = resolveHotelName(stay.hotelId, hotels, stay.hotelInput);

        return {
            nightsLabels: nightLabels,
            city: resolveCity(hotel, stay),
            hotelName: `${hotelLabel} / Similar`,
            stars: '',
            mealPlan: mealPlanLabel(stay.mealPlan || quote.hotelMealPlan),
            accommodation,
        };
    });
};

const buildHotelsSection = (params: BuildQuoteEmailParams) => {
    const groups = buildHotelRowGroups(params);
    if (groups.length === 0) return '';

    const rows = groups
        .map(
            (g) => `
    <tr>
      <td style="border:1px solid ${BORDER};padding:8px;vertical-align:top;width:18%;">${g.nightsLabels.map((n) => escapeHtml(n)).join('<br/>')}</td>
      <td style="border:1px solid ${BORDER};padding:8px;vertical-align:top;width:14%;"><strong>${escapeHtml(g.city)}</strong></td>
      <td style="border:1px solid ${BORDER};padding:8px;vertical-align:top;width:26%;"><strong>${escapeHtml(g.hotelName)}</strong></td>
      <td style="border:1px solid ${BORDER};padding:8px;vertical-align:top;width:18%;">${escapeHtml(g.mealPlan)}</td>
      <td style="border:1px solid ${BORDER};padding:8px;vertical-align:top;">${g.accommodation}</td>
    </tr>`
        )
        .join('');

    const { quote, quoteTotal, currency } = params;
    const { adults, kids } = parseTravelers(quote.travelers);
    const priceLines: string[] = [];
    if (adults >= 1 && quoteTotal > 0) {
        const perAdult =
            adults > 0 ? Math.round(quoteTotal / Math.max(adults + kids * 0.5, 1)) : quoteTotal;
        if (adults >= 2) {
            priceLines.push(
                `${formatQuoteMoney(perAdult, currency)} /- Per Person (Double Sharing) x ${adults} Pax`
            );
        } else {
            priceLines.push(`${formatQuoteMoney(quoteTotal, currency)} /- Package x ${adults} Adult`);
        }
        if (kids > 0) {
            priceLines.push(
                `${formatQuoteMoney(Math.round(perAdult * 0.65), currency)} /- Per Child x ${kids} Child${kids > 1 ? 'ren' : ''}`
            );
        }
    }
    const taxNote =
        quote.taxes != null && quote.taxes > 0
            ? ` (Taxes: ${formatQuoteMoney(quote.taxes, currency)} additional)`
            : ' (excluding Taxes)';

    const priceBlock = `
    <tr>
      <td colspan="5" style="border:1px solid ${BORDER};padding:10px 12px;">
        <div style="background:${HIGHLIGHT_BG};font-weight:bold;padding:6px 8px;margin-bottom:8px;">Prices (${escapeHtml(getCurrencyCodeLabel(currency))})</div>
        ${priceLines.map((l) => `<div style="margin-bottom:4px;">${escapeHtml(l)}</div>`).join('')}
        <div style="margin-top:8px;font-weight:bold;">Total: ${escapeHtml(formatQuoteMoney(quoteTotal, currency))} /-${escapeHtml(taxNote)}</div>
      </td>
    </tr>`;

    return `${tableOpen()}
    ${sectionHeader('Hotels')}
    <tr>
      <td style="border:1px solid ${BORDER};padding:8px;font-weight:bold;background:#fafafa;">Nights</td>
      <td style="border:1px solid ${BORDER};padding:8px;font-weight:bold;background:#fafafa;">City</td>
      <td style="border:1px solid ${BORDER};padding:8px;font-weight:bold;background:#fafafa;">Hotel Name</td>
      <td style="border:1px solid ${BORDER};padding:8px;font-weight:bold;background:#fafafa;">Meal Plan</td>
      <td style="border:1px solid ${BORDER};padding:8px;font-weight:bold;background:#fafafa;">Accommodation</td>
    </tr>
    ${rows}
    ${priceBlock}
  </table>`;
};

const buildTransportSection = (quote: any, presets: any[]) => {
    const label = getTransportationLabel(quote, presets);
    return `${tableOpen()}
    ${sectionHeader('Transportation')}
    <tr>
      <td style="border:1px solid ${BORDER};padding:10px 12px;">Transportation Used: <strong>${escapeHtml(label)}</strong></td>
    </tr>
  </table>`;
};

const buildInclusionsExclusionsSection = (quote: any) => {
    const inclusions = buildInclusionsList(quote);
    const exclusions = [...DEFAULT_EXCLUSIONS];
    const incList = inclusions.map((l) => `<li style="margin-bottom:4px;">${escapeHtml(l)}</li>`).join('');
    const excList = exclusions
        .map((l) => {
            const isNote = l.startsWith('NOTE:');
            return `<li style="margin-bottom:4px;${isNote ? 'color:#a94442;font-weight:bold;' : ''}">${escapeHtml(l)}</li>`;
        })
        .join('');

    return `${tableOpen()}
    <tr>
      <td colspan="2" style="background:${HEADER_BG};padding:0;border:1px solid ${BORDER};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="width:50%;text-align:center;font-weight:bold;color:#28a745;padding:10px;border-right:1px solid ${BORDER};">Inclusions</td>
            <td style="width:50%;text-align:center;font-weight:bold;color:${HEADER_COLOR};padding:10px;">Exclusions</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid ${BORDER};padding:10px 12px;vertical-align:top;width:50%;"><ul style="margin:0;padding-left:18px;">${incList}</ul></td>
      <td style="border:1px solid ${BORDER};padding:10px 12px;vertical-align:top;width:50%;"><ul style="margin:0;padding-left:18px;">${excList}</ul></td>
    </tr>
  </table>`;
};

const buildTermsSection = (terms: QuoteTermsRecord | null) => {
    const content = terms?.content || '';
    if (termsContentIsEmpty(content)) return '';

    const inner = isTermsHtml(content)
        ? termsHtmlToEmailInner(content)
        : `<ul style="margin:0;padding-left:18px;line-height:1.5;">${parseTermsLines(content)
              .map((l) => `<li style="margin-bottom:6px;">${escapeHtml(l)}</li>`)
              .join('')}</ul>`;

    return `${tableOpen()}
    ${sectionHeader('Terms and Conditions')}
    <tr>
      <td style="border:1px solid ${BORDER};padding:10px 12px;">${inner}</td>
    </tr>
  </table>`;
};

const buildBankDetailsSection = (bankDetails?: AgencyBankDetails | null) => {
    if (!hasAgencyBankDetails(bankDetails)) return '';
    const lines = formatAgencyBankDetailsLines(bankDetails)
        .map(
            (line) =>
                `<div style="margin-bottom:4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;">${escapeHtml(line)}</div>`
        )
        .join('');
    return `${tableOpen()}
    ${sectionHeader('Bank Details')}
    <tr>
      <td style="border:1px solid ${BORDER};padding:10px 12px;">${lines}</td>
    </tr>
  </table>`;
};

export const buildQuoteEmailHtml = (params: BuildQuoteEmailParams): string => {
    const firstName = (params.quote.customer || 'Traveler').split(' ')[0];
    const presets = params.presets || [];

    const body = `
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;margin:0 0 8px;">Dear ${escapeHtml(firstName)},</p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;margin:0 0 8px;">Greetings !!!</p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;margin:0 0 20px;">
      We have received your query and we would like to quote you as per the below as per your request.
    </p>
    ${buildPackageOverviewTable(params)}
    ${buildItinerarySection(params.quote)}
    ${buildHotelsSection(params)}
    ${buildTransportSection(params.quote, presets)}
    ${buildInclusionsExclusionsSection(params.quote)}
    ${buildTermsSection(params.terms)}
    ${buildBankDetailsSection(params.bankDetails)}
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;margin-top:20px;">
      Best regards,<br/><strong>${escapeHtml(params.agencyName)}</strong>
    </p>`;

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:16px 16px 40px;background:#f8f9fa;">
  <div style="max-width:720px;margin:0 auto;background:#fff;padding:20px 20px 32px;border:1px solid ${BORDER};">
    ${body}
  </div>
</body>
</html>`;
};

export const buildQuoteEmailPlainText = (params: BuildQuoteEmailParams): string => {
    const html = buildQuoteEmailHtml(params);
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

export type QuoteEmailDraft = {
    to: string;
    subject: string;
    htmlBody: string;
    plainBody: string;
    fromEmail?: string;
    customerName?: string;
};

export type EmailJsConfig = {
    serviceId: string;
    templateId: string;
    publicKey: string;
};

export type QuoteEmailSender = {
    fromEmail: string;
    fromName: string;
    emailJsConfig: EmailJsConfig | null;
};

/** Reads EmailJS keys from an agent record, agency settings, or Vite env. */
export const resolveEmailJsConfig = (source?: any): EmailJsConfig | null => {
    const serviceId =
        source?.emailJsServiceId || import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
    const templateId =
        source?.emailJsTemplateId || import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
    const publicKey =
        source?.emailJsPublicKey || import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';
    if (serviceId && templateId && publicKey) {
        return { serviceId, templateId, publicKey };
    }
    return null;
};

/** Resolves who sends the quote email (agent on the quote, then logged-in agent, then agency). */
export const resolveQuoteEmailSender = (
    db: any,
    opts: { quote?: any; userEmail?: string; currentAgentId?: string }
): QuoteEmailSender => {
    const agents = db?.travelAgents?.data || [];
    const settingsList = db?.settings?.data || [];
    const userEmail = opts.userEmail || '';

    let agent: any = null;
    const quoteAgentId = opts.quote?.agentId;
    if (quoteAgentId) {
        agent = agents.find((a: any) => a.id === quoteAgentId);
        if (!agent) {
            const staff = (db?.staff?.data || []).find(
                (s: any) => s.employeeId === quoteAgentId || s.id === quoteAgentId
            );
            if (staff?.agentId) {
                agent = agents.find((a: any) => a.id === staff.agentId);
            }
        }
    }
    if (!agent && opts.currentAgentId) {
        agent = agents.find((a: any) => a.id === opts.currentAgentId);
    }
    if (!agent && userEmail) {
        agent = agents.find((a: any) => a.email === userEmail);
    }

    const settings =
        settingsList.find((s: any) => s.email === userEmail) || settingsList[0];

    const fromEmail =
        (agent?.email && String(agent.email).trim()) ||
        settings?.supportEmail ||
        settings?.email ||
        userEmail ||
        '';

    const fromName =
        agent?.businessName || agent?.name || settings?.agencyName || 'Travel Agency';

    const mainAgencyAgent = resolveMainAgencyAgent(db, {
        sessionAgentId: agent?.id || opts.currentAgentId || '',
        userEmail,
    });

    // Sending straight from the agency address is a plan feature; otherwise the mail app is used
    const canSendFromAgency = getAgencyPlanFeatures(db, {
        sessionAgentId: mainAgencyAgent?.id || agent?.id || opts.currentAgentId || '',
        userEmail,
    }).has('agencyEmail');

    const emailJsConfig = canSendFromAgency
        ? resolveEmailJsConfig(agent) ||
          resolveEmailJsConfig(mainAgencyAgent) ||
          resolveEmailJsConfig(settings)
        : null;

    return { fromEmail, fromName, emailJsConfig };
};

export type SendQuoteEmailResult = {
    ok: boolean;
    method: 'emailjs';
    error?: string;
};

const buildEmlFilename = (subject: string) =>
    `${subject.replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'Trip-Proposal'}.eml`;

const buildEmlContent = (
    to: string,
    subject: string,
    htmlBody: string,
    plainBody: string,
    fromEmail?: string
) => {
    const boundary = `----=_Part_${Date.now()}`;
    const from = fromEmail || 'travel@agency.com';
    return [
        `To: ${to}`,
        `From: ${from}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        plainBody,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        htmlBody,
        '',
        `--${boundary}--`,
        '',
    ].join('\r\n');
};

const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

const buildEmlBlob = (draft: QuoteEmailDraft) => {
    const eml = buildEmlContent(
        draft.to,
        draft.subject,
        draft.htmlBody,
        draft.plainBody,
        draft.fromEmail
    );
    return new Blob([eml], { type: 'message/rfc822' });
};

/** Launch mailto: To + Subject only (always short enough for every mail client). */
const launchMailto = (to: string, subject: string, body?: string) => {
    let href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`;
    if (body) {
        href += `&body=${encodeURIComponent(body)}`;
    }

    // iframe trick — works in Chrome/Edge when a plain anchor click is blocked
    try {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'display:none;width:0;height:0;border:0';
        iframe.src = href;
        document.body.appendChild(iframe);
        window.setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 3000);
    } catch {
        /* ignore */
    }

    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
};

/** Save .eml and try to open it in the default mail app (Outlook, Mail, etc.). */
const launchEmlDraft = (draft: QuoteEmailDraft) => {
    const blob = buildEmlBlob(draft);
    const filename = buildEmlFilename(draft.subject);
    const url = URL.createObjectURL(blob);

    // Download so the file is always available (e.g. Downloads folder)
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Attempt to open in the associated mail client (works on many Windows + Outlook setups)
    try {
        const openLink = document.createElement('a');
        openLink.href = url;
        openLink.target = '_blank';
        openLink.rel = 'noopener noreferrer';
        openLink.style.display = 'none';
        document.body.appendChild(openLink);
        openLink.click();
        document.body.removeChild(openLink);
    } catch {
        /* download alone is enough */
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
};

/** Download an .eml file — open it in Outlook/Gmail, then click Send (keeps HTML formatting). */
export const downloadQuoteEml = (draft: QuoteEmailDraft) => {
    const eml = buildEmlContent(
        draft.to,
        draft.subject,
        draft.htmlBody,
        draft.plainBody,
        draft.fromEmail
    );
    triggerDownload(eml, buildEmlFilename(draft.subject), 'message/rfc822');
};

export const copyQuoteEmailHtml = async (draft: QuoteEmailDraft): Promise<boolean> => {
    try {
        if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([draft.htmlBody], { type: 'text/html' }),
                    'text/plain': new Blob([draft.plainBody], { type: 'text/plain' }),
                }),
            ]);
            return true;
        }
    } catch {
        /* fall through */
    }
    try {
        await navigator.clipboard.writeText(draft.plainBody);
        return true;
    } catch {
        return false;
    }
};

export type OpenMailAppResult = {
    ok: boolean;
    error?: string;
    hint?: string;
};

/**
 * Opens the user's mail app: prefills To + Subject via mailto, and delivers the full HTML
 * itinerary via an .eml draft (no length limit).
 */
export const openMailAppDraft = (draft: QuoteEmailDraft): OpenMailAppResult => {
    try {
        const shortIntro =
            draft.plainBody.length > 800
                ? `${draft.plainBody.slice(0, 800).trim()}…\n\n[Full formatted itinerary opens in the .eml draft — see Downloads or the tab that just opened.]`
                : draft.plainBody;

        launchMailto(draft.to, draft.subject, shortIntro);
        launchEmlDraft(draft);

        return {
            ok: true,
            hint:
                'Your mail app should open with the customer and subject filled in. The full HTML itinerary is in the .eml file (check Downloads or open the file that appeared). Click Send in your mail app when ready.',
        };
    } catch (e) {
        return {
            ok: false,
            error:
                e instanceof Error
                    ? e.message
                    : 'Could not open your mail app. Try Download draft (.eml) instead.',
        };
    }
};

const parseEmailJsError = (status: number, raw: string) => {
    try {
        const json = JSON.parse(raw);
        if (json?.message) return String(json.message);
    } catch {
        /* ignore */
    }
    if (status === 412) {
        return 'EmailJS rejected the request. In your EmailJS template, set the To field to {{to_email}} and allow sending to that address.';
    }
    if (status === 400) {
        return 'Invalid EmailJS configuration. Check Service ID, Template ID, and Public Key under Agency Profile → Integrations.';
    }
    return raw || `Email service error (${status})`;
};

/** Sends directly to the customer via EmailJS (agent connects their Gmail in Agency Profile → Integrations). */
export const sendQuoteEmail = async (
    draft: QuoteEmailDraft,
    options: { fromName: string; fromEmail: string },
    emailJsConfig: EmailJsConfig | null
): Promise<SendQuoteEmailResult> => {
    if (!emailJsConfig) {
        return {
            ok: false,
            method: 'emailjs',
            error:
                'Direct send is not configured. Open Agency Profile → Integrations, connect EmailJS with the same Gmail/Outlook as your agent email, then save.',
        };
    }

    if (!options.fromEmail?.trim()) {
        return {
            ok: false,
            method: 'emailjs',
            error: 'No sender email on your agent profile. Add your email under Travel Agents / Your Profile.',
        };
    }

    try {
        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: emailJsConfig.serviceId,
                template_id: emailJsConfig.templateId,
                user_id: emailJsConfig.publicKey,
                template_params: {
                    to_email: draft.to,
                    to_name: draft.customerName || draft.to.split('@')[0],
                    subject: draft.subject,
                    message: draft.plainBody,
                    html_message: draft.htmlBody,
                    from_name: options.fromName,
                    from_email: options.fromEmail,
                    reply_to: options.fromEmail,
                },
            }),
        });
        if (!res.ok) {
            const detail = await res.text();
            return {
                ok: false,
                method: 'emailjs',
                error: parseEmailJsError(res.status, detail),
            };
        }
        return { ok: true, method: 'emailjs' };
    } catch (e) {
        return {
            ok: false,
            method: 'emailjs',
            error: e instanceof Error ? e.message : 'Failed to reach email service',
        };
    }
};

export const resolveCustomerEmail = (quote: any, leads: any[] = []): string | null => {
    const linkedLead = leads.find(
        (l: any) => l.id === quote?.leadId || l.name === quote?.customer
    );
    const candidates = [linkedLead?.email, quote?.customerEmail, quote?.email].filter(Boolean);
    for (const raw of candidates) {
        const email = String(raw).trim();
        if (!email || email.endsWith('@example.com')) continue;
        if (EMAIL_RE.test(email)) return email;
    }
    return null;
};

export const buildQuoteEmailSubject = (quote: any, agencyName: string) =>
    `Your ${quote.destination || 'Trip'} Proposal — ${agencyName}`;
