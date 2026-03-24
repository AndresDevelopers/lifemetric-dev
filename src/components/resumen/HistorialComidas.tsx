'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * HistorialComidas
 * 
 * Componente cliente que muestra el historial de comidas del paciente con un filtro por fecha.
 * Reutiliza los tokens de diseño y estética del proyecto.
 */

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

export default function HistorialComidas({ initialComidas }: { initialComidas: Comida[] }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Asegurar que el componente esté montado para usar Portals de forma segura en Next.js
  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloqueo de scroll cuando el modal está activo para mejorar la inmersión (SXO/Premium)
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
  
  // Obtenemos el día de hoy en formato local YYYY-MM-DD para el input tipo 'date'
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [filterDate, setFilterDate] = useState<string>(getTodayStr());

  // Filtrado de las comidas basado en la fecha seleccionada
  const filteredComidas = useMemo(() => {
    return initialComidas.filter((comida) => {
      const date = new Date(comida.fecha);
      // Para Prisma @db.Date, el valor llega como medianoche UTC
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      return dateStr === filterDate;
    });
  }, [initialComidas, filterDate]);

  // Lógica visual para iconos y colores según el tipo de comida
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

  // Renderizado del modal usando un Portal para que esté siempre 'adelante' (Z-index global)
  const renderLightbox = () => {
    if (!selectedImage || !mounted) return null;

    return createPortal(
      <div 
        className="fixed inset-0 z-[2147483647] flex flex-col bg-black animate-in fade-in duration-300 overflow-y-auto overflow-x-hidden"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={() => setSelectedImage(null)}
      >
        {/* CSS inyectado para ocultar el resto de la UI */}
        <style dangerouslySetInnerHTML={{ __html: `
          body { overflow: hidden !important; }
          nav, aside, header { display: none !important; opacity: 0 !important; pointer-events: none !important; }
        `}} />

        {/* Boton de cierre PEQUEÑO a la IZQUIERDA con blur oscuro (Fijo siempre visible) */}
        <div className="fixed top-8 left-8 z-[2147483647]">
          <button 
            className="bg-black/40 hover:bg-black/60 text-white p-3 rounded-2xl backdrop-blur-xl border border-white/10 shadow-2xl transition-all active:scale-90 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
            title="Cerrar"
          >
            <span className="material-symbols-outlined text-[20px] font-black">close</span>
          </button>
        </div>

        {/* Área de visualización: justify-start con padding simétrico para soportar scroll en PC/Tablet */}
        <div className="flex-1 w-full flex flex-col items-center justify-start pt-24 pb-24 px-4 md:px-20 min-h-screen">
          <img 
            src={selectedImage} 
            alt="Comida ampliada" 
            className="w-full max-w-5xl h-auto object-contain shadow-[0_0_120px_rgba(255,255,255,0.05)] rounded-[2.5rem] transition-all duration-700 animate-in zoom-in-95 border border-white/5"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      </div>,
      document.body
    );
  };

  return (
    <section className="space-y-6 pb-12">
      {renderLightbox()}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Historial de Alimentación</h3>
          <p className="text-sm font-medium text-slate-500">Consulta lo que has registrado cada día</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 pl-4 pr-3 rounded-2xl shadow-sm border border-slate-200 focus-within:border-primary-container transition-all group hover:border-slate-300">
          <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors text-xl">calendar_month</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 cursor-pointer min-w-[124px]"
          />
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
                  <h4 className="font-extrabold text-slate-800 truncate leading-tight">{comida.tipo_comida}</h4>
                  <span className="text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 bg-slate-50 text-slate-400 rounded-lg shrink-0 border border-slate-100">
                    {new Date(comida.hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[13px] text-slate-600 font-medium truncate">
                  {comida.alimento_principal || 'Sin descripción detallada'}
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
                  title="Ver foto de la comida"
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
                  {comida.clasificacion_final || 'Normal'}
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
            <h5 className="text-lg font-bold text-slate-800">Día sin registros</h5>
            <p className="text-slate-500 text-sm max-w-[240px] mt-1 font-medium italic">
              "La constancia es la base del éxito metabólico"
            </p>
            <a 
              href="/comidas/nuevo"
              className="mt-6 bg-primary text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-2"
            >
              Registrar comida
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
