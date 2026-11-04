import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bath, BedDouble, Building2, Car, Edit2, LayoutGrid, LayoutList, MapPin, Maximize, Plus, Trash2 } from 'lucide-react';
import { Badge, Card, DataTable, FilterSelect, PageHeader, Pager, RowActions, SearchInput, Toolbar, matches } from '../components/DataTable';
import type { Mode, TabDef } from '../components/EntityForm';
import { EntityPage, RelatedGrid } from '../components/EntityPage';
import { useDelete } from '../components/useDelete';
import { useList } from '../lib/useApi';
import { parsePhotos } from '../lib/files';
import { formatCurrency, formatDate } from '../lib/format';
import { FINALIDADES_IMOVEL, TIPOS_IMOVEL, addressFields, statusColor } from '../lib/options';
import { Pode } from '../lib/auth';

const isAluguel = (finalidade: unknown) => finalidade === 'Aluguel' || finalidade === 'Temporada';

// Preço exibido no card: venda ou aluguel, conforme a finalidade
export const precoImovel = (i: Record<string, any>) =>
  isAluguel(i.finalidade) || (!i.precoVenda && i.precoAluguel)
    ? (i.precoAluguel ? `${formatCurrency(i.precoAluguel)}/mês` : 'Sob consulta')
    : (i.precoVenda ? formatCurrency(i.precoVenda) : 'Sob consulta');

// Aceita imóvel ausente (lista de imóveis ainda carregando ou imóvel excluído)
export const enderecoCurto = (i: Record<string, any> | undefined) =>
  !i ? '' : [[i.logradouro, i.numero].filter(Boolean).join(', '), i.bairro, [i.cidade, i.uf].filter(Boolean).join('/')].filter(Boolean).join(' - ');

