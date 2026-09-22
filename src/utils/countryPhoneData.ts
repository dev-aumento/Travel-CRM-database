export type CountryPhoneEntry = { code: string; name: string; digits: number };

/** Local subscriber digit length (excluding country dial code). */
export const COUNTRY_PHONE_DATA: CountryPhoneEntry[] = [
    { code: '+91', name: 'India', digits: 10 },
    { code: '+92', name: 'Pakistan', digits: 10 },
    { code: '+94', name: 'Sri Lanka', digits: 9 },
    { code: '+977', name: 'Nepal', digits: 10 },
    { code: '+880', name: 'Bangladesh', digits: 10 },
    { code: '+960', name: 'Maldives', digits: 7 },
    { code: '+975', name: 'Bhutan', digits: 8 },
    { code: '+93', name: 'Afghanistan', digits: 9 },
    { code: '+86', name: 'China', digits: 11 },
    { code: '+81', name: 'Japan', digits: 10 },
    { code: '+82', name: 'South Korea', digits: 10 },
    { code: '+84', name: 'Vietnam', digits: 10 },
    { code: '+66', name: 'Thailand', digits: 9 },
    { code: '+65', name: 'Singapore', digits: 8 },
    { code: '+60', name: 'Malaysia', digits: 10 },
    { code: '+62', name: 'Indonesia', digits: 11 },
    { code: '+63', name: 'Philippines', digits: 10 },
    { code: '+95', name: 'Myanmar', digits: 9 },
    { code: '+855', name: 'Cambodia', digits: 9 },
    { code: '+856', name: 'Laos', digits: 9 },
    { code: '+673', name: 'Brunei', digits: 7 },
    { code: '+852', name: 'Hong Kong', digits: 8 },
    { code: '+853', name: 'Macao', digits: 8 },
    { code: '+886', name: 'Taiwan', digits: 9 },
    { code: '+976', name: 'Mongolia', digits: 8 },
    { code: '+7', name: 'Russia', digits: 10 },
    { code: '+998', name: 'Uzbekistan', digits: 9 },
    { code: '+992', name: 'Tajikistan', digits: 9 },
    { code: '+993', name: 'Turkmenistan', digits: 8 },
    { code: '+996', name: 'Kyrgyzstan', digits: 9 },
    { code: '+994', name: 'Azerbaijan', digits: 9 },
    { code: '+995', name: 'Georgia', digits: 9 },
    { code: '+374', name: 'Armenia', digits: 8 },
    { code: '+971', name: 'UAE', digits: 9 },
    { code: '+966', name: 'Saudi Arabia', digits: 9 },
    { code: '+974', name: 'Qatar', digits: 8 },
    { code: '+965', name: 'Kuwait', digits: 8 },
    { code: '+968', name: 'Oman', digits: 8 },
    { code: '+973', name: 'Bahrain', digits: 8 },
    { code: '+972', name: 'Israel', digits: 9 },
    { code: '+961', name: 'Lebanon', digits: 8 },
    { code: '+962', name: 'Jordan', digits: 9 },
    { code: '+963', name: 'Syria', digits: 9 },
    { code: '+964', name: 'Iraq', digits: 10 },
    { code: '+967', name: 'Yemen', digits: 9 },
    { code: '+98', name: 'Iran', digits: 10 },
    { code: '+44', name: 'United Kingdom', digits: 10 },
    { code: '+33', name: 'France', digits: 9 },
    { code: '+49', name: 'Germany', digits: 10 },
    { code: '+39', name: 'Italy', digits: 10 },
    { code: '+34', name: 'Spain', digits: 9 },
    { code: '+351', name: 'Portugal', digits: 9 },
    { code: '+31', name: 'Netherlands', digits: 9 },
    { code: '+32', name: 'Belgium', digits: 9 },
    { code: '+41', name: 'Switzerland', digits: 9 },
    { code: '+43', name: 'Austria', digits: 10 },
    { code: '+46', name: 'Sweden', digits: 9 },
    { code: '+47', name: 'Norway', digits: 8 },
    { code: '+45', name: 'Denmark', digits: 8 },
    { code: '+358', name: 'Finland', digits: 10 },
    { code: '+354', name: 'Iceland', digits: 7 },
    { code: '+353', name: 'Ireland', digits: 9 },
    { code: '+30', name: 'Greece', digits: 10 },
    { code: '+90', name: 'Turkey', digits: 10 },
    { code: '+380', name: 'Ukraine', digits: 9 },
    { code: '+375', name: 'Belarus', digits: 9 },
    { code: '+48', name: 'Poland', digits: 9 },
    { code: '+420', name: 'Czech Republic', digits: 9 },
    { code: '+421', name: 'Slovakia', digits: 9 },
    { code: '+36', name: 'Hungary', digits: 9 },
    { code: '+40', name: 'Romania', digits: 9 },
    { code: '+359', name: 'Bulgaria', digits: 9 },
    { code: '+381', name: 'Serbia', digits: 9 },
    { code: '+385', name: 'Croatia', digits: 9 },
    { code: '+386', name: 'Slovenia', digits: 8 },
    { code: '+387', name: 'Bosnia', digits: 8 },
    { code: '+356', name: 'Malta', digits: 8 },
    { code: '+357', name: 'Cyprus', digits: 8 },
    { code: '+370', name: 'Lithuania', digits: 8 },
    { code: '+371', name: 'Latvia', digits: 8 },
    { code: '+372', name: 'Estonia', digits: 8 },
    { code: '+373', name: 'Moldova', digits: 8 },
    { code: '+355', name: 'Albania', digits: 9 },
    { code: '+389', name: 'North Macedonia', digits: 8 },
    { code: '+382', name: 'Montenegro', digits: 8 },
    { code: '+1', name: 'USA / Canada', digits: 10 },
    { code: '+52', name: 'Mexico', digits: 10 },
    { code: '+55', name: 'Brazil', digits: 11 },
    { code: '+54', name: 'Argentina', digits: 10 },
    { code: '+57', name: 'Colombia', digits: 10 },
    { code: '+56', name: 'Chile', digits: 9 },
    { code: '+51', name: 'Peru', digits: 9 },
    { code: '+58', name: 'Venezuela', digits: 10 },
    { code: '+593', name: 'Ecuador', digits: 9 },
    { code: '+595', name: 'Paraguay', digits: 9 },
    { code: '+598', name: 'Uruguay', digits: 9 },
    { code: '+591', name: 'Bolivia', digits: 8 },
    { code: '+506', name: 'Costa Rica', digits: 8 },
    { code: '+507', name: 'Panama', digits: 8 },
    { code: '+502', name: 'Guatemala', digits: 8 },
    { code: '+503', name: 'El Salvador', digits: 8 },
    { code: '+504', name: 'Honduras', digits: 8 },
    { code: '+505', name: 'Nicaragua', digits: 8 },
    { code: '+53', name: 'Cuba', digits: 8 },
    { code: '+509', name: 'Haiti', digits: 8 },
    { code: '+1868', name: 'Trinidad & Tobago', digits: 7 },
    { code: '+1876', name: 'Jamaica', digits: 7 },
    { code: '+27', name: 'South Africa', digits: 9 },
    { code: '+234', name: 'Nigeria', digits: 10 },
    { code: '+254', name: 'Kenya', digits: 9 },
    { code: '+233', name: 'Ghana', digits: 9 },
    { code: '+256', name: 'Uganda', digits: 9 },
    { code: '+255', name: 'Tanzania', digits: 9 },
    { code: '+251', name: 'Ethiopia', digits: 9 },
    { code: '+252', name: 'Somalia', digits: 9 },
    { code: '+249', name: 'Sudan', digits: 9 },
    { code: '+20', name: 'Egypt', digits: 10 },
    { code: '+212', name: 'Morocco', digits: 9 },
    { code: '+213', name: 'Algeria', digits: 9 },
    { code: '+216', name: 'Tunisia', digits: 8 },
    { code: '+218', name: 'Libya', digits: 9 },
    { code: '+225', name: 'Ivory Coast', digits: 10 },
    { code: '+237', name: 'Cameroon', digits: 9 },
    { code: '+260', name: 'Zambia', digits: 9 },
    { code: '+263', name: 'Zimbabwe', digits: 9 },
    { code: '+250', name: 'Rwanda', digits: 9 },
    { code: '+258', name: 'Mozambique', digits: 9 },
    { code: '+261', name: 'Madagascar', digits: 9 },
    { code: '+230', name: 'Mauritius', digits: 8 },
    { code: '+244', name: 'Angola', digits: 9 },
    { code: '+264', name: 'Namibia', digits: 9 },
    { code: '+267', name: 'Botswana', digits: 8 },
    { code: '+266', name: 'Lesotho', digits: 8 },
    { code: '+268', name: 'Eswatini', digits: 8 },
    { code: '+61', name: 'Australia', digits: 9 },
    { code: '+64', name: 'New Zealand', digits: 9 },
    { code: '+675', name: 'Papua New Guinea', digits: 8 },
    { code: '+679', name: 'Fiji', digits: 7 },
];

