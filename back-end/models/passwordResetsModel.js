const db = require('../config/db');

function createPasswordReset({ adminId, tokenHash, expiresAt }) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE password_resets SET used_at = unixepoch() WHERE admin_id = ? AND used_at IS NULL`).run(adminId);
    db.prepare(`
      INSERT INTO password_resets (admin_id, token_hash, expires_at) VALUES (?, ?, ?)
    `).run(adminId, tokenHash, expiresAt);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function getValidPasswordReset(tokenHash) {
  return db.prepare(`
    SELECT password_resets.*, admins.email
    FROM password_resets
    JOIN admins ON admins.id = password_resets.admin_id
    WHERE password_resets.token_hash = ?
      AND password_resets.used_at IS NULL
      AND password_resets.expires_at > unixepoch()
      AND admins.active = 1
  `).get(tokenHash);
}

function consumePasswordReset(resetId) {
  const info = db.prepare(`
    UPDATE password_resets SET used_at = unixepoch()
    WHERE id = ? AND used_at IS NULL AND expires_at > unixepoch()
  `).run(resetId);
  return Number(info.changes) > 0;
}

function discardPasswordReset(tokenHash) {
  db.prepare(`DELETE FROM password_resets WHERE token_hash = ? AND used_at IS NULL`).run(tokenHash);
}

function resetPassword(tokenHash, passwordHash) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const reset = getValidPasswordReset(tokenHash);
    if (!reset) {
      const error = new Error('Link inválido ou expirado.');
      error.code = 'INVALID_RESET';
      throw error;
    }
    db.prepare(`
      UPDATE admins SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
    `).run(passwordHash, reset.admin_id);
    if (!consumePasswordReset(reset.id)) {
      const error = new Error('Link já utilizado.');
      error.code = 'INVALID_RESET';
      throw error;
    }
    db.prepare(`
      UPDATE admin_sessions SET revoked_at = unixepoch()
      WHERE admin_id = ? AND revoked_at IS NULL
    `).run(reset.admin_id);
    db.exec('COMMIT');
    return reset.admin_id;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { createPasswordReset, getValidPasswordReset, consumePasswordReset, discardPasswordReset, resetPassword };
