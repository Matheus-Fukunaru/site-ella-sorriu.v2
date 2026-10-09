const crypto = require('crypto');
const dns = require('dns').promises;
const fs = require('fs');
const https = require('https');
const net = require('net');
const path = require('path');
const { spawnSync } = require('child_process');
const { PROJECT_ROOT } = require('../config/env');

const rawDbPath = String(process.env.DATABASE_URL || 'file:./back-end/data/ella-sorriu.db').replace(/^file:/, '');
const databasePath = path.isAbsolute(rawDbPath) ? rawDbPath : path.resolve(PROJECT_ROOT, rawDbPath);
const MEDIA_DIR = path.join(path.dirname(databasePath), 'gift-media');
const MEDIA_NAME = /^[a-f0-9-]{36}\.(?:jpg|png|webp|mp3|ogg|m4a|wav|webm)$/i;
const AUDIO_LIMIT = 8 * 1024 * 1024;
const IMAGE_LIMIT = 1024 * 1024;
const VIDEO_LIMIT = 70 * 1024 * 1024;

function mediaKind(buffer) {
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return ['jpg', 'image/jpeg'];
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ['png', 'image/png'];
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return ['webp', 'image/webp'];
  if (buffer.toString('ascii', 0, 3) === 'ID3' || (buffer[0] === 255 && (buffer[1] & 224) === 224)) return ['mp3', 'audio/mpeg'];
  if (buffer.toString('ascii', 0, 4) === 'OggS') return ['ogg', 'audio/ogg'];
  if (buffer.toString('ascii', 4, 8) === 'ftyp' && ['M4A ', 'isom', 'mp42'].includes(buffer.toString('ascii', 8, 12))) return ['m4a', 'audio/mp4'];
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') return ['wav', 'audio/wav'];
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return ['webm', 'audio/webm'];
  return null;
}

function videoKind(buffer) {
  const ftypIndex = buffer.indexOf(Buffer.from('ftyp'));
  if (ftypIndex >= 0 && ftypIndex <= 64) return ['mp4', 'video/mp4'];
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return ['webm', 'video/webm'];
  return null;
}

function isPrivateIp(address) {
  if (net.isIP(address) === 4) {
    const parts = address.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168);
  }
  if (net.isIP(address) === 6) {
    const ip = address.toLowerCase();
    return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:');
  }
  return true;
}

async function assertSafeHttpsUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(String(rawUrl || '').trim()); } catch (_) { throw new Error('Cole um link HTTPS válido.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.href.length > 500) {
    throw new Error('Use um link HTTPS público e sem credenciais.');
  }
  const records = await dns.lookup(parsed.hostname, { all: true, verbatim: false });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) {
    throw new Error('Esse link não parece seguro para importar.');
  }
  return parsed;
}

async function downloadHttpsBuffer(parsedUrl, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(parsedUrl, {
      timeout: 15000,
      headers: { 'User-Agent': 'Ella-Sorriu-Gift-Site/1.0' }
    }, async (response) => {
      const status = Number(response.statusCode || 0);
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location && redirects < 3) {
        response.resume();
        try {
          const redirected = await assertSafeHttpsUrl(new URL(response.headers.location, parsedUrl).href);
          resolve(await downloadHttpsBuffer(redirected, redirects + 1));
        } catch (error) { reject(error); }
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error('Não foi possível baixar esse link.'));
        return;
      }
      const chunks = [];
      let total = 0;
      response.on('data', (chunk) => {
        total += chunk.length;
        if (total > VIDEO_LIMIT) {
          request.destroy(new Error('Arquivo grande demais. Use até 70 MB.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: String(response.headers['content-type'] || '') }));
    });
    request.on('timeout', () => request.destroy(new Error('Tempo esgotado ao baixar o link.')));
    request.on('error', reject);
  });
}

function extensionForImport(buffer, contentType, parsedUrl) {
  const kind = mediaKind(buffer);
  if (kind && kind[1].startsWith('audio/')) return kind[0];
  const video = videoKind(buffer);
  if (video) return video[0];
  if (/audio\/mpeg/i.test(contentType)) return 'mp3';
  if (/audio\/ogg/i.test(contentType)) return 'ogg';
  if (/audio\/(mp4|m4a|x-m4a)/i.test(contentType)) return 'm4a';
  if (/audio\/wav/i.test(contentType)) return 'wav';
  if (/video\/mp4/i.test(contentType)) return 'mp4';
  if (/video\/webm/i.test(contentType)) return 'webm';
  const ext = path.extname(parsedUrl.pathname).slice(1).toLowerCase();
  return ['mp3', 'ogg', 'm4a', 'wav', 'webm', 'mp4'].includes(ext) ? ext : null;
}

function extractAudioFromVideo(buffer, extension, maxSeconds = 600) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true, mode: 0o700 });
  const tempId = crypto.randomUUID();
  const inputPath = path.join(MEDIA_DIR, `${tempId}.${extension}`);
  const outputPath = path.join(MEDIA_DIR, `${crypto.randomUUID()}.m4a`);
  try {
    fs.writeFileSync(inputPath, buffer, { flag: 'wx', mode: 0o600 });
    const result = spawnSync('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', inputPath,
      '-map', '0:a:0',
      '-vn',
      '-t', String(maxSeconds),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath
    ], { timeout: 45000, windowsHide: true, encoding: 'utf8' });

    if (result.error || result.status !== 0 || !fs.existsSync(outputPath)) {
      if (fs.existsSync(outputPath)) fs.rmSync(outputPath, { force: true });
      return { error: 'Não foi possível extrair a música deste vídeo. Envie outro vídeo, um áudio ou cole um link HTTPS.' };
    }
    const { size } = fs.statSync(outputPath);
    if (size < 32 || size > AUDIO_LIMIT) {
      fs.rmSync(outputPath, { force: true });
      return { error: 'O áudio extraído ficou grande demais. Use um vídeo menor ou cole um link da música.' };
    }
    return { url: `/media/gift/${path.basename(outputPath)}` };
  } finally {
    if (fs.existsSync(inputPath)) fs.rmSync(inputPath, { force: true });
  }
}

