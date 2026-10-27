import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, Badge, money, dateBR, useToast, Empty, Spinner, Card } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

const STATUSES = ['previsto', 'em_aberto', 'vencido', 'pago', 'recebido', 'cancelado'];
const FIELDS = [
  { key: 'description', label: 'Descrição', required: true },
  { key: 'type', label: 'Tipo', type: 'select', options: [{ value: 'receber', label: 'A receber' }, { value: 'pagar', label: 'A pagar' }], required: true },
  { key: 'amount', label: 'Valor', type: 'number', required: true },
  { key: 'category_id', label: 'Categoria', type: 'select', optionsFrom: 'categories' },
  { key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients' },
  { key: 'supplier_id', label: 'Fornecedor', type: 'select', optionsFrom: 'suppliers' },
  { key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' },
  { key: 'competence_date', label: 'Competência', type: 'date' },
  { key: 'due_date', label: 'Vencimento', type: 'date' },
  { key: 'paid_date', label: 'Pagamento', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: STATUSES },
  { key: 'payment_method_id', label: 'Forma de pagamento', type: 'select', optionsFrom: 'methods' },
  { key: 'notes', label: 'Observações', type: 'textarea', full: true }
];

export default function Finance() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const canWrite = can(user, 'finance', 'write');

  async function load() {
    setLoading(true);
    try {
      const [list, flow] = await Promise.all([
        api.get('/finance', filters),
        api.get('/finance/cashflow')
      ]);
      setRows(list.data || []);
      setCashflow(flow.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [JSON.stringify(filters)]);

  async function save() {
    try {
      const payload = Object.assign({}, form);
      if (editing && editing.id) await api.put('/finance/' + editing.id, payload);
      else await api.post('/finance', payload);
      toast.success('Lançamento salvo');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function settle(row) {
    try {
      await api.post('/finance/' + row.id + '/settle', {});
      toast.success('Lançamento liquidado');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const totals = rows.reduce((acc, r) => {
    if (r.status === 'cancelado') return acc;
    if (r.type === 'receber') acc.receivable += r.amount;
    else acc.payable += r.amount;
    return acc;
  }, { receivable: 0, payable: 0 });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Financeiro</h1>
          <p className="muted">Contas a pagar, a receber e fluxo de caixa.</p>
        </div>
        <div className="toolbar-inline">
          <a className="btn btn-ghost" href={api.downloadUrl('/finance/export?format=csv')}>Exportar CSV</a>
          <a className="btn btn-ghost" href={api.downloadUrl('/finance/export?format=pdf')} target="_blank" rel="noreferrer">Exportar PDF</a>
          {canWrite && <button className="btn btn-primary" onClick={() => { setForm({ type: 'pagar', status: 'em_aberto' }); setEditing({}); }}>
            + Novo lançamento
          </button>}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi kpi-ok"><span className="kpi-label">Total a receber</span><strong className="kpi-value">{money(totals.receivable)}</strong></div>
        <div className="kpi kpi-danger"><span className="kpi-label">Total a pagar</span><strong className="kpi-value">{money(totals.payable)}</strong></div>
        <div className="kpi kpi-info"><span className="kpi-label">Saldo previsto</span><strong className="kpi-value">{money(totals.receivable - totals.payable)}</strong></div>
      </div>

      <Card title="Fluxo de caixa por mês">
        {cashflow.length === 0 ? <p className="muted small">Sem lançamentos.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Mês</th><th>Recebido</th><th>A receber</th><th>Pago</th><th>A pagar</th><th>Saldo</th></tr></thead>
              <tbody>
                {cashflow.map((c) => (
                  <tr key={c.month}>
                    <td>{c.month}</td>
                    <td>{money(c.received)}</td>
                    <td>{money(c.receivable)}</td>
                    <td>{money(c.paid)}</td>
                    <td>{money(c.payable)}</td>
                    <td>{money((c.received || 0) - (c.paid || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="toolbar mt">
        <select className="filter" value={filters.type || ''} onChange={(e) => setFilters(Object.assign({}, filters, { type: e.target.value }))}>
          <option value="">Todos os tipos</option>
          <option value="receber">A receber</option>
          <option value="pagar">A pagar</option>
        </select>
        <select className="filter" value={filters.status || ''} onChange={(e) => setFilters(Object.assign({}, filters, { status: e.target.value }))}>
          <option value="">Todos os status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'description', label: 'Descrição' },
            { key: 'type', label: 'Tipo' },
            { key: 'amount', label: 'Valor', render: (r) => money(r.amount) },
            { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
            { key: 'due_date', label: 'Vencimento', render: (r) => dateBR(r.due_date) },
            { key: 'paid_date', label: 'Liquidação', render: (r) => dateBR(r.paid_date) },
            { key: 'project_name', label: 'Projeto' }
          ]}
          rows={rows}
          empty={<Empty title="Nenhum lançamento" hint="Registre contas a pagar e a receber." />}
          onRowClick={canWrite ? (r) => { setForm(r); setEditing(r); } : undefined}
          actions={(r) => (
            <div className="row-actions">
              {canWrite && ['pago', 'recebido', 'cancelado'].indexOf(r.status) === -1 && (
                <button className="btn btn-ghost btn-sm" onClick={() => settle(r)}>Liquidar</button>
              )}
              {canWrite && <button className="btn btn-ghost btn-sm" onClick={() => { setForm(r); setEditing(r); }}>Editar</button>}
            </div>
          )}
        />
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Editar lançamento' : 'Novo lançamento'}
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
          </div>
        </Modal>
      )}
    </div>
  );
}
