import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Spinner, money, dateBR, Badge, useToast } from '../ui.jsx';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const toast = useToast();

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/summary', { from, to });
      setData(res);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [from, to]);

  if (loading && !data) return <div className="page"><Spinner /></div>;
  if (!data) return null;

  const k = data.kpis;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard executivo</h1>
          <p className="muted">Indicadores calculados a partir dos dados registrados.</p>
        </div>
        
        <div className="toolbar-inline" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input className="filter" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="muted">até</span>
          <input className="filter" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          {(from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>Limpar</button>}
        </div>
  
      </div>

      <div className="kpi-grid">
        <Kpi label="Receita recebida" value={money(k.revenueReceived)} tone="ok" />
        <Kpi label="Receitas previstas" value={money(k.revenueExpected)} tone="info" />
        <Kpi label="Despesas pagas" value={money(k.expensesPaid)} tone="danger" />
        <Kpi label="Despesas previstas" value={money(k.expensesExpected)} tone="warn" />
        <Kpi label="Saldo (recebido - pago)" value={money(k.balance)} tone={k.balance >= 0 ? 'ok' : 'danger'} />
        <Kpi label="Projetos ativos" value={k.activeProjects} tone="info" />
        <Kpi label="Projetos atrasados" value={k.lateProjects} tone={k.lateProjects ? 'danger' : 'ok'} />
        <Kpi label="Clientes ativos" value={k.activeClients} tone="info" />
        <Kpi label="Propostas em aberto" value={k.openProposals} tone="info" />
        <Kpi label="Conversão comercial" value={k.conversionRate + '%'} tone="info" />
        <Kpi label="Tarefas pendentes" value={k.pendingTasks} tone="warn" />
      </div>

      <div className="chart-grid">
        <Card title="Receitas e despesas por mês">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.charts.monthly}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" />
              <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="revenue" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Resultado financeiro mensal">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.charts.monthly.map((m) => ({ month: m.month, result: (m.revenue || 0) - (m.expense || 0) }))}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" />
              <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
              <Line type="monotone" dataKey="result" name="Resultado" stroke="#1d6fa5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Projetos por status">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.charts.projectsByStatus} dataKey="count" nameKey="status" outerRadius={90} label>
                {data.charts.projectsByStatus.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Propostas por etapa">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.charts.proposalsByStage} layout="vertical">
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="status" width={110} fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" name="Propostas" fill="#1d6fa5" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Receita por cliente">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.charts.revenueByClient} layout="vertical">
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="client" width={140} fontSize={11} />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
              <Bar dataKey="total" name="Receita" fill="#2fa27a" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Custos por projeto">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.charts.costsByProject} layout="vertical">
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="project" width={140} fontSize={11} />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
              <Bar dataKey="total" name="Custos" fill="#b91c1c" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="chart-grid">
        <AlertCard title="Contas vencidas" items={data.alerts.overdueAccounts.map((a) => ({
          key: a.id, text: a.description, meta: money(a.amount) + ' · ' + dateBR(a.due_date)
        }))} />
        <AlertCard title="Projetos atrasados" items={data.alerts.lateProjects.map((p) => ({
          key: p.id, text: p.code + ' — ' + p.name, meta: 'prazo ' + dateBR(p.due_date)
        }))} />
        <AlertCard title="Tarefas vencidas" items={data.alerts.overdueTasks.map((t) => ({
          key: t.id, text: t.title, meta: 'prazo ' + dateBR(t.due_date)
        }))} />
        <AlertCard title="Propostas vencendo" items={data.alerts.expiringProposals.map((p) => ({
          key: p.id, text: p.number, meta: 'válida até ' + dateBR(p.valid_until)
        }))} />
        <AlertCard title="Contratos vencendo" items={data.alerts.expiringContracts.map((c) => ({
          key: c.id, text: c.number, meta: 'término ' + dateBR(c.end_date)
        }))} />
        <AlertCard title="Projetos acima do orçamento" items={data.alerts.overBudgetProjects.map((p) => ({
          key: p.id, text: p.name, meta: 'orçamento ' + money(p.budget) + ' · custo ' + money(p.cost)
        }))} />
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className={'kpi kpi-' + (tone || 'info')}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
    </div>
  );
}

function AlertCard({ title, items }) {
  return (
    <Card title={title}>
      {items.length === 0 && <p className="muted small">Nenhum alerta.</p>}
      <ul className="alert-list">
        {items.map((i) => (
          <li key={i.key}>
            <span>{i.text}</span>
            <span className="muted small">{i.meta}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
