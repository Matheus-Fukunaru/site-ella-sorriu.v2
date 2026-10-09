const QRCode = require('qrcode');

const HEART = 'M200 354 C178 335 46 246 46 154 C46 94 83 58 128 58 C160 58 187 75 200 101 C213 75 240 58 272 58 C317 58 354 94 354 154 C354 246 222 335 200 354 Z';
const TICKET = 'M48 35H352V145C326 145 326 195 352 195V365H48V195C74 195 74 145 48 145Z';

function frameFor(style) {
  if (style === 'heart') return `<rect x="22" y="22" width="356" height="356" rx="18" fill="#0d090d"/><path d="${HEART}" fill="#f04d5f" stroke="#ff9ca5" stroke-width="3"/>`;
  if (style === 'circle') return '<circle cx="200" cy="200" r="175" fill="#fff" stroke="#315f55" stroke-width="4"/>';
  if (style === 'flower') return '<path d="M200 18c25 0 35 34 56 20s48 4 42 31 25 37 7 57 9 50-16 64 0 45-27 50 3 49-26 51-20 40-48 28-42 23-54-1-47 6-48-24-34-30-22-55-26-39-7-58-7-45 22-61-3-44 25-53 10-48 42-57 25-20 48-20Z" fill="#fff" stroke="#805379" stroke-width="4"/>';
  if (style === 'ticket') return `<path d="${TICKET}" fill="#fffaf5" stroke="#a2544c" stroke-width="4" stroke-dasharray="9 6"/>`;
  if (style === 'classic') return '';
  if (style === 'dotted') return '<rect x="24" y="24" width="352" height="352" rx="54" fill="#fff" stroke="#346b55" stroke-width="4"/>';
  return '<rect x="24" y="24" width="352" height="352" rx="72" fill="#fffaf5" stroke="#75447e" stroke-width="4"/>';
}

function giftQrSvg(url, style = 'heart') {
  const matrix = QRCode.create(url, { errorCorrectionLevel: 'H' }).modules;
  const size = matrix.size;
  const qrSize = style === 'heart' ? 200 : 210;
  const qrOffsetX = style === 'heart' ? 100 : 95;
  const qrOffsetY = style === 'heart' ? 86 : 95;
  const cell = qrSize / size;
  const colors = { heart: '#120b0f', rounded: '#75447e', classic: '#171717', dotted: '#346b55', circle: '#315f55', flower: '#805379', ticket: '#a2544c' };
  const color = colors[style] || colors.heart;
  const rounded = style === 'rounded' || style === 'dotted' || style === 'flower';
  const pieces = [
    frameFor(style)
  ];
  if (style !== 'heart' && style !== 'classic') {
    // A conventional quiet zone protects reliable scanning even on decorative frames.
    pieces.push('<rect x="76" y="76" width="248" height="248" rx="8" fill="#fff"/>');
  }
  if (style === 'heart') {
    // Reference treatment: a coral heart with a fine dotted texture, vertical
    // ribbon and small bow. The dots stay below the QR modules so contrast and
    // scanning remain unchanged.
    pieces.push('<g clip-path="url(#heart-crop)"><g fill="#ff9a9f" opacity=".48">');
    for (let y = 58; y < 372; y += 9) for (let x = 36; x < 366; x += 9) {
      pieces.push(`<circle cx="${x + 4}" cy="${y + 4}" r="2.05"/>`);
    }
    pieces.push('</g><path d="M92 20H123V354H92Z" fill="#df3048" opacity=".96"/><path d="M92 20H123V354H92Z" fill="#f45a68" opacity=".16"/></g>');
    // Two folded loops and the knot sit above the QR quiet area.
    pieces.push('<path d="M197 45C174 29 154 27 149 38C145 48 160 59 187 63L201 54Z" fill="#ffd7d8" stroke="#fff0ed" stroke-width="2"/><path d="M203 54L218 47C244 34 260 34 264 44C267 54 246 63 216 67Z" fill="#ffb5b8" stroke="#fff0ed" stroke-width="2"/><path d="M194 51L205 51L213 62L202 73L190 62Z" fill="#fff1ec" stroke="#e73c51" stroke-width="2"/><path d="M190 62L171 80L194 70Z" fill="#e43b50" stroke="#ff9ca5" stroke-width="1.5"/><path d="M211 62L230 79L208 70Z" fill="#e43b50" stroke="#ff9ca5" stroke-width="1.5"/>');
  }
  if (style === 'heart') pieces.push('<g clip-path="url(#heart-crop)">');
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!matrix.get(x, y)) continue;
      const finder = (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
      const radius = finder ? 0 : rounded ? cell * .36 : 0;
      pieces.push(`<rect x="${(qrOffsetX + x * cell).toFixed(2)}" y="${(qrOffsetY + y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${radius.toFixed(2)}" fill="${color}"/>`);
    }
  }
  if (style === 'heart') pieces.push('</g>');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="QR Code Ella Sorriu"><defs><clipPath id="heart-crop"><path d="${HEART}"/></clipPath></defs>${pieces.join('')}</svg>`;
}

module.exports = { giftQrSvg };
