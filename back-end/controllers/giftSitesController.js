const {
  OCCASIONS,
  STYLES,
  THEMES,
  QR_STYLES,
  COUPONS,
  normalizeSlug,
  isSlugAvailable,
  createGiftSite,
  getGiftSiteBySlug
} = require('../models/giftSitesModel');
const { getPublicBaseUrl } = require('../config/env');
const { storedMediaPath } = require('./giftMediaController');
const { giftQrSvg } = require('../utils/giftQr');
const { publishedTrack } = require('./musicLibraryController');

const MAX_LETTER_LENGTH = 1800;

function cleanText(value, max) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function safePhotoUrl(value) {
  const photo = cleanText(value, 500);
  if (!photo) return null;
  if (['/imagens/produtos/presente-girassol.jpeg', '/imagens/produtos/cesta-carolina.jpg'].includes(photo)) return photo;
  return null;
}

function normalizePhotos(raw, max) {
  if (!Array.isArray(raw) || raw.length > max) return null;
  const photos = raw.map((entry) => ({
    url: cleanText(entry && entry.url, 120),
    description: cleanText(entry && entry.description, 240),
    playMusic: Boolean(entry && entry.playMusic),
    note: cleanText(entry && entry.note, 200)
  }));
  if (photos.some((photo) => !storedMediaPath(photo.url, 'image'))) return null;
  return photos;
}

function normalizePayload(body = {}) {
  const slug = normalizeSlug(body.slug);
  const recipientName = cleanText(body.recipientName, 100);
  const senderName = cleanText(body.senderName, 100);
  const occasion = cleanText(body.occasion, 40);
  const personStyle = cleanText(body.personStyle, 16) || 'neutral';
  const style = cleanText(body.style, 24);
  const theme = cleanText(body.theme, 10);
  // O QR público usa o modelo normal em fundo branco. Modelos decorativos
  // continuam preservados para pedidos históricos, mas não são oferecidos
  // para novos sites.
  const qrStyle = 'classic';
  const rawLetters = Array.isArray(body.letters) ? body.letters : [body.letterOne, body.letterTwo, body.letterThree];
  const letters = rawLetters.slice(0, 8).map((value) => cleanText(value, MAX_LETTER_LENGTH))
    .filter(Boolean);
  const couponCode = cleanText(body.couponCode, 24).toUpperCase();
  const couponPercent = COUPONS[couponCode] || 0;
  const paymentMethod = cleanText(body.paymentMethod, 12).toLowerCase();
  const photos = normalizePhotos(body.photos || [], 10);
  const carousels = Array.isArray(body.carousels) && body.carousels.length <= 2
    ? body.carousels.map((carousel) => ({
      title: cleanText(carousel && carousel.title, 80),
      photos: normalizePhotos(carousel && carousel.photos, 10)
    })) : null;
  const musicUrl = cleanText(body.musicUrl, 500) || null;
  const showTitle = body.showTitle !== false && body.showTitle !== 'false' && body.showTitle !== '0';
  const pageTitle = cleanText(body.pageTitle, 140);
  let musicExternal = false;
  if (musicUrl && !storedMediaPath(musicUrl, 'audio') && !publishedTrack(musicUrl)) {
    try {
      const parsedMusicUrl = new URL(musicUrl);
      if (parsedMusicUrl.protocol !== 'https:') throw new Error('Protocolo inválido');
      musicExternal = true;
    } catch (_) { return { error: 'Use um arquivo de música enviado ou um link HTTPS válido.' }; }
  }
  const fontStyle = cleanText(body.fontStyle, 20) || 'editorial';
  const photoLayout = cleanText(body.photoLayout, 20) || 'gallery';

  if (!slug || slug.length < 3) return { error: 'Escolha uma URL com pelo menos 3 caracteres.' };
  if (recipientName.length < 2) return { error: 'Informe o nome de quem vai receber.' };
  if (senderName.length < 2) return { error: 'Informe o seu nome.' };
  if (!OCCASIONS.includes(occasion)) return { error: 'Escolha uma ocasião válida.' };
  if (!['neutral', 'masculine', 'feminine'].includes(personStyle)) return { error: 'Escolha um estilo de pessoa válido.' };
  if (!STYLES.includes(style)) return { error: 'Escolha um estilo válido.' };
  if (!THEMES.includes(theme)) return { error: 'Escolha um tema válido.' };
  if (!QR_STYLES.includes(qrStyle)) return { error: 'Escolha um modelo de QR Code válido.' };
  if (letters.length < 2 || letters.length > 8) return { error: 'Escreva de duas a oito cartinhas.' };
  if (letters.some((letter) => letter.length < 3)) return { error: 'Cada cartinha precisa ter pelo menos 3 caracteres.' };
  if (paymentMethod && !['pix', 'credit', 'debit'].includes(paymentMethod)) return { error: 'Escolha uma forma de pagamento válida.' };
  if (!photos || !carousels || carousels.some((carousel) => !carousel.photos)) return { error: 'Revise as fotos. São aceitas até dez fotos principais e dois carrosséis de até dez fotos.' };
  if (!['editorial', 'classic', 'modern', 'handwritten'].includes(fontStyle)) return { error: 'Escolha uma fonte válida.' };
  if (!['gallery', 'interleaved', 'alternating'].includes(photoLayout)) return { error: 'Escolha uma organização válida para as fotos.' };

  return {
    value: {
      slug,
      recipientName,
      senderName,
      occasion,
      personStyle,
      style,
      theme,
      reducedMotion: body.reducedMotion === true || body.reducedMotion === 'true' || body.reducedMotion === '1',
      smoothReading: body.smoothReading !== false && body.smoothReading !== 'false' && body.smoothReading !== '0',
      photoUrl: safePhotoUrl(body.photoUrl),
      photos,
      carousels: carousels.filter((carousel) => carousel.photos.length),
      musicUrl,
      musicExternal,
      musicTitle: cleanText(body.musicTitle, 100),
      showTitle,
      pageTitle,
      fontStyle,
      photoLayout,
      extraNote: cleanText(body.extraNote, 500),
      letters,
      qrStyle,
      couponCode: couponPercent ? couponCode : null,
      couponPercent,
      paymentMethod: paymentMethod || null
    }
  };
}

