import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Spinner, Badge, money, dateBR, useToast, Empty, Modal, Field } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';

const TABS = ['Visão geral', 'Tarefas', 'Equipe', 'Financeiro', 'Rentabilidade', 'Ocorrências', 'Horas', 'Diário', 'Documentos'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const lookups = useLookups();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Visão geral');
  const [diaryForm, setDiaryForm] = useState(null);

  async function load() {
    try {
      const res = await api.get('/projects/' + id + '/full');
      setData(res);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="page"><Spinner /></div>;
  if (!data) return <div className="page"><Empty title="Projeto não encontrado" /></div>;

  const p = data.project;
  const r = data.profitability;

  async function saveDiary() {
    try {
      await api.post('/projects/' + id + '/diary', diaryForm);
      toast.success('Diário registrado');
      setDiaryForm(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>← Projetos</button>
          <h1>{p.code} — {p.name}</h1>
          <p className="muted">{p.client_name || 'Sem cliente'} · <Badge value={p.status} /> · Progresso {p.progress}%</p>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={'tab ' + (tab === t ? 'active' : '')} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Visão geral' && (
        <div className="two-col">
          <Card title="Dados do projeto">
            <dl className="dl">
              <dt>Local</dt><dd>{p.location || '—'}</dd>
              <dt>Início</dt><dd>{dateBR(p.start_date)}</dd>
              <dt>Prazo</dt><dd>{dateBR(p.due_date)}</dd>
              <dt>Conclusão prevista</dt><dd>{dateBR(p.expected_end)}</dd>
              <dt>Orçamento</dt><dd>{money(p.budget)}</dd>
              <dt>Receita contratada</dt><dd>{money(p.contracted_revenue)}</dd>
              <dt>Responsável</dt><dd>{p.owner_name || '—'}</dd>
            </dl>
          </Card>
          <Card title="Resumo operacional">
            <ul className="alert-list">
              <li><span>Tarefas</span><strong>{data.tasks.length}</strong></li>
              <li><span>Tarefas concluídas</span><strong>{data.tasks.filter((t) => t.status === 'concluida').length}</strong></li>
              <li><span>Ocorrências abertas</span><strong>{data.incidents.filter((i) => i.status === 'aberta').length}</strong></li>
              <li><span>Horas lançadas</span><strong>{data.timesheets.reduce((s, t) => s + t.hours, 0).toFixed(1)}h</strong></li>
              <li><span>Documentos</span><strong>{data.documents.length}</strong></li>
            </ul>
          </Card>
        </div>
      )}

      {tab === 'Tarefas' && (
        <Table rows={data.tasks} cols={[
          { key: 'title', label: 'Tarefa' },
          { key: 'assignee_name', label: 'Responsável' },
          { key: 'status', label: 'Status', render: (r2) => <Badge value={r2.status} /> },
          { key: 'priority', label: 'Prioridade' },
          { key: 'due_date', label: 'Prazo', render: (r2) => dateBR(r2.due_date) }
        ]} />
      )}

      {tab === 'Equipe' && (
        <Table rows={data.members} cols={[
          { key: 'user_name', label: 'Nome' },
          { key: 'email', label: 'E-mail' },
          { key: 'role', label: 'Função no projeto' }
        ]} />
      )}

      {tab === 'Financeiro' && (
        <Table rows={data.finance} cols={[
          { key: 'description', label: 'Descrição' },
          { key: 'type', label: 'Tipo' },
          { key: 'amount', label: 'Valor', render: (r2) => money(r2.amount) },
          { key: 'status', label: 'Status', render: (r2) => <Badge value={r2.status} /> },
          { key: 'due_date', label: 'Vencimento', render: (r2) => dateBR(r2.due_date) }
        ]} />
      )}

      {tab === 'Rentabilidade' && (
        <div className="two-col">
          <Card title="Receita e custos">
            <ul className="alert-list">
              <li><span>Receita contratada</span><strong>{money(r.contracted_revenue)}</strong></li>
              <li><span>Receita recebida</span><strong>{money(r.revenue_realized)}</strong></li>
              <li><span>Receita pendente</span><strong>{money(r.revenue_open)}</strong></li>
              <li><span>Custos realizados</span><strong>{money(r.cost_realized)}</strong></li>
              <li><span>Custos previstos</span><strong>{money(r.cost_open)}</strong></li>
            </ul>
          </Card>
          <Card title="Resultado">
            <ul className="alert-list">
              <li><span>Resultado estimado</span><strong>{money(r.result_estimated)}</strong></li>
              <li><span>Margem estimada</span><strong>{r.margin_estimated}%</strong></li>
              <li><span>Orçamento</span><strong>{money(r.budget)}</strong></li>
              <li><span>Desvio orçamentário</span><strong>{r.budget_deviation}%</strong></li>
            </ul>
            {r.budget_deviation > 0 && (
              <div className="alert alert-error">Atenção: os custos realizados já ultrapassaram o orçamento.</div>
            )}
          </Card>
        </div>
      )}

      {tab === 'Ocorrências' && (
        <Table rows={data.incidents} cols={[
          { key: 'date', label: 'Data', render: (r2) => dateBR(r2.date) },
          { key: 'type', label: 'Tipo' },
          { key: 'severity', label: 'Gravidade' },
          { key: 'status', label: 'Status', render: (r2) => <Badge value={r2.status} /> },
          { key: 'description', label: 'Descrição' }
        ]} />
      )}

      {tab === 'Horas' && (
        <Table rows={data.timesheets} cols={[
          { key: 'date', label: 'Data', render: (r2) => dateBR(r2.date) },
          { key: 'user_name', label: 'Colaborador' },
          { key: 'hours', label: 'Horas' },
          { key: 'status', label: 'Status', render: (r2) => <Badge value={r2.status} /> },
          { key: 'description', label: 'Descrição' }
        ]} />
      )}

      {tab === 'Diário' && (
        <>
          <div className="toolbar">
            <button className="btn btn-primary btn-sm" onClick={() => setDiaryForm({ date: new Date().toISOString().slice(0, 10) })}>
              + Registrar diário
            </button>
          </div>
          <Table rows={data.diary} cols={[
            { key: 'date', label: 'Data', render: (r2) => dateBR(r2.date) },
            { key: 'user_name', label: 'Responsável' },
            { key: 'activities', label: 'Atividades' },
            { key: 'problems', label: 'Problemas' },
            { key: 'notes', label: 'Observações' }
          ]} />
        </>
      )}

      {tab === 'Documentos' && (
        <Table rows={data.documents} cols={[
          { key: 'name', label: 'Nome' },
          { key: 'category', label: 'Categoria' },
          { key: 'id', label: 'Download', render: (r2) => (
            <a className="link" href={api.downloadUrl('/documents/' + r2.id + '/download')} target="_blank" rel="noreferrer">baixar</a>
          )}
        ]} />
      )}

      {diaryForm && (
        <Modal
          title="Registrar diário de obra"
          onClose={() => setDiaryForm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDiaryForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveDiary}>Salvar</button>
            </>
          }
        >
          <div className="form-grid">
            <Field field={{ key: 'date', label: 'Data', type: 'date', required: true }} value={diaryForm.date}
              onChange={(k, v) => setDiaryForm(Object.assign({}, diaryForm, { [k]: v }))} />
            <Field field={{ key: 'activities', label: 'Atividades executadas', type: 'textarea', full: true }} value={diaryForm.activities}
              onChange={(k, v) => setDiaryForm(Object.assign({}, diaryForm, { [k]: v }))} />
            <Field field={{ key: 'problems', label: 'Problemas encontrados', type: 'textarea', full: true }} value={diaryForm.problems}
              onChange={(k, v) => setDiaryForm(Object.assign({}, diaryForm, { [k]: v }))} />
            <Field field={{ key: 'notes', label: 'Observações', type: 'textarea', full: true }} value={diaryForm.notes}
              onChange={(k, v) => setDiaryForm(Object.assign({}, diaryForm, { [k]: v }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Table({ rows, cols }) {
  if (!rows || rows.length === 0) return <Empty title="Sem registros" />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r2, i) => (
            <tr key={r2.id || i}>
              {cols.map((c) => <td key={c.key}>{c.render ? c.render(r2) : (r2[c.key] || <span className="muted">—</span>)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
