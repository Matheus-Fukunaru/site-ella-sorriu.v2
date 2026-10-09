const express = require('express');
const rateLimit = require('express-rate-limit');
const { orderLimiter } = require('../middleware/rateLimiters');
const { slugAvailability, preview, previewHtml, checkout, qrSample, occasionArt } = require('../controllers/giftSitesController');
const { uploadMedia, importMediaUrl } = require('../controllers/giftMediaController');

const router = express.Router();
const imageLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 35, standardHeaders: true, legacyHeaders: false });
const audioLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 4, standardHeaders: true, legacyHeaders: false });

router.get('/qr-sample/:style', qrSample);
router.get('/occasion-art', occasionArt);
router.post('/slug-check', orderLimiter, slugAvailability);
router.post('/preview', orderLimiter, preview);
router.post('/preview-html', orderLimiter, previewHtml);
router.post('/media', (req, res, next) => (req.get('x-gift-media-type') === 'audio' ? audioLimiter : imageLimiter)(req, res, next), uploadMedia);
router.post('/media/import-url', audioLimiter, importMediaUrl);
router.post('/checkout', orderLimiter, checkout);

module.exports = router;
