const bcrypt = require('bcryptjs');
const { getAdminByEmail } = require('../models/adminsModel');
const { createPasswordReset, getValidPasswordReset, discardPasswordReset, resetPassword } = require('../models/passwordResetsModel');
const { recordAudit } = require('../models/auditLogModel');
const { issuePublicCsrf, isAdminAccessAllowed } = require('../middleware/auth');
const { getPublicBaseUrl } = require('../config/env');
const { sendPasswordReset, isSmtpConfigured } = require('../utils/mailer');
const { generateOpaqueToken, hashOpaqueToken, isValidEmail, passwordError } = require('../utils/security');

function forgotPasswordForm(req, res) {
  res.render('forgot-password', { error: null, sent: false, csrfToken: issuePublicCsrf(res) });
}

async function requestPasswordReset(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).render('forgot-password', {
        error: 'Informe um e-mail válido.',
        sent: false,
        csrfToken: req.body._csrf
      });
    }
    const admin = getAdminByEmail(email);
    if (admin && isAdminAccessAllowed(admin)) {
      const token = generateOpaqueToken();
      const tokenHash = hashOpaqueToken(token);
      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
      createPasswordReset({ adminId: admin.id, tokenHash, expiresAt });
      const resetUrl = `${getPublicBaseUrl()}/admin/reset-password/${token}`;
      if (isSmtpConfigured()) {
        try {
          await sendPasswordReset({ name: admin.name, email: admin.email, resetUrl });
        } catch (mailError) {
          discardPasswordReset(tokenHash);
          const safeCode = String(mailError.code || 'SMTP_ERROR').replace(/[^A-Z0-9_-]/gi, '').slice(0, 40);
          console.error(`[e-mail] falha ao enviar recuperação (${safeCode || 'SMTP_ERROR'}).`);
        }
      } else if (process.env.NODE_ENV !== 'production') {
        console.warn(`[recuperação] Link de teste para ${admin.email}: ${resetUrl}`);
      }
      recordAudit({ actorAdminId: admin.id, action: 'password_reset_requested', targetType: 'admin', targetId: admin.id });
    }
    res.render('forgot-password', {
      error: null,
      sent: true,
      csrfToken: issuePublicCsrf(res)
    });
  } catch (error) {
    next(error);
  }
}

function resetPasswordForm(req, res) {
  const reset = getValidPasswordReset(hashOpaqueToken(req.params.token));
  if (!reset) return res.status(404).render('token-invalid', { kind: 'link de recuperação' });
  res.render('reset-password', {
    error: null,
    csrfToken: issuePublicCsrf(res),
    token: req.params.token
  });
}

async function resetPasswordHandler(req, res, next) {
  try {
    const tokenHash = hashOpaqueToken(req.params.token);
    if (!getValidPasswordReset(tokenHash)) {
      return res.status(404).render('token-invalid', { kind: 'link de recuperação' });
    }
    const error = passwordError(req.body.password, req.body.password_confirmation);
    if (error) {
      return res.status(400).render('reset-password', {
        error,
        csrfToken: req.body._csrf,
        token: req.params.token
      });
    }
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const adminId = resetPassword(tokenHash, passwordHash);
    recordAudit({ actorAdminId: adminId, action: 'password_reset_completed', targetType: 'admin', targetId: adminId });
    res.clearCookie('auth_csrf', { path: '/' });
    res.redirect('/admin/login?password=updated');
  } catch (error) {
    if (error.code === 'INVALID_RESET') return res.status(409).render('token-invalid', { kind: 'link de recuperação' });
    next(error);
  }
}

module.exports = {
  forgotPasswordForm,
  requestPasswordReset,
  resetPasswordForm,
  resetPasswordHandler
};
