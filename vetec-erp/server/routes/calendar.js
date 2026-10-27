'use strict';
const db = require('../db');
const { createCrudRouter } = require('../lib/crud');

module.exports = createCrudRouter(db, {
  table: 'calendar_events',
  columns: ['title', 'type', 'start_at', 'end_at', 'project_id', 'client_id', 'user_id', 'notes'],
  searchColumns: ['title', 'notes'],
  filterColumns: ['type', 'project_id', 'client_id', 'user_id'],
  dateColumn: 'start_at',
  readPerm: ['calendar', 'read'],
  writePerm: ['calendar', 'write'],
  entity: 'calendar_event',
  required: ['title', 'start_at']
});
