const db = require('../config/db');

const OCCASIONS = Object.freeze([
  'Aniversário',
  'Namoro',
  'Casamento',
  'Amizade',
  'Dia das Mães',
  'Dia dos Pais',
  'Dia das Crianças',
  'Agradecimento',
  'Formatura',
  'Natal',
  'Dia dos Namorados',
  'Páscoa',
  'Bodas',
  'Boa sorte',
  'Novo emprego'
]);

const STYLES = Object.freeze(['ella', 'gradient', 'romantic', 'editorial', 'botanical', 'retro']);
const THEMES = Object.freeze(['light', 'dark']);
const QR_STYLES = Object.freeze(['heart', 'rounded', 'classic', 'dotted', 'circle', 'flower', 'ticket']);
const COUPONS = Object.freeze({
  SORRISO5: 5,
  CARINHO10: 10,
  PRESENTE15: 15,
  ELLA20: 20
});

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

function normalizeSlug(value) {
  return slugify(value).slice(0, 48);
}

function isSlugAvailable(slug) {
  const normalized = normalizeSlug(slug);
  return Boolean(normalized) && !db.prepare('SELECT 1 FROM gift_sites WHERE slug = ? LIMIT 1').get(normalized);
}

function mapGiftSite(row) {
  if (!row) return null;
  const storedLetters = JSON.parse(row.letters_json || '[]');
  return {
    id: Number(row.id),
    slug: row.slug,
    recipientName: row.recipient_name,
    senderName: row.sender_name,
    occasion: row.occasion,
    personStyle: row.person_style || 'neutral',
    style: row.style,
    theme: row.theme,
    reducedMotion: Boolean(row.reduced_motion),
    smoothReading: Boolean(row.smooth_reading),
    photoUrl: row.photo_url || null,
    photos: JSON.parse(row.photos_json || '[]'),
    carousels: JSON.parse(row.carousels_json || '[]'),
    musicUrl: row.music_url || null,
    musicExternal: Boolean(row.music_url && !row.music_url.startsWith('/media/gift/') && !row.music_url.startsWith('/media/music/')),
    musicTitle: row.music_title || '',
    showTitle: row.show_title == null ? true : Boolean(row.show_title),
    pageTitle: row.page_title || '',
    fontStyle: row.font_style || 'editorial',
    extraNote: row.extra_note || '',
    photoLayout: row.photo_layout || 'gallery',
    letters: storedLetters.length ? storedLetters : [row.letter_one, row.letter_two, row.letter_three].filter(Boolean),
    qrStyle: row.qr_style,
    couponCode: row.coupon_code || null,
    couponPercent: Number(row.coupon_percent || 0),
    paymentMethod: row.payment_method || null,
    paymentStatus: row.payment_status,
    createdAt: Number(row.created_at),
    publishedAt: row.published_at == null ? null : Number(row.published_at)
  };
}

function createGiftSite(input) {
  const result = db.prepare(`INSERT INTO gift_sites
    (slug, recipient_name, sender_name, occasion, style, theme, reduced_motion, smooth_reading,
     photo_url, letter_one, letter_two, letter_three, qr_style, coupon_code, coupon_percent,
     payment_method, payment_status, photos_json, carousels_json, music_url, font_style, extra_note, photo_layout, music_title, show_title, page_title, person_style, letters_json, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`).run(
    input.slug,
    input.recipientName,
    input.senderName,
    input.occasion,
    input.style,
    input.theme,
    input.reducedMotion ? 1 : 0,
    input.smoothReading ? 1 : 0,
    input.photoUrl || null,
    input.letters[0],
    input.letters[1] || null,
    input.letters[2] || null,
    input.qrStyle,
    input.couponCode || null,
    input.couponPercent || 0,
    input.paymentMethod || null,
    input.paymentMethod ? 'test_pending' : 'not_started',
    JSON.stringify(input.photos),
    JSON.stringify(input.carousels),
    input.musicUrl,
    input.fontStyle,
    input.extraNote,
    input.photoLayout,
    input.musicTitle,
    input.showTitle ? 1 : 0,
    input.pageTitle,
    input.personStyle,
    JSON.stringify(input.letters)
  );
  return getGiftSiteById(result.lastInsertRowid);
}

function getGiftSiteById(id) {
  return mapGiftSite(db.prepare('SELECT * FROM gift_sites WHERE id = ?').get(id));
}

function getGiftSiteBySlug(slug) {
  return mapGiftSite(db.prepare('SELECT * FROM gift_sites WHERE slug = ?').get(normalizeSlug(slug)));
}

module.exports = {
  OCCASIONS,
  STYLES,
  THEMES,
  QR_STYLES,
  COUPONS,
  slugify,
  normalizeSlug,
  isSlugAvailable,
  createGiftSite,
  getGiftSiteById,
  getGiftSiteBySlug,
  mapGiftSite
};
