const { getPublicBaseUrl, getProtectedEmailKeys } = require('../config/env');
const {
  readLocalEmailConfig,
  writeLocalEmailConfig,
  applyEmailConfig,
  isLocalEnvironment
} = require('../config/localEmailConfig');
const { verifySmtp, sendTestEmail } = require('../utils/mailer');
const { isValidEmail } = require('../utils/security');

function safeErrorCode(error) {
  return String(error && error.code || 'SMTP_ERROR').replace(/[^A-Z0-9_-]/gi, '').slice(0, 40) || 'SMTP_ERROR';
}

function friendlySmtpError(error) {
  const code = safeErrorCode(error);
  if (code === 'EAUTH') return 'Não foi possível autenticar. Verifique o e-mail e a senha de app.';
  if (['ECONNECTION', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'EDNS'].includes(code)) {
    return 'Não foi possível conectar ao servidor de e-mail.';
  }
  if (code === 'SMTP_REJECTED' || code === 'SMTP_NOT_ACCEPTED') {
    return 'O servidor de e-mail não aceitou o endereço de destino.';
  }
  return 'Não foi possível autenticar no servidor de e-mail.';
}

function parseSender(value) {
  const match = String(value || '').match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  return match ? { name: match[1].replace(/^"|"$/g, ''), email: match[2].trim() } : { name: 'Ella Sorriu', email: '' };
}

function currentSafeValues() {
  const sender = parseSender(process.env.SMTP_FROM);
  return {
    senderEmail: sender.email || String(process.env.SMTP_USER || ''),
    senderName: sender.name || 'Ella Sorriu',
    host: String(process.env.SMTP_HOST || ''),
    port: String(process.env.SMTP_PORT || '465'),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    user: String(process.env.SMTP_USER || ''),
    passwordConfigured: Boolean(process.env.SMTP_PASS)
  };
}

function renderPage(req, res, options = {}) {
  return res.status(options.status || 200).render('email-settings', {
    admin: req.admin,
    csrfToken: req.cookies.csrf_token,
    values: options.values || currentSafeValues(),
    error: options.error || null,
    success: options.success || null
  });
}

function ensureLocal(req, res) {
  if (isLocalEnvironment()) return true;
  res.status(404).send('Página não encontrada.');
  return false;
}

function emailSettingsPage(req, res) {
  if (!ensureLocal(req, res)) return;
  renderPage(req, res, { success: req.query.saved === '1' ? 'Configuração de e-mail salva com segurança.' : null });
}

function normalizeForm(body) {
  const host = String(body.smtp_host || '').trim().toLowerCase();
  const rawPassword = String(body.smtp_pass || '');
  return {
    senderEmail: String(body.sender_email || '').trim().toLowerCase(),
    senderName: String(body.sender_name || '').trim(),
    host,
    port: String(body.smtp_port || '').trim(),
    secure: String(body.smtp_secure || '') === 'true',
    user: String(body.smtp_user || '').trim(),
    password: host === 'smtp.gmail.com' ? rawPassword.replace(/\s+/g, '') : rawPassword
  };
}

function validate(values) {
  if (!isValidEmail(values.senderEmail)) return 'Informe um e-mail remetente válido.';
  if (!values.senderName || values.senderName.length > 100 || /[\r\n]/.test(values.senderName)) return 'Informe um nome de remetente válido.';
  if (!values.host || values.host.length > 253 || !/^[a-z0-9.-]+$/i.test(values.host)) return 'Informe um servidor SMTP válido.';
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return 'Informe uma porta SMTP válida.';
  if (!values.user || values.user.length > 254 || /[\r\n]/.test(values.user)) return 'Informe o usuário SMTP.';
  if (values.password.length > 512 || /[\r\n]/.test(values.password)) return 'A senha de app é inválida.';
  if (!values.password && !process.env.SMTP_PASS) return 'Informe a senha de app.';
  return null;
}

function configFromValues(values) {
  const previous = readLocalEmailConfig();
  return {
    APP_URL: previous.APP_URL || getPublicBaseUrl(),
    SMTP_HOST: values.host,
    SMTP_PORT: values.port,
    SMTP_SECURE: String(values.secure),
    SMTP_USER: values.user,
    SMTP_PASS: values.password || process.env.SMTP_PASS,
    SMTP_FROM: `${values.senderName} <${values.senderEmail}>`
  };
}

function persist(config) {
  const saved = writeLocalEmailConfig(config);
  applyEmailConfig(saved, getProtectedEmailKeys());
}

function safeValuesFromForm(values) {
  return { ...values, password: undefined, passwordConfigured: Boolean(values.password || process.env.SMTP_PASS) };
}

async function handle(req, res, shouldTest) {
  if (!ensureLocal(req, res)) return;
  const values = normalizeForm(req.body);
  const error = validate(values);
  if (error) return renderPage(req, res, { status: 400, values: safeValuesFromForm(values), error });
  try {
    const config = configFromValues(values);
    if (shouldTest) {
      await verifySmtp(config);
      await sendTestEmail(req.admin.email, config);
      persist(config);
      return renderPage(req, res, { values: currentSafeValues(), success: 'E-mail de teste enviado com sucesso.' });
    }
    persist(config);
    return res.redirect('/admin/settings/email?saved=1');
  } catch (smtpError) {
    console.error(`[e-mail] falha no teste SMTP (${safeErrorCode(smtpError)}).`);
    return renderPage(req, res, {
      status: 400,
      values: currentSafeValues(),
      error: friendlySmtpError(smtpError)
    });
  }
}

function saveEmailSettings(req, res) { return handle(req, res, false); }
function testEmailSettings(req, res) { return handle(req, res, true); }

async function testExistingEmailSettings(req, res) {
  try {
    await verifySmtp();
    await sendTestEmail(req.admin.email);
    res.redirect('/admin/settings?emailTest=ok');
  } catch (error) {
    console.error(`[e-mail] falha no teste SMTP (${safeErrorCode(error)}).`);
    res.redirect('/admin/settings?emailTest=failed');
  }
}

module.exports = { emailSettingsPage, saveEmailSettings, testEmailSettings, testExistingEmailSettings };
