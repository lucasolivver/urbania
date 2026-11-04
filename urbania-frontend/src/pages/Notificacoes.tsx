import { StatusDropdown } from '../components/StatusDropdown';
import { Select } from '../components/Select';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Mail,
  MessageCircle,
  Plus,
  Send,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { api } from '../api';
import { Badge, Card, DataTable, FilterSelect, PageHeader, RowActions, SearchInput, Toolbar, matches } from '../components/DataTable';
import { ConfirmModal } from '../components/Modal';
import { apiError, useToast } from '../components/Toast';
import { useDelete } from '../components/useDelete';
import { useList, useRecord } from '../lib/useApi';
import {
  CANAIS_NOTIFICACAO,
  CHIPS_NOTIFICACAO,
  DESTINATARIOS_NOTIFICACAO,
  GATILHOS_NOTIFICACAO,
} from '../lib/options';
import { Pode } from '../lib/auth';

// Parse do campo canais (suporta JSON string ou string simples)
export const parseCanais = (canais: unknown): string[] => {
  if (Array.isArray(canais)) return canais;
  if (!canais) return ['WhatsApp'];
  try {
    const parsed = JSON.parse(String(canais));
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fallback se for string separada por vírgula
  }
  return String(canais).split(',').map(s => s.trim()).filter(Boolean);
};

// Ícone e estilo para cada canal
export const canalBadge = (c: string) => {
  if (c === 'WhatsApp') {
    return (
      <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <MessageCircle size={13} className="text-emerald-600" /> WhatsApp
      </span>
    );
  }
  if (c === 'E-mail') {
    return (
      <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
        <Mail size={13} className="text-sky-600" /> E-mail
      </span>
    );
  }
  return (
    <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
      <Smartphone size={13} className="text-purple-600" /> SMS
    </span>
  );
};

// Consultar Notificação (RF F14 - pág. 21)
export function NotificacoesList() {
  const navigate = useNavigate();
  const toast = useToast();
  const { rows, setRows, loading, reload } = useList('notificacoes');
  const [term, setTerm] = useState('');
  const [canalFiltro, setCanalFiltro] = useState('');
  const del = useDelete('notificacoes', 'Regra de Notificação', reload);

  // Toggle do status diretamente na grid (RNF 1.2)
  const setStatus = async (id: number, nextStatus: string) => {
    try {
      await api.put(`/notificacoes/${id}`, { status: nextStatus });
      setRows(rs => rs.map(r => (r.id === id ? { ...r, status: nextStatus } : r)));
      toast.success(`Regra #${id} ${nextStatus === 'Ativo' ? 'ativada' : 'desativada'} com sucesso.`);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao atualizar status da regra.'));
    }
  };

  const filtered = rows.filter(r => {
    const canais = parseCanais(r.canais || r.canal);
    const matchesCanal = !canalFiltro || canais.includes(canalFiltro);
    const matchesText = matches(term, r.nome, r.gatilho, r.titulo, r.mensagem, r.destinatario);
    return matchesCanal && matchesText;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Regras de Notificações"
        subtitle={`${rows.length} regras cadastradas (${rows.filter(r => r.status === 'Ativo').length} ativas)`}
        action={
          <Pode acao="Criar"><button
            onClick={() => navigate('/notificacoes/novo')}
            className="flex items-center gap-2 bg-[#0a2540] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#06182c] transition shadow-sm"
          >
            <Plus size={18} /> Nova Regra
          </button></Pode>
        }
      />

      <Card>
        <Toolbar>
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Buscar por nome da regra, gatilho ou mensagem..."
          />
          <FilterSelect
            value={canalFiltro}
            onChange={setCanalFiltro}
            options={CANAIS_NOTIFICACAO.map(c => ({ value: c, label: `Mostrar só regras de ${c}` }))}
            placeholder="Todos os canais"
          />
        </Toolbar>

        <DataTable
          rows={filtered}
          loading={loading}
          onRowClick={r => navigate(`/notificacoes/${r.id}`)}
          columns={[
            {
              key: 'nome',
              label: 'Nome da Regra',
              render: r => (
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{r.nome || r.titulo || `Regra #${r.id}`}</p>
                  <p className="text-xs text-slate-400 line-clamp-1">{r.mensagem}</p>
                </div>
              ),
            },
            {
              key: 'gatilho',
              label: 'Gatilho de Disparo',
              render: r => (
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                  <Send size={13} className="text-sky-600 shrink-0" />
                  <span>{r.gatilho || 'Disparo Automático'}</span>
                </div>
              ),
            },
            {
              key: 'canais',
              label: 'Canais de Envio',
              render: r => {
                const canais = parseCanais(r.canais || r.canal);
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {canais.map(c => canalBadge(c))}
                  </div>
                );
              },
            },
            {
              key: 'destinatario',
              label: 'Público Alvo',
              render: r => <Badge className="bg-slate-100 text-slate-700">{r.destinatario || 'Cliente'}</Badge>,
            },
            {
              key: 'status',
              label: 'Status',
              render: r => (
                <StatusDropdown value={r.status || 'Ativo'} options={['Ativo', 'Inativo']} onChange={status => setStatus(r.id, status)} />
              ),
            },
          ]}
          actions={r => (
            <RowActions
              onView={() => navigate(`/notificacoes/${r.id}`)}
              onEdit={() => navigate(`/notificacoes/${r.id}/editar`)}
              onDelete={() => del.ask(r.id, r.nome || `Regra #${r.id}`)}
            />
          )}
        />
      </Card>

      {del.modal}
    </div>
  );
}

