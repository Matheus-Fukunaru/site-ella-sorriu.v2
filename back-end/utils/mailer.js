const nodemailer = require('nodemailer');
const { getAllSettings } = require('../models/settingsModel');

function configuredFrom(config = process.env) {
  const settings = getAllSettings();
  const configured = String(config.SMTP_FROM || config.SMTP_USER || '');
  const match = configured.match(/<([^<>]+)>/);
  const address = match ? match[1] : configured;
  return address ? `${settings.email_sender_name} <${address}>` : configured;
}

// Notificação por e-mail é opcional: se SMTP_HOST/ADMIN_EMAIL não
// estiverem configurados no .env, esta função simplesmente não é chamada
// (ver ordersController.js). Nenhuma credencial de e-mail fica no
// frontend — tudo vem de variáveis de ambiente lidas só no servidor.
function normalizedPassword(config) {
  const password = String(config.SMTP_PASS || '');
  return String(config.SMTP_HOST || '').trim().toLowerCase() === 'smtp.gmail.com'
    ? password.replace(/\s+/g, '')
    : password;
}

function createTransporter(config = process.env) {
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: Number(config.SMTP_PORT || 587),
    secure: String(config.SMTP_SECURE) === 'true',
    requireTLS: process.env.NODE_ENV === 'production' && String(config.SMTP_SECURE) !== 'true',
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    auth: config.SMTP_USER
      ? { user: config.SMTP_USER, pass: normalizedPassword(config) }
      : undefined
  });
}

function isSmtpConfigured(config = process.env) {
  const host = String(config.SMTP_HOST || '').trim();
  const from = String(config.SMTP_FROM || config.SMTP_USER || '').trim();
  const user = String(config.SMTP_USER || '').trim();
  const pass = normalizedPassword(config);
  return Boolean(host && from && (!user || pass));
}

function ensureRecipientAccepted(info, email) {
  const accepted = Array.isArray(info && info.accepted) ? info.accepted.map(String) : [];
  const rejected = Array.isArray(info && info.rejected) ? info.rejected.map(String) : [];
  if (!accepted.some((value) => value.toLowerCase() === String(email).toLowerCase())) {
    const error = new Error('O servidor de e-mail não aceitou o destinatário.');
    error.code = rejected.length ? 'SMTP_REJECTED' : 'SMTP_NOT_ACCEPTED';
    throw error;
  }
  return { acceptedCount: accepted.length, rejectedCount: rejected.length, messageId: Boolean(info.messageId) };
}

async function verifySmtp(config = process.env) {
  if (!isSmtpConfigured(config)) {
    const error = new Error('Configuração SMTP incompleta.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  const transporter = createTransporter(config);
  await transporter.verify();
  return true;
}

async function sendTestEmail(email, config = process.env) {
  const transporter = createTransporter(config);
  const info = await transporter.sendMail({
    from: configuredFrom(config),
    to: email,
    subject: 'Teste de e-mail — Ella Sorriu',
    text: 'O envio de e-mail da Ella Sorriu está funcionando.'
  });
  return ensureRecipientAccepted(info, email);
}

async function notifyAdminOfNewOrder(order, id, recipient = process.env.ADMIN_EMAIL) {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: configuredFrom(),
    to: recipient,
    subject: `Novo pedido #${id} - Ella Sorriu`,
    text: [
      'Novo pedido recebido no site.',
      '',
      `Nome: ${order.nome}`,
      `WhatsApp: ${order.whatsapp}`,
      `Cesta: ${order.cesta}`,
      `Ocasião: ${order.ocasiao}`,
      `Cidade: ${order.cidade}`,
      '',
      'Acesse o painel administrativo para ver todos os detalhes e responder pelo WhatsApp.'
    ].join('\n')
  });
}

async function sendAccessInvite({ name, email, roleLabel, inviteUrl }) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: configuredFrom(),
    to: email,
    subject: 'Seu acesso ao painel Ella Sorriu',
    text: [
      `Olá, ${name}!`,
      '',
      `Você foi convidado para acessar o painel Ella Sorriu como ${roleLabel}.`,
      'O link abaixo é de uso único e expira em 24 horas:',
      '',
      inviteUrl,
      '',
      'Se você não esperava este convite, ignore esta mensagem.'
    ].join('\n')
  });
}

async function sendPasswordReset({ name, email, resetUrl }) {
  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: configuredFrom(),
    to: email,
    subject: 'Redefinição de senha — Ella Sorriu',
    text: [
      `Olá, ${name}.`,
      '',
      'Recebemos uma solicitação para redefinir sua senha de acesso à Ella Sorriu.',
      '',
      resetUrl,
      '',
      'Este link é válido por 1 hora e pode ser utilizado apenas uma vez.',
      '',
      'Se você não solicitou essa alteração, ignore este e-mail.',
      '',
      'Ella Sorriu'
    ].join('\n'),
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f1ed;color:#332626;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:40px 24px"><div style="background:#fffaf7;border:1px solid #ead9d2;border-radius:18px;padding:32px"><p style="margin:0 0 22px;color:#7f203b;font-family:Georgia,serif;font-size:28px">Ella Sorriu</p><p>Olá, ${escapeHtml(name)}.</p><p style="line-height:1.6">Recebemos uma solicitação para redefinir sua senha de acesso à Ella Sorriu.</p><p style="margin:28px 0"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:13px 20px;border-radius:999px;background:#7f203b;color:#fff;text-decoration:none;font-weight:700">Redefinir minha senha</a></p><p style="line-height:1.6">Se o botão não funcionar, copie e cole este endereço no navegador:</p><p style="overflow-wrap:anywhere;font-size:13px"><a href="${escapeHtml(resetUrl)}" style="color:#7f203b">${escapeHtml(resetUrl)}</a></p><p style="line-height:1.6">Este link é válido por 1 hora e pode ser utilizado apenas uma vez.</p><p style="line-height:1.6;color:#716463">Se você não solicitou essa alteração, ignore este e-mail.</p><p style="margin:26px 0 0;font-family:Georgia,serif;color:#7f203b">Ella Sorriu</p></div></div></body></html>`
  });
  return ensureRecipientAccepted(info, email);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

module.exports = {
  notifyAdminOfNewOrder,
  sendAccessInvite,
  sendPasswordReset,
  sendTestEmail,
  verifySmtp,
  isSmtpConfigured
};
