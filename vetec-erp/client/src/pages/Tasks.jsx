import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Spinner, Modal, Field, Badge, dateBR, useToast, Empty } from '../ui.jsx';
import { can, useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';

const STATUSES = ['pendente', 'em_andamento', 'concluida', 'cancelada'];

export default function Tasks() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('lista');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const canWrite = can(user, 'tasks', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/tasks');
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm({ status: 'pendente', priority: 'media' });
    setEditing({});
  }

  async function save() {
    try {
      const payload = Object.assign({}, form);
      if (editing && editing.id) await api.put('/tasks/' + editing.id, payload);
      else await api.post('/tasks', payload);
      toast.success('Tarefa salva');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function changeStatus(task, status) {
    try {
      await api.put('/tasks/' + task.id, { status });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const fields = [
    { key: 'title', label: 'Título', required: true },
    { key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' },
    { key: 'assignee_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
    { key: 'priority', label: 'Prioridade', type: 'select', options: ['baixa', 'media', 'alta', 'urgente'] },
    { key: 'status', label: 'Status', type: 'select', options: STATUSES },
    { key: 'start_date', label: 'Início', type: 'date' },
    { key: 'due_date', label: 'Prazo', type: 'date' },
    { key: 'progress', label: 'Progresso (%)', type: 'number' },
    { key: 'description', label: 'Descrição', type: 'textarea', full: true }
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Tarefas</h1>
          <p className="muted">Lista e quadro Kanban das tarefas da empresa.</p>
        </div>
        <div className="toolbar-inline">
          <select className="filter" value={view} onChange={(e) => setView(e.target.value)}>
            <option value="lista">Lista</option>
            <option value="kanban">Kanban</option>
          </select>
          {canWrite && <button className="btn btn-primary" onClick={openCreate}>+ Nova tarefa</button>}
        </div>
      </div>

      {loading ? <Spinner /> : view === 'lista' ? (
        rows.length === 0 ? <Empty title="Nenhuma tarefa" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Título</th><th>Projeto</th><th>Responsável</th><th>Status</th><th>Prazo</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} onClick={canWrite ? () => { setForm(t); setEditing(t); } : undefined} className="clickable">
                    <td>{t.title}</td>
                    <td>{t.project_name || '—'}</td>
                    <td>{t.assignee_name || '—'}</td>
                    <td><Badge value={t.status} /></td>
                    <td>{dateBR(t.due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="kanban">
          {STATUSES.map((s) => (
            <div
              key={s}
              className="kanban-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/plain');
                const task = rows.find((r) => String(r.id) === id);
                if (task && canWrite) changeStatus(task, s);
              }}
            >
              <div className="kanban-head"><span>{s.replace(/_/g, ' ')}</span>
                <span className="muted small">{rows.filter((r) => r.status === s).length}</span>
              </div>
              <div className="kanban-body">
                {rows.filter((r) => r.status === s).map((t) => (
                  <div
                    key={t.id}
                    className="kanban-card"
                    draggable={canWrite}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(t.id))}
                    onClick={canWrite ? () => { setForm(t); setEditing(t); } : undefined}
                  >
                    <strong>{t.title}</strong>
                    <span className="muted small">{t.project_name || 'Sem projeto'}</span>
                    <div className="kanban-foot">
                      <span className="muted small">{t.assignee_name || '—'}</span>
                      <span className="muted small">{dateBR(t.due_date)}</span>
                    </div>
                  </div>
                ))}
                {rows.filter((r) => r.status === s).length === 0 && <p className="muted small empty-col">Vazio</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Editar tarefa' : 'Nova tarefa'}
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
