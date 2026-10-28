import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Spinner, money, dateBR, useToast } from '../ui.jsx';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981'];

// Configuração do Tooltip (Fundo de vidro, sem bordas duras)
const tooltipStyle = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
  backdropFilter: 'blur(10px)',
  padding: '12px 16px',
};

const tooltipItemStyle = { color: 'var(--text-main)', fontWeight: 600, fontSize: 13 };
const tooltipLabelStyle = { color: 'var(--text-muted)', marginBottom: 6, fontSize: 12 };

function KpiCard({ label, value, icon, color, isMoney, isPercent }) {
  return (
    <div className="kpi-card-premium">
      <div className="kpi-header">
        <div className="kpi-icon" style={{ color: color, background: `${color}15` }}>
          <i className={`fa-solid ${icon}`}></i>
        </div>
        <span className="kpi-label">{label}</span>
      </div>
      <strong className="kpi-value">
        {isMoney ? money(value) : isPercent ? `${value}%` : value}
      </strong>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isTvMode, setIsTvMode] = useState(false);
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isTvMode) setIsTvMode(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTvMode]);

  if (loading && !data) return <div className="page"><Spinner /></div>;
  if (!data) return null;

  const k = data.kpis;
  
  const totalProjects = data.charts.projectsByStatus.reduce((acc, curr) => acc + curr.count, 0);
  const completedProjects = data.charts.projectsByStatus.find(s => s.status === 'concluido')?.count || 0;
  const completionPercentage = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;

  const content = (
    <div className={`dashboard-wrapper ${isTvMode ? 'tv-mode-active' : ''}`}>
      
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: isTvMode ? 32 : 24, transition: '0.3s' }}>Dashboard Executivo</h1>
          <p className="muted">Visão geral em tempo real.</p>
        </div>
        <div className="toolbar-inline">
          {!isTvMode && (
            <>
              <input className="filter" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="muted small">até</span>
              <input className="filter" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              {(from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>Limpar</button>}
            </>
          )}
          <button 
            className={`btn ${isTvMode ? 'btn-danger' : 'btn-primary'}`} 
            style={{ marginLeft: 16 }}
            onClick={() => setIsTvMode(!isTvMode)}
          >
            <i className={`fa-solid ${isTvMode ? 'fa-xmark' : 'fa-tv'}`}></i>
            {isTvMode ? 'Sair do Modo TV' : 'Modo Big Picture'}
          </button>
        </div>
      </div>

      <div className="kpi-grid-premium">
        <KpiCard label="Receita Recebida" value={k.revenueReceived} icon="fa-arrow-trend-up" color="#10b981" isMoney />
        <KpiCard label="Receitas Previstas" value={k.revenueExpected} icon="fa-calendar-check" color="#3b82f6" isMoney />
        <KpiCard label="Despesas Pagas" value={k.expensesPaid} icon="fa-arrow-trend-down" color="#ef4444" isMoney />
        <KpiCard label="Despesas Previstas" value={k.expensesExpected} icon="fa-file-invoice-dollar" color="#f59e0b" isMoney />
        <KpiCard label="Saldo Geral" value={k.balance} icon="fa-wallet" color={k.balance >= 0 ? "#10b981" : "#ef4444"} isMoney />
        <KpiCard label="Projetos Ativos" value={k.activeProjects} icon="fa-helmet-safety" color="#8b5cf6" />
        <KpiCard label="Clientes Ativos" value={k.activeClients} icon="fa-building" color="#06b6d4" />
        <KpiCard label="Taxa de Conversão" value={k.conversionRate} icon="fa-bullseye" color="#ec4899" isPercent />
      </div>

      <div className="charts-grid-premium">
        
        {/* FLUXO DE CAIXA */}
        <div className="chart-card-premium span-2">
          <div className="chart-header">
            <h3>Fluxo de Receitas e Despesas</h3>
            <span className="badge badge-info">Anual</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.charts.monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--text-muted)" dy={10} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--text-muted)" tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip 
                contentStyle={tooltipStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
                cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }}
                formatter={(v) => money(v)} 
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
              <Area type="monotone" dataKey="revenue" name="Receitas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#gradRevenue)" animationDuration={1500} />
              <Area type="monotone" dataKey="expense" name="Despesas" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#gradExpense)" animationDuration={1500} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* STATUS DOS PROJETOS */}
        <div className="chart-card-premium">
          <div className="chart-header">
            <h3>Status dos Projetos</h3>
          </div>
          <div style={{ position: 'relative', width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={data.charts.projectsByStatus} 
                  innerRadius={75} 
                  outerRadius={105} 
                  paddingAngle={6} 
                  dataKey="count" 
                  nameKey="status"
                  animationDuration={1000}
                  stroke="none"
                  cy="45%"
                >
                  {data.charts.projectsByStatus.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip 
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
            
            <div style={{
              position: 'absolute',
              top: '43%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'none',
              zIndex: 10
            }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
                {completionPercentage}%
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginTop: 4, letterSpacing: 0.5 }}>
                Concluídos
              </span>
            </div>
          </div>
        </div>

        {/* PROPOSTAS POR ETAPA */}
        <div className="chart-card-premium span-2">
          <div className="chart-header">
            <h3>Propostas por Etapa</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.charts.proposalsByStage} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="status" tickLine={false} axisLine={false} fontSize={12} stroke="var(--text-muted)" dy={10} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--text-muted)" />
              
              {/* Cursor transparente para não criar a caixa preta */}
              <Tooltip 
                contentStyle={tooltipStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} 
              />
              
              <Bar dataKey="count" name="Propostas" radius={[8, 8, 0, 0]} barSize={40} animationDuration={1200}>
                {data.charts.proposalsByStage.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* RECEITA POR CLIENTE */}
        <div className="chart-card-premium">
          <div className="chart-header">
            <h3>Receita por Cliente</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.charts.revenueByClient} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} stroke="var(--text-muted)" tickFormatter={(val) => `${val / 1000}k`} />
              <YAxis type="category" dataKey="client" tickLine={false} axisLine={false} fontSize={12} stroke="var(--text-muted)" width={100} />
              
              <Tooltip 
                contentStyle={tooltipStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                formatter={(v) => money(v)} 
              />
              
              <Bar dataKey="total" name="Receita" fill="#f59e0b" radius={[0, 8, 8, 0]} barSize={24} animationDuration={1500} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );

  return isTvMode ? <div className="tv-overlay">{content}</div> : content;
}
