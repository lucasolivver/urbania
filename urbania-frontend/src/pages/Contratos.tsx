import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  FileSpreadsheet,
  FileText,
  Handshake,
  Landmark,
  MapPin,
  Plus,
  User,
  XCircle,
} from 'lucide-react';
import { api } from '../api';
import { Badge, Card, DataTable, DateRangeFilter, FilterSelect, PageHeader, RowActions, SearchInput, Toolbar, matches } from '../components/DataTable';
import { Avatar } from '../components/EntityForm';
import type { Mode, TabDef } from '../components/EntityForm';
import { EntityPage, RelatedGrid } from '../components/EntityPage';
import { apiError, useToast } from '../components/Toast';
import { useDelete } from '../components/useDelete';
import { useList } from '../lib/useApi';
import { parsePhotos } from '../lib/files';
import { formatCurrency, formatDate, fullAddress, todayISO } from '../lib/format';
import {
  FINALIDADES_CONTRATO,
  FORMAS_PAGAMENTO_CONTRATO,
  INDICES_REAJUSTE,
  STATUS_CONTRATO,
  TIPOS_CONTRATO,
  TIPOS_GARANTIA,
  statusColor,
} from '../lib/options';
import { StatusDropdown } from '../components/StatusDropdown';
import { enderecoCurto } from './Imoveis';
import { Pode } from '../lib/auth';


