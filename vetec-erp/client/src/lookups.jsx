import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const LookupContext = createContext(null);

export function LookupProvider({ children }) {
  const [state, setState] = useState({
    clients: [], users: [], projects: [], suppliers: [], categories: [], methods: [], contracts: [], opportunities: []
  });

  async function reload() {
    const safe = async (fn, fallback) => { try { return await fn(); } catch (e) { return fallback; } };
    const [clients, users, projects, suppliers, categories, methods, contracts, opportunities, proposals] = await Promise.all([
      safe(() => api.get('/clients', { limit: 200 }), { data: [] }),
      safe(() => api.get('/users'), { data: [] }),
      safe(() => api.get('/projects'), { data: [] }),
      safe(() => api.get('/suppliers', { limit: 200 }), { data: [] }),
      safe(() => api.get('/finance/categories'), { data: [] }),
      safe(() => api.get('/finance/payment-methods'), { data: [] }),
      safe(() => api.get('/contracts'), { data: [] }),
      safe(() => api.get('/opportunities'), { data: [] }),
      safe(() => api.get('/proposals'), { data: [] })
    ]);
    setState({
      clients: clients.data || [],
      users: users.data || [],
      projects: projects.data || [],
      suppliers: suppliers.data || [],
      categories: categories.data || [],
      methods: methods.data || [],
      contracts: contracts.data || [],
      opportunities: opportunities.data || [],
      proposals: proposals.data || []
    });
  }

  useEffect(() => { reload(); }, []);

  return (
    <LookupContext.Provider value={{ ...state, reload }}>
      {children}
    </LookupContext.Provider>
  );
}

export function useLookups() {
  return useContext(LookupContext) || {
    clients: [], users: [], projects: [], suppliers: [], categories: [],
    methods: [], contracts: [], opportunities: [], proposals: [], reload: () => {}
  };
}
