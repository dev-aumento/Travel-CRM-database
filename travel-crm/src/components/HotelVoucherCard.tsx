import React from 'react';
import {
    formatVoucherDateTime,
    getStayCheckDates,
    mealPlanVoucherLabel,
} from '../utils/hotelBookingIds';
import { buildNightPricesForStay, sumStayHotelTotal } from '../utils/hotelStayPricing';
import { useCurrency } from '../hooks/useCurrency';

export type HotelStayVoucherData = {
    hotelId: string;
    nights: number;
    hotelInput?: string;
    roomType?: string;
    rooms?: number;
    personsPerRoom?: number;
    extraBed?: number;
    extraBedPrice?: number;
    mealPlan?: string;
    hotelBookingId?: string;
    bookingCnf?: string;
    nightPrices?: Array<{
        rate: number;
        given: number;
        specialInclusions?: Array<{ id: string; name: string; amount?: number }>;
    }>;
    specialInclusions?: Array<{ id: string; name: string; amount?: number }>;
};

type HotelVoucherCardProps = {
    stay: HotelStayVoucherData;
    stayIdx: number;
    allStays: HotelStayVoucherData[];
    tripId: string;
    customerName: string;
    travelers: string;
    departureDate: string;
    hotelRecord?: any;
    hotelTier?: string;
    agencyName?: string;
    agencyAddress?: string;
    agencyPhone?: string;
    agencyEmail?: string;
    compact?: boolean;
    /** When set, Booking CNF is editable and synced to Hotel Booking ID. */
    bookingId?: string;
    onBookingIdChange?: (value: string) => void;
    onBookingIdBlur?: () => void;
    editableBookingId?: boolean;
};

