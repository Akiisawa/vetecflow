'use strict';

const ROLES = ['admin', 'gestor', 'comercial', 'engenharia', 'financeiro', 'colaborador'];

const PERMISSIONS = {
  admin: ['*'],
  gestor: [
    'clients:*', 'crm:*', 'proposals:*', 'contracts:*', 'projects:*', 'tasks:*',
    'team:*', 'timesheets:*', 'documents:*', 'finance:*', 'suppliers:*', 'assets:*',
    'incidents:*', 'calendar:*', 'reports:read', 'audit:read', 'users:read',
    'notifications:*', 'dashboard:read', 'search:read'
  ],
  comercial: [
    'clients:*', 'crm:*', 'proposals:*', 'contracts:read', 'contracts:write',
    'projects:read', 'finance:read', 'reports:read', 'dashboard:read',
    'documents:*', 'calendar:*', 'notifications:*', 'tasks:read', 'timesheets:read',
    'team:read', 'search:read', 'suppliers:read', 'incidents:read'
  ],
  engenharia: [
    'projects:*', 'tasks:*', 'incidents:*', 'documents:*', 'timesheets:*',
    'assets:read', 'assets:write', 'clients:read', 'contracts:read', 'suppliers:read',
    'finance:read', 'dashboard:read', 'calendar:*', 'notifications:*', 'team:read',
    'reports:read', 'search:read', 'crm:read', 'proposals:read'
  ],
  financeiro: [
    'finance:*', 'suppliers:*', 'contracts:read', 'clients:read', 'proposals:read',
    'projects:read', 'reports:read', 'dashboard:read', 'documents:read',
    'notifications:*', 'calendar:*', 'assets:read', 'timesheets:read', 'search:read',
    'crm:read', 'tasks:read', 'team:read'
  ],
  colaborador: [
    'tasks:read', 'tasks:write', 'timesheets:read', 'timesheets:write',
    'projects:read', 'documents:read', 'incidents:read', 'incidents:write',
    'dashboard:read', 'calendar:read', 'notifications:*', 'clients:read',
    'search:read', 'team:read'
  ]
};

function can(role, mod, action) {
  const list = PERMISSIONS[role] || [];
  if (list.indexOf('*') !== -1) return true;
  return list.indexOf(mod + ':*') !== -1 || list.indexOf(mod + ':' + action) !== -1;
}

function requirePerm(mod, action) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!can(req.user.role, mod, action)) {
      return res.status(403).json({ error: 'Acesso negado para esta operação' });
    }
    next();
  };
}

module.exports = { ROLES, PERMISSIONS, can, requirePerm };
