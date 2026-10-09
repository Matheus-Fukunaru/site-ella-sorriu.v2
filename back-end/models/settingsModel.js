const db = require('../config/db');

const DEFAULTS = Object.freeze({
  company_name: 'Ella Sorriu',
  company_whatsapp: '5511940346224',
  contact_email: '',
  email_sender_name: 'Ella Sorriu',
  whatsapp_message: 'Olá! Acabei de enviar um pedido pelo site da Ella Sorriu 🌷\n\nNome: {nome}\nPresente: {produto}\nData desejada: {data}\nCidade: {cidade}\n\nGostaria de continuar o atendimento por aqui.',
  allow_same_day: 'true',
  min_lead_days: '0',
  order_success_message: 'Pedido enviado com sucesso! Entraremos em contato em breve.',
  auto_open_whatsapp: 'true',
  notify_new_order: ''
});

const ALLOWED_KEYS = new Set(Object.keys(DEFAULTS));

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM app_settings').all();
  const saved = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const settings = { ...DEFAULTS, ...saved };
  if (!settings.notify_new_order) settings.notify_new_order = process.env.ADMIN_EMAIL ? 'true' : 'false';
  return settings;
}

function saveSettings(values, adminId) {
  const entries = Object.entries(values).filter(([key]) => ALLOWED_KEYS.has(key));
  const statement = db.prepare(`
    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_by = excluded.updated_by,
      updated_at = unixepoch()
  `);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const [key, value] of entries) statement.run(key, String(value), adminId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function publicOrderSettings() {
  const settings = getAllSettings();
  const leadDays = Math.max(Number(settings.min_lead_days) || 0, settings.allow_same_day === 'true' ? 0 : 1);
  return {
    companyName: settings.company_name,
    whatsappNumber: settings.company_whatsapp,
    minimumLeadDays: leadDays,
    successMessage: settings.order_success_message,
    autoOpenWhatsapp: settings.auto_open_whatsapp === 'true'
  };
}

module.exports = { DEFAULTS, getAllSettings, saveSettings, publicOrderSettings };
