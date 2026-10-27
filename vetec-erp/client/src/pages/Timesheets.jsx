import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, Badge, dateBR, useToast, Empty, Spinner } from '../ui.jsx';
import { can, useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';

export default function Timesheets() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);

  const canWrite = can(user, 'timesheets', 'write');
  const canApprove = ['admin', 'gestor', 'engenharia'].indexOf(user.role) !== -1;

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/timesheets');
      setRows(res.data || []);
      setTotal(res.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    try {
      await api.post('/timesheets', form);
      toast.success('Horas registradas');
      setForm(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function approve(row) {
    try {
      await api.post('/timesheets/' + row.id + '/approve', {});
      toast.success('Horas aprovadas');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Controle de horas</h1>
          <p className="muted">Total no filtro atual: <strong>{Number(total).toFixed(1)}h</strong></p>
        </div>
        {canWrite && <button className="btn btn-primary" onClick={() => setForm({ date: new Date().toISOString().slice(0, 10), hours: 1 })}>
          + Lançar horas
        </button>}
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'date', label: 'Data', render: (r) => dateBR(r.date) },
            { key: 'user_name', label: 'Colaborador' },
            { key: 'project_name', label: 'Projeto' },
            { key: 'hours', label: 'Horas' },
            { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
            { key: 'description', label: 'Descrição' }
          ]}
          rows={rows}
          empty={<Empty title="Nenhum lançamento de horas" />}
          actions={(r) => (
            <div className="row-actions">
              {canApprove && r.status !== 'aprovado' && (
                <button className="btn btn-ghost btn-sm" onClick={() => approve(r)}>Aprovar</button>
              )}
            </div>
          )}
        />
      )}

      {form && (
        <Modal
          title="Lançar horas"
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            <Field field={{ key: 'date', label: 'Data', type: 'date', required: true }} value={form.date}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'hours', label: 'Horas', type: 'number', required: true }} value={form.hours}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' }} value={form.project_id}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'description', label: 'Descrição', type: 'textarea', full: true }} value={form.description}
              onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}
