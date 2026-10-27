import React from 'react';
import { useNavigate } from 'react-router-dom';
import Resource from '../components/Resource.jsx';
import { Badge } from '../ui.jsx';

export default function Clients() {
  const navigate = useNavigate();

  return (
    <Resource
      title="Clientes"
      subtitle="Pessoas físicas e jurídicas atendidas pela VETEC."
      endpoint="/clients"
      perm="clients"
      createLabel="Novo cliente"
      filters={[
        { key: 'status', label: 'Status', options: ['ativo', 'inativo', 'prospect'] },
        { key: 'type', label: 'Tipo', options: [{ value: 'PF', label: 'Pessoa física' }, { value: 'PJ', label: 'Pessoa jurídica' }] }
      ]}
      columns={[
        { key: 'name', label: 'Nome / Razão social', render: (r) => (
          <a className="link" onClick={(e) => { e.stopPropagation(); navigate('/clients/' + r.id); }}>{r.name}</a>
        )},
        { key: 'doc', label: 'CPF/CNPJ' },
        { key: 'city', label: 'Cidade' },
        { key: 'state', label: 'UF', width: 60 },
        { key: 'phone', label: 'Telefone' },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> }
      ]}
      fields={[
        { key: 'type', label: 'Tipo', type: 'select', options: [{ value: 'PF', label: 'Pessoa física' }, { value: 'PJ', label: 'Pessoa jurídica' }] },
        { key: 'name', label: 'Nome / Razão social', required: true },
        { key: 'trade_name', label: 'Nome fantasia' },
        { key: 'doc', label: 'CPF / CNPJ' },
        { key: 'phone', label: 'Telefone' },
        { key: 'whatsapp', label: 'WhatsApp' },
        { key: 'email', label: 'E-mail', type: 'email' },
        { key: 'website', label: 'Site' },
        { key: 'zip', label: 'CEP' },
        { key: 'address', label: 'Endereço' },
        { key: 'city', label: 'Cidade' },
        { key: 'state', label: 'Estado' },
        { key: 'segment', label: 'Segmento' },
        { key: 'owner_id', label: 'Responsável interno', type: 'select', optionsFrom: 'users' },
        { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo', 'prospect'] },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true }
      ]}
      defaults={{ type: 'PJ', status: 'ativo' }}
    />
  );
}
