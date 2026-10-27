import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Spinner, useToast, money } from '../ui.jsx';

export default function Reports() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [active, setActive] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/reports');
        setList(res.data || []);
      } catch (e) { toast.error(e.message); }
    })();
  }, []);

  async function open(key) {
    setActive(key);
    setLoading(true);
    try {
      const res = await api.get('/reports/' + key);
      setData(res);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Relatórios</h1>
          <p className="muted">Dados consolidados a partir dos registros do sistema.</p>
        </div>
      </div>

      <div className="report-grid">
        {list.map((r) => (
          <button key={r.key} className={'report-card ' + (active === r.key ? 'active' : '')} onClick={() => open(r.key)}>
            {r.title}
          </button>
        ))}
      </div>

      {loading && <Spinner />}

      {data && !loading && (
        <Card
          title={data.title}
          actions={
            <>
              <a className="btn btn-ghost btn-sm" href={api.downloadUrl('/reports/' + active + '?format=csv')}>CSV</a>
              <a className="btn btn-ghost btn-sm" href={api.downloadUrl('/reports/' + active + '?format=pdf')} target="_blank" rel="noreferrer">PDF</a>
            </>
          }
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>{data.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {data.data.map((row, i) => (
                  <tr key={i}>
                    {data.columns.map((c) => (
                      <td key={c.key}>
                        {row[c.key] === null || row[c.key] === undefined
                          ? <span className="muted">—</span>
                          : (typeof row[c.key] === 'number' && /valor|total|budget|revenue|cost|amount/i.test(c.key)
                            ? money(row[c.key])
                            : row[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small mt">{data.total} registro(s)</p>
        </Card>
      )}
    </div>
  );
}
