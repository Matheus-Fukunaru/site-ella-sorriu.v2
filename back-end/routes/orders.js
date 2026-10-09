const express = require('express');
const { body } = require('express-validator');
const { createOrderHandler } = require('../controllers/ordersController');
const { orderLimiter } = require('../middleware/rateLimiters');
const { VALID_CESTAS, VALID_OCASIOES } = require('../config/constants');
const { publicOrderSettings } = require('../models/settingsModel');
const { getPublishedProductByName } = require('../models/productsModel');

const router = express.Router();

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function minimumOrderDate() {
  const parts = todayInSaoPaulo().split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  date.setUTCDate(date.getUTCDate() + publicOrderSettings().minimumLeadDays);
  return date.toISOString().slice(0, 10);
}

// Aceita telefones brasileiros com ou sem parênteses/traço/DDI, ex.:
// "11940346224", "(11) 94034-6224", "+55 11 94034-6224"
const phoneRegex = /^(\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;

router.post(
  '/',
  orderLimiter,
  [
    body('nome')
      .trim()
      .isLength({ min: 2, max: 120 })
      .withMessage('Informe um nome válido.'),
    body('whatsapp')
      .trim()
      .matches(phoneRegex)
      .withMessage('Informe um WhatsApp válido, com DDD.'),
    body('email')
      .optional({ checkFalsy: true })
      .trim()
      .isEmail()
      .withMessage('Informe um e-mail válido.')
      .isLength({ max: 160 })
      .normalizeEmail(),
    body('cesta')
      .trim()
      .custom((value) => VALID_CESTAS.includes(value) || Boolean(getPublishedProductByName(value)))
      .withMessage('Selecione uma cesta válida.'),
    body('destinatario')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 120 }),
    body('ocasiao')
      .trim()
      .isIn(VALID_OCASIOES)
      .withMessage('Selecione uma ocasião válida.'),
    body('mensagem')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 600 }),
    body('preferencias')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 600 }),
    body('observacoes')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 600 }),
    body('cidade')
      .trim()
      .isLength({ min: 2, max: 120 })
      .withMessage('Informe a cidade.'),
    body('bairro')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 120 }),
    body('data_desejada')
      .optional({ checkFalsy: true })
      .isISO8601({ strict: true })
      .withMessage('Informe uma data válida.')
      .bail()
      .custom((value) => {
        if (value < minimumOrderDate()) {
          throw new Error('Escolha uma data que respeite a antecedência mínima.');
        }
        return true;
      }),
    // Qualquer outro campo enviado (ex.: tentativa de mandar "status" ou
    // "id" junto) é simplesmente ignorado: só lemos do req.body os campos
    // explicitamente listados aqui e no controller — isso evita mass
    // assignment (o cliente não consegue definir campos que não deveria).
    body('_honey').optional().isString()
  ],
  createOrderHandler
);

module.exports = router;
