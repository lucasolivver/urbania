import { StatusDropdown } from '../components/StatusDropdown';
import { Select } from '../components/Select';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Eye,
  FileCheck,
  History,
  Lock,
  Plus,
  Receipt,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../api';
import { Badge, Card, DataTable, FilterSelect, PageHeader, RowActions, SearchInput, Toolbar } from '../components/DataTable';
import type { Mode, TabDef } from '../components/EntityForm';
import { EntityPage, RelatedGrid } from '../components/EntityPage';
import { Modal } from '../components/Modal';
import { apiError, useToast } from '../components/Toast';
import { useDelete } from '../components/useDelete';
import { useList } from '../lib/useApi';
import { formatCurrency, formatDate, todayISO } from '../lib/format';
import {
  CATEGORIAS_DESPESA,
  FORMAS_PAGAMENTO_FINANCEIRO,
  STATUS_DESPESA,
  statusColor,
} from '../lib/options';
import { Pode } from '../lib/auth';
import { DatePicker } from '../components/DateTimePicker';

// Cálculo automático de status conforme RF F1 NF 1.5
export function calcularStatusDespesa(dataVencimento?: string, dataPagamento?: string): string {
  if (dataPagamento && String(dataPagamento).trim() !== '') return 'Pago';
  if (!dataVencimento) return 'Pendente';
  const hoje = todayISO();
  if (dataVencimento < hoje) return 'Atrasado';
  return 'Pendente';
}

interface StatusHistoryEntry {
  de: string | null;
  para: string;
  data: string;
  usuario: string;
  motivo?: string;
}

