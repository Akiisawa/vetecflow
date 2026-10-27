'use strict';
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');

module.exports = createCrudRouter(db, {
  table: 'leads',
  columns: ['client_id', 'name', 'email', 'phone', 'company', 'source', 'status', 'owner_id', 'notes'],
  searchColumns: ['name', 'email', 'phone', 'company'],
  filterColumns: ['status', 'owner_id', 'source'],
  readPerm: ['crm', 'read'],
  writePerm: ['crm', 'write'],
  entity: 'lead',
  required: ['name']
});
