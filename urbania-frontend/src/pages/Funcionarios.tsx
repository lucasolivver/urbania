import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CalendarCheck, CalendarClock, Plus, Shield } from 'lucide-react';
import { api } from '../api';
import { Card, DataTable, FilterSelect, PageHeader, RowActions, Toolbar } from '../components/DataTable';
import { Avatar } from '../components/EntityForm';
import type { Mode, TabDef } from '../components/EntityForm';
import { EntityPage } from '../components/EntityPage';
import { useFieldSearch } from '../components/FieldSearch';
import { apiError, useToast } from '../components/Toast';
import { useDelete } from '../components/useDelete';
import { useList } from '../lib/useApi';
import { maskCpf, maskPhone, maskRg, onlyDigits } from '../lib/masks';
import { CARGOS, STATUS_FUNCIONARIO, addressFields } from '../lib/options';
import { StatusDropdown } from '../components/StatusDropdown';
import { Pode } from '../lib/auth';

// Consultar Funcionários
export function FuncionariosList() {
  const navigate = useNavigate();
  const toast = useToast();
  const { rows, setRows, loading, reload } = useList('funcionarios');
  const perfis = useList('perfis');
  const [perfilId, setPerfilId] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const del = useDelete('funcionarios', 'Funcionário', reload);
  // RF F6 NF 2.3: busca por nome ou CPF escolhidos no ComboBox (CPF com ou sem pontuação)
  const search = useFieldSearch<any>([
    { value: 'nome', label: 'Nome', get: f => f.nome },
    { value: 'cpf', label: 'CPF', get: f => (f.cpf ? `${f.cpf} ${onlyDigits(f.cpf)}` : '') },
    { value: 'email', label: 'E-mail', get: f => f.email },
    { value: 'cargo', label: 'Função', get: f => f.cargo },
  ]);

  // Sem status gravado conta como Ativo, igual ao que a coluna mostra
  const filtered = rows
    .filter(f => !perfilId || String(f.perfilId) === perfilId)
    .filter(f => !statusFiltro || (f.status || 'Ativo') === statusFiltro)
    .filter(search.filter);

  const setStatus = async (id: number, status: string) => {
    try {
      await api.put(`/funcionarios/${id}`, { status });
      setRows(rs => rs.map(r => (r.id === id ? { ...r, status } : r)));
      toast.success(`Funcionário ${status === 'Ativo' ? 'ativado' : 'inativado'}.`);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao alterar o status.'));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Funcionários" subtitle={`${rows.length} cadastrados`}
        action={<Pode acao="Criar"><button onClick={() => navigate('/funcionarios/novo')} className="flex items-center gap-2 bg-[#0a2540] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#06182c]"><Plus size={18} /> Novo Funcionário</button></Pode>}
      />
      <Card>
        <Toolbar automatico>
          {search.controls}
          <FilterSelect
            value={perfilId}
            onChange={setPerfilId}
            options={perfis.rows.map(p => ({ value: String(p.id), label: p.nome }))}
            placeholder="Todos os perfis"
          />
          <FilterSelect
            value={statusFiltro}
            onChange={setStatusFiltro}
            options={['Ativo', 'Inativo']}
            placeholder="Todos os status"
          />
        </Toolbar>
        <DataTable
          rows={filtered} loading={loading || perfis.loading}
          onRowClick={r => navigate(`/funcionarios/${r.id}`)}
          columns={[
            { key: 'nome', label: 'Nome', render: r => (
              <div className="flex items-center gap-3"><Avatar src={r.foto} name={r.nome} size="sm" /><span className="font-semibold text-slate-800">{r.nome}</span></div>
            ) },
            { key: 'cargo', label: 'Função' },
            { key: 'perfil', label: 'Perfil de Acesso', render: r => {
              const p = perfis.rows.find(x => Number(x.id) === Number(r.perfilId));
              return (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                  <Shield size={12} className="text-sky-600" />
                  {p?.nome || 'Padrão'}
                </span>
              );
            } },
            { key: 'telefone', label: 'Telefone' },
            { key: 'status', label: 'Status', render: r => <StatusDropdown value={r.status || 'Ativo'} options={STATUS_FUNCIONARIO} onChange={s => setStatus(r.id, s)} /> },
          ]}
          actions={r => (
            <RowActions
              onView={() => navigate(`/funcionarios/${r.id}`)}
              onEdit={() => navigate(`/funcionarios/${r.id}/editar`)}
              onDelete={() => del.ask(r.id, r.nome)}
            />
          )}
        />
      </Card>
      {del.modal}
    </div>
  );
}

// Estatísticas exibidas na visualização do funcionário
function Estatisticas({ funcionarioId }: { funcionarioId: number }) {
  const imoveis = useList('imoveis', { responsavelId: funcionarioId });
  const visitas = useList('visitas', { corretorId: funcionarioId });
  const stats = [
    { label: 'Imóveis captados', value: imoveis.rows.length, icon: <Building2 size={20} /> },
    { label: 'Visitas realizadas', value: visitas.rows.filter(v => v.status === 'Realizada').length, icon: <CalendarCheck size={20} /> },
    { label: 'Visitas agendadas', value: visitas.rows.filter(v => v.status === 'Pendente' || v.status === 'Confirmada').length, icon: <CalendarClock size={20} /> },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {stats.map(s => (
        <div key={s.label} className="bg-white border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">{s.icon}</div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{imoveis.loading || visitas.loading ? '…' : s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const corretor = (f: Record<string, any>) => f.cargo === 'Corretor';

const tabs: TabDef[] = [
  { label: 'Dados Pessoais', fields: [
    { key: 'foto', label: 'Foto de Perfil', type: 'photo', full: true },
    { key: 'nome', label: 'Nome Completo', required: true, full: true },
    { key: 'cpf', label: 'CPF', mask: maskCpf, placeholder: '000.000.000-00', required: true, disabled: (_, m) => m === 'edit' },
    { key: 'dataNascimento', label: 'Data de Nascimento', type: 'date', required: true },
    { key: 'rg', label: 'RG', mask: maskRg },
    { key: 'orgaoEmissor', label: 'Órgão Emissor', placeholder: 'Ex.: SSP/RO' },
  ] },
  { label: 'Contato e Função', fields: [
    { key: 'telefone', label: 'Celular', mask: maskPhone, placeholder: '(00) 00000-0000', required: true },
    { key: 'telefoneFixo', label: 'Telefone Fixo', mask: maskPhone, placeholder: '(00) 0000-0000' },
    { key: 'email', label: 'E-mail', type: 'email', required: true },
    { key: 'cargo', label: 'Função (Cargo)', type: 'select', options: CARGOS, required: true },
    { key: 'creci', label: 'CRECI', required: corretor, placeholder: 'Obrigatório para corretores' },
    { key: 'status', label: 'Status', type: 'toggle', options: STATUS_FUNCIONARIO, hidden: f => !f.id },
    { key: 'observacoes', label: 'Observações', type: 'textarea' },
  ] },
  { label: 'Endereço', fields: addressFields(true) },
];

// Cadastrar / Visualizar / Editar Funcionário
export function FuncionarioPage({ mode }: { mode: Mode }) {
  const perfis = useList('perfis');

  const pageTabs: TabDef[] = [
    tabs[0],
    {
      ...tabs[1],
      fields: [
        ...(tabs[1].fields || []).slice(0, 4),
        {
          key: 'perfilId',
          label: 'Perfil de Acesso (Permissões)',
          type: 'search-select',
          options: perfis.rows.map(p => ({
            value: p.id,
            label: `${p.nome}${Number(p.nativo) === 1 ? ' (Nativo)' : ''}`,
          })),
        },
        // A senha nunca volta do servidor: na edição, em branco mantém a atual
        {
          key: 'senha',
          label: 'Senha de Acesso ao Sistema',
          type: 'password',
          required: f => !f.id,
          placeholder: mode === 'edit' ? 'Em branco mantém a senha atual' : 'Mínimo de 6 caracteres',
        },
        ...(tabs[1].fields || []).slice(4),
      ],
    },
    tabs[2],
  ];

  const viewTabs: TabDef[] = mode === 'view'
    ? [{ ...pageTabs[0], render: f => <div className="mt-6"><h3 className="font-bold text-slate-700 mb-3">Estatísticas</h3><Estatisticas funcionarioId={f.id} /></div> }, ...pageTabs.slice(1)]
    : pageTabs;

  return (
    <EntityPage
      mode={mode} entity="funcionarios" basePath="/funcionarios" singular="Funcionário" tabs={viewTabs}
      defaults={{ status: 'Ativo' }} editLabel="Editar perfil"
      prepare={f => ({
        ...f,
        perfilId: f.perfilId ? Number(f.perfilId) : null,
      })}
      validate={f => {
        if (onlyDigits(f.cpf).length !== 11) return 'CPF inválido: informe os 11 dígitos.';
        if (onlyDigits(f.telefone).length < 10) return 'Celular inválido: informe DDD + número.';
        if (f.senha && String(f.senha).length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
        return null;
      }}
    />
  );
}
