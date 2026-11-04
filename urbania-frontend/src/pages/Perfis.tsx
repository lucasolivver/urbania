import { RecordStatusDropdown } from '../components/StatusDropdown';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckSquare,
  Lock,
  Plus,
  Shield,
  Square,
  Users,
} from 'lucide-react';
import { Badge, Card, DataTable, FilterSelect, PageHeader, RowActions, SearchInput, Toolbar, matches } from '../components/DataTable';
import type { Mode, TabDef } from '../components/EntityForm';
import { EntityPage, RelatedGrid } from '../components/EntityPage';
import { useDelete } from '../components/useDelete';
import { useList } from '../lib/useApi';
import { MODULOS_SISTEMA, STATUS_PERFIL, statusColor } from '../lib/options';
import { Pode } from '../lib/auth';

// Parser seguro para as permissões
function parsePermissoes(val: any): Record<string, string[]> {
  if (!val) return {};
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// ==========================================
// 1. LISTAGEM DE PERFIS (RF F10)
// ==========================================
export function PerfisList() {
  const navigate = useNavigate();
  const { rows, loading, reload } = useList('perfis');
  const funcionarios = useList('funcionarios');
  const [term, setTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const del = useDelete('perfis', 'Perfil de Acesso', reload);

  // Calcula contagem de usuários vinculados por perfil
  const getUsuariosCount = (perfilId: number) => {
    return funcionarios.rows.filter(f => Number(f.perfilId) === Number(perfilId)).length;
  };

  const filtered = rows.filter(r => {
    if (statusFilter && (r.status || 'Ativo') !== statusFilter) return false;
    return matches(term, r.nome) || matches(term, r.descricao);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Perfis de Acesso"
        subtitle={`${rows.length} perfis cadastrados no sistema`}
        action={
          <Pode acao="Criar"><button
            onClick={() => navigate('/perfis/novo')}
            className="flex items-center gap-2 bg-[#0a2540] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#06182c] shadow-sm transition"
          >
            <Plus size={18} /> Novo Perfil
          </button></Pode>
        }
      />

      <Card>
        <Toolbar>
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Pesquisar por nome do perfil ou descrição..."
          />
          <FilterSelect
            value={statusFilter}
            onChange={v => setStatusFilter(v || '')}
            placeholder="Todos os status"
            options={STATUS_PERFIL}
          />
        </Toolbar>

        <DataTable
          rows={filtered}
          loading={loading || funcionarios.loading}
          onRowClick={r => navigate(`/perfis/${r.id}`)}
          columns={[
            {
              key: 'id',
              label: 'ID',
              render: r => `#${r.id}`,
              className: 'font-mono text-slate-500 w-16',
            },
            {
              key: 'nome',
              label: 'Nome do Perfil',
              render: r => (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <Shield size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800">{r.nome}</span>
                      {Number(r.nativo) === 1 && (
                        <span
                          title="Perfil Nativo do Sistema (protegido contra exclusão e renomeação)"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                        >
                          <Lock size={10} /> Nativo
                        </span>
                      )}
                    </div>
                    {r.descricao && (
                      <p className="text-xs text-slate-500 line-clamp-1">{r.descricao}</p>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'usuarios',
              label: 'Qtd. Usuários Vinculados',
              render: r => {
                const count = getUsuariosCount(r.id);
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      count > 0 ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Users size={12} />
                    {count} {count === 1 ? 'usuário' : 'usuários'}
                  </span>
                );
              },
            },
            {
              key: 'status',
              label: 'Status',
              render: r => (
                <RecordStatusDropdown entity="perfis" record={r} options={STATUS_PERFIL} onSaved={reload} />
              ),
            },
          ]}
          actions={r => (
            <RowActions
              onView={() => navigate(`/perfis/${r.id}`)}
              onEdit={() => navigate(`/perfis/${r.id}/editar`)}
              onDelete={
                Number(r.nativo) === 1
                  ? undefined
                  : () => del.ask(r.id, `Perfil ${r.nome}`)
              }
            />
          )}
        />
      </Card>

      {del.modal}
    </div>
  );
}

// ==========================================
// 2. MATRIZ DE PERMISSÕES COMPONENT (RF F9 / F11 / F12)
// ==========================================
function MatrizPermissoes({
  value,
  onChange,
  mode,
}: {
  value: any;
  onChange: (val: Record<string, string[]>) => void;
  mode: Mode;
}) {
  const current: Record<string, string[]> = parsePermissoes(value);
  const isView = mode === 'view';

  // Toggle de uma ação individual
  const toggleAction = (modId: string, acao: string) => {
    if (isView) return;
    const modActions = current[modId] || [];
    const exists = modActions.includes(acao);
    const updatedMod = exists
      ? modActions.filter(a => a !== acao)
      : [...modActions, acao];

    const next = { ...current };
    if (updatedMod.length === 0) {
      delete next[modId];
    } else {
      next[modId] = updatedMod;
    }
    onChange(next);
  };

  // Toggle de "Selecionar Todos" de um módulo (RF F9 NF 1.3)
  const toggleSelectAllModule = (modId: string, allActions: string[]) => {
    if (isView) return;
    const modActions = current[modId] || [];
    const allSelected = allActions.every(a => modActions.includes(a));

    const next = { ...current };
    if (allSelected) {
      delete next[modId];
    } else {
      next[modId] = [...allActions];
    }
    onChange(next);
  };

  // Selecionar ou Desmarcar absolutamente tudo
  const toggleSelectGlobal = (enableAll: boolean) => {
    if (isView) return;
    if (!enableAll) {
      onChange({});
      return;
    }
    const all: Record<string, string[]> = {};
    MODULOS_SISTEMA.forEach(m => {
      all[m.id] = [...m.acoes];
    });
    onChange(all);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Ações Rápidas no topo da matriz */}
      {!isView && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border rounded-xl text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Shield size={16} className="text-sky-600" />
            <span className="font-semibold">Configure os privilégios de acesso por módulo:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleSelectGlobal(true)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <CheckSquare size={13} className="text-sky-600" /> Marcar Todos os Módulos
            </button>
            <button
              type="button"
              onClick={() => toggleSelectGlobal(false)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <Square size={13} className="text-slate-400" /> Desmarcar Todos
            </button>
          </div>
        </div>
      )}

      {/* Tabela Matriz de Permissões */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0a2540] text-white text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-1/3">Módulo / Tela</th>
                <th className="py-3.5 px-3 text-center w-24">Sel. Todos</th>
                <th className="py-3.5 px-3 text-center">Visualizar</th>
                <th className="py-3.5 px-3 text-center">Criar</th>
                <th className="py-3.5 px-3 text-center">Editar</th>
                <th className="py-3.5 px-3 text-center">Excluir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MODULOS_SISTEMA.map((mod, index) => {
                const modActions = current[mod.id] || [];
                const allSelected = mod.acoes.every(a => modActions.includes(a));
                const someSelected = modActions.length > 0 && !allSelected;

                return (
                  <tr
                    key={mod.id}
                    className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-sky-50/30`}
                  >
                    {/* Identificação do Módulo */}
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-slate-800">{mod.label}</p>
                        <p className="text-[11px] text-slate-500">{mod.descricao}</p>
                      </div>
                    </td>

                    {/* Checkbox Selecionar Todos por Módulo (RF F9 NF 1.3) */}
                    <td className="py-3 px-3 text-center">
                      {!isView ? (
                        <button
                          type="button"
                          onClick={() => toggleSelectAllModule(mod.id, mod.acoes)}
                          className={`w-6 h-6 mx-auto rounded flex items-center justify-center border transition ${
                            allSelected
                              ? 'bg-sky-600 border-sky-600 text-white'
                              : someSelected
                              ? 'bg-sky-100 border-sky-400 text-sky-700'
                              : 'border-slate-300 bg-white hover:border-slate-400'
                          }`}
                          title={allSelected ? 'Desmarcar todo o módulo' : 'Marcar todas as ações deste módulo'}
                        >
                          {allSelected ? <Check size={14} strokeWidth={3} /> : someSelected ? <span className="font-bold text-xs">—</span> : null}
                        </button>
                      ) : (
                        <div className="flex justify-center">
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
                              allSelected
                                ? 'bg-sky-100 text-sky-800 font-bold'
                                : 'text-slate-300'
                            }`}
                          >
                            {allSelected ? <Check size={13} /> : '—'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Ações individuais: Visualizar, Criar, Editar, Excluir */}
                    {['Visualizar', 'Criar', 'Editar', 'Excluir'].map(acao => {
                      const hasPerm = modActions.includes(acao);

                      // Ação que não existe no módulo (ex.: "Criar" em Relatórios)
                      if (!mod.acoes.includes(acao)) {
                        return <td key={acao} className="py-3 px-3 text-center text-slate-300" title="Não se aplica a este módulo">—</td>;
                      }

                      if (isView) {
                        // RF F11 NF 1.1: Somente leitura. Checkboxes desmarcados com opacidade reduzida destacando apenas os acessos concedidos
                        return (
                          <td key={acao} className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-all ${
                                hasPerm
                                  ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                                  : 'opacity-25 text-slate-300 bg-slate-100'
                              }`}
                              title={hasPerm ? `${acao} permitido` : `${acao} bloqueado`}
                            >
                              {hasPerm ? <Check size={14} strokeWidth={3} /> : <span className="text-[10px]">✕</span>}
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={acao} className="py-3 px-3 text-center">
                          <label className="inline-flex items-center justify-center cursor-pointer p-1">
                            <input
                              type="checkbox"
                              checked={hasPerm}
                              onChange={() => toggleAction(mod.id, acao)}
                              className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aviso de impacto em modo de edição (RF F12 NF 1.3) */}
      {!isView && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-800">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Atenção ao alterar permissões de perfis em uso:</p>
            <p className="mt-0.5 text-amber-700 leading-relaxed">
              As permissões salvas aqui serão aplicadas imediatamente a todos os funcionários vinculados a este perfil.
              Remover privilégios de &quot;Visualizar&quot; impedirá os usuários de acessarem as respectivas telas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. PÁGINA DE CADASTRO / EDIÇÃO / VIEW (RF F9 / F11 / F12)
// ==========================================
export function PerfilPage({ mode }: { mode: Mode }) {
  const funcionarios = useList('funcionarios');

  const tabs: TabDef[] = [
    {
      label: 'Dados do Perfil',
      fields: [
        {
          key: 'nome',
          label: 'Nome do Perfil',
          required: true,
          placeholder: 'Ex.: Secretária, Gerente Comercial, Corretor Pleno',
          // RF F12 NF 1.2: Perfis nativos têm o nome bloqueado (fundo cinza)
          disabled: (form, m) => m === 'edit' && Number(form.nativo) === 1,
          full: true,
        },
        {
          key: 'status',
          label: 'Status do Perfil',
          type: 'select',
          options: STATUS_PERFIL,
          required: true,
        },
        {
          key: 'descricao',
          label: 'Descrição das Atribuições',
          type: 'textarea',
          full: true,
          placeholder: 'Descreva a finalidade deste perfil de acesso e quais funções desempenha na imobiliária...',
        },
      ],
      render: (form, currentMode) => {
        const isNative = Number(form.nativo) === 1;
        const linkedUsers = funcionarios.rows.filter(f => Number(f.perfilId) === Number(form.id));

        return (
          <div className="space-y-4">
            {isNative && (
              <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-3 text-xs text-slate-700">
                <Lock size={18} className="text-slate-500 shrink-0" />
                <div>
                  <p className="font-bold">Perfil Nativo do Sistema Urbânia</p>
                  <p className="text-slate-500">
                    Este é um nível de acesso fundamental para o funcionamento padrão. Sua nomenclatura e exclusão são protegidas por integridade.
                  </p>
                </div>
              </div>
            )}

            {/* Totalizador de funcionários vinculados (RF F11 NF 1.2) */}
            {currentMode === 'view' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-sky-900">{linkedUsers.length}</p>
                    <p className="text-xs text-sky-700 font-medium">
                      {linkedUsers.length === 1 ? 'Funcionário utiliza este perfil' : 'Funcionários utilizam este perfil'}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                    <Shield size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{form.nome || 'Perfil'}</p>
                    <p className="text-xs text-slate-500">
                      Status: <span className="font-semibold text-slate-700">{form.status || 'Ativo'}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      label: 'Matriz de Permissões',
      fields: [
        {
          key: 'permissoes',
          label: 'Permissões',
          type: 'custom',
          full: true,
          render: (val, set, ctx) => (
            <MatrizPermissoes value={val} onChange={set} mode={ctx.mode} />
          ),
        },
      ],
    },
  ];

  const extraTabs: TabDef[] = mode === 'view' ? [
    {
      label: 'Usuários Vinculados',
      render: form => {
        const linkedUsers = funcionarios.rows.filter(f => Number(f.perfilId) === Number(form.id));
        return (
          <RelatedGrid title={`Funcionários com perfil "${form.nome}" (${linkedUsers.length})`}>
            {linkedUsers.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nenhum funcionário está utilizando este perfil no momento.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {linkedUsers.map(u => (
                  <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#0a2540] text-white flex items-center justify-center font-bold text-xs">
                        {u.nome?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{u.nome}</p>
                        <p className="text-xs text-slate-500">{u.cargo || 'Funcionário'} · {u.email || u.telefone || 'Sem contato'}</p>
                      </div>
                    </div>
                    <Badge className={statusColor(u.status || 'Ativo')}>
                      {u.status || 'Ativo'}
                    </Badge>
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
      entity="perfis"
      basePath="/perfis"
      singular="Perfil de Acesso"
      tabs={tabs}
      extraTabs={extraTabs}
      defaults={{
        status: 'Ativo',
        permissoes: JSON.stringify({
          clientes: ['Visualizar'],
          imoveis: ['Visualizar'],
        }),
      }}
      editLabel="Editar Perfil"
      cancelConfirm={mode === 'edit' ? 'Deseja descartar as alterações nas permissões?' : undefined}
      validate={f => {
        if (!f.nome || !String(f.nome).trim()) return 'O Nome do Perfil é obrigatório.';
        return null;
      }}
      prepare={f => {
        return {
          ...f,
          permissoes: typeof f.permissoes === 'object' ? JSON.stringify(f.permissoes) : f.permissoes,
        };
      }}
    />
  );
}
