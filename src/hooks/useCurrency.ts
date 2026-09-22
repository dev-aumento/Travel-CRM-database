import { useCallback, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import {
    formatMoney,
    formatMoneyAmount,
    formatPriceInputValue,
    getCurrencyCodeLabel,
    getCurrencySymbol,
    parseCurrencyCode,
    parsePriceInputValue,
    resolveAgencyCurrency,
    toDisplayAmount,
    type FormatMoneyOptions,
} from '../utils/currency';

export const useCurrency = () => {
    const { db } = useDatabase();
    const userEmail = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : '';

    const currencySetting = useMemo(
        () => resolveAgencyCurrency(db, userEmail),
        [db?.settings?.data, userEmail]
    );

    const currencyCode = useMemo(() => parseCurrencyCode(currencySetting), [currencySetting]);
    const currencySymbol = useMemo(() => getCurrencySymbol(currencySetting), [currencySetting]);
    const currencyLabel = useMemo(() => getCurrencyCodeLabel(currencySetting), [currencySetting]);

    const format = useCallback(
        (amountInInr: number, options?: FormatMoneyOptions) =>
            formatMoney(amountInInr, currencySetting, options),
        [currencySetting]
    );

    const formatAmount = useCallback(
        (amountInInr: number) => formatMoneyAmount(amountInInr, currencySetting),
        [currencySetting]
    );

    const formatCompact = useCallback(
        (amountInInr: number) => formatMoney(amountInInr, currencySetting, { compact: true }),
        [currencySetting]
    );

    const toInputAmount = useCallback(
        (amountInInr: number) => toDisplayAmount(amountInInr, currencySetting),
        [currencySetting]
    );

    const formatInputValue = useCallback(
        (amountInInr: number) => formatPriceInputValue(amountInInr, currencySetting),
        [currencySetting]
    );

    const parseInputValue = useCallback(
        (raw: string) => parsePriceInputValue(raw, currencySetting),
        [currencySetting]
    );

    const priceInputStep = currencyCode === 'INR' ? 1 : 0.01;

    return {
        currencySetting,
        currencyCode,
        currencySymbol,
        currencyLabel,
        priceInputStep,
        formatMoney: format,
        formatAmount,
        formatCompact,
        toInputAmount,
        formatInputValue,
        parseInputValue,
    };
};
