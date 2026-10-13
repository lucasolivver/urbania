import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge, Card, DataTable, FilterSelect, PageHeader, RowActions, SearchInput, Toolbar, matches } from '../components/DataTable';
import { Avatar } from '../components/EntityForm';
import type { Mode, TabDef } from '../components/EntityForm';
import { EntityPage, RelatedGrid } from '../components/EntityPage';
import { useDelete } from '../components/useDelete';
import { useList } from '../lib/useApi';
import { maskCnpj, maskCpf, maskPhone, maskRg, onlyDigits } from '../lib/masks';
import { formatCurrency, formatDate, fullAddress } from '../lib/format';
import { ESTADOS_CIVIS, SEXOS, TIPOS_CONTA, TIPOS_PESSOA, addressFields, statusColor } from '../lib/options';
import { Pode } from '../lib/auth';

const documento = (p: Record<string, any>) => (p.tipo === 'Jurídica' ? p.cnpj : p.cpfCnpj);

// Consultar Proprietários
export function ProprietariosList() {
  const navigate = useNavigate();
  const { rows, loading, reload } = useList('proprietarios');
  const [term, setTerm] = useState('');
  const [tipo, setTipo] = useState('');
  const del = useDelete('proprietarios', 'Proprietário', reload);

  const filtered = rows.filter(p =>
    (!tipo || p.tipo === tipo) &&
    matches(term, p.id, p.nome, p.email, p.telefone, onlyDigits(p.telefone), documento(p), onlyDigits(documento(p)), p.tipo)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Proprietários" subtitle={`${rows.length} cadastros`}
        action={<Pode acao="Criar"><button onClick={() => navigate('/proprietarios/novo')} className="flex items-center gap-2 bg-[#0a2540] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#06182c]"><Plus size={18} /> Novo Proprietário</button></Pode>}
      />
      <Card>
        <Toolbar>
          <SearchInput value={term} onChange={setTerm} placeholder="Buscar por nome, documento, e-mail ou telefone..." />
          <FilterSelect value={tipo} onChange={setTipo} options={TIPOS_PESSOA} placeholder="Todos os tipos de pessoa" />
        </Toolbar>
        <DataTable
          rows={filtered} loading={loading}
          onRowClick={r => navigate(`/proprietarios/${r.id}`)}
          columns={[
            { key: 'nome', label: 'Nome', render: r => (
              <div className="flex items-center gap-3">
                <Avatar src={r.foto} name={r.nome} size="sm" />
                <span className="font-semibold text-slate-800">{r.nome}</span>
              </div>
            ) },
            { key: 'email', label: 'E-mail', render: r => <span className="text-slate-600">{r.email || '-'}</span> },
            { key: 'telefone', label: 'Telefone', render: r => <span className="text-slate-600 font-medium">{r.telefone || '-'}</span> },
            { key: 'documento', label: 'CPF/CNPJ', render: documento },
            { key: 'tipo', label: 'Tipo', render: r => r.tipo && <span className="text-xs font-semibold text-cadastro">{r.tipo}</span> },
          ]}
          actions={r => (
            <RowActions onView={() => navigate(`/proprietarios/${r.id}`)} onEdit={() => navigate(`/proprietarios/${r.id}/editar`)} onDelete={() => del.ask(r.id, r.nome)} />
          )}
        />
      </Card>
      {del.modal}
    </div>
  );
}

const juridica = (f: Record<string, any>) => f.tipo === 'Jurídica';

const tabs: TabDef[] = [
  { label: 'Dados Básicos', fields: [
    { key: 'foto', label: 'Foto do Proprietário', type: 'photo', full: true },
    { key: 'nome', label: 'Nome', required: true, full: true },
    { key: 'telefone', label: 'Telefone', mask: maskPhone, placeholder: '(00) 00000-0000', required: true },
    { key: 'email', label: 'E-mail', type: 'email' },
    { key: 'tipo', label: 'Tipo de Pessoa', type: 'select', options: TIPOS_PESSOA, required: true, selectPlacement: mode => mode === 'create' ? 'bottom' : 'auto',
      onChange: (v, f) => (v === 'Jurídica' ? { ...f, cpfCnpj: null } : { ...f, cnpj: null, razaoSocial: null }) },
    { key: 'rg', label: 'RG', mask: maskRg, disabled: f => juridica(f) },
    { key: 'cnpj', label: 'CNPJ', mask: maskCnpj, placeholder: '00.000.000/0000-00', disabled: f => !juridica(f), required: juridica },
    { key: 'razaoSocial', label: 'Razão Social', disabled: f => !juridica(f), required: juridica },
  ] },
  { label: 'Dados Pessoais', fields: [
    { key: 'cpfCnpj', label: 'CPF', mask: maskCpf, placeholder: '000.000.000-00', disabled: f => juridica(f), required: f => !juridica(f) },
    { key: 'dataNascimento', label: 'Data de Nascimento', type: 'date' },
    { key: 'sexo', label: 'Sexo', type: 'select', options: SEXOS },
    { key: 'estadoCivil', label: 'Estado Civil', type: 'select', options: ESTADOS_CIVIS },
    { key: 'profissao', label: 'Profissão' },
  ] },
  { label: 'Endereço', fields: addressFields() },
  { label: 'Dados Bancários', fields: [
    { key: 'banco', label: 'Banco' },
    { key: 'agencia', label: 'Agência' },
    { key: 'conta', label: 'Número da Conta' },
    { key: 'tipoConta', label: 'Tipo de Conta', type: 'select', options: TIPOS_CONTA },
    { key: 'chavePix', label: 'Chave PIX' },
    { key: 'titularConta', label: 'Titular da Conta' },
  ] },
];

