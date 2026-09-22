import { internationalAirports, type Airport } from './aviationData';

/** ISO-style English country names (UN members + common territories). */
export const WORLD_COUNTRIES: string[] = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina',
    'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
    'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana',
    'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
    'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
    'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Democratic Republic of the Congo',
    'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador',
    'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France',
    'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea',
    'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran',
    'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan',
    'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia',
    'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives',
    'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova',
    'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal',
    'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia',
    'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
    'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis',
    'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
    'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
    'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
    'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand',
    'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
    'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
    'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

const COUNTRY_ALIASES: Record<string, string> = {
    uae: 'United Arab Emirates',
    dubai: 'United Arab Emirates',
    uk: 'United Kingdom',
    usa: 'United States',
    us: 'United States',
    america: 'United States',
    bali: 'Indonesia',
    'ivory coast': 'Ivory Coast',
    "cote d'ivoire": 'Ivory Coast',
    'czechia': 'Czech Republic',
    'south korea': 'South Korea',
    'north korea': 'North Korea',
    'russia': 'Russia',
    'viet nam': 'Vietnam',
};

/** Maps aviation catalog keys to standard country names. */
const AVIATION_COUNTRY_MAP: Record<string, string> = {
    India: 'India',
    Dubai: 'United Arab Emirates',
    Bali: 'Indonesia',
    Thailand: 'Thailand',
    Singapore: 'Singapore',
    Vietnam: 'Vietnam',
    Maldives: 'Maldives',
    Mauritius: 'Mauritius',
    Switzerland: 'Switzerland',
    France: 'France',
    Japan: 'Japan',
    Australia: 'Australia',
    USA: 'United States',
    'United Kingdom': 'United Kingdom',
    UK: 'United Kingdom',
};

