import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCampoDeBusca } from './DataTable';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function isoToBr(iso: string): string {
  if (!iso) return '';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return '';
}

function brToIso(br: string): string {
  const clean = br.replace(/\D/g, '');
  if (clean.length !== 8) return '';
  const day = parseInt(clean.slice(0, 2), 10);
  const month = parseInt(clean.slice(2, 4), 10);
  const year = parseInt(clean.slice(4, 8), 10);

  if (year < 1900 || year > 2100) return '';
  if (month < 1 || month > 12) return '';
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return '';

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function maskBrDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function buildCalendarDays(year: number, month: number) {
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: { day: number; isCurrentMonth: boolean; iso: string }[] = [];

  // Dias do mês anterior
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevM = month === 0 ? 12 : month;
    const prevY = month === 0 ? year - 1 : year;
    const iso = `${prevY}-${String(prevM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    days.push({ day, isCurrentMonth: false, iso });
  }

  // Dias do mês atual
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    days.push({ day, isCurrentMonth: true, iso });
  }

  // Dias do próximo mês para fechar semanas completas (múltiplo de 7)
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let day = 1; day <= remaining; day++) {
      const nextM = month === 11 ? 1 : month + 2;
      const nextY = month === 11 ? year + 1 : year;
      const iso = `${nextY}-${String(nextM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, isCurrentMonth: false, iso });
    }
  }

  return days;
}

// ==========================================
// FILTRO POR PERÍODO DE DATAS (DATE RANGE)
// ==========================================
export interface DateRangeFilterProps {
  dataInicio: string;
  dataFim: string;
  onChangeInicio: (val: string) => void;
  onChangeFim: (val: string) => void;
  labelInicio?: string;
  labelFim?: string;
  className?: string;
}

