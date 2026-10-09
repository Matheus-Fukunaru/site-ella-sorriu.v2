const {
  listAdmins,
  getAdminById,
  setAdminActive,
  setAdminRole,
  setProductApprovalExemption,
  authorizeSupport,
  disableSupport
} = require('../models/adminsModel');
const {
  revokeAllAdminSessions,
  countActiveAdminSessions,
  revokeOtherAdminSessions
} = require('../models/adminSessionsModel');
const { recordAudit, listRecentAudit } = require('../models/auditLogModel');
const { ROLE_LABELS } = require('../config/constants');
const { isSmtpConfigured } = require('../utils/mailer');
const { getAllSettings, saveSettings } = require('../models/settingsModel');
const { isValidEmail } = require('../utils/security');

function supportIsEffective(admin) {
  return admin.role !== 'support' || (
    admin.active && Number(admin.support_access_until || 0) > Math.floor(Date.now() / 1000)
  );
}

const auditDescriptions = {
  order_status_changed: { category: 'orders', describe: (actor, entry) => `${actor} alterou o status do pedido #${entry.target_id}` },
  order_deleted: { category: 'orders', describe: (actor, entry) => `${actor} excluiu o pedido #${entry.target_id}` },
  setup_owner_created: { category: 'users', describe: (actor) => `${actor} criou a conta de Proprietário` },
  admin_activated: { category: 'users', describe: (actor) => `${actor} reativou o acesso de um usuário` },
  admin_deactivated: { category: 'users', describe: (actor) => `${actor} desativou o acesso de um usuário` },
  admin_role_changed: { category: 'users', describe: (actor) => `${actor} alterou a função de um membro da equipe` },
  admin_invited: { category: 'users', describe: (actor) => `${actor} convidou um novo membro da equipe` },
  product_approval_exemption_changed: { category: 'users', describe: (actor) => `${actor} alterou a dispensa de aprovação de produtos de um atendente` },
  product_created: { category: 'users', describe: (actor) => `${actor} publicou um produto` },
  product_updated: { category: 'users', describe: (actor) => `${actor} atualizou um produto` },
  product_archived: { category: 'users', describe: (actor) => `${actor} arquivou um produto` },
  product_deactivated: { category: 'users', describe: (actor) => `${actor} desativou um produto` },
  product_change_requested: { category: 'users', describe: (actor) => `${actor} solicitou uma alteração de produto para aprovação` },
  product_change_approved: { category: 'users', describe: (actor) => `${actor} aprovou uma alteração de produto` },
  product_change_rejected: { category: 'users', describe: (actor) => `${actor} rejeitou uma alteração de produto` },
  invite_accepted: { category: 'users', describe: (actor) => `${actor} concluiu a criação do próprio acesso` },
  support_authorized: { category: 'support', describe: (actor) => `${actor} autorizou o acesso do suporte técnico` },
  support_disabled: { category: 'support', describe: (actor) => `${actor} desativou o acesso do suporte técnico` },
  password_reset_requested: { category: 'security', describe: (actor) => `${actor} solicitou a alteração da própria senha` },
  password_reset_completed: { category: 'security', describe: (actor) => `${actor} alterou a própria senha` },
  settings_updated: { category: 'security', describe: (actor) => `${actor} atualizou as configurações da Ella Sorriu` },
  sessions_revoked: { category: 'security', describe: (actor) => `${actor} encerrou outras sessões da própria conta` }
};

