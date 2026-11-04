import { Select } from '../components/Select';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Plus } from 'lucide-react';
import { api } from '../api';
import { Card, DataTable, FilterSelect, PageHeader, RowActions, Toolbar } from '../components/DataTable';
import type { Mode, TabDef } from '../components/EntityForm';
import { EntityPage } from '../components/EntityPage';
import { useFieldSearch } from '../components/FieldSearch';
import { Modal } from '../components/Modal';
import { apiError, useToast } from '../components/Toast';
import { useDelete } from '../components/useDelete';
import { useList } from '../lib/useApi';
import { CATEGORIAS_SERVICO } from '../lib/options';
import { Pode } from '../lib/auth';

// Consultar Serviço
export function ServicosList() {
  const navigate = useNavigate();
  const { rows, loading, reload } = useList('servicos');
  const [categoria, setCategoria] = useState('');
  const del = useDelete('servicos', 'Serviço', reload);
  // RF F33: ComboBox de campo (Nome / Categoria) + busca (NF 1.5 e 1.6) e ComboBox de filtro por categoria (NF 1.8)
  const search = useFieldSearch<any>([
    { value: 'nome', label: 'Nome', get: s => s.nome },
    { value: 'categoria', label: 'Categoria', get: s => s.categoria },
  ]);

  const filtered = rows
    .filter(s => search.filter(s) && (!categoria || s.categoria === categoria))
    .sort((a, b) => a.id - b.id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Serviços" subtitle={`${rows.length} cadastrados`}
        action={<Pode acao="Criar"><button onClick={() => navigate('/servicos/novo')} className="flex items-center gap-2 bg-[#0a2540] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#06182c]"><Plus size={18} /> Cadastrar Serviço</button></Pode>}
      />
      <Card>
        <Toolbar>
          {search.controls}
          <FilterSelect value={categoria} onChange={setCategoria} options={CATEGORIAS_SERVICO} placeholder="Todas as categorias" />
        </Toolbar>
        <DataTable
          rows={filtered} loading={loading}
          onRowClick={r => navigate(`/servicos/${r.id}`)}
          columns={[
            { key: 'id', label: 'ID', render: r => `#${r.id}`, className: 'font-mono text-slate-500 w-20' },
            { key: 'nome', label: 'Nome', className: 'font-semibold text-slate-800' },
            { key: 'categoria', label: 'Categoria', render: r => r.categoria && <span className="text-xs font-semibold text-cadastro">{r.categoria}</span> },
            { key: 'descricao', label: 'Descrição', render: r => <span className="text-slate-500 line-clamp-1">{r.descricao || '-'}</span> },
          ]}
          actions={r => (
            <RowActions onView={() => navigate(`/servicos/${r.id}`)} onEdit={() => navigate(`/servicos/${r.id}/editar`)} onDelete={() => del.ask(r.id, r.nome)} />
          )}
        />
      </Card>
      {del.modal}
    </div>
  );
}

const tabs: TabDef[] = [{
  label: 'Dados do Serviço',
  fields: [
    { key: 'nome', label: 'Nome', required: true, placeholder: 'Ex.: Troca de fiação' },
    { key: 'categoria', label: 'Categoria', type: 'select', options: CATEGORIAS_SERVICO, required: true },
    { key: 'descricao', label: 'Descrição', type: 'textarea' },
  ],
}];

// Cadastrar / Visualizar / Editar Serviço
export function ServicoPage({ mode }: { mode: Mode }) {
  return <EntityPage mode={mode} entity="servicos" basePath="/servicos" singular="Serviço" tabs={tabs} showClear={false} />;
}

// Cadastro rápido de serviço sem sair da tela atual (botão ao lado do ComboBox de serviço no Reparo)
export function NovoServicoModal({ onClose, onCreated }: { onClose: () => void; onCreated: (servico: any) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ nome: '', categoria: '', descricao: '' });
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const input = (bad = false) => `w-full px-3 py-2 border ${bad ? 'border-red-500' : 'border-slate-300'} rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#0a2540]`;

  const save = async () => {
    if (!form.nome.trim() || !form.categoria) {
      setInvalid(true);
      return toast.error('Preencha os campos obrigatórios: Nome, Categoria.');
    }
    setSaving(true);
    try {
      const { data } = await api.post('/servicos', form);
      toast.success('Serviço cadastrado com sucesso!');
      onCreated(data);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao salvar serviço.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Cadastrar Serviço" onClose={onClose} spacious>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase mb-1 text-slate-500">Nome <span className="text-red-500">*</span></label>
          <input autoFocus aria-invalid={invalid && !form.nome.trim()} className={input(invalid && !form.nome.trim())} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase mb-1 text-slate-500">Categoria <span className="text-red-500">*</span></label>
          <Select aria-invalid={invalid && !form.categoria} className={input(invalid && !form.categoria)} value={form.categoria} onChange={selectedValue => setForm({ ...form, categoria: selectedValue })}>
            <option value="">Selecione...</option>
            {CATEGORIAS_SERVICO.map(c => <option key={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase mb-1 text-slate-500">Descrição</label>
          <textarea rows={3} className={input()} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
        </div>
      </div>
      <div className="px-6 py-4 flex flex-wrap justify-end gap-3 bg-slate-50">
        <button type="button" onClick={onClose} className="px-5 py-2.5 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-white">Cancelar</button>
        <button type="button" onClick={save} disabled={saving} className="save-action px-6 py-2.5 text-white rounded-lg font-bold disabled:opacity-60 flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={18} />} Salvar
        </button>
      </div>
    </Modal>
  );
}