async function importMediaUrl(req, res) {
  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.sendStatus(403);
  try {
    const parsed = await assertSafeHttpsUrl(req.body && req.body.url);
    if (/youtube\.com|youtu\.be|spotify\.com/i.test(parsed.hostname)) {
      return res.status(422).json({ success: false, external: true, message: 'YouTube e Spotify não liberam um arquivo direto para salvar com segurança. Mantive como link externo.' });
    }
    const downloaded = await downloadHttpsBuffer(parsed);
    if (downloaded.buffer.length > VIDEO_LIMIT) return res.status(413).json({ success: false, message: 'Arquivo grande demais. Use até 70 MB.' });
    const extension = extensionForImport(downloaded.buffer, downloaded.contentType, parsed);
    if (!extension) return res.status(415).json({ success: false, message: 'Esse link não parece ser áudio ou vídeo direto.' });
    const extracted = extractAudioFromVideo(downloaded.buffer, extension, 90);
    if (extracted.error) return res.status(422).json({ success: false, message: extracted.error });
    return res.status(201).json({ success: true, url: extracted.url, imported: true, clippedSeconds: 90 });
  } catch (error) {
    return res.status(422).json({ success: false, message: error.message || 'Não foi possível importar esse link.' });
  }
}

function storedMediaPath(url, expected) {
  const match = /^\/media\/gift\/([^/]+)$/.exec(String(url || ''));
  if (!match || !MEDIA_NAME.test(match[1])) return null;
  const ext = path.extname(match[1]).slice(1).toLowerCase();
  if (expected === 'image' && !['jpg', 'png', 'webp'].includes(ext)) return null;
  if (expected === 'audio' && !['mp3', 'ogg', 'm4a', 'wav', 'webm'].includes(ext)) return null;
  const file = path.join(MEDIA_DIR, match[1]);
  return fs.existsSync(file) ? file : null;
}

function uploadMedia(req, res) {
  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.sendStatus(403);
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
  const kind = Buffer.isBuffer(buffer) && buffer.length > 32 && mediaKind(buffer);
  const requested = req.get('x-gift-media-type');
  const source = String(req.get('x-gift-media-source') || '').toLowerCase();
  if (requested === 'audio' && source === 'video') {
    const video = Buffer.isBuffer(buffer) && buffer.length > 32 && (videoKind(buffer) || (kind && kind[0] === 'm4a' ? ['mp4', 'video/mp4'] : null));
    if (!video) return res.status(415).json({ success: false, message: 'Use um vídeo MP4 ou WebM para extrair a música.' });
    if (buffer.length > VIDEO_LIMIT) return res.status(413).json({ success: false, message: 'Vídeo grande demais. Use até 70 MB ou cole um link HTTPS.' });
    const extracted = extractAudioFromVideo(buffer, video[0]);
    if (extracted.error) return res.status(422).json({ success: false, message: extracted.error });
    return res.status(201).json({ success: true, url: extracted.url, extracted: true });
  }
  if (!kind || !['image', 'audio'].includes(requested) || !kind[1].startsWith(`${requested}/`)) {
    return res.status(415).json({ success: false, message: 'Use uma foto JPG, PNG ou WebP, ou áudio MP3, OGG, M4A, WAV ou WebM.' });
  }
  const limit = requested === 'image' ? IMAGE_LIMIT : AUDIO_LIMIT;
  if (buffer.length > limit) return res.status(413).json({ success: false, message: 'Arquivo grande demais. Fotos: 1 MB; música: 8 MB.' });
  fs.mkdirSync(MEDIA_DIR, { recursive: true, mode: 0o700 });
  const filename = `${crypto.randomUUID()}.${kind[0]}`;
  fs.writeFileSync(path.join(MEDIA_DIR, filename), buffer, { flag: 'wx', mode: 0o600 });
  return res.status(201).json({ success: true, url: `/media/gift/${filename}` });
}

function publicMedia(req, res) {
  const file = storedMediaPath(`/media/gift/${req.params.filename}`);
  if (!file) return res.sendStatus(404);
  res.set({ 'Cache-Control': 'public, max-age=604800, immutable', 'X-Content-Type-Options': 'nosniff' });
  if (path.extname(file).toLowerCase() === '.webm') res.type('audio/webm');
  return res.sendFile(file);
}

module.exports = { uploadMedia, importMediaUrl, publicMedia, storedMediaPath, mediaKind };
