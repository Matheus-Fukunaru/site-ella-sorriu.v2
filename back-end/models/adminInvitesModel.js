const db = require('../config/db');

function createInvite({ name, email, role, tokenHash, invitedBy, expiresAt }) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE admin_invites SET used_at = unixepoch() WHERE email = ? AND used_at IS NULL`).run(email);
    const info = db.prepare(`
      INSERT INTO admin_invites (name, email, role, token_hash, invited_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, email, role, tokenHash, invitedBy, expiresAt);
    db.exec('COMMIT');
    return info.lastInsertRowid;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function getValidInvite(tokenHash) {
  return db.prepare(`
    SELECT * FROM admin_invites
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > unixepoch()
  `).get(tokenHash);
}

function consumeInvite(inviteId) {
  const info = db.prepare(`
    UPDATE admin_invites SET used_at = unixepoch()
    WHERE id = ? AND used_at IS NULL AND expires_at > unixepoch()
  `).run(inviteId);
  return Number(info.changes) > 0;
}

function acceptInvite(tokenHash, passwordHash) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const invite = getValidInvite(tokenHash);
    if (!invite) {
      const error = new Error('Convite inválido ou expirado.');
      error.code = 'INVALID_INVITE';
      throw error;
    }
    const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(invite.email);
    if (existing) {
      const error = new Error('Este e-mail já possui acesso.');
      error.code = 'EMAIL_EXISTS';
      throw error;
    }
    const info = db.prepare(`
      INSERT INTO admins (name, email, password_hash, role, active)
      VALUES (?, ?, ?, ?, ?)
    `).run(invite.name, invite.email, passwordHash, invite.role, invite.role === 'support' ? 0 : 1);
    if (!consumeInvite(invite.id)) {
      const error = new Error('Convite já utilizado.');
      error.code = 'INVALID_INVITE';
      throw error;
    }
    db.exec('COMMIT');
    return { adminId: info.lastInsertRowid, invite };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { createInvite, getValidInvite, consumeInvite, acceptInvite };
