import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, Pagination, useToast, Empty, money, dateBR } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

export default function Resource({
  title, subtitle, endpoint, perm, columns, fields, filters,
  canWrite, defaults, rowActions, createLabel
}) {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const allowed = canWrite !== undefined ? canWrite : can(user, perm || 'clients', 'write');

  async function load() {
    setLoading(true);
    try {
      const params = Object.assign({ page, limit: 25, q }, filterValues);
      const res = await api.get(endpoint, params);
      setRows(res.data || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, q, JSON.stringify(filterValues)]);

  function openCreate() {
    setForm(Object.assign({}, defaults || {}));
    setEditing({});
  }

  function openEdit(row) {
    setForm(Object.assign({}, row));
    setEditing(row);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = Object.assign({}, form);
      for (const f of fields) {
        if (f.type === 'number' && payload[f.key] !== '' && payload[f.key] !== undefined && payload[f.key] !== null) {
          payload[f.key] = Number(payload[f.key]);
        }
        if (payload[f.key] === '') payload[f.key] = null;
      }
      if (editing && editing.id) {
        await api.put(endpoint + '/' + editing.id, payload);
        toast.success('Registro atualizado');
      } else {
        await api.post(endpoint, payload);
        toast.success('Registro criado');
      }
      setEditing(null);
      load();
      if (lookups.reload) lookups.reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!window.confirm('Confirma a exclusão deste registro?')) return;
    try {
      await api.del(endpoint + '/' + row.id);
      toast.success('Registro excluído');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  function setField(key, value) {
    setForm((prev) => Object.assign({}, prev, { [key]: value }));
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {allowed && (
          <button className="btn btn-primary" onClick={openCreate}>
            + {createLabel || 'Novo'}
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Pesquisar..."
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
        />
        {filters && filters.map((f) => (
          <select
            key={f.key}
            className="filter"
            value={filterValues['f_' + f.key] || ''}
            onChange={(e) => {
              setPage(1);
              setFilterValues((prev) => Object.assign({}, prev, { ['f_' + f.key]: e.target.value }));
            }}
          >
            <option value="">{f.label}: todos</option>
            {(f.options || []).map((o) => {
              const val = typeof o === 'string' ? o : o.value;
              const label = typeof o === 'string' ? o.replace(/_/g, ' ') : o.label;
              return <option key={val} value={val}>{label}</option>;
            })}
          </select>
        ))}
        <div className="spacer" />
        <span className="muted small">{total} registro(s)</span>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        empty={<Empty title="Nada por aqui" hint="Use o botão acima para criar o primeiro registro." />}
        onRowClick={allowed ? openEdit : undefined}
        actions={(r) => (
          <div className="row-actions">
            {allowed && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Editar</button>}
            {rowActions && rowActions(r, { reload: load })}
            {allowed && <button className="btn btn-ghost btn-sm danger" onClick={() => remove(r)}>Excluir</button>}
          </div>
        )}
      />

      <Pagination page={page} pages={pages} total={total} onPage={setPage} />

      {editing && (
        <Modal
          title={(editing.id ? 'Editar ' : 'Novo ') + title}
          onClose={() => setEditing(null)}
          wide={fields.length > 6}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            {fields.map((f) => (
              <Field key={f.key} field={f} value={form[f.key]} onChange={setField} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

export { money, dateBR };
