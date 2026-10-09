const fs = require('fs');
const os = require('os');
const path = require('path');
const dotenv = require('dotenv');

const EMAIL_CONFIG_KEYS = Object.freeze([
  'APP_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM'
]);

function isLocalEnvironment() {
  return process.env.NODE_ENV !== 'production';
}

function getLocalConfigDirectory() {
  if (!isLocalEnvironment()) return null;
  if (process.env.ELLA_LOCAL_CONFIG_DIR) return path.resolve(process.env.ELLA_LOCAL_CONFIG_DIR);
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'EllaSorriu');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'EllaSorriu');
}

function getLocalConfigPath() {
  const directory = getLocalConfigDirectory();
  return directory ? path.join(directory, 'config.env') : null;
}

function pickEmailConfig(source = {}) {
  return Object.fromEntries(EMAIL_CONFIG_KEYS.map((key) => [key, String(source[key] || '')]));
}

function readLocalEmailConfig() {
  const configPath = getLocalConfigPath();
  if (!configPath || !fs.existsSync(configPath)) return {};
  return pickEmailConfig(dotenv.parse(fs.readFileSync(configPath)));
}

function encodeEnvValue(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`;
}

function writeLocalEmailConfig(config) {
  if (!isLocalEnvironment()) {
    const error = new Error('Configuração local indisponível em produção.');
    error.code = 'LOCAL_CONFIG_DISABLED';
    throw error;
  }
  const configPath = getLocalConfigPath();
  const directory = path.dirname(configPath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const normalized = pickEmailConfig(config);
  const content = EMAIL_CONFIG_KEYS.map((key) => `${key}=${encodeEnvValue(normalized[key])}`).join('\n') + '\n';
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, content, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, configPath);
  if (process.platform !== 'win32') {
    fs.chmodSync(directory, 0o700);
    fs.chmodSync(configPath, 0o600);
  }
  return normalized;
}

function applyEmailConfig(config, protectedKeys = new Set()) {
  EMAIL_CONFIG_KEYS.forEach((key) => {
    if (!protectedKeys.has(key) && String(config[key] || '').trim()) process.env[key] = String(config[key]);
  });
}

function migrateBackendEmailConfig(backendConfig, protectedKeys = new Set()) {
  if (!isLocalEnvironment() || !backendConfig || !Object.keys(backendConfig).length) return false;
  const configPath = getLocalConfigPath();
  if (fs.existsSync(configPath)) return false;
  const candidate = pickEmailConfig(backendConfig);
  if (!candidate.SMTP_HOST || !candidate.SMTP_PASS) return false;
  if (!candidate.APP_URL) candidate.APP_URL = `http://127.0.0.1:${process.env.PORT || 3000}`;
  const saved = writeLocalEmailConfig(candidate);
  applyEmailConfig(saved, protectedKeys);
  return true;
}

module.exports = {
  EMAIL_CONFIG_KEYS,
  getLocalConfigPath,
  readLocalEmailConfig,
  writeLocalEmailConfig,
  applyEmailConfig,
  migrateBackendEmailConfig,
  isLocalEnvironment,
  pickEmailConfig
};
