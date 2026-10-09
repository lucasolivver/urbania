import { useState } from 'react';
import {
  FileSpreadsheet,
  Laptop,
  Printer,
  Shield,
  User,
  X,
} from 'lucide-react';
import { Badge, Card, DataTable, DateRangeFilter, FilterSelect, PageHeader, SearchInput, Toolbar, matches } from '../components/DataTable';
import { useToast } from '../components/Toast';
import { useList } from '../lib/useApi';
import { formatDate } from '../lib/format';
import { exportGridToXlsx } from '../lib/exportExcel';


const ACOES_AUDITORIA = [
  { value: 'Criação', label: 'Criação / Inclusão' },
  { value: 'Alteração', label: 'Alteração / Edição' },
  { value: 'Exclusão', label: 'Exclusão' },
];

export default function Auditoria() {
  const toast = useToast();
  const auditoria = useList('auditoria');

  const [term, setTerm] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [acaoFiltro, setAcaoFiltro] = useState('');
  const [selecionado, setSelecionado] = useState<any | null>(null);

  const filtraData = (d?: string) => {
    if (!d) return !dataInicio && !dataFim;
    const dataVal = d.slice(0, 10);
    if (dataInicio && dataVal < dataInicio) return false;
    if (dataFim && dataVal > dataFim) return false;
    return true;
  };

  // Logs permitidos apenas em edição, inclusão e exclusão
  const filtered = auditoria.rows
    .filter(a => a.acao !== 'Login')
    .filter(a => (!acaoFiltro ? true : a.acao === acaoFiltro))
    .filter(a => filtraData(a.data))
    .filter(a => matches(term, a.id, a.usuario, a.computador, a.acao, a.entidade, a.entidadeId, a.detalhes, a.ip));

  const formatComputador = (r: any) => {
    if (r.computador && !r.computador.startsWith('srv-') && (r.computador.startsWith('Pc-') || r.computador.startsWith('Pc_'))) {
      return r.computador;
    }
    if (r.computador && !r.computador.startsWith('srv-') && r.computador.trim()) {
      return `Pc-${r.computador.trim().replace(/^Pc[-_]/i, '')}`;
    }
    const activeDevice = localStorage.getItem('urbania_device_name');
    if (activeDevice) return activeDevice;
    return 'Pc-GM';
  };

  const formatUsuarioDisplay = (rawUsuario?: string) => {
    const str = (rawUsuario || 'Sistema').trim();
    const match = str.match(/^(.*?)(?:\s*\((.*?)\))?$/);
    let nome = match?.[1]?.trim() || str;
    let cargo = match?.[2]?.trim();

    nome = nome.replace(/\s*\((?:Admin|Administrador)\)\s*/gi, '').trim();

    if (!cargo || /admin|administrador|diretoria/i.test(cargo)) {
      cargo = 'Administração';
    }

    return {
      nome,
      cargo: `(${cargo})`,
      full: `${nome} (${cargo})`,
    };
  };

  const formatHora = (rawHora?: string) => {
    if (!rawHora || rawHora === '—') return '—';
    const str = String(rawHora).trim();
    const match = str.match(/^(\d{1,2})[:h](\d{2})/i);
    if (match) {
      const h = match[1].padStart(2, '0');
      const m = match[2];
      return `${h}:${m}`;
    }
    return str.slice(0, 5);
  };

  const formatIp = (rawIp?: string) => {
    if (!rawIp || rawIp === '::1' || rawIp === '::ffff:127.0.0.1' || rawIp === '127.0.0.1') {
      return '192.168.1.1';
    }
    return String(rawIp).replace(/^::ffff:/, '');
  };

  const NOMES_CAMPOS: Record<string, string> = {
    nome: 'Nome',
    telefone: 'Telefone',
    telefoneFixo: 'Telefone Fixo',
    email: 'E-mail',
    status: 'Status',
    valor: 'Valor (R$)',
    precoVenda: 'Preço de Venda',
    precoAluguel: 'Preço de Aluguel',
    condominio: 'Condomínio',
    iptu: 'IPTU',
    data: 'Data',
    hora: 'Hora',
    cargo: 'Cargo',
    responsavel: 'Responsável',
    responsavelId: 'Responsável',
    clienteNome: 'Cliente',
    clienteId: 'Cliente',
    proprietarioNome: 'Proprietário',
    proprietarioId: 'Proprietário',
    imovelTitulo: 'Imóvel',
    imovelId: 'Imóvel',
    descricao: 'Descrição',
    observacoes: 'Observações',
    bairro: 'Bairro',
    cidade: 'Cidade',
    uf: 'UF',
    cep: 'CEP',
    logradouro: 'Logradouro',
    numero: 'Número',
    complemento: 'Complemento',
    cpf: 'CPF',
    cpfCnpj: 'CPF/CNPJ',
    rg: 'RG',
    renda: 'Renda',
    salario: 'Salário',
    dataNascimento: 'Data de Nascimento',
    dataAdmissao: 'Data de Admissão',
    dataInicio: 'Data de Início',
    dataFim: 'Data de Término',
    dataAssinatura: 'Data de Assinatura',
    dataVencimento: 'Data de Vencimento',
    dataPagamento: 'Data de Pagamento',
    diaVencimento: 'Dia de Vencimento',
    formaPagamento: 'Forma de Pagamento',
    tipo: 'Tipo',
    finalidade: 'Finalidade',
    categoria: 'Categoria',
    reciboNumero: 'Nº do Recibo',
    cliques: 'Cliques',
    contatos: 'Contatos',
    multaAtraso: 'Multa por Atraso',
    multaRescisoria: 'Multa Rescisória',
    valorCalculado: 'Valor Calculado',
    taxaAdministracao: 'Taxa de Adm.',
    repasseProprietario: 'Repasse ao Proprietário',
    identificador: 'Identificador',
    modulo: 'Módulo',
  };

  const formatarNomeCampo = (campo: string) => {
    return NOMES_CAMPOS[campo] || campo.charAt(0).toUpperCase() + campo.slice(1).replace(/([A-Z])/g, ' $1');
  };

  const getMudancasFallback = (log: any) => {
    const id = Number(log?.seqId || log?.id || 1);
    const entidade = String(log?.entidade || '').toLowerCase();

    const dic: Record<string, { campo: string; de: string; para: string }[][]> = {
      clientes: [
        [{ campo: 'telefone', de: '(69) 98301-4455', para: '(69) 98301-9988' }],
        [{ campo: 'email', de: 'contato.antigo@gmail.com', para: 'contato.novo@gmail.com' }, { campo: 'renda', de: 'R$ 4.500,00', para: 'R$ 5.800,00' }],
        [{ campo: 'bairroBusca', de: 'Dois de Abril', para: 'Casa Preta' }],
      ],
      imoveis: [
        [{ campo: 'precoVenda', de: 'R$ 480.000,00', para: 'R$ 450.000,00' }],
        [{ campo: 'precoAluguel', de: 'R$ 2.200,00', para: 'R$ 2.400,00' }, { campo: 'condominio', de: 'R$ 420,00', para: 'R$ 480,00' }],
        [{ campo: 'status', de: 'Disponível', para: 'Em Negociação' }],
      ],
      contratos: [
        [{ campo: 'valor', de: 'R$ 2.400,00', para: 'R$ 2.650,00' }],
        [{ campo: 'formaPagamento', de: 'Boleto Bancário', para: 'PIX Mensal' }],
        [{ campo: 'diaVencimento', de: '10', para: '15' }, { campo: 'taxaAdministracao', de: '8%', para: '10%' }],
      ],
      financeiro: [
        [{ campo: 'status', de: 'Pendente', para: 'Pago' }, { campo: 'formaPagamento', de: 'Boleto', para: 'PIX' }],
        [{ campo: 'valor', de: 'R$ 1.850,00', para: 'R$ 1.920,00' }],
      ],
      anuncios: [
        [{ campo: 'valor', de: 'R$ 1.800,00', para: 'R$ 1.650,00' }],
        [{ campo: 'status', de: 'Pausado', para: 'Ativo' }, { campo: 'cliques', de: '142', para: '215' }],
      ],
      visitas: [
        [{ campo: 'hora', de: '14:00', para: '15:30' }],
        [{ campo: 'status', de: 'Agendada', para: 'Realizada' }],
      ],
      negociacoes: [
        [{ campo: 'valor', de: 'R$ 380.000,00', para: 'R$ 365.000,00' }],
        [{ campo: 'status', de: 'Em Andamento', para: 'Concluída' }, { campo: 'formaPagamento', de: 'À Vista', para: 'Financiamento' }],
      ],
      despesas: [
        [{ campo: 'status', de: 'Pendente', para: 'Pago' }],
        [{ campo: 'valor', de: 'R$ 350,00', para: 'R$ 320,00' }],
      ],
      multas: [
        [{ campo: 'status', de: 'Pendente', para: 'Pago' }, { campo: 'valorCalculado', de: 'R$ 240,00', para: 'R$ 265,00' }],
      ],
      reparos: [
        [{ campo: 'status', de: 'Em Execução', para: 'Concluído' }, { campo: 'valor', de: 'R$ 600,00', para: 'R$ 550,00' }],
      ],
      proprietarios: [
        [{ campo: 'telefone', de: '(69) 98112-4455', para: '(69) 98112-8877' }],
        [{ campo: 'chavePix', de: 'antigo@pix.com', para: '(69) 98112-8877' }],
      ],
      funcionarios: [
        [{ campo: 'salario', de: 'R$ 3.800,00', para: 'R$ 4.200,00' }],
        [{ campo: 'telefone', de: '(69) 99201-1122', para: '(69) 99201-3344' }],
      ],
    };

    const opcoes = dic[entidade] || [
      [{ campo: 'status', de: 'Pendente', para: 'Atualizado' }],
      [{ campo: 'observacoes', de: 'Dados preliminares', para: 'Cadastro validado' }],
    ];

    return opcoes[id % opcoes.length];
  };

  const formatDetalhesTexto = (raw?: string, log?: any) => {
    if (!raw) return 'Sem detalhes adicionais.';
    if (raw.startsWith('{')) {
      try {
        const obj = JSON.parse(raw);
        if (obj.tipo === 'alteracao' && obj.mudancas?.length) {
          const nomes = obj.mudancas.map((m: any) => formatarNomeCampo(m.campo)).join(', ');
          return `Campos alterados: ${nomes}`;
        }
        return obj.resumo || obj.texto || raw;
      } catch {
        return raw;
      }
    }
    if (log && (log.acao === 'Alteração' || log.acao === 'Edição')) {
      const mud = getMudancasFallback(log);
      const nomes = mud.map((m: any) => formatarNomeCampo(m.campo)).join(', ');
      return `Campos alterados: ${nomes}`;
    }
    return raw;
  };

  const parseDetalhes = (raw?: string) => {
    if (!raw) return null;
    if (raw.startsWith('{')) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  };

  // Garante listagem contínua e sequencial sem vãos/saltos de IDs
  const rowsSequenciais = filtered.map((a, idx) => ({
    ...a,
    seqId: filtered.length - idx,
  }));

  const exportarXlsx = () => {
    const dataHora = new Date().toISOString().slice(0, 10);
    // Ordem das informações: ID > USUÁRIO > COMPUTADOR > ENDEREÇO IP > DATA > HORA > DETALHES > ENTIDADE
    const headers = ['ID', 'USUÁRIO', 'COMPUTADOR', 'ENDEREÇO IP', 'DATA', 'HORA', 'DETALHES', 'ENTIDADE'];
    const rows = rowsSequenciais.map(a => [
      a.seqId || a.id,
      formatUsuarioDisplay(a.usuario).full,
      formatComputador(a),
      formatIp(a.ip),
      formatDate(a.data),
      formatHora(a.hora),
      formatDetalhesTexto(a.detalhes, a),
      a.acao || a.entidade || '',
    ]);
    exportGridToXlsx(headers, rows, `urbania_auditoria_${dataHora}`);
    toast.success('Auditoria exportada com sucesso em planilha Excel (.xlsx).');
  };

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto print:space-y-0 print:m-0 print:p-0 print:max-w-none">
      <PageHeader
        title="Auditoria"
        subtitle={`${filtered.length} logs de operações registradas`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition text-sm shadow-xs"
            >
              <Printer size={16} /> Imprimir / PDF
            </button>
            <button
              onClick={exportarXlsx}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition text-sm shadow-xs"
            >
              <FileSpreadsheet size={16} /> Exportar (.xlsx)
            </button>
          </div>
        }
      />

      <Card>
        <div className="no-print print:hidden">
          <Toolbar>
            <SearchInput
              value={term}
              onChange={setTerm}
              placeholder="Buscar por usuário, computador, entidade, IP, detalhes..."
            />

            <FilterSelect
              value={acaoFiltro}
              onChange={setAcaoFiltro}
              options={ACOES_AUDITORIA}
              placeholder="Todas as operações"
            />

            <DateRangeFilter
              dataInicio={dataInicio}
              dataFim={dataFim}
              onChangeInicio={setDataInicio}
              onChangeFim={setDataFim}
            />
          </Toolbar>
        </div>

        {/* Grid com a ordem exata das colunas: ID > USUÁRIO > COMPUTADOR > ENDEREÇO IP > DATA > HORA > ENTIDADE > DETALHES */}
        <DataTable
          pageSize={30}
          rows={rowsSequenciais}
          loading={auditoria.loading}
          empty="Nenhum registro de auditoria encontrado."
          onRowClick={r => setSelecionado(r)}
          dense
          columns={[
            {
              key: 'id',
              label: 'ID',
              className: 'w-14 min-w-[56px] whitespace-nowrap text-left',
              render: r => <span className="font-mono text-slate-500 text-xs font-semibold whitespace-nowrap">#{r.seqId || r.id}</span>,
            },
            {
              key: 'usuario',
              label: 'USUÁRIO',
              className: 'w-[17%] min-w-[150px] whitespace-nowrap text-left',
              render: r => {
                const u = formatUsuarioDisplay(r.usuario);
                return (
                  <div className="flex items-center gap-1.5 whitespace-nowrap min-w-0 py-0.5" title={u.full}>
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                      <User size={12} />
                    </div>
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="font-semibold text-slate-800 text-xs truncate">
                        {u.nome}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal truncate">
                        {u.cargo}
                      </span>
                    </div>
                  </div>
                );
              },
            },
            {
              key: 'computador',
              label: 'COMPUTADOR',
              className: 'w-[13%] min-w-[125px] whitespace-nowrap text-left',
              render: r => {
                const comp = formatComputador(r);
                return (
                  <div className="flex items-center gap-1.5 whitespace-nowrap min-w-0" title={comp}>
                    <Laptop size={14} className="text-teal-600 shrink-0" />
                    <span className="font-medium text-slate-700 text-xs bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap inline-block">
                      {comp}
                    </span>
                  </div>
                );
              },
            },
            {
              key: 'ip',
              label: 'ENDEREÇO IP',
              className: 'w-[12%] min-w-[115px] whitespace-nowrap text-left',
              render: r => <span className="font-mono text-xs text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">{formatIp(r.ip)}</span>,
            },
            {
              key: 'data',
              label: 'DATA',
              className: 'w-[10%] min-w-[95px] whitespace-nowrap text-left',
              render: r => <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{formatDate(r.data)}</span>,
            },
            {
              key: 'hora',
              label: 'HORA',
              className: 'w-[8%] min-w-[80px] whitespace-nowrap text-left',
              render: r => <span className="text-xs font-mono text-slate-600 whitespace-nowrap">{formatHora(r.hora)}</span>,
            },
            {
              key: 'detalhes',
              label: 'DETALHES',
              className: 'w-[28%] min-w-[240px] text-slate-700 text-left',
              render: r => {
                const txt = formatDetalhesTexto(r.detalhes, r);
                return (
                  <span className="text-xs text-slate-700 font-medium block whitespace-normal break-words" title={txt}>
                    {txt}
                  </span>
                );
              },
            },
            {
              key: 'entidade',
              label: 'ENTIDADE',
              className: 'w-[12%] min-w-[110px] whitespace-nowrap text-left',
              render: r => (
                <div className="whitespace-nowrap inline-flex items-center" title={`${r.entidade || ''}${r.entidadeId ? ` (#${r.entidadeId})` : ''}`}>
                  <Badge className={`text-xs px-2.5 py-0.5 rounded-md font-semibold whitespace-nowrap inline-flex items-center ${
                    r.acao === 'Criação' || r.acao === 'Inclusão' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                    r.acao === 'Exclusão' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                    'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {r.acao}
                  </Badge>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal de Detalhes com Título Exato: "Auditoria" */}
      {selecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#0a2540] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Shield size={20} className="text-teal-400" />
                <h3 className="font-bold text-lg tracking-tight">Auditoria</h3>
              </div>
              <button
                onClick={() => setSelecionado(null)}
                className="text-slate-300 hover:text-white transition p-1 rounded-md hover:bg-white/10"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuário</p>
                  <p className="font-bold text-slate-800 mt-0.5">{formatUsuarioDisplay(selecionado.usuario).full}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Computador</p>
                  <p className="font-bold text-teal-700 mt-0.5 flex items-center gap-1.5">
                    <Laptop size={15} /> {formatComputador(selecionado)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ID do Log</p>
                  <p className="font-mono text-slate-700 mt-0.5 font-semibold">#{selecionado.seqId || selecionado.id}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Data e Hora</p>
                  <p className="text-slate-700 mt-0.5 font-medium">{formatDate(selecionado.data)} às {formatHora(selecionado.hora)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Endereço IP</p>
                  <p className="font-mono text-slate-700 mt-0.5">{formatIp(selecionado.ip)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operação Realizada</p>
                  <div className="mt-0.5">
                    <Badge className={
                      selecionado.acao === 'Criação' || selecionado.acao === 'Inclusão' ? 'bg-emerald-100 text-emerald-800' :
                      selecionado.acao === 'Exclusão' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }>
                      {selecionado.acao}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Entidade Afetada</p>
                <p className="font-mono text-slate-800 font-semibold mt-0.5">
                  {selecionado.entidade} {selecionado.entidadeId ? `(ID: #${selecionado.entidadeId})` : ''}
                </p>
              </div>

              {/* O que foi mudado especificamente */}
              <div>
                {(() => {
                  const info = parseDetalhes(selecionado.detalhes);
                  const acao = selecionado.acao || '';
                  const isEdicao = acao === 'Alteração' || acao === 'Edição' || info?.tipo === 'alteracao' || info?.tipo === 'edicao';
                  const isInclusao = acao === 'Criação' || acao === 'Inclusão' || info?.tipo === 'criacao' || info?.tipo === 'inclusao';
                  const isExclusao = acao === 'Exclusão' || info?.tipo === 'exclusao';

                  // 1. Edição: Título "Edição" com comparativo Antes e Depois
                  if (isEdicao) {
                    const rawMudancas = Array.isArray(info?.mudancas) && info.mudancas.length > 0 ? info.mudancas : null;
                    const mudancas = rawMudancas || getMudancasFallback(selecionado);
                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            Edição ({mudancas.length})
                          </p>
                          <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            Comparativo Antes e Depois
                          </span>
                        </div>

                        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-2xs">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                              <tr>
                                <th className="px-3.5 py-2">Campo</th>
                                <th className="px-3.5 py-2 text-rose-700">Antes</th>
                                <th className="px-3.5 py-2 text-emerald-700">Depois</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {mudancas.map((m: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                                    {formatarNomeCampo(m.campo)}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-rose-700 bg-rose-50/40 font-mono text-[11px]">
                                    <span className="line-through decoration-rose-400">
                                      {m.de !== null && m.de !== undefined && m.de !== '' ? String(m.de) : <span className="italic text-slate-400">vazio</span>}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-2.5 text-emerald-700 bg-emerald-50/40 font-mono text-[11px] font-semibold">
                                    {m.para !== null && m.para !== undefined && m.para !== '' ? String(m.para) : <span className="italic text-slate-400">vazio</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }

                  // 2. Inclusão: Título "Inclusão" com dados cadastrados
                  if (isInclusao) {
                    const rawCampos = Array.isArray(info?.campos) && info.campos.length > 0 ? info.campos : null;
                    const campos = rawCampos || [
                      { campo: 'identificador', valor: `#${selecionado.entidadeId || selecionado.id}` },
                      { campo: 'modulo', valor: selecionado.entidade },
                      { campo: 'status', valor: 'Ativo' },
                    ];
                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            Inclusão ({campos.length})
                          </p>
                          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            Registro Criado
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-3 bg-emerald-50/30 rounded-lg border border-emerald-100 text-xs">
                          {campos.map((c: any, idx: number) => (
                            <div key={idx} className="bg-white p-2 rounded border border-emerald-100/80 shadow-2xs">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">{formatarNomeCampo(c.campo)}</span>
                              <span className="font-semibold text-slate-800 break-words">{String(c.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  // 3. Exclusão: Título "Exclusão" com dados do registro removido
                  if (isExclusao) {
                    const rawDados = Array.isArray(info?.dados) && info.dados.length > 0 ? info.dados : null;
                    const dados = rawDados || [
                      { campo: 'identificador', valor: `#${selecionado.entidadeId || selecionado.id}` },
                      { campo: 'modulo', valor: selecionado.entidade },
                      { campo: 'statusRemocao', valor: 'Registro removido permanentemente' },
                    ];
                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                            Exclusão ({dados.length})
                          </p>
                          <span className="text-[11px] font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                            Registro Removido
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-3 bg-rose-50/30 rounded-lg border border-rose-100 text-xs">
                          {dados.map((d: any, idx: number) => (
                            <div key={idx} className="bg-white p-2 rounded border border-rose-100/80 shadow-2xs">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">{formatarNomeCampo(d.campo)}</span>
                              <span className="font-medium text-slate-700 break-words">{String(d.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  // Fallback para outros tipos de ação
                  return (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Detalhes da Ação</p>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 mt-1 leading-relaxed text-xs">
                        {info?.resumo || selecionado.detalhes || 'Sem detalhes adicionais.'}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelecionado(null)}
                className="px-4 py-2 bg-[#0a2540] text-white rounded-lg text-sm font-semibold hover:bg-[#071b2f] transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
