export interface Activity {
    id: string;
    title: string;
    description: string;
    price: number;
    country: string;
    city?: string;
    category: 'Adventure' | 'Culture' | 'Leisure' | 'Dining' | 'Modern' | 'Nature';
}

export const activityLibrary: Activity[] = [
    // --- GLOBAL / SYSTEM ACTIVITIES ---
    { id: 'global-1', title: 'Free Day / Exploring on your own', description: 'Leisure time for travelers to explore the city at their own pace. No pre-planned activities.', price: 0, country: 'Global', category: 'Leisure' },
    { id: 'global-2', title: 'Airport Arrival Transfer', description: 'Private vehicle transfer from airport to hotel.', price: 2500, country: 'Global', category: 'Leisure' },
    { id: 'global-3', title: 'Airport Departure Transfer', description: 'Private vehicle transfer from hotel to airport.', price: 2500, country: 'Global', category: 'Leisure' },

    // --- DUBAI, UAE ---
    { id: 'dxb-1', title: 'Burj Khalifa VIP Observation', description: 'Access to levels 124, 125 and 148 with luxury lounge access.', price: 12500, country: 'Dubai, UAE', category: 'Modern' },
    { id: 'dxb-2', title: 'Desert Safari with BBQ Dinner', description: 'Dune bashing, camel riding, and traditional Tanura show.', price: 4500, country: 'Dubai, UAE', category: 'Adventure' },
    { id: 'dxb-3', title: 'Museum of the Future Entry', description: 'Journey through possible futures in a stunning architectural marvel.', price: 3500, country: 'Dubai, UAE', category: 'Modern' },
    { id: 'dxb-4', title: 'Dubai Frame Visit', description: 'Panoramic views of old and new Dubai from the worlds largest frame.', price: 1500, country: 'Dubai, UAE', category: 'Modern' },
    { id: 'dxb-5', title: 'Luxury Yacht Cruise', description: 'Private or shared cruise around Dubai Marina and Palm Jumeirah.', price: 8500, country: 'Dubai, UAE', category: 'Leisure' },
    { id: 'dxb-6', title: 'The View at The Palm', description: '360-degree views of Palm Jumeirah from 240 meters high.', price: 2500, country: 'Dubai, UAE', category: 'Modern' },
    { id: 'dxb-7', title: 'Dubai Miracle Garden', description: 'World largest natural flower garden with 150 million flowers.', price: 1800, country: 'Dubai, UAE', category: 'Nature' },
    { id: 'dxb-8', title: 'Old Dubai Heritage Tour', description: 'Guided walk through Al Fahidi, Gold Souk, and Abra ride.', price: 3000, country: 'Dubai, UAE', category: 'Culture' },
    { id: 'dxb-9', title: 'Ain Dubai Observation Wheel', description: 'The worlds tallest and largest observation wheel (VIP Cabin).', price: 6500, country: 'Dubai, UAE', category: 'Modern' },
    { id: 'dxb-10', title: 'Ski Dubai Snow Park', description: 'Unlimited access to Snow Park rides and penguin encounter.', price: 5500, country: 'Dubai, UAE', category: 'Adventure' },
    { id: 'dxb-11', title: 'Aquaventure Waterpark', description: 'World largest waterpark with 105 record-breaking slides.', price: 7500, country: 'Dubai, UAE', category: 'Adventure' },
    { id: 'dxb-12', title: 'Dhow Cruise Creek Dinner', description: 'Evening dinner cruise on a traditional wooden boat.', price: 2800, country: 'Dubai, UAE', category: 'Dining' },
    { id: 'dxb-13', title: 'La Perle by Dragone Show', description: 'Vivid acrobatics and aquatic stunts in a custom-built theater.', price: 9500, country: 'Dubai, UAE', category: 'Culture' },
    { id: 'dxb-14', title: 'Hot Air Balloon Sunrise', description: 'Floating over the Arabian Desert with falconry display.', price: 18500, country: 'Dubai, UAE', category: 'Adventure' },
    { id: 'dxb-15', title: 'Dubai Opera Guided Tour', description: 'Behind the scenes of the iconic dhow-shaped performing arts center.', price: 2200, country: 'Dubai, UAE', category: 'Culture' },

    // --- BALI, INDONESIA ---
    { id: 'bali-1', title: 'Ubud Jungle Swing & Rice Terrace', description: 'Iconic swings over Tegalalang rice terraces and coffee tasting.', price: 2500, country: 'Bali, Indonesia', category: 'Nature' },
    { id: 'bali-2', title: 'Uluwatu Sunset Kecak Fire Dance', description: 'Traditional dance at the cliff-top Uluwatu Temple.', price: 1800, country: 'Bali, Indonesia', category: 'Culture' },
    { id: 'bali-3', title: 'Mount Batur Sunrise Trekking', description: 'Early morning hike to the summit for breathtaking sunrise views.', price: 4500, country: 'Bali, Indonesia', category: 'Adventure' },
    { id: 'bali-4', title: 'Nusa Penida Island Tour', description: 'Visit Kelingking Beach, Broken Beach, and Angel Billabong.', price: 6500, country: 'Bali, Indonesia', category: 'Nature' },
    { id: 'bali-5', title: 'Lempuyang Temple (Gates of Heaven)', description: 'Iconic photo spot with Mount Agung in the background.', price: 3000, country: 'Bali, Indonesia', category: 'Culture' },
    { id: 'bali-6', title: 'White Water Rafting (Ayung River)', description: 'Thrilling adventure through rainforest scenery and waterfalls.', price: 3500, country: 'Bali, Indonesia', category: 'Adventure' },
    { id: 'bali-7', title: 'Balinese Cooking Class', description: 'Learn to cook authentic Balinese dishes with a local chef.', price: 2800, country: 'Bali, Indonesia', category: 'Culture' },
    { id: 'bali-8', title: 'Tanah Lot Temple Sunset', description: 'Iconic offshore temple with stunning sunset background.', price: 1500, country: 'Bali, Indonesia', category: 'Culture' },
    { id: 'bali-9', title: 'Sacred Monkey Forest Sanctuary', description: 'Walk through the forest home to hundreds of macaques.', price: 1200, country: 'Bali, Indonesia', category: 'Nature' },
    { id: 'bali-10', title: 'Tegenungan Waterfall Visit', description: 'Stunning waterfall surrounded by lush greenery.', price: 1000, country: 'Bali, Indonesia', category: 'Nature' },
    { id: 'bali-11', title: 'Besakih Mother Temple Tour', description: 'The largest and holiest temple complex in Bali.', price: 3500, country: 'Bali, Indonesia', category: 'Culture' },
    { id: 'bali-12', title: 'Garuda Wisnu Kencana (GWK)', description: 'Cultural park dedicated to the Hindu god Vishnu.', price: 2200, country: 'Bali, Indonesia', category: 'Culture' },
    { id: 'bali-13', title: 'Lovina Dolphin Watching', description: 'Sunrise boat trip to see wild dolphins in North Bali.', price: 4800, country: 'Bali, Indonesia', category: 'Nature' },
    { id: 'bali-14', title: 'Finn\'s VIP Beach Club Day', description: 'Luxury day pass at Bali\'s most iconic beach club.', price: 7500, country: 'Bali, Indonesia', category: 'Leisure' },
    { id: 'bali-15', title: 'Tirta Gangga Water Palace', description: 'Breathtaking former royal palace with stepping stones.', price: 1200, country: 'Bali, Indonesia', category: 'Nature' },

    // --- THAILAND ---
    { id: 'thai-1', title: 'Phi Phi Islands Speedboat Tour', description: 'Visit Maya Bay, Pileh Lagoon, and Monkey Beach.', price: 5500, country: 'Thailand', category: 'Nature' },
    { id: 'thai-2', title: 'Grand Palace & Emerald Buddha', description: 'The most sacred site in Thailand with intricate architecture.', price: 2500, country: 'Thailand', category: 'Culture' },
    { id: 'thai-3', title: 'Floating Market & Railway Market', description: 'Unique shopping experience on boats and train tracks.', price: 3200, country: 'Thailand', category: 'Culture' },
    { id: 'thai-4', title: 'Elephant Sanctuary Experience', description: 'Ethical interaction, feeding, and washing elephants.', price: 6800, country: 'Thailand', category: 'Nature' },
    { id: 'thai-5', title: 'Chao Phraya Dinner Cruise', description: 'Elegant buffet dinner with views of Wat Arun at night.', price: 3500, country: 'Thailand', category: 'Dining' },
    { id: 'thai-6', title: 'Wat Arun (Temple of Dawn)', description: 'Iconic riverside temple with porcelain-encrusted spires.', price: 800, country: 'Thailand', category: 'Culture' },
    { id: 'thai-7', title: 'Phuket FantaSea Show', description: 'Cultural theme park with a grand theatrical performance.', price: 4200, country: 'Thailand', category: 'Culture' },
    { id: 'thai-8', title: 'James Bond Island Discovery', description: 'Khao Phing Kan in Phang Nga Bay via longtail boat.', price: 4800, country: 'Thailand', category: 'Nature' },
    { id: 'thai-9', title: 'Ayutthaya Day Trip', description: 'Explore the ancient capital of Siam and its temple ruins.', price: 3800, country: 'Thailand', category: 'Culture' },
    { id: 'thai-10', title: 'Skywalk Mahanakhon Observation', description: 'Thailands highest observation deck with glass tray floor.', price: 2800, country: 'Thailand', category: 'Modern' },
    { id: 'thai-11', title: 'Similan Islands Snorkeling', description: 'Crystal-clear waters and vibrant coral reefs in the Andaman Sea.', price: 7200, country: 'Thailand', category: 'Nature' },
    { id: 'thai-12', title: 'Muay Thai Live Show', description: 'Spectacular combination of traditional Thai boxing and drama.', price: 3500, country: 'Thailand', category: 'Culture' },
    { id: 'thai-13', title: 'Safari World Bangkok', description: 'Open-air zoo and marine park with live animal shows.', price: 4500, country: 'Thailand', category: 'Leisure' },
    { id: 'thai-14', title: 'Koh Samui 4x4 Jungle Safari', description: 'Off-road exploration of Samui\'s hidden waterfalls and peaks.', price: 5800, country: 'Thailand', category: 'Adventure' },
    { id: 'thai-15', title: 'Siam Niramit Phuket Show', description: 'World-class performance of Thai history and mythology.', price: 5200, country: 'Thailand', category: 'Culture' },

    // --- SINGAPORE ---
    { id: 'sin-1', title: 'Gardens by the Bay (Full Access)', description: 'Cloud Forest, Flower Dome, and Supertree Observatory.', price: 4500, country: 'Singapore', category: 'Nature' },
    { id: 'sin-2', title: 'Universal Studios Singapore', description: 'Thrilling rides and themed zones on Sentosa Island.', price: 6200, country: 'Singapore', category: 'Leisure' },
    { id: 'sin-3', title: 'Marina Bay Sands SkyPark', description: 'Iconic observation deck with city-wide panoramic views.', price: 2200, country: 'Singapore', category: 'Modern' },
    { id: 'sin-4', title: 'Singapore Night Safari', description: 'The worlds first nocturnal wildlife park with tram ride.', price: 3800, country: 'Singapore', category: 'Nature' },
    { id: 'sin-5', title: 'Sentosa Cable Car Sky Pass', description: 'Scenic views of the harbor and Sentosa Island.', price: 2500, country: 'Singapore', category: 'Leisure' },
    { id: 'sin-6', title: 'S.E.A. Aquarium Visit', description: 'One of the worlds largest aquariums with 100,000+ animals.', price: 3500, country: 'Singapore', category: 'Nature' },
    { id: 'sin-7', title: 'River Wonder & Amazon Quest', description: 'Asias first and only river-themed wildlife park.', price: 3200, country: 'Singapore', category: 'Nature' },
    { id: 'sin-8', title: 'Jewel Changi & Canopy Park', description: 'Visit the HSBC Rain Vortex and surrounding attractions.', price: 1500, country: 'Singapore', category: 'Modern' },
    { id: 'sin-9', title: 'Singapore Flyer Flight', description: 'Asias largest giant observation wheel.', price: 2800, country: 'Singapore', category: 'Modern' },
    { id: 'sin-10', title: 'Little India & Chinatown Tour', description: 'Guided cultural heritage walk and food tasting.', price: 3000, country: 'Singapore', category: 'Culture' },
    { id: 'sin-11', title: 'Adventure Cove Waterpark', description: 'High-speed slides and snorkeling with 20,000 reef fish.', price: 3800, country: 'Singapore', category: 'Leisure' },
    { id: 'sin-12', title: 'Madame Tussauds + 4D Marvel', description: 'Celebrity wax figures and interactive cinema experience.', price: 3200, country: 'Singapore', category: 'Leisure' },
    { id: 'sin-13', title: 'Skyline Luge Sentosa (4 Rides)', description: 'Gravity-fueled thrill ride with scenic forest tracks.', price: 2800, country: 'Singapore', category: 'Adventure' },
    { id: 'sin-14', title: 'River Cruise (Electric Boat)', description: 'Scenic boat tour along the Singapore River landmarks.', price: 1800, country: 'Singapore', category: 'Leisure' },
    { id: 'sin-15', title: 'Duck Tour (Amphibious)', description: 'Land and sea exploration of the iconic Marina Bay.', price: 3500, country: 'Singapore', category: 'Leisure' },

    // --- MALDIVES ---
    { id: 'mld-1', title: 'Sunset Dolphin Cruise', description: 'Shared or private boat trip to watch dolphins at sunset.', price: 8500, country: 'Malé, Maldives', category: 'Nature' },
    { id: 'mld-2', title: 'Sandbank Picnic & Snorkeling', description: 'Private picnic on an isolated sandbank with guided reef tour.', price: 15500, country: 'Malé, Maldives', category: 'Leisure' },
    { id: 'mld-3', title: 'Submarine Tour from Malé', description: 'Underwater exploration without getting wet.', price: 12000, country: 'Malé, Maldives', category: 'Adventure' },
    { id: 'mld-4', title: 'Romantic Beach Dinner', description: 'Private candlelit dinner on the beach under the stars.', price: 25000, country: 'Malé, Maldives', category: 'Dining' },
    { id: 'mld-5', title: 'Local Island Hopping Tour', description: 'Experience Maldivian culture on inhabited islands.', price: 6500, country: 'Malé, Maldives', category: 'Culture' },
    { id: 'mld-6', title: 'Whale Shark Snorkeling', description: 'Swim with the gentle giants of the ocean (seasonal).', price: 18500, country: 'Malé, Maldives', category: 'Nature' },
    { id: 'mld-7', title: 'Night Fishing Adventure', description: 'Traditional Maldivian hand-line fishing at night.', price: 7500, country: 'Malé, Maldives', category: 'Adventure' },
    { id: 'mld-8', title: 'Malé Walking Discovery', description: 'Guided tour of the capital city and fish market.', price: 3500, country: 'Malé, Maldives', category: 'Culture' },
    { id: 'mld-9', title: 'Manta Ray Interaction', description: 'Guided snorkeling with majestic manta rays at Hanifaru Bay.', price: 14500, country: 'Malé, Maldives', category: 'Nature' },
    { id: 'mld-10', title: 'Sea-Plane Scenic Photo Flight', description: 'Breathtaking aerial views of the Maldivian atolls.', price: 22500, country: 'Malé, Maldives', category: 'Nature' },
    { id: 'mld-11', title: 'Jet Safari', description: 'High-speed exploration of the surrounding lagoons.', price: 12500, country: 'Malé, Maldives', category: 'Adventure' },
    { id: 'mld-12', title: 'Glass Bottom Boat Tour', description: 'View the coral reefs comfortably from above.', price: 4500, country: 'Malé, Maldives', category: 'Leisure' },
    { id: 'mld-13', title: 'Parasailing over Atolls', description: 'Soar above the turquoise waters for a bird\'s eye view.', price: 9500, country: 'Malé, Maldives', category: 'Adventure' },
    { id: 'mld-14', title: 'Traditional Dhoni Sunset Sail', description: 'Peaceful journey on a classic Maldivian wooden boat.', price: 5500, country: 'Malé, Maldives', category: 'Leisure' },
    { id: 'mld-15', title: 'Spa Ritual (Overwater)', description: 'Ultimate relaxation in a world-class overwater spa.', price: 18000, country: 'Malé, Maldives', category: 'Leisure' },

    // --- FRANCE ---
    { id: 'fra-1', title: 'Eiffel Tower Summit Access', description: 'Priority access to the highest level of the Eiffel Tower.', price: 9500, country: 'Paris, France', category: 'Modern' },
    { id: 'fra-2', title: 'Louvre Museum Guided Tour', description: 'Expert tour of the worlds largest art museum.', price: 7500, country: 'Paris, France', category: 'Culture' },
    { id: 'fra-3', title: 'Seine River Dinner Cruise', description: 'Gourmet 3-course meal with live music on the river.', price: 12500, country: 'Paris, France', category: 'Dining' },
    { id: 'fra-4', title: 'Palace of Versailles Tour', description: 'Full access to the Hall of Mirrors and Grand Apartments.', price: 8500, country: 'Paris, France', category: 'Culture' },
    { id: 'fra-5', title: 'Moulin Rouge Show (Dinner)', description: 'The legendary cabaret performance with fine dining.', price: 18500, country: 'Paris, France', category: 'Culture' },
    { id: 'fra-6', title: 'Arc de Triomphe Rooftop', description: 'Panoramic views of the Champs-Elysées from the top.', price: 2200, country: 'Paris, France', category: 'Modern' },
    { id: 'fra-7', title: 'Montmartre Artists Walk', description: 'Guided walking tour of the bohemian district.', price: 3500, country: 'Paris, France', category: 'Culture' },
    { id: 'fra-8', title: 'Disneyland Paris Multi-Pass', description: 'Full day access to both Parks (Disney & Studios).', price: 11500, country: 'Paris, France', category: 'Leisure' },
    { id: 'fra-9', title: 'Bateaux-Mouches Boat Trip', description: 'Classic sightseeing cruise on the Seine River.', price: 1800, country: 'Paris, France', category: 'Leisure' },
    { id: 'fra-10', title: 'Catacombs of Paris Access', description: 'Guided tour of the historic underground ossuary.', price: 4200, country: 'Paris, France', category: 'Culture' },
    { id: 'fra-11', title: 'Wine Tasting in a Royal Cellar', description: 'Premium French wine flight with expert sommelier.', price: 6500, country: 'Paris, France', category: 'Dining' },
    { id: 'fra-12', title: 'Sainte-Chapelle Concert', description: 'Classical music in a stunning 13th-century chapel.', price: 5800, country: 'Paris, France', category: 'Culture' },
    { id: 'fra-13', title: 'Paris Gourmet Food Tour', description: 'Tasting tour through the famous Le Marais district.', price: 8800, country: 'Paris, France', category: 'Dining' },
    { id: 'fra-14', title: 'Centre Pompidou Entry', description: 'Access to Europe\'s largest modern art collection.', price: 2500, country: 'Paris, France', category: 'Modern' },
    { id: 'fra-15', title: 'Macaron Making Class', description: 'Hands-on pastry lesson with a French chef.', price: 7200, country: 'Paris, France', category: 'Culture' },

    // --- UK ---
    { id: 'uk-1', title: 'London Eye Fast Track', description: 'Skip the line for the best panoramic views of London.', price: 6500, country: 'London, UK', category: 'Modern' },
    { id: 'uk-2', title: 'Tower of London & Crown Jewels', description: 'Explore the historic fortress and royal treasury.', price: 4800, country: 'London, UK', category: 'Culture' },
    { id: 'uk-3', title: 'Warner Bros. Harry Potter Tour', description: 'Behind the scenes of the Harry Potter film series.', price: 11500, country: 'London, UK', category: 'Leisure' },
    { id: 'uk-4', title: 'Buckingham Palace State Rooms', description: 'Exclusive visit to the Queen\'s official residence.', price: 7200, country: 'London, UK', category: 'Culture' },
    { id: 'uk-5', title: 'Windsor Castle & Stonehenge', description: 'Day trip to the world\'s oldest occupied castle.', price: 14500, country: 'London, UK', category: 'Culture' },
    { id: 'uk-6', title: 'The View from The Shard', description: 'Western Europe\'s highest observation platform.', price: 3800, country: 'London, UK', category: 'Modern' },
    { id: 'uk-7', title: 'British Museum Highlight Tour', description: 'Guided walk through 2 million years of human history.', price: 2500, country: 'London, UK', category: 'Culture' },
    { id: 'uk-8', title: 'St. Paul\'s Cathedral Access', description: 'Climb the Dome for stunning London skyline views.', price: 3200, country: 'London, UK', category: 'Culture' },
    { id: 'uk-9', title: 'West End Show (Premium)', description: 'VIP tickets to a world-class musical or play.', price: 15500, country: 'London, UK', category: 'Culture' },
    { id: 'uk-10', title: 'Madame Tussauds London', description: 'The original celebrity wax attraction.', price: 4500, country: 'London, UK', category: 'Leisure' },
    { id: 'uk-11', title: 'James Bond Walking Tour', description: 'Explore filming locations of the 007 franchise.', price: 3000, country: 'London, UK', category: 'Culture' },
    { id: 'uk-12', title: 'Abbey Road Studio Cross', description: 'Visit the world\'s most famous crosswalk.', price: 0, country: 'London, UK', category: 'Leisure' },
    { id: 'uk-13', title: 'London Zoo Skip-the-Line', description: 'World\'s oldest scientific zoo in Regent\'s Park.', price: 3500, country: 'London, UK', category: 'Nature' },
    { id: 'uk-14', title: 'Thames Rocket Speedboat', description: 'High-speed blast through London\'s river landmarks.', price: 5500, country: 'London, UK', category: 'Adventure' },
    { id: 'uk-15', title: 'Full Afternoon Tea (The Ritz)', description: 'World-famous luxury tea service in a grand setting.', price: 9800, country: 'London, UK', category: 'Dining' },

    // --- SWITZERLAND ---
    { id: 'sw-1', title: 'Jungfraujoch - Top of Europe', description: 'Scenic train journey to the highest railway station.', price: 24500, country: 'Zurich & Zermatt, Switzerland', category: 'Adventure' },
    { id: 'sw-2', title: 'Glacier Express Scenic Train', description: 'Luxury panoramic journey through the Swiss Alps.', price: 18500, country: 'Zurich & Zermatt, Switzerland', category: 'Leisure' },
    { id: 'sw-3', title: 'Mount Titlis Rotary Cable Car', description: 'Journey to the summit with 360-degree views.', price: 12500, country: 'Zurich & Zermatt, Switzerland', category: 'Adventure' },
    { id: 'sw-4', title: 'Lake Lucerne Dinner Cruise', description: 'Fine dining on a classic paddle steamer at sunset.', price: 14500, country: 'Zurich & Zermatt, Switzerland', category: 'Dining' },
    { id: 'sw-5', title: 'Zermatt Matterhorn Glacier Paradise', description: 'Europe\'s highest mountain station at 3,883m.', price: 16500, country: 'Zurich & Zermatt, Switzerland', category: 'Nature' },
    { id: 'sw-6', title: 'Lindt Home of Chocolate Tour', description: 'Interactive journey through the world of chocolate.', price: 2800, country: 'Zurich & Zermatt, Switzerland', category: 'Leisure' },
    { id: 'sw-7', title: 'Interlaken Tandem Paragliding', description: 'Fly over the Eiger, Mönch and Jungfrau peaks.', price: 22000, country: 'Zurich & Zermatt, Switzerland', category: 'Adventure' },
    { id: 'sw-8', title: 'Bernina Express (St. Moritz)', description: 'UNESCO World Heritage train through the Alps.', price: 15500, country: 'Zurich & Zermatt, Switzerland', category: 'Leisure' },
    { id: 'sw-9', title: 'Rhine Falls Boat & Rock Tour', description: 'Feel the power of Europe\'s largest waterfall.', price: 3500, country: 'Zurich & Zermatt, Switzerland', category: 'Nature' },
    { id: 'sw-10', title: 'St. Beatus Caves Exploration', description: 'Mythical underground stalactite caves and falls.', price: 4200, country: 'Zurich & Zermatt, Switzerland', category: 'Nature' },
    { id: 'sw-11', title: 'First Cliff Walk (Grindelwald)', description: 'Terrifying 360m long steel walkway over the abyss.', price: 0, country: 'Zurich & Zermatt, Switzerland', category: 'Adventure' },
    { id: 'sw-12', title: 'Swiss Museum of Transport', description: 'Europe\'s most comprehensive transport museum.', price: 3800, country: 'Zurich & Zermatt, Switzerland', category: 'Modern' },
    { id: 'sw-13', title: 'Mt. Pilatus Golden Round Trip', description: 'Boat, cogwheel railway, and cable car journey.', price: 13500, country: 'Zurich & Zermatt, Switzerland', category: 'Adventure' },
    { id: 'sw-14', title: 'Harder Kulm Top View', description: 'Funicular ride to Interlaken\'s "local mountain".', price: 4500, country: 'Zurich & Zermatt, Switzerland', category: 'Leisure' },
    { id: 'sw-15', title: 'Swiss Cheese Workshop', description: 'Learn the secrets of Appenzeller cheese making.', price: 6500, country: 'Zurich & Zermatt, Switzerland', category: 'Culture' },

    // --- ITALY ---
    { id: 'ita-1', title: 'Colosseum & Roman Forum VIP', description: 'Priority access to the Arena floor and underground.', price: 8500, country: 'Italy', category: 'Culture' },
    { id: 'ita-2', title: 'Vatican Museums & Sistine Chapel', description: 'Early access to see Michelangelo\'s masterpiece.', price: 9500, country: 'Italy', category: 'Culture' },
    { id: 'ita-3', title: 'Private Gondola Ride (Venice)', description: 'Traditional romantic cruise through hidden canals.', price: 12500, country: 'Italy', category: 'Leisure' },
    { id: 'ita-4', title: 'Florence Uffizi Gallery Tour', description: 'Expert guide for the world\'s greatest Renaissance art.', price: 7200, country: 'Italy', category: 'Culture' },
    { id: 'ita-5', title: 'Pompeii Guided Archeology Day', description: 'Explore the preserved Roman city under Mt. Vesuvius.', price: 6500, country: 'Italy', category: 'Culture' },
    { id: 'ita-6', title: 'Amalfi Coast Luxury Boat Tour', description: 'Visit Positano and Amalfi by private speedboat.', price: 21500, country: 'Italy', category: 'Nature' },
    { id: 'ita-7', title: 'Tuscan Wine & Olive Oil Tasting', description: 'Authentic vineyard experience in the heart of Chianti.', price: 8800, country: 'Italy', category: 'Dining' },
    { id: 'ita-8', title: 'Leaning Tower of Pisa Climb', description: 'Skip the line to ascend the iconic tilted bell tower.', price: 4200, country: 'Italy', category: 'Culture' },
    { id: 'ita-9', title: 'Milan Duomo Rooftop Terrace', description: 'Walk among the spires for city-wide views.', price: 3500, country: 'Italy', category: 'Modern' },
    { id: 'ita-10', title: 'Lake Como Villa Discovery', description: 'Visit Villa Balbianello and Bellagio by boat.', price: 11000, country: 'Italy', category: 'Leisure' },
    { id: 'ita-11', title: 'Italian Pizza Making Masterclass', description: 'Learn from a master pizzaiolo in a wood-fired oven.', price: 6200, country: 'Italy', category: 'Dining' },
    { id: 'ita-12', title: 'Galleria Borghese Access', description: 'Exclusive entry to Rome\'s finest private collection.', price: 5500, country: 'Italy', category: 'Culture' },
    { id: 'ita-13', title: 'Capri Blue Grotto Exploration', description: 'Visit the magical glowing sea cave by rowboat.', price: 8500, country: 'Italy', category: 'Nature' },
    { id: 'ita-14', title: 'The Last Supper (Da Vinci)', description: 'Rare priority entry to view the world-famous mural.', price: 9800, country: 'Italy', category: 'Culture' },
    { id: 'ita-15', title: 'Venice Glassblowing Workshop', description: 'Watch Murano masters create stunning art.', price: 2500, country: 'Italy', category: 'Culture' },

    // --- GREECE ---
    { id: 'grc-1', title: 'Acropolis & Parthenon Sunrise', description: 'Early entry to Athens\' most sacred hill.', price: 6800, country: 'Greece', category: 'Culture' },
    { id: 'grc-2', title: 'Santorini Sunset Luxury Cruise', description: 'Visit the volcano and swim in the hot springs.', price: 18500, country: 'Greece', category: 'Leisure' },
    { id: 'grc-3', title: 'Delphi Oracle Archeology Tour', description: 'Visit the "Center of the World" and Temple of Apollo.', price: 7200, country: 'Greece', category: 'Culture' },
    { id: 'grc-4', title: 'Mykonos Delos Sacred Island', description: 'Explore the mythical birthplace of Apollo and Artemis.', price: 8500, country: 'Greece', category: 'Culture' },
    { id: 'grc-5', title: 'Meteora Monastery Monastery Hike', description: 'Explore cliff-top monasteries built on giant rocks.', price: 6500, country: 'Greece', category: 'Nature' },
    { id: 'grc-6', title: 'Athens Gourmet Street Food Walk', description: 'Taste authentic gyros, olives, and regional wines.', price: 4800, country: 'Greece', category: 'Dining' },
    { id: 'grc-7', title: 'Knossos Palace (Crete)', description: 'Discover the Labyrinth of the Minotaur.', price: 5500, country: 'Greece', category: 'Culture' },
    { id: 'grc-8', title: 'Zakynthos Blue Caves & Shipwreck', description: 'Boat trip to Navagio Beach\'s turquoise waters.', price: 9500, country: 'Greece', category: 'Nature' },
    { id: 'grc-9', title: 'Mount Olympus Ridge Hike', description: 'Follow the "Path of the Gods" on Greece\'s highest peak.', price: 11000, country: 'Greece', category: 'Adventure' },
    { id: 'grc-10', title: 'Rhodes Old Town Medieval Walk', description: 'Guided tour of the world\'s best preserved medieval city.', price: 3200, country: 'Greece', category: 'Culture' },
    { id: 'grc-11', title: 'Corfu Olive Oil Estate Visit', description: 'Ancient groves and traditional pressing workshop.', price: 3800, country: 'Greece', category: 'Dining' },
    { id: 'grc-12', title: 'Naxos Island Village Cooking', description: 'Farm-to-table lunch in a mountain village.', price: 6800, country: 'Greece', category: 'Dining' },
    { id: 'grc-13', title: 'Hydra & Spetses Island Sail', description: 'Explore car-free islands with stunning mansions.', price: 14500, country: 'Greece', category: 'Leisure' },
    { id: 'grc-14', title: 'Temple of Poseidon Sunset', description: 'Breathtaking views at the edge of Cape Sounion.', price: 4500, country: 'Greece', category: 'Culture' },
    { id: 'grc-15', title: 'Athens Ancient Agora Pass', description: 'Step into the heart of Greek democracy.', price: 2800, country: 'Greece', category: 'Culture' },

    // --- JAPAN ---
    { id: 'jpn-1', title: 'Tokyo Skytree & Senso-ji', description: 'Highest view in Tokyo plus ancient Asakusa culture.', price: 4500, country: 'Japan', category: 'Modern' },
    { id: 'jpn-2', title: 'Kyoto Golden Pavilion & Arashiyama', description: 'Kinkaku-ji Temple and the Bamboo Forest.', price: 6500, country: 'Japan', category: 'Culture' },
    { id: 'jpn-3', title: 'Mount Fuji & Hakone Day Trip', description: 'Cable car, Lake Ashi cruise, and Fuji views.', price: 11500, country: 'Japan', category: 'Nature' },
    { id: 'jpn-4', title: 'Osaka Castle & Dotonbori Tour', description: 'Historic fortress and the world\'s best street food.', price: 5800, country: 'Japan', category: 'Culture' },
    { id: 'jpn-5', title: 'Robot Restaurant High-Tech Show', description: 'Neon-lit futuristic performance in Shinjuku.', price: 8500, country: 'Japan', category: 'Modern' },
    { id: 'jpn-6', title: 'Hiroshima Peace Memorial & Miyajima', description: 'Historic museum and the iconic floating Torii gate.', price: 12500, country: 'Japan', category: 'Culture' },
    { id: 'jpn-7', title: 'Nara Deer Park & Todai-ji', description: 'Bow with wild deer and see the Great Buddha.', price: 4200, country: 'Japan', category: 'Nature' },
    { id: 'jpn-8', title: 'Mario Kart Street Racing (Tokyo)', description: 'Drive through Shibuya Crossing in character costumes.', price: 9500, country: 'Japan', category: 'Adventure' },
    { id: 'jpn-9', title: 'Authentic Tea Ceremony (Kyoto)', description: 'Traditional matcha preparation with a tea master.', price: 5500, country: 'Japan', category: 'Culture' },
    { id: 'jpn-10', title: 'Hokkaido Onsen & Snow Experience', description: 'Relax in natural hot springs amidst deep snow.', price: 14500, country: 'Japan', category: 'Leisure' },
    { id: 'jpn-11', title: 'Sumo Wrestling Morning Practice', description: 'Rare behind-the-scenes look at Japan\'s national sport.', price: 7800, country: 'Japan', category: 'Culture' },
    { id: 'jpn-12', title: 'Tokyo DisneySea Full-Pass', description: 'The world\'s only maritime-themed Disney park.', price: 6800, country: 'Japan', category: 'Leisure' },
    { id: 'jpn-13', title: 'Ghibli Museum Mystery Tour', description: 'Journey into the animation world of Hayao Miyazaki.', price: 9200, country: 'Japan', category: 'Culture' },
    { id: 'jpn-14', title: 'Sushi Making in Tsukiji', description: 'Hands-on lesson using fish from the world\'s largest market.', price: 8500, country: 'Japan', category: 'Dining' },
    { id: 'jpn-15', title: 'Shinkansen Bullet Train Suite', description: 'Luxury first-class experience at 300km/h.', price: 18000, country: 'Japan', category: 'Modern' },

    // --- AUSTRALIA ---
    { id: 'aus-1', title: 'Sydney Opera House VIP Tour', description: 'Expert tour of the world\'s most famous performing arts venue.', price: 4500, country: 'Australia', category: 'Modern' },
    { id: 'aus-2', title: 'Great Barrier Reef (Helicopter)', description: 'Stunning aerial views and snorkeling at the outer reef.', price: 28500, country: 'Australia', category: 'Nature' },
    { id: 'aus-3', title: 'Melbourne Great Ocean Road', description: 'Full day trip tosee the Twelve Apostles and Otway forest.', price: 9500, country: 'Australia', category: 'Nature' },
    { id: 'aus-4', title: 'Uluru Sunrise & Sacred Sites', description: 'Visit Kata Tjuta and the heart of the Red Centre.', price: 14500, country: 'Australia', category: 'Culture' },
    { id: 'aus-5', title: 'Sydney Harbour BridgeClimb', description: 'Scale the iconic "Coathanger" for city-wide views.', price: 18500, country: 'Australia', category: 'Adventure' },
    { id: 'aus-6', title: 'Phillip Island Penguin Parade', description: 'Watch hundreds of little penguins return to shore.', price: 6500, country: 'Australia', category: 'Nature' },
    { id: 'aus-7', title: 'Gold Coast Surfers Paradise Jet Boat', description: 'High-speed spins and 360s on the Broadwater.', price: 5500, country: 'Australia', category: 'Adventure' },
    { id: 'aus-8', title: 'Blue Mountains Scenic World Pass', description: 'Cableway, Skyway, and the world\'s steepest railway.', price: 4800, country: 'Australia', category: 'Nature' },
    { id: 'aus-9', title: 'Hunter Valley Wine & Cheese Fly-in', description: 'Arrive at the vineyards by private helicopter.', price: 21000, country: 'Australia', category: 'Dining' },
    { id: 'aus-10', title: 'Kangaroo Island Wilderness Tour', description: 'Close encounters with koalas, sea lions and roos.', price: 12500, country: 'Australia', category: 'Nature' },
    { id: 'aus-11', title: 'Cairns Rainforestation Nature Park', description: 'Army Duck rainforest tour and Pamagirri culture.', price: 5800, country: 'Australia', category: 'Culture' },
    { id: 'aus-12', title: 'Whitsunday Islands Sailing', description: 'Visit Whitehaven Beach and Hill Inlet via catamaran.', price: 15500, country: 'Australia', category: 'Leisure' },
    { id: 'aus-13', title: 'AFL Match (Marvel Stadium)', description: 'Experience Australia\'s national sport in a premium lounge.', price: 7200, country: 'Australia', category: 'Leisure' },
    { id: 'aus-14', title: 'Daintree Rainforest & Cape Tribulation', description: 'Explore the world\'s oldest tropical rainforest.', price: 11000, country: 'Australia', category: 'Nature' },
    { id: 'aus-15', title: 'Perth Rottnest Island Quokka Pass', description: 'Ferry trip to see the "world\'s happiest animal".', price: 6800, country: 'Australia', category: 'Nature' },

    // --- USA (NEW YORK) ---
    { id: 'usa-1', title: 'Empire State Building (Level 102)', description: 'Express entry to the world\'s most famous observatory.', price: 9500, country: 'New York, USA', category: 'Modern' },
    { id: 'usa-2', title: 'Statue of Liberty & Ellis Island', description: 'Priority ferry and pedestal access to Lady Liberty.', price: 4500, country: 'New York, USA', category: 'Culture' },
    { id: 'usa-3', title: 'Summit One Vanderbilt Access', description: 'Immersive mirrors and skydeck at 1,101 feet.', price: 6500, country: 'New York, USA', category: 'Modern' },
    { id: 'usa-4', title: 'Broadway Musical (Front Row)', description: 'Premium seats for Hamilton or The Lion King.', price: 28500, country: 'New York, USA', category: 'Culture' },
    { id: 'usa-5', title: 'Central Park Luxury Carriage', description: 'Romantic private horse-drawn carriage ride.', price: 12500, country: 'New York, USA', category: 'Leisure' },
    { id: 'usa-6', title: 'Manhattan Island (Doors-Off)', description: 'Thrilling helicopter tour with open side views.', price: 22500, country: 'New York, USA', category: 'Adventure' },
    { id: 'usa-7', title: 'Metropolitan Museum of Art Tour', description: 'Expert guide for the world\'s greatest art treasures.', price: 7500, country: 'New York, USA', category: 'Culture' },
    { id: 'usa-8', title: 'One World Observatory VIP', description: 'Ascend to the top of the Western Hemisphere.', price: 5800, country: 'New York, USA', category: 'Modern' },
    { id: 'usa-9', title: 'Yankee Stadium Premium Seats', description: 'Watch the Bronx Bombers in a luxury suite.', price: 14500, country: 'New York, USA', category: 'Leisure' },
    { id: 'usa-10', title: 'Top of the Rock Observation', description: 'Best views of the Empire State and Central Park.', price: 3800, country: 'New York, USA', category: 'Modern' },
    { id: 'usa-11', title: 'Guggenheim Museum Pass', description: 'Explore the iconic Frank Lloyd Wright structure.', price: 3200, country: 'New York, USA', category: 'Modern' },
    { id: 'usa-12', title: 'Intrepid Sea, Air & Space Museum', description: 'See the Enterprise Space Shuttle and Concorde.', price: 4200, country: 'New York, USA', category: 'Modern' },
    { id: 'usa-13', title: 'New York City Food Tour', description: 'Tasting the best pizza and bagels in Greenwich Village.', price: 6800, country: 'New York, USA', category: 'Dining' },
    { id: 'usa-14', title: 'The Edge (Hudson Yards)', description: 'Highest outdoor sky deck in the Western Hemisphere.', price: 4500, country: 'New York, USA', category: 'Modern' },
    { id: 'usa-15', title: 'Whitney Museum of American Art', description: 'Experience the collection of contemporary US art.', price: 3500, country: 'New York, USA', category: 'Modern' },

    // --- VIETNAM ---
    { id: 'vnm-1', title: 'Ha Long Bay Luxury Cruise', description: 'Breathtaking overnight cruise through limestone karsts.', price: 15500, country: 'Vietnam', category: 'Nature' },
    { id: 'vnm-2', title: 'Hoi An Lantern Old Town Walk', description: 'Guided tour of the UNESCO world heritage port city.', price: 2500, country: 'Vietnam', category: 'Culture' },
    { id: 'vnm-3', title: 'Cu Chi Tunnels Exploration', description: 'Journey into the historic underground resistance network.', price: 3500, country: 'Vietnam', category: 'Culture' },
    { id: 'vnm-4', title: 'Ba Na Hills & Golden Bridge', description: 'Walk through the giant stone hands in the clouds.', price: 6500, country: 'Vietnam', category: 'Modern' },
    { id: 'vnm-5', title: 'Mekong Delta Boat Discovery', description: 'Explore floating markets and tropical orchards.', price: 4200, country: 'Vietnam', category: 'Nature' },
    { id: 'vnm-6', title: 'Saigon Street Food by Vespa', description: 'Thrilling nocturnal food tour on a vintage bike.', price: 7500, country: 'Vietnam', category: 'Dining' },
    { id: 'vnm-7', title: 'Sapa Terrace Rice Field Trek', description: 'Hike through the majestic Fansipan valley views.', price: 5800, country: 'Vietnam', category: 'Nature' },
    { id: 'vnm-8', title: 'Imperial City of Hue Pass', description: 'Explore the Forbidden Purple City of the Nguyen Dynasty.', price: 2500, country: 'Vietnam', category: 'Culture' },
    { id: 'vnm-9', title: 'Phong Nha Caves & Dark Cave', description: 'Boat trip and mud bath in world-record caverns.', price: 8500, country: 'Vietnam', category: 'Adventure' },
    { id: 'vnm-10', title: 'Ao Show (Hanoi Opera House)', description: 'Stunning bamboo circus and contemporary performance.', price: 6200, country: 'Vietnam', category: 'Culture' },
    { id: 'vnm-11', title: 'Marble Mountains & Lady Buddha', description: 'Explore natural caves and the 67m white statue.', price: 2200, country: 'Vietnam', category: 'Culture' },
    { id: 'vnm-12', title: 'Phu Quoc Island Snorkeling', description: 'Crystal-clear waters and vibrant coral in South Vietnam.', price: 4800, country: 'Vietnam', category: 'Nature' },
    { id: 'vnm-13', title: 'Cooking Class in a Rural Village', description: 'Learn to make Pho and Spring Rolls from scratch.', price: 3200, country: 'Vietnam', category: 'Culture' },
    { id: 'vnm-14', title: 'Ninh Binh (Tam Coc) Sampan Boat', description: 'Float through "Ha Long Bay on Land" limestone peaks.', price: 3800, country: 'Vietnam', category: 'Nature' },
    { id: 'vnm-15', title: 'Fansipan Legend Cable Car', description: 'Ascend to the "Roof of Indochina" at 3,143m.', price: 7200, country: 'Vietnam', category: 'Adventure' },

    // --- TURKEY ---
    { id: 'tur-1', title: 'Cappadocia Hot Air Balloon', description: 'Sunrise flight over the fairy chimneys and valleys.', price: 28500, country: 'Turkey', category: 'Adventure' },
    { id: 'tur-2', title: 'Hagia Sophia & Blue Mosque', description: 'Expert tour of Istanbul\'s iconic religious landmarks.', price: 4500, country: 'Turkey', category: 'Culture' },
    { id: 'tur-3', title: 'Ephesus Ancient City Pass', description: 'Explore the best preserved Roman city in Turkey.', price: 6500, country: 'Turkey', category: 'Culture' },
    { id: 'tur-4', title: 'Bosphorus Luxury Sunset Cruise', description: 'Elegant boat tour linking Europe and Asia.', price: 5500, country: 'Turkey', category: 'Leisure' },
    { id: 'tur-5', title: 'Pamukkale Cotton Castle Pools', description: 'Walk through thermal travertines and Hierapolis ruins.', price: 7200, country: 'Turkey', category: 'Nature' },
    { id: 'tur-6', title: 'Topkapi Palace & Harem Tour', description: 'Visit the seat of the Ottoman Sultans.', price: 4800, country: 'Turkey', category: 'Culture' },
    { id: 'tur-7', title: 'Grand Bazaar & Spice Market', description: 'Guided shopping experience in the world\'s oldest bazaar.', price: 2500, country: 'Turkey', category: 'Culture' },
    { id: 'tur-8', title: 'Whirling Dervishes Sufi Show', description: 'Spiritual dance performance in a historic caravanserai.', price: 3800, country: 'Turkey', category: 'Culture' },
    { id: 'tur-9', title: 'Turkish Hamam Ritual (Cagaloglu)', description: 'Traditional bath, scrub and massage in a 300-year-old spa.', price: 8500, country: 'Turkey', category: 'Leisure' },
    { id: 'tur-10', title: 'Antalya Perge & Aspendos Ruins', description: 'Visit the best preserved Roman theater in Turkey.', price: 5800, country: 'Turkey', category: 'Culture' },
    { id: 'tur-11', title: 'Sumela Monastery Clifftop Trip', description: 'Spectacular 4th-century monastery built into the rock.', price: 9500, country: 'Turkey', category: 'Culture' },
    { id: 'tur-12', title: 'Derinkuyu Underground City', description: 'Journey into the multi-level troglodyte resistance caves.', price: 3500, country: 'Turkey', category: 'Culture' },
    { id: 'tur-13', title: 'Bodrum Castle & Underwater Museum', description: 'Medieval fortress and ancient shipwreck treasures.', price: 4200, country: 'Turkey', category: 'Culture' },
    { id: 'tur-14', title: 'Ankara Anitkabir Mausoleum', description: 'Pay respects to the founder of modern Turkey.', price: 0, country: 'Turkey', category: 'Culture' },
    { id: 'tur-15', title: 'Troy Ancient City Discovery', description: 'Visit the legendary battlefield and wooden horse.', price: 6800, country: 'Turkey', category: 'Culture' },
];