// Consultar Imóveis
export function ImoveisList() {
  const navigate = useNavigate();
  const { rows, loading, reload } = useList('imoveis');
  const proprietarios = useList('proprietarios');
  const [term, setTerm] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [tipo, setTipo] = useState('');
  const [bairro, setBairro] = useState('');
  const [quartos, setQuartos] = useState('');
  const [proprietario, setProprietario] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    return (localStorage.getItem('urbania_imoveis_view') as 'table' | 'grid') || 'grid';
  });
  const [page, setPage] = useState(1);
  const del = useDelete('imoveis', 'Imóvel', reload);

  const handleViewModeChange = (mode: 'table' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('urbania_imoveis_view', mode);
  };

  const getProprietarioNome = (id: number) => {
    const p = proprietarios.rows.find(x => x.id === id);
    return p?.nome || '';
  };

  const bairros = [...new Set(rows.map(i => i.bairro).filter(Boolean))].sort();
  const filtered = rows.filter(i =>
    matches(term, i.titulo, i.id, i.cidade, i.bairro) &&
    (!finalidade || i.finalidade === finalidade) && (!tipo || i.tipo === tipo) && (!bairro || i.bairro === bairro) &&
    (!quartos || Number(i.quartos) >= Number(quartos)) && (!proprietario || String(i.proprietarioId) === String(proprietario))
  );

  const pageSize = viewMode === 'grid' ? 9 : 10;
  useEffect(() => setPage(1), [filtered.length, viewMode]);
  const currentCards = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns = [
    {
      key: 'id',
      label: 'Código',
      render: (r: any) => <span className="font-mono text-slate-500 font-medium">#{r.id}</span>,
      className: 'w-20',
    },
    {
      key: 'titulo',
      label: 'Imóvel',
      className: 'min-w-[180px]',
      render: (r: any) => {
        const foto = parsePhotos(r.fotos)[0];
        return (
          <div className="flex items-center gap-3">
            <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60 flex items-center justify-center">
              {foto ? (
                <img src={foto} alt={r.titulo} className="w-full h-full object-cover" />
              ) : (
                <Building2 size={20} className="text-slate-400" />
              )}
            </div>
            <div>
              <p className="font-medium text-cadastro leading-snug">{r.titulo}</p>
              <p className="text-xs text-slate-400">{r.bairro ? `${r.bairro} · ` : ''}{r.cidade || ''}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (r: any) => r.tipo && <span className="text-xs font-semibold text-cadastro">{r.tipo}</span>,
    },
    {
      key: 'finalidade',
      label: 'Finalidade',
      render: (r: any) => r.finalidade && (
        <Badge className={r.finalidade === 'Venda' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}>
          {r.finalidade === 'Aluguel' ? 'Locação' : r.finalidade}
        </Badge>
      ),
    },
    {
      key: 'preco',
      label: 'Preço',
      render: (r: any) => <span className="font-bold text-cadastro text-sm whitespace-nowrap">{precoImovel(r)}</span>,
    },
  ];

  // Interruptor de visualização (Segmented Switch: Tabela / Cards)
  const ViewSwitch = ({ className = '' }: { className?: string }) => (
    <div
      role="group"
      aria-label="Alternar exibição entre Tabela e Cards"
      className={`inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-2xs select-none ${className}`}
    >
      <button
        type="button"
        onClick={() => handleViewModeChange('table')}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          viewMode === 'table'
            ? 'bg-white text-[#0a2540] shadow-xs'
            : 'text-slate-500 hover:text-slate-800'
        }`}
        title="Visualização em Tabela"
      >
        <LayoutList size={15} />
        <span>Tabela</span>
      </button>
      <button
        type="button"
        onClick={() => handleViewModeChange('grid')}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          viewMode === 'grid'
            ? 'bg-white text-[#0a2540] shadow-xs'
            : 'text-slate-500 hover:text-slate-800'
        }`}
        title="Visualização em Cards"
      >
        <LayoutGrid size={15} />
        <span>Cards</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Imóveis" subtitle={`${rows.length} cadastrados`}
        action={
          <div className="flex items-center gap-3">
            <ViewSwitch />
            <Pode acao="Criar">
              <button
                onClick={() => navigate('/imoveis/novo')}
                className="flex items-center gap-2 bg-[#0a2540] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#06182c] shadow-sm transition"
              >
                <Plus size={18} /> Novo Imóvel
              </button>
            </Pode>
          </div>
        }
      />
      <Card>
        <Toolbar
          extraActions={
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Visualização:</span>
              <ViewSwitch />
            </div>
          }
        >
          <SearchInput value={term} onChange={setTerm} placeholder="Buscar por título, código ou cidade..." />
          <FilterSelect value={finalidade} onChange={setFinalidade} options={FINALIDADES_IMOVEL} placeholder="Todas as finalidades" />
          <FilterSelect value={tipo} onChange={setTipo} options={TIPOS_IMOVEL} placeholder="Todos os tipos" />
          <FilterSelect value={bairro} onChange={setBairro} options={bairros} placeholder="Todos os bairros" />
          <FilterSelect value={quartos} onChange={setQuartos} options={[{ value: '1', label: '1+ quartos' }, { value: '2', label: '2+ quartos' }, { value: '3', label: '3+ quartos' }, { value: '4', label: '4+ quartos' }]} placeholder="Todos os quartos" />
          <FilterSelect value={proprietario} onChange={setProprietario} options={proprietarios.rows.map(p => ({ value: String(p.id), label: p.nome }))} placeholder="Todos os proprietários" />
        </Toolbar>

        {viewMode === 'table' ? (
          <DataTable
            rows={filtered}
            loading={loading}
            onRowClick={r => navigate(`/imoveis/${r.id}`)}
            columns={columns}
            actions={r => (
              <RowActions
                onView={() => navigate(`/imoveis/${r.id}`)}
                onEdit={() => navigate(`/imoveis/${r.id}/editar`)}
                onDelete={() => del.ask(r.id, r.titulo)}
              />
            )}
          />
        ) : (
          <div className="flex flex-col justify-between min-h-[560px]">
            <div className="flex-1 p-5 lg:p-6 bg-slate-50/40">
              {loading ? (
                <p className="p-12 text-center text-slate-400">Carregando...</p>
              ) : !filtered.length ? (
                <p className="p-12 text-center text-slate-400">Nenhum imóvel encontrado com os filtros selecionados.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {currentCards.map(i => {
                    const foto = parsePhotos(i.fotos)[0];
                    const proprietarioNome = i.proprietarioNome || getProprietarioNome(i.proprietarioId);
                    const isLocacao = i.finalidade === 'Aluguel' || i.finalidade === 'Temporada' || i.finalidade === 'Locação';
                    return (
                      <div
                        key={i.id}
                        onClick={() => navigate(`/imoveis/${i.id}`)}
                        className="group bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-slate-300 transition-all duration-300 overflow-hidden flex flex-col justify-between cursor-pointer"
                      >
                        <div>
                          {/* Foto do imóvel com Badges flutuantes conforme referência */}
                          <div className="h-48 sm:h-52 bg-slate-100 relative overflow-hidden">
                            {foto ? (
                              <img
                                src={foto}
                                alt={i.titulo}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50">
                                <Building2 size={44} className="text-slate-300" />
                              </div>
                            )}

                            {/* Badge Superior Esquerdo: Finalidade (Venda em azul, Locação em laranja) */}
                            {i.finalidade && (
                              <div className="absolute top-3 left-3">
                                <span
                                  className={`text-xs font-bold px-2.5 py-1 rounded-md shadow-xs tracking-wide ${
                                    isLocacao
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-sky-600 text-white'
                                  }`}
                                >
                                  {isLocacao ? 'Locação' : i.finalidade}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Informações centrais */}
                          <div className="p-4">
                            {/* Título do Imóvel */}
                            <h3 className="font-medium text-cadastro text-base leading-snug group-hover:text-cadastro-hover transition line-clamp-1">
                              {i.titulo}
                            </h3>

                            {/* Endereço com Ícone de Localização */}
                            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1.5 line-clamp-1">
                              <MapPin size={13} className="shrink-0 text-slate-400" />
                              <span>{enderecoCurto(i) || 'Endereço não informado'}</span>
                            </p>

                            {/* Linha de Características (qtos, bnh, vagas, m²) */}
                            <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-500 font-medium mt-3.5 pt-3 border-t border-slate-100">
                              {i.quartos ? (
                                <span className="flex items-center gap-1.5">
                                  <BedDouble size={14} className="text-slate-400" />
                                  {i.quartos} qtos
                                </span>
                              ) : null}
                              {i.banheiros ? (
                                <span className="flex items-center gap-1.5">
                                  <Bath size={14} className="text-slate-400" />
                                  {i.banheiros} bnh
                                </span>
                              ) : null}
                              {i.vagas ? (
                                <span className="flex items-center gap-1.5">
                                  <Car size={14} className="text-slate-400" />
                                  {i.vagas} vaga{Number(i.vagas) > 1 ? 's' : ''}
                                </span>
                              ) : null}
                              {(i.areaTotal || i.areaTerreno) ? (
                                <span className="flex items-center gap-1.5">
                                  <Maximize size={14} className="text-slate-400" />
                                  {i.areaTotal || i.areaTerreno} m²
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Rodapé do Card: Preço e Proprietário à esquerda, Ações à direita */}
                        <div className="px-4 pb-4 pt-2.5 flex items-center justify-between border-t border-slate-100">
                          <div className="min-w-0">
                            <p className="text-lg font-bold text-cadastro tracking-tight leading-snug">
                              {precoImovel(i)}
                            </p>
                            {proprietarioNome && (
                              <p className="text-xs text-slate-400 truncate max-w-[200px] mt-0.5">
                                {proprietarioNome}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                            <Pode acao="Editar">
                              <button
                                type="button"
                                title="Editar Imóvel"
                                onClick={() => navigate(`/imoveis/${i.id}/editar`)}
                                className="p-1.5 text-cadastro hover:text-cadastro-hover hover:bg-cadastro/5 rounded-lg transition"
                              >
                                <Edit2 size={16} />
                              </button>
                            </Pode>
                            <Pode acao="Excluir">
                              <button
                                type="button"
                                title="Excluir Imóvel"
                                onClick={() => del.ask(i.id, i.titulo)}
                                className="p-1.5 text-cadastro hover:text-cadastro-hover hover:bg-cadastro/5 rounded-lg transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            </Pode>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Pager page={page} setPage={setPage} total={filtered.length} pageSize={pageSize} />
          </div>
        )}
      </Card>
      {del.modal}
    </div>
  );
}

// Visitas, negociações e contratos do imóvel (somente leitura)
function ImovelRelacionamentos({ imovelId }: { imovelId: number }) {
  const navigate = useNavigate();
  const visitas = useList('visitas', { imovelId });
  const negociacoes = useList('negociacoes', { imovelId });
  const contratos = useList('contratos', { imovelId });
  const clientes = useList('clientes');
  const cliente = (id: number) => clientes.rows.find(c => c.id === id)?.nome || `#${id}`;

  return (
    <>
      <RelatedGrid title="Contratos">
        <DataTable
          compact
          rows={contratos.rows} loading={contratos.loading} empty="Nenhum contrato vinculado a este imóvel."
          columns={[
            { key: 'id', label: 'ID Contrato', render: r => `#${r.id}`, className: 'font-mono text-slate-500' },
            { key: 'cliente', label: 'Inquilino / Comprador', render: r => r.clienteNome || cliente(r.clienteId) },
            { key: 'tipo', label: 'Tipo', render: r => <span className="text-xs font-semibold text-cadastro">{r.tipo}</span> },
            { key: 'vigencia', label: 'Início Vigência', render: r => formatDate(r.dataInicio) },
            { key: 'valor', label: 'Valor', render: r => formatCurrency(r.valor) },
            { key: 'status', label: 'Status', render: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
          ]}
          actions={r => <RowActions onView={() => navigate(`/contratos/${r.id}`)} />}
        />
      </RelatedGrid>
      <RelatedGrid title="Visitas">
        <DataTable
          compact
          rows={visitas.rows} loading={visitas.loading} empty="Nenhuma visita registrada."
          columns={[
            { key: 'id', label: 'ID da Visita', render: r => `#${r.id}`, className: 'font-mono text-slate-500' },
            { key: 'cliente', label: 'Cliente', render: r => cliente(r.clienteId) },
            { key: 'data', label: 'Data', render: r => formatDate(r.data) },
            { key: 'status', label: 'Status', render: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
          ]}
          actions={r => <RowActions onView={() => navigate(`/visitas/${r.id}`)} />}
        />
      </RelatedGrid>
      <RelatedGrid title="Negociações">
        <DataTable
          compact
          rows={negociacoes.rows} loading={negociacoes.loading} empty="Nenhuma negociação registrada."
          columns={[
            { key: 'id', label: 'ID da Proposta', render: r => `#${r.id}`, className: 'font-mono text-slate-500' },
            { key: 'cliente', label: 'Cliente', render: r => cliente(r.clienteId) },
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

// Cadastrar / Visualizar / Editar Imóvel
export function ImovelPage({ mode }: { mode: Mode }) {
  const proprietarios = useList('proprietarios');
  const corretores = useList('funcionarios', { cargo: 'Corretor', status: 'Ativo' });

  if (proprietarios.loading || corretores.loading) return <p className="text-slate-400 p-8">Carregando...</p>;

  const corretoresAtivos = corretores.rows.filter(c => c.status !== 'Inativo');

  const tabs: TabDef[] = [
    { label: 'Dados Básicos', fields: [
      { key: 'tipo', label: 'Tipo do Imóvel', type: 'select', options: TIPOS_IMOVEL, required: true },
      { key: 'finalidade', label: 'Finalidade', type: 'select', options: FINALIDADES_IMOVEL, required: true },
      { key: 'proprietarioId', label: 'Proprietário', type: 'search-select', required: true,
        options: proprietarios.rows.map(p => ({ value: p.id, label: p.nome, hint: p.tipo === 'Jurídica' ? p.cnpj : p.cpfCnpj })) },
      { key: 'responsavelId', label: 'Responsável (Corretor)', type: 'search-select',
        options: corretoresAtivos.map(c => ({ value: c.id, label: c.nome })) },
      { key: 'titulo', label: 'Título', required: true, full: true, placeholder: 'Ex.: Apartamento 3 quartos no Centro' },
      { key: 'descricao', label: 'Descrição', type: 'textarea' },
    ] },
    { label: 'Endereço', fields: addressFields(true).map(f => (f.key === 'complemento' ? f : { ...f, required: f.key !== 'numero' })) },
    { label: 'Valores', fields: [
      { key: 'precoVenda', label: 'Preço de Venda', type: 'currency', required: f => f.finalidade === 'Venda' || f.finalidade === 'Venda e Aluguel' },
      { key: 'precoAluguel', label: 'Aluguel', type: 'currency', required: f => f.finalidade !== 'Venda' && !!f.finalidade },
      { key: 'condominio', label: 'Condomínio', type: 'currency' },
      { key: 'iptu', label: 'IPTU', type: 'currency' },
    ] },
    { label: 'Características', fields: [
      { key: 'areaTotal', label: 'Área Total', type: 'number', suffix: 'm²' },
      { key: 'areaTerreno', label: 'Área do Terreno', type: 'number', suffix: 'm²' },
      { key: 'quartos', label: 'Quartos', type: 'number' },
      { key: 'suites', label: 'Suítes', type: 'number' },
      { key: 'banheiros', label: 'Banheiros', type: 'number' },
      { key: 'vagas', label: 'Vagas', type: 'number' },
    ] },
    { label: 'Fotos', fields: [{ key: 'fotos', label: 'Fotos do Imóvel (a primeira é a principal)', type: 'photos' }] },
  ];

  return (
    <EntityPage
      mode={mode} entity="imoveis" basePath="/imoveis" singular="Imóvel" tabs={tabs}
      validate={f => {
        const neg = ['areaTotal', 'areaTerreno', 'quartos', 'suites', 'banheiros', 'vagas'].find(k => Number(f[k]) < 0);
        if (neg) return 'As características não podem ter valores negativos.';
        if (Number(f.suites || 0) > Number(f.quartos || 0)) return 'O número de suítes não pode ser maior que o de quartos.';
        if (f.responsavelId) {
          const corr = corretores.rows.find(c => String(c.id) === String(f.responsavelId));
          if (!corr || corr.status === 'Inativo') {
            return 'O corretor selecionado está inativo. Selecione um corretor ativo para vincular ao imóvel.';
          }
        }
        return null;
      }}
      prepare={f => ({ ...f, responsavel: corretores.rows.find(c => String(c.id) === String(f.responsavelId))?.nome ?? null })}
      extraTabs={[{ label: 'Relacionamentos', render: f => <ImovelRelacionamentos imovelId={f.id} /> }]}
    />
  );
}
