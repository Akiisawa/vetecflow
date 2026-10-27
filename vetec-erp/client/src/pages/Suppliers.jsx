import React from 'react';
import Resource from '../components/Resource.jsx';
import { Badge } from '../ui.jsx';

export default function Suppliers() {
  return (
    <Resource
      title="Fornecedores"
      subtitle="Parceiros e prestadores de serviço."
      endpoint="/suppliers"
      perm="suppliers"
      createLabel="Novo fornecedor"
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'doc', label: 'Documento' },
        { key: 'email', label: 'E-mail' },
        { key: 'phone', label: 'Telefone' },
        { key: 'category', label: 'Categoria' },
        { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> }
      ]}
      fields={[
        { key: 'name', label: 'Nome', required: true },
        { key: 'doc', label: 'CNPJ / CPF' },
        { key: 'email', label: 'E-mail', type: 'email' },
        { key: 'phone', label: 'Telefone' },
        { key: 'address', label: 'Endereço' },
        { key: 'category', label: 'Categoria' },
        { key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true }
      ]}
      defaults={{ status: 'ativo' }}
    />
  );
}
