export interface Airport {
  code: string;
  name: string;
  city: string;
}

export const internationalAirports: Record<string, Airport[]> = {
  'India': [
    { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International', city: 'Mumbai' },
    { code: 'DEL', name: 'Indira Gandhi International', city: 'Delhi' },
    { code: 'BLR', name: 'Kempegowda International', city: 'Bangalore' },
    { code: 'MAA', name: 'Chennai International', city: 'Chennai' },
    { code: 'CCU', name: 'Netaji Subhash Chandra Bose International', city: 'Kolkata' },
  ],
  'Dubai': [
    { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai' },
    { code: 'DWC', name: 'Al Maktoum International', city: 'Dubai' },
  ],
  'Bali': [
    { code: 'DPS', name: 'Ngurah Rai International Airport', city: 'Denpasar' },
  ],
  'Thailand': [
    { code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok' },
    { code: 'HKT', name: 'Phuket International Airport', city: 'Phuket' },
    { code: 'DMK', name: 'Don Mueang International', city: 'Bangkok' },
  ],
  'Singapore': [
    { code: 'SIN', name: 'Changi Airport', city: 'Singapore' },
  ],
  'Vietnam': [
    { code: 'HAN', name: 'Noi Bai International', city: 'Hanoi' },
    { code: 'SGN', name: 'Tan Son Nhat International', city: 'Ho Chi Minh City' },
  ],
  'Maldives': [
    { code: 'MLE', name: 'Velana International Airport', city: 'Male' },
  ],
  'Mauritius': [
    { code: 'MRU', name: 'Sir Seewoosagur Ramgoolam International', city: 'Port Louis' },
  ],
  'Switzerland': [
    { code: 'ZRH', name: 'Zurich International', city: 'Zurich' },
    { code: 'GVA', name: 'Geneva Airport', city: 'Geneva' },
  ],
  'France': [
    { code: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris' },
    { code: 'ORY', name: 'Paris Orly', city: 'Paris' },
  ],
  'Japan': [
    { code: 'NRT', name: 'Narita International', city: 'Tokyo' },
    { code: 'HND', name: 'Haneda Airport', city: 'Tokyo' },
    { code: 'KIX', name: 'Kansai International', city: 'Osaka' },
  ],
  'Australia': [
    { code: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney' },
    { code: 'MEL', name: 'Melbourne Airport', city: 'Melbourne' },
    { code: 'BNE', name: 'Brisbane Airport', city: 'Brisbane' },
  ],
  'USA': [
    { code: 'JFK', name: 'John F. Kennedy International', city: 'New York' },
    { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles' },
    { code: 'SFO', name: 'San Francisco International', city: 'San Francisco' },
    { code: 'ORD', name: 'OHare International', city: 'Chicago' },
  ],
  'United Kingdom': [
    { code: 'LHR', name: 'London Heathrow', city: 'London' },
    { code: 'LGW', name: 'London Gatwick', city: 'London' },
    { code: 'MAN', name: 'Manchester Airport', city: 'Manchester' },
  ],
};

export const sourceCountries = Object.keys(internationalAirports).map(country => {
  let flag = '🌍';
  if (country === 'India') flag = '🇮🇳';
  if (country === 'Dubai' || country === 'UAE') flag = '🇦🇪';
  if (country === 'Bali' || country === 'Indonesia') flag = '🇮🇩';
  if (country === 'Thailand') flag = '🇹🇭';
  if (country === 'Singapore') flag = '🇸🇬';
  if (country === 'Vietnam') flag = '🇻🇳';
  if (country === 'Maldives') flag = '🇲🇻'; 
  if (country === 'Mauritius') flag = '🇲🇺';
  if (country === 'Switzerland') flag = '🇨🇭';
  if (country === 'France') flag = '🇫🇷';
  if (country === 'Japan') flag = '🇯🇵';
  if (country === 'Australia') flag = '🇦🇺';
  if (country === 'USA') flag = '🇺🇸';
  if (country === 'UK' || country === 'United Kingdom' || country === 'London') flag = '🇬🇧';
  if (country === 'Germany') flag = '🇩🇪';
  if (country === 'Italy') flag = '🇮🇹';
  if (country === 'Greece') flag = '🇬🇷';
  if (country === 'Turkey') flag = '🇹🇷';
  if (country === 'Spain') flag = '🇪🇸';
  if (country === 'Portugal') flag = '🇵🇹';
  if (country === 'Netherlands') flag = '🇳🇱';
  if (country === 'Iceland') flag = '🇮🇸';
  if (country === 'Norway') flag = '🇳🇴';
  if (country === 'Finland') flag = '🇫🇮';
  if (country === 'Sweden') flag = '🇸🇪';
  if (country === 'Denmark') flag = '🇩🇰';
  if (country === 'South Africa') flag = '🇿🇦';
  if (country === 'Kenya') flag = '🇰🇪';
  if (country === 'Egypt') flag = '🇪🇬';
  
  return { name: country, flag };
});
