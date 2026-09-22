export type TimezoneOption = {
    value: string;
    label: string;
};

export const DEFAULT_TIMEZONE = 'India Standard Time (IST)';

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
    { value: 'India Standard Time (IST)', label: 'India Standard Time (IST)' },
    { value: 'Eastern Time (ET)', label: 'Eastern Time (ET)' },
    { value: 'Pacific Time (PT)', label: 'Pacific Time (PT)' },
    { value: 'Central European Time (CET)', label: 'CET (Paris/Berlin)' },
    { value: 'Gulf Standard Time (GST)', label: 'GST (Dubai)' },
];
