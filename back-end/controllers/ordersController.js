const { validationResult } = require('express-validator');
const { createOrder } = require('../models/ordersModel');
const { getAllSettings, publicOrderSettings } = require('../models/settingsModel');

function orderWhatsappUrl(order, settings) {
  const date = order.data_desejada ? order.data_desejada.split('-').reverse().join('/') : 'A combinar';
  const replacements = { nome: order.nome, produto: order.cesta, data: date, cidade: order.cidade };
  const message = settings.whatsapp_message.replace(/\{(nome|produto|data|cidade)\}/g, (_, key) => replacements[key]);
  return `https://wa.me/${settings.company_whatsapp}?text=${encodeURIComponent(message)}`;
}

async function createOrderHandler(req, res, next) {
  try {
    // Honeypot: campo "_honey" é invisível para humanos (escondido via CSS
    // no frontend), mas bots costumam preenchê-lo. Se vier preenchido,
    // fingimos sucesso sem gravar nada e sem revelar que foi bloqueado —
    // avisar o bot só ensinaria ele a remover o campo da próxima vez.
    if (req.body._honey) {
      return res.status(201).json({
        success: true,
        message: 'Pedido enviado com sucesso! Entraremos em contato em breve.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Confira os campos destacados e tente novamente.',
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg }))
      });
    }

    const payload = {
      nome: req.body.nome,
      whatsapp: req.body.whatsapp,
      email: req.body.email || null,
      cesta: req.body.cesta,
      destinatario: req.body.destinatario || null,
      ocasiao: req.body.ocasiao,
      mensagem: req.body.mensagem || null,
      preferencias: req.body.preferencias || null,
      observacoes: req.body.observacoes || null,
      cidade: req.body.cidade,
      bairro: req.body.bairro || null,
      data_desejada: req.body.data_desejada || null,
      periodo_desejado: null
    };

    const id = createOrder(payload);

    // Notificação por e-mail é best-effort: se falhar, o pedido já foi
    // salvo e a pessoa já recebeu a confirmação — só registramos o erro.
    const settings = getAllSettings();
    const notificationEmail = settings.contact_email || process.env.ADMIN_EMAIL;
    if (settings.notify_new_order === 'true' && notificationEmail && process.env.SMTP_HOST) {
      const { notifyAdminOfNewOrder } = require('../utils/mailer');
      notifyAdminOfNewOrder(payload, id, notificationEmail).catch((err) => {
        const code = String(err.code || 'SMTP_ERROR').replace(/[^A-Z0-9_-]/gi, '').slice(0, 40);
        console.error(`[e-mail] falha ao notificar novo pedido (${code || 'SMTP_ERROR'}).`);
      });
    }

    const publicSettings = publicOrderSettings();
    res.status(201).json({
      success: true,
      message: publicSettings.successMessage,
      // Explicit continuation link; the browser never opens it automatically.
      whatsappUrl: orderWhatsappUrl(payload, settings)
    });
  } catch (err) {
    next(err);
  }
}

function publicSettings(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json(publicOrderSettings());
}

module.exports = { createOrderHandler, publicSettings };
