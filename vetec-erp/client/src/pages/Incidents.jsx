import React from 'react';
import Resource from '../components/Resource.jsx';
import { Badge, dateBR } from '../ui.jsx';

export default function Incidents() {
  return (
    <Resource
      title="Ocorrências"
      subtitle="Registro e acompanhamento de ocorrências em projetos."
      endpoint="/incidents"
      perm="incidents"
      createLabel="Nova ocorrência"
      filters={[
        { key: 'status', label: 'Status', options: ['aberta', 'em_analise', 'resolvida'] },
        { key: 'severity', label: 'Gravidade', options: ['baixa', 'media', 'alta', 'critica'] }
      ]}
      columns={[
        { key: 'date', label: 'Data', render: (r) => dateBR(r.date) },
        { key: 'project_id', label: 'Projeto' },
        { key: 'type', label: 'Tipo' },
        { key: 'severity', label: 'Gravidade', render: (r) => <Badge value={r.severity} /> },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'description', label: 'Descrição' }
      ]}
      fields={[
        { key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' },
        { key: 'date', label: 'Data', type: 'date', required: true },
        { key: 'type', label: 'Tipo' },
        { key: 'severity', label: 'Gravidade', type: 'select', options: ['baixa', 'media', 'alta', 'critica'] },
        { key: 'responsible_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
        { key: 'status', label: 'Status', type: 'select', options: ['aberta', 'em_analise', 'resolvida'] },
        { key: 'description', label: 'Descrição', type: 'textarea', required: true, full: true },
        { key: 'resolution', label: 'Medidas adotadas / resolução', type: 'textarea', full: true }
      ]}
      defaults={{ status: 'aberta', severity: 'media', date: new Date().toISOString().slice(0, 10) }}
    />
  );
}
