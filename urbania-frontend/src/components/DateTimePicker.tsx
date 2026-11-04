import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';

// Seletores de data e horário no visual do sistema, no lugar do calendário/relógio nativos do navegador.
// O valor continua no mesmo formato do <input> nativo: data "AAAA-MM-DD" e hora "HH:MM".

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');
const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoParaBr = (iso?: string | null) => {
  const [a, m, d] = String(iso || '').slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
};
const brParaIso = (br: string) => {
  const n = br.replace(/\D/g, '');
  if (n.length !== 8) return '';
  const d = Number(n.slice(0, 2)), m = Number(n.slice(2, 4)), a = Number(n.slice(4));
  if (a < 1900 || a > 2100 || m < 1 || m > 12 || d < 1 || d > new Date(a, m, 0).getDate()) return '';
  return `${a}-${pad(m)}-${pad(d)}`;
};
const mascaraData = (v: string) => {
  const n = v.replace(/\D/g, '').slice(0, 8);
  return n.length <= 2 ? n : n.length <= 4 ? `${n.slice(0, 2)}/${n.slice(2)}` : `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
};
const mascaraHora = (v: string) => {
  const n = v.replace(/\D/g, '').slice(0, 4);
  return n.length <= 2 ? n : `${n.slice(0, 2)}:${n.slice(2)}`;
};
const horaValida = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

// ---------------------------------------------------------------------------
// Painel flutuante: vai para o <body> (não é cortado por modais/cards com overflow), abre embaixo do campo
// ou em cima se não couber, e fecha com clique fora ou Esc.
function Popover({ anchor, open, onClose, width, children }: {
  anchor: RefObject<HTMLElement | null>; open: boolean; onClose: () => void; width: number; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const posicionar = useCallback(() => {
    const a = anchor.current?.getBoundingClientRect();
    if (!a) return;
    const altura = ref.current?.offsetHeight || 340;
    const cabeEmbaixo = a.bottom + 8 + altura <= window.innerHeight - 8;
    const top = cabeEmbaixo || a.top - 8 - altura < 8 ? a.bottom + 8 : a.top - 8 - altura;
    const left = Math.min(Math.max(8, a.left), window.innerWidth - width - 8);
    setPos({ top, left });
  }, [anchor, width]);

  useLayoutEffect(() => {
    if (!open) return setPos(null);
    posicionar();
    // segunda medida com a altura real do painel já renderizado
    const id = requestAnimationFrame(posicionar);
    return () => cancelAnimationFrame(id);
  }, [open, posicionar]);

  useEffect(() => {
    if (!open) return;
    const fora = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc, true);
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, true);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc, true);
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar, true);
    };
  }, [open, onClose, anchor, posicionar]);

  if (!open) return null;
  return createPortal(
    <div ref={ref} role="dialog" style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, zIndex: 1000 }}
      className="painel-flutuante bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 select-none animate-fade-in">
      {children}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Mês/ano do calendário: um botão "Novembro 2026" que abre uma grade de meses com troca de ano
// (substitui as listas nativas de mês e ano). Fica dentro do próprio painel do calendário.
export function MesAnoSeletor({ ano, mes, onChange }: { ano: number; mes: number; onChange: (ano: number, mes: number) => void }) {
  const [aberto, setAberto] = useState(false);
  const [anoGrade, setAnoGrade] = useState(ano);
  const [modoAnos, setModoAnos] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const abrir = () => { setAnoGrade(ano); setModoAnos(false); setAberto(a => !a); };
  const inicioDecada = anoGrade - (anoGrade % 12);
  const navBtn = 'p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer';

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={abrir} aria-expanded={aberto} title="Escolher mês e ano"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-bold text-slate-800 hover:bg-slate-100 hover:text-[#0a2540] transition cursor-pointer">
        {MESES[mes]} {ano}
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-10 w-60 bg-white rounded-xl shadow-xl border border-slate-200 p-2.5 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <button type="button" className={navBtn} title={modoAnos ? 'Anos anteriores' : 'Ano anterior'}
              onClick={() => setAnoGrade(a => a - (modoAnos ? 12 : 1))}><ChevronLeft size={16} /></button>
            <button type="button" onClick={() => setModoAnos(m => !m)} title="Escolher o ano"
              className="px-2 py-0.5 rounded-lg text-sm font-bold text-slate-800 hover:bg-slate-100 hover:text-[#0a2540] transition cursor-pointer">
              {modoAnos ? `${inicioDecada} – ${inicioDecada + 11}` : anoGrade}
            </button>
            <button type="button" className={navBtn} title={modoAnos ? 'Próximos anos' : 'Próximo ano'}
              onClick={() => setAnoGrade(a => a + (modoAnos ? 12 : 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {modoAnos
              ? Array.from({ length: 12 }, (_, i) => inicioDecada + i).map(a => (
                <button key={a} type="button" onClick={() => { setAnoGrade(a); setModoAnos(false); }}
                  className={`h-8 rounded-lg text-xs font-semibold transition cursor-pointer ${a === ano ? 'bg-[#0a2540] text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{a}</button>
              ))
              : MESES_CURTOS.map((m, i) => (
                <button key={m} type="button" onClick={() => { onChange(anoGrade, i); setAberto(false); }}
                  className={`h-8 rounded-lg text-xs font-semibold transition cursor-pointer ${anoGrade === ano && i === mes ? 'bg-[#0a2540] text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{m}</button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campo de data: digitação com máscara dd/mm/aaaa + calendário do sistema
export function DatePicker({ value, onChange, disabled, invalid, className = '', placeholder = 'dd/mm/aaaa', minDate, maxDate, 'aria-label': ariaLabel }: {
  value?: string | null; onChange: (iso: string | null) => void; disabled?: boolean; invalid?: boolean; className?: string;
  placeholder?: string; minDate?: string; maxDate?: string; 'aria-label'?: string;
}) {
  const iso = String(value || '').slice(0, 10);
  const [texto, setTexto] = useState(isoParaBr(iso));
  const [aberto, setAberto] = useState(false);
  const [vista, setVista] = useState(() => new Date());
  const ancora = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTexto(isoParaBr(iso)), [iso]);

  const abrir = () => {
    if (disabled) return;
    const [a, m] = iso.split('-').map(Number);
    setVista(a && m ? new Date(a, m - 1, 1) : new Date());
    setAberto(o => !o);
  };
  const fechar = useCallback(() => setAberto(false), []);
  const escolher = (novo: string | null) => {
    onChange(novo);
    setTexto(isoParaBr(novo));
    setAberto(false);
    inputRef.current?.focus();
  };

  const ano = vista.getFullYear(), mes = vista.getMonth();
  const hoje = isoDe(new Date());
  const primeiro = new Date(ano, mes, 1);
  const dias = Array.from({ length: 42 }, (_, i) => new Date(ano, mes, 1 - primeiro.getDay() + i));
  const foraDoLimite = (d: string) => Boolean((minDate && d < minDate) || (maxDate && d > maxDate));
  const navBtn = 'p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer';

  return (
    <>
      <div ref={ancora} aria-invalid={invalid}
        className={`${className} flex items-center gap-1 !py-0 ${disabled ? '!bg-slate-100 text-slate-500' : ''} focus-within:ring-2 focus-within:ring-[#0a2540]`}>
        <input ref={inputRef} type="text" inputMode="numeric" disabled={disabled} aria-label={ariaLabel} placeholder={placeholder}
          value={texto}
          onChange={e => {
            const t = mascaraData(e.target.value);
            setTexto(t);
            const novo = brParaIso(t);
            if (novo) onChange(novo);
            else if (!t) onChange(null);
          }}
          onBlur={() => { if (!brParaIso(texto) && texto) setTexto(isoParaBr(iso)); }}
          onKeyDown={e => { if (e.key === 'ArrowDown' || (e.key === ' ' && !texto)) { e.preventDefault(); abrir(); } }}
          className="flex-1 min-w-0 py-2 bg-transparent outline-none placeholder:text-slate-400 disabled:cursor-not-allowed" />
        {!disabled && iso && (
          <button type="button" tabIndex={-1} title="Limpar data" onClick={() => escolher(null)}
            className="p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"><X size={14} /></button>
        )}
        <button type="button" disabled={disabled} onClick={abrir} title="Abrir calendário" aria-expanded={aberto}
          className={`-mr-1 p-1.5 rounded-md transition ${disabled ? 'text-slate-300 cursor-not-allowed' : iso ? 'text-[#0a2540] hover:bg-slate-100 cursor-pointer' : 'text-slate-400 hover:text-[#0a2540] hover:bg-slate-100 cursor-pointer'}`}>
          <Calendar size={17} />
        </button>
      </div>

      <Popover anchor={ancora} open={aberto} onClose={fechar} width={288}>
        <div className="flex items-center justify-between gap-1 mb-2.5">
          <button type="button" className={navBtn} title="Mês anterior" onClick={() => setVista(new Date(ano, mes - 1, 1))}><ChevronLeft size={17} /></button>
          <MesAnoSeletor ano={ano} mes={mes} onChange={(a, m) => setVista(new Date(a, m, 1))} />
          <button type="button" className={navBtn} title="Próximo mês" onClick={() => setVista(new Date(ano, mes + 1, 1))}><ChevronRight size={17} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {DIAS_SEMANA.map((d, i) => <span key={i} className="text-[11px] font-bold text-slate-400 py-0.5">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {dias.map(d => {
            const dIso = isoDe(d);
            const selecionado = dIso === iso;
            const doMes = d.getMonth() === mes;
            return (
              <button key={dIso} type="button" disabled={foraDoLimite(dIso)} onClick={() => escolher(dIso)}
                className={`h-8 w-8 mx-auto rounded-lg text-xs font-semibold flex items-center justify-center transition cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed ${
                  selecionado ? 'bg-[#0a2540] text-white font-bold shadow-xs hover:bg-[#06182c]'
                    : dIso === hoje ? 'border border-sky-400 text-sky-600 hover:bg-sky-50 font-bold'
                      : doMes ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-50'}`}>
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-xs">
          <button type="button" onClick={() => escolher(null)}
            className="text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">Limpar</button>
          <button type="button" disabled={foraDoLimite(hoje)} onClick={() => escolher(hoje)}
            className="text-[#0a2540] hover:text-[#06182c] font-bold px-2 py-1 rounded-lg hover:bg-[#0a2540]/10 transition cursor-pointer disabled:opacity-30">Hoje</button>
        </div>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------------------
// Campo de horário: digitação com máscara hh:mm + lista de horas e minutos do sistema
export function TimePicker({ value, onChange, disabled, invalid, className = '', passoMinutos = 5, 'aria-label': ariaLabel }: {
  value?: string | null; onChange: (hora: string | null) => void; disabled?: boolean; invalid?: boolean; className?: string;
  passoMinutos?: number; 'aria-label'?: string;
}) {
  const hora = String(value || '').slice(0, 5);
  const [texto, setTexto] = useState(hora);
  const [aberto, setAberto] = useState(false);
  const ancora = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const colHoras = useRef<HTMLDivElement>(null);
  const colMinutos = useRef<HTMLDivElement>(null);

  useEffect(() => setTexto(hora), [hora]);

  const [hh, mm] = horaValida(hora) ? hora.split(':') : ['', ''];
  const horas = Array.from({ length: 24 }, (_, i) => pad(i));
  const passos = Array.from({ length: Math.ceil(60 / passoMinutos) }, (_, i) => pad(i * passoMinutos));
  // Minuto digitado fora do passo (ex.: 10:07) também aparece na lista
  const minutos = mm && !passos.includes(mm) ? [...passos, mm].sort() : passos;

  // Ao abrir, rola as colunas até a hora/minuto escolhidos
  useEffect(() => {
    if (!aberto) return;
    const id = requestAnimationFrame(() => {
      for (const col of [colHoras.current, colMinutos.current]) {
        const sel = col?.querySelector<HTMLElement>('[data-selecionado="true"]');
        if (col && sel) col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.offsetHeight / 2;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [aberto]);

  const fechar = useCallback(() => setAberto(false), []);
  const definir = (h: string, m: string, fecharDepois: boolean) => {
    const novo = `${h}:${m}`;
    onChange(novo);
    setTexto(novo);
    if (fecharDepois) { setAberto(false); inputRef.current?.focus(); }
  };
  const item = (ativo: boolean) => `w-full h-8 rounded-lg text-xs font-semibold transition cursor-pointer ${ativo ? 'bg-[#0a2540] text-white font-bold hover:bg-[#06182c]' : 'text-slate-700 hover:bg-slate-100'}`;

  return (
    <>
      <div ref={ancora} aria-invalid={invalid}
        className={`${className} flex items-center gap-1 !py-0 ${disabled ? '!bg-slate-100 text-slate-500' : ''} focus-within:ring-2 focus-within:ring-[#0a2540]`}>
        <input ref={inputRef} type="text" inputMode="numeric" disabled={disabled} aria-label={ariaLabel} placeholder="hh:mm"
          value={texto}
          onChange={e => {
            const t = mascaraHora(e.target.value);
            setTexto(t);
            if (horaValida(t)) onChange(t);
            else if (!t) onChange(null);
          }}
          onBlur={() => { if (texto && !horaValida(texto)) setTexto(hora); }}
          onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); if (!disabled) setAberto(true); } }}
          className="flex-1 min-w-0 py-2 bg-transparent outline-none placeholder:text-slate-400 disabled:cursor-not-allowed" />
        <button type="button" disabled={disabled} onClick={() => setAberto(o => !o)} title="Escolher horário" aria-expanded={aberto}
          className={`-mr-1 p-1.5 rounded-md transition ${disabled ? 'text-slate-300 cursor-not-allowed' : hora ? 'text-[#0a2540] hover:bg-slate-100 cursor-pointer' : 'text-slate-400 hover:text-[#0a2540] hover:bg-slate-100 cursor-pointer'}`}>
          <Clock size={17} />
        </button>
      </div>

      <Popover anchor={ancora} open={aberto} onClose={fechar} width={208}>
        <div className="grid grid-cols-2 gap-2 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hora</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Minuto</span>
          <div ref={colHoras} className="relative h-56 overflow-y-auto space-y-0.5 pr-1">
            {horas.map(h => (
              <button key={h} type="button" data-selecionado={h === hh} onClick={() => definir(h, mm || '00', !!mm)} className={item(h === hh)}>{h}</button>
            ))}
          </div>
          <div ref={colMinutos} className="relative h-56 overflow-y-auto space-y-0.5 pr-1">
            {minutos.map(m => (
              <button key={m} type="button" data-selecionado={m === mm} onClick={() => definir(hh || pad(new Date().getHours()), m, true)} className={item(m === mm)}>{m}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-xs">
          <button type="button" onClick={() => { onChange(null); setTexto(''); setAberto(false); }}
            className="text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">Limpar</button>
          <button type="button" onClick={() => { const d = new Date(); definir(pad(d.getHours()), pad(d.getMinutes()), true); }}
            className="text-[#0a2540] hover:text-[#06182c] font-bold px-2 py-1 rounded-lg hover:bg-[#0a2540]/10 transition cursor-pointer">Agora</button>
        </div>
      </Popover>
    </>
  );
}