/** Major cities / places per country for destination builder dropdowns. */
const COUNTRY_MAJOR_CITIES: Record<string, string[]> = {
    Afghanistan: ['Kabul', 'Kandahar', 'Herat'],
    Albania: ['Tirana', 'Durres', 'Vlore'],
    Algeria: ['Algiers', 'Oran', 'Constantine'],
    Argentina: ['Buenos Aires', 'Cordoba', 'Mendoza', 'Bariloche', 'Ushuaia'],
    Armenia: ['Yerevan', 'Gyumri'],
    Australia: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Gold Coast', 'Hobart', 'Darwin', 'Cairns'],
    Austria: ['Vienna', 'Salzburg', 'Innsbruck', 'Graz'],
    Azerbaijan: ['Baku', 'Ganja'],
    Bahrain: ['Manama'],
    Bangladesh: ['Dhaka', 'Chittagong', 'Cox\'s Bazar'],
    Belarus: ['Minsk'],
    Belgium: ['Brussels', 'Antwerp', 'Bruges', 'Ghent'],
    Bhutan: ['Thimphu', 'Paro'],
    Bolivia: ['La Paz', 'Santa Cruz', 'Sucre'],
    'Bosnia and Herzegovina': ['Sarajevo', 'Mostar'],
    Brazil: ['Rio de Janeiro', 'Sao Paulo', 'Brasilia', 'Salvador', 'Fortaleza', 'Manaus'],
    Brunei: ['Bandar Seri Begawan'],
    Bulgaria: ['Sofia', 'Plovdiv', 'Varna'],
    Cambodia: ['Phnom Penh', 'Siem Reap', 'Sihanoukville'],
    Canada: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Quebec City'],
    Chile: ['Santiago', 'Valparaiso', 'Patagonia'],
    China: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Xi\'an', 'Hong Kong'],
    Colombia: ['Bogota', 'Medellin', 'Cartagena', 'Cali'],
    'Costa Rica': ['San Jose', 'Liberia', 'La Fortuna'],
    Croatia: ['Zagreb', 'Dubrovnik', 'Split', 'Zadar'],
    Cuba: ['Havana', 'Varadero'],
    Cyprus: ['Nicosia', 'Limassol', 'Paphos'],
    'Czech Republic': ['Prague', 'Brno', 'Cesky Krumlov'],
    Denmark: ['Copenhagen', 'Aarhus', 'Odense'],
    Ecuador: ['Quito', 'Guayaquil', 'Galapagos'],
    Egypt: ['Cairo', 'Luxor', 'Aswan', 'Alexandria', 'Sharm El Sheikh', 'Hurghada'],
    Estonia: ['Tallinn', 'Tartu'],
    Ethiopia: ['Addis Ababa', 'Lalibela'],
    Fiji: ['Nadi', 'Suva'],
    Finland: ['Helsinki', 'Rovaniemi', 'Tampere'],
    France: ['Paris', 'Nice', 'Lyon', 'Marseille', 'Bordeaux', 'Strasbourg'],
    Georgia: ['Tbilisi', 'Batumi'],
    Germany: ['Berlin', 'Munich', 'Frankfurt', 'Hamburg', 'Cologne', 'Dresden'],
    Ghana: ['Accra', 'Kumasi'],
    Greece: ['Athens', 'Santorini', 'Mykonos', 'Thessaloniki', 'Crete'],
    Hungary: ['Budapest', 'Debrecen'],
    Iceland: ['Reykjavik', 'Akureyri'],
    India: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Jaipur', 'Goa', 'Kerala', 'Agra', 'Udaipur'],
    Indonesia: ['Bali', 'Jakarta', 'Yogyakarta', 'Lombok', 'Surabaya', 'Bandung'],
    Iran: ['Tehran', 'Isfahan', 'Shiraz'],
    Iraq: ['Baghdad', 'Erbil'],
    Ireland: ['Dublin', 'Cork', 'Galway'],
    Israel: ['Tel Aviv', 'Jerusalem', 'Haifa', 'Eilat'],
    Italy: ['Rome', 'Milan', 'Venice', 'Florence', 'Naples', 'Amalfi Coast', 'Sicily'],
    Jamaica: ['Kingston', 'Montego Bay', 'Negril'],
    Japan: ['Tokyo', 'Osaka', 'Kyoto', 'Hiroshima', 'Sapporo', 'Nara'],
    Jordan: ['Amman', 'Petra', 'Aqaba', 'Dead Sea'],
    Kazakhstan: ['Almaty', 'Astana'],
    Kenya: ['Nairobi', 'Mombasa', 'Masai Mara'],
    Kuwait: ['Kuwait City'],
    Laos: ['Vientiane', 'Luang Prabang'],
    Latvia: ['Riga'],
    Lebanon: ['Beirut', 'Byblos'],
    Lithuania: ['Vilnius', 'Kaunas'],
    Luxembourg: ['Luxembourg City'],
    Madagascar: ['Antananarivo', 'Nosy Be'],
    Malaysia: ['Kuala Lumpur', 'Penang', 'Langkawi', 'Malacca', 'Kota Kinabalu'],
    Maldives: ['Male', 'Maafushi', 'Hulhumale'],
    Malta: ['Valletta', 'Sliema'],
    Mauritius: ['Port Louis', 'Grand Baie', 'Flic en Flac'],
    Mexico: ['Mexico City', 'Cancun', 'Playa del Carmen', 'Guadalajara', 'Tulum', 'Los Cabos'],
    Monaco: ['Monaco'],
    Mongolia: ['Ulaanbaatar'],
    Montenegro: ['Podgorica', 'Kotor', 'Budva'],
    Morocco: ['Marrakech', 'Casablanca', 'Fes', 'Rabat', 'Chefchaouen'],
    Myanmar: ['Yangon', 'Mandalay', 'Bagan'],
    Nepal: ['Kathmandu', 'Pokhara', 'Chitwan'],
    Netherlands: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht'],
    'New Zealand': ['Auckland', 'Wellington', 'Queenstown', 'Christchurch', 'Rotorua'],
    Nigeria: ['Lagos', 'Abuja', 'Port Harcourt'],
    'North Macedonia': ['Skopje', 'Ohrid'],
    Norway: ['Oslo', 'Bergen', 'Tromso', 'Stavanger'],
    Oman: ['Muscat', 'Salalah', 'Nizwa'],
    Pakistan: ['Karachi', 'Lahore', 'Islamabad', 'Murree'],
    Peru: ['Lima', 'Cusco', 'Arequipa', 'Machu Picchu'],
    Philippines: ['Manila', 'Cebu', 'Boracay', 'Palawan', 'Davao'],
    Poland: ['Warsaw', 'Krakow', 'Gdansk', 'Wroclaw'],
    Portugal: ['Lisbon', 'Porto', 'Faro', 'Madeira'],
    Qatar: ['Doha'],
    Romania: ['Bucharest', 'Brasov', 'Sibiu'],
    Russia: ['Moscow', 'Saint Petersburg', 'Sochi', 'Kazan'],
    'Saudi Arabia': ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Al Ula'],
    Senegal: ['Dakar', 'Saint-Louis'],
    Serbia: ['Belgrade', 'Novi Sad'],
    Seychelles: ['Victoria', 'Mahe', 'Praslin'],
    Singapore: ['Singapore'],
    Slovakia: ['Bratislava', 'Kosice'],
    Slovenia: ['Ljubljana', 'Bled'],
    'South Africa': ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Kruger'],
    'South Korea': ['Seoul', 'Busan', 'Jeju', 'Incheon'],
    Spain: ['Madrid', 'Barcelona', 'Seville', 'Valencia', 'Ibiza', 'Granada', 'Malaga'],
    'Sri Lanka': ['Colombo', 'Kandy', 'Galle', 'Ella', 'Sigiriya'],
    Sweden: ['Stockholm', 'Gothenburg', 'Malmo'],
    Switzerland: ['Zurich', 'Geneva', 'Interlaken', 'Lucerne', 'Bern', 'Zermatt'],
    Taiwan: ['Taipei', 'Kaohsiung', 'Taichung'],
    Tanzania: ['Dar es Salaam', 'Zanzibar', 'Arusha', 'Serengeti'],
    Thailand: ['Bangkok', 'Phuket', 'Chiang Mai', 'Pattaya', 'Krabi', 'Koh Samui'],
    Tunisia: ['Tunis', 'Sousse', 'Hammamet'],
    Turkey: ['Istanbul', 'Cappadocia', 'Antalya', 'Bodrum', 'Izmir', 'Ankara'],
    Uganda: ['Kampala', 'Entebbe'],
    Ukraine: ['Kyiv', 'Lviv', 'Odesa'],
    'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah'],
    'United Kingdom': ['London', 'Manchester', 'Edinburgh', 'Birmingham', 'Liverpool', 'Glasgow', 'Bath'],
    'United States': ['New York', 'Los Angeles', 'San Francisco', 'Chicago', 'Miami', 'Las Vegas', 'Washington DC', 'Boston', 'Seattle', 'Orlando'],
    Uruguay: ['Montevideo', 'Punta del Este'],
    Uzbekistan: ['Tashkent', 'Samarkand', 'Bukhara'],
    Venezuela: ['Caracas', 'Margarita Island'],
    Vietnam: ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Hoi An', 'Halong Bay', 'Nha Trang'],
    Zambia: ['Lusaka', 'Livingstone'],
    Zimbabwe: ['Harare', 'Victoria Falls'],
};