// Imóveis, negociações e contratos vinculados (somente leitura)
function ProprietarioVinculos({ proprietarioId }: { proprietarioId: number }) {
  const navigate = useNavigate();
  const imoveis = useList('imoveis', { proprietarioId });
  const negociacoes = useList('negociacoes');
  const contratos = useList('contratos');
  const ids = imoveis.rows.map(i => i.id);
  const minhasNegociacoes = negociacoes.rows.filter(n => ids.includes(n.imovelId) || Number(n.proprietarioId) === Number(proprietarioId));
  const meusContratos = contratos.rows.filter(c => ids.includes(c.imovelId) || Number(c.proprietarioId) === Number(proprietarioId));
  const situacao = (imovelId: number) =>
    meusContratos.some(c => c.imovelId === imovelId && c.status === 'Ativo') ? 'Locado/Vendido' :
    minhasNegociacoes.some(n => n.imovelId === imovelId && (n.status === 'Realizada' || n.status === 'Convertida em Contrato')) ? 'Negociado' : 'Disponível';

  return (
    <>
      <RelatedGrid title="Contratos Vinculados">
        <DataTable
          compact
          rows={meusContratos} loading={contratos.loading} empty="Nenhum contrato ativo ou vinculado a este proprietário."
          columns={[
            { key: 'id', label: 'ID Contrato', render: r => `#${r.id}`, className: 'font-mono text-slate-500' },
            { key: 'imovel', label: 'Imóvel', render: r => r.imovelTitulo || `#${r.imovelId}` },
            { key: 'cliente', label: 'Inquilino / Comprador', render: r => r.clienteNome || `#${r.clienteId}` },
            { key: 'tipo', label: 'Tipo', render: r => <span className="text-xs font-semibold text-cadastro">{r.tipo}</span> },
            { key: 'repasse', label: 'Repasse Líquido Estimado', render: r => <span className="font-bold text-emerald-700">{formatCurrency(r.repasseProprietario || r.valor)}</span> },
            { key: 'status', label: 'Status', render: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
          ]}
          actions={r => <RowActions onView={() => navigate(`/contratos/${r.id}`)} />}
        />
      </RelatedGrid>
      <RelatedGrid title="Imóveis">
        <DataTable
          compact
          rows={imoveis.rows} loading={imoveis.loading} empty="Nenhum imóvel vinculado."
          columns={[
            { key: 'id', label: 'ID', render: r => `#${r.id}`, className: 'font-mono text-slate-500' },
            { key: 'tipo', label: 'Tipo do Imóvel', render: r => <span className="text-xs font-semibold text-cadastro">{r.tipo}</span> },
            { key: 'endereco', label: 'Endereço', render: r => fullAddress(r) },
            { key: 'participacao', label: 'Participação (%)', render: () => '100%' },
            { key: 'situacao', label: 'Situação', render: r => <Badge className={situacao(r.id) === 'Disponível' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}>{situacao(r.id)}</Badge> },
          ]}
          actions={r => <RowActions onView={() => navigate(`/imoveis/${r.id}`)} />}
        />
      </RelatedGrid>
      <RelatedGrid title="Negociações">
        <DataTable
          compact
          rows={minhasNegociacoes} loading={negociacoes.loading} empty="Nenhuma negociação registrada."
          columns={[
            { key: 'id', label: 'ID da Proposta', render: r => `#${r.id}`, className: 'font-mono text-slate-500' },
            { key: 'data', label: 'Data', render: r => formatDate(r.data) },
            { key: 'valor', label: 'Valor', render: r => formatCurrency(r.valor) },
            { key: 'status', label: 'Status', render: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
          ]}
          actions={r => <RowActions onView={() => navigate(`/negociacoes/${r.id}`)} />}
        />
      </RelatedGrid>
    </>
  );
}

// Cadastrar / Visualizar / Editar Proprietário
export function ProprietarioPage({ mode }: { mode: Mode }) {
  return (
    <EntityPage
      mode={mode} entity="proprietarios" basePath="/proprietarios" singular="Proprietário" tabs={tabs}
      defaults={{ tipo: 'Física' }}
      validate={f => {
        if (juridica(f) && onlyDigits(f.cnpj).length !== 14) return 'CNPJ inválido: informe os 14 dígitos.';
        if (!juridica(f) && onlyDigits(f.cpfCnpj).length !== 11) return 'CPF inválido: informe os 11 dígitos.';
        if (onlyDigits(f.telefone).length < 10) return 'Telefone inválido: informe DDD + número.';
        return null;
      }}
      extraTabs={[{ label: 'Imóveis e Negociações', render: f => <ProprietarioVinculos proprietarioId={f.id} /> }]}
    />
  );
}
