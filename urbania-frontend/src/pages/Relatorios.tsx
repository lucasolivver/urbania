import { useState } from 'react';
import {
  Building2,
  FileSpreadsheet,
  Handshake,
  Landmark,
  Printer,
  Wrench,
} from 'lucide-react';
import { Badge, Card, DataTable, DateRangeFilter, FilterSelect, PageHeader, SearchInput, Toolbar, matches } from '../components/DataTable';
import { useToast } from '../components/Toast';
import { useList } from '../lib/useApi';
import { formatCurrency, formatDate } from '../lib/format';
import { statusColor } from '../lib/options';

type ReportTab = 'propostas' | 'intervencoes' | 'financeiro' | 'relacionamentos';
import { useExportarPlanilha } from '../lib/exportExcel';


export default function Relatorios() {
  const toast = useToast();
  const exportarPlanilha = useExportarPlanilha();
  const [tab, setTab] = useState<ReportTab>('propostas');

  // Filtros Globais (RNF 1.2: filtros por período e por Usuário Responsável)
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [responsavelFiltro, setResponsavelFiltro] = useState('');
  const [term, setTerm] = useState('');

  // Carregamento dos dados das fontes
  const negociacoes = useList('negociacoes');
  const reparos = useList('reparos');
  const financeiro = useList('financeiro');
  const imoveis = useList('imoveis');
  const proprietarios = useList('proprietarios');
  const funcionarios = useList('funcionarios');

  const corretores = funcionarios.rows.filter(f => f.cargo === 'Corretor');

  const filtraData = (d?: string) => {
    if (!d) return !dataInicio && !dataFim;
    const dataVal = d.slice(0, 10);
    if (dataInicio && dataVal < dataInicio) return false;
    if (dataFim && dataVal > dataFim) return false;
    return true;
  };

  // 1. RELATÓRIO: HISTÓRICO DE PROPOSTAS E NEGOCIAÇÕES
  const filteredPropostas = negociacoes.rows
    .filter(n => (!responsavelFiltro ? true : String(n.corretorId) === responsavelFiltro || n.corretor === responsavelFiltro))
    .filter(n => filtraData(n.data))
    .filter(n => matches(term, n.id, n.clienteNome, n.imovelTitulo, n.corretor, n.status, n.tipo, n.formaPagamento));

  // 2. RELATÓRIO: HISTÓRICO DE INTERVENÇÕES E REPAROS
  const filteredReparos = reparos.rows
    .filter(r => (!responsavelFiltro ? true : String(r.responsavelId) === responsavelFiltro || r.responsavel === responsavelFiltro))
    .filter(r => filtraData(r.dataSolicitacao))
    .filter(r => matches(term, r.id, r.descricao, r.responsavel, r.status));

  // 3. RELATÓRIO: HISTÓRICO FINANCEIRO & REPASSES
  const filteredFinanceiro = financeiro.rows
    .filter(f => (!responsavelFiltro ? true : f.operador === responsavelFiltro))
    .filter(f => filtraData(f.dataVencimento || f.dataPagamento))
    .filter(f => matches(term, f.id, f.descricao, f.categoria, f.tipo, f.status, f.clienteNome, f.proprietarioNome, f.reciboNumero));

  // 4. RELATÓRIO: VÍNCULOS DE IMÓVEIS E PROPRIETÁRIOS
  const filteredRelacionamentos = imoveis.rows
    .filter(i => (!responsavelFiltro ? true : String(i.responsavelId) === responsavelFiltro || i.responsavel === responsavelFiltro))
    .filter(i => matches(term, i.id, i.titulo, i.tipo, i.finalidade, i.responsavel, i.cidade, i.bairro));

  // Ações de Exportação
  const exportarAtual = () => {
    const dataHora = new Date().toISOString().slice(0, 10);
    if (tab === 'propostas') {
      const headers = ['ID Proposta', 'Data', 'Cliente', 'Imóvel', 'Corretor', 'Tipo', 'Valor Proposto', 'Status', 'Forma Pagamento'];
      const rows = filteredPropostas.map(p => [p.id, p.data, p.clienteNome, p.imovelTitulo, p.corretor, p.tipo, p.valor, p.status, p.formaPagamento]);
      exportarPlanilha('Relatório - Histórico de Propostas', headers, rows, `urbania_relatorio_propostas_${dataHora}`);
    } else if (tab === 'intervencoes') {
      const headers = ['ID Reparo', 'Data Solicitação', 'Imóvel #', 'Responsável', 'Orçamento (R$)', 'Status', 'Problemas'];
      const rows = filteredReparos.map(r => [r.id, r.dataSolicitacao, r.imovelId, r.responsavel, r.valor, r.status, r.descricao]);
      exportarPlanilha('Relatório - Intervenções & Reparos', headers, rows, `urbania_relatorio_intervencoes_${dataHora}`);
    } else if (tab === 'financeiro') {
      const headers = ['ID', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)', 'Vencimento', 'Pagamento', 'Status', 'Recibo'];
      const rows = filteredFinanceiro.map(f => [f.id, f.tipo, f.categoria, f.descricao, f.valor, f.dataVencimento, f.dataPagamento, f.status, f.reciboNumero]);
      exportarPlanilha('Relatório - Extrato & Repasses', headers, rows, `urbania_relatorio_financeiro_${dataHora}`);
    } else if (tab === 'relacionamentos') {
      const headers = ['ID Imóvel', 'Título', 'Tipo', 'Finalidade', 'Proprietário Legal', 'Corretor Captador', 'Preço Venda', 'Preço Aluguel'];
      const rows = filteredRelacionamentos.map(i => {
        const prop = proprietarios.rows.find(p => p.id === i.proprietarioId);
        return [i.id, i.titulo, i.tipo, i.finalidade, prop?.nome || '—', i.responsavel || '—', i.precoVenda, i.precoAluguel];
      });
      exportarPlanilha('Relatório - Vínculos de Imóveis', headers, rows, `urbania_relatorio_vinculos_${dataHora}`);
    }
    toast.success('Relatório exportado com sucesso em planilha Excel (.xlsx).');
  };

  const tabsConfig = [
    { id: 'propostas', label: 'Histórico de Propostas', icon: <Handshake size={16} /> },
    { id: 'intervencoes', label: 'Intervenções & Reparos', icon: <Wrench size={16} /> },
    { id: 'financeiro', label: 'Extrato & Repasses', icon: <Landmark size={16} /> },
    { id: 'relacionamentos', label: 'Vínculos de Imóveis', icon: <Building2 size={16} /> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Históricos & Relatórios do Sistema"
        subtitle="Rastreabilidade completa de propostas, intervenções, operações financeiras e vínculos de imóveis"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition text-sm shadow-xs"
            >
              <Printer size={16} /> Imprimir / PDF
            </button>
            <button
              onClick={exportarAtual}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition text-sm shadow-xs"
            >
              <FileSpreadsheet size={16} /> Exportar (.xlsx)
            </button>
          </div>
        }
      />

      {/* Seletor de Abas de Relatórios (oculto na impressão) */}
      <div className="no-print flex border-b border-slate-200 overflow-x-auto gap-2">
        {tabsConfig.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as ReportTab)}
            className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition ${
              tab === t.id
                ? 'border-[#0a2540] text-[#0a2540]'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Identificador do relatório selecionado visível somente na impressão/PDF */}
      <div className="print-only mb-3 pb-2 border-b border-slate-300">
        <h2 className="text-lg font-bold text-slate-800">
          Módulo: {tabsConfig.find(t => t.id === tab)?.label}
        </h2>
      </div>

      <Card>
        {/* Barra de Filtros Obrigatórios: Período e Responsável (RNF 1.2 - pág. 32) */}
        <div className="no-print print:hidden">
          <Toolbar>
            <SearchInput
              value={term}
              onChange={setTerm}
              placeholder="Busca por termo ou palavra-chave no relatório..."
            />

            <FilterSelect
              value={responsavelFiltro}
              onChange={setResponsavelFiltro}
              options={corretores.map(c => ({ value: String(c.id), label: `Resp: ${c.nome}${c.status === 'Inativo' ? ' (Inativo)' : ''}` }))}
              placeholder="Todos os responsáveis"
            />

            <DateRangeFilter
              dataInicio={dataInicio}
              dataFim={dataFim}
              onChangeInicio={setDataInicio}
              onChangeFim={setDataFim}
            />
          </Toolbar>
        </div>

        {/* 1. ABA PROPOSTAS E NEGOCIAÇÕES */}
        {tab === 'propostas' && (
          <DataTable
            pageSize={30} // RNF 1.4: paginação caso exceda 30 registros
            rows={filteredPropostas}
            loading={negociacoes.loading}
            empty="Nenhuma proposta registrada no período."
            columns={[
              { key: 'id', label: 'ID', render: r => <span className="font-mono text-slate-400">#{r.id}</span>, className: 'w-16' },
              { key: 'data', label: 'Data', render: r => formatDate(r.data) },
              { key: 'cliente', label: 'Cliente', render: r => <span className="font-semibold text-slate-800">{r.clienteNome || `#${r.clienteId}`}</span> },
              { key: 'imovel', label: 'Imóvel Negociado', render: r => r.imovelTitulo || `#${r.imovelId}` },
              { key: 'corretor', label: 'Corretor', render: r => r.corretor || '—' },
              { key: 'tipo', label: 'Tipo', render: r => <span className="text-xs font-semibold text-cadastro">{r.tipo}</span> },
              { key: 'valor', label: 'Valor Proposto', render: r => <span className="font-bold text-teal-700">{formatCurrency(r.valor)}</span> },
              { key: 'status', label: 'Status', render: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
            ]}
          />
        )}

        {/* 2. ABA INTERVENÇÕES E REPAROS */}
        {tab === 'intervencoes' && (
          <DataTable
            pageSize={30}
            rows={filteredReparos}
            loading={reparos.loading}
            empty="Nenhuma intervenção ou reparo registrado no período."
            columns={[
              { key: 'id', label: 'ID', render: r => <span className="font-mono text-slate-400">#{r.id}</span>, className: 'w-16' },
              { key: 'dataSolicitacao', label: 'Data', render: r => formatDate(r.dataSolicitacao) },
              { key: 'imovelId', label: 'Imóvel #', render: r => `#${r.imovelId}` },
              { key: 'descricao', label: 'Problemas Identificados', render: r => <span className="font-medium text-slate-800">{r.descricao}</span> },
              { key: 'responsavel', label: 'Responsável', render: r => r.responsavel || '—' },
              { key: 'valor', label: 'Orçamento', render: r => <span className="font-bold text-slate-800">{formatCurrency(r.valor)}</span> },
              { key: 'status', label: 'Status', render: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
            ]}
          />
        )}

        {/* 3. ABA FINANCEIRO E REPASSES */}
        {tab === 'financeiro' && (
          <DataTable
            pageSize={30}
            rows={filteredFinanceiro}
            loading={financeiro.loading}
            empty="Nenhum lançamento financeiro localizado no período."
            columns={[
              { key: 'id', label: 'ID', render: r => <span className="font-mono text-slate-400">#{r.id}</span>, className: 'w-16' },
              { key: 'tipo', label: 'Tipo', render: r => <span className="text-xs font-semibold text-cadastro">{r.tipo}</span> },
              { key: 'descricao', label: 'Descrição & Categoria', render: r => (
                <div>
                  <p className="font-semibold text-slate-800">{r.descricao}</p>
                  <p className="text-xs text-slate-400">{r.categoria} {r.reciboNumero ? `· ${r.reciboNumero}` : ''}</p>
                </div>
              ) },
              { key: 'vencimento', label: 'Vencimento', render: r => formatDate(r.dataVencimento) },
              { key: 'valor', label: 'Valor', render: r => <span className="font-bold text-teal-700">{formatCurrency(r.valor)}</span> },
              { key: 'status', label: 'Status', render: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
            ]}
          />
        )}

        {/* 4. ABA VÍNCULOS DE IMÓVEIS E PROPRIETÁRIOS */}
        {tab === 'relacionamentos' && (
          <DataTable
            pageSize={30}
            rows={filteredRelacionamentos}
            loading={imoveis.loading}
            empty="Nenhum vínculo de imóvel localizado."
            columns={[
              { key: 'id', label: 'ID Imóvel', render: r => <span className="font-mono text-slate-400">#{r.id}</span>, className: 'w-20' },
              { key: 'titulo', label: 'Imóvel', render: r => (
                <div>
                  <p className="font-semibold text-slate-800">{r.titulo}</p>
                  <p className="text-xs text-slate-400">{r.bairro} - {r.cidade}/{r.uf}</p>
                </div>
              ) },
              { key: 'tipo', label: 'Tipo / Finalidade', render: r => <span className="text-xs font-semibold text-cadastro">{`${r.tipo} (${r.finalidade})`}</span> },
              { key: 'proprietario', label: 'Proprietário Legal', render: r => {
                const prop = proprietarios.rows.find(p => p.id === r.proprietarioId);
                return <span className="font-semibold text-slate-700">{prop?.nome || '—'}</span>;
              } },
              { key: 'responsavel', label: 'Corretor Captador', render: r => r.responsavel || '—' },
              { key: 'valores', label: 'Valores Registrados', render: r => (
                <div className="text-xs font-semibold">
                  {r.precoVenda ? <p className="text-indigo-700">Venda: {formatCurrency(r.precoVenda)}</p> : null}
                  {r.precoAluguel ? <p className="text-teal-700">Locação: {formatCurrency(r.precoAluguel)}/mês</p> : null}
                </div>
              ) },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