const normalizeKey = (value: string): string =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

/** Resolve catalog / alias labels to a canonical world country name when possible. */
export const resolveWorldCountryName = (country: string): string => {
    const raw = String(country || '').trim();
    if (!raw) return '';

    const alias = COUNTRY_ALIASES[normalizeKey(raw)];
    if (alias) return alias;

    const aviation = AVIATION_COUNTRY_MAP[raw];
    if (aviation) return aviation;

    const direct = WORLD_COUNTRIES.find((name) => normalizeKey(name) === normalizeKey(raw));
    return direct || raw;
};

/** Popular / trending destinations shown first in country pickers across the CRM. */
export const TRENDING_DESTINATION_COUNTRIES: string[] = [
    'India',
    'United Arab Emirates', // Dubai / UAE
    'Thailand',
    'United Kingdom',
    'United States',
    'Switzerland',
    'Indonesia',
];

/**
 * Split countries into trending (fixed order) and other (A–Z).
 * Dedupes by resolved world country name.
 */
export const groupCountriesWithTrending = (
    countries: string[]
): { trending: string[]; other: string[] } => {
    const byKey = new Map<string, string>();

    countries.forEach((label) => {
        const trimmed = String(label || '').trim();
        if (!trimmed) return;
        const resolved = resolveWorldCountryName(trimmed) || trimmed;
        const key = normalizeKey(resolved);
        if (!byKey.has(key)) byKey.set(key, resolved);
    });

    const remaining = new Map(byKey);
    const trending: string[] = [];

    TRENDING_DESTINATION_COUNTRIES.forEach((name) => {
        const key = normalizeKey(name);
        const match = remaining.get(key);
        if (match) {
            trending.push(match);
            remaining.delete(key);
        }
    });

    const other = Array.from(remaining.values()).sort((a, b) => a.localeCompare(b));
    return { trending, other };
};

/**
 * Sort country labels with trending destinations first (stable trending order),
 * then the remaining countries A–Z. Dedupes by resolved world country name.
 */
export const sortCountriesWithTrending = (countries: string[]): string[] => {
    const { trending, other } = groupCountriesWithTrending(countries);
    return [...trending, ...other];
};

/** Partition any item list by trending country label (preserves trending order). */
export const partitionByTrendingCountry = <T,>(
    items: T[],
    getCountry: (item: T) => string
): { trending: T[]; other: T[] } => {
    const labels = items.map((item) => getCountry(item));
    const { trending: trendingLabels } = groupCountriesWithTrending(labels);
    const trendingKeys = new Set(trendingLabels.map((name) => normalizeKey(name)));

    const trending: T[] = [];
    trendingLabels.forEach((label) => {
        const key = normalizeKey(label);
        const match = items.find((item) => {
            const resolved = resolveWorldCountryName(getCountry(item)) || getCountry(item);
            return normalizeKey(resolved) === key;
        });
        if (match) trending.push(match);
    });

    const other = items
        .filter((item) => {
            const resolved = resolveWorldCountryName(getCountry(item)) || getCountry(item);
            return !trendingKeys.has(normalizeKey(resolved));
        })
        .sort((a, b) => {
            const left = resolveWorldCountryName(getCountry(a)) || getCountry(a);
            const right = resolveWorldCountryName(getCountry(b)) || getCountry(b);
            return left.localeCompare(right);
        });

    return { trending, other };
};