export function DateRangeFilter({
  dataInicio,
  dataFim,
  onChangeInicio,
  onChangeFim,
  labelInicio = 'Data inicial',
  labelFim = 'Data final',
  className = '',
}: DateRangeFilterProps) {
  const { valor: valorInicio, mudar: mudarInicio } = useCampoDeBusca(dataInicio, onChangeInicio);
  const { valor: valorFim, mudar: mudarFim } = useCampoDeBusca(dataFim, onChangeFim);

  const [textInicio, setTextInicio] = useState(() => isoToBr(valorInicio));
  const [textFim, setTextFim] = useState(() => isoToBr(valorFim));

  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState<'inicio' | 'fim'>('inicio');
  const [placement, setPlacement] = useState<'center' | 'right' | 'left'>('center');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputInicioRef = useRef<HTMLInputElement>(null);
  const inputFimRef = useRef<HTMLInputElement>(null);

  // Sincroniza o texto digitado quando os valores mudam
  useEffect(() => {
    setTextInicio(isoToBr(valorInicio));
  }, [valorInicio]);

  useEffect(() => {
    setTextFim(isoToBr(valorFim));
  }, [valorFim]);

  // Mês e ano em exibição no modal
  const [viewDate, setViewDate] = useState(() => {
    const val = valorInicio || valorFim;
    if (val) {
      const [y, m] = val.split('-').map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  const openCalendar = (field: 'inicio' | 'fim') => {
    setActiveField(field);
    const val = field === 'inicio' ? valorInicio : (valorFim || valorInicio);
    if (val) {
      const [y, m] = val.split('-').map(Number);
      if (y && m) setViewDate(new Date(y, m - 1, 1));
    } else {
      setViewDate(new Date());
    }
    setOpen(true);
  };

  const toggleCalendar = (field: 'inicio' | 'fim') => {
    if (open && activeField === field) {
      setOpen(false);
    } else {
      openCalendar(field);
    }
  };

  // Posicionamento inteligente: centralizado entre os dois campos por padrão,
  // ajustando para a esquerda/direita se o limite do container ou tela for atingido
  useEffect(() => {
    if (!open) return;

    const calculatePlacement = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const popupWidth = 284;
      const centerX = rect.left + rect.width / 2;

      // Limites horizontais de segurança (Card delimitador ou janela)
      const parentCard = containerRef.current.closest('.card, .overflow-hidden, .rounded-xl, .no-print');
      const rightLimit = parentCard
        ? Math.min(parentCard.getBoundingClientRect().right - 14, window.innerWidth - 12)
        : window.innerWidth - 12;
      const leftLimit = parentCard
        ? Math.max(parentCard.getBoundingClientRect().left + 14, 12)
        : 12;

      if (centerX + popupWidth / 2 > rightLimit) {
        // Se ultrapassar a margem direita, alinha à direita do componente (deslocando para a esquerda)
        setPlacement('right');
      } else if (centerX - popupWidth / 2 < leftLimit) {
        setPlacement('left');
      } else {
        setPlacement('center');
      }
    };

    calculatePlacement();
    window.addEventListener('resize', calculatePlacement);
    return () => window.removeEventListener('resize', calculatePlacement);
  }, [open]);

  // Fechar ao clicar fora ou tecla Escape
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: globalThis.MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        if (activeField === 'inicio') {
          inputInicioRef.current?.focus();
        } else {
          inputFimRef.current?.focus();
        }
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, activeField]);

  // Manipulação de inputs de texto (digitação manual)
  const handleInputInicioChange = (e: ChangeEvent<HTMLInputElement>) => {
    const masked = maskBrDate(e.target.value);
    setTextInicio(masked);
    const iso = brToIso(masked);
    if (iso) {
      mudarInicio(iso);
      if (valorFim && iso > valorFim) {
        mudarFim('');
        setTextFim('');
      }
    } else if (masked === '') {
      mudarInicio('');
    }
  };

  const handleInputInicioBlur = () => {
    const iso = brToIso(textInicio);
    if (!iso) {
      if (textInicio.trim() === '') {
        mudarInicio('');
      } else {
        setTextInicio(isoToBr(valorInicio));
      }
    }
  };

  const handleInputFimChange = (e: ChangeEvent<HTMLInputElement>) => {
    const masked = maskBrDate(e.target.value);
    setTextFim(masked);
    const iso = brToIso(masked);
    if (iso) {
      if (valorInicio && iso < valorInicio) {
        mudarInicio(iso);
        setTextInicio(isoToBr(iso));
      } else {
        mudarFim(iso);
      }
    } else if (masked === '') {
      mudarFim('');
    }
  };

  const handleInputFimBlur = () => {
    const iso = brToIso(textFim);
    if (!iso) {
      if (textFim.trim() === '') {
        mudarFim('');
      } else {
        setTextFim(isoToBr(valorFim));
      }
    }
  };

  // Seleção de data ao clicar em um dia do calendário
  const handleSelectDate = (dateIso: string) => {
    if (activeField === 'inicio') {
      mudarInicio(dateIso);
      setTextInicio(isoToBr(dateIso));
      if (valorFim && dateIso > valorFim) {
        mudarFim('');
        setTextFim('');
      }
      // Se a data final ainda não estiver preenchida, alterna o foco para a data final
      if (!valorFim) {
        setActiveField('fim');
      }
    } else {
      if (valorInicio && dateIso < valorInicio) {
        mudarInicio(dateIso);
        setTextInicio(isoToBr(dateIso));
      } else {
        mudarFim(dateIso);
        setTextFim(isoToBr(dateIso));
      }
    }
  };

  const handleClearAll = () => {
    mudarInicio('');
    setTextInicio('');
    mudarFim('');
    setTextFim('');
    setOpen(false);
  };

  const handleToday = () => {
    const hoje = new Date();
    const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    handleSelectDate(iso);
  };

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  const prevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

  const calendarDays = buildCalendarDays(currentYear, currentMonth);
  const baseYear = new Date().getFullYear();
  const anosDisponiveis = Array.from({ length: 15 }, (_, i) => baseYear - 7 + i);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const ativoInicio = Boolean(valorInicio);
  const ativoFim = Boolean(valorFim);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex flex-wrap items-center gap-1.5 w-full sm:w-auto ${className}`}
    >
      {/* 1. Campo Data Inicial */}
      <div
        className={`h-11 flex items-center border rounded-xl bg-white transition shadow-xs focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-500/10 ${
          ativoInicio
            ? 'border-[#0a2540]/30 bg-[#0a2540]/5 text-[#0a2540]'
            : 'border-slate-200 text-slate-700'
        }`}
      >
        <input
          ref={inputInicioRef}
          type="text"
          inputMode="numeric"
          placeholder={labelInicio}
          title={labelInicio}
          value={textInicio}
          onChange={handleInputInicioChange}
          onBlur={handleInputInicioBlur}
          className={`h-full w-full sm:w-28 md:w-32 pl-3.5 pr-1 bg-transparent text-sm outline-none placeholder:text-slate-400 font-medium ${
            ativoInicio ? 'text-[#0a2540]' : 'text-slate-700'
          }`}
        />

        {ativoInicio && (
          <button
            type="button"
            onClick={() => {
              mudarInicio('');
              setTextInicio('');
            }}
            title="Limpar data inicial"
            className="p-1 mr-0.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={14} />
          </button>
        )}

        <button
          type="button"
          onClick={() => toggleCalendar('inicio')}
          title="Abrir calendário para data inicial"
          className="h-full px-2.5 flex items-center justify-center text-slate-400 hover:text-[#0a2540] hover:bg-slate-50/80 rounded-r-xl transition cursor-pointer"
          aria-expanded={open && activeField === 'inicio'}
        >
          <Calendar
            size={17}
            className={ativoInicio || (open && activeField === 'inicio') ? 'text-[#0a2540]' : 'text-slate-400'}
          />
        </button>
      </div>

      {/* Separador "até" */}
      <span className="text-xs text-slate-400 font-medium select-none px-0.5">até</span>

      {/* 2. Campo Data Final */}
      <div
        className={`h-11 flex items-center border rounded-xl bg-white transition shadow-xs focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-500/10 ${
          ativoFim
            ? 'border-[#0a2540]/30 bg-[#0a2540]/5 text-[#0a2540]'
            : 'border-slate-200 text-slate-700'
        }`}
      >
        <input
          ref={inputFimRef}
          type="text"
          inputMode="numeric"
          placeholder={labelFim}
          title={labelFim}
          value={textFim}
          onChange={handleInputFimChange}
          onBlur={handleInputFimBlur}
          className={`h-full w-full sm:w-28 md:w-32 pl-3.5 pr-1 bg-transparent text-sm outline-none placeholder:text-slate-400 font-medium ${
            ativoFim ? 'text-[#0a2540]' : 'text-slate-700'
          }`}
        />

        {ativoFim && (
          <button
            type="button"
            onClick={() => {
              mudarFim('');
              setTextFim('');
            }}
            title="Limpar data final"
            className="p-1 mr-0.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={14} />
          </button>
        )}

        <button
          type="button"
          onClick={() => toggleCalendar('fim')}
          title="Abrir calendário para data final"
          className="h-full px-2.5 flex items-center justify-center text-slate-400 hover:text-[#0a2540] hover:bg-slate-50/80 rounded-r-xl transition cursor-pointer"
          aria-expanded={open && activeField === 'fim'}
        >
          <Calendar
            size={17}
            className={ativoFim || (open && activeField === 'fim') ? 'text-[#0a2540]' : 'text-slate-400'}
          />
        </button>
      </div>

      {/* Modal / Popover do Calendário Compartilhado */}
      {open && (
        <div
          className={`absolute top-full mt-2 z-50 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 select-none ${
            placement === 'center'
              ? 'left-1/2 -translate-x-1/2'
              : placement === 'right'
              ? 'right-0 left-auto translate-x-0'
              : 'left-0 right-auto translate-x-0'
          }`}
        >
          {/* Seletor do Campo Ativo (Início ou Fim) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl mb-3 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveField('inicio');
                if (valorInicio) {
                  const [y, m] = valorInicio.split('-').map(Number);
                  if (y && m) setViewDate(new Date(y, m - 1, 1));
                }
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-center transition cursor-pointer flex items-center justify-center gap-1 ${
                activeField === 'inicio'
                  ? 'bg-[#0a2540] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider opacity-75">Início:</span>
              <span className="truncate">{isoToBr(valorInicio) || 'Definir'}</span>
            </button>

            <span className="text-slate-400 font-bold text-xs select-none">→</span>

            <button
              type="button"
              onClick={() => {
                setActiveField('fim');
                if (valorFim) {
                  const [y, m] = valorFim.split('-').map(Number);
                  if (y && m) setViewDate(new Date(y, m - 1, 1));
                }
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-center transition cursor-pointer flex items-center justify-center gap-1 ${
                activeField === 'fim'
                  ? 'bg-[#0a2540] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider opacity-75">Fim:</span>
              <span className="truncate">{isoToBr(valorFim) || 'Definir'}</span>
            </button>
          </div>

          {/* Cabeçalho do mês e controles */}
          <div className="flex items-center justify-between gap-1 mb-2.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft size={17} />
            </button>

            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <select
                value={currentMonth}
                onChange={e => setViewDate(new Date(currentYear, Number(e.target.value), 1))}
                className="bg-transparent font-bold cursor-pointer outline-none hover:text-sky-600 text-slate-800 py-0.5"
              >
                {MESES.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={e => setViewDate(new Date(Number(e.target.value), currentMonth, 1))}
                className="bg-transparent font-bold cursor-pointer outline-none hover:text-sky-600 text-slate-800 py-0.5"
              >
                {anosDisponiveis.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DIAS_SEMANA.map((d, i) => (
              <span key={i} className="text-[11px] font-bold text-slate-400 py-0.5">
                {d}
              </span>
            ))}
          </div>

          {/* Grade de dias */}
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {calendarDays.map((cDay, idx) => {
              const isStart = cDay.iso === valorInicio;
              const isEnd = cDay.iso === valorFim;
              const isSelected = isStart || isEnd;
              const isInRange = Boolean(valorInicio && valorFim && cDay.iso > valorInicio && cDay.iso < valorFim);
              const isToday = cDay.iso === todayStr;

              return (
                <div
                  key={idx}
                  className={`relative flex items-center justify-center py-0.5 ${
                    isInRange ? 'bg-sky-50' : ''
                  } ${isStart && valorFim ? 'rounded-l-lg bg-sky-50' : ''} ${
                    isEnd && valorInicio ? 'rounded-r-lg bg-sky-50' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectDate(cDay.iso)}
                    className={`h-8 w-8 rounded-lg text-xs font-semibold flex items-center justify-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#0a2540] text-white font-bold shadow-xs hover:bg-[#06182c]'
                        : isInRange
                        ? 'text-[#0a2540] font-bold hover:bg-sky-200/70'
                        : isToday
                        ? 'border border-sky-400 text-sky-600 hover:bg-sky-50 font-bold'
                        : cDay.isCurrentMonth
                        ? 'text-slate-700 hover:bg-slate-100'
                        : 'text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {cDay.day}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Rodapé com botões de ação rápida */}
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={handleClearAll}
              className="text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Limpar
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToday}
                className="text-slate-600 hover:text-[#0a2540] font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-[#0a2540] hover:bg-[#06182c] text-white font-bold px-3 py-1 rounded-lg transition shadow-xs cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// CAMPO DE DATA INDIVIDUAL (DATE INPUT)
// ==========================================
export interface DateInputProps {
  value: string; // ISO 'YYYY-MM-DD' ou vazio
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  minDate?: string;
  maxDate?: string;
  id?: string;
  title?: string;
}

export function DateInput({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  className = '',
  minDate,
  maxDate,
  id,
  title,
}: DateInputProps) {
  const { valor, mudar } = useCampoDeBusca(value, onChange);

  const [text, setText] = useState(() => isoToBr(valor));
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);

  useEffect(() => {
    setText(isoToBr(valor));
  }, [valor]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [viewDate, setViewDate] = useState(() => {
    if (valor) {
      const [y, m] = valor.split('-').map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  useEffect(() => {
    if (open) {
      if (valor) {
        const [y, m] = valor.split('-').map(Number);
        if (y && m) setViewDate(new Date(y, m - 1, 1));
      } else {
        setViewDate(new Date());
      }

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const parentCard = containerRef.current.closest('.card, .overflow-hidden, .rounded-xl, .no-print');
        const rightLimit = parentCard
          ? Math.min(parentCard.getBoundingClientRect().right - 14, window.innerWidth - 12)
          : window.innerWidth - 12;
        setAlignRight(rect.left + 288 > rightLimit);
      }
    }
  }, [open, valor]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: globalThis.MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const masked = maskBrDate(raw);
    setText(masked);

    const iso = brToIso(masked);
    if (iso) {
      mudar(iso);
    } else if (masked === '') {
      mudar('');
    }
  };

  const handleInputBlur = () => {
    const iso = brToIso(text);
    if (!iso) {
      if (text.trim() === '') {
        mudar('');
      } else {
        setText(isoToBr(valor));
      }
    }
  };

  const handleSelectDate = (dateIso: string) => {
    mudar(dateIso);
    setText(isoToBr(dateIso));
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    mudar('');
    setText('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleToday = () => {
    const hoje = new Date();
    const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    handleSelectDate(iso);
  };

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  const prevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

  const calendarDays = buildCalendarDays(currentYear, currentMonth);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const ativo = Boolean(valor);
  const baseYear = new Date().getFullYear();
  const anosDisponiveis = Array.from({ length: 15 }, (_, i) => baseYear - 7 + i);

  return (
    <div ref={containerRef} className={`relative inline-block w-full sm:w-auto ${className}`}>
      <div
        className={`h-11 flex items-center border rounded-xl bg-white transition shadow-xs focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-500/10 ${
          ativo
            ? 'border-[#0a2540]/30 bg-[#0a2540]/5 text-[#0a2540]'
            : 'border-slate-200 text-slate-700'
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          title={title || placeholder}
          placeholder={placeholder}
          value={text}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          className={`h-full w-full sm:w-32 pl-3.5 pr-1 bg-transparent text-sm outline-none placeholder:text-slate-400 font-medium ${
            ativo ? 'text-[#0a2540]' : 'text-slate-700'
          }`}
        />

        {ativo && (
          <button
            type="button"
            onClick={handleClear}
            title="Limpar data"
            className="p-1 mr-0.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={14} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setOpen(!open)}
          title="Abrir calendário"
          className="h-full px-2.5 flex items-center justify-center text-slate-400 hover:text-[#0a2540] hover:bg-slate-50/80 rounded-r-xl transition cursor-pointer"
          aria-expanded={open}
        >
          <Calendar size={17} className={ativo ? 'text-[#0a2540]' : 'text-slate-400'} />
        </button>
      </div>

      {open && (
        <div
          className={`absolute top-full mt-2 z-50 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 select-none ${
            alignRight ? 'right-0 left-auto' : 'left-0 right-auto'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-2.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft size={17} />
            </button>

            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <select
                value={currentMonth}
                onChange={e => setViewDate(new Date(currentYear, Number(e.target.value), 1))}
                className="bg-transparent font-bold cursor-pointer outline-none hover:text-sky-600 text-slate-800 py-0.5"
              >
                {MESES.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={e => setViewDate(new Date(Number(e.target.value), currentMonth, 1))}
                className="bg-transparent font-bold cursor-pointer outline-none hover:text-sky-600 text-slate-800 py-0.5"
              >
                {anosDisponiveis.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DIAS_SEMANA.map((d, i) => (
              <span key={i} className="text-[11px] font-bold text-slate-400 py-0.5">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((cDay, idx) => {
              const isSelected = cDay.iso === valor;
              const isToday = cDay.iso === todayStr;
              const isOutOfRange = Boolean(
                (minDate && cDay.iso < minDate) ||
                (maxDate && cDay.iso > maxDate)
              );

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isOutOfRange}
                  onClick={() => handleSelectDate(cDay.iso)}
                  className={`h-8 w-8 mx-auto rounded-lg text-xs font-semibold flex items-center justify-center transition cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-[#0a2540] text-white font-bold shadow-xs hover:bg-[#06182c]'
                      : isToday
                      ? 'border border-sky-400 text-sky-600 hover:bg-sky-50 font-bold'
                      : cDay.isCurrentMonth
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {cDay.day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-[#0a2540] hover:text-[#06182c] font-bold px-2 py-1 rounded-lg hover:bg-[#0a2540]/10 transition cursor-pointer"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