// Exportação nativa para CSV / Excel (RNF 1.3 - pág. 32)
function exportContratosToCsv(data: any[], filename: string) {
  const headers = [
    'ID Contrato',
    'Tipo',
    'Status',
    'Cliente / Inquilino',
    'Imóvel Negociado',
    'Proprietário',
    'Corretor Responsável',
    'Data Início',
    'Data Fim',
    'Data Assinatura',
    'Valor Principal (R$)',
    'Condomínio (R$)',
    'IPTU (R$)',
    'Dia Vencimento',
    'Forma Pagamento',
    'Taxa Adm (%)',
    'Repasse Proprietário (R$)',
    'Garantia Tipo',
    'Garantia Valor (R$)',
    'Índice Reajuste',
    'Observações',
  ];

  const rows = data.map(c => [
    c.id,
    c.tipo || '',
    c.status || '',
    `"${(c.clienteNome || '').replace(/"/g, '""')}"`,
    `"${(c.imovelTitulo || '').replace(/"/g, '""')}"`,
    `"${(c.proprietarioNome || '').replace(/"/g, '""')}"`,
    `"${(c.corretor || '').replace(/"/g, '""')}"`,
    c.dataInicio || '',
    c.dataFim || '',
    c.dataAssinatura || '',
    c.valor ? Number(c.valor).toFixed(2) : '0.00',
    c.condominio ? Number(c.condominio).toFixed(2) : '0.00',
    c.iptu ? Number(c.iptu).toFixed(2) : '0.00',
    c.diaVencimento || '',
    `"${(c.formaPagamento || '').replace(/"/g, '""')}"`,
    c.taxaAdministracao ? Number(c.taxaAdministracao).toFixed(2) : '0.00',
    c.repasseProprietario ? Number(c.repasseProprietario).toFixed(2) : '0.00',
    `"${(c.garantiaTipo || '').replace(/"/g, '""')}"`,
    c.garantiaValor ? Number(c.garantiaValor).toFixed(2) : '0.00',
    `"${(c.indiceReajuste || '').replace(/"/g, '""')}"`,
    `"${(c.observacoes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}



// Consultar Contratos (Listagem padronizada Urbânia com filtros rápidos, pesquisa, status inline e exportação)
const PERIODOS_CONTRATO = [
  { value: 'vigentes', label: 'Vigentes hoje' },
  { value: 'a_vencer_30', label: 'A vencer em 30 dias' },
  { value: 'a_vencer_60', label: 'A vencer em 60 dias' },
  { value: 'vencidos', label: 'Vencidos / Encerrados' },
  { value: 'iniciados_mes', label: 'Iniciados este mês' },
];

export function ContratosList() {
  const navigate = useNavigate();
  const toast = useToast();
  const { rows, setRows, loading, reload } = useList('contratos');
  const clientes = useList('clientes');
  const imoveis = useList('imoveis');
  const corretores = useList('funcionarios', { cargo: 'Corretor' });

  const [term, setTerm] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [corretorFiltro, setCorretorFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [periodoVigencia, setPeriodoVigencia] = useState('');

  const del = useDelete('contratos', 'Contrato', reload);

  const cliente = (id: number) => clientes.rows.find(c => c.id === id);
  const imovel = (id: number) => imoveis.rows.find(i => i.id === id);

  const hoje = todayISO();
  const d30 = new Date(); d30.setDate(d30.getDate() + 30);
  const iso30 = d30.toISOString().slice(0, 10);
  const d60 = new Date(); d60.setDate(d60.getDate() + 60);
  const iso60 = d60.toISOString().slice(0, 10);

  // Filtros combinados e período de vigência
  const filtered = rows
    .filter(c => (!tipoFiltro ? true : c.tipo === tipoFiltro))
    .filter(c => (!statusFiltro ? true : c.status === statusFiltro))
    .filter(c => (!corretorFiltro ? true : String(c.corretorId) === String(corretorFiltro) || c.corretor === corretorFiltro))
    .filter(c => {
      const d = (c.dataInicio || '').slice(0, 10);
      if (dataInicio && d < dataInicio) return false;
      if (dataFim && d > dataFim) return false;
      return true;
    })
    .filter(c => {
      if (!periodoVigencia) return true;
      if (periodoVigencia === 'vigentes') return (c.dataInicio || '') <= hoje && (!c.dataFim || c.dataFim >= hoje);
      if (periodoVigencia === 'a_vencer_30') return Boolean(c.dataFim && c.dataFim >= hoje && c.dataFim <= iso30);
      if (periodoVigencia === 'a_vencer_60') return Boolean(c.dataFim && c.dataFim >= hoje && c.dataFim <= iso60);
      if (periodoVigencia === 'vencidos') return Boolean(c.dataFim && c.dataFim < hoje);
      if (periodoVigencia === 'iniciados_mes') return Boolean(c.dataInicio && c.dataInicio.startsWith(hoje.slice(0, 7)));
      return true;
    })
    .filter(c => matches(
      term,
      c.id,
      c.clienteNome,
      cliente(c.clienteId)?.nome,
      c.imovelTitulo,
      imovel(c.imovelId)?.titulo,
      c.corretor,
      c.proprietarioNome,
      c.tipo,
      c.status
    ))
    .sort((a, b) => b.id - a.id);

  // Mini dropdown interativo de alteração de status direto na tabela
  const setStatus = async (id: number, status: string) => {
    try {
      await api.put(`/contratos/${id}`, { status });
      setRows(rs => rs.map(r => (r.id === id ? { ...r, status } : r)));
      toast.success(`Status do contrato #${id} alterado para "${status}".`);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao atualizar o status do contrato.'));
    }
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast.error('Nenhum contrato para exportar.');
      return;
    }
    const dataHora = new Date().toISOString().slice(0, 10);
    exportContratosToCsv(filtered, `urbania_contratos_${dataHora}`);
    toast.success('Lista de contratos exportada com sucesso (.csv / Excel).');
  };

  const ativosCount = rows.filter(r => r.status === 'Ativo').length;

  const empty = (
    <div className="py-8 flex flex-col items-center gap-3">
      <div className="w-16 h-16 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center">
        <FileText size={32} />
      </div>
      <p className="font-semibold text-slate-700">Nenhum contrato encontrado para os filtros selecionados.</p>
      <p className="text-xs text-slate-400 max-w-sm text-center">
        Crie novos contratos de locação ou compra e venda para gerenciar prazos, garantias e repasses aos proprietários.
      </p>
      <Pode acao="Criar"><button
        onClick={() => navigate('/contratos/novo')}
        className="mt-2 flex items-center gap-2 bg-[#0a2540] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#06182c] transition"
      >
        <Plus size={16} /> Novo Contrato
      </button></Pode>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Contratos"
        subtitle={`${rows.length} cadastrados (${ativosCount} ativos)`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              title="Exportar contratos para Excel/CSV (RNF 1.3)"
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition shadow-sm text-sm"
            >
              <FileSpreadsheet size={16} className="text-emerald-600" /> Exportar (.xlsx/CSV)
            </button>
            <Pode acao="Criar"><button
              onClick={() => navigate('/contratos/novo')}
              className="flex items-center gap-2 bg-[#0a2540] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#06182c] transition shadow-sm"
            >
              <Plus size={18} /> Novo Contrato
            </button></Pode>
          </div>
        }
      />

      <Card>
        <Toolbar>
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Buscar por cliente, imóvel, corretor, proprietário ou #ID..."
          />

          <FilterSelect
            value={tipoFiltro}
            onChange={setTipoFiltro}
            options={TIPOS_CONTRATO}
            placeholder="Todos os tipos"
          />

          <FilterSelect
            value={statusFiltro}
            onChange={setStatusFiltro}
            options={STATUS_CONTRATO}
            placeholder="Todos os status"
          />

          <FilterSelect
            value={corretorFiltro}
            onChange={setCorretorFiltro}
            options={corretores.rows.map(c => ({ value: String(c.id), label: `${c.nome}${c.status === 'Inativo' ? ' (Inativo)' : ''}` }))}
            placeholder="Todos os corretores"
          />

          <DateRangeFilter
            dataInicio={dataInicio}
            dataFim={dataFim}
            onChangeInicio={setDataInicio}
            onChangeFim={setDataFim}
          />
          <FilterSelect
            value={periodoVigencia}
            onChange={setPeriodoVigencia}
            options={PERIODOS_CONTRATO}
            placeholder="Todas as vigências"
          />
        </Toolbar>

        <DataTable
          dense
          layoutFixed
          rows={filtered}
          loading={loading || clientes.loading || imoveis.loading}
          empty={empty}
          onRowClick={r => navigate(`/contratos/${r.id}`)}
          columns={[
            {
              key: 'id',
              label: 'Código',
              render: r => <span className="font-mono text-slate-500 font-medium whitespace-nowrap">#{r.id}</span>,
              className: 'w-20 min-w-[76px] whitespace-nowrap',
            },
            {
              key: 'imovel',
              label: 'Imóvel',
              className: 'text-slate-700',
              render: r => {
                const imv = imovel(r.imovelId);
                const foto = parsePhotos(imv?.fotos)[0];
                return (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60 flex items-center justify-center">
                      {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <Building2 size={18} className="text-slate-400" />}
                    </div>
                    <div className="min-w-0 max-w-[280px] lg:max-w-[340px]">
                      <p className="font-semibold text-slate-800 leading-snug truncate" title={imv?.titulo || r.imovelTitulo || `Imóvel #${r.imovelId}`}>
                        {imv?.titulo || r.imovelTitulo || `Imóvel #${r.imovelId}`}
                      </p>
                      <p className="text-xs text-slate-400 truncate" title={enderecoCurto(imv)}>
                        {enderecoCurto(imv)}
                      </p>
                    </div>
                  </div>
                );
              },
            },
            {
              key: 'cliente',
              label: 'Inquilino / Comprador',
              className: 'text-slate-700',
              render: r => {
                const c = cliente(r.clienteId);
                const nome = c?.nome || r.clienteNome || `#${r.clienteId}`;
                return (
                  <div
                    className="flex items-center gap-2 min-w-0"
                    title={c?.telefone ? `${nome} • ${c.telefone}` : nome}
                  >
                    <Avatar src={c?.foto} name={nome} size="sm" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm break-words">{nome}</p>
                      {c?.telefone && <p className="text-[11px] text-slate-400 whitespace-nowrap">{c.telefone}</p>}
                    </div>
                  </div>
                );
              },
            },
            {
              key: 'tipo',
              label: 'Tipo',
              className: 'w-28',
              render: r => (
                <span className="text-xs font-semibold text-cadastro">{r.tipo || 'Locação'}</span>
              ),
            },
            {
              key: 'valor',
              label: 'Valor',
              className: 'w-28',
              render: r => (
                <div>
                  <span className="font-bold text-cadastro text-sm">
                    {formatCurrency(r.valor)}
                  </span>
                  {r.tipo === 'Locação' && <span className="text-[11px] text-slate-400 ml-1">/mês</span>}
                </div>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              className: 'w-40',
              render: r => (
                <StatusDropdown
                  value={r.status || 'Ativo'}
                  options={STATUS_CONTRATO}
                  onChange={s => setStatus(r.id, s)}
                />
              ),
            },
          ]}
          actions={r => (
            <RowActions
              onView={() => navigate(`/contratos/${r.id}`)}
              onEdit={() => navigate(`/contratos/${r.id}/editar`)}
              onDelete={() => del.ask(r.id, `Contrato #${r.id} (${r.tipo} - ${r.clienteNome || ''})`)}
            />
          )}
        />
      </Card>

      {del.modal}
    </div>
  );
}

