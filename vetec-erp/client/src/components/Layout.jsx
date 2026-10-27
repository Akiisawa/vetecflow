import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, can } from '../auth.jsx';
import { api } from '../api.js';

const NAV = [
  { section: 'Principal', items: [
    { to: '/', label: 'Dashboard', icon: 'fa-chart-pie', perm: ['dashboard', 'read'] }
  ]},
  { section: 'Cadastros', items: [
    { to: '/clients', label: 'Clientes', icon: 'fa-building', perm: ['clients', 'read'] },
    { to: '/crm', label: 'CRM', icon: 'fa-bullseye', perm: ['crm', 'read'] },
    { to: '/proposals', label: 'Propostas', icon: 'fa-file-signature', perm: ['proposals', 'read'] },
    { to: '/contracts', label: 'Contratos', icon: 'fa-file-contract', perm: ['contracts', 'read'] },
    { to: '/projects', label: 'Projetos', icon: 'fa-helmet-safety', perm: ['projects', 'read'] },
    { to: '/tasks', label: 'Tarefas', icon: 'fa-list-check', perm: ['tasks', 'read'] }
  ]},
  { section: 'Operação', items: [
    { to: '/timesheets', label: 'Horas', icon: 'fa-clock', perm: ['timesheets', 'read'] },
    { to: '/incidents', label: 'Ocorrências', icon: 'fa-triangle-exclamation', perm: ['incidents', 'read'] },
    { to: '/documents', label: 'Documentos', icon: 'fa-folder-open', perm: ['documents', 'read'] }
  ]},
  { section: 'Financeiro', items: [
    { to: '/finance', label: 'Financeiro', icon: 'fa-sack-dollar', perm: ['finance', 'read'] },
    { to: '/suppliers', label: 'Fornecedores', icon: 'fa-truck-field', perm: ['suppliers', 'read'] },
    { to: '/assets', label: 'Equipamentos', icon: 'fa-gears', perm: ['assets', 'read'] }
  ]},
  { section: 'Sistema', items: [
    { to: '/team', label: 'Equipe', icon: 'fa-users', perm: ['team', 'read'] },
    { to: '/calendar', label: 'Calendário', icon: 'fa-calendar-days', perm: ['calendar', 'read'] },
    { to: '/reports', label: 'Relatórios', icon: 'fa-chart-line', perm: ['reports', 'read'] },
    { to: '/audit', label: 'Auditoria', icon: 'fa-shield-halved', perm: ['audit', 'read'] },
    { to: '/users', label: 'Usuários', icon: 'fa-user-gear', perm: ['team', 'write'] }
  ]}
];

export default function Layout({ theme, setTheme }) {
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
      } catch (e) { }
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

  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (sidebarOpen ? 'open' : '')}>
        <div className="brand">
          <div className="brand-mark"><i className="fa-solid fa-industry"></i></div>
          <div>
            <strong>VETEC</strong>
            <span className="brand-sub">Industrial</span>
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
                  <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}>
                    <i className={'fa-solid ' + i.icon + ' nav-icon'}></i>
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</strong>
              <span className="muted">{user.role}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>
            <i className="fa-solid fa-arrow-right-from-bracket"></i> Sair
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn" style={{ display: 'none' }} onClick={() => setSidebarOpen((v) => !v)}><i className="fa-solid fa-bars"></i></button>
          
          <div className="search-global" style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass"></i>
            <input placeholder="Buscar no sistema..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {results && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 8, zIndex: 50, boxShadow: 'var(--shadow-md)' }}>
                {['clients', 'projects', 'proposals', 'contracts', 'tasks'].map((key) => {
                  const list = results[key] || [];
                  if (!list.length) return null;
                  return (
                    <div key={key} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ padding: '4px 16px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{key}</div>
                      {list.map((r) => (
                        <button key={r.id} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => {
                          setSearch(''); setResults(null);
                          if (key === 'clients') navigate('/clients/' + r.id);
                          else if (key === 'projects') navigate('/projects/' + r.id);
                          else if (key === 'proposals') navigate('/proposals');
                          else if (key === 'contracts') navigate('/contracts');
                          else navigate('/tasks');
                        }}>
                          {r.name || r.title || r.number || r.service}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="topbar-actions">
            
            <button className="icon-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Alternar Tema">
              <i className={'fa-solid ' + (theme === 'light' ? 'fa-moon' : 'fa-sun')}></i>
            </button>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => setShowNotif((v) => !v)}>
                <i className="fa-regular fa-bell"></i>
                {notifications.length > 0 && <span className="badge-dot"></span>}
              </button>
              {showNotif && (
                <div style={{ position: 'absolute', right: 0, top: '100%', width: 320, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', marginTop: 12, zIndex: 50 }}>
                  <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                    <strong>Notificações</strong>
                  </div>
                  {notifications.length === 0 && <p className="muted" style={{ padding: 16, textAlign: 'center' }}>Tudo em dia.</p>}
                  {notifications.map((n) => (
                    <div key={n.id} style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                      <strong style={{ display: 'block', fontSize: 13 }}>{n.title}</strong>
                      <span className="muted">{n.body}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="avatar small">{(user.name || '?').slice(0, 2).toUpperCase()}</div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
