import React from 'react';
import { Globe, MapPin } from 'lucide-react';
import { getCountryFlagImageForLabel } from '../utils/countryFlags';

type Props = {
    country?: string | null;
    size?: number;
    className?: string;
    /** When country is empty, show a globe instead of a pin. */
    global?: boolean;
};

const CountryFlag: React.FC<Props> = ({ country, size = 20, className = '', global = false }) => {
    if (!country) {
        if (global) {
            return <Globe size={size} className={`text-slate-500 shrink-0 ${className}`} aria-hidden />;
        }
        return <MapPin size={size} className={`text-slate-400 shrink-0 ${className}`} aria-hidden />;
    }

    const src = getCountryFlagImageForLabel(country, size <= 24 ? 20 : 40);
    if (!src) {
        return <MapPin size={size} className={`text-slate-400 shrink-0 ${className}`} aria-hidden />;
    }

    const height = Math.max(12, Math.round(size * 0.72));

    return (
        <img
            src={src}
            alt=""
            width={size}
            height={height}
            className={`inline-block rounded-[2px] object-cover shrink-0 border border-black/5 ${className}`}
            loading="lazy"
            decoding="async"
        />
    );
};

export default CountryFlag;