/** Short country labels for mobile dial-code selectors (IND, US, UK, UAE, PK, …). */
export const COUNTRY_PHONE_ABBR: Record<string, string> = {
    '+91': 'IND',
    '+92': 'PK',
    '+94': 'LK',
    '+977': 'NP',
    '+880': 'BD',
    '+960': 'MV',
    '+975': 'BT',
    '+93': 'AF',
    '+86': 'CN',
    '+81': 'JP',
    '+82': 'KR',
    '+84': 'VN',
    '+66': 'TH',
    '+65': 'SG',
    '+60': 'MY',
    '+62': 'ID',
    '+63': 'PH',
    '+95': 'MM',
    '+855': 'KH',
    '+856': 'LA',
    '+673': 'BN',
    '+852': 'HK',
    '+853': 'MO',
    '+886': 'TW',
    '+976': 'MN',
    '+7': 'RU',
    '+998': 'UZ',
    '+992': 'TJ',
    '+993': 'TM',
    '+996': 'KG',
    '+994': 'AZ',
    '+995': 'GE',
    '+374': 'AM',
    '+971': 'UAE',
    '+966': 'SA',
    '+974': 'QA',
    '+965': 'KW',
    '+968': 'OM',
    '+973': 'BH',
    '+972': 'IL',
    '+961': 'LB',
    '+962': 'JO',
    '+963': 'SY',
    '+964': 'IQ',
    '+967': 'YE',
    '+98': 'IR',
    '+44': 'UK',
    '+33': 'FR',
    '+49': 'DE',
    '+39': 'IT',
    '+34': 'ES',
    '+351': 'PT',
    '+31': 'NL',
    '+32': 'BE',
    '+41': 'CH',
    '+43': 'AT',
    '+46': 'SE',
    '+47': 'NO',
    '+45': 'DK',
    '+358': 'FI',
    '+354': 'IS',
    '+353': 'IE',
    '+30': 'GR',
    '+90': 'TR',
    '+380': 'UA',
    '+375': 'BY',
    '+48': 'PL',
    '+420': 'CZ',
    '+421': 'SK',
    '+36': 'HU',
    '+40': 'RO',
    '+359': 'BG',
    '+381': 'RS',
    '+385': 'HR',
    '+386': 'SI',
    '+387': 'BA',
    '+356': 'MT',
    '+357': 'CY',
    '+370': 'LT',
    '+371': 'LV',
    '+372': 'EE',
    '+373': 'MD',
    '+355': 'AL',
    '+389': 'MK',
    '+382': 'ME',
    '+1': 'US',
    '+52': 'MX',
    '+55': 'BR',
    '+54': 'AR',
    '+57': 'CO',
    '+56': 'CL',
    '+51': 'PE',
    '+58': 'VE',
    '+593': 'EC',
    '+595': 'PY',
    '+598': 'UY',
    '+591': 'BO',
    '+506': 'CR',
    '+507': 'PA',
    '+502': 'GT',
    '+503': 'SV',
    '+504': 'HN',
    '+505': 'NI',
    '+53': 'CU',
    '+509': 'HT',
    '+1868': 'TT',
    '+1876': 'JM',
    '+27': 'ZA',
    '+234': 'NG',
    '+254': 'KE',
    '+233': 'GH',
    '+256': 'UG',
    '+255': 'TZ',
    '+251': 'ET',
    '+252': 'SO',
    '+249': 'SD',
    '+20': 'EG',
    '+212': 'MA',
    '+213': 'DZ',
    '+216': 'TN',
    '+218': 'LY',
    '+225': 'CI',
    '+237': 'CM',
    '+260': 'ZM',
    '+263': 'ZW',
    '+250': 'RW',
    '+258': 'MZ',
    '+261': 'MG',
    '+230': 'MU',
    '+244': 'AO',
    '+264': 'NA',
    '+267': 'BW',
    '+266': 'LS',
    '+268': 'SZ',
    '+61': 'AU',
    '+64': 'NZ',
    '+675': 'PG',
    '+679': 'FJ',
};

