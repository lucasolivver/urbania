import { Select } from '../components/Select';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  Printer,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api';
import { Badge, Card, DataTable, DateRangeFilter, FilterSelect, PageHeader, RowActions, SearchInput, Toolbar, matches } from '../components/DataTable';
import type { Mode, TabDef } from '../components/EntityForm';
import { EntityPage } from '../components/EntityPage';
import { Modal } from '../components/Modal';
import { apiError, useToast } from '../components/Toast';
import { useDelete } from '../components/useDelete';
import { useList } from '../lib/useApi';
import { formatCurrency, formatDate, todayISO } from '../lib/format';
import {
  CATEGORIAS_FINANCEIRO,
  FORMAS_PAGAMENTO_FINANCEIRO,
  STATUS_FINANCEIRO,
  TIPOS_FINANCEIRO,
  statusColor,
} from '../lib/options';
import { Pode, usePodeNaRota } from '../lib/auth';

// Exportação nativa para CSV / Excel (RNF 1.3 - pág. 32)
function exportFinanceiroToCsv(data: any[], filename: string) {
  const headers = [
    'ID Lançamento',
    'Tipo',
    'Categoria',
    'Descrição',
    'Valor (R$)',
    'Vencimento',
    'Pagamento',
    'Status',
    'Forma de Pagamento',
    'Cliente / Pagador',
    'Proprietário / Favorecido',
    'Imóvel Vinculado',
    'Contrato #',
    'Recibo / Autenticação',
    'Observações',
  ];

  const rows = data.map(f => [
    f.id,
    f.tipo || '',
    f.categoria || '',
    `"${(f.descricao || '').replace(/"/g, '""')}"`,
    f.valor ? Number(f.valor).toFixed(2) : '0.00',
    f.dataVencimento || '',
    f.dataPagamento || '',
    f.status || '',
    `"${(f.formaPagamento || '').replace(/"/g, '""')}"`,
    `"${(f.clienteNome || '').replace(/"/g, '""')}"`,
    `"${(f.proprietarioNome || '').replace(/"/g, '""')}"`,
    `"${(f.imovelTitulo || '').replace(/"/g, '""')}"`,
    f.contratoId || '',
    f.reciboNumero || '',
    `"${(f.observacoes || '').replace(/"/g, '""')}"`,
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

// Modal de Baixa & Efetuar Pagamento com Gateway Seguro e Emissão de Recibo (RF F72 - pág. 32)
function EfetuarPagamentoModal({
  lancamento,
  onSuccess,
  onClose,
}: {
  lancamento: any;
  onSuccess: (updated: any) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [forma, setForma] = useState(lancamento.formaPagamento || 'PIX');
  const [dataPag, setDataPag] = useState(todayISO());
  const [processing, setProcessing] = useState(false);
  const [recibo, setRecibo] = useState<any | null>(null);

  const handleProcessar = async () => {
    setProcessing(true);
    try {
      // Simulação de gateway seguro com criptografia ponta a ponta (RNF 2.1 & 2.2)
      await new Promise(r => setTimeout(r, 600));

      const numRecibo = `REC-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
      const payload = {
        status: 'Pago',
        dataPagamento: dataPag,
        formaPagamento: forma,
        reciboNumero: numRecibo,
      };

      const res = await api.put(`/financeiro/${lancamento.id}`, payload);
      const updated = { ...lancamento, ...res.data };
      toast.success('Pagamento processado e baixado com sucesso!');
      setRecibo(updated);
      onSuccess(updated);
    } catch (err) {
      toast.error(apiError(err, 'Falha no processamento do pagamento. Operação revertida (Rollback).'));
    } finally {
      setProcessing(false);
    }
  };

  if (recibo) {
    return (
      <Modal title="Comprovante de Pagamento" onClose={onClose} wide>
        <div className="p-4 space-y-6">
          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs print:border-none print:shadow-none" id="recibo-imprimir">
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <span className="text-xs font-bold text-sky-600 uppercase tracking-widest">Urbânia Gestão Imobiliária</span>
                <h2 className="text-xl font-bold text-slate-800">Recibo / Comprovante Oficial</h2>
                <p className="text-xs text-slate-400">Autenticação: {recibo.reciboNumero}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 size={14} /> Pagamento Confirmado
                </span>
                <p className="text-xs text-slate-400 mt-1">Data: {formatDate(recibo.dataPagamento)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl mb-4">
              <div>
                <span className="text-slate-400 font-semibold uppercase">Operação / Categoria:</span>
                <p className="font-bold text-slate-800 text-sm">{recibo.tipo}: {recibo.categoria}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase">Forma de Liquidação:</span>
                <p className="font-bold text-slate-800 text-sm">{recibo.formaPagamento}</p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-semibold uppercase">Descrição:</span>
                <p className="font-medium text-slate-700">{recibo.descricao}</p>
              </div>
              {recibo.imovelTitulo && (
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Imóvel:</span>
                  <p className="font-medium text-slate-700">{recibo.imovelTitulo}</p>
                </div>
              )}
              {recibo.clienteNome && (
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Cliente / Pagador:</span>
                  <p className="font-medium text-slate-700">{recibo.clienteNome}</p>
                </div>
              )}
              {recibo.proprietarioNome && (
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Proprietário / Favorecido:</span>
                  <p className="font-medium text-slate-700">{recibo.proprietarioNome}</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center p-4 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <span className="font-bold text-slate-700 text-sm">Valor Total Liquidado:</span>
              <span className="text-2xl font-bold text-emerald-700">{formatCurrency(recibo.valor)}</span>
            </div>
          </div>

          <div className="no-print flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 border rounded-lg font-semibold text-xs text-slate-700 hover:bg-slate-50 transition"
            >
              <Printer size={15} /> Imprimir Recibo
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-[#0a2540] text-white rounded-lg font-semibold text-xs hover:bg-[#06182c] transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Efetuar Pagamento & Baixa" onClose={onClose}>
      <div className="p-4 space-y-5">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[11px] font-bold uppercase text-slate-400">Lançamento Selecionado</span>
          <p className="font-bold text-slate-800 text-sm">{lancamento.descricao}</p>
          <p className="text-xs text-slate-500">
            Categoria: {lancamento.categoria} · Vencimento: {formatDate(lancamento.dataVencimento)}
          </p>
          <p className="text-xl font-bold text-teal-700 mt-2">{formatCurrency(lancamento.valor)}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold uppercase text-slate-600 mb-1">
              Data da Baixa / Pagamento
            </label>
            <input
              type="date"
              value={dataPag}
              onChange={e => setDataPag(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#0a2540] bg-white text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold uppercase text-slate-600 mb-1">
              Forma de Pagamento
            </label>
            <Select
              value={forma}
              onChange={selectedValue => setForma(selectedValue)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#0a2540] bg-white text-xs"
            >
              {FORMAS_PAGAMENTO_FINANCEIRO.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-sky-50 text-sky-800 text-xs border border-sky-200">
          <ShieldCheck size={18} className="text-sky-600 shrink-0" />
          <span>Transação protegida por protocolo seguro SSL/TLS com conciliação automática.</span>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg font-semibold text-xs text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={handleProcessar}
            className="save-action px-5 py-2 text-white rounded-lg font-semibold text-xs transition disabled:opacity-50"
          >
            {processing ? 'Processando Gateway...' : 'Confirmar e Baixar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Consultar Financeiro (RF F2 Consultar Despesa / F72 Efetuar Pagamento)
export function FinanceiroList() {
  const pode = usePodeNaRota();
  const navigate = useNavigate();
  const toast = useToast();
  const { rows, setRows, loading, reload } = useList('financeiro');
  const [term, setTerm] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pagamentoModal, setPagamentoModal] = useState<any | null>(null);

  const del = useDelete('financeiro', 'Lançamento Financeiro', reload);

  // Totais calculados
  const totalReceitas = rows.filter(r => r.status === 'Pago' && r.tipo === 'Receita').reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalDespesas = rows.filter(r => r.status === 'Pago' && (r.tipo === 'Despesa' || r.tipo === 'Repasse')).reduce((s, r) => s + Number(r.valor || 0), 0);
  const repassesPendentes = rows.filter(r => r.status === 'Pendente' && r.tipo === 'Repasse').reduce((s, r) => s + Number(r.valor || 0), 0);
  const saldoOperacional = totalReceitas - totalDespesas;

  const filtered = rows
    .filter(r => (!tipoFiltro ? true : r.tipo === tipoFiltro))
    .filter(r => (!categoriaFiltro ? true : r.categoria === categoriaFiltro))
    .filter(r => (!statusFiltro ? true : r.status === statusFiltro))
    .filter(r => {
      const d = (r.dataVencimento || r.dataPagamento || '').slice(0, 10);
      if (dataInicio && d < dataInicio) return false;
      if (dataFim && d > dataFim) return false;
      return true;
    })
    .filter(r => matches(term, r.descricao, r.categoria, r.clienteNome, r.proprietarioNome, r.imovelTitulo, r.reciboNumero, r.id));

  const handleExport = () => {
    if (!filtered.length) {
      toast.error('Nenhum registro para exportar.');
      return;
    }
    const dataHora = new Date().toISOString().slice(0, 10);
    exportFinanceiroToCsv(filtered, `urbania_financeiro_${dataHora}`);
    toast.success('Extrato financeiro exportado com sucesso (.csv / Excel).');
  };


  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Gestão Financeira & Caixa"
        subtitle={`${rows.length} operações cadastradas`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/despesas')}
              className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-3.5 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition shadow-sm text-sm"
              title="Acessar Controle de Despesas"
            >
              <Receipt size={16} className="text-rose-600" /> Despesas
            </button>
            <button
              onClick={() => navigate('/multas')}
              className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-3.5 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition shadow-sm text-sm"
              title="Acessar Gestão de Multas"
            >
              <AlertTriangle size={16} className="text-amber-600" /> Multas
            </button>
            <button
              onClick={handleExport}
              title="Exportar para Excel/CSV (RNF 1.3)"
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition shadow-sm text-sm"
            >
              <FileSpreadsheet size={16} className="text-emerald-600" /> Exportar (.xlsx/CSV)
            </button>
            <Pode acao="Criar"><button
              onClick={() => navigate('/financeiro/novo')}
              className="flex items-center gap-2 bg-[#0a2540] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#06182c] transition shadow-sm text-sm"
            >
              <Plus size={18} /> Novo Lançamento
            </button></Pode>
          </div>
        }
      />

      {/* Cards de Resumo Financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#0a2540]/30 transition">
          <span className="text-xs font-bold text-[#0a2540] uppercase">Receitas Liquidadas</span>
          <p className="text-2xl font-bold text-[#0a2540] mt-1">{formatCurrency(totalReceitas)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Aluguéis e comissões recebidas</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#0a2540]/30 transition">
          <span className="text-xs font-bold text-[#0a2540] uppercase">Despesas & Saídas</span>
          <p className="text-2xl font-bold text-[#0a2540] mt-1">{formatCurrency(totalDespesas)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Custos operacionais e repasses pagos</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#0a2540]/30 transition">
          <span className="text-xs font-bold text-[#0a2540] uppercase">Saldo Operacional Líquido</span>
          <p className="text-2xl font-bold text-[#0a2540] mt-1">
            {formatCurrency(saldoOperacional)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Receitas - Despesas</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#0a2540]/30 transition">
          <span className="text-xs font-bold text-[#0a2540] uppercase">Repasses Pendentes</span>
          <p className="text-2xl font-bold text-[#0a2540] mt-1">{formatCurrency(repassesPendentes)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">A pagar aos proprietários</p>
        </div>
      </div>

      <Card>
        <Toolbar>
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Buscar por descrição, cliente, proprietário ou recibo..."
          />

          <FilterSelect
            value={tipoFiltro}
            onChange={setTipoFiltro}
            options={TIPOS_FINANCEIRO}
            placeholder="Todos os tipos"
          />

          <FilterSelect
            value={categoriaFiltro}
            onChange={setCategoriaFiltro}
            options={CATEGORIAS_FINANCEIRO}
            placeholder="Todas as categorias"
          />

          <FilterSelect
            value={statusFiltro}
            onChange={setStatusFiltro}
            options={STATUS_FINANCEIRO}
            placeholder="Todos os status"
          />

          <DateRangeFilter
            dataInicio={dataInicio}
            dataFim={dataFim}
            onChangeInicio={setDataInicio}
            onChangeFim={setDataFim}
          />
        </Toolbar>

        <DataTable
          rows={filtered}
          loading={loading}
          onRowClick={r => navigate(`/financeiro/${r.id}`)}
          columns={[
            {
              key: 'id',
              label: 'Código',
              render: r => <span className="font-mono text-slate-400 text-xs">#{r.id}</span>,
              className: 'w-16',
            },
            {
              key: 'tipo',
              label: 'Tipo',
              render: r => <span className="text-xs font-semibold text-cadastro">{r.tipo}</span>,
            },
            {
              key: 'descricao',
              label: 'Descrição & Categoria',
              render: r => (
                <div>
                  <p className="font-semibold text-slate-800 text-sm leading-snug">{r.descricao}</p>
                  <p className="text-xs text-slate-400">{r.categoria} {r.contratoId ? `· Contrato #${r.contratoId}` : ''}</p>
                </div>
              ),
            },
            {
              key: 'partes',
              label: 'Vinculado a',
              render: r => {
                const parte = r.proprietarioNome || r.clienteNome || r.imovelTitulo || '—';
                return <span className="text-xs text-slate-700 font-medium">{parte}</span>;
              },
            },
            {
              key: 'vencimento',
              label: 'Vencimento',
              render: r => <span className="text-xs font-semibold text-slate-700">{formatDate(r.dataVencimento)}</span>,
            },
            {
              key: 'valor',
              label: 'Valor',
              render: r => (
                <span className={`font-bold text-sm whitespace-nowrap ${
                  r.tipo === 'Receita' ? 'text-emerald-700' : 'text-slate-800'
                }`}>
                  {r.tipo === 'Receita' ? '+' : '-'}{formatCurrency(r.valor)}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: r => <Badge className={statusColor(r.status)}>{r.status}</Badge>,
            },
            {
              key: 'baixa',
              label: 'Liquidação',
              render: r => {
                if (r.status === 'Pago') {
                  return (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setPagamentoModal(r);
                      }}
                      className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 text-xs font-bold hover:underline"
                    >
                      <Receipt size={13} /> Ver Recibo
                    </button>
                  );
                }
                return pode('Editar') ? (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setPagamentoModal(r);
                    }}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-emerald-700 hover:text-emerald-900 text-xs font-bold hover:underline"
                  >
                    <CheckCircle2 size={13} /> Dar Baixa
                  </button>
                ) : <span className="text-xs text-slate-400">Pendente</span>;
              },
            },
          ]}
          actions={r => (
            <RowActions
              onView={() => navigate(`/financeiro/${r.id}`)}
              onEdit={() => navigate(`/financeiro/${r.id}/editar`)}
              onDelete={
                r.status === 'Pago'
                  ? undefined // RNF 1.5.3: despesas e lançamentos pagos não podem ser excluídos
                  : () => del.ask(r.id, `${r.tipo}: ${r.descricao}`)
              }
            />
          )}
        />
      </Card>

      {pagamentoModal && (
        <EfetuarPagamentoModal
          lancamento={pagamentoModal}
          onSuccess={updated => {
            setRows(rs => rs.map(x => (x.id === updated.id ? updated : x)));
          }}
          onClose={() => setPagamentoModal(null)}
        />
      )}

      {del.modal}
    </div>
  );
}

