import { RecordStatusDropdown } from '../components/StatusDropdown';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Card, DataTable, FilterSelect, PageHeader, RowActions, Toolbar } from '../components/DataTable';
import type { Mode, TabDef } from '../components/EntityForm';
import { EntityPage } from '../components/EntityPage';
import { useFieldSearch } from '../components/FieldSearch';
import { SearchSelect } from '../components/SearchSelect';
import { useDelete } from '../components/useDelete';
import { useList } from '../lib/useApi';
import { formatCurrency, todayISO } from '../lib/format';
import { STATUS_REPARO } from '../lib/options';
import { parseIds } from './Prestadores';
import { NovoServicoModal } from './Servicos';
import { Pode } from '../lib/auth';

const reparoColor = (status: unknown) => ({
  Pendente: 'bg-amber-100 text-amber-700',
  Iniciado: 'bg-sky-100 text-sky-700',
  Finalizado: 'bg-emerald-100 text-emerald-700',
}[String(status)] || 'bg-slate-100 text-slate-600');

// Consultar Reparo
export function ReparosList() {
  const navigate = useNavigate();
  const { rows, loading, reload } = useList('reparos');
  const imoveis = useList('imoveis');
  const servicos = useList('servicos');
  const prestadores = useList('prestadores');
  const [status, setStatus] = useState('');
  const del = useDelete('reparos', 'Reparo', reload);

  const nome = (list: any[], id: unknown, key = 'nome') => list.find(x => x.id === id)?.[key];
  const search = useFieldSearch<any>([
    { value: 'nome', label: 'Nome', get: r => `${nome(imoveis.rows, r.imovelId, 'titulo') || ''} ${nome(prestadores.rows, r.prestadorId) || ''}` },
    { value: 'servico', label: 'Tipo serviço', get: r => nome(servicos.rows, r.servicoId) },
  ]);

  const filtered = rows
    .filter(r => search.filter(r) && (!status || r.status === status))
    .sort((a, b) => b.id - a.id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Reparos" subtitle={`${rows.length} cadastrados`}
        action={<Pode acao="Criar"><button onClick={() => navigate('/reparos/novo')} className="flex items-center gap-2 bg-[#0a2540] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#06182c]"><Plus size={18} /> Cadastrar Reparo</button></Pode>}
      />
      <Card>
        <Toolbar>
          {search.controls}
          <FilterSelect value={status} onChange={setStatus} options={STATUS_REPARO} placeholder="Todos os status" />
        </Toolbar>
        <DataTable
          rows={filtered} loading={loading || imoveis.loading || servicos.loading || prestadores.loading}
          onRowClick={r => navigate(`/reparos/${r.id}`)}
          columns={[
            { key: 'id', label: 'ID', render: r => `#${r.id}`, className: 'font-mono text-slate-500 w-20' },
            { key: 'imovel', label: 'Imóvel', render: r => (
              <div>
                <p className="font-semibold text-slate-800">{nome(imoveis.rows, r.imovelId, 'titulo') || `#${r.imovelId}`}</p>
                <p className="text-xs text-slate-400 line-clamp-1">{r.descricao}</p>
              </div>
            ) },
            { key: 'servico', label: 'Serviço', render: r => nome(servicos.rows, r.servicoId) || '-' },
            { key: 'prestador', label: 'Prestador', render: r => nome(prestadores.rows, r.prestadorId) || '-' },
            { key: 'valor', label: 'Orçamento', render: r => <span className="font-semibold">{formatCurrency(r.valor) || '-'}</span> },
            { key: 'status', label: 'Status', render: r => <RecordStatusDropdown entity="reparos" record={r} options={STATUS_REPARO} color={reparoColor} onSaved={reload} /> },
          ]}
          actions={r => (
            <RowActions onView={() => navigate(`/reparos/${r.id}`)} onEdit={() => navigate(`/reparos/${r.id}/editar`)} onDelete={() => del.ask(r.id, `Reparo #${r.id}`)} />
          )}
        />
      </Card>
      {del.modal}
    </div>
  );
}

