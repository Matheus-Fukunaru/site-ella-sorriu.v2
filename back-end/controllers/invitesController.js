const bcrypt = require('bcryptjs');
const { getAdminByEmail } = require('../models/adminsModel');
const { createInvite, getValidInvite, acceptInvite } = require('../models/adminInvitesModel');
const { recordAudit } = require('../models/auditLogModel');
const { issuePublicCsrf } = require('../middleware/auth');
const { getPublicBaseUrl } = require('../config/env');
const { sendAccessInvite } = require('../utils/mailer');
const { ROLE_LABELS } = require('../config/constants');
const { generateOpaqueToken, hashOpaqueToken, isValidEmail, passwordError } = require('../utils/security');

async function createInviteForRole(req, res, next, allowedRoles, fallbackView) {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = String(req.body.role || '');
    let error = null;
    if (name.length < 2 || name.length > 120) error = 'Informe um nome válido.';
    else if (!isValidEmail(email)) error = 'Informe um e-mail válido.';
    else if (!allowedRoles.includes(role)) error = 'Selecione uma função permitida.';
    else if (getAdminByEmail(email)) error = 'Este e-mail já possui acesso ao painel.';
    if (error) {
      return res.status(400).render(fallbackView, {
        error,
        admin: req.admin,
        csrfToken: req.cookies.csrf_token,
        roleLabels: ROLE_LABELS
      });
    }

    const token = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(token);
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    createInvite({ name, email, role, tokenHash, invitedBy: req.admin.id, expiresAt });
    const inviteUrl = `${getPublicBaseUrl()}/admin/invite/${token}`;
    let emailSent = false;
    if (process.env.SMTP_HOST) {
      try {
        await sendAccessInvite({ name, email, roleLabel: ROLE_LABELS[role], inviteUrl });
        emailSent = true;
      } catch (mailError) {
        console.error('[e-mail] falha ao enviar convite:', mailError.message);
      }
    }
    recordAudit({
      actorAdminId: req.admin.id,
      action: 'admin_invited',
      targetType: 'email',
      targetId: email,
      details: `role=${role}`
    });
    res.render('invite-created', {
      admin: req.admin,
      csrfToken: req.cookies.csrf_token,
      inviteUrl,
      email,
      emailSent
    });
  } catch (error) {
    next(error);
  }
}

function createTeamInvite(req, res, next) {
  return createInviteForRole(req, res, next, ['admin', 'attendant'], 'invite-form');
}

function createSupportInvite(req, res, next) {
  req.body.role = 'support';
  return createInviteForRole(req, res, next, ['support'], 'support-invite-form');
}

function acceptInviteForm(req, res) {
  const invite = getValidInvite(hashOpaqueToken(req.params.token));
  if (!invite) return res.status(404).render('token-invalid', { kind: 'convite' });
  res.render('accept-invite', {
    error: null,
    csrfToken: issuePublicCsrf(res),
    token: req.params.token,
    invite,
    roleLabel: ROLE_LABELS[invite.role]
  });
}

async function acceptInviteHandler(req, res, next) {
  try {
    const tokenHash = hashOpaqueToken(req.params.token);
    const invite = getValidInvite(tokenHash);
    if (!invite) return res.status(404).render('token-invalid', { kind: 'convite' });
    const error = passwordError(req.body.password, req.body.password_confirmation);
    if (error) {
      return res.status(400).render('accept-invite', {
        error,
        csrfToken: req.body._csrf,
        token: req.params.token,
        invite,
        roleLabel: ROLE_LABELS[invite.role]
      });
    }
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const result = acceptInvite(tokenHash, passwordHash);
    recordAudit({
      actorAdminId: result.adminId,
      action: 'invite_accepted',
      targetType: 'admin',
      targetId: result.adminId,
      details: `role=${result.invite.role}`
    });
    res.clearCookie('auth_csrf', { path: '/' });
    res.redirect('/admin/login?invite=accepted');
  } catch (error) {
    if (['INVALID_INVITE', 'EMAIL_EXISTS'].includes(error.code)) {
      return res.status(409).render('token-invalid', { kind: 'convite' });
    }
    next(error);
  }
}

module.exports = {
  createTeamInvite,
  createSupportInvite,
  acceptInviteForm,
  acceptInviteHandler
};
