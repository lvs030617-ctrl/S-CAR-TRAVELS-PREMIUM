import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'scar_travels.db');
export const db = new Database(dbPath);

// Enable WAL mode for high concurrency & reliability
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vehicle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_name TEXT NOT NULL,
      color TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      seating_capacity INTEGER NOT NULL DEFAULT 7,
      fuel_type TEXT NOT NULL,
      transmission TEXT NOT NULL,
      air_conditioning TEXT NOT NULL,
      luggage_capacity TEXT NOT NULL,
      features_json TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      last_sanitized_at TEXT,
      insurance_valid_until TEXT,
      fitness_valid_until TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      service_type TEXT NOT NULL, -- 'with_driver' | 'self_drive'
      trip_type TEXT NOT NULL, -- 'round_trip' | 'one_way' | 'local_8h' | 'full_day' | 'temple_tour' | 'outstation'
      pickup_location TEXT NOT NULL,
      destination TEXT NOT NULL,
      pickup_datetime TEXT NOT NULL,
      return_datetime TEXT,
      passengers INTEGER NOT NULL DEFAULT 1,
      luggage_count INTEGER DEFAULT 1,
      estimated_min_price INTEGER,
      estimated_max_price INTEGER,
      final_agreed_price INTEGER,
      special_notes TEXT,
      status TEXT DEFAULT 'pending', -- 'pending' | 'confirmed' | 'completed' | 'cancelled'
      admin_notes TEXT,
      client_ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS booking_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT,
      changed_by TEXT NOT NULL,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_slug TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_te TEXT NOT NULL,
      distance_km INTEGER NOT NULL,
      duration_hours TEXT NOT NULL,
      one_way_price_min INTEGER NOT NULL,
      round_trip_price_min INTEGER NOT NULL,
      round_trip_price_max INTEGER NOT NULL,
      popular INTEGER DEFAULT 1,
      category TEXT DEFAULT 'outstation',
      description_en TEXT,
      description_te TEXT,
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pricing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_code TEXT UNIQUE NOT NULL,
      title_en TEXT NOT NULL,
      title_te TEXT NOT NULL,
      rate_type TEXT NOT NULL,
      min_price INTEGER NOT NULL,
      max_price INTEGER NOT NULL,
      duration_hours INTEGER,
      distance_limit_km INTEGER,
      fuel_included INTEGER DEFAULT 0,
      tolls_included INTEGER DEFAULT 0,
      driver_bata_included INTEGER DEFAULT 0,
      description_en TEXT,
      description_te TEXT,
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS blocked_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(reference_no);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_bookings_pickup ON bookings(pickup_datetime);
    CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(customer_phone);
  `);

  seedInitialData();
}

function seedInitialData() {
  // 1. Seed Admin
  const adminCount = db.prepare('SELECT count(*) as count FROM admins').get().count;
  const initialUser = process.env.ADMIN_INITIAL_USERNAME || 'srinu';
  const initialPass = process.env.ADMIN_INITIAL_PASSWORD || 'Srinu@2026';

  if (adminCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(initialPass, salt);
    db.prepare(`
      INSERT INTO admins (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(initialUser, `${initialUser}@scar.com`, hash, 'superadmin');
  }

  // Allow secure password override via server-side environment variable (e.g. Render Dashboard)
  if (process.env.ADMIN_PASSWORD_OVERRIDE && process.env.ADMIN_PASSWORD_OVERRIDE.trim().length >= 8) {
    const overrideHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD_OVERRIDE.trim(), 10);
    const updated = db.prepare(`
      UPDATE admins SET password_hash = ? WHERE username = ? OR role = 'superadmin'
    `).run(overrideHash, initialUser);
    if (updated.changes > 0) {
      console.log('✅ Admin password securely updated via server environment override.');
    }
  }

  // 2. Seed Vehicle (Exactly ONE White Suzuki Ertiga)
  const vehicleCount = db.prepare('SELECT count(*) as count FROM vehicle').get().count;
  if (vehicleCount === 0) {
    const features = JSON.stringify([
      'Dual Air Conditioning (Roof vents for 2nd & 3rd row)',
      '6+1 Passenger Seating Capacity',
      'Push-back Ergonomic Captain Comfort',
      'Foldable 3rd Row for Extra Large Luggage',
      'Smart Hybrid Fuel Efficiency',
      'High Ground Clearance for Indian Roads & Ghats',
      'Full Sanitization before every trip',
      'Music System with Bluetooth & Mobile Fast Charging'
    ]);

    db.prepare(`
      INSERT INTO vehicle (
        model_name, color, registration_number, seating_capacity,
        fuel_type, transmission, air_conditioning, luggage_capacity,
        features_json, status, last_sanitized_at, insurance_valid_until, fitness_valid_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Maruti Suzuki Ertiga (Smart Hybrid)',
      'Pearl Arctic White',
      'AP03 CZ 4567',
      7,
      'Petrol / Smart Hybrid',
      'Manual 5-Speed',
      'Dual AC with Independent Rear Controls',
      '3-4 Medium/Large Bags with 50:50 3rd row split',
      features,
      'available',
      new Date().toISOString(),
      '2027-04-15',
      '2028-06-30'
    );
  }

  // 3. Seed Site Settings
  const settingsCount = db.prepare('SELECT count(*) as count FROM site_settings').get().count;
  if (settingsCount === 0) {
    const settings = [
      { key: 'business_name', value: 'S CAR TRAVELS PREMIUM' },
      { key: 'tagline_en', value: 'Mee Prayanam… Maa Badhyata!' },
      { key: 'tagline_te', value: 'మీ ప్రయాణం… మా బాధ్యత!' },
      { key: 'owner_name', value: 'SRINU' },
      { key: 'owner_phone', value: '9550641408' },
      { key: 'whatsapp_number', value: '919550641408' },
      { key: 'base_location_name', value: 'Kotananduru, Andhra Pradesh' },
      { key: 'base_location_te', value: 'కోటనందూరు, ఆంధ్రప్రదేశ్' },
      { key: 'full_address', value: 'Near Main Bus Stand, Kotananduru, Kakinada District, Andhra Pradesh - 533407, India' },
      { key: 'google_maps_url', value: 'https://maps.google.com/?q=Kotananduru,Andhra+Pradesh' },
      { key: 'service_hours_en', value: '24/7 Advance Bookings | Call Support 6:00 AM – 10:30 PM' },
      { key: 'service_hours_te', value: '24/7 ముందస్తు బుకింగ్‌లు | కాల్ సపోర్ట్ ఉదయం 6:00 - రాత్రి 10:30' },
      { key: 'extra_km_rate_min', value: '18' },
      { key: 'extra_km_rate_max', value: '20' },
      { key: 'driver_bata_per_day', value: '400' },
      { key: 'night_halt_charge', value: '500' },
      { key: 'fuel_policy_summary', value: 'Tolls, parking, and permit charges are additional as per actuals unless agreed. Rates are preliminary estimates subject to owner confirmation.' },
      { key: 'self_drive_terms_en', value: 'Self-drive rental requires valid Original Driving Licence (min 2 yrs experience), Aadhaar Card verification, and refundable security deposit of ₹3,000. Fuel is at customer expense. Speed limit 80 km/h.' },
      { key: 'self_drive_terms_te', value: 'సెల్ఫ్-డ్రైవ్ అద్దెకు ఒరిజినల్ డ్రైవింగ్ లైసెన్స్ (కనీసం 2 సం. అనుభవం), ఆధార్ కార్డు ధృవీకరణ మరియు రూ. 3,000 రీఫండబుల్ సెక్యూరిటీ డిపాజిట్ తప్పనిసరి. ఇంధనం కస్టమర్ భరించాలి.' },
      { key: 'privacy_notice_en', value: 'We collect your name, phone number, and journey details solely to coordinate vehicle bookings. Your private data is never sold or shared with third parties.' },
      { key: 'privacy_notice_te', value: 'వాహన బుకింగ్‌ల నిర్వహణ కోసమే మేము మీ పేరు, ఫోన్ నంబర్ మరియు ప్రయాణ వివరాలను సేకరిస్తాము. మీ వ్యక్తిగత డేటా సురక్షితంగా ఉంటుంది.' }
    ];

    const insertSetting = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
    for (const item of settings) {
      insertSetting.run(item.key, item.value);
    }
  }

  // 4. Seed Pricing Rules (Reviewed starter estimates)
  const pricingCount = db.prepare('SELECT count(*) as count FROM pricing_rules').get().count;
  if (pricingCount === 0) {
    const rules = [
      {
        rule_code: 'LOCAL_8H_80KM',
        title_en: 'Local Rental with Driver (8 Hours / 80 KM)',
        title_te: 'స్థానిక ప్రయాణం డ్రైవర్‌తో (8 గంటలు / 80 కి.మీ)',
        rate_type: 'package',
        min_price: 2500,
        max_price: 3000,
        duration_hours: 8,
        distance_limit_km: 80,
        fuel_included: 1,
        tolls_included: 0,
        driver_bata_included: 1,
        description_en: 'Perfect for local shopping, family functions, hospital visits, or Tuni/Annavaram nearby transit. Extra km at ₹18-20/km.',
        description_te: 'స్థానిక షాపింగ్, ఫంక్షన్లు, ఆసుపత్రి లేదా తుని/అన్నవరం సమీప ప్రాంతాల కోసం ఉత్తమమైనది. అదనపు కి.మీ రూ.18-20.',
        sort_order: 1
      },
      {
        rule_code: 'FULL_DAY_12H',
        title_en: 'Full Day with Driver (10–12 Hours)',
        title_te: 'పూర్తి రోజు డ్రైవర్‌తో (10–12 గంటలు)',
        rate_type: 'package',
        min_price: 3000,
        max_price: 3500,
        duration_hours: 12,
        distance_limit_km: 150,
        fuel_included: 0,
        tolls_included: 0,
        driver_bata_included: 1,
        description_en: 'Ideal for marriage functions, temple day circuits, and extended day travel. Base vehicle hire + driver; fuel as per usage.',
        description_te: 'పెళ్ళిళ్ళు, శుభకార్యాలు మరియు రోజంతా ప్రయాణాల కోసం అనుకూలం. బేస్ అద్దె + డ్రైవర్ బాటా.',
        sort_order: 2
      },
      {
        rule_code: 'SELF_DRIVE_24H',
        title_en: 'Self-Drive Rental (24 Hours)',
        title_te: 'సెల్ఫ్-డ్రైవ్ అద్దె (24 గంటలు)',
        rate_type: 'package',
        min_price: 3000,
        max_price: 3500,
        duration_hours: 24,
        distance_limit_km: 300,
        fuel_included: 0,
        tolls_included: 0,
        driver_bata_included: 0,
        description_en: 'Private family freedom. Subject to DL verification, Aadhaar check, refundable security deposit, and clean driving record.',
        description_te: 'మీ కుటుంబంతో స్వేచ్ఛగా ప్రయాణించండి. ఒరిజినల్ డ్రైవింగ్ లైసెన్స్, ఆధార్ మరియు సెక్యూరిటీ డిపాజిట్ అవసరం.',
        sort_order: 3
      },
      {
        rule_code: 'EXTRA_KM_DRIVER',
        title_en: 'Extra Kilometre with Driver',
        title_te: 'డ్రైవర్‌తో అదనపు కిలోమీటర్',
        rate_type: 'per_km',
        min_price: 18,
        max_price: 20,
        duration_hours: 0,
        distance_limit_km: 1,
        fuel_included: 1,
        tolls_included: 0,
        driver_bata_included: 0,
        description_en: 'Applicable beyond included package kilometre limits for with-driver journeys.',
        description_te: 'ప్యాకేజీ పరిమితి దాటిన తర్వాత ప్రతి అదనపు కిలోమీటరుకు వర్తిస్తుంది.',
        sort_order: 4
      }
    ];

    const insertRule = db.prepare(`
      INSERT INTO pricing_rules (
        rule_code, title_en, title_te, rate_type, min_price, max_price,
        duration_hours, distance_limit_km, fuel_included, tolls_included,
        driver_bata_included, description_en, description_te, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const rule of rules) {
      insertRule.run(
        rule.rule_code, rule.title_en, rule.title_te, rule.rate_type,
        rule.min_price, rule.max_price, rule.duration_hours, rule.distance_limit_km,
        rule.fuel_included, rule.tolls_included, rule.driver_bata_included,
        rule.description_en, rule.description_te, rule.sort_order
      );
    }
  }

  // 5. Seed Destinations
  const destCount = db.prepare('SELECT count(*) as count FROM destinations').get().count;
  if (destCount === 0) {
    const destinations = [
      {
        key_slug: 'kakinada',
        name_en: 'Kakinada',
        name_te: 'కాకినాడ',
        distance_km: 65,
        duration_hours: '1.5 hrs',
        one_way_price_min: 2000,
        round_trip_price_min: 4000,
        round_trip_price_max: 5000,
        popular: 1,
        category: 'outstation',
        description_en: 'Smart City, Coringa Wildlife Sanctuary, Kakinada Beach, Hope Island, Port transit.',
        description_te: 'స్మార్ట్ సిటీ, కోరింగ అభయారణ్యం, కాకినాడ బీచ్, పోర్ట్ ప్రయాణాలు.',
        sort_order: 1
      },
      {
        key_slug: 'rajahmundry',
        name_en: 'Rajahmundry',
        name_te: 'రాజమండ్రి',
        distance_km: 80,
        duration_hours: '2 hrs',
        one_way_price_min: 2500,
        round_trip_price_min: 4500,
        round_trip_price_max: 5500,
        popular: 1,
        category: 'outstation',
        description_en: 'Cultural capital on River Godavari, Kotilingala Ghat, Airport connectivity, ISKCON temple.',
        description_te: 'గోదావరి తీర నగరం, కోటిలింగాల ఘాట్, విమానాశ్రయం, ఇస్కాన్ ఆలయం.',
        sort_order: 2
      },
      {
        key_slug: 'visakhapatnam',
        name_en: 'Visakhapatnam (Vizag)',
        name_te: 'విశాఖపట్నం (వైజాగ్)',
        distance_km: 125,
        duration_hours: '2.5 hrs',
        one_way_price_min: 3500,
        round_trip_price_min: 5500,
        round_trip_price_max: 6500,
        popular: 1,
        category: 'outstation',
        description_en: 'City of Destiny, RK Beach, Kailasagiri, Submarine Museum, Vizag International Airport & Railway.',
        description_te: 'సిటీ ఆఫ్ డెస్టినీ, ఆర్కే బీచ్, కైలాసగిరి, సబ్‌మెరైన్ మ్యూజియం, ఎయిర్‌పోర్ట్ కనెక్టివిటీ.',
        sort_order: 3
      },
      {
        key_slug: 'vijayawada',
        name_en: 'Vijayawada',
        name_te: 'విజయవాడ',
        distance_km: 240,
        duration_hours: '4.5 hrs',
        one_way_price_min: 5500,
        round_trip_price_min: 10000,
        round_trip_price_max: 11500,
        popular: 1,
        category: 'outstation',
        description_en: 'Kanaka Durga Temple, Prakasam Barrage, Bhavani Island, Commercial transit hub.',
        description_te: 'కనకదుర్గమ్మ ఆలయం, ప్రకాశం బ్యారేజ్, భవానీ ఐలాండ్, వ్యాపార ప్రయాణాలు.',
        sort_order: 4
      },
      {
        key_slug: 'tirupati',
        name_en: 'Tirupati (Balaji Darshan)',
        name_te: 'తిరుపతి (శ్రీ బాలాజీ దర్శనం)',
        distance_km: 580,
        duration_hours: '10 hrs',
        one_way_price_min: 12000,
        round_trip_price_min: 24000,
        round_trip_price_max: 27000,
        popular: 1,
        category: 'temple',
        description_en: 'Sacred Tirumala Venkateswara Swamy Temple pilgrimage, Alipiri, Padmavathi Temple, comfortable AC drive.',
        description_te: 'తిరుమల శ్రీ వేంకటేశ్వర స్వామి దివ్య దర్శనం, పద్మావతి అమ్మవారి ఆలయం, సుఖవంతమైన ప్రయాణం.',
        sort_order: 5
      },
      {
        key_slug: 'araku',
        name_en: 'Araku Valley',
        name_te: 'అరకు లోయ',
        distance_km: 210,
        duration_hours: '4.5 hrs',
        one_way_price_min: 4500,
        round_trip_price_min: 9000,
        round_trip_price_max: 11000,
        popular: 1,
        category: 'outstation',
        description_en: 'Coffee plantations, Borra Caves, Chaparai waterfalls, misty hill station route with expert driver.',
        description_te: 'కాఫీ తోటలు, బొర్రా గుహలు, చాపరాయి జలపాతం, ఆహ్లాదకరమైన ఘాట్ రోడ్ ప్రయాణం.',
        sort_order: 6
      },
      {
        key_slug: 'annavaram',
        name_en: 'Annavaram Temple',
        name_te: 'అన్నవరం శ్రీ సత్యనారాయణ స్వామి',
        distance_km: 22,
        duration_hours: '30 mins',
        one_way_price_min: 1000,
        round_trip_price_min: 1800,
        round_trip_price_max: 2200,
        popular: 1,
        category: 'temple',
        description_en: 'Famous Ratnagiri hilltop shrine of Sri Veera Venkata Satyanarayana Swamy, Vratham ceremonies.',
        description_te: 'రత్నగిరి కొండపై శ్రీ వీర వేంకట సత్యనారాయణ స్వామి వ్రతాలు మరియు దర్శనం.',
        sort_order: 7
      },
      {
        key_slug: 'draksharamam',
        name_en: 'Draksharamam Pancharama',
        name_te: 'ద్రాక్షారామం పంచారామ క్షేత్రం',
        distance_km: 95,
        duration_hours: '2.5 hrs',
        one_way_price_min: 2800,
        round_trip_price_min: 4800,
        round_trip_price_max: 5800,
        popular: 1,
        category: 'temple',
        description_en: 'Dakshina Kasi, ancient Bhimeswara Swamy Jyotirlinga and Manikyamba Shakti Peetham temple tour.',
        description_te: 'దక్షిణ కాశీ, శ్రీ భీమేశ్వర స్వామి జ్యోతిర్లింగం మరియు మాణిక్యాంబ శక్తిపీఠం.',
        sort_order: 8
      }
    ];

    const insertDest = db.prepare(`
      INSERT INTO destinations (
        key_slug, name_en, name_te, distance_km, duration_hours,
        one_way_price_min, round_trip_price_min, round_trip_price_max,
        popular, category, description_en, description_te, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const d of destinations) {
      insertDest.run(
        d.key_slug, d.name_en, d.name_te, d.distance_km, d.duration_hours,
        d.one_way_price_min, d.round_trip_price_min, d.round_trip_price_max,
        d.popular, d.category, d.description_en, d.description_te, d.sort_order
      );
    }
  }

  // 6. Seed a sample inquiry for demonstration if table is empty
  const bookingCount = db.prepare('SELECT count(*) as count FROM bookings').get().count;
  if (bookingCount === 0) {
    db.prepare(`
      INSERT INTO bookings (
        reference_no, customer_name, customer_phone, service_type,
        trip_type, pickup_location, destination, pickup_datetime, return_datetime,
        passengers, luggage_count, estimated_min_price, estimated_max_price,
        special_notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'SCT-2026-9481',
      'Venkata Rao',
      '9848012345',
      'with_driver',
      'round_trip',
      'Kotananduru',
      'Visakhapatnam',
      '2026-10-18T07:00',
      '2026-10-18T21:00',
      5,
      2,
      5500,
      6500,
      'Airport pickup for family returning from Bangalore. Please keep AC at comfortable level.',
      'pending',
      new Date().toISOString()
    );
  }
}
