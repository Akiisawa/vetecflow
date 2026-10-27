import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DataTable, Modal, Field, useToast, Empty, Spinner, dateBR } from '../ui.jsx';
import { useLookups } from '../lookups.jsx';
import { can, useAuth } from '../auth.jsx';

const CATEGORIES = ['contratos', 'projetos', 'plantas', 'relatorios', 'art', 'laudos', 'orcamentos', 'notas_fiscais', 'fotografias', 'administrativo', 'outros'];

export default function Documents() {
  const { user } = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [file, setFile] = useState(null);

  const canWrite = can(user, 'documents', 'write');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/documents');
      setRows(res.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    if (!file) { toast.error('Selecione um arquivo'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', uploading.name || file.name);
    fd.append('category', uploading.category || 'outros');
    if (uploading.client_id) fd.append('client_id', uploading.client_id);
    if (uploading.project_id) fd.append('project_id', uploading.project_id);

    try {
      await api.upload('/documents', fd);
      toast.success('Documento enviado');
      setUploading(null);
      setFile(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Documentos</h1>
          <p className="muted">Gestão eletrônica de documentos por cliente, projeto e categoria.</p>
        </div>
        {canWrite && <button className="btn btn-primary" onClick={() => setUploading({ category: 'outros' })}>+ Enviar documento</button>}
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          columns={[
            { key: 'name', label: 'Nome' },
            { key: 'category', label: 'Categoria' },
            { key: 'client_name', label: 'Cliente' },
            { key: 'project_name', label: 'Projeto' },
            { key: 'created_at', label: 'Enviado em', render: (r) => dateBR(r.created_at) },
            { key: 'id', label: 'Arquivo', render: (r) => (
              <a className="link" href={api.downloadUrl('/documents/' + r.id + '/download')} target="_blank" rel="noreferrer">baixar</a>
            )}
          ]}
          rows={rows}
          empty={<Empty title="Nenhum documento" hint="Envie plantas, contratos, laudos e outros arquivos." />}
        />
      )}

      {uploading && (
        <Modal
          title="Enviar documento"
          onClose={() => setUploading(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setUploading(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={submit}>Enviar</button>
            </>
          }
        >
          <div className="form-grid">
            <div className="field field-full">
              <label>Arquivo *</label>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} />
              <small className="muted">Máximo 25MB. Extensões permitidas: PDF, imagens, Office, DWG/DXF, CSV, ZIP.</small>
            </div>
            <Field field={{ key: 'name', label: 'Nome do documento' }} value={uploading.name}
              onChange={(k, v) => setUploading(Object.assign({}, uploading, { [k]: v }))} />
            <Field field={{ key: 'category', label: 'Categoria', type: 'select', options: CATEGORIES }} value={uploading.category}
              onChange={(k, v) => setUploading(Object.assign({}, uploading, { [k]: v }))} />
            <Field field={{ key: 'client_id', label: 'Cliente', type: 'select', optionsFrom: 'clients' }} value={uploading.client_id}
              onChange={(k, v) => setUploading(Object.assign({}, uploading, { [k]: v }))} />
            <Field field={{ key: 'project_id', label: 'Projeto', type: 'select', optionsFrom: 'projects' }} value={uploading.project_id}
              onChange={(k, v) => setUploading(Object.assign({}, uploading, { [k]: v }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}