const ordinalNight = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const HotelVoucherCard = ({
    stay,
    stayIdx,
    allStays,
    tripId,
    customerName,
    travelers,
    departureDate,
    hotelRecord,
    hotelTier,
    agencyName = 'Travel Agency',
    agencyAddress,
    agencyPhone,
    agencyEmail,
    compact = false,
    bookingId: bookingIdProp,
    onBookingIdChange,
    onBookingIdBlur,
    editableBookingId = false,
}: HotelVoucherCardProps) => {
    const { formatMoney } = useCurrency();
    const hotelName = hotelRecord?.name || stay.hotelInput || 'Hotel';
    const hotelLocation =
        hotelRecord?.location || hotelRecord?.destination || '';
    const fallbackBookingId = stay.bookingCnf || stay.hotelBookingId || '';
    const bookingId = bookingIdProp ?? fallbackBookingId;
    const displayBookingId = bookingId.trim() || '—';
    const { checkIn, checkOut, nights } = getStayCheckDates(departureDate, stayIdx, allStays);
    const checkInLabel = formatVoucherDateTime(checkIn, '12:00 hrs');
    const checkOutLabel = formatVoucherDateTime(checkOut, '10:00 hrs');

    const nightPrices = buildNightPricesForStay(
        stay.nights,
        hotelRecord,
        hotelTier || 'Standard',
        stay.rooms || 1,
        stay.nightPrices
    );
    const offsetNights = allStays
        .slice(0, stayIdx)
        .reduce((sum, s) => sum + Math.max(1, Number(s.nights) || 1), 0);
    const baseDate = departureDate ? new Date(departureDate) : null;

    const roomDesc = `${stay.rooms || 1} ${stay.roomType || 'Room'} (${stay.personsPerRoom || 2} Pax${
        (stay.extraBed || 0) > 0 ? ` + ${stay.extraBed} extra bed` : ''
    })`;

    const stayTotal = sumStayHotelTotal(stay);

    return (
        <div
            className={`bg-white border border-slate-200 rounded-2xl overflow-hidden ${
                compact ? 'text-[11px]' : ''
            }`}
        >
            {!compact && (agencyName || agencyAddress) && (
                <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                    <p className="text-lg font-black text-slate-900">{agencyName}</p>
                    {agencyAddress && (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{agencyAddress}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-600">
                        {agencyPhone && <span>{agencyPhone}</span>}
                        {agencyEmail && <span>{agencyEmail}</span>}
                    </div>
                </div>
            )}

            <div className="px-6 py-5">
                <h3 className="text-center text-base font-black text-slate-900 uppercase tracking-wide border-b-4 border-crm-500 pb-2 mb-6">
                    Hotel Voucher
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-5 border-b border-slate-200">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Hotel Details
                        </p>
                        <p className="text-sm font-black text-slate-900">{hotelName}</p>
                        {hotelLocation && (
                            <p className="text-xs text-slate-500 italic mt-0.5">{hotelLocation}</p>
                        )}
                    </div>
                    <div className="md:text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Guest Details
                        </p>
                        <p className="text-sm font-black text-slate-900">{customerName}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{travelers}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-slate-500 shrink-0">Booking CNF:</span>
                        {editableBookingId && onBookingIdChange ? (
                            <input
                                type="text"
                                value={bookingId}
                                onChange={(e) => onBookingIdChange(e.target.value)}
                                onBlur={onBookingIdBlur}
                                placeholder="Enter confirmation ID"
                                className="min-w-[140px] max-w-[220px] px-3 py-1.5 rounded-lg bg-violet-50 text-violet-900 text-sm font-bold border border-violet-200 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
                            />
                        ) : (
                            <span className="px-3 py-1 rounded-lg bg-violet-100 text-violet-800 text-sm font-black border border-violet-200">
                                {displayBookingId}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Trip ID:</span>
                        <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-900 text-sm font-black border border-amber-200">
                            {tripId}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Hotel Booking ID</span>
                        <span className="px-2 py-1 rounded bg-slate-900 text-white text-xs font-mono font-bold truncate max-w-[180px]">
                            {displayBookingId}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-5 border-b border-slate-200 text-center md:text-left">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Check-in</p>
                        <p className="text-xs font-bold text-slate-800">{checkInLabel}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-black text-slate-900">
                            {nights} Night{nights > 1 ? 's' : ''}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Duration</p>
                    </div>
                    <div className="md:text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Check-out</p>
                        <p className="text-xs font-bold text-slate-800">{checkOutLabel}</p>
                    </div>
                </div>

                <table className="w-full text-left mt-4">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="py-2 text-[10px] font-black text-slate-400 uppercase w-16"># Night</th>
                            <th className="py-2 text-[10px] font-black text-slate-400 uppercase">Meal Plan</th>
                            <th className="py-2 text-[10px] font-black text-slate-400 uppercase">Rooms</th>
                            {!compact && (
                                <th className="py-2 text-[10px] font-black text-slate-400 uppercase text-right">
                                    Rate
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {nightPrices.slice(0, nights).map((np, nightIdx) => {
                            let nightDate = `Night ${nightIdx + 1}`;
                            if (baseDate && !Number.isNaN(baseDate.getTime())) {
                                const d = new Date(baseDate);
                                d.setDate(d.getDate() + offsetNights + nightIdx);
                                nightDate = d.toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                });
                            }
                            return (
                                <tr key={nightIdx} className="border-b border-slate-50">
                                    <td className="py-2.5 text-xs font-bold text-slate-700">
                                        {ordinalNight(nightIdx + 1)}
                                        <span className="block text-[10px] font-normal text-slate-400">
                                            {nightDate}
                                        </span>
                                    </td>
                                    <td className="py-2.5 text-xs text-slate-700">
                                        {mealPlanVoucherLabel(stay.mealPlan)}
                                    </td>
                                    <td className="py-2.5 text-xs text-slate-700">{roomDesc}</td>
                                    {!compact && (
                                        <td className="py-2.5 text-xs font-bold text-slate-800 text-right">
                                            {formatMoney(Math.round(np.given || np.rate))}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {(() => {
                    const stayLevel = (stay.specialInclusions || []).filter((s) => s.name?.trim());
                    const nightLevel = nightPrices
                        .slice(0, nights)
                        .flatMap((np, i) =>
                            (np.specialInclusions || [])
                                .filter((s) => s.name?.trim())
                                .map((s) => ({ ...s, nightIdx: i }))
                        );
                    const all = [...stayLevel, ...nightLevel];
                    if (all.length === 0) return null;
                    return (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                Special inclusions
                            </p>
                            <ul className="space-y-1 text-xs text-slate-700">
                                {stayLevel.map((s) => (
                                    <li key={s.id} className="flex justify-between gap-2">
                                        <span>{s.name}</span>
                                        {s.amount != null && s.amount > 0 && (
                                            <span className="font-bold shrink-0">
                                                {formatMoney(s.amount)}
                                            </span>
                                        )}
                                    </li>
                                ))}
                                {nightLevel.map((s) => (
                                    <li key={`${s.nightIdx}-${s.id}`} className="flex justify-between gap-2">
                                        <span>
                                            Night {s.nightIdx + 1}: {s.name}
                                        </span>
                                        {s.amount != null && s.amount > 0 && (
                                            <span className="font-bold shrink-0">
                                                {formatMoney(s.amount)}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })()}

                {stayTotal > 0 && (
                    <p className="text-right text-xs font-black text-crm-700 mt-4 pt-3 border-t border-slate-100">
                        Stay total: {formatMoney(stayTotal)}
                    </p>
                )}

                <p className="text-[10px] text-slate-400 mt-4 italic text-center">
                    Present <strong>Hotel Booking ID {displayBookingId}</strong> and <strong>Trip ID {tripId}</strong> at
                    check-in.
                </p>
            </div>
        </div>
    );
};

export default HotelVoucherCard;
