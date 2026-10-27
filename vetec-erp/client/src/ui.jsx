import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { useLookups } from './lookups.jsx';

/* ---------------- Toasts ---------------- */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, kind) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => prev.concat([{ id, message, kind: kind || 'info' }]));
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ success: (m) => push(m, 'success'), error: (m) => push(m, 'error'), info: (m) => push(m, 'info') }}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div key={t.id} className={'toast toast-' + t.kind}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) || { success: () => {}, error: () => {}, info: () => {} };
}

/* ---------------- Componentes básicos ---------------- */
export function Card({ title, subtitle, actions, children, className }) {
  return (
    <section className={'card ' + (className || '')}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function Badge({ value }) {
  const map = {
    ativo: 'ok', concluido: 'ok', aprovada: 'ok', ganho: 'ok', recebido: 'ok', pago: 'ok',
    pago_: 'ok', resolvida: 'ok', disponivel: 'ok',
    vencido: 'danger', perdido: 'danger', atrasado: 'danger', cancelado: 'muted', inativo: 'muted',
    em_andamento: 'info', enviada: 'info', negociacao: 'info', em_negociacao: 'info',
    pendente: 'warn', em_aberto: 'warn', previsto: 'warn', rascunho: 'muted', aberta: 'danger',
    manutencao: 'warn', planejamento: 'info', em_pausa: 'warn', recusada: 'danger', expirada: 'danger'
  };
  const cls = map[value] || 'muted';
  const label = String(value || '').replace(/_/g, ' ');
  return <span className={'badge badge-' + cls}>{label}</span>;
}

export function Spinner() {
  return <div className="spinner" aria-label="Carregando" />;
}

export function Empty({ title, hint, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">▤</div>
      <h4>{title || 'Nenhum registro encontrado'}</h4>
      {hint && <p className="muted small">{hint}</p>}
      {action}
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal ' + (wide ? 'modal-wide' : '')}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" style={{ color: '#fff', fontSize: '24px' }} onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------------- Campos de formulário ---------------- */
export function Field({ field, value, onChange }) {
  const lookups = useLookups();

  const optionsFrom = (src) => {
    if (!src) return [];
    const map = {
      clients: [lookups.clients, 'name'],
      users: [lookups.users, 'name'],
      projects: [lookups.projects, 'name'],
      suppliers: [lookups.suppliers, 'name'],
      categories: [lookups.categories, 'name'],
      methods: [lookups.methods, 'name'],
      contracts: [lookups.contracts, 'number'],
      opportunities: [lookups.opportunities, 'title'],
      proposals: [lookups.proposals, 'number']
    };
    const entry = map[src];
    if (!entry) return [];
    return (entry[0] || []).map((o) => ({ value: o.id, label: o[entry[1]] || ('#' + o.id) }));
  };

  const opts = field.optionsFrom
    ? optionsFrom(field.optionsFrom)
    : (field.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o.replace(/_/g, ' ') } : o));

  const common = {
    id: 'f-' + field.key,
    name: field.key,
    value: value === undefined || value === null ? '' : value,
    required: !!field.required,
    disabled: !!field.readOnly,
    onChange: (e) => onChange(field.key, field.type === 'number' ? e.target.value : e.target.value)
  };

  return (
    <div className={'field ' + (field.full ? 'field-full' : '')}>
      <label htmlFor={common.id}>{field.label}{field.required ? ' *' : ''}</label>

      {field.type === 'textarea' && (
        <textarea {...common} rows={field.rows || 3} placeholder={field.placeholder || ''} />
      )}

      {field.type === 'select' && (
        <select {...common}>
          <option value="">— selecione —</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      {field.type === 'checkbox' && (
        <input
          id={common.id}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(field.key, e.target.checked)}
        />
      )}

      {(!field.type || field.type === 'text' || field.type === 'number' || field.type === 'date' ||
        field.type === 'datetime-local' || field.type === 'email' || field.type === 'password') && (
        <input
          {...common}
          type={field.type || 'text'}
          step={field.type === 'number' ? 'any' : undefined}
          placeholder={field.placeholder || ''}
        />
      )}

      {field.hint && <small className="muted">{field.hint}</small>}
    </div>
  );
}

/* ---------------- Tabela ---------------- */
export function DataTable({ columns, rows, loading, empty, onRowClick, actions }) {
  if (loading) return <div className="table-loading"><Spinner /></div>;
  if (!rows || rows.length === 0) return empty || <Empty />;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
            {actions && <th className="col-actions">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={onRowClick ? 'clickable' : ''}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(r) : (r[c.key] === null || r[c.key] === undefined ? <span className="muted">—</span> : r[c.key])}
                </td>
              ))}
              {actions && <td className="col-actions" onClick={(e) => e.stopPropagation()}>{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, total, onPage }) {
  if (!pages || pages <= 1) return <div className="muted small">{total || 0} registro(s)</div>;
  return (
    <div className="pagination">
      <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
      <span className="small">Página {page} de {pages} · {total} registros</span>
      <button className="btn btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Próxima</button>
    </div>
  );
}

export function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dateBR(v) {
  if (!v) return '—';
  const s = String(v).slice(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return s;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}
