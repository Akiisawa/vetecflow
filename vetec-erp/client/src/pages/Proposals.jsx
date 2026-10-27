import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, DataTable, Modal, Field, money, dateBR, Badge, useToast, Empty, Spinner } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

const STATUS = ['rascunho', 'enviada', 'em_negociacao', 'aprovada', 'recusada', 'expirada'];

const EMPTY_ITEM = { desc: '', qty: 1, unit_label: 'un', unit: 0 };

export default function Proposals() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ items: [Object.assign({}, EMPTY_ITEM)] });

  const canWrite = can(user, 'proposals', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/proposals');
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm({
      client_id: '', service: '', scope: '', items: [Object.assign({}, EMPTY_ITEM)],
      discount: 0, taxes: 0, valid_until: '', payment_terms: '', status: 'rascunho'
    });
    setEditing({});
  }

  async function openEdit(row) {
    try {
      const full = await api.get('/proposals/' + row.id);
      setForm(Object.assign({}, full, { items: full.items && full.items.length ? full.items : [Object.assign({}, EMPTY_ITEM)] }));
      setEditing(row);
    } catch (e) {
      toast.error(e.message);
    }
  }

  function setItem(idx, key, value) {
    const items = form.items.slice();
    items[idx] = Object.assign({}, items[idx], { [key]: value });
    setForm(Object.assign({}, form, { items }));
  }

  function addItem() {
    setForm(Object.assign({}, form, { items: form.items.concat([Object.assign({}, EMPTY_ITEM)]) }));
  }

  function removeItem(idx) {
    setForm(Object.assign({}, form, { items: form.items.filter((_, i) => i !== idx) }));
  }

  const subtotal = (form.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit) || 0), 0);
  const total = subtotal - (Number(form.discount) || 0) + (Number(form.taxes) || 0);

  async function save() {
    try {
      const payload = Object.assign({}, form, { items: form.items });
      if (editing && editing.id) await api.put('/proposals/' + editing.id, payload);
      else await api.post('/proposals', payload);
      toast.success('Proposta salva');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function duplicate(row) {
    try {
      await api.post('/proposals/' + row.id + '/duplicate', {});
      toast.success('Proposta duplicada');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function approve(row) {
    try {
      await api.post('/proposals/' + row.id + '/approve', {});
      toast.success('Proposta aprovada');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function generateReceivable(row) {
    if (!window.confirm('Gerar uma conta a receber para esta proposta? Esta ação cria um lançamento financeiro.')) return;
    try {
      await api.post('/proposals/' + row.id + '/generate-receivable', { confirm: true });
      toast.success('Conta a receber criada');
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Propostas comerciais</h1>
          <p className="muted">Elabore, acompanhe e gere PDFs das propostas.</p>
        </div>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}>+ Nova proposta</button>}
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'number', label: 'Número' },
            { key: 'client_name', label: 'Cliente' },
            { key: 'service', label: 'Serviço' },
            { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
            { key: 'total', label: 'Total', render: (r) => money(r.total) },
            { key: 'valid_until', label: 'Validade', render: (r) => dateBR(r.valid_until) }
          ]}
          rows={rows}
          empty={<Empty title="Nenhuma proposta" hint="Crie a primeira proposta comercial." />}
          onRowClick={canWrite ? openEdit : undefined}
          actions={(r) => (
            <div className="row-actions">
              <a className="btn btn-ghost btn-sm" href={api.downloadUrl('/proposals/' + r.id + '/pdf')} target="_blank" rel="noreferrer">PDF</a>
              {canWrite && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Editar</button>}
              {canWrite && <button className="btn btn-ghost btn-sm" onClick={() => duplicate(r)}>Duplicar</button>}
              {canWrite && r.status !== 'aprovada' && <button className="btn btn-ghost btn-sm" onClick={() => approve(r)}>Aprovar</button>}
              {can(user, 'finance', 'write') && r.status === 'aprovada' && (
                <button className="btn btn-ghost btn-sm" onClick={() => generateReceivable(r)}>Gerar recebível</button>
              )}
            </div>
          )}
        />
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Editar proposta' : 'Nova proposta'}
          onClose={() => setEditing(null)}
          wide
          footer={
            <>
              <span className="spacer" />
              <strong>Total: {money(total)}</strong>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            <Field field={{ key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients', required: true }}
              value={form.client_id} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'service', label: 'Serviço' }}
              value={form.service} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'owner_id', label: 'Responsável', type: 'select', optionsFrom: 'users' }}
              value={form.owner_id} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'status', label: 'Status', type: 'select', options: STATUS }}
              value={form.status} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'valid_until', label: 'Validade', type: 'date' }}
              value={form.valid_until} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'execution_days', label: 'Prazo de execução (dias)', type: 'number' }}
              value={form.execution_days} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'scope', label: 'Escopo', type: 'textarea', full: true }}
              value={form.scope} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
          </div>

          <h4 className="mt">Itens</h4>
          <table className="items-table">
            <thead>
              <tr><th>Descrição</th><th>Qtd</th><th>Un.</th><th>Valor unit.</th><th>Total</th><th /></tr>
            </thead>
            <tbody>
              {(form.items || []).map((it, idx) => (
                <tr key={idx}>
                  <td><input value={it.desc || ''} onChange={(e) => setItem(idx, 'desc', e.target.value)} /></td>
                  <td><input type="number" step="any" value={it.qty || 0} onChange={(e) => setItem(idx, 'qty', e.target.value)} /></td>
                  <td><input value={it.unit_label || 'un'} onChange={(e) => setItem(idx, 'unit_label', e.target.value)} /></td>
                  <td><input type="number" step="any" value={it.unit || 0} onChange={(e) => setItem(idx, 'unit', e.target.value)} /></td>
                  <td>{money((Number(it.qty) || 0) * (Number(it.unit) || 0))}</td>
                  <td><button className="btn btn-ghost btn-sm danger" onClick={() => removeItem(idx)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-ghost btn-sm" onClick={addItem}>+ Adicionar item</button>

          <div className="form-grid mt">
            <Field field={{ key: 'discount', label: 'Desconto (R$)', type: 'number' }}
              value={form.discount} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'taxes', label: 'Tributos (R$)', type: 'number' }}
              value={form.taxes} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'payment_terms', label: 'Condições de pagamento', type: 'textarea', full: true }}
              value={form.payment_terms} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
            <Field field={{ key: 'notes', label: 'Observações', type: 'textarea', full: true }}
              value={form.notes} onChange={(k, v) => setForm(Object.assign({}, form, { [k]: v }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}
