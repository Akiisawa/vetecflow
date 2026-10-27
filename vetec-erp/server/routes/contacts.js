'use strict';
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');

module.exports = createCrudRouter(db, {
  table: 'contacts',
  columns: ['client_id', 'name', 'role', 'email', 'phone', 'notes'],
  searchColumns: ['name', 'email', 'phone'],
  filterColumns: ['client_id'],
  readPerm: ['clients', 'read'],
  writePerm: ['clients', 'write'],
  entity: 'contact',
  required: ['name', 'client_id']
});
