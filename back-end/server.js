const { loadAndValidateEnvironment } = require('./config/env');

try {
  loadAndValidateEnvironment();
} catch (err) {
  console.error(`[config] ${err.message}`);
  process.exit(1);
}

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const ordersRouter = require('./routes/orders');
const giftSitesRouter = require('./routes/giftSites');
const { publicMedia } = require('./controllers/giftMediaController');
const { publicSettings } = require('./controllers/ordersController');
const adminRouter = require('./routes/admin');
const { apiLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { countOwners } = require('./models/adminsModel');
const { ensureInstallationToken, getPublicBaseUrl } = require('./config/env');
const productsController = require('./controllers/productsController');
const musicLibrary = require('./controllers/musicLibraryController');
const { publicSite: publicGiftSite } = require('./controllers/giftSitesController');

function resolveCorsOrigin() {
  const configuredOrigin = String(process.env.CORS_ORIGIN || '').trim();
  if (!configuredOrigin) return false;

  if (configuredOrigin === '*') {
    throw new Error('CORS_ORIGIN não pode ser "*". Informe a origem exata do frontend.');
  }

  const parsedOrigin = new URL(configuredOrigin);
  if (!['http:', 'https:'].includes(parsedOrigin.protocol)) {
    throw new Error('CORS_ORIGIN precisa usar http:// ou https://.');
  }
  if (process.env.NODE_ENV === 'production' && parsedOrigin.protocol !== 'https:') {
    throw new Error('CORS_ORIGIN precisa usar HTTPS em produção.');
  }

  return parsedOrigin.origin;
}

function resolveTrustProxy() {
  if (process.env.NODE_ENV !== 'production') return false;

  const hops = Number(process.env.TRUST_PROXY_HOPS || 1);
  if (!Number.isInteger(hops) || hops < 0 || hops > 5) {
    throw new Error('TRUST_PROXY_HOPS precisa ser um número inteiro entre 0 e 5.');
  }
  return hops === 0 ? false : hops;
}

let corsOrigin;
let trustProxy;
try {
  corsOrigin = resolveCorsOrigin();
  trustProxy = resolveTrustProxy();
  if (countOwners() === 0) ensureInstallationToken();
  if (process.env.NODE_ENV === 'production' || process.env.SMTP_HOST) getPublicBaseUrl();
} catch (err) {
  console.error(`[config] ${err.message}`);
  process.exit(1);
}

const app = express();
const FRONTEND_DIR = path.join(__dirname, '..', 'front-end');
const BUILD_ID = 'ella-sorriu-v40';

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        frameSrc: ["'self'", 'about:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    crossOriginResourcePolicy: { policy: 'same-site' }
  })
);

app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  next();
});

// Por padrão, sem CORS liberado: frontend e backend são servidos pelo
// mesmo processo/domínio (ver express.static abaixo), então CORS aberto
// não é necessário. Só habilite CORS_ORIGIN no .env se o frontend for
// hospedado separadamente do backend.
app.use(
  cors({
    origin: corsOrigin,
    credentials: Boolean(corsOrigin)
  })
);

app.use('/api/gift-sites/media', express.raw({ type: 'application/octet-stream', limit: '70mb' }));
app.use(express.json({ limit: '60kb' }));
app.use(express.urlencoded({ extended: false, limit: '15kb' }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, app: 'ella-sorriu', build: BUILD_ID });
});

// Exige Content-Type correto nas rotas de API que recebem JSON — isso
// também funciona como uma camada extra contra CSRF em /api/orders: um
// <form> comum de outro site não consegue mandar application/json sem
// disparar preflight de CORS, que é bloqueado pela política acima.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'POST' && !(req.path === '/gift-sites/media' && req.is('application/octet-stream')) && !req.is('application/json')) {
    return res.status(415).json({ success: false, message: 'Content-Type deve ser application/json.' });
  }
  next();
});

app.use('/api', apiLimiter);
app.get('/api/public-settings', publicSettings);
app.use('/api/gift-sites', giftSitesRouter);
app.get('/api/products', productsController.publicCatalog);
app.get('/api/music-library', musicLibrary.catalog);
app.get('/media/music/:filename', musicLibrary.media);
app.get('/media/music-proxy', musicLibrary.proxy);
app.get('/api/products/:slug', productsController.publicProduct);
app.get('/media/gift/:filename', publicMedia);
app.get('/media/products/:filename', productsController.publicProductMedia);
app.use('/api/orders', ordersRouter);

app.use('/admin', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  const isProductImageUpload = req.method === 'POST' && ['/products/media/upload', '/music/upload'].includes(req.path) && req.is('application/octet-stream');
  if (req.method === 'POST' && !req.is('application/x-www-form-urlencoded') && !isProductImageUpload) {
    return res.status(415).send('Formato de formulário inválido.');
  }
  next();
});
app.use('/admin', adminRouter);

app.get('/presente/:slug', publicGiftSite);

app.use(
  express.static(FRONTEND_DIR, {
    extensions: ['html'],
    dotfiles: 'deny',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (/\.(mp4|webm|webp|avif|jpg|jpeg|png|svg)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      }
    }
  })
);

app.use(notFound);
app.use(errorHandler);

const portArgumentIndex = process.argv.indexOf('--port');
const commandLinePort = portArgumentIndex >= 0 ? Number(process.argv[portArgumentIndex + 1]) : null;
const PORT = commandLinePort || process.env.PORT || 3000;
const HOST = process.env.NODE_ENV === 'production'
  ? String(process.env.HOST || '0.0.0.0')
  : '127.0.0.1';
const server = app.listen(PORT, HOST, () => {
  console.log(`Ella Sorriu rodando em http://${HOST}:${PORT}`);
});

server.requestTimeout = 90_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 100;

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
