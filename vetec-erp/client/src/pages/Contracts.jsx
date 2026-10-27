import React from 'react';
import Resource from '../components/Resource.jsx';
import { Badge, money, dateBR } from '../ui.jsx';

export default function Contracts() {
  return (
    <Resource
      title="Contratos"
      subtitle="Contratos firmados, vigências e valores."
      endpoint="/contracts"
      perm="contracts"
      createLabel="Novo contrato"
      filters={[{ key: 'status', label: 'Status', options: ['ativo', 'encerrado', 'cancelado', 'suspenso'] }]}
      columns={[
        { key: 'number', label: 'Número' },
        { key: 'client_name', label: 'Cliente' },
        { key: 'project_name', label: 'Projeto' },
        { key: 'value', label: 'Valor', render: (r) => money(r.value) },
        { key: 'start_date', label: 'Início', render: (r) => dateBR(r.start_date) },
        { key: 'end_date', label: 'Término', render: (r) => dateBR(r.end_date) },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> }
      ]}
      fields={[
        { key: 'number', label: 'Número (deixe vazio para gerar)' },
        { key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients', required: true },
        { key: 'proposal_id', label: 'Proposta de origem', type: 'select', optionsFrom: 'proposals' },
        { key: 'project_id', label: 'Projeto relacionado', type: 'select', optionsFrom: 'projects' },
        { key: 'value', label: 'Valor', type: 'number' },
        { key: 'start_date', label: 'Início', type: 'date' },
        { key: 'end_date', label: 'Término', type: 'date' },
        { key: 'owner_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
        { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'encerrado', 'cancelado', 'suspenso'] },
        { key: 'payment_terms', label: 'Condições de pagamento', type: 'textarea', full: true },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true }
      ]}
      defaults={{ status: 'ativo' }}
    />
  );
}