// Aba de Relacionamentos, Rastreabilidade e Repasse ao Proprietário (RNF Usabilidade & Históricos)
function ContratoHistoricoERelacionamentos({ record }: { record: Record<string, any> }) {
  const navigate = useNavigate();
  const multas = useList('multas', { contratoId: record.id });
  const clientes = useList('clientes');
  const imoveis = useList('imoveis');
  const proprietarios = useList('proprietarios');

  const c = clientes.rows.find(x => x.id === record.clienteId);
  const i = imoveis.rows.find(x => x.id === record.imovelId);
  const p = proprietarios.rows.find(x => x.id === (record.proprietarioId || i?.proprietarioId));

  const valorAluguel = Number(record.valor || 0);
  const taxaPct = Number(record.taxaAdministracao || 0);
  const comissaoImobiliaria = (valorAluguel * taxaPct) / 100;
  const repasseLiquido = record.repasseProprietario ?? (valorAluguel - comissaoImobiliaria);
  const totalMensalLocatario = valorAluguel + Number(record.condominio || 0) + Number(record.iptu || 0);

  return (
    <div className="space-y-6 mt-4">
      {/* Demonstrativo Financeiro de Repasse ao Proprietário (Objetivo central do Urbânia no PDF pág. 4) */}
      <RelatedGrid title="Demonstrativo Financeiro & Repasse ao Proprietário">
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-slate-600 mb-2">
              <DollarSign size={18} className="text-teal-600" />
              <p className="text-xs font-bold uppercase tracking-wider">Custo Mensal do Inquilino</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalMensalLocatario)}</p>
            <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-1 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Aluguel Principal:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(record.valor)}</span>
              </div>
              <div className="flex justify-between">
                <span>Condomínio Estimado:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(record.condominio || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>IPTU Estimado:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(record.iptu || 0)}</span>
              </div>
            </div>
          </div>

          <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-100">
            <div className="flex items-center gap-2 text-sky-800 mb-2">
              <Landmark size={18} className="text-sky-600" />
              <p className="text-xs font-bold uppercase tracking-wider">Honorários da Imobiliária</p>
            </div>
            <p className="text-2xl font-bold text-sky-900">{formatCurrency(comissaoImobiliaria)}</p>
            <p className="text-xs text-sky-600 mt-1">Taxa de administração: {taxaPct}% sobre o valor base</p>
            <div className="mt-3 pt-3 border-t border-sky-200/60 space-y-1 text-xs text-slate-500">
              <p className="leading-relaxed">
                Gestão da cobrança, vistorias periódicas, emissão de boletos e repasse bancário.
              </p>
            </div>
          </div>

          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-800 mb-2">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <p className="text-xs font-bold uppercase tracking-wider">Repasse Líquido ao Proprietário</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(repasseLiquido)}</p>
            <p className="text-xs text-emerald-600 mt-1">Destinatário: {p?.nome || record.proprietarioNome || 'Proprietário'}</p>
            <div className="mt-3 pt-3 border-t border-emerald-200/80 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Chave PIX:</span>
                <span className="font-medium">{p?.chavePix || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Banco / Conta:</span>
                <span className="font-medium">{p?.banco ? `${p.banco} Ag ${p.agencia} C/C ${p.conta}` : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </RelatedGrid>

      {/* Histórico de Multas do Contrato (RF Cadastrar Multa - pág. 15 e 27) */}
      <RelatedGrid title="Multas e Ocorrências Vinculadas ao Contrato">
        <div className="p-3 bg-slate-50/50 border-b flex justify-between items-center">
          <p className="text-xs text-slate-500">Penalidades, juros por atraso ou danos registrados para este contrato.</p>
          <Pode acao="Criar" modulo="multas"><button
            type="button"
            onClick={() => navigate('/multas/novo', { state: { contratoId: record.id } })}
            className="text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-sm"
          >
            <Plus size={14} /> Aplicar Multa
          </button></Pode>
        </div>
        <DataTable
          compact
          rows={multas.rows}
          loading={multas.loading}
          empty="Nenhuma multa ou penalidade registrada para este contrato."
          columns={[
            { key: 'id', label: 'ID', render: r => `#${r.id}`, className: 'font-mono text-slate-500 w-16' },
            { key: 'motivo', label: 'Motivo / Infração', render: r => <span className="font-semibold text-slate-800">{r.motivo}</span> },
            { key: 'dataAplicacao', label: 'Data de Aplicação', render: r => formatDate(r.dataAplicacao) },
            { key: 'valor', label: 'Valor da Multa', render: r => <span className="font-bold text-rose-700">{formatCurrency(r.valor)}</span> },
            { key: 'status', label: 'Status', render: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
          ]}
          actions={r => (
            <button
              type="button"
              onClick={() => navigate(`/multas/${r.id}`)}
              className="inline-flex items-center gap-1 text-sky-600 font-semibold text-xs hover:underline"
            >
              <Eye size={14} /> Detalhes
            </button>
          )}
        />
      </RelatedGrid>

      {/* Linha do Tempo e Rastreabilidade */}
      <RelatedGrid title="Rastreabilidade e Prazos do Instrumento Contratual">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
              <Calendar size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Assinatura e Início de Vigência</p>
              <p className="text-xs text-slate-500">
                Assinado em: {formatDate(record.dataAssinatura || record.dataInicio)} · Entrada em vigor: {formatDate(record.dataInicio)}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Intermediado por {record.corretor || 'Corretor'} para {c?.nome || record.clienteNome || 'Cliente'}.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              record.status === 'Ativo' ? 'bg-emerald-100 text-emerald-600' : record.status === 'Rescindido' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
            }`}>
              {record.status === 'Ativo' ? <CheckCircle2 size={16} /> : record.status === 'Rescindido' ? <XCircle size={16} /> : <Clock size={16} />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Situação Vigente: <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${statusColor(record.status)}`}>{record.status || 'Ativo'}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {record.dataFim ? `Vigência prevista até ${formatDate(record.dataFim)}.` : 'Contrato por prazo indeterminado.'}
              </p>
            </div>
          </div>
        </div>
      </RelatedGrid>
    </div>
  );
}

