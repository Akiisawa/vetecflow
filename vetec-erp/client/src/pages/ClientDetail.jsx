import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Spinner, Badge, money, dateBR, useToast, Empty } from '../ui.jsx';

const TABS = ['Resumo', 'Contatos', 'Leads', 'Oportunidades', 'Propostas', 'Contratos', 'Projetos', 'Documentos', 'Financeiro', 'Histórico'];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('Resumo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/clients/' + id + '/full');
        setData(res);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="page"><Spinner /></div>;
  if (!data) return <div className="page"><Empty title="Cliente não encontrado" /></div>;

  const c = data.client;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clients')}>← Clientes</button>
          <h1>{c.name}</h1>
          <p className="muted">{c.trade_name || c.segment || '—'} · <Badge value={c.status} /></p>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={'tab ' + (tab === t ? 'active' : '')} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Resumo' && (
        <div className="two-col">
          <Card title="Dados cadastrais">
            <dl className="dl">
              <Row label="Tipo" value={c.type} />
              <Row label="CPF/CNPJ" value={c.doc} />
              <Row label="Telefone" value={c.phone} />
              <Row label="WhatsApp" value={c.whatsapp} />
              <Row label="E-mail" value={c.email} />
              <Row label="Site" value={c.website} />
              <Row label="Endereço" value={[c.address, c.city, c.state].filter(Boolean).join(', ')} />
              <Row label="Segmento" value={c.segment} />
              <Row label="Observações" value={c.notes} />
            </dl>
          </Card>
          <Card title="Resumo financeiro">
            {data.totals.length === 0 && <p className="muted small">Sem lançamentos financeiros.</p>}
            <ul className="alert-list">
              {data.totals.map((t) => (
                <li key={t.type}>
                  <span>{t.type === 'receber' ? 'A receber' : 'A pagar'}</span>
                  <strong>{money(t.total)}</strong>
                </li>
              ))}
            </ul>
            <h4 className="mt">Contadores</h4>
            <ul className="alert-list">
              <li><span>Projetos</span><strong>{data.projects.length}</strong></li>
              <li><span>Propostas</span><strong>{data.proposals.length}</strong></li>
              <li><span>Contratos</span><strong>{data.contracts.length}</strong></li>
              <li><span>Documentos</span><strong>{data.documents.length}</strong></li>
            </ul>
          </Card>
        </div>
      )}

      {tab === 'Contatos' && <SimpleTable rows={data.contacts} cols={[
        { key: 'name', label: 'Nome' }, { key: 'role', label: 'Função' },
        { key: 'email', label: 'E-mail' }, { key: 'phone', label: 'Telefone' }
      ]} />}

      {tab === 'Leads' && <SimpleTable rows={data.leads} cols={[
        { key: 'name', label: 'Nome' }, { key: 'source', label: 'Origem' },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> }
      ]} />}

      {tab === 'Oportunidades' && <SimpleTable rows={data.opportunities} cols={[
        { key: 'title', label: 'Título' }, { key: 'stage', label: 'Etapa', render: (r) => <Badge value={r.stage} /> },
        { key: 'value', label: 'Valor', render: (r) => money(r.value) }
      ]} />}

      {tab === 'Propostas' && <SimpleTable rows={data.proposals} cols={[
        { key: 'number', label: 'Número' }, { key: 'service', label: 'Serviço' },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'total', label: 'Total', render: (r) => money(r.total) },
        { key: 'valid_until', label: 'Validade', render: (r) => dateBR(r.valid_until) }
      ]} />}

      {tab === 'Contratos' && <SimpleTable rows={data.contracts} cols={[
        { key: 'number', label: 'Número' }, { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'value', label: 'Valor', render: (r) => money(r.value) },
        { key: 'end_date', label: 'Término', render: (r) => dateBR(r.end_date) }
      ]} />}

      {tab === 'Projetos' && <SimpleTable rows={data.projects} cols={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Projeto', render: (r) => <Link className="link" to={'/projects/' + r.id}>{r.name}</Link> },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'progress', label: 'Progresso', render: (r) => r.progress + '%' }
      ]} />}

      {tab === 'Documentos' && <SimpleTable rows={data.documents} cols={[
        { key: 'name', label: 'Nome' }, { key: 'category', label: 'Categoria' },
        { key: 'created_at', label: 'Enviado em', render: (r) => dateBR(r.created_at) },
        { key: 'id', label: 'Download', render: (r) => (
          <a className="link" href={api.downloadUrl('/documents/' + r.id + '/download')} target="_blank" rel="noreferrer">baixar</a>
        )}
      ]} />}

      {tab === 'Financeiro' && <SimpleTable rows={data.finance} cols={[
        { key: 'description', label: 'Descrição' },
        { key: 'type', label: 'Tipo' },
        { key: 'amount', label: 'Valor', render: (r) => money(r.amount) },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'due_date', label: 'Vencimento', render: (r) => dateBR(r.due_date) }
      ]} />}

      {tab === 'Histórico' && <SimpleTable rows={data.audit} cols={[
        { key: 'created_at', label: 'Data', render: (r) => dateBR(r.created_at) },
        { key: 'action', label: 'Ação' },
        { key: 'entity', label: 'Entidade' }
      ]} />}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value || <span className="muted">—</span>}</dd>
    </>
  );
}

function SimpleTable({ rows, cols }) {
  if (!rows || rows.length === 0) return <Empty title="Sem registros nesta seção" />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i}>
              {cols.map((c) => (
                <td key={c.key}>{c.render ? c.render(r) : (r[c.key] || <span className="muted">—</span>)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
