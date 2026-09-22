import React, { useMemo, type ReactNode } from 'react';
import CountryFlag from './CountryFlag';
import {
    groupCountriesWithTrending,
    partitionByTrendingCountry,
    resolveWorldCountryName,
} from '../utils/worldLocations';

type StringListProps = {
    options: string[];
    selected?: string | null;
    onSelect: (country: string) => void;
    emptyMessage?: string;
};

const SectionLabel = ({ children }: { children: ReactNode }) => (
    <div className="px-3 pt-2 pb-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
        {children}
    </div>
);

const SectionDivider = () => (
    <div className="my-2 mx-2 border-t border-slate-200" role="separator" />
);

const isSameCountry = (a?: string | null, b?: string | null) => {
    const left = resolveWorldCountryName(String(a || ''));
    const right = resolveWorldCountryName(String(b || ''));
    return Boolean(left && right && left === right);
};

/** Grouped country buttons: Trending → separator → Other countries. */
export const CountryGroupedOptions: React.FC<StringListProps> = ({
    options,
    selected,
    onSelect,
    emptyMessage = 'No countries match your search',
}) => {
    const { trending, other } = useMemo(
        () => groupCountriesWithTrending(options),
        [options]
    );

    if (trending.length === 0 && other.length === 0) {
        return (
            <p className="px-3 py-4 text-center text-[11px] font-semibold text-slate-400">
                {emptyMessage}
            </p>
        );
    }

    const renderButton = (country: string) => {
        const isSelected = isSameCountry(selected, country);

        return (
            <button
                key={country}
                type="button"
                onClick={() => onSelect(country)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                    isSelected
                        ? 'bg-crm-50 text-crm-700'
                        : 'hover:bg-slate-50 text-slate-700'
                }`}
            >
                <CountryFlag country={country} size={22} />
                <span className="text-[11px] font-black uppercase tracking-tight truncate">
                    {country}
                </span>
            </button>
        );
    };

    return (
        <div className="space-y-1">
            {trending.length > 0 && (
                <div>
                    <SectionLabel>Trending countries</SectionLabel>
                    <div className="space-y-1">{trending.map(renderButton)}</div>
                </div>
            )}

            {trending.length > 0 && other.length > 0 && <SectionDivider />}

            {other.length > 0 && (
                <div>
                    <SectionLabel>Other countries</SectionLabel>
                    <div className="space-y-1">{other.map(renderButton)}</div>
                </div>
            )}
        </div>
    );
};

type ItemListProps<T> = {
    items: T[];
    getCountry: (item: T) => string;
    getKey: (item: T) => string;
    selectedCountry?: string | null;
    onSelect: (item: T) => void;
    renderItem: (item: T, isSelected: boolean) => ReactNode;
    emptyMessage?: string;
};

/** Grouped list for non-string destination records (e.g. Leads destinations). */
export function CountryGroupedItemList<T>({
    items,
    getCountry,
    getKey,
    selectedCountry,
    onSelect,
    renderItem,
    emptyMessage = 'No countries match your search',
}: ItemListProps<T>) {
    const { trending, other } = useMemo(
        () => partitionByTrendingCountry(items, getCountry),
        // getCountry is expected to be stable by field access; items drive updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [items]
    );

    if (trending.length === 0 && other.length === 0) {
        return (
            <p className="px-3 py-4 text-center text-[11px] font-semibold text-slate-400">
                {emptyMessage}
            </p>
        );
    }

    const renderSection = (sectionItems: T[]) =>
        sectionItems.map((item) => {
            const country = getCountry(item);
            const isSelected = isSameCountry(selectedCountry, country);
            return (
                <button
                    key={getKey(item)}
                    type="button"
                    onClick={() => onSelect(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        isSelected
                            ? 'bg-crm-50 text-crm-700'
                            : 'hover:bg-slate-50 text-slate-600'
                    }`}
                >
                    {renderItem(item, isSelected)}
                </button>
            );
        });

    return (
        <div className="space-y-1">
            {trending.length > 0 && (
                <div>
                    <SectionLabel>Trending countries</SectionLabel>
                    <div className="space-y-1">{renderSection(trending)}</div>
                </div>
            )}

            {trending.length > 0 && other.length > 0 && <SectionDivider />}

            {other.length > 0 && (
                <div>
                    <SectionLabel>Other countries</SectionLabel>
                    <div className="space-y-1">{renderSection(other)}</div>
                </div>
            )}
        </div>
    );
}

export default CountryGroupedOptions;
