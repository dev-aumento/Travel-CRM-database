import React from 'react';
import { User, Hotel, MapPin, FileText, Pencil } from 'lucide-react';
import { sumStayHotelTotal } from '../utils/hotelStayPricing';
import { useCurrency } from '../hooks/useCurrency';
import type { HotelNightPrice } from '../utils/hotelStayPricing';
import type { HotelSpecialInclusion } from './HotelSpecialInclusionsSection';

export type BuilderStepId =
    | 'customer'
    | 'hotel'
    | 'itinerary'
    | 'additional'
    | 'review';

type HotelStayReview = {
    hotelId: string;
    nights: number;
    hotelInput?: string;
    roomType?: string;
    rooms?: number;
    personsPerRoom?: number;
    extraBed?: number;
    extraBedPrice?: number;
    childWithBed?: number;
    childWithBedPrice?: number;
    childWithoutBed?: number;
    childWithoutBedPrice?: number;
    mealPlan?: string;
    nightPrices?: HotelNightPrice[];
    hotelBookingId?: string;
    specialInclusions?: HotelSpecialInclusion[];
};

type Props = {
    onEditStep: (step: BuilderStepId) => void;
    customerName: string;
    phone: string;
    countryCode: string;
    adults: number;
    kids: number;
    kidsAges: string;
    departureDate: string;
    returnDate: string;
    agentName: string;
    sourceCountry: string;
    sourceAirport: string;
    destination: string;
    packageName: string;
    tripMode: 'package' | 'custom';
    duration: string;
    tripId: string;
    hotelStays: HotelStayReview[];
    hotelSelectionConfirmed: boolean;
    getStayDateLabel: (idx: number) => string;
    getHotelName: (hotelId: string) => string;
    itinerary: any[];
    transportation?: string;
    vehiclePrice?: number;
    hotelMealPlan: string;
    needFlight?: boolean;
    flightMeal?: { optIn: boolean; type: 'Veg' | 'Non-Veg' | 'Vegan' };
    customFlightTotal?: number | null;
    additionalActivities?: Array<{ id: string; title: string; description?: string; rate: number }>;
};

const formatDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ReviewSection = ({
    title,
    icon,
    step,
    onEditStep,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    step: BuilderStepId;
    onEditStep: (step: BuilderStepId) => void;
    children: React.ReactNode;
}) => (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-crm-600 shrink-0">
                    {icon}
                </span>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide truncate">{title}</h3>
            </div>
            <button
                type="button"
                onClick={() => onEditStep(step)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-crm-700 border border-crm-200 bg-white hover:bg-crm-50 transition-colors"
            >
                <Pencil size={12} />
                Edit
            </button>
        </div>
        <div className="p-5">{children}</div>
    </section>
);

const Detail = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-slate-800 break-words">{value || '—'}</p>
    </div>
);

