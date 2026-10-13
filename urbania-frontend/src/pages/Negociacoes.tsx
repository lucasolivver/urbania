import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  Handshake,
  MapPin,
  Plus,
  TrendingDown,
  TrendingUp,
  User,
  XCircle,
} from 'lucide-react';
import { api } from '../api';
import { Card, DataTable, DateRangeFilter, FilterSelect, PageHeader, RowActions, SearchInput, Toolbar, matches } from '../components/DataTable';
import { Avatar } from '../components/EntityForm';
import type { Mode, TabDef } from '../components/EntityForm';
import { EntityPage, RelatedGrid } from '../components/EntityPage';
import { ConfirmModal } from '../components/Modal';
import { apiError, useToast } from '../components/Toast';
import { useDelete } from '../components/useDelete';
import { useList } from '../lib/useApi';
import { formatCurrency, formatDate, fullAddress, todayISO } from '../lib/format';
import { FORMAS_PAGAMENTO, STATUS_NEGOCIACAO, TIPOS_NEGOCIACAO, statusColor } from '../lib/options';
import { StatusDropdown } from '../components/StatusDropdown';
import { Pode } from '../lib/auth';



// Exportação nativa para CSV / Excel (RNF 1.3 - pág. 32)
function exportToCsv(data: any[], filename: string) {
  const headers = ['ID Proposta', 'Data', 'Cliente', 'Imóvel', 'Corretor', 'Tipo', 'Valor Proposto (R$)', 'Status', 'Forma de Pagamento', 'Observações'];
  const rows = data.map(n => [
    n.id,
    n.data || '',
    `"${(n.clienteNome || '').replace(/"/g, '""')}"`,
    `"${(n.imovelTitulo || '').replace(/"/g, '""')}"`,
    `"${(n.corretor || '').replace(/"/g, '""')}"`,
    n.tipo || '',
    n.valor ? Number(n.valor).toFixed(2) : '0.00',
    n.status || '',
    `"${(n.formaPagamento || '').replace(/"/g, '""')}"`,
    `"${(n.observacoes || '').replace(/"/g, '""')}"`,
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

// Consultar Negociações (Padrão de Consulta Urbânia com RFs e RNFs de Propostas/Negociações)
export function NegociacoesList() {
  const navigate = useNavigate();
  const toast = useToast();
  const { rows, setRows, loading, reload } = useList('negociacoes');
  const clientes = useList('clientes');
  const imoveis = useList('imoveis');
  const corretores = useList('funcionarios', { cargo: 'Corretor' });

  const [term, setTerm] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [corretorFiltro, setCorretorFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [cancelarId, setCancelarId] = useState<number | null>(null);

  const del = useDelete('negociacoes', 'Negociação', reload);

  const cliente = (id: number) => clientes.rows.find(c => c.id === id);
  const imovel = (id: number) => imoveis.rows.find(i => i.id === id);

  // Filtros combinados (RNF 1.2: filtros por período e por Usuário Responsável)
  const filtered = rows
    .filter(n => (!statusFiltro ? true : n.status === statusFiltro))
    .filter(n => (!corretorFiltro ? true : String(n.corretorId) === String(corretorFiltro) || n.corretor === corretorFiltro))
    .filter(n => (!tipoFiltro ? true : n.tipo === tipoFiltro))
    .filter(n => {
      const d = (n.data || '').slice(0, 10);
      if (dataInicio && d < dataInicio) return false;
      if (dataFim && d > dataFim) return false;
      return true;
    })
    .filter(n => matches(
      term,
      n.id,
      n.clienteNome,
      cliente(n.clienteId)?.nome,
      n.imovelTitulo,
      imovel(n.imovelId)?.titulo,
      n.corretor,
      n.status,
      n.tipo
    ))
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.id - a.id);

  // Alteração direta do status na tabela (RNF de Usabilidade)
  const setStatus = async (id: number, status: string) => {
    try {
      await api.put(`/negociacoes/${id}`, { status });
      setRows(rs => rs.map(r => (r.id === id ? { ...r, status } : r)));
      toast.success(`Status da negociação #${id} alterado para "${status}".`);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao alterar o status da negociação.'));
    }
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast.error('Nenhum registro para exportar.');
      return;
    }
    const dataHora = new Date().toISOString().slice(0, 10);
    exportToCsv(filtered, `urbania_negociacoes_${dataHora}`);
    toast.success('Histórico de negociações exportado com sucesso (.csv / Excel).');
  };

  const empty = (
    <div className="py-8 flex flex-col items-center gap-3">
      <div className="w-16 h-16 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center">
        <Handshake size={32} />
      </div>
      <p className="font-semibold text-slate-700">Nenhuma negociação encontrada para estes filtros.</p>
      <p className="text-xs text-slate-400 max-w-sm text-center">
        Cadastre propostas e acompanhe o fluxo de negociação de compra, venda e locação entre clientes e corretores.
      </p>
      <Pode acao="Criar"><button
        onClick={() => navigate('/negociacoes/novo')}
        className="mt-2 flex items-center gap-2 bg-[#0a2540] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#06182c] transition"
      >
        <Plus size={16} /> Nova Negociação
      </button></Pode>
    </div>
  );

  const emAndamentoCount = rows.filter(r => r.status === 'Em Andamento').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Negociações"
        subtitle={`${rows.length} registradas (${emAndamentoCount} em andamento)`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              title="Exportar histórico nativo para Excel/PDF (RNF 1.3)"
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition shadow-sm text-sm"
            >
              <FileSpreadsheet size={16} className="text-emerald-600" /> Exportar (.xlsx/CSV)
            </button>
            <Pode acao="Criar"><button
              onClick={() => navigate('/negociacoes/novo')}
              className="flex items-center gap-2 bg-[#0a2540] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#06182c] transition shadow-sm"
            >
              <Plus size={18} /> Nova Negociação
            </button></Pode>
          </div>
        }
      />

      <Card>
        <Toolbar>
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Buscar por cliente, imóvel, corretor ou ID..."
          />

          <FilterSelect
            value={statusFiltro}
            onChange={setStatusFiltro}
            options={STATUS_NEGOCIACAO}
            placeholder="Todos os status"
          />

          <FilterSelect
            value={tipoFiltro}
            onChange={setTipoFiltro}
            options={TIPOS_NEGOCIACAO}
            placeholder="Todos os tipos"
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
        </Toolbar>

        <DataTable
          layoutFixed
          rows={filtered}
          loading={loading}
          empty={empty}
          onRowClick={r => navigate(`/negociacoes/${r.id}`)}
          columns={[
            {
              key: 'id',
              label: 'Código',
              render: r => <span className="font-mono text-slate-500 font-medium whitespace-nowrap">#{r.id}</span>,
              className: 'w-16 whitespace-nowrap',
            },
            {
              key: 'data',
              label: 'Data',
              className: 'w-24 whitespace-nowrap',
              render: r => <span className="font-semibold text-slate-800 whitespace-nowrap">{formatDate(r.data)}</span>,
            },
            {
              key: 'cliente',
              label: 'Cliente',
              className: 'w-44 lg:w-48 min-w-[120px]',
              render: r => {
                const c = cliente(r.clienteId);
                const nome = c?.nome || r.clienteNome || `#${r.clienteId}`;
                return (
                  <div
                    className="flex items-center gap-2 min-w-0"
                    title={c?.telefone ? `${nome} • ${c.telefone}` : nome}
                  >
                    <Avatar src={c?.foto} name={nome} size="sm" />
                    <span className="font-semibold text-slate-800 text-sm truncate">{nome}</span>
                  </div>
                );
              },
            },
            {
              key: 'imovel',
              label: 'Imóvel',
              className: 'min-w-[140px]',
              render: r => {
                const imv = imovel(r.imovelId);
                const titulo = imv?.titulo || r.imovelTitulo || `Imóvel #${r.imovelId}`;
                const endereco = [imv?.bairro, imv?.cidade].filter(Boolean).join(' - ');
                const tituloCompleto = endereco ? `${titulo} — ${endereco}` : titulo;
                return (
                  <div
                    className="truncate min-w-0 text-sm"
                    title={tituloCompleto}
                  >
                    <span className="font-mono text-slate-400 text-xs mr-1">#{r.imovelId}</span>
                    <span className="font-medium text-slate-800">{titulo}</span>
                    {endereco && <span className="text-slate-400 text-xs ml-1">— {endereco}</span>}
                  </div>
                );
              },
            },
            {
              key: 'tipo',
              label: 'Tipo',
              className: 'w-24 whitespace-nowrap',
              render: r => (
                <span className="text-xs font-semibold text-cadastro">{r.tipo || 'Venda'}</span>
              ),
            },
            {
              key: 'valor',
              label: 'Valor',
              className: 'w-28 whitespace-nowrap',
              render: r => (
                <span className="font-bold text-cadastro text-sm whitespace-nowrap">
                  {formatCurrency(r.valor)}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              className: 'w-36 whitespace-nowrap',
              render: r => (
                <StatusDropdown
                  value={r.status || 'Em Andamento'}
                  options={STATUS_NEGOCIACAO}
                  onChange={s => setStatus(r.id, s)}
                />
              ),
            },
          ]}
          actions={r => (
            <RowActions
              onView={() => navigate(`/negociacoes/${r.id}`)}
              onEdit={() => navigate(`/negociacoes/${r.id}/editar`)}
              onDelete={() => del.ask(r.id, `Proposta #${r.id} (${formatCurrency(r.valor)})`)}
            />
          )}
        />
      </Card>

      {cancelarId !== null && (
        <ConfirmModal
          title="Cancelar Negociação"
          message="Deseja realmente cancelar esta negociação? O status será alterado para Cancelada."
          onConfirm={() => {
            setStatus(cancelarId, 'Cancelada');
            setCancelarId(null);
          }}
          onCancel={() => setCancelarId(null)}
        />
      )}

      {del.modal}
    </div>
  );
}

// Linha do tempo e histórico na visualização da negociação (RNF de Históricos/Rastreabilidade)
function NegociacaoHistorico({ record }: { record: Record<string, any> }) {
  const isRealizada = record.status === 'Realizada';
  const isCancelada = record.status === 'Cancelada';
  const isConvertida = record.status === 'Convertida em Contrato';

  return (
    <div className="space-y-6">
      <RelatedGrid title="Rastreabilidade da Negociação">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
              <Calendar size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Proposta Registrada no Sistema</p>
              <p className="text-xs text-slate-500">
                Data do registro: {formatDate(record.data)} · Responsável: {record.corretor || 'Corretor'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Valor inicial proposto de {formatCurrency(record.valor)} ({record.tipo || 'Venda'}).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              isRealizada || isConvertida ? 'bg-emerald-100 text-emerald-600' : isCancelada ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
            }`}>
              {isRealizada || isConvertida ? <CheckCircle2 size={16} /> : isCancelada ? <XCircle size={16} /> : <Handshake size={16} />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Situação Atual: <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${statusColor(record.status)}`}>{record.status || 'Em Andamento'}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {isRealizada && 'Negociação finalizada com sucesso! A proposta foi aceita entre as partes e pode originar o contrato definitivo.'}
                {isCancelada && 'Negociação cancelada/descontinuada. Histórico preservado para fins de auditoria e métricas.'}
                {isConvertida && 'Negociação concluída e convertida em contrato. Consulte o contrato vinculado no módulo Contratos.'}
                {!isRealizada && !isCancelada && !isConvertida && 'Negociação em andamento e trâmites de aceite entre comprador/locatário e proprietário.'}
              </p>
            </div>
          </div>

          {record.observacoes && (
            <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Condições e Contrapropostas Registradas</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{record.observacoes}</p>
            </div>
          )}
        </div>
      </RelatedGrid>
    </div>
  );
}

// Cadastrar / Visualizar / Editar Negociação (Seguindo rigorosamente o padrão Urbânia)
export function NegociacaoPage({ mode }: { mode: Mode }) {
  const clientes = useList('clientes');
  const imoveis = useList('imoveis');
  const proprietarios = useList('proprietarios');
  const corretores = useList('funcionarios', { cargo: 'Corretor', status: 'Ativo' });
  const visitas = useList('visitas');

  if (clientes.loading || imoveis.loading || proprietarios.loading || corretores.loading || visitas.loading) {
    return <p className="text-slate-400 p-8">Carregando...</p>;
  }

  const corretoresAtivos = corretores.rows.filter(c => c.status !== 'Inativo');
  const find = (list: any[], id: unknown) => list.find(x => String(x.id) === String(id));

  // Ao escolher o imóvel (direto ou pela visita): sugere tipo, proprietário e valor
  const aoSelecionarImovel = (imovelId: unknown, form: Record<string, any>) => {
    const imv = find(imoveis.rows, imovelId);
    if (imv) {
      const tipoAuto = imv.finalidade === 'Aluguel' || imv.finalidade === 'Temporada' ? 'Locação' : 'Venda';
      const valorSugerido = tipoAuto === 'Locação' ? (imv.precoAluguel || 0) : (imv.precoVenda || 0);
      return {
        ...form,
        imovelId,
        tipo: form.tipo || tipoAuto,
        proprietarioId: imv.proprietarioId,
        valorOriginal: valorSugerido,
        // sugere o valor pedido se o usuário ainda não tiver preenchido
        valor: form.valor ? form.valor : valorSugerido,
      };
    }
  };

  const tabs: TabDef[] = [
    {
      label: 'Dados da Proposta',
      fields: [
        {
          key: 'visitaId',
          label: 'Visita de Origem',
          type: 'search-select',
          full: true,
          disabled: (_, m) => m === 'edit',
          placeholder: 'Opcional: selecione a visita que originou a proposta',
          options: visitas.rows
            .filter(v => v.status !== 'Cancelada')
            .map(v => ({
              value: v.id,
              label: `#${v.id} - ${v.clienteNome || `Cliente #${v.clienteId}`} · ${v.imovelTitulo || `Imóvel #${v.imovelId}`}`,
              hint: [formatDate(v.data), v.hora, v.corretor, v.status].filter(Boolean).join(' · '),
            })),
          renderView: val => {
            const v = find(visitas.rows, val);
            return v ? `#${v.id} - ${formatDate(v.data)} ${v.hora || ''} · ${v.corretor || ''}` : '—';
          },
          // Puxa cliente, imóvel e corretor da visita selecionada
          onChange: (visitaId, form) => {
            const v = find(visitas.rows, visitaId);
            if (!v) return { ...form, visitaId };
            const corretorAtivo = corretoresAtivos.some(c => String(c.id) === String(v.corretorId));
            const next = {
              ...form,
              visitaId,
              clienteId: v.clienteId,
              imovelId: v.imovelId,
              corretorId: corretorAtivo ? v.corretorId : form.corretorId,
            };
            return aoSelecionarImovel(v.imovelId, next) || next;
          },
        },
        {
          key: 'clienteId',
          label: 'Cliente Interessado',
          type: 'search-select',
          required: true,
          disabled: (_, m) => m === 'edit',
          options: clientes.rows.map(c => ({
            value: c.id,
            label: c.nome,
            hint: c.cpfCnpj ? `CPF/CNPJ: ${c.cpfCnpj}` : c.telefone,
          })),
          renderView: (val, form) => {
            const cl = clientes.rows.find(c => String(c.id) === String(val));
            return cl?.nome || form.clienteNome || (val ? `Cliente #${val}` : '—');
          },
        },
        {
          key: 'imovelId',
          label: 'Imóvel Negociado',
          type: 'search-select',
          required: true,
          disabled: (_, m) => m === 'edit',
          options: imoveis.rows.map(i => ({
            value: i.id,
            label: `#${i.id} - ${i.titulo}`,
            hint: [
              i.tipo,
              i.finalidade,
              i.precoVenda ? formatCurrency(i.precoVenda) : null,
              i.precoAluguel ? `${formatCurrency(i.precoAluguel)}/mês` : null,
            ]
              .filter(Boolean)
              .join(' · '),
          })),
          renderView: (val, form) => {
            const im = imoveis.rows.find(i => String(i.id) === String(val));
            return im ? `#${im.id} - ${im.titulo}` : form.imovelTitulo || (val ? `Imóvel #${val}` : '—');
          },
          onChange: aoSelecionarImovel,
        },
        {
          key: 'corretorId',
          label: 'Corretor Responsável',
          type: 'search-select',
          required: true,
          options: corretoresAtivos.map(c => ({ value: c.id, label: `${c.nome}${c.creci ? ` (CRECI ${c.creci})` : ''}` })),
          renderView: (val, form) => {
            const co = corretores.rows.find(c => String(c.id) === String(val));
            return co?.nome || form.corretor || form.corretorNome || (val ? `Corretor #${val}` : '—');
          },
        },
        {
          key: 'tipo',
          label: 'Tipo de Negociação',
          type: 'select',
          required: true,
          options: TIPOS_NEGOCIACAO,
        },
        {
          key: 'data',
          label: 'Data da Proposta',
          type: 'date',
          required: true,
        },
        {
          key: 'valor',
          label: 'Valor Proposto',
          type: 'currency',
          required: true,
          placeholder: 'R$ 0,00',
        },
        {
          key: 'formaPagamento',
          label: 'Forma de Pagamento Proposta',
          type: 'select',
          options: FORMAS_PAGAMENTO,
        },
        {
          key: 'status',
          label: 'Status da Negociação',
          type: 'select',
          options: STATUS_NEGOCIACAO,
          hidden: () => mode === 'create',
        },
        {
          key: 'observacoes',
          label: 'Observações, Condições Comerciais e Contrapropostas',
          type: 'textarea',
          full: true,
          placeholder: 'Descreva condições de entrada, parcelas, financiamento, eventuais permutas ou termos da contraproposta...',
        },
      ],
      render: form => {
        const c = find(clientes.rows, form.clienteId);
        const i = find(imoveis.rows, form.imovelId);
        const p = i ? find(proprietarios.rows, i.proprietarioId) : null;
        const precoReferencia = form.tipo === 'Locação' ? (i?.precoAluguel || 0) : (i?.precoVenda || 0);
        const diferenca = form.valor && precoReferencia ? Number(form.valor) - Number(precoReferencia) : null;
        const diffPercent = diferenca !== null && precoReferencia ? ((diferenca / precoReferencia) * 100).toFixed(1) : null;

        return (
          <div className="space-y-4 mt-6">
            {/* Box informativo do Cliente selecionado (RNF Usabilidade/Integridade) */}
            {c && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 mb-3 text-sky-800">
                  <User size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Dados do Cliente Vinculado</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-0.5">Nome do Cliente</label>
                    <input readOnly disabled value={c.nome || '—'} className="w-full px-3 py-1.5 text-xs font-medium border rounded-lg bg-white text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-0.5">CPF / CNPJ</label>
                    <input readOnly disabled value={c.cpfCnpj || '—'} className="w-full px-3 py-1.5 text-xs font-medium border rounded-lg bg-white text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-0.5">Telefone de Contato</label>
                    <input readOnly disabled value={c.telefone || '—'} className="w-full px-3 py-1.5 text-xs font-medium border rounded-lg bg-white text-slate-700" />
                  </div>
                </div>
              </div>
            )}

            {/* Box informativo do Imóvel selecionado */}
            {i && (
              <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-100">
                <div className="flex items-center gap-2 mb-3 text-sky-800">
                  <Building2 size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Dados do Imóvel e Comparativo de Proposta</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-800">#{i.id} - {i.titulo}</p>
                    <div className="flex items-start gap-1.5 text-xs text-slate-600 mt-1">
                      <MapPin size={14} className="text-sky-600 shrink-0 mt-0.5" />
                      <span>{fullAddress(i) || 'Endereço não cadastrado'}</span>
                    </div>
                    {p && (
                      <p className="text-xs text-slate-500 mt-2">
                        <strong className="text-slate-700">Proprietário:</strong> {p.nome} ({p.tipo})
                      </p>
                    )}
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-sky-200/80 flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Preço Pedido no Imóvel</p>
                      <p className="text-base font-bold text-slate-800">
                        {precoReferencia ? formatCurrency(precoReferencia) : 'Sob Consulta'}
                      </p>
                    </div>

                    {form.valor && precoReferencia > 0 && diferenca !== null && (
                      <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs">
                        <span className="text-slate-500">Variação da Proposta:</span>
                        <span className={`inline-flex items-center gap-1 font-bold ${
                          diferenca < 0 ? 'text-amber-600' : diferenca > 0 ? 'text-emerald-600' : 'text-slate-600'
                        }`}>
                          {diferenca < 0 ? <TrendingDown size={14} /> : diferenca > 0 ? <TrendingUp size={14} /> : null}
                          {diferenca === 0 ? 'Exatamente o valor de tabela' : `${diferenca > 0 ? '+' : ''}${formatCurrency(diferenca)} (${diffPercent}%)`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <EntityPage
      mode={mode}
      entity="negociacoes"
      basePath="/negociacoes"
      singular="Negociação"
      tabs={tabs}
      feminine
      defaults={{
        status: 'Em Andamento',
        data: todayISO(),
        tipo: 'Venda',
      }}
      showClear={false}
      cancelConfirm={mode === 'edit' ? 'Tem certeza que deseja cancelar? As alterações não serão salvas.' : undefined}
      validate={f => {
        if (!f.valor || Number(f.valor) <= 0) {
          return 'Informe um valor proposto válido maior que zero.';
        }
        if (!f.corretorId) {
          return 'Selecione o corretor responsável.';
        }
        const corr = corretores.rows.find(c => String(c.id) === String(f.corretorId));
        if (!corr || corr.status === 'Inativo') {
          return 'O corretor selecionado está inativo. Selecione um corretor ativo.';
        }
        return null;
      }}
      prepare={f => {
        const c = find(clientes.rows, f.clienteId);
        const imv = find(imoveis.rows, f.imovelId);
        const p = imv ? find(proprietarios.rows, imv.proprietarioId) : null;
        const corr = find(corretores.rows, f.corretorId);

        return {
          ...f,
          status: f.status || 'Em Andamento',
          clienteNome: c?.nome || f.clienteNome || null,
          imovelTitulo: imv?.titulo || f.imovelTitulo || null,
          proprietarioId: imv?.proprietarioId || f.proprietarioId || null,
          proprietarioNome: p?.nome || f.proprietarioNome || null,
          corretorId: f.corretorId ? Number(f.corretorId) : null,
          corretor: corr?.nome || f.corretor || null,
        };
      }}
      extraTabs={[
        {
          label: 'Histórico e Rastreabilidade',
          render: f => <NegociacaoHistorico record={f} />,
        },
      ]}
    />
  );
}