function parseHistorico(val: any): StatusHistoryEntry[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ==========================================
// 1. LISTAGEM DE DESPESAS (RF F2)
// ==========================================
export function DespesasList() {
  const navigate = useNavigate();
  const toast = useToast();
  const { rows, setRows, loading, reload } = useList('despesas');
  const imoveis = useList('imoveis');
  const [term, setTerm] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalBaixa, setModalBaixa] = useState<any | null>(null);
  const [dataPagamentoBaixa, setDataPagamentoBaixa] = useState(todayISO());
  const [formaPagamentoBaixa, setFormaPagamentoBaixa] = useState('PIX');

  const del = useDelete('despesas', 'Despesa', reload);

  // Filtra automaticamente pela categoria ou pelo imóvel vinculado (RF F2 NF 1.4)
  const filtered = rows.filter(r => {
    if (catFilter && r.categoria !== catFilter) return false;
    if (statusFilter && (r.status || 'Pendente') !== statusFilter) return false;
    if (!term) return true;
    const termClean = term.toLowerCase();
    const matchCat = (r.categoria || '').toLowerCase().includes(termClean);
    const matchDesc = (r.descricao || '').toLowerCase().includes(termClean);
    const matchImovel = (r.imovelTitulo || '').toLowerCase().includes(termClean);
    return matchCat || matchDesc || matchImovel;
  });

  const changeStatus = async (record: any, status: string) => {
    if (status === 'Pago') {
      setModalBaixa(record);
      setDataPagamentoBaixa(todayISO());
      return;
    }
    const historicoStatus = JSON.stringify([...parseHistorico(record.historicoStatus), {
      de: record.status || calcularStatusDespesa(record.dataVencimento, record.dataPagamento),
      para: status,
      data: new Date().toISOString().replace('T', ' ').slice(0, 16),
      usuario: 'Carlos Mendes (Operador)',
    }]);
    const payload = { status, dataPagamento: null, historicoStatus };
    try {
      await api.put(`/despesas/${record.id}`, payload);
      setRows(previous => previous.map(item => item.id === record.id ? { ...item, ...payload } : item));
      toast.success('Status atualizado com sucesso!');
    } catch (err) {
      toast.error(apiError(err, 'Erro ao atualizar o status.'));
    }
  };

  // Baixa / Pagamento de Despesa com registro no histórico
  const handleBaixa = async () => {
    if (!modalBaixa) return;
    const statusAntigo = modalBaixa.status || 'Pendente';
    const historicoAtual = parseHistorico(modalBaixa.historicoStatus);
    const novoHistorico = [
      ...historicoAtual,
      {
        de: statusAntigo,
        para: 'Pago',
        data: new Date().toISOString().replace('T', ' ').slice(0, 16),
        usuario: 'Carlos Mendes (Operador)',
        motivo: `Pagamento registrado via ${formaPagamentoBaixa}`,
      },
    ];

    try {
      await api.put(`/despesas/${modalBaixa.id}`, {
        status: 'Pago',
        dataPagamento: dataPagamentoBaixa,
        formaPagamento: formaPagamentoBaixa,
        historicoStatus: JSON.stringify(novoHistorico),
      });
      setRows(prev =>
        prev.map(item =>
          item.id === modalBaixa.id
            ? {
                ...item,
                status: 'Pago',
                dataPagamento: dataPagamentoBaixa,
                formaPagamento: formaPagamentoBaixa,
                historicoStatus: JSON.stringify(novoHistorico),
              }
            : item
        )
      );
      toast.success(`Despesa #${modalBaixa.id} baixada como Paga com sucesso!`);
      setModalBaixa(null);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao registrar pagamento da despesa.'));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Controle de Despesas"
        subtitle={`${rows.length} lançamentos de custos e despesas operacionais`}
        action={
          <Pode acao="Criar"><button
            onClick={() => navigate('/despesas/novo')}
            className="flex items-center gap-2 bg-[#0a2540] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#06182c] shadow-sm transition"
          >
            <Plus size={18} /> Nova Despesa
          </button></Pode>
        }
      />

      <Card>
        <Toolbar>
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Buscar por categoria, descrição ou imóvel vinculado..."
          />
          <FilterSelect
            value={catFilter}
            onChange={v => setCatFilter(v || '')}
            placeholder="Todas as categorias"
            options={CATEGORIAS_DESPESA}
          />
          <FilterSelect
            value={statusFilter}
            onChange={v => setStatusFilter(v || '')}
            placeholder="Todos os status"
            options={STATUS_DESPESA}
          />
        </Toolbar>

        <DataTable
          rows={filtered}
          loading={loading || imoveis.loading}
          onRowClick={r => navigate(`/despesas/${r.id}`)}
          columns={[
            {
              key: 'categoria',
              label: 'Categoria',
              render: r => (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <Receipt size={16} />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">{r.categoria}</span>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{r.descricao || '-'}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'imovel',
              label: 'Imóvel Vinculado',
              render: r =>
                r.imovelTitulo ? (
                  <div className="flex items-center gap-1.5 text-xs text-sky-800 font-medium">
                    <Building2 size={14} className="text-sky-600 shrink-0" />
                    <span className="line-clamp-1">{r.imovelTitulo}</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">Despesa Administrativa (Sede)</span>
                ),
            },
            {
              key: 'valor',
              label: 'Valor',
              render: r => (
                <span className="font-bold text-slate-800">
                  {formatCurrency(r.valor)}
                </span>
              ),
            },
            {
              key: 'vencimento',
              label: 'Vencimento',
              render: r => (
                <div className="text-xs text-slate-600">
                  <p className="font-medium">{formatDate(r.dataVencimento)}</p>
                  {r.dataPagamento ? (
                    <p className="text-[11px] text-emerald-600 font-medium">
                      Pago: {formatDate(r.dataPagamento)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400">Em aberto</p>
                  )}
                </div>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: r => {
                const s = r.status || calcularStatusDespesa(r.dataVencimento, r.dataPagamento);
                return (
                  <StatusDropdown value={s} options={STATUS_DESPESA} onChange={status => changeStatus(r, status)} />
                );
              },
            },
          ]}
          actions={r => (
            <RowActions
              onView={() => navigate(`/despesas/${r.id}`)}
              onEdit={() => navigate(`/despesas/${r.id}/editar`)}
              onDelete={
                r.status === 'Pago'
                  ? undefined // Impedir exclusão de despesas já marcadas como Pagas (RF F2 NF 1.5.3)
                  : () => del.ask(r.id, `Despesa #${r.id} (${r.categoria} - ${formatCurrency(r.valor)})`)
              }
            />
          )}
        />
      </Card>

      {/* Modal de Baixa de Pagamento */}
      {modalBaixa && (
        <Modal
          title={`Confirmar Pagamento da Despesa #${modalBaixa.id}`}
          onClose={() => setModalBaixa(null)}
        >
          <div className="p-6 space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border text-sm">
              <p className="text-slate-500 text-xs">Despesa:</p>
              <p className="font-bold text-slate-800">{modalBaixa.categoria}</p>
              <p className="text-slate-600 text-xs mt-0.5">{modalBaixa.descricao}</p>
              <p className="text-lg font-bold text-slate-900 mt-2">{formatCurrency(modalBaixa.valor)}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Data de Pagamento *
                </label>
                <DatePicker
                  aria-label="Data de Pagamento"
                  value={dataPagamentoBaixa}
                  onChange={v => setDataPagamentoBaixa(v || '')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Forma de Pagamento *
                </label>
                <Select
                  value={formaPagamentoBaixa}
                  onChange={selectedValue => setFormaPagamentoBaixa(selectedValue)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0a2540] bg-white"
                >
                  {FORMAS_PAGAMENTO_FINANCEIRO.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalBaixa(null)}
                className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBaixa}
                className="save-action px-4 py-2 text-white rounded-lg font-semibold text-sm flex items-center gap-2"
              >
                <CheckCircle2 size={16} /> Confirmar Pagamento
              </button>
            </div>
          </div>
        </Modal>
      )}

      {del.modal}
    </div>
  );
}

// ==========================================
// 2. COMPONENTE DE UPLOAD / ANEXO DE COMPROVANTE (RF F1 NF 1.1.5 / RF F3 NF 1.1)
// ==========================================
function ComprovanteField({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (val: string | null) => void;
  disabled: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Converte arquivo para Base64 Data URL (PDF, JPG, PNG)
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const isPdf = value?.startsWith('data:application/pdf');
  const isImage = value?.startsWith('data:image/');

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="p-4 border rounded-xl bg-slate-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <FileCheck size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Comprovante de Despesa Anexado</p>
              <p className="text-xs text-slate-500">
                {isPdf ? 'Documento em formato PDF' : isImage ? 'Imagem (JPG/PNG)' : 'Documento anexado'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              download="comprovante_despesa"
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition"
            >
              <Eye size={14} className="text-sky-600" /> Visualizar / Baixar
            </a>
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                title="Remover anexo"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
            disabled
              ? 'border-slate-200 bg-slate-50 cursor-not-allowed text-slate-400'
              : 'border-slate-300 hover:border-sky-500 hover:bg-sky-50/20 cursor-pointer text-slate-600'
          }`}
        >
          <Upload size={24} className="mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-semibold">
            {disabled ? 'Nenhum comprovante anexado' : 'Clique para anexar o comprovante da despesa'}
          </p>
          <p className="text-xs text-slate-400 mt-1">Formatos aceitos: PDF, JPG ou PNG (RF F1 NF 1.1.5)</p>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. FORMULÁRIO DE CADASTRO / EDIÇÃO / VIEW (RF F1 / F3 / F4)
// ==========================================
export function DespesaPage({ mode }: { mode: Mode }) {
  const imoveis = useList('imoveis');

  const tabs: TabDef[] = [
    {
      label: 'Dados da Despesa',
      fields: [
        // RF F1 NF 1.1.1: Categoria da despesa
        {
          key: 'categoria',
          label: 'Categoria da Despesa',
          type: 'select',
          options: CATEGORIAS_DESPESA,
          required: true,
        },
        // RF F1 NF 1.1.2: Imóvel vinculado opcional
        {
          key: 'imovelId',
          label: 'Imóvel Vinculado (Opcional - sob gestão)',
          type: 'search-select',
          placeholder: 'Deixe em branco para despesas administrativas da imobiliária',
          options: [
            { value: '', label: 'Nenhum (Despesa Administrativa da Sede)' },
            ...imoveis.rows.map(imv => ({
              value: imv.id,
              label: `#${imv.id} - ${imv.titulo}`,
              hint: `${imv.tipo} · ${imv.bairro || ''}, ${imv.cidade || ''}`,
            })),
          ],
          onChange: (val, form) => {
            const imv = imoveis.rows.find(x => Number(x.id) === Number(val));
            return {
              ...form,
              imovelId: val ? Number(val) : null,
              imovelTitulo: imv ? imv.titulo : null,
            };
          },
        },
        {
          key: 'descricao',
          label: 'Descrição Detalhada do Gasto',
          placeholder: 'Ex: Fatura de energia elétrica, troca de fechadura, materiais de escritório...',
          full: true,
        },
        // RF F1 NF 1.1.3: Valor com máscara monetária (R$)
        {
          key: 'valor',
          label: 'Valor da Despesa (R$)',
          type: 'currency',
          placeholder: 'R$ 0,00',
          required: true,
          // RF F4 NF 1.4: Se a despesa estiver marcada como Paga, o valor NÃO pode ser alterado
          disabled: (form, m) => m === 'edit' && form.status === 'Pago',
        },
        // RF F1 NF 1.1.4: Datas com seletores de calendário
        {
          key: 'dataVencimento',
          label: 'Data de Vencimento',
          type: 'date',
          required: true,
        },
        {
          key: 'dataPagamento',
          label: 'Data de Pagamento (Quitação)',
          type: 'date',
          placeholder: 'Deixe em branco se ainda não foi paga',
        },
        {
          key: 'formaPagamento',
          label: 'Forma de Pagamento Prevista / Efetuada',
          type: 'select',
          options: FORMAS_PAGAMENTO_FINANCEIRO,
        },
        {
          key: 'observacoes',
          label: 'Observações Complementares',
          type: 'textarea',
          full: true,
        },
        // RF F1 NF 1.1.5: Anexo de comprovante em PDF, JPG ou PNG
        {
          key: 'comprovante',
          label: 'Comprovante da Despesa (PDF, JPG ou PNG)',
          type: 'custom',
          full: true,
          render: (val, set, ctx) => (
            <ComprovanteField
              value={val}
              onChange={set}
              disabled={ctx.disabled}
            />
          ),
        },
      ],
      render: (form, currentMode) => {
        const isPaid = form.status === 'Pago';
        const statusPrevisto = calcularStatusDespesa(form.dataVencimento, form.dataPagamento);

        return (
          <div className="space-y-4">
            {/* Aviso de proteção de valores para despesas pagas (RF F4 NF 1.4) */}
            {currentMode === 'edit' && isPaid && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-800">
                <Lock size={18} className="text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold">Despesa Liquidada / Paga — Valor protegido contra alteração</p>
                  <p className="text-amber-700">
                    Conforme o requisito de confiabilidade (RF F4 NF 1.4), o valor de despesas já quitadas não pode ser editado.
                  </p>
                </div>
              </div>
            )}

            {/* Status Calculado em Tempo Real (RF F1 NF 1.5) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-500" />
                <span className="font-bold text-slate-700">Status Automático do Lançamento:</span>
                <Badge className={statusColor(statusPrevisto)}>{statusPrevisto}</Badge>
              </div>
              <p className="text-slate-500 text-[11px]">
                {statusPrevisto === 'Pago'
                  ? 'Quitação informada com data de pagamento'
                  : statusPrevisto === 'Atrasado'
                  ? 'Vencimento ultrapassado sem registro de pagamento'
                  : 'Aguardando data de vencimento'}
              </p>
            </div>
          </div>
        );
      },
    },
  ];

  // RF F3 NF 1.3: Aba com Histórico de mudanças de status
  const extraTabs: TabDef[] = mode !== 'create' ? [
    {
      label: 'Histórico de Status',
      render: form => {
        const historico = parseHistorico(form.historicoStatus);

        return (
          <RelatedGrid title="Histórico de Mudanças de Status da Despesa (RF F3 NF 1.3)">
            {historico.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nenhuma alteração de status registrada até o momento.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {historico.map((h, i) => (
                  <div key={i} className="p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        <History size={15} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            {h.de ? `${h.de} →` : 'Status Inicial:'}
                          </span>
                          <Badge className={statusColor(h.para)}>{h.para}</Badge>
                        </div>
                        {h.motivo && (
                          <p className="text-xs text-slate-600 mt-1 italic">&quot;{h.motivo}&quot;</p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Operador: <span className="font-medium text-slate-600">{h.usuario}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">{h.data}</span>
                  </div>
                ))}
              </div>
            )}
          </RelatedGrid>
        );
      },
    },
  ] : [];

  return (
    <EntityPage
      mode={mode}
      entity="despesas"
      basePath="/despesas"
      singular="Despesa"
      tabs={tabs}
      extraTabs={extraTabs}
      defaults={{
        categoria: 'Administrativa',
        formaPagamento: 'Boleto Bancário',
        dataVencimento: todayISO(),
      }}
      editLabel="Editar Despesa"
      cancelConfirm={mode === 'edit' ? 'Deseja descartar as alterações na despesa?' : undefined}
      validate={f => {
        if (!f.categoria) return 'A categoria da despesa é obrigatória.';
        if (!f.valor || Number(f.valor) <= 0) return 'O valor da despesa deve ser maior que zero.';
        if (!f.dataVencimento) return 'A data de vencimento é obrigatória.';
        return null;
      }}
      prepare={(f, currentMode) => {
        const computedStatus = calcularStatusDespesa(f.dataVencimento, f.dataPagamento);
        const imv = imoveis.rows.find(x => Number(x.id) === Number(f.imovelId));

        let historico = parseHistorico(f.historicoStatus);
        if (currentMode === 'create' && historico.length === 0) {
          historico = [
            {
              de: null,
              para: computedStatus,
              data: new Date().toISOString().replace('T', ' ').slice(0, 16),
              usuario: 'Carlos Mendes (Operador)',
              motivo: 'Cadastro inicial da despesa',
            },
          ];
        } else if (currentMode === 'edit' && f.status !== computedStatus) {
          historico.push({
            de: f.status || 'Pendente',
            para: computedStatus,
            data: new Date().toISOString().replace('T', ' ').slice(0, 16),
            usuario: 'Carlos Mendes (Operador)',
            motivo: 'Atualização das datas de vencimento / quitação',
          });
        }

        return {
          ...f,
          imovelId: f.imovelId ? Number(f.imovelId) : null,
          imovelTitulo: imv?.titulo ?? f.imovelTitulo ?? null,
          valor: Number(f.valor || 0),
          status: computedStatus,
          historicoStatus: JSON.stringify(historico),
        };
      }}
    />
  );
}
