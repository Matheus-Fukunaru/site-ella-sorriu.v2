const db = require('../config/db');

const createStmt = db.prepare(`
  INSERT INTO admin_sessions (id, admin_id, expires_at)
  VALUES (?, ?, ?)
`);

const activeStmt = db.prepare(`
  SELECT id
  FROM admin_sessions
  WHERE id = ?
    AND admin_id = ?
    AND revoked_at IS NULL
    AND expires_at > unixepoch()
`);

const revokeStmt = db.prepare(`
  UPDATE admin_sessions
  SET revoked_at = unixepoch()
  WHERE id = ? AND revoked_at IS NULL
`);

const revokeAllStmt = db.prepare(`
  UPDATE admin_sessions
  SET revoked_at = unixepoch()
  WHERE admin_id = ? AND revoked_at IS NULL
`);

const countActiveStmt = db.prepare(`
  SELECT COUNT(*) AS total FROM admin_sessions
  WHERE admin_id = ? AND revoked_at IS NULL AND expires_at > unixepoch()
`);

const revokeOthersStmt = db.prepare(`
  UPDATE admin_sessions SET revoked_at = unixepoch()
  WHERE admin_id = ? AND id <> ? AND revoked_at IS NULL
`);

const cleanupStmt = db.prepare(`
  DELETE FROM admin_sessions
  WHERE expires_at <= unixepoch()
     OR (revoked_at IS NOT NULL AND revoked_at <= unixepoch() - 86400)
`);

function createAdminSession(id, adminId, expiresAt) {
  cleanupStmt.run();
  createStmt.run(id, adminId, expiresAt);
}

function isAdminSessionActive(id, adminId) {
  if (!id) return false;
  return Boolean(activeStmt.get(id, adminId));
}

function revokeAdminSession(id) {
  if (id) revokeStmt.run(id);
}

function revokeAllAdminSessions(adminId) {
  if (adminId) revokeAllStmt.run(adminId);
}

function countActiveAdminSessions(adminId) {
  return Number(countActiveStmt.get(adminId).total);
}

function revokeOtherAdminSessions(adminId, currentSessionId) {
  return Number(revokeOthersStmt.run(adminId, currentSessionId).changes);
}

module.exports = {
  createAdminSession,
  isAdminSessionActive,
  revokeAdminSession,
  revokeAllAdminSessions,
  countActiveAdminSessions,
  revokeOtherAdminSessions
};
