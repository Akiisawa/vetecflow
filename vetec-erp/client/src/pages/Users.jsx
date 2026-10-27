import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, Badge, useToast, Empty, Spinner } from '../ui.jsx';
import { can, useAuth } from '../auth.jsx';

const ROLES = ['admin', 'gestor', 'comercial', 'engenharia', 'financeiro', 'colaborador'];

export default function Users() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const canWrite = can(user, 'team', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    try {
      if (editing && editing.id) await api.put('/users/' + editing.id, form);
      else await api.post('/users', form);
      toast.success('Usuário salvo');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function remove(row) {
    if (!window.confirm('Desativar este usuário?')) return;
    try {
      await api.del('/users/' + row.id);
      toast.success('Usuário desativado');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Usuários e permissões</h1>
          <p className="muted">Perfis definem o que cada usuário pode fazer no sistema.</p>
        </div>
        {canWrite && <button className="btn btn-primary" onClick={() => { setForm({ role: 'colaborador', active: 1 }); setEditing({}); }}>
          + Novo usuário
        </button>}
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'name', label: 'Nome' },
            { key: 'email', label: 'E-mail' },
            { key: 'role', label: 'Perfil' },
            { key: 'active', label: 'Situação', render: (r) => <Badge value={r.active ? 'ativo' : 'inativo'} /> }
          ]}
          rows={rows}
          empty={<Empty title="Sem usuários" />}
          onRowClick={canWrite ? (r) => { setForm(r); setEditing(r); } : undefined}
          actions={canWrite ? (r) => (
            <div className="row-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm(r); setEditing(r); }}>Editar</button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => remove(r)}>Desativar</button>
            </div>
          ) : null}
        />
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Editar usuário' : 'Novo usuário'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            <Field field={{ key: 'name', label: 'Nome', required: true }} value={form.name}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'email', label: 'E-mail', type: 'email', required: true }} value={form.email}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'role', label: 'Perfil', type: 'select', options: ROLES }} value={form.role}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'position', label: 'Cargo' }} value={form.position}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'phone', label: 'Telefone' }} value={form.phone}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'password', label: editing.id ? 'Nova senha (opcional)' : 'Senha', type: 'password', required: !editing.id }}
              value={form.password} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}
