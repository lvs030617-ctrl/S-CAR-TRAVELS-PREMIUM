-- Migration: 20261011000003_seed_data.sql
-- S CAR TRAVELS PREMIUM — Initial Fleet, Destinations, Pricing Rules & Settings

-- 1. Sole Fleet Vehicle (White Suzuki Ertiga)
INSERT INTO public.vehicles (
  model_name, color, registration_number, seating_capacity,
  fuel_type, transmission, air_conditioning, luggage_capacity,
  features, status, last_sanitized_at, insurance_valid_until, fitness_valid_until
)
VALUES (
  'Maruti Suzuki Ertiga (Smart Hybrid)',
  'Pearl Arctic White',
  'AP03 CZ 4567',
  7,
  'Petrol / Smart Hybrid',
  'Manual 5-Speed',
  'Dual AC with Independent Rear Controls',
  '3-4 Medium/Large Bags with 50:50 3rd row split',
  '[
    "Dual Air Conditioning (Roof vents for 2nd & 3rd row)",
    "6+1 Passenger Seating Capacity",
    "Push-back Ergonomic Captain Comfort",
    "Foldable 3rd Row for Extra Large Luggage",
    "Smart Hybrid Fuel Efficiency",
    "High Ground Clearance for Indian Roads & Ghats",
    "Full Sanitization before every trip",
    "Music System with Bluetooth & Mobile Fast Charging"
  ]'::jsonb,
  'available',
  now(),
  '2027-04-15',
  '2028-06-30'
)
ON CONFLICT (registration_number) DO NOTHING;

-- 2. Site Settings
INSERT INTO public.site_settings (key, value, description) VALUES
  ('business_name', 'S CAR TRAVELS PREMIUM', 'Official Business Name'),
  ('tagline_en', 'Mee Prayanam… Maa Badhyata!', 'Brand Tagline in English/Hinglish'),
  ('tagline_te', 'మీ ప్రయాణం… మా బాధ్యత!', 'Brand Tagline in Telugu'),
  ('owner_name', 'SRINU', 'Proprietor Name'),
  ('owner_phone', '9550641408', 'Direct Calling Number'),
  ('whatsapp_number', '919550641408', 'WhatsApp Direct Line with Country Code'),
  ('base_location_name', 'Kotananduru, Andhra Pradesh', 'Primary Operating Base'),
  ('base_location_te', 'కోటనందూరు, ఆంధ్రప్రదేశ్', 'Primary Base in Telugu'),
  ('full_address', 'Near Main Bus Stand, Kotananduru, Kakinada District, Andhra Pradesh - 533407, India', 'Physical Address'),
  ('google_maps_url', 'https://maps.google.com/?q=Kotananduru,Andhra+Pradesh', 'Google Maps Link'),
  ('service_hours_en', '24/7 Advance Bookings | Call Support 6:00 AM – 10:30 PM', 'Business Operational Hours'),
  ('extra_km_rate_min', '18', 'Extra kilometre starting charge in INR'),
  ('extra_km_rate_max', '20', 'Extra kilometre maximum charge in INR'),
  ('driver_bata_per_day', '400', 'Driver day allowance in INR'),
  ('night_halt_charge', '500', 'Driver night halt allowance in INR'),
  ('fuel_policy_summary', 'Tolls, parking, and permit charges are additional as per actuals unless agreed. Rates are preliminary estimates subject to owner confirmation.', 'Fuel & Toll Policy'),
  ('self_drive_terms_en', 'Self-drive rental requires valid Original Driving Licence (min 2 yrs experience), Aadhaar Card verification, and refundable security deposit of ₹3,000. Fuel is at customer expense. Speed limit 80 km/h.', 'Self-Drive Mandatory Terms')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 3. Pricing Rules
INSERT INTO public.pricing_rules (
  rule_code, title_en, title_te, rate_type, min_price, max_price,
  duration_hours, distance_limit_km, extra_km_rate, fuel_included,
  tolls_included, driver_bata_included, description_en, description_te, display_order
) VALUES
  (
    'LOCAL_8H_80KM',
    'Local Rental with Driver (8 Hours / 80 KM)',
    'స్థానిక ప్రయాణం డ్రైవర్‌తో (8 గంటలు / 80 కి.మీ)',
    'package',
    2500,
    3000,
    8,
    80,
    18.00,
    true,
    false,
    true,
    'Perfect for local shopping, family functions, hospital visits, or Tuni/Annavaram nearby transit. Extra km at ₹18-20/km.',
    'స్థానిక షాపింగ్, ఫంక్షన్లు, ఆసుపత్రి లేదా తుని/అన్నవరం సమీప ప్రాంతాల కోసం ఉత్తమమైనది. అదనపు కి.మీ రూ.18-20.',
    1
  ),
  (
    'FULL_DAY_12H',
    'Full Day with Driver (10–12 Hours)',
    'పూర్తి రోజు డ్రైవర్‌తో (10–12 గంటలు)',
    'package',
    3000,
    3500,
    12,
    150,
    18.00,
    false,
    false,
    true,
    'Ideal for marriage functions, temple day circuits, and extended day travel. Base vehicle hire + driver; fuel as per usage.',
    'పెళ్ళిళ్ళు, శుభకార్యాలు మరియు రోజంతా ప్రయాణాల కోసం అనుకూలం. బేస్ అద్దె + డ్రైవర్ బాటా.',
    2
  ),
  (
    'SELF_DRIVE_24H',
    'Self-Drive Rental (24 Hours)',
    'సెల్ఫ్-డ్రైవ్ అద్దె (24 గంటలు)',
    'package',
    3000,
    3500,
    24,
    300,
    15.00,
    false,
    false,
    false,
    'Private family freedom. Subject to DL verification, Aadhaar check, refundable security deposit of ₹3,000, and clean driving record.',
    'మీ కుటుంబంతో స్వేచ్ఛగా ప్రయాణించండి. ఒరిజినల్ డ్రైవింగ్ లైసెన్స్, ఆధార్ మరియు సెక్యూరిటీ డిపాజిట్ అవసరం.',
    3
  ),
  (
    'EXTRA_KM_DRIVER',
    'Extra Kilometre with Driver',
    'డ్రైవర్‌తో అదనపు కిలోమీటర్',
    'per_km',
    18,
    20,
    0,
    1,
    18.00,
    true,
    false,
    false,
    'Applicable beyond included package kilometre limits for with-driver journeys.',
    'ప్యాకేజీ పరిమితి దాటిన తర్వాత ప్రతి అదనపు కిలోమీటరుకు వర్తిస్తుంది.',
    4
  )
