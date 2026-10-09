const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');
const { PROJECT_ROOT } = require('../config/env');
const { mediaKind } = require('./giftMediaController');
const GENRES = ['Sertanejo', 'Funk', 'Pop', 'Romântico', 'MPB', 'Pagode', 'Samba', 'Gospel', 'Instrumental', 'Outro'];
// Faixas iniciais com licença Mixkit; o catálogo pode ser ampliado pelo painel.
const STARTER_IDS = {
  'Romântico': [493, 601, 659, 39, 599, 683, 711, 672, 1081, 717, 37, 40, 854, 43, 664, 716, 1028, 1099, 227],
  Pop: [288, 5, 801, 250, 970, 1000, 200, 837, 350, 935, 1147, 349, 821, 1131, 158, 851, 854, 1087, 228, 1030, 94, 1166, 1012, 927, 553, 831, 1124, 327, 1164, 1048, 1138, 14, 487, 916, 432, 1146],
  Funk: [872, 989, 1140, 1141, 1147, 1077, 868, 849, 787, 860, 635, 1190, 850, 1029, 72, 858, 824, 757, 1003, 1054, 983, 1109, 696, 1042, 853, 1152, 911, 1060, 610, 1127, 1027]
};
const STARTER_TRACKS = Object.keys(STARTER_IDS).flatMap((genre) => Array.from({ length: 50 }, (_, index) => {
  const id = STARTER_IDS[genre][index % STARTER_IDS[genre].length];
  return { id: 'starter-' + genre + '-' + index, title: genre + ' · faixa ' + String(index + 1).padStart(2, '0'), artist: 'Mixkit', genre, url: 'https://assets.mixkit.co/music/' + id + '/' + id + '.mp3' };
}));
const rawPath = String(process.env.DATABASE_URL || 'file:./back-end/data/ella-sorriu.db').replace(/^file:/, '');
const DIRECTORY = path.join(path.dirname(path.resolve(PROJECT_ROOT, rawPath)), 'music-library');
const starterCatalog = require('../data/music-catalog.json');
db.exec(`CREATE TABLE IF NOT EXISTS music_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, artist TEXT NOT NULL,
  genre TEXT NOT NULL, filename TEXT NOT NULL UNIQUE, mime TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1, authorized_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
)`);
function list(activeOnly = false) {
  return db.prepare(`SELECT * FROM music_library ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY title COLLATE NOCASE, id`).all();
}
function publicTrack(track) { const source = track.url || ('/media/music/' + track.filename); return { id: track.id, title: track.title, artist: track.artist, genre: track.genre, url: source.startsWith('https://assets.mixkit.co/') ? '/media/music-proxy?url=' + encodeURIComponent(source) : source }; }
async function proxy(req, res) {
  try {
    const source = new URL(String(req.query.url || ''));
    if (source.protocol !== 'https:' || source.hostname !== 'assets.mixkit.co') return res.sendStatus(400);
    const response = await fetch(source);
    if (!response.ok || !response.body) return res.sendStatus(404);
    res.type('audio/mpeg').set('Cache-Control', 'public, max-age=86400');
    require('stream').Readable.fromWeb(response.body).pipe(res);
  } catch (_) { res.sendStatus(404); }
}
function catalog(req, res) { const tracks = list(true); res.json({ genres: GENRES, tracks: tracks.length ? tracks.map(publicTrack) : starterCatalog.tracks }); }
function publishedTrack(url) {
  const match = /^\/media\/music\/([a-f0-9-]{36}\.(?:mp3|ogg|m4a|wav))$/.exec(String(url || ''));
  if (!match) return null;
  const track = db.prepare('SELECT * FROM music_library WHERE filename = ? AND active = 1').get(match[1]);
  return track && fs.existsSync(path.join(DIRECTORY, track.filename)) ? track : null;
}
function media(req, res) {
  if (!/^[a-f0-9-]{36}\.(mp3|ogg|m4a|wav)$/.test(req.params.filename)) return res.sendStatus(404);
  // Archiving hides a song from new choices without breaking existing gift sites.
  const track = db.prepare('SELECT * FROM music_library WHERE filename = ?').get(req.params.filename);
  if (!track || !fs.existsSync(path.join(DIRECTORY, track.filename))) return res.sendStatus(404);
  res.type(track.mime).set('Cache-Control', 'public, max-age=3600').sendFile(path.join(DIRECTORY, track.filename));
}
function page(req, res) {
  res.render('music-library', { admin: req.admin, csrfToken: req.cookies.csrf_token, tracks: list(), genres: GENRES, saved: req.query.saved === '1' });
}
function metadata(title, artist, genre) {
  title = String(title || '').trim(); artist = String(artist || '').trim(); genre = String(genre || '');
  if (!title || title.length > 100 || !artist || artist.length > 100 || !GENRES.includes(genre)) return null;
  return { title, artist, genre };
}
function upload(req, res) {
  let details;
  try { details = metadata(decodeURIComponent(req.get('x-track-title') || ''), decodeURIComponent(req.get('x-track-artist') || ''), decodeURIComponent(req.get('x-track-genre') || '')); }
  catch (_) { return res.status(400).json({ message: 'Revise os dados da música.' }); }
  if (!details || req.get('x-track-authorized') !== 'yes') return res.status(400).json({ message: 'Preencha nome, artista, estilo e confirme a autorização de uso.' });
  const buffer = req.body;
  const kind = Buffer.isBuffer(buffer) && buffer.length > 32 && buffer.length <= 8 * 1024 * 1024 && mediaKind(buffer);
  if (!kind || !['mp3', 'ogg', 'm4a', 'wav'].includes(kind[0])) return res.status(400).json({ message: 'Envie um áudio MP3, OGG, M4A ou WAV válido de até 8 MB.' });
  fs.mkdirSync(DIRECTORY, { recursive: true });
  const filename = crypto.randomUUID() + '.' + kind[0];
  const file = path.join(DIRECTORY, filename);
  fs.writeFileSync(file, buffer, { flag: 'wx' });
  try {
    db.prepare('INSERT INTO music_library (title, artist, genre, filename, mime, authorized_by) VALUES (?, ?, ?, ?, ?, ?)').run(details.title, details.artist, details.genre, filename, kind[1], req.admin.id);
  } catch (error) { fs.unlinkSync(file); throw error; }
  res.status(201).json({ success: true });
}
function update(req, res) {
  const data = metadata(req.body.title, req.body.artist, req.body.genre);
  if (!data) return res.status(400).send('Dados inválidos. Volte à biblioteca e confira os campos.');
  const result = db.prepare('UPDATE music_library SET title = ?, artist = ?, genre = ?, active = ? WHERE id = ?').run(data.title, data.artist, data.genre, req.body.active === '1' ? 1 : 0, Number(req.params.id));
  if (!result.changes) return res.sendStatus(404);
  res.redirect('/admin/music?saved=1');
}
module.exports = { catalog, publishedTrack, media, proxy, page, upload, update };