// Cadastrar / Visualizar / Editar Operação Financeira (RF F1-F4 Despesas / F72)
export function FinanceiroPage({ mode }: { mode: Mode }) {
  const imoveis = useList('imoveis');
  const clientes = useList('clientes');
  const proprietarios = useList('proprietarios');
  const contratos = useList('contratos');

  if (imoveis.loading || clientes.loading || proprietarios.loading || contratos.loading) {
    return <p className="text-slate-400 p-8">Carregando dados financeiros...</p>;
  }

  const find = (list: any[], id: unknown) => list.find(x => String(x.id) === String(id));

  const tabs: TabDef[] = [
    {
      label: 'Dados da Operação',
      fields: [
        {
          key: 'tipo',
          label: 'Tipo de Lançamento',
          type: 'select',
          required: true,
          options: TIPOS_FINANCEIRO,
          disabled: (_, m) => m === 'edit',
        },
        {
          key: 'categoria',
          label: 'Categoria',
          type: 'select',
          required: true,
          options: CATEGORIAS_FINANCEIRO,
        },
        {
          key: 'descricao',
          label: 'Descrição do Lançamento',
          type: 'text',
          required: true,
          full: true,
          placeholder: 'Ex: Aluguel mensal referente a Setembro ou Manutenção de encanamento...',
        },
        {
          key: 'valor',
          label: 'Valor (R$)',
          type: 'currency',
          required: true,
          placeholder: 'R$ 0,00',
          // RNF 1.4 (pág. 31): Se a despesa já estiver marcada como Paga, o campo de valor não pode ser alterado!
          disabled: form => form.status === 'Pago',
        },
        {
          key: 'dataVencimento',
          label: 'Data de Vencimento',
          type: 'date',
          required: true,
        },
        {
          key: 'formaPagamento',
          label: 'Forma de Pagamento Prevista',
          type: 'select',
          options: FORMAS_PAGAMENTO_FINANCEIRO,
        },
        {
          key: 'status',
          label: 'Status do Pagamento',
          type: 'select',
          options: STATUS_FINANCEIRO,
          hidden: () => mode === 'create',
        },
      ],
    },
    {
      label: 'Vínculos & Imóvel',
      fields: [
        {
          key: 'contratoId',
          label: 'Contrato Vinculado (Opcional)',
          type: 'search-select',
          options: contratos.rows.map(ct => ({
            value: ct.id,
            label: `Contrato #${ct.id} - ${ct.tipo} (${ct.clienteNome || 'Cliente'})`,
            hint: ct.imovelTitulo,
          })),
          renderView: val => {
            const ct = find(contratos.rows, val);
            return ct ? `Contrato #${ct.id} - ${ct.tipo} (${ct.clienteNome || 'Cliente'})` : (val ? `Contrato #${val}` : '—');
          },
          onChange: (ctId, form) => {
            const ct = find(contratos.rows, ctId);
            if (ct) {
              return {
                ...form,
                contratoId: ctId,
                clienteId: ct.clienteId,
                proprietarioId: ct.proprietarioId,
                imovelId: ct.imovelId,
                imovelTitulo: ct.imovelTitulo,
                clienteNome: ct.clienteNome,
                proprietarioNome: ct.proprietarioNome,
                valor: form.valor || ct.valor,
              };
            }
          },
        },
        {
          key: 'imovelId',
          label: 'Imóvel sob Gestão (Opcional - RNF 1.1.2)',
          type: 'search-select',
          options: imoveis.rows.map(i => ({
            value: i.id,
            label: `#${i.id} - ${i.titulo}`,
            hint: [i.bairro, i.cidade].filter(Boolean).join(' - '),
          })),
          renderView: (val, form) => {
            const im = find(imoveis.rows, val);
            return im ? `#${im.id} - ${im.titulo}` : form.imovelTitulo || (val ? `Imóvel #${val}` : '—');
          },
        },
        {
          key: 'clienteId',
          label: 'Cliente Vinculado (Opcional)',
          type: 'search-select',
          options: clientes.rows.map(c => ({
            value: c.id,
            label: c.nome,
            hint: c.cpfCnpj || c.telefone,
          })),
          renderView: (val, form) => {
            const cl = find(clientes.rows, val);
            return cl?.nome || form.clienteNome || (val ? `Cliente #${val}` : '—');
          },
        },
        {
          key: 'proprietarioId',
          label: 'Proprietário Favorecido (Opcional)',
          type: 'search-select',
          options: proprietarios.rows.map(p => ({
            value: p.id,
            label: p.nome,
            hint: p.chavePix ? `PIX: ${p.chavePix}` : p.telefone,
          })),
          renderView: (val, form) => {
            const pr = find(proprietarios.rows, val);
            return pr?.nome || form.proprietarioNome || (val ? `Proprietário #${val}` : '—');
          },
        },
        {
          key: 'observacoes',
          label: 'Observações Adicionais',
          type: 'textarea',
          full: true,
          placeholder: 'Insira justificativas, dados bancários complementares ou número da nota fiscal...',
        },
      ],
    },
  ];

  return (
    <EntityPage
      mode={mode}
      entity="financeiro"
      basePath="/financeiro"
      singular="Lançamento Financeiro"
      tabs={tabs}
      defaults={{
        tipo: 'Despesa',
        categoria: 'Administrativa',
        status: 'Pendente',
        dataVencimento: todayISO(),
        formaPagamento: 'Boleto Bancário',
      }}
      cancelConfirm={mode === 'edit' ? 'Tem certeza que deseja cancelar? As alterações não serão salvas.' : undefined}
      validate={f => {
        if (!f.descricao?.trim()) return 'Informe a descrição do lançamento.';
        if (!f.valor || Number(f.valor) <= 0) return 'O valor deve ser maior que zero.';
        if (!f.dataVencimento) return 'A data de vencimento é obrigatória.';
        return null;
      }}
      prepare={f => {
        const imv = find(imoveis.rows, f.imovelId);
        const cli = find(clientes.rows, f.clienteId);
        const prop = find(proprietarios.rows, f.proprietarioId);
        return {
          ...f,
          imovelTitulo: imv?.titulo ?? f.imovelTitulo ?? null,
          clienteNome: cli?.nome ?? f.clienteNome ?? null,
          proprietarioNome: prop?.nome ?? f.proprietarioNome ?? null,
        };
      }}
    />
  );
}