function formatAuditDate(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
  const datePart = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const timePart = date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${datePart} às ${timePart}`;
}

function presentAuditEntry(entry) {
  const actor = entry.actor_name || 'Sistema';
  const presentation = auditDescriptions[entry.action] || {
    category: 'security',
    describe: (name) => `${name} registrou uma atividade administrativa`
  };
  return {
    id: entry.id,
    category: presentation.category,
    description: presentation.describe(actor, entry),
    occurredAt: formatAuditDate(entry.created_at)
  };
}

function renderTeamPage(req, res, options = {}) {
  const allMembers = listAdmins();
  const members = allMembers.map((member) => ({
    ...member,
    productApprovalGrantedByName: allMembers.find((candidate) => Number(candidate.id) === Number(member.product_approval_granted_by))?.name || null,
    effectiveActive: member.role === 'support' ? supportIsEffective(member) : Boolean(member.active)
  }));
  return res.status(options.status || 200).render('team', {
    admin: req.admin,
    csrfToken: req.cookies.csrf_token,
    members,
    roleLabels: ROLE_LABELS,
    error: options.error || req.query.error || null,
    roleFormError: options.roleFormError || null
  });
}

function changeProductApprovalExemption(req, res, next) {
  try {
    const id = Number(req.params.id);
    const target = getAdminById(id);
    if (!Number.isInteger(id) || !target || target.role !== 'attendant') {
      return res.status(400).render('forbidden', { admin: req.admin });
    }
    const enabled = req.body.enabled === '1';
    const previous = Boolean(target.product_approval_exempt);
    if (previous === enabled) return res.redirect('/admin/team');
    const updated = setProductApprovalExemption(id, enabled, req.admin.id);
    recordAudit({
      actorAdminId: req.admin.id,
      action: 'product_approval_exemption_changed',
      targetType: 'admin',
      targetId: id,
      details: JSON.stringify({ role: target.role, before: previous, after: enabled, grantedBy: updated.product_approval_granted_by, grantedAt: updated.product_approval_granted_at })
    });
    return res.redirect('/admin/team');
  } catch (error) {
    next(error);
  }
}

function teamPage(req, res) {
  return renderTeamPage(req, res);
}

function inviteForm(req, res) {
  res.render('invite-form', {
    error: null,
    admin: req.admin,
    csrfToken: req.cookies.csrf_token,
    roleLabels: ROLE_LABELS
  });
}

function changeActive(req, res, next) {
  try {
    const id = Number(req.params.id);
    const active = req.body.active === '1';
    const target = getAdminById(id);
    if (!Number.isInteger(id) || !target || target.role === 'support') {
      return res.status(400).send('Usuário inválido.');
    }
    if (req.admin.role === 'admin' && target.role === 'owner') {
      return res.status(403).render('forbidden', { admin: req.admin });
    }
    setAdminActive(id, active);
    if (!active) revokeAllAdminSessions(id);
    recordAudit({
      actorAdminId: req.admin.id,
      action: active ? 'admin_activated' : 'admin_deactivated',
      targetType: 'admin',
      targetId: id
    });
    res.redirect('/admin/team');
  } catch (error) {
    if (error.code === 'LAST_OWNER') {
      return res.redirect('/admin/team?error=' + encodeURIComponent(error.message));
    }
    next(error);
  }
}

function changeRole(req, res, next) {
  try {
    const id = Number(req.params.id);
    const role = String(req.body.role || '');
    const target = getAdminById(id);
    if (req.admin.role === 'admin' && (!target || target.role === 'owner' || role === 'owner')) {
      return res.status(403).render('forbidden', { admin: req.admin });
    }
    const ownerConfirmation = String(req.body.confirm_owner || '').trim().toUpperCase();
    if (role === 'owner' && ownerConfirmation !== 'PROMOVER') {
      return renderTeamPage(req, res, {
        status: 400,
        roleFormError: {
          memberId: id,
          role,
          confirmation: String(req.body.confirm_owner || ''),
          message: 'Digite PROMOVER para confirmar a promoção.'
        }
      });
    }
    const previous = setAdminRole(id, role);
    revokeAllAdminSessions(id);
    if (previous.role === 'attendant' && Number(previous.product_approval_exempt) === 1 && role !== 'attendant') {
      recordAudit({
        actorAdminId: req.admin.id,
        action: 'product_approval_exemption_changed',
        targetType: 'admin',
        targetId: id,
        details: JSON.stringify({ role: previous.role, before: true, after: false, reason: 'role_changed' })
      });
    }
    recordAudit({
      actorAdminId: req.admin.id,
      action: 'admin_role_changed',
      targetType: 'admin',
      targetId: id,
      details: `${previous.role}->${role}`
    });
    res.redirect('/admin/team');
  } catch (error) {
    if (['INVALID_ROLE', 'PROTECTED_ROLE', 'NOT_FOUND', 'LAST_OWNER'].includes(error.code)) {
      return res.status(400).send(error.message);
    }
    next(error);
  }
}

function supportPage(req, res) {
  const supportAccounts = listAdmins()
    .filter((member) => member.role === 'support')
    .map((member) => ({ ...member, effectiveActive: supportIsEffective(member) }));
  res.render('support', {
    admin: req.admin,
    csrfToken: req.cookies.csrf_token,
    supportAccounts,
    roleLabels: ROLE_LABELS
  });
}

function supportInviteForm(req, res) {
  res.render('support-invite-form', {
    error: null,
    admin: req.admin,
    csrfToken: req.cookies.csrf_token,
    roleLabels: ROLE_LABELS
  });
}

function activateSupport(req, res) {
  const id = Number(req.params.id);
  const hours = Number(req.body.hours);
  if (![1, 8, 24, 168].includes(hours) || !authorizeSupport(id, Math.floor(Date.now() / 1000) + hours * 3600)) {
    return res.status(400).send('Autorização inválida.');
  }
  revokeAllAdminSessions(id);
  recordAudit({
    actorAdminId: req.admin.id,
    action: 'support_authorized',
    targetType: 'admin',
    targetId: id,
    details: `hours=${hours}`
  });
  res.redirect('/admin/support');
}

function deactivateSupport(req, res) {
  const id = Number(req.params.id);
  if (!disableSupport(id)) return res.status(400).send('Suporte inválido.');
  revokeAllAdminSessions(id);
  recordAudit({ actorAdminId: req.admin.id, action: 'support_disabled', targetType: 'admin', targetId: id });
  res.redirect('/admin/support');
}

function settingsPage(req, res) {
  const limitedSettings = req.admin.role === 'attendant';
  const settings = limitedSettings ? null : getAllSettings();
  const supportAccounts = limitedSettings ? [] : listAdmins().filter((member) => member.role === 'support');
  const activeSupport = limitedSettings ? null : supportAccounts.find(supportIsEffective);
  res.render('settings', {
    admin: req.admin,
    csrfToken: req.cookies.csrf_token,
    environment: process.env.NODE_ENV || 'development',
    smtpConfigured: limitedSettings ? false : isSmtpConfigured(),
    settings,
    contactEmail: limitedSettings ? null : settings.contact_email || process.env.ADMIN_EMAIL || null,
    supportAccessUntil: req.admin.role === 'support' ? Number(req.admin.support_access_until || 0) : null,
    supportStatus: activeSupport ? { active: true, until: Number(activeSupport.support_access_until) } : { active: false, until: null },
    activeSessions: limitedSettings ? null : countActiveAdminSessions(req.admin.id),
    auditEntries: limitedSettings ? [] : listRecentAudit(30).map(presentAuditEntry),
    success: req.query.saved === '1' ? 'Configurações salvas com sucesso.' : req.query.sessions === 'closed' ? 'Outras sessões encerradas com sucesso.' : req.query.emailTest === 'ok' ? 'E-mail de teste enviado com sucesso.' : null,
    formError: req.query.emailTest === 'failed' ? 'Não foi possível enviar o e-mail de teste.' : null,
    formValues: null
  });
}

function normalizeBusinessSettings(body) {
  return {
    company_name: String(body.company_name || '').trim(),
    company_whatsapp: String(body.company_whatsapp || '').replace(/\D/g, ''),
    contact_email: String(body.contact_email || '').trim().toLowerCase(),
    email_sender_name: String(body.email_sender_name || '').trim(),
    whatsapp_message: String(body.whatsapp_message || '').trim(),
    allow_same_day: body.allow_same_day === 'true' ? 'true' : 'false',
    min_lead_days: String(body.min_lead_days || '').trim(),
    order_success_message: String(body.order_success_message || '').trim(),
    auto_open_whatsapp: body.auto_open_whatsapp === 'true' ? 'true' : 'false',
    notify_new_order: body.notify_new_order === 'true' ? 'true' : 'false'
  };
}

function validateBusinessSettings(values) {
  if (values.company_name.length < 2 || values.company_name.length > 80) return 'Informe um nome de empresa válido.';
  if (!/^55\d{10,11}$/.test(values.company_whatsapp)) return 'Informe um WhatsApp brasileiro válido com DDD.';
  if (values.contact_email && !isValidEmail(values.contact_email)) return 'Informe um e-mail de contato válido.';
  if (values.email_sender_name.length < 2 || values.email_sender_name.length > 80) return 'Informe um nome válido para os e-mails.';
  if (values.whatsapp_message.length < 10 || values.whatsapp_message.length > 1000) return 'A mensagem do WhatsApp deve ter entre 10 e 1.000 caracteres.';
  const unknownPlaceholders = values.whatsapp_message.match(/\{[^{}]+\}/g) || [];
  if (unknownPlaceholders.some((placeholder) => !['{nome}', '{produto}', '{data}', '{cidade}'].includes(placeholder))) return 'A mensagem contém um marcador não permitido.';
  const leadDays = Number(values.min_lead_days);
  if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 30) return 'A antecedência mínima deve ficar entre 0 e 30 dias.';
  if (values.order_success_message.length < 10 || values.order_success_message.length > 240) return 'A mensagem de confirmação deve ter entre 10 e 240 caracteres.';
  return null;
}

function saveBusinessSettings(req, res, next) {
  try {
    const values = normalizeBusinessSettings(req.body);
    const error = validateBusinessSettings(values);
    if (error) {
      const settings = getAllSettings();
      const supportAccounts = listAdmins().filter((member) => member.role === 'support');
      const activeSupport = supportAccounts.find(supportIsEffective);
      return res.status(400).render('settings', {
        admin: req.admin,
        csrfToken: req.cookies.csrf_token,
        environment: process.env.NODE_ENV || 'development',
        smtpConfigured: isSmtpConfigured(),
        settings,
        contactEmail: values.contact_email || null,
        supportAccessUntil: null,
        supportStatus: activeSupport ? { active: true, until: Number(activeSupport.support_access_until) } : { active: false, until: null },
        activeSessions: countActiveAdminSessions(req.admin.id),
        auditEntries: listRecentAudit(30).map(presentAuditEntry),
        success: null,
        formError: 'Não foi possível salvar. Verifique os campos destacados.',
        fieldError: error,
        formValues: values
      });
    }
    saveSettings(values, req.admin.id);
    recordAudit({ actorAdminId: req.admin.id, action: 'settings_updated', targetType: 'settings', targetId: 'business' });
    res.redirect('/admin/settings?saved=1');
  } catch (error) {
    next(error);
  }
}

function closeOtherSessions(req, res, next) {
  try {
    revokeOtherAdminSessions(req.admin.id, req.admin.jti);
    recordAudit({ actorAdminId: req.admin.id, action: 'sessions_revoked', targetType: 'admin', targetId: req.admin.id });
    res.redirect('/admin/settings?sessions=closed');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  teamPage,
  changeProductApprovalExemption,
  inviteForm,
  changeActive,
  changeRole,
  supportPage,
  supportInviteForm,
  activateSupport,
  deactivateSupport,
  settingsPage,
  saveBusinessSettings,
  closeOtherSessions
};
