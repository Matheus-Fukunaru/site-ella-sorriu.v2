const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {
  EMAIL_CONFIG_KEYS,
  readLocalEmailConfig,
  applyEmailConfig,
  migrateBackendEmailConfig
} = require('./localEmailConfig');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const BACKEND_ENV_PATH = path.join(PROJECT_ROOT, 'back-end', '.env');
let protectedEmailKeys = new Set();

function isSessionSecretStrong(value) {
  return typeof value === 'string' &&
    value.length >= 32 &&
    !/(development|change-before-production|cole-aqui|replace-me)/i.test(value);
}

function isInstallationTokenStrong(value) {
  return typeof value === 'string' && value.length >= 32;
}

function writeEnvValue(key, value) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const expression = new RegExp(`^${key}=.*$`, 'm');
  if (expression.test(content)) {
    content = content.replace(expression, `${key}=${value}`);
  } else {
    if (content && !content.endsWith('\n')) content += '\n';
    content += `${key}=${value}\n`;
  }
  fs.writeFileSync(ENV_PATH, content, { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(ENV_PATH, 0o600);
}

function writeDevelopmentEnv(secret) {
  let content = '';

  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  } else {
    content = [
      'PORT=3000',
      'NODE_ENV=development',
      'DATABASE_URL=file:./back-end/data/ella-sorriu.db',
      'SESSION_SECRET=',
      ''
    ].join('\n');
  }

  if (/^SESSION_SECRET=.*$/m.test(content)) {
    content = content.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`);
  } else {
    if (content && !content.endsWith('\n')) content += '\n';
    content += `SESSION_SECRET=${secret}\n`;
  }

  fs.writeFileSync(ENV_PATH, content, { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(ENV_PATH, 0o600);
}

function loadAndValidateEnvironment() {
  const explicitEmailKeys = new Set(EMAIL_CONFIG_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(process.env, key)));
  dotenv.config({ path: ENV_PATH });
  // Compatibilidade com a configuração local já existente em back-end/.env.
  // Ele apenas preenche chaves ausentes/vazias: variáveis reais da hospedagem
  // e valores já definidos na raiz continuam tendo prioridade.
  let backendEnv = {};
  if (fs.existsSync(BACKEND_ENV_PATH)) {
    backendEnv = dotenv.parse(fs.readFileSync(BACKEND_ENV_PATH));
    EMAIL_CONFIG_KEYS.forEach((key) => {
      if (!explicitEmailKeys.has(key) && String(backendEnv[key] || '').trim()) process.env[key] = backendEnv[key];
    });
    if (migrateBackendEmailConfig(backendEnv, explicitEmailKeys) && process.env.ELLA_QUIET_START !== '1') {
      console.warn('[config] Configuração local de e-mail preservada neste computador.');
    }
  }
  const backendEmailKeys = new Set(EMAIL_CONFIG_KEYS.filter((key) => String(backendEnv[key] || '').trim()));
  protectedEmailKeys = new Set([
    ...explicitEmailKeys,
    ...backendEmailKeys
  ]);
  applyEmailConfig(readLocalEmailConfig(), protectedEmailKeys);

  if (isSessionSecretStrong(process.env.SESSION_SECRET)) return;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET ausente ou fraco. Configure uma chave aleatória com pelo menos 32 caracteres.'
    );
  }

  const generatedSecret = crypto.randomBytes(32).toString('hex');
  writeDevelopmentEnv(generatedSecret);
  process.env.SESSION_SECRET = generatedSecret;
  if (process.env.ELLA_QUIET_START !== '1') {
    console.warn('[config] SESSION_SECRET de desenvolvimento criado com segurança no arquivo .env.');
  }
}

function ensureInstallationToken() {
  if (isInstallationTokenStrong(process.env.INSTALL_TOKEN)) return process.env.INSTALL_TOKEN;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Nenhum Proprietário existe. Configure INSTALL_TOKEN com uma chave aleatória de pelo menos 32 caracteres.'
    );
  }
  const token = crypto.randomBytes(32).toString('hex');
  writeEnvValue('INSTALL_TOKEN', token);
  process.env.INSTALL_TOKEN = token;
  if (process.env.ELLA_QUIET_START !== '1') {
    console.warn('[config] Configuração inicial local preparada com segurança.');
  }
  return token;
}

function getPublicBaseUrl() {
  const configured = String(process.env.APP_URL || '').trim();
  if (configured) {
    const parsed = new URL(configured);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('APP_URL inválida.');
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new Error('APP_URL precisa usar HTTPS em produção.');
    }
    return parsed.origin;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Configure APP_URL em produção para gerar convites e recuperações seguros.');
  }
  return `http://127.0.0.1:${process.env.PORT || 3000}`;
}

function getProtectedEmailKeys() {
  return new Set(protectedEmailKeys);
}

module.exports = {
  PROJECT_ROOT,
  ENV_PATH,
  BACKEND_ENV_PATH,
  loadAndValidateEnvironment,
  ensureInstallationToken,
  getPublicBaseUrl,
  getProtectedEmailKeys,
  isSessionSecretStrong,
  isInstallationTokenStrong
};
