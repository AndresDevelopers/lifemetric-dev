import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import HistorialComidas from "@/components/resumen/HistorialComidas";

export default async function ResumenSemanal() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('lifemetric_session')?.value;
  
  if (!sessionToken) {
    redirect('/login');
  }

  const payload = await verifySession(sessionToken);
  if (!payload) {
    redirect('/login');
  }

  let parsedPayload;
  try {
    parsedPayload = JSON.parse(payload);
  } catch {
    redirect('/login');
  }

  const pacienteId = parsedPayload.pacienteId;

  // Let's get the last 7 days date limit
  const semanaAtras = new Date();
  semanaAtras.setDate(semanaAtras.getDate() - 7);

  const treintaDiasAtras = new Date();
  treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);

  const paciente = await prisma.paciente.findUnique({
    where: { paciente_id: pacienteId },
    include: {
      comidas: {
        where: { fecha: { gte: treintaDiasAtras } },
        orderBy: [
          { fecha: 'desc' },
          { hora: 'desc' }
        ]
      },
      habitos: {
        where: { fecha: { gte: semanaAtras } }
      },
      laboratorios: {
        orderBy: { fecha_estudio: 'desc' },
        take: 1
      },
      medicacion: {
        where: { fecha: { gte: semanaAtras } }
      },
      glucosa: {
        where: { fecha: { gte: semanaAtras } }
      }
    }
  });

  if (!paciente) {
    redirect('/login');
  }

  // Calculate actual numbers using prisma data
  const ultimaHba1c = paciente.laboratorios?.[0]?.hba1c ? Number(paciente.laboratorios[0].hba1c) : 0;
  
  const promedioGlucosa7d = paciente.glucosa.length 
    ? Math.round(paciente.glucosa.reduce((acc, curr) => acc + curr.valor_glucosa, 0) / paciente.glucosa.length)
    : 0;

  // Metrics should still be based on the last 7 days
  const comidas7d = paciente.comidas.filter(c => new Date(c.fecha) >= semanaAtras);
  const comidasRegistradas = comidas7d.length;
  // Fallback string literal assumption since clasificacion_final is a string. Assuming 'Pobre' or similar means inadequate.
  const comidasInadecuadas = comidas7d.filter(c => c.clasificacion_final?.toLowerCase() === 'pobre' || c.clasificacion_final?.toLowerCase() === 'malo').length; 

  const diasEjercicio = paciente.habitos.filter(h => (h.ejercicio_min || 0) > 0).length;
  const promedioSueno = paciente.habitos.length 
    ? Math.round(paciente.habitos.reduce((acc, curr) => acc + Number(curr.sueno_horas || 0), 0) / paciente.habitos.length * 10) / 10
    : 0;
  
  const promedioAgua = paciente.habitos.length 
    ? Math.round(paciente.habitos.reduce((acc, curr) => acc + (curr.agua_vasos || 0), 0) / paciente.habitos.length)
    : 0;

  const tomasProgramadas = paciente.medicacion.length || 1; // avoid division by zero
  const tomasRealizadas = paciente.medicacion.filter(m => m.estado_toma === 'Tomada' || m.estado_toma === 'tomada').length;
  const adherenciaMedicacion = paciente.medicacion.length === 0 ? 0 : Math.round((tomasRealizadas / tomasProgramadas) * 100);

  const data = {
    paciente: `${paciente.nombre} ${paciente.apellido}`,
    ultima_hba1c: ultimaHba1c,
    promedio_glucosa_7d: promedioGlucosa7d,
    comidas: {
      registradas_semana: comidasRegistradas,
      inadecuadas: comidasInadecuadas,
    },
    habitos: {
      dias_ejercicio: diasEjercicio,
      promedio_sueno: promedioSueno,
      promedio_agua: promedioAgua,
    },
    adherencia_medicacion_pct: adherenciaMedicacion,
    alerta_principal: paciente.glucosa.some(g => g.valor_glucosa > 140) ? "Se detectaron picos de glucosa recientes." : "Tus niveles están en rango.",
    patron_principal: "Sigue registrando para identificar patrones."
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm px-6 h-16 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tighter text-blue-800">Resumen Semanal</h1>
        <div className="flex items-center gap-2 text-slate-500">
          <span className="text-sm font-bold bg-white px-3 py-1 rounded-full shadow-sm">Últimos 7 días</span>
          <span className="material-symbols-outlined text-primary cursor-pointer hover:bg-slate-200 rounded-full p-2 transition-colors">calendar_month</span>
        </div>
      </header>
      
      <div className="p-6 md:p-10 max-w-4xl mx-auto pb-32 md:pb-12 space-y-6">
        
        {/* Editorial Header */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 scale-150 transform translate-x-12 -translate-y-12">
            <span className="material-symbols-outlined text-[200px]" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
          </div>
          <div className="relative z-10">
            <p className="text-blue-200 font-bold tracking-widest uppercase text-xs mb-2">Paciente / Reporte de Progreso</p>
            <h2 className="text-4xl font-extrabold mb-1">{data.paciente}</h2>
            <div className="flex gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1">
                <p className="text-blue-200 text-xs font-semibold">Promedio Glucosa (7d)</p>
                <div className="flex items-end gap-1 mt-1">
                  <span className="text-3xl font-black">{data.promedio_glucosa_7d}</span>
                  <span className="text-sm pb-1">mg/dL</span>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1">
                <p className="text-blue-200 text-xs font-semibold">Última HbA1c</p>
                <div className="flex items-end gap-1 mt-1">
                  <span className="text-3xl font-black">{data.ultima_hba1c}</span>
                  <span className="text-sm pb-1">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights (Medical intelligence) */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex gap-3 mb-2">
              <span className="material-symbols-outlined text-rose-500 mt-1" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              <div>
                <h3 className="font-bold text-rose-900">Alerta Principal</h3>
                <p className="text-rose-800/80 text-sm mt-1">{data.alerta_principal}</p>
              </div>
            </div>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex gap-3 mb-2">
              <span className="material-symbols-outlined text-teal-600 mt-1" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              <div>
                <h3 className="font-bold text-teal-900">Patrón Detectado</h3>
                <p className="text-teal-800/80 text-sm mt-1">{data.patron_principal}</p>
              </div>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">Análisis Detallado</h3>

        {/* Grid de Métricas solicitadas */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          
          <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:scale-[1.02] transition-transform">
            <span className="material-symbols-outlined text-3xl text-primary bg-primary/10 p-3 rounded-full mb-3">restaurant</span>
            <span className="text-3xl font-black text-slate-800">{data.comidas.registradas_semana}</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Comidas Reg.</span>
          </div>

          <div className={`rounded-3xl p-5 shadow-lg border flex flex-col items-center text-center hover:scale-[1.02] transition-transform ${data.comidas.inadecuadas > 0 ? 'bg-orange-50 border-orange-100 shadow-orange-100/50' : 'bg-white border-slate-100'}`}>
            <span className={`material-symbols-outlined text-3xl p-3 rounded-full mb-3 ${data.comidas.inadecuadas > 0 ? 'text-orange-500 bg-orange-500/10' : 'text-slate-400 bg-slate-100'}`}>fastfood</span>
            <span className={`text-3xl font-black ${data.comidas.inadecuadas > 0 ? 'text-orange-600' : 'text-slate-800'}`}>{data.comidas.inadecuadas}</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Inadecuadas</span>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:scale-[1.02] transition-transform">
            <span className="material-symbols-outlined text-3xl text-emerald-500 bg-emerald-500/10 p-3 rounded-full mb-3">fitness_center</span>
            <span className="text-3xl font-black text-slate-800">{data.habitos.dias_ejercicio}</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Días Ejercicio</span>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:scale-[1.02] transition-transform">
            <span className="material-symbols-outlined text-3xl text-indigo-400 bg-indigo-500/10 p-3 rounded-full mb-3">bedtime</span>
            <div className="flex items-end gap-1"><span className="text-3xl font-black text-slate-800">{data.habitos.promedio_sueno}</span><span className="text-sm font-bold text-slate-400 pb-1">h</span></div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Prom. Sueño</span>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:scale-[1.02] transition-transform">
            <span className="material-symbols-outlined text-3xl text-blue-400 bg-blue-500/10 p-3 rounded-full mb-3">water_drop</span>
            <span className="text-3xl font-black text-slate-800">{data.habitos.promedio_agua}</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Vasos / Día</span>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:scale-[1.02] transition-transform relative overflow-hidden">
            {/* ProgressBar bg para adherencia */}
            <div className="absolute inset-x-0 bottom-0 bg-blue-100 h-2">
              <div className="bg-primary h-full rounded-r-full transition-all duration-1000" style={{ width: `${data.adherencia_medicacion_pct}%` }}></div>
            </div>
            <span className="material-symbols-outlined text-3xl text-slate-600 bg-slate-100 p-3 rounded-full mb-3">medication</span>
            <div className="flex items-end gap-1"><span className="text-3xl font-black text-slate-800">{data.adherencia_medicacion_pct}</span><span className="text-sm font-bold text-slate-400 pb-1">%</span></div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 mb-2">Adherencia Meds</span>
          </div>
        </div>

        {/* Nueva sección: Historial de Comidas con filtro */}
        <div className="pt-8 border-t border-slate-100">
          <HistorialComidas initialComidas={paciente.comidas} />
        </div>

      </div>
    </div>
  );
}
