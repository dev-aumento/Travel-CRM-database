export interface Hotel {
    id: string;
    name: string;
    destination: string;
    standardRate: number; // Price per night (2 adults base)
    deluxeRate: number;
    luxuryRate: number;
    description: string;
    rating: number;
    imageUrl?: string;
}

export const hotelLibrary: Hotel[] = [
    {
        id: 'h-bali-1',
        name: 'The Kayon Resort',
        destination: 'Bali, Indonesia',
        standardRate: 12000,
        deluxeRate: 18000,
        luxuryRate: 28000,
        description: 'Luxury jungle resort in Ubud with infinity pools.',
        rating: 5,
        imageUrl: 'file:///Users/jenishradadiya/.gemini/antigravity/brain/ecf869a1-4af7-4dbb-9517-47bb48db92ce/luxury_bali_resort_1776081305871.png'
    },
    {
        id: 'h-bali-2',
        name: 'W Bali - Seminyak',
        destination: 'Bali, Indonesia',
        standardRate: 25000,
        deluxeRate: 35000,
        luxuryRate: 55000,
        description: 'Vibrant luxury resort on Seminyak beach.',
        rating: 5
    },
    {
        id: 'h-bali-3',
        name: 'Ayana Resort & Spa',
        destination: 'Bali, Indonesia',
        standardRate: 22000,
        deluxeRate: 32000,
        luxuryRate: 52000,
        description: 'World-class Jimbaran clifftop resort with 19 pools.',
        rating: 5
    },
    {
        id: 'h-dubai-1',
        name: 'Atlantis The Palm',
        destination: 'Dubai, UAE',
        standardRate: 35000,
        deluxeRate: 55000,
        luxuryRate: 95000,
        description: 'Iconic resort with underwater world and waterpark.',
        rating: 5
    },
    {
        id: 'h-dubai-2',
        name: 'Address Downtown',
        destination: 'Dubai, UAE',
        standardRate: 28000,
        deluxeRate: 42000,
        luxuryRate: 68000,
        description: 'Stunning views of Burj Khalifa and Dubai Fountain.',
        rating: 5
    },
    {
        id: 'h-dubai-3',
        name: 'Burj Al Arab Jumeirah',
        destination: 'Dubai, UAE',
        standardRate: 85000,
        deluxeRate: 125000,
        luxuryRate: 225000,
        description: 'The world most luxurious 7-star hotel structure.',
        rating: 5
    },
    {
        id: 'h-thai-1',
        name: 'Banyan Tree Bangkok',
        destination: 'Bangkok, Thailand',
        standardRate: 11000,
        deluxeRate: 16000,
        luxuryRate: 24000,
        description: 'Luxury skyscraper hotel with iconic Vertigo rooftop.',
        rating: 5
    },
    {
        id: 'h-thai-2',
        name: 'Keemala Phuket',
        destination: 'Phuket, Thailand',
        standardRate: 32000,
        deluxeRate: 45000,
        luxuryRate: 75000,
        description: 'Dreamy treehouses and bird nest villas in the canopy.',
        rating: 5
    },
    {
        id: 'h-thai-3',
        name: 'Four Seasons Koh Samui',
        destination: 'Koh Samui, Thailand',
        standardRate: 48000,
        deluxeRate: 72000,
        luxuryRate: 110000,
        description: 'The ultimate island retreat on a private beach.',
        rating: 5
    },
    {
        id: 'h-sin-1',
        name: 'Marina Bay Sands',
        destination: 'Singapore',
        standardRate: 45000,
        deluxeRate: 65000,
        luxuryRate: 95000,
        description: 'World-famous infinity pool and integrated resort.',
        rating: 5
    },
    {
        id: 'h-sin-2',
        name: 'Raffles Hotel Singapore',
        destination: 'Singapore',
        standardRate: 52000,
        deluxeRate: 78000,
        luxuryRate: 120000,
        description: 'Historic colonial elegance in the heart of the city.',
        rating: 5
    },
    {
        id: 'h-mal-1',
        name: 'Soneva Jani',
        destination: 'Malé, Maldives',
        standardRate: 120000,
        deluxeRate: 180000,
        luxuryRate: 350000,
        description: 'Ultra-luxury overwater villas with private slides.',
        rating: 5
    },
    {
        id: 'h-mal-2',
        name: 'Anantara Kihavah',
        destination: 'Malé, Maldives',
        standardRate: 85000,
        deluxeRate: 125000,
        luxuryRate: 195000,
        description: 'Underwater dining and incredible marine life.',
        rating: 5
    },
    {
        id: 'h-paris-1',
        name: 'Hotel Pullman Paris Eiffel Tower',
        destination: 'Paris, France',
        standardRate: 22000,
        deluxeRate: 32000,
        luxuryRate: 52000,
        description: 'Closest hotel to the Eiffel Tower with modern rooms.',
        rating: 4
    },
    {
        id: 'h-paris-2',
        name: 'The Ritz Paris',
        destination: 'Paris, France',
        standardRate: 95000,
        deluxeRate: 145000,
        luxuryRate: 285000,
        description: 'The epitome of French elegance and history.',
        rating: 5
    },
    {
        id: 'h-sw-1',
        name: 'The Omnia',
        destination: 'Zurich & Zermatt, Switzerland',
        standardRate: 38000,
        deluxeRate: 58000,
        luxuryRate: 88000,
        description: 'Mountain lodge with breathtaking views of the Matterhorn.',
        rating: 5
    },
    {
        id: 'h-sw-2',
        name: 'Badrutts Palace St. Moritz',
        destination: 'St. Moritz, Switzerland',
        standardRate: 75000,
        deluxeRate: 115000,
        luxuryRate: 195000,
        description: 'Legendary palace hotel in the Swiss Alps.',
        rating: 5
    },
    {
        id: 'h-usa-1',
        name: 'The Plaza New York',
        destination: 'New York, USA',
        standardRate: 65000,
        deluxeRate: 95000,
        luxuryRate: 165000,
        description: 'Timeless Fifth Avenue landmark overlooking Central Park.',
        rating: 5
    },
    {
        id: 'h-uk-1',
        name: 'The Savoy London',
        destination: 'London, UK',
        standardRate: 58000,
        deluxeRate: 88000,
        luxuryRate: 148000,
        description: 'Iconic luxury on the banks of the Thames.',
        rating: 5
    },
    {
        id: 'h-ita-1',
        name: 'Hotel Artemide Rome',
        destination: 'Rome, Italy',
        standardRate: 28000,
        deluxeRate: 42000,
        luxuryRate: 68000,
        description: 'Boutique luxury on the Via Nazionale.',
        rating: 4
    },
    {
        id: 'h-grc-1',
        name: 'Canaves Oia Luxury',
        destination: 'Santorini, Greece',
        standardRate: 75000,
        deluxeRate: 115000,
        luxuryRate: 195000,
        description: 'Elegant suites and villas overlooking the caldera.',
        rating: 5
    },
    {
        id: 'h-jpn-1',
        name: 'Park Hyatt Tokyo',
        destination: 'Tokyo, Japan',
        standardRate: 65000,
        deluxeRate: 85000,
        luxuryRate: 135000,
        description: 'Sleek luxury with city-wide views of Shinjuku.',
        rating: 5
    },
    {
        id: 'h-aus-1',
        name: 'Park Hyatt Sydney',
        destination: 'Sydney, Australia',
        standardRate: 55000,
        deluxeRate: 75000,
        luxuryRate: 125000,
        description: 'Superbly located between the Opera House and Harbour Bridge.',
        rating: 5
    },
    {
        id: 'h-vnm-1',
        name: 'InterContinental Danang',
        destination: 'Da Nang, Vietnam',
        standardRate: 35000,
        deluxeRate: 55000,
        luxuryRate: 95000,
        description: 'Sun Peninsula Resort nestled in a private bay.',
        rating: 5
    },
    {
        id: 'h-tur-1',
        name: 'Argos in Cappadocia',
        destination: 'Cappadocia, Turkey',
        standardRate: 25000,
        deluxeRate: 38000,
        luxuryRate: 62000,
        description: 'The ancient monastery village cave hotel.',
        rating: 5
    }
];
