const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getAdminByEmail, updateLastLogin } = require('../models/adminsModel');
const { createAdminSession, revokeAdminSession } = require('../models/adminSessionsModel');
const {
  issuePublicCsrf,
  isAdminAccessAllowed,
  clearAdminCookies,
  cookieSecurityOptions
} = require('../middleware/auth');

// Hash bcrypt válido, porém de uma senha que nunca é usada de verdade.
// Serve só para que bcrypt.compare() sempre gaste o mesmo tempo de CPU,
// mesmo quando o e-mail informado não existe — evita um "timing attack"
// simples que revelaria quais e-mails têm conta cadastrada.
const DUMMY_HASH = '$2b$10$fumICA9ejTyeOyd1ld0tbO.euy5rnPO5hQQte/U0.rNs5CU33T11y';

function adminCookieOptions() {
  return {
    ...cookieSecurityOptions(),
    maxAge: 2 * 60 * 60 * 1000
  };
}

function loginForm(req, res) {
  clearAdminCookies(res);
  const querySuccess = req.query.setup === 'complete'
    ? 'Conta de Proprietário criada. Agora você já pode entrar.'
    : req.query.invite === 'accepted'
      ? 'Senha criada. Seu acesso está pronto.'
      : req.query.password === 'updated'
        ? 'Senha atualizada com sucesso.'
        : null;
  res.render('login', { error: null, querySuccess, csrfToken: issuePublicCsrf(res) });
}

async function login(req, res, next) {
  try {
    const genericError = 'E-mail ou senha inválidos.';

    if (typeof req.body.email !== 'string' || typeof req.body.password !== 'string') {
      return res.status(400).render('login', { error: genericError, querySuccess: null, csrfToken: req.body._csrf });
    }

    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password || email.length > 160 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).render('login', { error: genericError, querySuccess: null, csrfToken: req.body._csrf });
    }

    const admin = getAdminByEmail(email);
    const valid = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY_HASH);

    if (!admin || !valid || !isAdminAccessAllowed(admin)) {
      return res.status(401).render('login', { error: genericError, querySuccess: null, csrfToken: req.body._csrf });
    }

    const sessionId = crypto.randomUUID();
    const sessionExpiresAt = Math.floor(Date.now() / 1000) + (2 * 60 * 60);
    const token = jwt.sign(
      { sub: admin.id, email: admin.email },
      process.env.SESSION_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '2h',
        issuer: 'ella-sorriu',
        audience: 'ella-sorriu-admin',
        jwtid: sessionId
      }
    );
    const csrfToken = crypto.randomBytes(24).toString('hex');
    createAdminSession(sessionId, admin.id, sessionExpiresAt);
    updateLastLogin(admin.id);

    res.cookie('admin_token', token, adminCookieOptions());
    res.cookie('csrf_token', csrfToken, adminCookieOptions());
    res.clearCookie('auth_csrf', { path: '/' });

    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  revokeAdminSession(req.admin && req.admin.jti);
  clearAdminCookies(res);
  res.redirect('/admin/login');
}

module.exports = { loginForm, login, logout };