ON CONFLICT (rule_code) DO NOTHING;

-- 4. Destinations
INSERT INTO public.destinations (
  key_slug, name_en, name_te, distance_km, duration_hours,
  one_way_price_min, round_trip_price_min, round_trip_price_max,
  popular, category, description_en, description_te, display_order
) VALUES
  (
    'kakinada',
    'Kakinada',
    'కాకినాడ',
    65,
    '1.5 hrs',
    2000,
    4000,
    5000,
    true,
    'outstation',
    'Smart City, Coringa Wildlife Sanctuary, Kakinada Beach, Hope Island, Port transit.',
    'స్మార్ట్ సిటీ, కోరింగ అభయారణ్యం, కాకినాడ బీచ్, పోర్ట్ ప్రయాణాలు.',
    1
  ),
  (
    'rajahmundry',
    'Rajahmundry',
    'రాజమండ్రి',
    80,
    '2 hrs',
    2500,
    4500,
    5500,
    true,
    'outstation',
    'Cultural capital on River Godavari, Kotilingala Ghat, Airport connectivity, ISKCON temple.',
    'గోదావరి తీర నగరం, కోటిలింగాల ఘాట్, విమానాశ్రయం, ఇస్కాన్ ఆలయం.',
    2
  ),
  (
    'visakhapatnam',
    'Visakhapatnam (Vizag)',
    'విశాఖపట్నం (వైజాగ్)',
    125,
    '2.5 hrs',
    3500,
    5500,
    6500,
    true,
    'outstation',
    'City of Destiny, RK Beach, Kailasagiri, Submarine Museum, Vizag International Airport & Railway.',
    'సిటీ ఆఫ్ డెస్టినీ, ఆర్కే బీచ్, కైలాసగిరి, సబ్‌మెరైన్ మ్యూజియం, ఎయిర్‌పోర్ట్ కనెక్టివిటీ.',
    3
  ),
  (
    'vijayawada',
    'Vijayawada',
    'విజయవాడ',
    240,
    '4.5 hrs',
    5500,
    10000,
    11500,
    true,
    'outstation',
    'Kanaka Durga Temple, Prakasam Barrage, Bhavani Island, Commercial transit hub.',
    'కనకదుర్గమ్మ ఆలయం, ప్రకాశం బ్యారేజ్, భవానీ ఐలాండ్, వ్యాపార ప్రయాణాలు.',
    4
  ),
  (
    'tirupati',
    'Tirupati (Balaji Darshan)',
    'తిరుపతి (శ్రీ బాలాజీ దర్శనం)',
    580,
    '10 hrs',
    12000,
    24000,
    27000,
    true,
    'temple',
    'Sacred Tirumala Venkateswara Swamy Temple pilgrimage, Alipiri, Padmavathi Temple, comfortable AC drive.',
    'తిరుమల శ్రీ వేంకటేశ్వర స్వామి దివ్య దర్శనం, పద్మావతి అమ్మవారి ఆలయం, సుఖవంతమైన ప్రయాణం.',
    5
  ),
  (
    'araku',
    'Araku Valley',
    'అరకు లోయ',
    210,
    '4.5 hrs',
    4500,
    9000,
    11000,
    true,
    'outstation',
    'Coffee plantations, Borra Caves, Chaparai waterfalls, misty hill station route with expert driver.',
    'కాఫీ తోటలు, బొర్రా గుహలు, చాపరాయి జలపాతం, ఆహ్లాదకరమైన ఘాట్ రోడ్ ప్రయాణం.',
    6
  ),
  (
    'annavaram',
    'Annavaram Temple',
    'అన్నవరం శ్రీ సత్యనారాయణ స్వామి',
    22,
    '30 mins',
    1000,
    1800,
    2200,
    true,
    'temple',
    'Famous Ratnagiri hilltop shrine of Sri Veera Venkata Satyanarayana Swamy, Vratham ceremonies.',
    'రత్నగిరి కొండపై శ్రీ వీర వేంకట సత్యనారాయణ స్వామి వ్రతాలు మరియు దర్శనం.',
    7
  ),
  (
    'draksharamam',
    'Draksharamam Pancharama',
    'ద్రాక్షారామం పంచారామ క్షేత్రం',
    95,
    '2.5 hrs',
    2800,
    4800,
    5800,
    true,
    'temple',
    'Dakshina Kasi, ancient Bhimeswara Swamy Jyotirlinga and Manikyamba Shakti Peetham temple tour.',
    'దక్షిణ కాశీ, శ్రీ భీమేశ్వర స్వామి జ్యోతిర్లింగం మరియు మాణిక్యాంబ శక్తిపీఠం.',
    8
  )
ON CONFLICT (key_slug) DO NOTHING;
