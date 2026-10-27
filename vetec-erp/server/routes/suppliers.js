'use strict';
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');

module.exports = createCrudRouter(db, {
  table: 'suppliers',
  columns: ['name', 'doc', 'email', 'phone', 'address', 'category', 'notes', 'status'],
  searchColumns: ['name', 'doc', 'email'],
  filterColumns: ['status', 'category'],
  readPerm: ['suppliers', 'read'],
  writePerm: ['suppliers', 'write'],
  entity: 'supplier',
  required: ['name']
});
