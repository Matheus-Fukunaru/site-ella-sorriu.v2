const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { isAdminSessionActive, revokeAdminSession } = require('../models/adminSessionsModel');
const { getAdminById } = require('../models/adminsModel');

function cookieSecurityOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    priority: 'high'
  };
}

function safeTokenMatch(first, second) {
  const firstBuffer = Buffer.from(String(first || ''));
  const secondBuffer = Buffer.from(String(second || ''));
  return firstBuffer.length > 0 &&
    firstBuffer.length === secondBuffer.length &&
    crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function isAdminAccessAllowed(admin) {
  if (!admin || !admin.active) return false;
  if (admin.role !== 'support') return true;
  return Number(admin.support_access_until || 0) > Math.floor(Date.now() / 1000);
}

function clearAdminCookies(res) {
  const options = cookieSecurityOptions();
  res.clearCookie('admin_token', options);
  res.clearCookie('csrf_token', options);
}

function requireAuth(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) return res.redirect('/admin/login');

  try {
    const payload = jwt.verify(token, process.env.SESSION_SECRET, {
      algorithms: ['HS256'],
      issuer: 'ella-sorriu',
      audience: 'ella-sorriu-admin'
    });
    if (!isAdminSessionActive(payload.jti, payload.sub)) {
      throw new Error('Sessão administrativa revogada ou expirada.');
    }
    const admin = getAdminById(Number(payload.sub));
    if (!isAdminAccessAllowed(admin)) {
      revokeAdminSession(payload.jti);
      throw new Error('Acesso administrativo desativado.');
    }
    req.admin = { ...admin, jti: payload.jti };
    next();
  } catch (error) {
    clearAdminCookies(res);
    return res.redirect('/admin/login');
  }
}

function requireRole(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).render('forbidden', { admin: req.admin || null });
    }
    next();
  };
}

function issuePublicCsrf(res) {
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie('auth_csrf', token, { ...cookieSecurityOptions(), maxAge: 20 * 60 * 1000 });
  return token;
}

function verifyPublicCsrf(req, res, next) {
  if (!safeTokenMatch(req.cookies.auth_csrf, req.body._csrf)) {
    return res.status(403).send('Sessão expirada. Atualize a página e tente novamente.');
  }
  res.locals.publicCsrfToken = req.body._csrf;
  next();
}

function verifyLoginCsrf(req, res, next) {
  if (!safeTokenMatch(req.cookies.auth_csrf, req.body._csrf)) {
    return res.status(403).render('login', {
      error: 'Sessão expirada. Atualize a página e tente novamente.',
      querySuccess: null,
      csrfToken: issuePublicCsrf(res)
    });
  }
  res.locals.loginCsrfToken = req.body._csrf;
  next();
}

function verifyCsrf(req, res, next) {
  const submittedToken = (req.body && req.body._csrf) || req.get('x-csrf-token');
  if (!safeTokenMatch(req.cookies.csrf_token, submittedToken)) {
    return res.status(403).send('Sessão expirada ou inválida. Volte para o painel e tente novamente.');
  }
  next();
}

module.exports = {
  requireAuth,
  requireRole,
  verifyCsrf,
  verifyLoginCsrf,
  verifyPublicCsrf,
  issuePublicCsrf,
  isAdminAccessAllowed,
  clearAdminCookies,
  cookieSecurityOptions
};
