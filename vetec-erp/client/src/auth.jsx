import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onUnauthorized = () => { setToken(null); setUser(null); };
    window.addEventListener('vetec:unauthorized', onUnauthorized);
    return () => window.removeEventListener('vetec:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    (async () => {
      if (!getToken()) { setLoading(false); return; }
      try {
        const me = await api.get('/auth/me');
        setUser(me);
      } catch (e) {
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }

  async function logout() {
    try { await api.post('/auth/logout', {}); } catch (e) {}
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}

const PERMS = {
  admin: ['*'],
  gestor: ['clients:*','crm:*','proposals:*','contracts:*','projects:*','tasks:*','team:*','timesheets:*','documents:*','finance:*','suppliers:*','assets:*','incidents:*','calendar:*','reports:read','audit:read','users:read','notifications:*','dashboard:read','search:read'],
  comercial: ['clients:*','crm:*','proposals:*','contracts:read','contracts:write','projects:read','finance:read','reports:read','dashboard:read','documents:*','calendar:*','notifications:*','tasks:read','timesheets:read','team:read','search:read','suppliers:read','incidents:read'],
  engenharia: ['projects:*','tasks:*','incidents:*','documents:*','timesheets:*','assets:read','assets:write','clients:read','contracts:read','suppliers:read','finance:read','dashboard:read','calendar:*','notifications:*','team:read','reports:read','search:read','crm:read','proposals:read'],
  financeiro: ['finance:*','suppliers:*','contracts:read','clients:read','proposals:read','projects:read','reports:read','dashboard:read','documents:read','notifications:*','calendar:*','assets:read','timesheets:read','search:read','crm:read','tasks:read','team:read'],
  colaborador: ['tasks:read','tasks:write','timesheets:read','timesheets:write','projects:read','documents:read','incidents:read','incidents:write','dashboard:read','calendar:read','notifications:*','clients:read','search:read','team:read']
};

export function can(user, mod, action) {
  if (!user) return false;
  const list = PERMS[user.role] || [];
  if (list.indexOf('*') !== -1) return true;
  return list.indexOf(mod + ':*') !== -1 || list.indexOf(mod + ':' + action) !== -1;
}
