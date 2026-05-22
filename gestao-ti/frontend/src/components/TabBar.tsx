import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import type { ComponentType } from 'react';
import { ChevronDown } from 'lucide-react';

export interface TabBarItem {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

interface TabBarProps {
  tabs: TabBarItem[];
  active: string;
  onChange: (key: string) => void;
  /** Classe do estado ativo (underline tab) — ex.: 'border-capul-600 text-capul-600'. */
  activeClassName?: string;
  /** Classe extra do contêiner externo (ex.: 'mb-4'). */
  className?: string;
}

const TAB_CLASS =
  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap flex-shrink-0';
const INACTIVE_CLASS = 'border-transparent text-slate-500 hover:text-slate-700';
const GAP_PX = 4; // corresponde ao gap-1 da barra

/**
 * Barra de abas com menu "Mais" para overflow.
 *
 * As abas que não couberem na largura disponível são recolhidas para um menu
 * suspenso, em vez de sumirem cortadas. Incidente 22/05: na tela de Projeto,
 * com zoom alto, as últimas abas ficavam inacessíveis — a barra era rolável
 * mas com a scrollbar oculta, sem nenhuma pista visual de que havia mais.
 *
 * Mede as larguras numa camada espelho invisível (sempre com TODAS as abas em
 * tamanho natural) e recalcula via ResizeObserver — cobre redimensionamento de
 * janela E zoom do navegador (zoom encolhe o clientWidth medido em px CSS).
 */
export function TabBar({
  tabs,
  active,
  onChange,
  activeClassName = 'border-capul-600 text-capul-600',
  className = '',
}: TabBarProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const measureTabRefs = useRef<(HTMLDivElement | null)[]>([]);
  const measureMoreRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tabs.length);
  const [menuOpen, setMenuOpen] = useState(false);

  // Assinatura estável do conjunto de abas — dispara recálculo só quando o
  // conjunto muda (o array `tabs` é recriado a cada render no chamador).
  const tabsSig = tabs.map((t) => `${t.key}:${t.label}`).join('|');

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    // `recalc` lê tabs.length pelo closure. O efeito re-roda sempre que tabsSig
    // muda, então o closure tem a contagem correta — e a medição é limitada a
    // `count` (ignora refs obsoletas de abas removidas).
    const recalc = () => {
      const avail = bar.clientWidth;
      const count = tabs.length;
      if (count === 0 || avail === 0) return;
      const widths = Array.from(
        { length: count },
        (_, i) => measureTabRefs.current[i]?.offsetWidth ?? 0,
      );
      const moreW = measureMoreRef.current?.offsetWidth ?? 0;

      const totalAll = widths.reduce((a, b) => a + b, 0) + GAP_PX * Math.max(0, count - 1);
      if (totalAll <= avail) {
        setVisibleCount(count);
        return;
      }
      // Não cabe tudo: reserva espaço para o botão "Mais" e conta quantas cabem.
      let acc = 0;
      let fit = 0;
      for (let i = 0; i < count; i++) {
        const add = widths[i] + (i > 0 ? GAP_PX : 0);
        if (acc + add + GAP_PX + moreW <= avail) {
          acc += add;
          fit++;
        } else break;
      }
      setVisibleCount(Math.max(1, fit));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(bar);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tabsSig cobre `tabs`
  }, [tabsSig]);

  // Fecha o menu ao clicar fora ou pressionar Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const safeVisible = Math.min(visibleCount, tabs.length);
  const visibleTabs = tabs.slice(0, safeVisible);
  const hiddenTabs = tabs.slice(safeVisible);
  const hasOverflow = hiddenTabs.length > 0;
  const activeHidden = hiddenTabs.some((t) => t.key === active);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {/* Camada espelho para medição: invisível, fora de fluxo, sempre com
          TODAS as abas em tamanho natural. */}
      <div aria-hidden className="absolute left-0 top-0 flex gap-1 invisible pointer-events-none">
        {tabs.map((t, i) => {
          const Icon = t.icon;
          return (
            <div
              key={t.key}
              ref={(el) => {
                measureTabRefs.current[i] = el;
              }}
              className={TAB_CLASS}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {t.label}
            </div>
          );
        })}
        <div ref={measureMoreRef} className={TAB_CLASS}>
          Mais
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {/* Barra visível */}
      <div ref={barRef} className="flex gap-1 border-b border-slate-200 overflow-hidden">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={`${TAB_CLASS} ${isActive ? activeClassName : INACTIVE_CLASS}`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {t.label}
            </button>
          );
        })}
        {hasOverflow && (
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`${TAB_CLASS} ${activeHidden ? activeClassName : INACTIVE_CLASS}`}
          >
            Mais
            <ChevronDown
              className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Menu suspenso das abas que não couberam */}
      {menuOpen && hasOverflow && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 min-w-[12rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {hiddenTabs.map((t) => {
            const Icon = t.icon;
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(t.key);
                  setMenuOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-100 font-semibold text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
