/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/components/providers/LocaleProvider';
import { translateFoodClassification, translateMealType } from '@/lib/i18n';

interface Comida {
  comida_id: string;
  fecha: Date | string;
  hora: Date | string;
  tipo_comida: string;
  alimento_principal: string | null;
  kcal_estimadas: number | null;
  clasificacion_final: string | null;
  nota: string | null;
  foto_url: string | null;
}

export default function HistorialComidas({ initialComidas }: { readonly initialComidas: readonly Comida[] }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { locale, messages } = useLocale();
  const historyMessages = messages.foodHistory;

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
  
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [filterDate, setFilterDate] = useState<string>(() => {
    if (initialComidas.length > 0) {
      const firstComida = initialComidas[0];
      const date = new Date(firstComida.fecha);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return getTodayStr();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    return new Date(filterDate + 'T00:00:00Z').getUTCMonth();
  });
  const [viewYear, setViewYear] = useState<number>(() => {
    return new Date(filterDate + 'T00:00:00Z').getUTCFullYear();
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const comida of initialComidas) {
      years.add(new Date(comida.fecha).getUTCFullYear());
    }
    // Add current year if not present
    years.add(new Date().getUTCFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [initialComidas]);

  const availableMonths = useMemo(() => {
    const months = [];
    const localeName = locale === 'es' ? 'es-ES' : 'en-US';
    for (let i = 0; i < 12; i++) {
      const d = new Date(2000, i, 1);
      months.push({
        value: i,
        label: d.toLocaleDateString(localeName, { month: 'long' })
      });
    }
    return months;
  }, [locale]);

  const datesWithData = useMemo(() => {
    const dates = new Set<string>();
    for (const comida of initialComidas) {
      const d = new Date(comida.fecha);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      dates.add(`${year}-${month}-${day}`);
    }
    return dates;
  }, [initialComidas]);

  const monthDays = useMemo(() => {
    const days = [];
    // Number of days in viewYear/viewMonth
    const date = new Date(viewYear, viewMonth + 1, 0);
    const numDays = date.getDate();
    
    for (let i = 1; i <= numDays; i++) {
      const d = new Date(viewYear, viewMonth, i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayNum}`;
      
      days.push({
        dateStr,
        dayName: d.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' }),
        dayNumber: d.getDate(),
        hasData: datesWithData.has(dateStr),
        isToday: dateStr === getTodayStr()
      });
    }
    return days;
  }, [datesWithData, locale, viewMonth, viewYear]);

  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector('[data-active="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [filterDate]);

  const filteredComidas = useMemo(() => {
    return initialComidas.filter((comida) => {
      const date = new Date(comida.fecha);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      return dateStr === filterDate;
    });
  }, [initialComidas, filterDate]);

  const getIcon = (tipo: string) => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('desayuno')) return 'wb_sunny';
    if (t.includes('almuerzo')) return 'lunch_dining';
    if (t.includes('cena')) return 'dark_mode';
    if (t.includes('snack') || t.includes('merienda')) return 'rebase';
    return 'restaurant_menu';
  };

  const getColorClass = (tipo: string) => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('desayuno')) return 'bg-orange-100 text-orange-600 border-orange-200';
    if (t.includes('almuerzo')) return 'bg-blue-100 text-blue-600 border-blue-200';
    if (t.includes('cena')) return 'bg-indigo-100 text-indigo-600 border-indigo-200';
    return 'bg-emerald-100 text-emerald-600 border-emerald-200';
  };

  const getAccentClass = (tipo: string) => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('desayuno')) return 'bg-orange-500';
    if (t.includes('almuerzo')) return 'bg-blue-500';
    if (t.includes('cena')) return 'bg-indigo-500';
    return 'bg-emerald-500';
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
        onKeyDown={(e) => { if (e.key === 'Escape') setSelectedImage(null); }}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          body { overflow: hidden !important; }
          nav, aside, header { display: none !important; opacity: 0 !important; pointer-events: none !important; }
        `}} />

        <div className="fixed top-8 left-8 z-[2147483647]">
          <button 
            className="bg-black/40 hover:bg-black/60 text-white p-3 rounded-2xl backdrop-blur-xl border border-white/10 shadow-2xl transition-all active:scale-90 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
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
            onClick={(e) => e.stopPropagation()} 
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          />
        </div>
      </div>,
      document.body
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
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="bg-transparent text-sm font-black text-slate-700 focus:outline-none pr-6 appearance-none cursor-pointer uppercase tracking-tighter"
              >
                {availableMonths.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <span className="material-symbols-outlined text-[16px] text-primary/60 ml-1">history</span>
              <select 
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="bg-transparent text-sm font-black text-slate-700 focus:outline-none pr-6 appearance-none cursor-pointer uppercase tracking-tighter"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
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
                  <span className={`absolute -top-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    filterDate === day.dateStr ? 'bg-white text-primary' : 'bg-primary text-white shadow-lg'
                  }`}>
                    {messages.common.today}
                  </span>
                )}
                <span className={`text-[11px] font-black uppercase tracking-widest mb-1.5 ${
                  filterDate === day.dateStr ? 'text-primary-fixed opacity-90' : 'text-slate-400 group-hover:text-primary transition-colors'
                }`}>
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
          
          {/* Subtle overflow indicators */}
          <div className="absolute left-0 top-0 bottom-6 w-12 bg-gradient-to-r from-slate-50 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute right-0 top-0 bottom-6 w-12 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredComidas.length > 0 ? (
          filteredComidas.map((comida, idx) => (
            <div
              key={comida.comida_id}
              className="bg-white rounded-3xl p-5 flex items-center gap-4 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:scale-[1.01] group relative overflow-hidden active:scale-[0.98] duration-300 sm:pr-8"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${getAccentClass(comida.tipo_comida)} opacity-70`}></div>
              
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border ${getColorClass(comida.tipo_comida)} shadow-inner`}>
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {getIcon(comida.tipo_comida)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-extrabold text-slate-800 truncate leading-tight">{translateMealType(comida.tipo_comida, locale)}</h4>
                  <span className="text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 bg-slate-50 text-slate-400 rounded-lg shrink-0 border border-slate-100">
                    {new Date(comida.hora).toLocaleTimeString(locale === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
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

              {/* Botón con icono para ver la foto si existe (Limpio y consistente) */}
              {comida.foto_url && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(comida.foto_url as string);
                  }}
                  className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all ml-2 border border-blue-100 flex items-center justify-center shadow-sm active:scale-90 group/photo shrink-0"
                  title={historyMessages.viewMealPhoto}
                >
                  <span className="material-symbols-outlined text-[24px] md:text-[28px] group-hover/photo:scale-110 transition-transform" style={{ fontVariationSettings: "'FILL' 0" }}>
                    image
                  </span>
                </button>
              )}

              <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                <div className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                  comida.clasificacion_final?.toLowerCase() === 'pobre' || comida.clasificacion_final?.toLowerCase() === 'malo'
                    ? 'bg-rose-50 text-rose-600 border-rose-100'
                    : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>
                  {translateFoodClassification(comida.clasificacion_final, locale)}
                </div>
                <span className="text-[15px] font-black text-slate-800 tracking-tighter">
                  {comida.kcal_estimadas || 0} <span className="text-[10px] text-slate-400 uppercase font-black">kcal</span>
                </span>
              </div>
            </div>
          ))
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