const normalizeActivityRecord = (row: any): Activity => ({
    id: String(row?.id || ''),
    title: String(row?.title || row?.name || '').trim(),
    description: String(row?.description || ''),
    price: Number(row?.price ?? row?.priceNum) || 0,
    country: String(row?.country || row?.location || 'Global').trim(),
    category: (row?.category || 'Leisure') as Activity['category'],
    city: row?.city,
});

/** Stable key for deduping built-in library rows vs DB copies (ids differ by case). */
const activityCatalogKey = (activity: {
    id?: string;
    title?: string;
    country?: string;
}): string => {
    const id = String(activity.id || '').toUpperCase();
    const libById = activityLibrary.find((entry) => entry.id.toUpperCase() === id);
    if (libById) return `lib:${libById.id.toUpperCase()}`;

    const title = String(activity.title || '').trim().toLowerCase();
    const country = String(activity.country || '').trim().toLowerCase();
    if (title) return `tc:${title}|${country}`;
    if (id) return `id:${id}`;
    return `row:${title}|${country}|${id}`;
};

/** Use activities stored in MongoDB (no static catalog merge). */
export const mergeActivityCatalog = (dbActivities: any[] = []): Activity[] => {
    if (!Array.isArray(dbActivities)) return [];
    return dbActivities.map((row) => normalizeActivityRecord(row));
};
