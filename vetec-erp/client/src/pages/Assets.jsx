import React from 'react';
import Resource from '../components/Resource.jsx';
import { Badge, money } from '../ui.jsx';

export default function Assets() {
  return (
    <Resource
      title="Equipamentos e ativos"
      subtitle="Controle patrimonial de equipamentos e materiais."
      endpoint="/assets"
      perm="assets"
      createLabel="Novo equipamento"
      filters={[{ key: 'state', label: 'Estado', options: ['disponivel', 'em_uso', 'manutencao', 'baixado'] }]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nome' },
        { key: 'category', label: 'Categoria' },
        { key: 'state', label: 'Estado', render: (r) => <Badge value={r.state} /> },
        { key: 'location', label: 'Localização' },
        { key: 'acquisition_value', label: 'Valor', render: (r) => money(r.acquisition_value) }
      ]}
      fields={[
        { key: 'code', label: 'Código', required: true },
        { key: 'patrimony', label: 'Patrimônio' },
        { key: 'name', label: 'Nome', required: true },
        { key: 'category', label: 'Categoria' },
        { key: 'state', label: 'Estado', type: 'select', options: ['disponivel', 'em_uso', 'manutencao', 'baixado'] },
        { key: 'location', label: 'Localização' },
        { key: 'responsible_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
        { key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' },
        { key: 'acquisition_value', label: 'Valor de aquisição', type: 'number' },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true }
      ]}
      defaults={{ state: 'disponivel' }}
    />
  );
}
