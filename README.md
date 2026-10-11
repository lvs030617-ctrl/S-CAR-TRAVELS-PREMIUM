# 🚗 S CAR TRAVELS PREMIUM (ఎస్ కార్ ట్రావెల్స్ ప్రీమియం)

> **"Mee Prayanam… Maa Badhyata!" (మీ ప్రయాణం… మా బాధ్యత!)**  
> *Your Journey… Our Responsibility!*

Full-stack, mobile-first web application for **S CAR TRAVELS PREMIUM**, a dedicated car rental service based in **Kotananduru, Andhra Pradesh, India**. Owned and managed by **SRINU** (Phone/WhatsApp: `+91 9550641408`).

---

## 🌟 Fleet Transparency Notice
- **Dedicated Sole Fleet:** S CAR TRAVELS operates **exactly ONE Pearl Arctic White Suzuki Ertiga** (AP03 CZ 4567, 6+1 Seater, Dual AC).
- **No Fleet Ambiguity:** The business does not operate a multi-cab taxi network. Every passenger receives personal vehicle care and direct scheduling from Srinu.
- **Single-Vehicle Double Booking Prevention:** The scheduling engine automatically checks date-time intervals to ensure two confirmed bookings never overlap for the vehicle.

---

## 🛠️ Technology Stack
- **Frontend:** React 19, Vite, React Router 7, Lucide Icons
- **Styling:** Custom Vanilla CSS Design System with luxury dark navy (`#070b14`) and brushed gold (`#d4af37`) palette, tailored typography (Outfit, Plus Jakarta Sans, Noto Sans Telugu)
- **Internationalization:** Full bilingual English and Telugu toggle with native Telugu script support
- **Backend:** Express.js REST API server with rate limiting, input sanitization, and JWT authentication
- **Database:** Embedded SQLite via `better-sqlite3` with WAL (Write-Ahead Logging) mode, relational tables, foreign keys, and indexes
- **Integrations:** Direct WhatsApp API link generator (`https://wa.me/919550641408?text=...`) and direct click-to-call (`tel:+919550641408`)

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js v18+ (tested on Node v22.22)
- npm v9+

### 2. Installation
```bash
# Clone or navigate to repository
cd "S Car Trips"

# Install dependencies
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 4. Run Development Server
```bash
# Runs both Express API (Port 5000) and Vite Client (Port 3000) concurrently
npm run dev
```

Visit the app at:
- **Public Customer Website:** `http://localhost:3000/`
- **Owner Admin Portal:** `http://localhost:3000/admin/login`
  - Default Username: `srinu`
  - Initial Password: Set securely via `ADMIN_INITIAL_PASSWORD` in your local `.env` (change upon first login)

---

## 📦 Production Deployment

### 1. Build Production Frontend
```bash
npm run build
```
This generates the optimized production bundle in `./dist`.

### 2. Start Production Server
```bash
NODE_ENV=production PORT=5000 node server/index.js
```
The Express server will automatically serve the API at `/api/*` and host the production React app from `./dist` for all web pages with SPA routing fallback.

### 3. Process Management with PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start server
pm2 start server/index.js --name "scar-travels"

# Setup auto-restart on system reboot
pm2 startup
pm2 save
```

---

## 🌐 Custom Domain Launch Checklist (`scartravels.in`)

1. **Domain Purchase:** Register domain (e.g. via Namecheap, GoDaddy, Hostinger, or Dynadot).
2. **DNS Records:**
   - `A Record`: `@` pointing to your VPS server IPv4 address.
   - `CNAME Record`: `www` pointing to `@` or server domain.
3. **Nginx Reverse Proxy & SSL (Certbot):**
   ```nginx
   server {
       server_name scartravels.in www.scartravels.in;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   Install free SSL with Let's Encrypt:
   ```bash
   sudo certbot --nginx -d scartravels.in -d www.scartravels.in
   ```
4. **Google Search Console & Business Profile:**
   - Submit `https://scartravels.in/sitemap.xml`.
   - Verify Google Business Profile for "S CAR TRAVELS, Kotananduru, Andhra Pradesh" using phone `9550641408`.

---

## 🔐 Integrations & Transparency Disclosures
- **WhatsApp Integration:** Uses direct URI scheme `https://wa.me/919550641408` with URL-encoded trip summaries. No third-party WhatsApp Business API subscription credentials required.
- **Payment Processing:** S CAR TRAVELS does not collect customer card details or process online payments on this website. All fares are agreed directly with Srinu upon schedule confirmation.
- **Pricing:** Starter package estimates (e.g., local 8h/80km ₹2,500–₹3,000, outstation rates) are indicative business estimates subject to seasonal fuel costs and owner review.
