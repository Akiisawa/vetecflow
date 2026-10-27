import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, useToast, Empty, Spinner, dateBR } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

export default function CalendarPage() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const canWrite = can(user, 'calendar', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/calendar', { limit: 200 });
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
      if (editing && editing.id) await api.put('/calendar/' + editing.id, form);
      else await api.post('/calendar', form);
      toast.success('Evento salvo');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const fields = [
    { key: 'title', label: 'Título', required: true },
    { key: 'type', label: 'Tipo', type: 'select', options: ['reuniao', 'entrega', 'visita', 'inspecao', 'vencimento', 'outro'] },
    { key: 'start_at', label: 'Início', type: 'datetime-local', required: true },
    { key: 'end_at', label: 'Término', type: 'datetime-local' },
    { key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' },
    { key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients' },
    { key: 'user_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
    { key: 'notes', label: 'Observações', type: 'textarea', full: true }
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Calendário</h1>
          <p className="muted">Reuniões, entregas, visitas, inspeções e vencimentos.</p>
        </div>
        {canWrite && <button className="btn btn-primary" onClick={() => { setForm({ type: 'reuniao' }); setEditing({}); }}>
          + Novo evento
        </button>}
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'title', label: 'Título' },
            { key: 'type', label: 'Tipo' },
            { key: 'start_at', label: 'Início', render: (r) => String(r.start_at || '').replace('T', ' ').slice(0, 16) },
            { key: 'end_at', label: 'Término', render: (r) => String(r.end_at || '').replace('T', ' ').slice(0, 16) },
            { key: 'notes', label: 'Observações' }
          ]}
          rows={rows}
          empty={<Empty title="Nenhum evento" />}
          onRowClick={canWrite ? (r) => { setForm(r); setEditing(r); } : undefined}
        />
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Editar evento' : 'Novo evento'}
          onClose={() => setEditing(null)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            {fields.map((f) => (
              <Field key={f.key} field={f} value={form[f.key]} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
