'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const logger = require('./utils/logger');
const { standardLimiter } = require('./middleware/rateLimit');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const routes = require('./routes');
const swagger = require('./config/swagger');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security headers (helmet defaults are sensible; relax CSP for Swagger UI assets)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS — by default permissive for the mobile + web frontend clients.
// In production, scope this with ALLOWED_ORIGINS env var (comma-separated).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Request logging
if (!config.isProd) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
}

// Global rate limit (excludes health + swagger)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/docs') || req.path === '/api/health' || req.path === '/api') return next();
  return standardLimiter(req, res, next);
});

// API routes
app.use('/api', routes);

// Swagger docs
try {
  swagger.mount(app, '/api/docs');
  logger.info('Swagger UI mounted at /api/docs');
} catch (err) {
  logger.warn({ err: err.message }, 'Swagger spec not loaded');
}

// 404 + error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// On Vercel, the file is required and Express handles the request. Locally
// we start a listening server.
if (require.main === module) {
  app.listen(config.port, () => {
    logger.info(`Heabron CoopScore API listening on :${config.port} (${config.env})`);
  });
}

module.exports = app;
