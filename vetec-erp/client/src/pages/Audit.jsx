import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Spinner, useToast, Empty, dateBR } from '../ui.jsx';

export default function Audit() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/audit', { q });
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [q]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Auditoria</h1>
          <p className="muted">Registro de operações relevantes no sistema.</p>
        </div>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Filtrar por ação ou entidade..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'created_at', label: 'Data', render: (r) => String(r.created_at || '').slice(0, 16).replace('T', ' ') },
            { key: 'user_name', label: 'Usuário' },
            { key: 'action', label: 'Ação' },
            { key: 'entity', label: 'Entidade' },
            { key: 'entity_id', label: 'Registro' },
            { key: 'ip', label: 'IP' }
          ]}
          rows={rows}
          empty={<Empty title="Sem eventos de auditoria" />}
        />
      )}
    </div>
  );
}
