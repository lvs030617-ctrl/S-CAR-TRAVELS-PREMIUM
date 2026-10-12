import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { testSupabaseServerConnection } from './supabase.js';
import publicRouter from './routes/public.js';
import adminRouter from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Reverse-Proxy Trust Configuration:
// Trust the immediate front-facing reverse proxy (Render proxy boundary = 1 hop).
// Uses req.ip derived from the single trusted proxy hop to prevent client header spoofing.
const trustHops = process.env.TRUST_PROXY ? (Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY) : 1;
app.set('trust proxy', trustHops);

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

// Health check endpoint with diagnostic connectivity check
app.get('/api/health', async (req, res) => {
  const sbStatus = await testSupabaseServerConnection();
  res.json({
    status: 'ok',
    service: 'S CAR TRAVELS PREMIUM API',
    timestamp: new Date().toISOString(),
    vehicle: 'White Suzuki Ertiga (Single Fleet)',
    supabase: {
      configured: sbStatus.configured,
      connected: sbStatus.connected
    }
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