const QuoteBuilderReviewPreview: React.FC<Props> = ({
    onEditStep,
    customerName,
    phone,
    countryCode,
    adults,
    kids,
    kidsAges,
    departureDate,
    returnDate,
    agentName,
    sourceCountry,
    sourceAirport,
    destination,
    packageName,
    tripMode,
    duration,
    tripId,
    hotelStays,
    hotelSelectionConfirmed,
    getStayDateLabel,
    getHotelName,
    itinerary,
    transportation,
    vehiclePrice,
    hotelMealPlan,
    needFlight = true,
    flightMeal,
    customFlightTotal,
    additionalActivities = [],
}) => {
    const { formatMoney } = useCurrency();
    const formatInr = (amount: number) =>
        amount > 0 ? formatMoney(amount) : '—';
    const validStays = hotelStays.filter((s) => s.hotelId && Number(s.nights) > 0);
    const validAdditionalActivities = additionalActivities.filter((a) => a.title?.trim());
    const travelersLabel =
        kids > 0 ? `${adults} Adult${adults !== 1 ? 's' : ''}, ${kids} Kid${kids !== 1 ? 's' : ''}` : `${adults} Adult${adults !== 1 ? 's' : ''}`;
    const activityCount = itinerary.reduce(
        (sum, day) => sum + (Array.isArray(day.activities) ? day.activities.length : 0),
        0
    );
    const itineraryActivityTotal = itinerary.reduce((sum, day) => {
        if (!Array.isArray(day.activities)) return sum;
        return (
            sum +
            day.activities.reduce(
                (daySum: number, act: any) =>
                    daySum + Math.max(0, Number(act.customPrice ?? act.price ?? 0) || 0),
                0
            )
        );
    }, 0);
    const vehicleTotal = Math.max(0, Number(vehiclePrice) || 0);
    const itineraryGrandTotal = itineraryActivityTotal + vehicleTotal;
    const hotelStayTotal = validStays.reduce(
        (sum, stay) => sum + Math.max(0, sumStayHotelTotal(stay as any) || 0),
        0
    );
    const additionalChargesTotal = validAdditionalActivities.reduce(
        (sum, row) => sum + Math.max(0, Number(row.rate) || 0),
        0
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                    <h2 className="text-lg font-black text-slate-900">Quote preview</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Review customer, hotels, itinerary, and options before you send.
                    </p>
                </div>
                {tripId && (
                    <span className="inline-flex self-start px-3 py-1 rounded-full bg-slate-900 text-amber-300 text-xs font-black">
                        Trip ID: {tripId}
                    </span>
                )}
            </div>

            <ReviewSection title="Customer & trip" icon={<User size={16} />} step="customer" onEditStep={onEditStep}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <Detail label="Client name" value={customerName} />
                    <Detail label="Mobile" value={`${countryCode} ${phone}`.trim()} />
                    <Detail label="Travelers" value={travelersLabel} />
                    {kids > 0 && <Detail label="Kids ages" value={kidsAges || '—'} />}
                    <Detail label="Departure" value={formatDate(departureDate)} />
                    <Detail label="Return" value={formatDate(returnDate)} />
                    <Detail label="Duration" value={duration} />
                    <Detail label="Destination" value={destination} />
                    <Detail
                        label="Package"
                        value={tripMode === 'package' ? packageName || 'Template package' : 'Custom plan'}
                    />
                    <Detail label="Assigned agent" value={agentName || 'Unassigned'} />
                    <Detail
                        label="Flying from"
                        value={
                            needFlight === false
                                ? 'N/A'
                                : `${sourceCountry} · ${sourceAirport}`
                        }
                    />
                    <Detail label="Include flight" value={needFlight !== false ? 'Yes' : 'No'} />
                    <Detail
                        label="Flight meals"
                        value={
                            needFlight === false
                                ? 'N/A'
                                : flightMeal?.optIn
                                  ? `Yes (${flightMeal.type})`
                                  : 'No'
                        }
                    />
                    <Detail
                        label="Flight price"
                        value={
                            needFlight === false
                                ? 'N/A'
                                : customFlightTotal && customFlightTotal > 0
                                  ? formatMoney(customFlightTotal)
                                  : 'Default calculated rate'
                        }
                    />
                </div>
            </ReviewSection>

            <ReviewSection title="Hotel selection" icon={<Hotel size={16} />} step="hotel" onEditStep={onEditStep}>
                {validStays.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No hotel stays configured yet.</p>
                ) : (
                    <div className="space-y-3">
                        {validStays.map((stay, idx) => {
                            const stayTotal = sumStayHotelTotal(stay as any);
                            return (
                                <div
                                    key={`${stay.hotelId}-${idx}`}
                                    className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                        <div>
                                            <p className="text-sm font-black text-slate-900">
                                                {stay.hotelInput || getHotelName(stay.hotelId)}
                                            </p>
                                            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                                Stay {idx + 1} · {getStayDateLabel(idx)} · {stay.nights} night
                                                {stay.nights > 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        {stayTotal > 0 && (
                                            <span className="text-sm font-black text-crm-700">{formatInr(stayTotal)}</span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                        <Detail label="Room" value={stay.roomType || 'Standard'} />
                                        <Detail label="Meal plan" value={stay.mealPlan || hotelMealPlan} />
                                        <Detail
                                            label="Rooms / Pax"
                                            value={`${stay.rooms || 1} room · ${stay.personsPerRoom || 2} pax/room`}
                                        />
                                        {(stay.extraBed || 0) > 0 && (
                                            <Detail
                                                label="Extra beds"
                                                value={`${stay.extraBed} @ ${formatInr(stay.extraBedPrice || 0)}/night`}
                                            />
                                        )}
                                        {(stay.childWithBed || 0) > 0 && (
                                            <Detail
                                                label="Child with bed"
                                                value={`${stay.childWithBed} @ ${formatInr(stay.childWithBedPrice || 0)}/night`}
                                            />
                                        )}
                                        {(stay.childWithoutBed || 0) > 0 && (
                                            <Detail
                                                label="Child without bed"
                                                value={`${stay.childWithoutBed} @ ${formatInr(stay.childWithoutBedPrice || 0)}/night`}
                                            />
                                        )}
                                    </div>
                                    {stay.hotelBookingId && hotelSelectionConfirmed && (
                                        <p className="text-[10px] font-mono text-slate-500 mt-2">
                                            Booking ID: {stay.hotelBookingId}
                                        </p>
                                    )}
                                    {(stay.specialInclusions || []).filter((s) => s.name?.trim()).length > 0 && (
                                        <ul className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                                            {(stay.specialInclusions || [])
                                                .filter((s) => s.name?.trim())
                                                .map((s) => (
                                                    <li key={s.id}>
                                                        + {s.name}
                                                        {s.amount != null && s.amount > 0
                                                            ? ` (${formatInr(s.amount)})`
                                                            : ''}
                                                    </li>
                                                ))}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                        {validStays.length > 0 && (
                            <div className="flex items-end justify-between gap-4 pt-3 border-t border-slate-100">
                                <p className="text-[11px] text-slate-400 font-semibold">
                                    {validStays.length} hotel stay{validStays.length !== 1 ? 's' : ''}
                                </p>
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        Hotel total
                                    </p>
                                    <p className="text-sm font-black text-crm-700">
                                        {formatInr(hotelStayTotal)}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ReviewSection>

            <ReviewSection title="Itinerary" icon={<MapPin size={16} />} step="itinerary" onEditStep={onEditStep}>
                {(transportation || vehicleTotal > 0) ? (
                    <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/80">
                        <span className="text-xs font-semibold text-slate-600">
                            Travel vehicle:{' '}
                            <span className="text-crm-700 font-black">{transportation || 'Vehicle'}</span>
                        </span>
                        <span className="text-xs font-black text-crm-600 shrink-0">
                            {formatInr(vehicleTotal)}
                        </span>
                    </div>
                ) : null}
                {itinerary.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No itinerary days yet.</p>
                ) : (
                    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                        {itinerary.map((day: any, dIdx: number) => {
                            const activities = day.activities || [];
                            const dayTitle = day.title || `Day ${dIdx + 1}`;
                            return (
                                <div
                                    key={day.id || dIdx}
                                    className="rounded-xl border border-slate-100 overflow-hidden"
                                >
                                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                                        <span className="text-xs font-black text-slate-800">{dayTitle}</span>
                                        {day.date && (
                                            <span className="text-[10px] text-slate-400 font-semibold">{day.date}</span>
                                        )}
                                    </div>
                                    {activities.length > 0 ? (
                                        <ul className="divide-y divide-slate-50">
                                            {activities.map((act: any, aIdx: number) => (
                                                <li
                                                    key={act.id || aIdx}
                                                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                                                >
                                                    <span className="text-xs font-semibold text-slate-700">
                                                        {act.title}
                                                    </span>
                                                    <span className="text-xs font-black text-crm-600 shrink-0">
                                                        {formatInr(Number(act.customPrice ?? act.price ?? 0))}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="px-4 py-3 text-[11px] text-slate-400 italic">No activities</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="flex items-end justify-between gap-4 mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[11px] text-slate-400 font-semibold">
                        {itinerary.length} day{itinerary.length !== 1 ? 's' : ''} · {activityCount} activit
                        {activityCount === 1 ? 'y' : 'ies'}
                    </p>
                    {(activityCount > 0 || vehicleTotal > 0) && (
                        <div className="text-right shrink-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Itinerary total{vehicleTotal > 0 ? ' (incl. vehicle)' : ''}
                            </p>
                            <p className="text-sm font-black text-crm-700">
                                {formatInr(itineraryGrandTotal)}
                            </p>
                        </div>
                    )}
                </div>
            </ReviewSection>

            {validAdditionalActivities.length > 0 && (
                <ReviewSection title="Additional options" icon={<FileText size={16} />} step="additional" onEditStep={onEditStep}>
                    <ul className="space-y-1.5">
                        {validAdditionalActivities.map((row) => (
                            <li
                                key={row.id}
                                className="flex items-start justify-between gap-3 text-sm"
                            >
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-700">{row.title}</p>
                                    {row.description?.trim() && (
                                        <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap leading-relaxed">
                                            {row.description}
                                        </p>
                                    )}
                                </div>
                                <span className="font-black text-crm-600 shrink-0">
                                    {formatInr(Number(row.rate) || 0)}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex items-end justify-between gap-4 mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[11px] text-slate-400 font-semibold">
                            {validAdditionalActivities.length} additional charge
                            {validAdditionalActivities.length !== 1 ? 's' : ''}
                        </p>
                        <div className="text-right shrink-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Additional charges total
                            </p>
                            <p className="text-sm font-black text-crm-700">
                                {formatInr(additionalChargesTotal)}
                            </p>
                        </div>
                    </div>
                </ReviewSection>
            )}
        </div>
    );
};

export default QuoteBuilderReviewPreview;
