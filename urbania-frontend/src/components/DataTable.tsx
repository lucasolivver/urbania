import { Select } from './Select';
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Eye, RotateCcw, Search, Trash2 } from 'lucide-react';
import { usePodeNaRota } from '../lib/auth';

export type Column<T> = { key: string; label: string; render?: (row: T) => ReactNode; className?: string };

// Grid de listagem com altura estruturada e paginação permanente (RNF 1.6 das consultas)
export function DataTable<T extends { id: number }>({ columns, rows, loading, onRowClick, empty, pageSize = 10, compact = false, layoutFixed = false, dense = false, actions }: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  pageSize?: number;
  compact?: boolean;
  layoutFixed?: boolean;
  dense?: boolean;
  actions?: (row: T) => ReactNode;
}) {
  const [page, setPage] = useState(1);

  // Volta para a primeira página quando um filtro muda a quantidade de linhas
  useEffect(() => setPage(1), [rows.length]);

  const current = rows.slice((page - 1) * pageSize, page * pageSize);
  const colSpan = columns.length + (actions ? 1 : 0);

  return (
    <div className={`flex flex-col justify-between ${dense ? 'data-table-dense' : ''} ${compact ? 'min-h-0' : 'min-h-[560px] lg:min-h-[calc(100vh-250px)]'} print:min-h-0 print:h-auto print:block print:m-0 print:p-0`}>
      <div className={`${layoutFixed ? 'overflow-x-hidden' : 'overflow-x-auto'} flex-1 print:overflow-visible print:block print:h-auto`}>
        <table className={`w-full text-sm text-left ${layoutFixed ? 'table-fixed' : ''}`}>
          <thead className="bg-white border-b border-slate-100 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <tr>
              {columns.map((c, idx) => {
                const defaultFirstWidth = idx === 0
                  ? (['id', 'codigo'].includes(c.key.toLowerCase()) ? 'w-16' : ['data', 'datahora'].includes(c.key.toLowerCase()) ? 'w-40' : '')
                  : '';
                const widthMatch = c.className?.match(/\b(w-\S+|min-w-\S+|max-w-\S+)\b/g)?.filter(w => !w.includes('w-full')).join(' ') || defaultFirstWidth;
                const alignMatch = c.className?.match(/\btext-(left|center|right)\b/g)?.join(' ') || '';
                const thWidthClass = `${widthMatch} ${alignMatch}`.trim();
                return (
                  <th key={c.key} className={`px-3.5 lg:px-4 py-3.5 whitespace-nowrap ${thWidthClass}`}>
                    {c.label}
                  </th>
                );
              })}
              {actions && (
                <th className="px-3.5 lg:px-4 py-3.5 whitespace-nowrap w-32 min-w-[116px] text-left no-print">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          {/* Tabela de visualização em tela (paginada normalmente) */}
          <tbody className="divide-y divide-slate-100 screen-table-body">
            {loading ? (
              <tr><td colSpan={colSpan} className="p-12 text-center text-slate-400">Carregando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colSpan} className="p-12 text-center text-slate-400">{empty || 'Nenhum registro encontrado.'}</td></tr>
            ) : current.map(row => (
              <tr key={row.id} onClick={() => onRowClick?.(row)} className={`hover:bg-slate-50/80 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}>
                {columns.map((c, idx) => {
                  const defaultFirstWidth = idx === 0
                    ? (['id', 'codigo'].includes(c.key.toLowerCase()) ? 'w-16' : ['data', 'datahora'].includes(c.key.toLowerCase()) ? 'w-40' : '')
                    : '';
                  const cleanClass = (c.className || 'text-slate-700').replace(/\bw-full\b/g, '').trim();
                  const colClass = `${cleanClass} ${defaultFirstWidth}`.trim();
                  return (
                    <td key={c.key} className={`px-3.5 lg:px-4 py-3.5 ${colClass}`}>
                      {c.render ? c.render(row) : String((row as any)[c.key] ?? '')}
                    </td>
                  );
                })}
                {actions && (
                  <td className="px-3.5 lg:px-4 py-3.5 whitespace-nowrap w-32 min-w-[116px] text-left no-print" onClick={e => e.stopPropagation()}>
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>

          {/* Tabela de impressão / exportação PDF (TODAS as páginas e registros juntos) */}
          <tbody className="divide-y divide-slate-100 print-table-body">
            {rows.map(row => (
              <tr key={`print-${row.id}`}>
                {columns.map((c, idx) => {
                  const defaultFirstWidth = idx === 0
                    ? (['id', 'codigo'].includes(c.key.toLowerCase()) ? 'w-16' : ['data', 'datahora'].includes(c.key.toLowerCase()) ? 'w-40' : '')
                    : '';
                  const cleanClass = (c.className || 'text-slate-700').replace(/\bw-full\b/g, '').trim();
                  const colClass = `${cleanClass} ${defaultFirstWidth}`.trim();
                  return (
                    <td key={`print-${c.key}`} className={`px-3.5 lg:px-4 py-3.5 ${colClass}`}>
                      {c.render ? c.render(row) : String((row as any)[c.key] ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager page={page} setPage={setPage} total={rows.length} pageSize={pageSize} />
    </div>
  );
}

// Paginação com contagem e controles de navegação sempre presentes
export function Pager({ page, setPage, total, pageSize }: { page: number; setPage: (p: number) => void; total: number; pageSize: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="no-print px-6 py-4 border-t border-slate-100 flex flex-wrap justify-between items-center text-sm text-slate-500 bg-white select-none">
      <span>
        {total === 0 ? 'Nenhum registro encontrado' : `Mostrando ${start}–${end} de ${total}`}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-400 transition"
          title="Página anterior"
        >
          <ChevronLeft size={20} />
        </button>

        {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setPage(n)}
            className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition ${
              n === page ? 'bg-[#0a2540] text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            {n}
          </button>
        ))}

        <button
          type="button"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-400 transition"
          title="Próxima página"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

// Cores dos botões de ação: só o ícone colorido; escurece e cresce um pouco ao passar o mouse
const ACTION_TONES = {
  view: 'text-cadastro hover:text-cadastro-hover',
  edit: 'text-cadastro hover:text-cadastro-hover',
  delete: 'text-cadastro hover:text-cadastro-hover',
};

export function ActionButton({ tone, title, onClick, children }: { tone: keyof typeof ACTION_TONES; title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button" title={title} aria-label={title}
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`w-8 h-8 inline-flex items-center justify-center rounded-lg transition-all duration-150 hover:scale-115 active:scale-95 ${ACTION_TONES[tone]}`}
    >
      {children}
    </button>
  );
}

// Botões Visualizar / Editar / Excluir de cada linha (padrão de ações da listagem)
export function RowActions({
  onView,
  onEdit,
  onDelete,
  viewTitle = 'Visualizar',
  editTitle = 'Editar',
  deleteTitle = 'Excluir',
  children,
}: {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  viewTitle?: string;
  editTitle?: string;
  deleteTitle?: string;
  children?: ReactNode;
}) {
  // Editar/Excluir só aparecem se o perfil tiver a permissão no módulo da página
  const pode = usePodeNaRota();
  if (!pode('Editar')) onEdit = undefined;
  if (!pode('Excluir')) onDelete = undefined;
  return (
    <div className="inline-flex items-center gap-1">
      {onView && <ActionButton tone="view" title={viewTitle} onClick={onView}><Eye size={16} /></ActionButton>}
      {onEdit && <ActionButton tone="edit" title={editTitle} onClick={onEdit}><Edit2 size={15} /></ActionButton>}
      {onDelete && <ActionButton tone="delete" title={deleteTitle} onClick={onDelete}><Trash2 size={15} /></ActionButton>}
      {children}
    </div>
  );
}

// ===== Busca com botão =====
// Dentro de uma <Toolbar>, os campos de busca e filtros guardam um rascunho e só são aplicados
// ao clicar em "Buscar" (ou Enter). Sem nenhum filtro preenchido, a busca traz todos os registros.
// Fora de uma Toolbar, os campos continuam filtrando na hora.
type CampoDeBusca = { aplicar: () => void; limpar: () => void };
type BuscaCtx = { registrar: (id: string, campo: CampoDeBusca) => () => void };
const BuscaContext = createContext<BuscaCtx | null>(null);

export function useCampoDeBusca(value: string, onChange: (v: string) => void) {
  const ctx = useContext(BuscaContext);
  const id = useId();
  const [rascunho, setRascunho] = useState(value);
  const atual = useRef({ rascunho, onChange });
  atual.current = { rascunho, onChange };

  // Acompanha mudanças feitas pela própria tela (ex.: filtro aplicado ou limpo)
  useEffect(() => setRascunho(value), [value]);

  useEffect(() => ctx?.registrar(id, {
    aplicar: () => atual.current.onChange(atual.current.rascunho),
    limpar: () => { setRascunho(''); atual.current.onChange(''); },
  }), [ctx, id]);

  return ctx ? { valor: rascunho, mudar: setRascunho } : { valor: value, mudar: onChange };
}

const campoBase = 'h-11 border rounded-xl text-sm bg-white outline-none transition shadow-xs focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10';

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { valor, mudar } = useCampoDeBusca(value, onChange);
  return (
    <div className="relative w-full md:flex-1 md:min-w-[16rem]">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
      <input
        type="search"
        className={`${campoBase} w-full pl-10 pr-4 border-slate-200 text-slate-800 placeholder:text-slate-400`}
        placeholder={placeholder} value={valor} onChange={e => mudar(e.target.value)}
      />
    </div>
  );
}

export function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; placeholder: string;
}) {
  const { valor, mudar } = useCampoDeBusca(value, onChange);
  // Filtro preenchido fica destacado para o usuário ver o que está selecionado
  const ativo = valor !== '';
  return (
    <div className="relative w-full md:w-auto">
      <Select
        value={valor} onChange={selectedValue => mudar(selectedValue)} title={placeholder} data-filled={ativo}
        className={`${campoBase} w-full md:w-auto md:min-w-[10rem] appearance-none cursor-pointer pl-3.5 pr-10 ${ativo ? 'border-cadastro/30 bg-cadastro/5 text-cadastro font-medium' : 'border-slate-200 text-slate-600'}`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </div>
  );
}

export function Toolbar({ children, extraActions }: { children: ReactNode; extraActions?: ReactNode }) {
  const campos = useRef(new Map<string, CampoDeBusca>());
  const [temCampos, setTemCampos] = useState(true);

  const ctx = useMemo<BuscaCtx>(() => ({
    registrar: (id, campo) => {
      campos.current.set(id, campo);
      setTemCampos(true);
      return () => {
        campos.current.delete(id);
        setTemCampos(campos.current.size > 0);
      };
    },
  }), []);

  const buscar = () => campos.current.forEach(c => c.aplicar());
  const limpar = () => campos.current.forEach(c => c.limpar());

  // Enter em qualquer campo faz a busca (sem enviar o formulário da página, quando a busca está dentro de um)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      buscar();
    }
  };

  return (
    <BuscaContext.Provider value={ctx}>
      <div onKeyDown={onKeyDown} className="no-print print:hidden p-4 border-b border-slate-100 flex flex-col gap-3.5 bg-slate-50/60 rounded-t-xl">
        <div className="flex flex-wrap items-center gap-3 w-full">
          {children}
        </div>
        {temCampos && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/60">
            {extraActions ? <div>{extraActions}</div> : <div />}
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={limpar}
                title="Limpar filtros e mostrar todos"
                className="h-9 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition shadow-2xs cursor-pointer active:scale-95"
              >
                <RotateCcw size={14} className="text-slate-500" /> Limpar
              </button>
              <button
                type="button"
                onClick={buscar}
                title="Buscar (sem filtros, mostra todos)"
                className="h-9 px-5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0a2540] text-xs font-bold text-white shadow-sm hover:bg-[#06182c] active:scale-95 transition cursor-pointer"
              >
                <Search size={14} className="text-sky-300" /> Buscar
              </button>
            </div>
          </div>
        )}
      </div>
    </BuscaContext.Provider>
  );
}

export function Card({ children, title, className = '' }: { children: ReactNode; title?: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200/60 rounded-xl shadow-sm print:border-none print:shadow-none print:rounded-none print:bg-transparent print:p-0 print:m-0 ${className}`}>
      {title && <div className="px-5 py-3 border-b border-slate-100 font-bold text-slate-800 print:hidden">{title}</div>}
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="no-print">{action}</div>}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${className}`}>{children}</span>;
}

// Busca "inteligente": ignora acentos e maiúsculas
export const normalize = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const matches = (term: string, ...values: unknown[]) => !term || values.some(v => normalize(v).includes(normalize(term)));

export { DateInput, DateRangeFilter } from './DateRangeFilter';
export type { DateInputProps, DateRangeFilterProps } from './DateRangeFilter';
