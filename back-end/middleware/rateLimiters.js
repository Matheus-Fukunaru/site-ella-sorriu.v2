const rateLimit = require('express-rate-limit');

// Limita quantos pedidos um mesmo IP pode enviar por hora. Isso não impede
// spam sozinho (ver honeypot no controller), mas contém abuso automatizado
// e picos de tráfego mal-intencionado.
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas tentativas em pouco tempo. Tente novamente mais tarde.' }
});

// Limita tentativas de login para dificultar força bruta de senha.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).render('login', {
      error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
      querySuccess: null,
      csrfToken: res.locals.loginCsrfToken || ''
    });
  }
});

// Limite geral, leve, para qualquer rota sob /api como camada extra.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas requisições. Tente novamente em instantes.' }
});

const authFlowLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).send('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  }
});

module.exports = { orderLimiter, loginLimiter, apiLimiter, authFlowLimiter };
