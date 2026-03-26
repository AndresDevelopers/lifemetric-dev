import { cookies, headers } from "next/headers";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import HistorialComidas from "@/components/resumen/HistorialComidas";
import SummaryHeader from "@/components/resumen/SummaryHeader";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_EXPLICIT_COOKIE_NAME,
  getMessages,
  inferLocaleFromRequest,
} from "@/lib/i18n";

export default async function ResumenSemanal({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  const sp = await searchParams;
  const fromParam = sp.from as string | undefined;
  const toParam = sp.to as string | undefined;

  const cookieStore = await cookies();
  const headerStore = await headers();
  const sessionToken = cookieStore.get('lifemetric_session')?.value;
  const locale = inferLocaleFromRequest({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    explicitCookie: cookieStore.get(LOCALE_EXPLICIT_COOKIE_NAME)?.value,
    acceptLanguage: headerStore.get('accept-language'),
    country: headerStore.get('x-vercel-ip-country') ?? headerStore.get('cf-ipcountry'),
    city: headerStore.get('x-vercel-ip-city') ?? headerStore.get('cf-ipcity'),
  });
  const messages = getMessages(locale);
  
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

  const hoy = new Date();
  const unaSemanaAtras = new Date();
  unaSemanaAtras.setDate(hoy.getDate() - 7);

  const startDate = fromParam ? new Date(fromParam + 'T00:00:00Z') : unaSemanaAtras;
  const endDate = toParam ? new Date(toParam + 'T23:59:59Z') : hoy;

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

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
        where: { fecha: { gte: startDate, lte: endDate } }
      },
      laboratorios: {
        orderBy: { fecha_estudio: 'desc' },
        take: 1
      },
      medicacion: {
        where: { fecha: { gte: startDate, lte: endDate } }
      },
      glucosa: {
        where: { fecha: { gte: startDate, lte: endDate } }
      }
    }
  });

  if (!paciente) {
    redirect('/login');
  }

  const ultimaHba1c = paciente.laboratorios?.[0]?.hba1c ? Number(paciente.laboratorios[0].hba1c) : 0;
  
  const promedioGlucosa = paciente.glucosa.length 
    ? Math.round(paciente.glucosa.reduce((acc, curr) => acc + curr.valor_glucosa, 0) / paciente.glucosa.length)
    : 0;

  const filteredComidas = paciente.comidas.filter(c => {
    const d = new Date(c.fecha);
    return d >= startDate && d <= endDate;
  });
  const comidasRegistradas = filteredComidas.length;
  const comidasInadecuadas = filteredComidas.filter(c => c.clasificacion_final?.toLowerCase() === 'pobre' || c.clasificacion_final?.toLowerCase() === 'malo').length; 

  const diasEjercicio = paciente.habitos.filter(h => (h.ejercicio_min || 0) > 0).length;
  const promedioSueno = paciente.habitos.length 
    ? Math.round(paciente.habitos.reduce((acc, curr) => acc + Number(curr.sueno_horas || 0), 0) / paciente.habitos.length * 10) / 10
    : 0;
  
  const promedioAgua = paciente.habitos.length 
    ? Math.round(paciente.habitos.reduce((acc, curr) => acc + (curr.agua_vasos || 0), 0) / paciente.habitos.length)
    : 0;

  const tomasProgramadas = paciente.medicacion.length || 1;
  const tomasRealizadas = paciente.medicacion.filter(m => m.estado_toma === 'Tomada' || m.estado_toma === 'tomada').length;
  const adherenciaMedicacion = paciente.medicacion.length === 0 ? 0 : Math.round((tomasRealizadas / tomasProgramadas) * 100);

  const data = {
    paciente: `${paciente.nombre} ${paciente.apellido}`,
    ultima_hba1c: ultimaHba1c,
    promedio_glucosa: promedioGlucosa,
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
    alerta_principal: paciente.glucosa.some(g => g.valor_glucosa > 140) ? messages.summary.glucosePeaks : messages.summary.glucoseInRange,
    patron_principal: messages.summary.keepTracking
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <SummaryHeader 
        initialFrom={startDateStr} 
        initialTo={endDateStr} 
      />
      
      <div className="p-6 md:p-10 max-w-4xl mx-auto pb-32 md:pb-12 space-y-6">
        
        <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 scale-150 transform translate-x-12 -translate-y-12">
            <span className="material-symbols-outlined text-[200px]" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
          </div>
          <div className="relative z-10">
            <p className="text-blue-200 font-bold tracking-widest uppercase text-xs mb-2">{messages.summary.patientReport}</p>
            <h2 className="text-4xl font-extrabold mb-1">{data.paciente}</h2>
            <div className="flex gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1">
                <p className="text-blue-200 text-xs font-semibold">{messages.summary.averageGlucose}</p>
                <div className="flex items-end gap-1 mt-1">
                  <span className="text-3xl font-black">{data.promedio_glucosa}</span>
                  <span className="text-sm pb-1">mg/dL</span>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1">
                <p className="text-blue-200 text-xs font-semibold">{messages.summary.lastHbA1c}</p>
                <div className="flex items-end gap-1 mt-1">
                  <span className="text-3xl font-black">{data.ultima_hba1c}</span>
                  <span className="text-sm pb-1">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex gap-3 mb-2">
              <span className="material-symbols-outlined text-rose-500 mt-1" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              <div>
                <h3 className="font-bold text-rose-900">{messages.summary.mainAlert}</h3>
                <p className="text-rose-800/80 text-sm mt-1">{data.alerta_principal}</p>
              </div>
            </div>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex gap-3 mb-2">
              <span className="material-symbols-outlined text-teal-600 mt-1" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              <div>
                <h3 className="font-bold text-teal-900">{messages.summary.detectedPattern}</h3>
                <p className="text-teal-800/80 text-sm mt-1">{data.patron_principal}</p>
              </div>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">{messages.summary.detailedAnalysis}</h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:scale-[1.02] transition-transform">
            <span className="material-symbols-outlined text-3xl text-primary bg-primary/10 p-3 rounded-full mb-3">restaurant</span>
            <span className="text-3xl font-black text-slate-800">{data.comidas.registradas_semana}</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{messages.summary.mealsLogged}</span>
          </div>

          <div className={`rounded-3xl p-5 shadow-lg border flex flex-col items-center text-center hover:scale-[1.02] transition-transform ${data.comidas.inadecuadas > 0 ? 'bg-orange-50 border-orange-100 shadow-orange-100/50' : 'bg-white border-slate-100'}`}>
            <span className={`material-symbols-outlined text-3xl p-3 rounded-full mb-3 ${data.comidas.inadecuadas > 0 ? 'text-orange-500 bg-orange-500/10' : 'text-slate-400 bg-slate-100'}`}>fastfood</span>
            <span className={`text-3xl font-black ${data.comidas.inadecuadas > 0 ? 'text-orange-600' : 'text-slate-800'}`}>{data.comidas.inadecuadas}</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{messages.summary.inadequate}</span>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:scale-[1.02] transition-transform">
            <span className="material-symbols-outlined text-3xl text-emerald-500 bg-emerald-500/10 p-3 rounded-full mb-3">fitness_center</span>
            <span className="text-3xl font-black text-slate-800">{data.habitos.dias_ejercicio}</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{messages.summary.exerciseDays}</span>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:scale-[1.02] transition-transform">
            <span className="material-symbols-outlined text-3xl text-indigo-400 bg-indigo-500/10 p-3 rounded-full mb-3">bedtime</span>
            <div className="flex items-end gap-1"><span className="text-3xl font-black text-slate-800">{data.habitos.promedio_sueno}</span><span className="text-sm font-bold text-slate-400 pb-1">h</span></div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{messages.summary.sleepAverage}</span>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:scale-[1.02] transition-transform">
            <span className="material-symbols-outlined text-3xl text-blue-400 bg-blue-500/10 p-3 rounded-full mb-3">water_drop</span>
            <span className="text-3xl font-black text-slate-800">{data.habitos.promedio_agua}</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{messages.summary.waterPerDay}</span>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:scale-[1.02] transition-transform relative overflow-hidden">
            <div className="absolute inset-x-0 bottom-0 bg-blue-100 h-2">
              <div className="bg-primary h-full rounded-r-full transition-all duration-1000" style={{ width: `${data.adherencia_medicacion_pct}%` }}></div>
            </div>
            <span className="material-symbols-outlined text-3xl text-slate-600 bg-slate-100 p-3 rounded-full mb-3">medication</span>
            <div className="flex items-end gap-1"><span className="text-3xl font-black text-slate-800">{data.adherencia_medicacion_pct}</span><span className="text-sm font-bold text-slate-400 pb-1">%</span></div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 mb-2">{messages.summary.medicationAdherence}</span>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100">
          <HistorialComidas initialComidas={paciente.comidas} />
        </div>

      </div>
    </div>
  );
}
