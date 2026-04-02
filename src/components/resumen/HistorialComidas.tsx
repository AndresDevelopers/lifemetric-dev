/* eslint-disable @next/next/no-img-element */
'use client';

import { getResumenMealHistory } from '@/actions/comida';
import { useLocale } from '@/components/providers/LocaleProvider';
import {
  buildMealHistoryFingerprint,
  pickLatestMealHistoryDate,
  resolveMealHistoryFilterDate,
  type MealHistoryEntry,
} from '@/lib/mealHistory';
import {
  isFoodClassificationInadequate,
  translateFoodClassification,
  translateMealType,
} from '@/lib/i18n';
import { createPortal } from 'react-dom';
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';

const MEAL_HISTORY_REFRESH_MS = 15_000;

function getTodayStr() {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, '0');
  const day = String(today.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthYearFromDateKey(dateKey: string | null) {
  if (!dateKey) {
    const today = new Date();
    return {
      month: today.getMonth(),
      year: today.getFullYear(),
    };
  }

  const referenceDate = new Date(`${dateKey}T00:00:00Z`);
  return {
    month: referenceDate.getUTCMonth(),
    year: referenceDate.getUTCFullYear(),
  };
}

export default function HistorialComidas({
  initialComidas,
}: {
  readonly initialComidas: readonly MealHistoryEntry[];
}) {
  const { locale, messages } = useLocale();
  const historyMessages = messages.foodHistory;

  const initialLatestDate = pickLatestMealHistoryDate(initialComidas);
  const initialViewDate = getMonthYearFromDateKey(initialLatestDate);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const [comidas, setComidas] = useState<readonly MealHistoryEntry[]>(initialComidas);
  const [filterDate, setFilterDate] = useState<string | null>(initialLatestDate);
  const [viewMonth, setViewMonth] = useState<number>(initialViewDate.month);
  const [viewYear, setViewYear] = useState<number>(initialViewDate.year);

  const scrollRef = useRef<HTMLDivElement>(null);
  const comidasRef = useRef<readonly MealHistoryEntry[]>(initialComidas);
  const filterDateRef = useRef<string | null>(initialLatestDate);
  const historyFingerprintRef = useRef(buildMealHistoryFingerprint(initialComidas));

  useEffect(() => {
    comidasRef.current = comidas;
    historyFingerprintRef.current = buildMealHistoryFingerprint(comidas);
  }, [comidas]);

  useEffect(() => {
    filterDateRef.current = filterDate;
  }, [filterDate]);

  useEffect(() => {
    if (selectedImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedImage]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('[data-tooltip-root="true"]')) {
        setActiveTooltipId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const previousLatestDate = pickLatestMealHistoryDate(comidasRef.current);
    const nextFilterDate = resolveMealHistoryFilterDate(
      filterDateRef.current,
      previousLatestDate,
      initialComidas,
    );

    setComidas(initialComidas);
    setFilterDate(nextFilterDate);

    if (nextFilterDate) {
      const nextViewDate = getMonthYearFromDateKey(nextFilterDate);
      setViewMonth(nextViewDate.month);
      setViewYear(nextViewDate.year);
    }
  }, [initialComidas]);

  const syncMealHistory = useEffectEvent(async () => {
    if (document.visibilityState === 'hidden') {
      return;
    }

    try {
      const nextComidas = await getResumenMealHistory();
      const nextFingerprint = buildMealHistoryFingerprint(nextComidas);
      if (nextFingerprint === historyFingerprintRef.current) {
        return;
      }

      const previousLatestDate = pickLatestMealHistoryDate(comidasRef.current);
      const nextFilterDate = resolveMealHistoryFilterDate(
        filterDateRef.current,
        previousLatestDate,
        nextComidas,
      );

      historyFingerprintRef.current = nextFingerprint;

      startTransition(() => {
        setComidas(nextComidas);
        setFilterDate(nextFilterDate);

        if (nextFilterDate) {
          const nextViewDate = getMonthYearFromDateKey(nextFilterDate);
          setViewMonth(nextViewDate.month);
          setViewYear(nextViewDate.year);
        }
      });
    } catch {
      // El historial no debe romper la vista si la resincronizacion falla.
    }
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void syncMealHistory();
    }, MEAL_HISTORY_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncMealHistory();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector('[data-active="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [filterDate]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();

    for (const comida of comidas) {
      years.add(Number(comida.fecha.slice(0, 4)));
    }

    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [comidas]);

  const availableMonths = useMemo(() => {
    const months = [];
    const localeName = locale === 'es' ? 'es-ES' : 'en-US';

    for (let i = 0; i < 12; i++) {
      const date = new Date(Date.UTC(2000, i, 1));
      months.push({
        value: i,
        label: date.toLocaleDateString(localeName, { month: 'long', timeZone: 'UTC' }),
      });
    }

    return months;
  }, [locale]);

  const datesWithData = useMemo(() => {
    const dates = new Set<string>();
    for (const comida of comidas) {
      dates.add(comida.fecha);
    }
    return dates;
  }, [comidas]);

  const monthDays = useMemo(() => {
    const days = [];
    const localeName = locale === 'es' ? 'es-ES' : 'en-US';
    const date = new Date(Date.UTC(viewYear, viewMonth + 1, 0));
    const numDays = date.getUTCDate();

    for (let i = 1; i <= numDays; i++) {
      const dayDate = new Date(Date.UTC(viewYear, viewMonth, i));
      const year = dayDate.getUTCFullYear();
      const month = String(dayDate.getUTCMonth() + 1).padStart(2, '0');
      const dayNumber = String(dayDate.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayNumber}`;

      days.push({
        dateStr,
        dayName: dayDate.toLocaleDateString(localeName, { weekday: 'short', timeZone: 'UTC' }),
        dayNumber: dayDate.getUTCDate(),
        hasData: datesWithData.has(dateStr),
        isToday: dateStr === getTodayStr(),
      });
    }

    return days;
  }, [datesWithData, locale, viewMonth, viewYear]);

  const filteredComidas = useMemo(() => {
    if (!filterDate) {
      return [];
    }

    return comidas.filter((comida) => comida.fecha === filterDate);
  }, [comidas, filterDate]);

  const getIcon = (tipo: string) => {
    const normalizedType = (tipo || '').toLowerCase();
    if (normalizedType.includes('desayuno')) return 'wb_sunny';
    if (normalizedType.includes('almuerzo')) return 'lunch_dining';
    if (normalizedType.includes('cena')) return 'dark_mode';
    if (normalizedType.includes('snack') || normalizedType.includes('merienda')) return 'rebase';
    return 'restaurant_menu';
  };

  const getColorClass = (tipo: string) => {
    const normalizedType = (tipo || '').toLowerCase();
    if (normalizedType.includes('desayuno')) return 'bg-orange-100 text-orange-600 border-orange-200';
    if (normalizedType.includes('almuerzo')) return 'bg-blue-100 text-blue-600 border-blue-200';
    if (normalizedType.includes('cena')) return 'bg-indigo-100 text-indigo-600 border-indigo-200';
    return 'bg-emerald-100 text-emerald-600 border-emerald-200';
  };

  const getAccentClass = (tipo: string) => {
    const normalizedType = (tipo || '').toLowerCase();
    if (normalizedType.includes('desayuno')) return 'bg-orange-500';
    if (normalizedType.includes('almuerzo')) return 'bg-blue-500';
    if (normalizedType.includes('cena')) return 'bg-indigo-500';
    return 'bg-emerald-500';
  };

  const getMealInsight = (comida: MealHistoryEntry) => {
    const kcal = comida.kcal_estimadas ?? 0;
    const classification = (comida.clasificacion_final ?? '').toLowerCase();

    if (classification.includes('pico') || classification.includes('malo') || classification.includes('pobre')) {
      return {
        tone: 'text-rose-900 bg-rose-50 border-rose-200',
        text:
          locale === 'es'
            ? 'Podria elevar glucosa o inflamacion. Prioriza proteina magra, fibra y menos harinas refinadas.'
            : 'This may raise glucose/inflammation. Prioritize lean protein, fiber, and fewer refined carbs.',
      };
    }

    if (kcal > 0 && kcal < 320) {
      return {
        tone: 'text-emerald-900 bg-emerald-50 border-emerald-200',
        text:
          locale === 'es'
            ? 'Buena densidad metabolica: ligera y con potencial de saciedad. Puedes sumar grasa saludable si hay hambre temprana.'
            : 'Good metabolic density: light with satiety potential. Add healthy fat if hunger appears early.',
      };
    }

    return {
      tone: 'text-slate-800 bg-slate-50 border-slate-200',
      text: historyMessages.mealInsightBody,
    };
  };

  const getDateButtonClass = (dayDateStr: string, hasData: boolean) => {
    if (filterDate === dayDateStr) {
      return 'bg-primary text-white shadow-xl shadow-primary/25 scale-105 z-10';
    }
    if (hasData) {
      return 'bg-white text-slate-600 border border-slate-100 hover:border-primary/30 hover:bg-primary/5 active:scale-95';
    }
    return 'bg-slate-50 text-slate-300 border border-transparent opacity-40 cursor-not-allowed grayscale';
  };

  const renderLightbox = () => {
    if (!selectedImage || typeof document === 'undefined') return null;

    return createPortal(
      <div
        className="fixed inset-0 z-[2147483647] flex flex-col bg-black animate-in fade-in duration-300 overflow-y-auto overflow-x-hidden cursor-zoom-out"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={() => setSelectedImage(null)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setSelectedImage(null);
        }}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
          body { overflow: hidden !important; }
          nav, aside, header { display: none !important; opacity: 0 !important; pointer-events: none !important; }
        `,
          }}
        />

        <div className="fixed top-8 left-8 z-[2147483647]">
          <button
            className="bg-black/40 hover:bg-black/60 text-white p-3 rounded-2xl backdrop-blur-xl border border-white/10 shadow-2xl transition-all active:scale-90 flex items-center justify-center"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedImage(null);
            }}
            title={messages.common.close}
          >
            <span className="material-symbols-outlined text-[20px] font-black">close</span>
          </button>
        </div>

        <div className="flex-1 w-full flex flex-col items-center justify-start pt-24 pb-24 px-4 md:px-20 min-h-screen">
          <img
            src={selectedImage}
            alt={historyMessages.enlargedFood}
            className="w-full max-w-5xl h-auto object-contain shadow-[0_0_120px_rgba(255,255,255,0.05)] rounded-[2.5rem] transition-all duration-700 animate-in zoom-in-95 border border-white/5"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            role="presentation"
          />
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <section className="space-y-6 pb-12">
      {renderLightbox()}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white/40 p-6 rounded-[2.5rem] border border-slate-200/50 backdrop-blur-sm shadow-sm transition-all hover:bg-white/60">
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight mb-1">{historyMessages.title}</h3>
            <p className="text-sm font-semibold text-slate-400 italic">{historyMessages.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <span className="material-symbols-outlined text-[16px] text-primary/60 ml-1">calendar_month</span>
              <select
                value={viewMonth}
                onChange={(event) => setViewMonth(Number(event.target.value))}
                className="bg-transparent text-sm font-black text-slate-700 focus:outline-none pr-6 appearance-none cursor-pointer uppercase tracking-tighter"
              >
                {availableMonths.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <span className="material-symbols-outlined text-[16px] text-primary/60 ml-1">history</span>
              <select
                value={viewYear}
                onChange={(event) => setViewYear(Number(event.target.value))}
                className="bg-transparent text-sm font-black text-slate-700 focus:outline-none pr-6 appearance-none cursor-pointer uppercase tracking-tighter"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="relative group/scroller">
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-8 pt-4 no-scrollbar -mx-6 px-8 touch-pan-x active:cursor-grabbing scroll-smooth"
          >
            {monthDays.map((day) => (
              <button
                key={day.dateStr}
                data-active={filterDate === day.dateStr}
                onClick={() => {
                  if (!day.hasData) return;
                  setFilterDate(day.dateStr);
                  setViewMonth(new Date(`${day.dateStr}T00:00:00Z`).getUTCMonth());
                  setViewYear(new Date(`${day.dateStr}T00:00:00Z`).getUTCFullYear());
                }}
                disabled={!day.hasData}
                className={`flex flex-col items-center min-w-[72px] h-[100px] py-4 rounded-3xl transition-all duration-300 relative group shrink-0 ${getDateButtonClass(day.dateStr, day.hasData)}`}
              >
                {day.isToday && (
                  <span
                    className={`absolute -top-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      filterDate === day.dateStr ? 'bg-white text-primary' : 'bg-primary text-white shadow-lg'
                    }`}
                  >
                    {messages.common.today}
                  </span>
                )}
                <span
                  className={`text-[11px] font-black uppercase tracking-widest mb-1.5 ${
                    filterDate === day.dateStr ? 'text-primary-fixed opacity-90' : 'text-slate-400 group-hover:text-primary transition-colors'
                  }`}
                >
                  {day.dayName}
                </span>
                <span className="text-2xl font-black">{day.dayNumber}</span>
                {day.hasData && filterDate !== day.dateStr && (
                  <div className="absolute bottom-3.5 h-1.5 w-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]"></div>
                )}
                {day.hasData && filterDate === day.dateStr && (
                  <div className="absolute bottom-3.5 h-1 w-4 bg-white/30 rounded-full"></div>
                )}
              </button>
            ))}
          </div>

          <div className="absolute left-0 top-0 bottom-6 w-12 bg-gradient-to-r from-slate-50 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute right-0 top-0 bottom-6 w-12 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
      </div>

      <div className="grid gap-4">
        {!filterDate ? (
          <div className="bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] py-16 flex flex-col items-center justify-center text-center px-6 transition-colors">
            <div className="bg-white p-6 rounded-full mb-4 shadow-sm border border-slate-100">
              <span className="material-symbols-outlined text-5xl text-slate-200" style={{ fontVariationSettings: "'wght' 200" }}>
                calendar_month
              </span>
            </div>
            <h5 className="text-lg font-bold text-slate-800">{historyMessages.noRecordsTitle}</h5>
            <p className="text-slate-500 text-sm max-w-[240px] mt-1 font-medium italic">
              {historyMessages.noRecordsQuote}
            </p>
          </div>
        ) : filteredComidas.length > 0 ? (
          filteredComidas.map((comida, idx) => {
            const isInadequate = isFoodClassificationInadequate(comida.clasificacion_final);
            const insightTooltipId = `${comida.comida_id}-insight`;
            const reasonTooltipId = `${comida.comida_id}-reason`;
            const hasOpenTooltip =
              activeTooltipId === insightTooltipId || activeTooltipId === reasonTooltipId;

            return (
              <div
                key={comida.comida_id}
                className={`bg-white rounded-3xl p-5 flex flex-col gap-4 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:scale-[1.01] group relative overflow-visible active:scale-[0.98] duration-300 sm:flex-row sm:items-center sm:pr-8 ${
                  hasOpenTooltip ? 'z-30 hover:z-30' : 'z-0 hover:z-10'
                }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${getAccentClass(comida.tipo_comida)} opacity-70`}></div>

                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border ${getColorClass(comida.tipo_comida)} shadow-inner`}>
                    <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {getIcon(comida.tipo_comida)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h4 className="font-extrabold text-slate-800 truncate leading-tight">{translateMealType(comida.tipo_comida, locale)}</h4>
                      <div className="group/insight relative inline-flex shrink-0" data-tooltip-root="true">
                        <button
                          type="button"
                          className="list-none h-6 w-6 rounded-full border border-sky-200 bg-sky-50 text-sky-700 flex items-center justify-center cursor-pointer"
                          aria-label={historyMessages.mealInsightLabel}
                          aria-expanded={activeTooltipId === insightTooltipId}
                          onClick={() =>
                            setActiveTooltipId((currentId) =>
                              currentId === insightTooltipId ? null : insightTooltipId,
                            )
                          }
                        >
                          <span className="material-symbols-outlined text-[15px]">info</span>
                        </button>
                        {activeTooltipId === insightTooltipId ? (
                          <div className={`absolute left-1/2 top-full z-40 mt-3 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border p-3 shadow-xl sm:w-[26rem] sm:max-w-[calc(100vw-3rem)] ${getMealInsight(comida).tone}`}>
                            <div className={`absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t ${getMealInsight(comida).tone}`}></div>
                            <p className="text-[11px] font-black uppercase tracking-wider">{historyMessages.mealInsightTitle}</p>
                            <p className="mt-1 text-xs leading-relaxed">{getMealInsight(comida).text}</p>
                            <p className="mt-2 text-[11px]">{historyMessages.mealInsightOptimization}</p>
                          </div>
                        ) : null}
                      </div>
                      {isInadequate && comida.razon_inadecuada ? (
                        <div className="group/reason relative inline-flex shrink-0" data-tooltip-root="true">
                          <button
                            type="button"
                            className="list-none h-6 w-6 rounded-full border border-rose-200 bg-rose-50 text-rose-700 flex items-center justify-center cursor-pointer"
                            aria-label={translateFoodClassification(comida.clasificacion_final, locale)}
                            aria-expanded={activeTooltipId === reasonTooltipId}
                            onClick={() =>
                              setActiveTooltipId((currentId) =>
                                currentId === reasonTooltipId ? null : reasonTooltipId,
                              )
                            }
                          >
                            <span className="material-symbols-outlined text-[15px]">error</span>
                          </button>
                          {activeTooltipId === reasonTooltipId ? (
                            <div className="absolute left-1/2 top-full z-40 mt-3 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-900 shadow-xl sm:w-[26rem] sm:max-w-[calc(100vw-3rem)]">
                              <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-rose-200 bg-rose-50"></div>
                              <p className="text-[11px] font-black uppercase tracking-wider">
                                {translateFoodClassification(comida.clasificacion_final, locale)}
                              </p>
                              <p className="mt-1 text-xs leading-relaxed">{comida.razon_inadecuada}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <span className="text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 bg-slate-50 text-slate-400 rounded-lg shrink-0 border border-slate-100">
                        {comida.hora}
                      </span>
                    </div>
                    <p className="text-[13px] text-slate-600 font-medium truncate">
                      {comida.alimento_principal || historyMessages.noDescription}
                    </p>
                    {comida.nota && (
                      <p className="text-[11px] text-primary/70 mt-1 flex items-center gap-1 italic font-medium">
                        <span className="material-symbols-outlined text-[14px]">edit_note</span>
                        {comida.nota}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center content-center self-center justify-center gap-2 shrink-0 md:ml-2 md:flex-col md:flex-nowrap">
                  {comida.foto_url && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedImage(comida.foto_url as string);
                      }}
                      className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all border border-blue-100 flex items-center justify-center shadow-sm active:scale-90 group/photo shrink-0"
                      title={historyMessages.viewMealPhoto}
                    >
                      <span className="material-symbols-outlined text-[24px] md:text-[28px] group-hover/photo:scale-110 transition-transform" style={{ fontVariationSettings: "'FILL' 0" }}>
                        image
                      </span>
                    </button>
                  )}

                  <div
                    className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                      isInadequate
                        ? 'bg-rose-50 text-rose-600 border-rose-100'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}
                  >
                    {translateFoodClassification(comida.clasificacion_final, locale)}
                  </div>

                  <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[15px] font-black text-slate-800 tracking-tighter">
                    <span>{comida.kcal_estimadas ?? '--'}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-black">kcal</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-slate-100/30 border-2 border-dashed border-slate-200 rounded-[2.5rem] py-16 flex flex-col items-center justify-center text-center px-6 transition-colors">
            <div className="bg-white p-6 rounded-full mb-4 shadow-sm border border-slate-100">
              <span className="material-symbols-outlined text-5xl text-slate-200" style={{ fontVariationSettings: "'wght' 200" }}>
                ramen_dining
              </span>
            </div>
            <h5 className="text-lg font-bold text-slate-800">{historyMessages.noRecordsTitle}</h5>
            <p className="text-slate-500 text-sm max-w-[240px] mt-1 font-medium italic">
              "{historyMessages.noRecordsQuote}"
            </p>
            <a
              href="/comidas/nuevo"
              className="mt-6 bg-primary text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-2"
            >
              {historyMessages.registerMeal}
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
