import React from 'react';
import { useNavigate } from 'react-router-dom';
import Resource from '../components/Resource.jsx';
import { Badge, money, dateBR } from '../ui.jsx';

export default function Projects() {
  const navigate = useNavigate();

  return (
    <Resource
      title="Projetos e obras"
      subtitle="Todos os projetos, prazos e orçamentos."
      endpoint="/projects"
      perm="projects"
      createLabel="Novo projeto"
      filters={[
        { key: 'status', label: 'Status', options: ['planejamento', 'em_andamento', 'em_pausa', 'atrasado', 'concluido', 'cancelado'] }
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Projeto', render: (r) => (
          <a className="link" onClick={(e) => { e.stopPropagation(); navigate('/projects/' + r.id); }}>{r.name}</a>
        )},
        { key: 'client_name', label: 'Cliente' },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        { key: 'due_date', label: 'Prazo', render: (r) => dateBR(r.due_date) },
        { key: 'budget', label: 'Orçamento', render: (r) => money(r.budget) },
        { key: 'progress', label: 'Progresso', render: (r) => r.progress + '%' }
      ]}
      fields={[
        { key: 'code', label: 'Código (vazio = automático)' },
        { key: 'name', label: 'Nome', required: true },
        { key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients' },
        { key: 'owner_id', label: 'Responsável', type: 'select', optionsFrom: 'users' },
        { key: 'location', label: 'Local de execução' },
        { key: 'start_date', label: 'Início', type: 'date' },
        { key: 'due_date', label: 'Prazo', type: 'date' },
        { key: 'expected_end', label: 'Conclusão prevista', type: 'date' },
        { key: 'budget', label: 'Orçamento', type: 'number' },
        { key: 'contracted_revenue', label: 'Receita contratada', type: 'number' },
        { key: 'progress', label: 'Progresso (%)', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: ['planejamento', 'em_andamento', 'em_pausa', 'atrasado', 'concluido', 'cancelado'] },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true }
      ]}
      defaults={{ status: 'planejamento', progress: 0 }}
    />
  );
}
