import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initDatabase } from './db.js';
import publicRouter from './routes/public.js';
import adminRouter from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seed data
initDatabase();

const app = express();
const PORT = process.env.PORT || 5000;

// Reverse-Proxy Trust Configuration:
// Trust only the immediate front-facing reverse proxy (e.g. Render, Nginx, Cloudflare).
// Do not blindly set 'trust proxy: true' to avoid accepting spoofed client headers from arbitrary sources.
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY) {
  const trustVal = process.env.TRUST_PROXY ? (Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY) : 1;
  app.set('trust proxy', trustVal);
}

// Security & Parsing Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : null;

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server, curl, same-origin, or whitelisted domains
    if (!origin || !allowedOrigins || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not permitted by CORS policy`));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Basic Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// API Routes
app.use('/api/public', publicRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'S CAR TRAVELS PREMIUM API',
    timestamp: new Date().toISOString(),
    vehicle: 'White Suzuki Ertiga (Single Fleet)'
  });
});

// Serve frontend build if dist folder exists (Production mode)
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚗 S CAR TRAVELS PREMIUM Server running on port ${PORT}`);
  console.log(`📍 Base: Kotananduru, Andhra Pradesh | Fleet: 1 White Ertiga`);
  console.log(`📞 Contact: 9550641408 (Srinu)`);
  console.log(`====================================================`);
});
