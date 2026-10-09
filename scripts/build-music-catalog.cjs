const fs = require('fs');
const path = require('path');

const sources = [
  ['Romântico', 'https://mixkit.co/free-stock-music/mood/romantic/'],
  ['Romântico', 'https://mixkit.co/free-stock-music/mood/love/'],
  ['Pop', 'https://mixkit.co/free-stock-music/pop/'],
  ['Funk', 'https://mixkit.co/free-stock-music/funk/'],
  ['Funk', 'https://mixkit.co/free-stock-music/hip-hop/']
];
const tracks = [];
const seen = new Set();
const re = /"name":"([^"]+)"[\s\S]*?"byArtist":"([^"]+)"[\s\S]*?"url":"(https:\/\/assets\.mixkit\.co\/music\/\d+\/\d+\.mp3)"/g;
for (const [genre, url] of sources) {
  const html = require('child_process').execFileSync(process.platform === 'win32' ? 'powershell.exe' : 'curl', process.platform === 'win32' ? ['-NoProfile','-Command',`(Invoke-WebRequest -UseBasicParsing '${url}').Content`] : ['-Ls', url], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  let match;
  while ((match = re.exec(html))) {
    const audioUrl = match[3].replace(/\\\//g, '/');
    if (seen.has(audioUrl)) continue;
    seen.add(audioUrl);
    tracks.push({ id: `mixkit-${tracks.length + 1}`, title: match[1], artist: match[2], genre, url: audioUrl });
  }
}
const out = path.join(__dirname, '..', 'back-end', 'data', 'music-catalog.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ license: 'Mixkit Free Music License', source: 'https://mixkit.co/license/#musicFree', tracks }, null, 2));
console.log(`Catálogo gerado: ${tracks.length} faixas reais.`);
