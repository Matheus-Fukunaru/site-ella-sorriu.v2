const db = require('../config/db');

function getAdminByEmail(email) {
  return db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
}

function getAdminById(id) {
  return db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
}

function countOwners() {
  return Number(db.prepare("SELECT COUNT(*) AS total FROM admins WHERE role = 'owner'").get().total);
}

function countActiveOwners() {
  return Number(db.prepare("SELECT COUNT(*) AS total FROM admins WHERE role = 'owner' AND active = 1").get().total);
}

function listAdmins() {
  return db.prepare(`
    SELECT id, name, email, role, active, support_access_until, last_login_at, created_at,
           product_approval_exempt, product_approval_granted_by, product_approval_granted_at
    FROM admins
    ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'support' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
             name COLLATE NOCASE
  `).all();
}

function setProductApprovalExemption(id, enabled, actorId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const admin = getAdminById(id);
    if (!admin || admin.role !== 'attendant') {
      const error = new Error('A dispensa só pode ser atribuída a uma conta de Atendente.');
      error.code = 'INVALID_APPROVAL_EXEMPTION_TARGET';
      throw error;
    }
    db.prepare(`UPDATE admins SET product_approval_exempt = ?, product_approval_granted_by = ?,
      product_approval_granted_at = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(enabled ? 1 : 0, enabled ? actorId : null, enabled ? Math.floor(Date.now() / 1000) : null, id);
    db.exec('COMMIT');
    return getAdminById(id);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function createInitialOwner({ name, email, passwordHash }) {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (countOwners() > 0) {
      const error = new Error('A configuração inicial já foi concluída.');
      error.code = 'SETUP_COMPLETE';
      throw error;
    }
    const info = db.prepare(`
      INSERT INTO admins (name, email, password_hash, role, active)
      VALUES (?, ?, ?, 'owner', 1)
    `).run(name, email, passwordHash);
    db.exec('COMMIT');
    return info.lastInsertRowid;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function createInvitedAdmin({ name, email, passwordHash, role }) {
  const info = db.prepare(`
    INSERT INTO admins (name, email, password_hash, role, active)
    VALUES (?, ?, ?, ?, 1)
  `).run(name, email, passwordHash, role);
  return info.lastInsertRowid;
}

function updatePassword(id, passwordHash) {
  db.prepare(`
    UPDATE admins SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
  `).run(passwordHash, id);
}

function updateLastLogin(id) {
  db.prepare(`
    UPDATE admins SET last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `).run(id);
}

function setAdminActive(id, active) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const admin = getAdminById(id);
    if (!admin) {
      const error = new Error('Usuário não encontrado.');
      error.code = 'NOT_FOUND';
      throw error;
    }
    if (admin.role === 'owner' && admin.active && !active && countActiveOwners() <= 1) {
      const error = new Error('O último Proprietário ativo não pode ser desativado.');
      error.code = 'LAST_OWNER';
      throw error;
    }
    db.prepare(`
      UPDATE admins SET active = ?, updated_at = datetime('now') WHERE id = ?
    `).run(active ? 1 : 0, id);
    db.exec('COMMIT');
    return admin;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function setAdminRole(id, role) {
  if (!['owner', 'admin', 'attendant'].includes(role)) {
    const error = new Error('Função não permitida.');
    error.code = 'INVALID_ROLE';
    throw error;
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const admin = getAdminById(id);
    if (!admin || admin.role === 'support') {
      const error = new Error('Este acesso não pode ter a função alterada por esta tela.');
      error.code = admin ? 'PROTECTED_ROLE' : 'NOT_FOUND';
      throw error;
    }
    if (admin.role === 'owner' && role !== 'owner' && admin.active && countActiveOwners() <= 1) {
      const error = new Error('O último Proprietário ativo não pode ser rebaixado.');
      error.code = 'LAST_OWNER';
      throw error;
    }
    db.prepare(`
      UPDATE admins SET role = ?,
        product_approval_exempt = CASE WHEN ? = 'attendant' THEN product_approval_exempt ELSE 0 END,
        product_approval_granted_by = CASE WHEN ? = 'attendant' THEN product_approval_granted_by ELSE NULL END,
        product_approval_granted_at = CASE WHEN ? = 'attendant' THEN product_approval_granted_at ELSE NULL END,
        updated_at = datetime('now') WHERE id = ?
    `).run(role, role, role, role, id);
    db.exec('COMMIT');
    return admin;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function authorizeSupport(id, accessUntil) {
  const info = db.prepare(`
    UPDATE admins
    SET active = 1, support_access_until = ?, updated_at = datetime('now')
    WHERE id = ? AND role = 'support'
  `).run(accessUntil, id);
  return Number(info.changes) > 0;
}

function disableSupport(id) {
  const info = db.prepare(`
    UPDATE admins
    SET active = 0, support_access_until = NULL, updated_at = datetime('now')
    WHERE id = ? AND role = 'support'
  `).run(id);
  return Number(info.changes) > 0;
}

function upsertAdmin(email, passwordHash, name = 'Proprietário') {
  const existing = getAdminByEmail(email);
  if (existing) {
    db.prepare(`
      UPDATE admins
      SET name = COALESCE(NULLIF(name, ''), ?), password_hash = ?, updated_at = datetime('now')
      WHERE email = ?
    `).run(name, passwordHash, email);
    return existing.id;
  }
  const info = db.prepare(`
    INSERT INTO admins (name, email, password_hash, role, active)
    VALUES (?, ?, ?, 'owner', 1)
  `).run(name, email, passwordHash);
  return info.lastInsertRowid;
}

module.exports = {
  getAdminByEmail,
  getAdminById,
  countOwners,
  countActiveOwners,
  listAdmins,
  setProductApprovalExemption,
  createInitialOwner,
  createInvitedAdmin,
  updatePassword,
  updateLastLogin,
  setAdminActive,
  setAdminRole,
  authorizeSupport,
  disableSupport,
  upsertAdmin
};