/** Merge world countries with any catalog-only country labels still in use. */
export const buildCountryOptions = (catalogCountries: string[] = []): string[] => {
    const merged = new Set<string>(WORLD_COUNTRIES);
    catalogCountries.forEach((label) => {
        const resolved = resolveWorldCountryName(label);
        if (resolved) merged.add(resolved);
        else if (label.trim()) merged.add(label.trim());
    });
    return sortCountriesWithTrending(Array.from(merged));
};

const uniqueSorted = (values: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    values.forEach((value) => {
        const trimmed = String(value || '').trim();
        if (!trimmed) return;
        const key = normalizeKey(trimmed);
        if (seen.has(key)) return;
        seen.add(key);
        result.push(trimmed);
    });
    return result.sort((a, b) => a.localeCompare(b));
};

/** Resolve a world country label to the aviation catalog key used in internationalAirports. */
const resolveAviationCountryKey = (country: string): string | null => {
    const resolved = resolveWorldCountryName(country);
    if (!resolved) return null;

    if (internationalAirports[resolved as keyof typeof internationalAirports]) {
        return resolved;
    }

    for (const [aviationKey, mappedCountry] of Object.entries(AVIATION_COUNTRY_MAP)) {
        if (normalizeKey(mappedCountry) === normalizeKey(resolved)) {
            return aviationKey;
        }
    }

    for (const aviationKey of Object.keys(internationalAirports)) {
        if (normalizeKey(aviationKey) === normalizeKey(resolved)) {
            return aviationKey;
        }
    }

    return null;
};

/** Airports for departure country (maps world country names to aviation catalog). */
export const getAirportsForCountry = (country: string): Airport[] => {
    const key = resolveAviationCountryKey(country);
    if (!key) return [];
    return internationalAirports[key as keyof typeof internationalAirports] || [];
};

const airportCitiesForCountry = (country: string): string[] => {
    const resolved = resolveWorldCountryName(country);
    const cities: string[] = [];

    Object.entries(internationalAirports).forEach(([aviationCountry, airports]) => {
        const mapped = AVIATION_COUNTRY_MAP[aviationCountry] || aviationCountry;
        if (normalizeKey(mapped) !== normalizeKey(resolved)) return;
        airports.forEach((airport) => {
            if (airport.city?.trim()) cities.push(airport.city.trim());
        });
    });

    return cities;
};

/** Major cities for a country, merged with catalog extras (hotels, activities, presets). */
export const getCitiesForCountry = (country: string, extras: string[] = []): string[] => {
    const resolved = resolveWorldCountryName(country);
    if (!resolved) return uniqueSorted(extras);

    const staticCities = COUNTRY_MAJOR_CITIES[resolved] || [];
    const airportCities = airportCitiesForCountry(resolved);

    return uniqueSorted([...staticCities, ...airportCities, ...extras]);
};

export const formatDestinationLabel = (city: string, country: string): string => {
    const cityLabel = String(city || '').trim();
    const countryLabel = resolveWorldCountryName(country);
    if (cityLabel && countryLabel) return `${cityLabel}, ${countryLabel}`;
    return cityLabel || countryLabel || '';
};

export const parseDestinationParts = (
    destination?: string
): { city: string; country: string } => {
    const raw = String(destination || '').trim();
    if (!raw) return { city: '', country: '' };

    const paren = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (paren) {
        return {
            city: paren[1].trim(),
            country: resolveWorldCountryName(paren[2].trim()),
        };
    }

    if (raw.includes(',')) {
        const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
        if (parts.length >= 2) {
            const country = resolveWorldCountryName(parts[parts.length - 1]);
            const city = parts.slice(0, -1).join(', ');
            return { city, country };
        }
    }

    const resolvedCountry = resolveWorldCountryName(raw);
    if (WORLD_COUNTRIES.some((name) => normalizeKey(name) === normalizeKey(resolvedCountry))) {
        return { city: '', country: resolvedCountry };
    }

    return { city: raw, country: '' };
};

export const filterLocationOptions = (options: string[], query: string): string[] => {
    const q = normalizeKey(query);
    if (!q) return options;
    return options.filter((option) => normalizeKey(option).includes(q));
};
