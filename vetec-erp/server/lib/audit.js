'use strict';

function logAudit(db, req, action, entity, entityId, details) {
  try {
    db.prepare(
      'INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      req && req.user ? req.user.id : null,
      action,
      entity,
      entityId === undefined || entityId === null ? null : String(entityId),
      details ? JSON.stringify(sanitize(details)) : null,
      req ? (req.ip || null) : null
    );
  } catch (e) {
    console.error('[audit] falha ao registrar evento:', e.message);
  }
}

function sanitize(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (/password|token|secret|senha/i.test(k)) continue;
    out[k] = obj[k];
  }
  return out;
}

module.exports = { logAudit };
