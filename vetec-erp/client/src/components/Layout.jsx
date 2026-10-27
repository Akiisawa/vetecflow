import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth, can } from '../auth.jsx';
import { api } from '../api.js';

const NAV = [
  { section: 'Visão geral', items: [
    { to: '/', label: 'Dashboard', icon: '◧', perm: ['dashboard', 'read'] }
  ]},
  { section: 'Comercial', items: [
    { to: '/clients', label: 'Clientes', icon: '◉', perm: ['clients', 'read'] },
    { to: '/crm', label: 'CRM / Oportunidades', icon: '◈', perm: ['crm', 'read'] },
    { to: '/proposals', label: 'Propostas', icon: '▤', perm: ['proposals', 'read'] },
    { to: '/contracts', label: 'Contratos', icon: '▦', perm: ['contracts', 'read'] }
  ]},
  { section: 'Operações', items: [
    { to: '/projects', label: 'Projetos e obras', icon: '◆', perm: ['projects', 'read'] },
    { to: '/tasks', label: 'Tarefas', icon: '☑', perm: ['tasks', 'read'] },
    { to: '/timesheets', label: 'Horas', icon: '◔', perm: ['timesheets', 'read'] },
    { to: '/incidents', label: 'Ocorrências', icon: '⚠', perm: ['incidents', 'read'] },
    { to: '/documents', label: 'Documentos', icon: '▣', perm: ['documents', 'read'] }
  ]},
  { section: 'Financeiro', items: [
    { to: '/finance', label: 'Financeiro', icon: '◫', perm: ['finance', 'read'] },
    { to: '/suppliers', label: 'Fornecedores', icon: '⌂', perm: ['suppliers', 'read'] },
    { to: '/assets', label: 'Equipamentos', icon: '⚙', perm: ['assets', 'read'] }
  ]},
  { section: 'Organização', items: [
    { to: '/team', label: 'Equipe', icon: '☺', perm: ['team', 'read'] },
    { to: '/calendar', label: 'Calendário', icon: '▩', perm: ['calendar', 'read'] },
    { to: '/reports', label: 'Relatórios', icon: '≣', perm: ['reports', 'read'] },
    { to: '/audit', label: 'Auditoria', icon: '⛨', perm: ['audit', 'read'] },
    { to: '/users', label: 'Usuários', icon: '☰', perm: ['team', 'write'] }
  ]}
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => { setSidebarOpen(false); setShowNotif(false); }, [location.pathname]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await api.get('/notifications');
        if (active) setNotifications(res.data || []);
      } catch (e) { /* silencioso */ }
    }
    load();
    const t = setInterval(load, 60000);
    return () => { active = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!search || search.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/search', { q: search });
        setResults(res);
      } catch (e) { setResults(null); }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all', {});
      setNotifications([]);
    } catch (e) {}
  }

  const crumbs = location.pathname.split('/').filter(Boolean);

  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (sidebarOpen ? 'open' : '')}>
        <div className="brand">
          <div className="brand-mark">VT</div>
          <div>
            <strong>VETEC</strong>
            <span className="brand-sub">Engenharia · ERP</span>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((group) => {
            const items = group.items.filter((i) => can(user, i.perm[0], i.perm[1]));
            if (!items.length) return null;
            return (
              <div key={group.section} className="nav-group">
                <div className="nav-section">{group.section}</div>
                {items.map((i) => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    end={i.to === '/'}
                    className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
                  >
                    <span className="nav-icon">{i.icon}</span>
                    {i.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{(user.name || '?').slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{user.name}</strong>
              <span className="muted small">{user.role}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>
            Sair
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setSidebarOpen((v) => !v)} aria-label="Menu">☰</button>

          <div className="global-search">
            <input
              placeholder="Buscar clientes, projetos, propostas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {results && (
              <div className="search-results">
                {['clients', 'projects', 'proposals', 'contracts', 'tasks'].map((key) => {
                  const list = results[key] || [];
                  if (!list.length) return null;
                  const label = { clients: 'Clientes', projects: 'Projetos', proposals: 'Propostas', contracts: 'Contratos', tasks: 'Tarefas' }[key];
                  return (
                    <div key={key} className="search-group">
                      <div className="search-group-title">{label}</div>
                      {list.map((r) => (
                        <button
                          key={key + r.id}
                          className="search-item"
                          onClick={() => {
                            setSearch(''); setResults(null);
                            if (key === 'clients') navigate('/clients/' + r.id);
                            else if (key === 'projects') navigate('/projects/' + r.id);
                            else if (key === 'proposals') navigate('/proposals');
                            else if (key === 'contracts') navigate('/contracts');
                            else navigate('/tasks');
                          }}
                        >
                          {r.name || r.title || r.number || r.service}
                        </button>
                      ))}
                    </div>
                  );
                })}
                {Object.values(results).every((v) => !v || v.length === 0) && (
                  <div className="search-item muted">Nenhum resultado</div>
                )}
              </div>
            )}
          </div>

          <div className="topbar-actions">
            <div className="notif-wrap">
              <button className="icon-btn" onClick={() => setShowNotif((v) => !v)} aria-label="Notificações">
                ◔ {notifications.length > 0 && <span className="dot">{notifications.length}</span>}
              </button>
              {showNotif && (
                <div className="notif-panel">
                  <div className="notif-head">
                    <strong>Notificações</strong>
                    {notifications.length > 0 && (
                      <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Marcar lidas</button>
                    )}
                  </div>
                  {notifications.length === 0 && <p className="muted small" style={{ padding: 16 }}>Nada por aqui.</p>}
                  {notifications.map((n) => (
                    <div key={n.id} className={'notif-item notif-' + n.kind}>
                      <strong>{n.title}</strong>
                      <p className="small">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="avatar small">{(user.name || '?').slice(0, 2).toUpperCase()}</div>
          </div>
        </header>

        <div className="breadcrumbs">
          <Link to="/">Início</Link>
          {crumbs.map((c, i) => (
            <span key={i}> / {c}</span>
          ))}
        </div>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
