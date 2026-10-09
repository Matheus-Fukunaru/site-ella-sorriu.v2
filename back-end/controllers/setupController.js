const bcrypt = require('bcryptjs');
const { countOwners, createInitialOwner } = require('../models/adminsModel');
const { recordAudit } = require('../models/auditLogModel');
const { issuePublicCsrf } = require('../middleware/auth');
const { isValidEmail, passwordError, safeSecretMatch } = require('../utils/security');
const { ensureInstallationToken } = require('../config/env');

function validSetupToken(token) {
  return safeSecretMatch(token, process.env.INSTALL_TOKEN);
}

function isLoopbackRequest(req) {
  const address = String(req.socket && req.socket.remoteAddress || '');
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function localStart(req, res) {
  if (process.env.NODE_ENV === 'production' || !isLoopbackRequest(req)) {
    return res.status(404).send('Página não encontrada.');
  }
  if (countOwners() > 0) return res.redirect('/admin/login');
  const token = ensureInstallationToken();
  return res.redirect(`/admin/setup/${encodeURIComponent(token)}`);
}

function setupForm(req, res) {
  if (countOwners() > 0 || !validSetupToken(req.params.token)) {
    return res.status(404).send('Configuração inicial indisponível.');
  }
  res.render('setup', { error: null, csrfToken: issuePublicCsrf(res), token: req.params.token });
}

async function setupOwner(req, res, next) {
  try {
    if (countOwners() > 0 || !validSetupToken(req.params.token)) {
      return res.status(404).send('Configuração inicial indisponível.');
    }
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const error = name.length < 2 || name.length > 120
      ? 'Informe um nome válido.'
      : !isValidEmail(email)
        ? 'Informe um e-mail válido.'
        : passwordError(req.body.password, req.body.password_confirmation);
    if (error) {
      return res.status(400).render('setup', {
        error,
        csrfToken: req.body._csrf,
        token: req.params.token
      });
    }
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const ownerId = createInitialOwner({ name, email, passwordHash });
    recordAudit({ actorAdminId: ownerId, action: 'setup_owner_created', targetType: 'admin', targetId: ownerId });
    res.clearCookie('auth_csrf', { path: '/' });
    res.redirect('/admin/login?setup=complete');
  } catch (error) {
    if (error.code === 'SETUP_COMPLETE') return res.status(409).send(error.message);
    next(error);
  }
}

module.exports = { localStart, setupForm, setupOwner };
