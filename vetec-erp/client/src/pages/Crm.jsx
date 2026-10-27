import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Spinner, Modal, Field, money, useToast, Badge } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

const STAGE_LABELS = {
  novo_lead: 'Novo lead',
  primeiro_contato: 'Primeiro contato',
  qualificacao: 'Qualificação',
  proposta_enviada: 'Proposta enviada',
  negociacao: 'Negociação',
  ganho: 'Ganho',
  perdido: 'Perdido'
};

const FIELDS = [
  { key: 'title', label: 'Título', required: true },
  { key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients' },
  { key: 'service', label: 'Serviço de interesse' },
  { key: 'value', label: 'Valor estimado', type: 'number' },
  { key: 'probability', label: 'Probabilidade (%)', type: 'number' },
  { key: 'owner_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
  { key: 'source', label: 'Origem' },
  { key: 'expected_close', label: 'Fechamento previsto', type: 'date' },
  { key: 'notes', label: 'Observações', type: 'textarea', full: true }
];

export default function Crm() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [dragId, setDragId] = useState(null);

  const canWrite = can(user, 'crm', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/opportunities/board');
      setBoard(res);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function moveTo(id, stage) {
    try {
      await api.post('/opportunities/' + id + '/stage', { stage });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function save() {
    try {
      const payload = Object.assign({}, form);
      if (editing && editing.id) await api.put('/opportunities/' + editing.id, payload);
      else await api.post('/opportunities', payload);
      toast.success('Oportunidade salva');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  if (loading && !board) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>CRM — Oportunidades</h1>
          <p className="muted">Arraste os cartões entre as etapas para atualizar o funil.</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => { setForm({ stage: 'novo_lead' }); setEditing({}); }}>
            + Nova oportunidade
          </button>
        )}
      </div>

      <div className="kanban">
        {board.stages.map((stage) => (
          <div
            key={stage}
            className="kanban-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId && canWrite) moveTo(dragId, stage); setDragId(null); }}
          >
            <div className="kanban-head">
              <span>{STAGE_LABELS[stage]}</span>
              <span className="muted small">{board.board[stage].length}</span>
            </div>
            <div className="kanban-body">
              {board.board[stage].map((o) => (
                <div
                  key={o.id}
                  className="kanban-card"
                  draggable={canWrite}
                  onDragStart={() => setDragId(o.id)}
                  onClick={() => { setForm(o); setEditing(o); }}
                >
                  <strong>{o.title}</strong>
                  <span className="muted small">{o.client_name || 'Sem cliente'}</span>
                  <div className="kanban-foot">
                    <span>{money(o.value)}</span>
                    <span className="muted small">{o.probability}%</span>
                  </div>
                </div>
              ))}
              {board.board[stage].length === 0 && <p className="muted small empty-col">Sem oportunidades</p>}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Editar oportunidade' : 'Nova oportunidade'}
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
            {FIELDS.map((f) => (
              <Field key={f.key} field={f} value={form[f.key]} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            ))}
            <div className="field">
              <label>Etapa</label>
              <select value={form.stage || 'novo_lead'} onChange={(e) => setForm(Object.assign({}, form, { stage: e.target.value }))}>
                {Object.keys(STAGE_LABELS).map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
