import React from 'react';
import Resource from '../components/Resource.jsx';
import { Badge } from '../ui.jsx';

export default function Team() {
  return (
    <Resource
      title="Equipe"
      subtitle="Colaboradores cadastrados no sistema."
      endpoint="/users"
      perm="team"
      createLabel="Novo colaborador"
      canWrite={false}
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'email', label: 'E-mail' },
        { key: 'role', label: 'Perfil' },
        { key: 'position', label: 'Cargo' },
        { key: 'active', label: 'Ativo', render: (r) => <Badge value={r.active ? 'ativo' : 'inativo'} /> }
      ]}
      fields={[]}
    />
  );
}