// Visualizar / Cadastrar / Editar Notificação (RF F13, F15, F16)
export function NotificacaoPage({ mode }: { mode: 'create' | 'edit' | 'view' }) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { record: initial, loading } = useRecord('notificacoes', id);

  const [nome, setNome] = useState('');
  const [gatilho, setGatilho] = useState(GATILHOS_NOTIFICACAO[0]);
  const [destinatario, setDestinatario] = useState('Cliente');
  const [canais, setCanais] = useState<string[]>(['WhatsApp']);
  const [mensagem, setMensagem] = useState('');
  const [status, setStatus] = useState('Ativo');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [msgError, setMsgError] = useState(false);
  const [saving, setSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Inicializa dados na edição ou visualização
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (initial && initial.id && loadedId !== String(initial.id)) {
    setLoadedId(String(initial.id));
    setNome(initial.nome || initial.titulo || '');
    setGatilho(initial.gatilho || GATILHOS_NOTIFICACAO[0]);
    setDestinatario(initial.destinatario || 'Cliente');
    setCanais(parseCanais(initial.canais || initial.canal));
    setMensagem(initial.mensagem || '');
    setStatus(initial.status || 'Ativo');
  }

  // Adiciona o canal ao clicar no Toggle Button com ícone colorido (RNF 1.2)
  const toggleCanal = (canal: string) => {
    if (canais.includes(canal)) {
      if (canais.length === 1) {
        toast.error('A regra deve possuir pelo menos um canal de envio.');
        return;
      }
      setCanais(canais.filter(c => c !== canal));
    } else {
      setCanais([...canais, canal]);
    }
  };

  // Inserir chip de texto na posição do cursor do Text Area (RNF 1.3 - pág. 12)
  const insertChip = (chip: string) => {
    const el = textareaRef.current;
    if (!el) {
      setMensagem(prev => prev + ' ' + chip);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const text = mensagem;
    const nextText = text.substring(0, start) + chip + text.substring(end);
    setMensagem(nextText);
    setMsgError(false);

    // Reposiciona o cursor após a inserção
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + chip.length, start + chip.length);
    }, 50);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error('Informe o Nome da Regra.');
      return;
    }
    if (!mensagem.trim()) {
      setMsgError(true);
      toast.error('A mensagem não pode ficar vazia.');
      return;
    }
    if (!canais.length) {
      toast.error('Selecione pelo menos um canal de envio.');
      return;
    }

    setSaving(true);
    const payload = {
      nome: nome.trim(),
      titulo: nome.trim(),
      gatilho,
      destinatario,
      canais: JSON.stringify(canais),
      canal: canais[0],
      mensagem: mensagem.trim(),
      status,
      dataCriacao: initial?.dataCriacao || new Date().toISOString().slice(0, 10),
    };

    try {
      if (mode === 'create') {
        await api.post('/notificacoes', payload);
        toast.success('Regra de notificação criada com sucesso!');
      } else {
        await api.put(`/notificacoes/${id}`, payload);
        toast.success('Regra de notificação atualizada com sucesso!');
      }
      navigate('/notificacoes');
    } catch (err) {
      toast.error(apiError(err, 'Erro ao salvar a regra de notificação.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/notificacoes/${id}`);
      toast.success('Regra excluída com sucesso.');
      navigate('/notificacoes');
    } catch (err) {
      toast.error(apiError(err, 'Erro ao excluir a regra.'));
    }
  };

  // Preview formatado substituindo tags por dados simulados (RNF 1.2 - pág. 21)
  const formatPreview = (raw: string) => {
    return raw
      .replace(/{NomeCliente}/g, 'Beatriz Lima')
      .replace(/{NomeProprietario}/g, 'Roberto de Souza')
      .replace(/{Imovel}/g, 'Apartamento 3 Quartos no Centro')
      .replace(/{Endereco}/g, 'Av. Marechal Rondon, 412')
      .replace(/{Data}/g, '10/10/2026')
      .replace(/{Hora}/g, '15:30')
      .replace(/{Valor}/g, 'R$ 4.200,00')
      .replace(/{Corretor}/g, 'Carlos Mendes')
      .replace(/{ChavePix}/g, 'roberto.souza@gmail.com');
  };

  const isSMS = canais.includes('SMS');
  const smsLength = mensagem.length;
  const isSmsOverLimit = isSMS && smsLength > 160;

  if (loading && mode !== 'create') {
    return <p className="text-slate-400 p-8">Carregando detalhes da notificação...</p>;
  }

  // TELA DE VISUALIZAÇÃO (RNF 1.1 e 1.2 - pág. 21)
  if (mode === 'view') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/notificacoes')}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#0a2540] transition"
          >
            <ArrowLeft size={18} /> Voltar para Regras
          </button>
          <button
            onClick={() => navigate(`/notificacoes/${id}/editar`)}
            className="bg-[#0a2540] text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-[#06182c] transition shadow-sm"
          >
            Editar Regra
          </button>
        </div>

        <Card>
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between border-b pb-5">
              <div>
                <span className="text-xs font-bold text-sky-600 uppercase tracking-widest">Visualização de Regra</span>
                <h1 className="text-2xl font-bold text-slate-800 mt-1">{nome || `Regra #${id}`}</h1>
              </div>
              <Badge className={status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}>
                {status}
              </Badge>
            </div>

            {/* Campos em texto simples sem caixas de input visíveis (RNF 1.1) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-slate-50/70 p-5 rounded-xl border border-slate-200">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase">Gatilho de Disparo</p>
                <p className="text-sm font-bold text-slate-800 mt-1">{gatilho}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase">Destinatário</p>
                <p className="text-sm font-bold text-slate-800 mt-1">{destinatario}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase">Canais Habilitados</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {canais.map(c => canalBadge(c))}
                </div>
              </div>
            </div>

            {/* Texto original do template */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Template da Mensagem (Texto com Tags)</p>
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-slate-700 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                {mensagem || '—'}
              </div>
            </div>

            {/* Card de Pré-visualização simulando o visual final do WhatsApp (RNF 1.2 - pág. 21) */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Simulação de Envio ao Destinatário (Preview do WhatsApp)</p>
              <div className="bg-[#efeae2] p-6 rounded-2xl border border-slate-300 max-w-md shadow-inner">
                {/* Balão verde imitando WhatsApp */}
                <div className="bg-[#d9fdd3] text-slate-900 rounded-xl p-3.5 shadow-sm text-sm leading-relaxed relative">
                  <p className="whitespace-pre-wrap">{formatPreview(mensagem)}</p>
                  <div className="flex items-center justify-end gap-1 mt-1 text-[11px] text-slate-500">
                    <span>14:32</span>
                    <CheckCheck size={14} className="text-sky-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // TELA DE CADASTRO E EDIÇÃO (RF F13 e F16)
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/notificacoes')}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#0a2540] transition"
        >
          <ArrowLeft size={18} /> Cancelar e Voltar
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 text-rose-600 hover:text-rose-800 font-semibold text-sm transition"
          >
            <Trash2 size={16} /> Excluir Regra
          </button>
        )}
      </div>

      <Card>
        <div className="p-6 md:p-8 space-y-6">
          <div className="border-b pb-4">
            <span className="text-xs font-bold text-sky-600 uppercase tracking-widest">
              {mode === 'create' ? 'Cadastrar Notificação' : 'Editar Notificação'}
            </span>
            <h1 className="text-2xl font-bold text-slate-800 mt-1">
              {mode === 'create' ? 'Novo Template de Notificação' : `Regra: ${nome}`}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Defina gatilhos automatizados e personalize a mensagem com tags dinâmicas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
                Nome da Regra <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Lembrete de Visita Agendada"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#0a2540] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
                Gatilho do Disparo (Evento) <span className="text-red-500">*</span>
              </label>
              <Select
                value={gatilho}
                onChange={selectedValue => setGatilho(selectedValue)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#0a2540] text-sm bg-white"
              >
                {GATILHOS_NOTIFICACAO.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
                Destinatário Padrão
              </label>
              <Select
                value={destinatario}
                onChange={selectedValue => setDestinatario(selectedValue)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#0a2540] text-sm bg-white"
              >
                {DESTINATARIOS_NOTIFICACAO.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
                Status da Automação
              </label>
              <Select
                value={status}
                onChange={selectedValue => setStatus(selectedValue)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#0a2540] text-sm bg-white"
              >
                <option value="Ativo">Ativo (Disparo Automático Ligado)</option>
                <option value="Inativo">Inativo (Disparo Pausado)</option>
              </Select>
            </div>
          </div>

          {/* Seleção de Canais: Toggle Buttons com ícones coloridos (RNF 1.2 - pág. 12) */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">
              Canais de Envio (Selecione um ou mais) <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => toggleCanal('WhatsApp')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm transition shadow-sm ${
                  canais.includes('WhatsApp')
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-200'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <MessageCircle size={18} />
                <span>WhatsApp</span>
                {canais.includes('WhatsApp') && <Check size={16} className="ml-1" />}
              </button>

              <button
                type="button"
                onClick={() => toggleCanal('E-mail')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm transition shadow-sm ${
                  canais.includes('E-mail')
                    ? 'bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-200'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Mail size={18} />
                <span>E-mail</span>
                {canais.includes('E-mail') && <Check size={16} className="ml-1" />}
              </button>

              <button
                type="button"
                onClick={() => toggleCanal('SMS')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm transition shadow-sm ${
                  canais.includes('SMS')
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Smartphone size={18} />
                <span>SMS</span>
                {canais.includes('SMS') && <Check size={16} className="ml-1" />}
              </button>
            </div>
          </div>

          {/* Mensagem com Pílulas/Chips e Contador de Caracteres SMS (RNF 1.3 / RNF 1.2 / RNF 1.3 pág. 30) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase text-slate-600">
                Texto da Mensagem <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Clique nas pílulas abaixo para inserir dados dinâmicos</span>
            </div>

            {/* Pílulas/Chips interativos logo acima do Text Area (RNF 1.3 - pág. 12) */}
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 mb-2">
              {CHIPS_NOTIFICACAO.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => insertChip(chip)}
                  title={`Inserir ${chip}`}
                  className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-white text-sky-700 border border-sky-200 hover:bg-sky-50 hover:border-sky-300 transition shadow-xs active:scale-95"
                >
                  + {chip}
                </button>
              ))}
            </div>

            <div className="relative">
              <textarea
                ref={textareaRef}
                rows={5}
                value={mensagem}
                onChange={e => {
                  setMensagem(e.target.value);
                  if (msgError && e.target.value.trim()) setMsgError(false);
                }}
                placeholder="Escreva a mensagem aqui... Use as pílulas acima para personalizar automaticamente com dados do cliente e imóvel."
                aria-invalid={msgError} className={`w-full p-3.5 border ${msgError ? 'border-red-500' : 'border-slate-300'} rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#0a2540] text-sm leading-relaxed transition`}
              />

              {/* Contador de caracteres para canal SMS (RNF 1.2 - pág. 29) */}
              {isSMS && (
                <div className={`absolute bottom-3 right-3 text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  isSmsOverLimit ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {smsLength}/160 {isSmsOverLimit && '(Limite de 1 SMS excedido)'}
                </div>
              )}
            </div>

            {msgError && (
              <p className="text-xs text-red-600 font-semibold mt-1">A mensagem não pode ficar vazia.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/notificacoes')}
              className="px-5 py-2.5 border rounded-lg font-semibold text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="save-action px-6 py-2.5 text-white rounded-lg font-semibold text-sm transition shadow-md disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Regra'}
            </button>
          </div>
        </div>
      </Card>

      {/* Modal de confirmação ao excluir regra (RNF 1.4 - pág. 30) */}
      {showDeleteModal && (
        <ConfirmModal
          title="Excluir Regra de Notificação"
          message={`Deseja realmente excluir a regra "${nome}"? Os disparos automáticos associados serão cancelados.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