// Cadastrar / Visualizar / Editar Contrato
export function ContratoPage({ mode }: { mode: Mode }) {
  const clientes = useList('clientes');
  const imoveis = useList('imoveis');
  const proprietarios = useList('proprietarios');
  const corretores = useList('funcionarios', { cargo: 'Corretor', status: 'Ativo' });
  const negociacoes = useList('negociacoes');
  const contratos = useList('contratos');

  if (clientes.loading || imoveis.loading || proprietarios.loading || corretores.loading || negociacoes.loading || contratos.loading) {
    return <p className="text-slate-400 p-8">Carregando dados necessários...</p>;
  }

  const corretoresAtivos = corretores.rows.filter(c => c.status !== 'Inativo');
  const find = (list: any[], id: unknown) => list.find(x => String(x.id) === String(id));

  // Ao escolher o imóvel (direto ou pela negociação): preenche proprietário, corretor, valores e taxas
  const aoSelecionarImovel = (imovelId: unknown, form: Record<string, any>): Record<string, any> => {
    const id = imovelId ? Number(imovelId) : null;
    const sel = find(imoveis.rows, id);
    if (sel) {
      const tipoSugerido = (sel.finalidade === 'Aluguel' || sel.finalidade === 'Temporada') ? 'Locação' : 'Compra e Venda';
      const valorSugerido = tipoSugerido === 'Locação' ? (sel.precoAluguel || 0) : (sel.precoVenda || 0);
      const prop = find(proprietarios.rows, sel.proprietarioId);
      const taxa = tipoSugerido === 'Locação' ? 10 : 6;
      const repasse = valorSugerido - (valorSugerido * taxa / 100);
      const corrAtivo = corretoresAtivos.find(c => String(c.id) === String(sel.responsavelId));
      return {
        ...form,
        imovelId: id,
        imovelTitulo: sel.titulo,
        proprietarioId: sel.proprietarioId,
        proprietarioNome: prop?.nome || null,
        corretorId: corrAtivo ? corrAtivo.id : (corretoresAtivos.some(c => String(c.id) === String(form.corretorId)) ? form.corretorId : null),
        tipo: form.tipo || tipoSugerido,
        valor: form.valor || valorSugerido,
        condominio: sel.condominio || 0,
        iptu: sel.iptu || 0,
        taxaAdministracao: form.taxaAdministracao || taxa,
        repasseProprietario: repasse,
      };
    }
    return {
      ...form,
      imovelId: null,
    };
  };

  // Negociações que ainda podem evoluir para contrato (não canceladas e sem contrato vinculado)
  const vinculadas = new Set(contratos.rows.map(c => c.negociacaoId).filter(Boolean).map(String));
  const negociacoesDisponiveis = mode === 'create'
    ? negociacoes.rows.filter(n => n.status !== 'Cancelada' && n.status !== 'Convertida em Contrato' && !vinculadas.has(String(n.id)))
    : negociacoes.rows;
  const TIPO_CONTRATO_POR_NEGOCIACAO: Record<string, string> = { Venda: 'Compra e Venda', 'Locação': 'Locação', Temporada: 'Temporada' };

  const tabs: TabDef[] = [
    {
      label: 'Negociação',
      fields: [
        {
          key: 'negociacaoId',
          label: 'Negociação que evolui para este contrato',
          type: 'search-select',
          full: true,
          disabled: (_, m) => m === 'edit',
          placeholder: 'Opcional: selecione a negociação de origem',
          options: negociacoesDisponiveis.map(n => ({
            value: n.id,
            label: `#${n.id} - ${n.clienteNome || `Cliente #${n.clienteId}`} · ${n.imovelTitulo || `Imóvel #${n.imovelId}`}`,
            hint: [n.tipo, formatCurrency(n.valor), n.corretor, n.status].filter(Boolean).join(' · '),
          })),
          renderView: val => {
            const n = find(negociacoes.rows, val);
            return n ? `#${n.id} - ${n.clienteNome || ''} · ${n.imovelTitulo || ''}` : 'Contrato sem negociação de origem';
          },
          // Puxa cliente, imóvel, corretor, tipo e valor acordado na negociação
          onChange: (negociacaoId, form) => {
            const n = find(negociacoes.rows, negociacaoId);
            if (!n) return { ...form, negociacaoId };
            const corretorAtivo = corretoresAtivos.some(c => String(c.id) === String(n.corretorId));
            const preenchido = aoSelecionarImovel(n.imovelId, {
              ...form,
              negociacaoId,
              clienteId: n.clienteId,
              tipo: TIPO_CONTRATO_POR_NEGOCIACAO[n.tipo] || form.tipo,
              valor: n.valor || form.valor,
            });
            const valor = Number(preenchido.valor || 0);
            const taxa = Number(preenchido.taxaAdministracao || 0);
            return {
              ...preenchido,
              corretorId: corretorAtivo ? n.corretorId : preenchido.corretorId,
              repasseProprietario: valor - (valor * taxa / 100),
            };
          },
        },
      ],
      render: form => {
        const n = find(negociacoes.rows, form.negociacaoId);
        if (!n) return null;
        return (
          <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-3 text-sky-800">
              <Handshake size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Dados da Negociação de Origem</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="block text-[11px] font-semibold uppercase text-slate-400">Data da Proposta</span>
                <span className="font-medium text-slate-700">{formatDate(n.data)}</span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold uppercase text-slate-400">Tipo</span>
                <span className="font-medium text-slate-700">{n.tipo || '—'}</span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold uppercase text-slate-400">Valor Acordado</span>
                <span className="font-bold text-slate-800">{formatCurrency(n.valor)}</span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold uppercase text-slate-400">Forma de Pagamento</span>
                <span className="font-medium text-slate-700">{n.formaPagamento || '—'}</span>
              </div>
            </div>
            {n.observacoes && (
              <p className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600 whitespace-pre-wrap">{n.observacoes}</p>
            )}
          </div>
        );
      },
    },
    {
      label: 'Dados do Contrato',
      fields: [
        {
          key: 'imovelId',
          label: 'Imóvel Contratado',
          type: 'search-select',
          required: true,
          disabled: (_, m) => m === 'edit',
          placeholder: 'Selecione um imóvel...',
          options: imoveis.rows.map(i => ({
            value: i.id,
            label: `#${i.id} - ${i.titulo}`,
            hint: [
              i.tipo,
              i.finalidade,
              [i.bairro, i.cidade].filter(Boolean).join(', '),
              i.precoAluguel ? `${formatCurrency(i.precoAluguel)}/mês` : null,
              i.precoVenda ? formatCurrency(i.precoVenda) : null,
            ].filter(Boolean).join(' · '),
          })),
          renderView: (val, form) => {
            const im = imoveis.rows.find(i => String(i.id) === String(val));
            return im ? `#${im.id} - ${im.titulo}` : form.imovelTitulo || (val ? `Imóvel #${val}` : '—');
          },
          onChange: aoSelecionarImovel,
        },
        {
          key: 'clienteId',
          label: 'Cliente (Inquilino / Comprador)',
          type: 'search-select',
          required: true,
          disabled: (_, m) => m === 'edit',
          options: clientes.rows.map(c => ({
            value: c.id,
            label: c.nome,
            hint: [c.tipo, c.cpfCnpj ? `Doc: ${c.cpfCnpj}` : null, c.telefone].filter(Boolean).join(' · '),
          })),
          renderView: (val, form) => {
            const cl = clientes.rows.find(c => String(c.id) === String(val));
            return cl?.nome || form.clienteNome || (val ? `Cliente #${val}` : '—');
          },
        },
        {
          key: 'corretorId',
          label: 'Corretor Intermediador',
          type: 'search-select',
          required: true,
          options: corretoresAtivos.map(c => ({
            value: c.id,
            label: `${c.nome}${c.creci ? ` (${c.creci})` : ''}`,
          })),
          renderView: (val, form) => {
            const co = corretores.rows.find(c => String(c.id) === String(val));
            return co?.nome || form.corretor || form.corretorNome || (val ? `Corretor #${val}` : '—');
          },
        },
        {
          key: 'tipo',
          label: 'Tipo de Contrato',
          type: 'select',
          required: true,
          options: TIPOS_CONTRATO,
        },
        {
          key: 'finalidade',
          label: 'Finalidade do Uso',
          type: 'select',
          options: FINALIDADES_CONTRATO,
        },
        {
          key: 'status',
          label: 'Status do Contrato',
          type: 'select',
          options: STATUS_CONTRATO,
          hidden: () => mode === 'create',
        },
        {
          key: 'dataInicio',
          label: 'Data de Início da Vigência',
          type: 'date',
          required: true,
        },
        {
          key: 'dataFim',
          label: 'Data de Término da Vigência',
          type: 'date',
          required: form => form.tipo !== 'Compra e Venda',
        },
        {
          key: 'dataAssinatura',
          label: 'Data da Assinatura',
          type: 'date',
        },
      ],
      render: form => {
        const c = find(clientes.rows, form.clienteId);
        const i = find(imoveis.rows, form.imovelId);
        const p = i ? find(proprietarios.rows, form.proprietarioId || i.proprietarioId) : null;

        return (
          <div className="space-y-4 mt-6">
            {/* Box informativo do Cliente (RNF de Usabilidade e Integridade) */}
            {c && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 mb-2 text-sky-800">
                  <User size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Dados do Locatário / Comprador Vinculado</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="block text-[11px] font-semibold uppercase text-slate-400">Nome Completo</span>
                    <span className="font-semibold text-slate-800">{c.nome}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-semibold uppercase text-slate-400">CPF / CNPJ</span>
                    <span className="font-medium text-slate-700">{c.cpfCnpj || 'Não cadastrado'}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-semibold uppercase text-slate-400">Telefone</span>
                    <span className="font-medium text-slate-700">{c.telefone || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-semibold uppercase text-slate-400">E-mail</span>
                    <span className="font-medium text-slate-700">{c.email || '—'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Box informativo do Imóvel e Proprietário Vinculado */}
            {i && (
              <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sky-800">
                    <Building2 size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Identificação do Imóvel & Proprietário Legal</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-sky-700 bg-white px-2 py-0.5 rounded border border-sky-200">
                    Matrícula/ID #{i.id}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{i.titulo}</p>
                    <div className="flex items-start gap-1.5 text-slate-600 mt-1">
                      <MapPin size={14} className="text-sky-600 shrink-0 mt-0.5" />
                      <span>{fullAddress(i) || 'Endereço não cadastrado'}</span>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-sky-200/80">
                    <span className="block text-[11px] font-bold uppercase text-slate-400 mb-0.5">Proprietário (Locador/Vendedor)</span>
                    <p className="font-bold text-slate-800">{p?.nome || form.proprietarioNome || 'Proprietário vinculado ao imóvel'}</p>
                    {p && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {p.tipo === 'Jurídica' ? `CNPJ: ${p.cnpj || p.cpfCnpj}` : `CPF: ${p.cpfCnpj}`} · PIX: {p.chavePix || 'Não informada'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      label: 'Valores e Pagamento',
      fields: [
        {
          key: 'valor',
          label: 'Valor Principal do Contrato',
          type: 'currency',
          required: true,
          placeholder: 'R$ 0,00',
          onChange: (valor, form) => {
            const taxa = Number(form.taxaAdministracao || 0);
            const v = Number(valor || 0);
            const repasse = v - (v * (taxa / 100));
            return { ...form, valor, repasseProprietario: repasse >= 0 ? repasse : 0 };
          },
        },
        {
          key: 'condominio',
          label: 'Valor do Condomínio (Estimado)',
          type: 'currency',
          placeholder: 'R$ 0,00',
        },
        {
          key: 'iptu',
          label: 'Valor do IPTU (Mensal Estimado)',
          type: 'currency',
          placeholder: 'R$ 0,00',
        },
        {
          key: 'diaVencimento',
          label: 'Dia de Vencimento do Aluguel',
          type: 'number',
          placeholder: 'Ex: 10',
          required: form => form.tipo === 'Locação',
        },
        {
          key: 'formaPagamento',
          label: 'Forma de Pagamento',
          type: 'select',
          options: FORMAS_PAGAMENTO_CONTRATO,
        },
        {
          key: 'taxaAdministracao',
          label: 'Taxa de Administração Imobiliária (%)',
          type: 'number',
          placeholder: 'Ex: 10',
          suffix: '%',
          onChange: (taxa, form) => {
            const v = Number(form.valor || 0);
            const t = Number(taxa || 0);
            const repasse = v - (v * (t / 100));
            return { ...form, taxaAdministracao: taxa, repasseProprietario: repasse >= 0 ? repasse : 0 };
          },
        },
        {
          key: 'repasseProprietario',
          label: 'Valor de Repasse Líquido ao Proprietário',
          type: 'currency',
          placeholder: 'Calculado automaticamente',
        },
        {
          key: 'garantiaTipo',
          label: 'Modalidade de Garantia Locatícia',
          type: 'select',
          options: TIPOS_GARANTIA,
        },
        {
          key: 'garantiaValor',
          label: 'Valor da Garantia / Depósito Caução',
          type: 'currency',
          placeholder: 'R$ 0,00',
        },
        {
          key: 'garantiaDetalhes',
          label: 'Detalhes da Garantia (Fiador / Apólice / Dados Bancários)',
          type: 'text',
          placeholder: 'Ex: Apólice nº 12345 da Seguradora X ou Nome e CPF do Fiador',
        },
      ],
      render: form => {
        const v = Number(form.valor || 0);
        const taxa = Number(form.taxaAdministracao || 0);
        const comissao = (v * taxa) / 100;
        const total = v + Number(form.condominio || 0) + Number(form.iptu || 0);

        return (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-2 text-slate-700">
              <DollarSign size={18} className="text-teal-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Resumo dos Valores Calculados</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Custo Total Mensal (Inquilino):</span>
                <p className="text-base font-bold text-slate-800">{formatCurrency(total)}</p>
                <p className="text-[11px] text-slate-400">Aluguel + Condomínio + IPTU</p>
              </div>
              <div>
                <span className="text-slate-500">Comissão Imobiliária ({taxa}%):</span>
                <p className="text-base font-bold text-sky-800">{formatCurrency(comissao)}</p>
                <p className="text-[11px] text-slate-400">Retenção de intermediação</p>
              </div>
              <div>
                <span className="text-slate-500">Repasse Líquido ao Proprietário:</span>
                <p className="text-base font-bold text-emerald-700">{formatCurrency(form.repasseProprietario || (v - comissao))}</p>
                <p className="text-[11px] text-slate-400">A ser depositado na conta do locador</p>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      label: 'Cláusulas e Termos',
      fields: [
        {
          key: 'indiceReajuste',
          label: 'Índice de Reajuste Anual',
          type: 'select',
          options: INDICES_REAJUSTE,
        },
        {
          key: 'multaAtraso',
          label: 'Multa Moratória por Atraso (%)',
          type: 'number',
          suffix: '%',
          placeholder: 'Ex: 2',
        },
        {
          key: 'multaRescisoria',
          label: 'Cláusula de Rescisão / Multa Contratual',
          type: 'text',
          placeholder: 'Ex: 3 meses de aluguel proporcionais ao prazo residual.',
          full: true,
        },
        {
          key: 'observacoes',
          label: 'Observações Gerais, Vistorias e Cláusulas Especiais',
          type: 'textarea',
          full: true,
          placeholder: 'Descreva regras sobre animais, reformas permitidas, transferência de titularidade de energia/água, etc...',
        },
      ],
    },
  ];

  return (
    <>
      <EntityPage
        mode={mode}
        entity="contratos"
        basePath="/contratos"
        singular="Contrato"
        tabs={tabs}
        defaults={{
          tipo: 'Locação',
          status: 'Ativo',
          finalidade: 'Residencial',
          dataInicio: todayISO(),
          taxaAdministracao: 10,
          diaVencimento: 10,
          formaPagamento: 'Boleto Bancário',
          indiceReajuste: 'IPCA',
          multaAtraso: 2.0,
          multaRescisoria: '3 meses de aluguel proporcionais ao tempo restante.',
          garantiaTipo: 'Caução em Dinheiro',
        }}
        cancelConfirm={mode === 'edit' ? 'Tem certeza que deseja cancelar? As alterações não serão salvas.' : undefined}
        validate={f => {
          if (!f.imovelId) return 'Selecione o imóvel objeto do contrato.';
          if (!f.clienteId) return 'Selecione o cliente (inquilino ou comprador).';
          if (!f.corretorId) return 'Selecione o corretor responsável.';
          const corr = corretores.rows.find(c => String(c.id) === String(f.corretorId));
          if (!corr || corr.status === 'Inativo') return 'O corretor selecionado está inativo. Selecione um corretor ativo.';
          if (!f.dataInicio) return 'A data de início de vigência é obrigatória.';
          if (f.tipo !== 'Compra e Venda' && !f.dataFim) return 'Para contratos de locação ou temporada, a data de término é obrigatória.';
          if (f.dataInicio && f.dataFim && f.dataFim < f.dataInicio) return 'A data de término não pode ser anterior à data de início.';
          if (!f.valor || Number(f.valor) <= 0) return 'O valor do contrato deve ser maior que zero.';
          if (f.tipo === 'Locação' && (!f.diaVencimento || Number(f.diaVencimento) < 1 || Number(f.diaVencimento) > 31)) {
            return 'Informe um dia de vencimento válido (entre 1 e 31).';
          }
          return null;
        }}
        prepare={f => {
          const c = find(clientes.rows, f.clienteId);
          const imv = find(imoveis.rows, f.imovelId);
          const p = imv ? find(proprietarios.rows, imv.proprietarioId) : null;
          const corr = find(corretores.rows, f.corretorId);

          const valor = Number(f.valor || 0);
          const taxa = Number(f.taxaAdministracao || 0);
          const repasse = f.repasseProprietario !== undefined ? Number(f.repasseProprietario) : (valor - (valor * taxa / 100));

          return {
            ...f,
            status: f.status || 'Ativo',
            clienteNome: c?.nome || f.clienteNome || null,
            imovelTitulo: imv?.titulo || f.imovelTitulo || null,
            proprietarioId: imv?.proprietarioId || f.proprietarioId || null,
            proprietarioNome: p?.nome || f.proprietarioNome || null,
            corretorId: f.corretorId ? Number(f.corretorId) : null,
            corretor: corr?.nome || f.corretor || null,
            repasseProprietario: repasse,
          };
        }}
        extraTabs={[
          {
            label: 'Histórico, Repasse e Vínculos',
            render: f => <ContratoHistoricoERelacionamentos record={f} />,
          },
        ]}
      />
    </>
  );
}