function ensureSameOrigin(req) {
  const origin = String(req.get('origin') || '').trim();
  if (!origin) return true;
  return origin === `${req.protocol}://${req.get('host')}`;
}

function publicSiteUrl(slug) {
  return new URL(`/presente/${encodeURIComponent(slug)}`, `${getPublicBaseUrl()}/`).toString();
}

function slugAvailability(req, res) {
  const slug = normalizeSlug(req.body && req.body.slug);
  return res.set('Cache-Control', 'no-store').json({
    slug,
    available: Boolean(slug) && isSlugAvailable(slug)
  });
}

function preview(req, res) {
  const result = normalizePayload(req.body);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  return res.set('Cache-Control', 'no-store').json({ success: true, site: result.value, testMode: true });
}

function qrSample(req, res) {
  const style = cleanText(req.params.style, 16);
  if (!QR_STYLES.includes(style)) return res.sendStatus(404);
  const sampleUrl = new URL('/site-presente.html', `${getPublicBaseUrl()}/`).toString();
  return res.set('Cache-Control', 'public, max-age=86400')
    .type('image/svg+xml')
    .send(giftQrSvg(sampleUrl, style));
}

function occasionArt(req, res) {
  const occasion = cleanText(req.query.occasion, 40);
  if (!OCCASIONS.includes(occasion)) return res.sendStatus(404);
  return res.set('Cache-Control', 'public, max-age=86400').render('gift-occasion-art', { occasion });
}

function previewHtml(req, res, next) {
  if (!ensureSameOrigin(req)) return res.sendStatus(403);
  const draft = { ...req.body };
  if (normalizeSlug(draft.slug).length < 3) draft.slug = 'minha-previa';
  if (cleanText(draft.recipientName, 100).length < 2) draft.recipientName = 'alguém especial';
  if (cleanText(draft.senderName, 100).length < 2) draft.senderName = 'você';
  if (cleanText(draft.letterOne, MAX_LETTER_LENGTH).length < 3) draft.letterOne = 'Uma primeira cartinha feita com carinho.';
  if (cleanText(draft.letterTwo, MAX_LETTER_LENGTH).length < 3) draft.letterTwo = 'E mais uma memória para guardar.';
  // Complete only the preview array; checkout still requires real letters.
  if (Array.isArray(draft.letters)) {
    draft.letters = draft.letters.slice(0, 8).map((letter, index) => {
      if (cleanText(letter, MAX_LETTER_LENGTH).length >= 3) return letter;
      return index < 2 ? [draft.letterOne, draft.letterTwo][index] : '';
    });
    while (draft.letters.length < 2) draft.letters.push([draft.letterOne, draft.letterTwo][draft.letters.length]);
  }
  const result = normalizePayload(draft);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  const site = result.value;
  const shareUrl = publicSiteUrl(site.slug);
  const qrDataUrl = `data:image/svg+xml;base64,${Buffer.from(giftQrSvg(shareUrl, site.qrStyle)).toString('base64')}`;
  return res.render('gift-site', { site, shareUrl, qrDataUrl, isPreview: true }, (error, html) => {
    if (error) return next(error);
    return res.set('Cache-Control', 'no-store').type('html').send(html);
  });
}

function checkout(req, res, next) {
  try {
    if (!ensureSameOrigin(req)) return res.status(403).json({ success: false, message: 'Origem não autorizada.' });
    const result = normalizePayload(req.body);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    if (!result.value.musicUrl) return res.status(400).json({ success: false, message: 'Escolha uma música antes de criar o site.' });
    if (!isSlugAvailable(result.value.slug)) return res.status(409).json({ success: false, message: 'Essa URL já está sendo usada. Escolha outra.' });
    const site = createGiftSite(result.value);
    const shareUrl = publicSiteUrl(site.slug);
    return res.status(201).json({
      success: true,
      testMode: true,
      message: 'Seu site foi criado em modo de teste. Nenhuma cobrança foi realizada.',
      url: `/presente/${encodeURIComponent(site.slug)}`,
      shareUrl,
      site,
      payment: result.value.paymentMethod ? { status: 'test_pending', method: result.value.paymentMethod } : null
    });
  } catch (error) {
    if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ success: false, message: 'Essa URL já está sendo usada. Escolha outra.' });
    return next(error);
  }
}

async function publicSite(req, res, next) {
  const site = getGiftSiteBySlug(req.params.slug);
  if (!site) return res.status(404).render('token-invalid', { title: 'Site não encontrado', message: 'Este endereço não está disponível.' });
  try {
    const shareUrl = publicSiteUrl(site.slug);
    const qrDataUrl = `data:image/svg+xml;base64,${Buffer.from(giftQrSvg(shareUrl, site.qrStyle)).toString('base64')}`;
    return res.render('gift-site', { site, shareUrl, qrDataUrl, isPreview: false });
  } catch (error) {
    return next(error);
  }
}

module.exports = { slugAvailability, preview, previewHtml, checkout, publicSite, qrSample, occasionArt };
