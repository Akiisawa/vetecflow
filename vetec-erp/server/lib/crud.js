'use strict';
const express = require('express');
const { requirePerm } = require('./perm');
const { logAudit } = require('./audit');
const { pick } = require('./util');

/**
 * Fábrica de rotas CRUD genéricas.
 */
function createCrudRouter(db, opts) {
  const {
    table,
    columns,
    searchColumns = [],
    filterColumns = [],
    dateColumn = null,
    readPerm,
    writePerm,
    entity,
    softDelete = true,
    required = [],
    defaultOrder = 'id DESC',
    beforeSave = null,
    afterSave = null,
    extraColumns = []
  } = opts;

  const router = express.Router();
  const allColumns = columns.concat(extraColumns);
  const hasDeleted = softDelete && allColumns.indexOf('deleted_at') !== -1 || softDelete;

  function buildWhere(req) {
    const where = [];
    const params = {};
    if (softDelete) where.push('t.deleted_at IS NULL');
    if (searchColumns.length && req.query.q) {
      const parts = [];
      searchColumns.forEach((c, i) => {
        params['q' + i] = '%' + req.query.q + '%';
        parts.push('t.' + c + ' LIKE @q' + i);
      });
      where.push('(' + parts.join(' OR ') + ')');
    }
    for (const c of filterColumns) {
      const v = req.query['f_' + c];
      if (v !== undefined && v !== '') {
        params['f_' + c] = v;
        where.push('t.' + c + ' = @f_' + c);
      }
    }
    if (dateColumn) {
      if (req.query.from) { params.from = req.query.from; where.push('t.' + dateColumn + ' >= @from'); }
      if (req.query.to) { params.to = req.query.to; where.push('t.' + dateColumn + ' <= @to'); }
    }
    return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
  }

  router.get('/', requirePerm(readPerm[0], readPerm[1]), (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '25', 10)));
      const offset = (page - 1) * limit;
      const { sql, params } = buildWhere(req);

      let sort = req.query.sort || null;
      let dir = (req.query.dir || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      if (!sort || allColumns.indexOf(sort) === -1) {
        sort = null;
      }
      const orderBy = sort ? 't.' + sort + ' ' + dir : defaultOrder;

      const total = db.prepare('SELECT COUNT(*) AS c FROM ' + table + ' t ' + sql).get(params).c;
      const rows = db.prepare(
        'SELECT t.* FROM ' + table + ' t ' + sql + ' ORDER BY ' + orderBy + ' LIMIT @limit OFFSET @offset'
      ).all(Object.assign({}, params, { limit, offset }));

      res.json({ data: rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erro ao listar registros' });
    }
  });

  router.get('/:id', requirePerm(readPerm[0], readPerm[1]), (req, res) => {
    const row = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(req.params.id);
    if (!row || (softDelete && row.deleted_at)) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json(row);
  });

  router.post('/', requirePerm(writePerm[0], writePerm[1]), (req, res) => {
    try {
      for (const r of required) {
        if (req.body[r] === undefined || req.body[r] === null || req.body[r] === '') {
          return res.status(400).json({ error: 'Campo obrigatório: ' + r });
        }
      }
      let data = pick(req.body, allColumns);
      if (beforeSave) data = beforeSave(data, req, null) || data;

      const keys = Object.keys(data);
      if (!keys.length) return res.status(400).json({ error: 'Nenhum campo válido enviado' });

      const stmt = 'INSERT INTO ' + table + ' (' + keys.join(', ') + ') VALUES (' +
        keys.map((k) => '@' + k).join(', ') + ')';
      const info = db.prepare(stmt).run(data);
      const created = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(info.lastInsertRowid);

      logAudit(db, req, 'create', entity, created.id, created);
      if (afterSave) afterSave(created, req, db);
      res.status(201).json(created);
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: 'Erro ao criar registro: ' + e.message });
    }
  });

  router.put('/:id', requirePerm(writePerm[0], writePerm[1]), (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Registro não encontrado' });

      let data = pick(req.body, allColumns);
      if (beforeSave) data = beforeSave(data, req, existing) || data;
      const keys = Object.keys(data);
      if (!keys.length) return res.status(400).json({ error: 'Nenhum campo válido enviado' });

      if (allColumns.indexOf('updated_at') !== -1) {
        data.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }
      const sets = Object.keys(data).map((k) => k + ' = @' + k).join(', ');
      db.prepare('UPDATE ' + table + ' SET ' + sets + ' WHERE id = @id')
        .run(Object.assign({}, data, { id: req.params.id }));

      const updated = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(req.params.id);
      logAudit(db, req, 'update', entity, updated.id, { changes: Object.keys(data) });
      if (afterSave) afterSave(updated, req, db);
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: 'Erro ao atualizar registro: ' + e.message });
    }
  });

  router.delete('/:id', requirePerm(writePerm[0], writePerm[1]), (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM ' + table + ' WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Registro não encontrado' });

      if (softDelete) {
        db.prepare('UPDATE ' + table + " SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
      } else {
        db.prepare('DELETE FROM ' + table + ' WHERE id = ?').run(req.params.id);
      }
      logAudit(db, req, softDelete ? 'soft_delete' : 'delete', entity, req.params.id, null);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: 'Erro ao excluir: ' + e.message });
    }
  });

  return router;
}

module.exports = { createCrudRouter };