// Cadastrar / Visualizar / Editar Reparo
export function ReparoPage({ mode }: { mode: Mode }) {
  const imoveis = useList('imoveis');
  const servicos = useList('servicos');
  const prestadores = useList('prestadores');
  const funcionarios = useList('funcionarios');
  const [novoServico, setNovoServico] = useState<((id: number) => void) | null>(null);

  if (imoveis.loading || servicos.loading || prestadores.loading || funcionarios.loading) return <p className="text-slate-400 p-8">Carregando...</p>;

  const find = (list: any[], id: unknown) => list.find(x => String(x.id) === String(id));
  const ofereceServico = (p: any, servicoId: unknown) => !servicoId || parseIds(p.servicos).includes(Number(servicoId));

  const tabs: TabDef[] = [{
    label: 'Dados do Reparo',
    fields: [
      { key: 'imovelId', label: 'Imóvel', type: 'search-select', required: true,
        options: imoveis.rows.map(i => ({ value: i.id, label: `#${i.id} - ${i.titulo}`, hint: [i.bairro, i.cidade].filter(Boolean).join(' - ') })),
        // Responsável vem do imóvel selecionado; fica em branco se o imóvel não tiver
        onChange: (v, f) => {
          const imovel = find(imoveis.rows, v);
          const responsavelId = imovel?.responsavelId ?? null;
          const resp = find(funcionarios.rows, responsavelId);
          const isAtivo = resp ? resp.status !== 'Inativo' : true;
          return {
            ...f,
            responsavelId: isAtivo ? responsavelId : null,
            responsavel: isAtivo ? (resp?.nome ?? imovel?.responsavel ?? null) : null,
          };
        } },
      { key: 'responsavel', label: 'Responsável', disabled: true, placeholder: 'Preenchido pelo imóvel' },
      { key: 'servicoId', label: 'Serviço', type: 'custom', required: true,
        render: (value, set, { disabled, invalid }) => (
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchSelect value={value} onChange={set} disabled={disabled} invalid={invalid}
                options={servicos.rows.map(s => ({ value: s.id, label: s.nome, hint: s.categoria }))} />
            </div>
            {!disabled && (
              <button type="button" title="Cadastrar novo serviço" onClick={() => setNovoServico(() => (id: number) => set(id))}
                className="px-3 border rounded-lg bg-white text-[#0a2540] hover:bg-slate-50 shrink-0"><Plus size={18} /></button>
            )}
          </div>
        ),
        // Troca de serviço: limpa o prestador se ele não fizer o novo serviço
        onChange: (v, f) => {
          const p = find(prestadores.rows, f.prestadorId);
          return p && !ofereceServico(p, v) ? { ...f, prestadorId: null } : f;
        } },
      { key: 'prestadorId', label: 'Prestador de Serviço', type: 'custom', required: true,
        render: (value, set, { form, disabled, invalid }) => (
          <SearchSelect value={value} onChange={set} disabled={disabled} invalid={invalid}
            placeholder={form.servicoId ? 'Selecione...' : 'Selecione o serviço primeiro'}
            options={prestadores.rows.filter(p => ofereceServico(p, form.servicoId)).map(p => ({ value: p.id, label: p.nome, hint: p.telefone }))} />
        ) },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_REPARO, required: true },
      { key: 'valor', label: 'Orçamento', type: 'currency' },
      { key: 'dataSolicitacao', label: 'Data da Solicitação', type: 'date' },
      { key: 'descricao', label: 'Problemas Identificados', type: 'textarea', required: true },
    ],
  }];

  // Na visualização os campos custom mostram o nome em vez do ComboBox
  const viewTabs: TabDef[] = mode === 'view' ? [{
    ...tabs[0],
    fields: tabs[0].fields!.map(f => (f.key === 'servicoId' || f.key === 'prestadorId')
      ? { ...f, type: 'select', options: (f.key === 'servicoId' ? servicos.rows : prestadores.rows).map(x => ({ value: x.id, label: x.nome })) }
      : f),
  }] : tabs;

  return (
    <>
      <EntityPage
        mode={mode} entity="reparos" basePath="/reparos" singular="Reparo" tabs={viewTabs} showClear={false}
        defaults={{ status: 'Pendente', dataSolicitacao: todayISO() }}
        validate={f => (Number(f.valor) < 0 ? 'O orçamento não pode ser negativo.' : null)}
      />
      {novoServico && (
        <NovoServicoModal
          onClose={() => setNovoServico(null)}
          onCreated={s => {
            servicos.setRows(rs => [...rs, s]);
            novoServico(s.id);
            setNovoServico(null);
          }}
        />
      )}
    </>
  );
}

