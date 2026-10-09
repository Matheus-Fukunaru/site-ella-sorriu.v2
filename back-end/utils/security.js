const crypto = require('crypto');

function generateOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashOpaqueToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function isValidEmail(email) {
  return typeof email === 'string' &&
    email.length <= 160 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function passwordError(password, confirmation) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    return 'A senha precisa ter pelo menos 12 caracteres e no máximo 72 bytes.';
  }
  if (password !== confirmation) return 'As senhas não coincidem.';
  return null;
}

function safeSecretMatch(first, second) {
  const firstBuffer = Buffer.from(String(first || ''));
  const secondBuffer = Buffer.from(String(second || ''));
  return firstBuffer.length > 0 &&
    firstBuffer.length === secondBuffer.length &&
    crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

module.exports = {
  generateOpaqueToken,
  hashOpaqueToken,
  isValidEmail,
  passwordError,
  safeSecretMatch
};