export const getCountryPhoneAbbreviation = (dialCode: string): string =>
    COUNTRY_PHONE_ABBR[dialCode] ?? dialCode.replace(/^\+/, '');

export const getCountryPhoneLabel = (dialCode: string): string =>
    `${getCountryPhoneAbbreviation(dialCode)} (${dialCode})`;

export const PHONE_LIMITS: Record<string, { digits: number; name: string }> = Object.fromEntries(
    COUNTRY_PHONE_DATA.map((c) => [c.code, { digits: c.digits, name: c.name }])
);

export const DEFAULT_COUNTRY_CODE = '+91';

const COUNTRY_CODES_BY_LENGTH = [...COUNTRY_PHONE_DATA].sort((a, b) => b.code.length - a.code.length);

export function getPhoneDigitLimit(countryCode: string): number {
    return PHONE_LIMITS[countryCode]?.digits ?? 15;
}

export function sanitizeLocalPhoneDigits(value: string, countryCode: string): string {
    const limit = getPhoneDigitLimit(countryCode);
    return value.replace(/\D/g, '').slice(0, limit);
}

export function parseStoredAgentPhone(stored?: string): { countryCode: string; phone: string } {
    if (!stored?.trim()) {
        return { countryCode: DEFAULT_COUNTRY_CODE, phone: '' };
    }

    const trimmed = stored.trim();
    for (const country of COUNTRY_CODES_BY_LENGTH) {
        if (trimmed.startsWith(country.code)) {
            const local = trimmed.slice(country.code.length).trim();
            return {
                countryCode: country.code,
                phone: sanitizeLocalPhoneDigits(local, country.code),
            };
        }
    }

    const parts = trimmed.split(/\s+/);
    const code = parts[0]?.startsWith('+') ? parts[0] : DEFAULT_COUNTRY_CODE;
    const localRaw = parts[0]?.startsWith('+') ? parts.slice(1).join('') : trimmed;
    return {
        countryCode: PHONE_LIMITS[code] ? code : DEFAULT_COUNTRY_CODE,
        phone: sanitizeLocalPhoneDigits(localRaw, PHONE_LIMITS[code] ? code : DEFAULT_COUNTRY_CODE),
    };
}

export function formatStoredAgentPhone(countryCode: string, localDigits: string): string {
    const digits = sanitizeLocalPhoneDigits(localDigits, countryCode);
    return digits ? `${countryCode} ${digits}` : '';
}

export function validateLocalPhone(countryCode: string, localDigits: string): string | undefined {
    const limit = getPhoneDigitLimit(countryCode);
    const digits = sanitizeLocalPhoneDigits(localDigits, countryCode);
    if (!digits) return 'Mobile number is required';
    if (digits.length !== limit) {
        const countryName = PHONE_LIMITS[countryCode]?.name ?? 'selected country';
        return `${countryName} numbers require exactly ${limit} digits`;
    }
    return undefined;
}
