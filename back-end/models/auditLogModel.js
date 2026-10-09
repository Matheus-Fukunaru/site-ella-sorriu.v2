const db = require('../config/db');

function recordAudit({ actorAdminId = null, action, targetType = null, targetId = null, details = null }) {
  db.prepare(`
    INSERT INTO admin_audit_log (actor_admin_id, action, target_type, target_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(actorAdminId, action, targetType, targetId == null ? null : String(targetId), details);
}

function listRecentAudit(limit = 30) {
  return db.prepare(`
    SELECT admin_audit_log.*, admins.name AS actor_name
    FROM admin_audit_log
    LEFT JOIN admins ON admins.id = admin_audit_log.actor_admin_id
    ORDER BY admin_audit_log.created_at DESC, admin_audit_log.id DESC
    LIMIT ?
  `).all(limit);
}

module.exports = { recordAudit, listRecentAudit };
