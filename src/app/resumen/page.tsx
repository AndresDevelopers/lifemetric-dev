import { cookies, headers } from "next/headers";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import HistorialComidas from "@/components/resumen/HistorialComidas";
import SummaryHeader from "@/components/resumen/SummaryHeader";
import { buildClinicalSuggestions, extractLabValuesFromImage } from "@/lib/ai/gemini";
import { unstable_cache } from "next/cache";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_EXPLICIT_COOKIE_NAME,
  getMessages,
  inferLocaleFromRequest,
} from "@/lib/i18n";

function escapeCsvValue(value: string | number): string {
  const normalized = String(value).replaceAll('"', '""');
  return `"${normalized}"`;
}

function buildSummaryCsv(params: {
  patient: string;
  rangeFrom: string;
  rangeTo: string;
  averageGlucose: number;
  latestHba1c: number;
  mealsLogged: number;
  mealsInadequate: number;
  exerciseDays: number;
  averageSleep: number;
  averageWater: number;
  medicationAdherence: number;
}) {
  const rows: Array<Array<string | number>> = [
    ["patient", params.patient],
    ["range_from", params.rangeFrom],
    ["range_to", params.rangeTo],
    ["average_glucose_mg_dl", params.averageGlucose],
    ["latest_hba1c_pct", params.latestHba1c],
    ["meals_logged", params.mealsLogged],
    ["inadequate_meals", params.mealsInadequate],
    ["exercise_days", params.exerciseDays],
    ["average_sleep_hours", params.averageSleep],
    ["average_water_glasses", params.averageWater],
    ["medication_adherence_pct", params.medicationAdherence],
  ];

  return rows
    .map((columns) => columns.map((column) => escapeCsvValue(column)).join(","))
    .join("\n");
}

function formatLabValue(
  value: number | string | null | undefined,
  suffix?: string,
) {
  if (value === null || value === undefined) {
    return "--";
  }

  return suffix ? `${value} ${suffix}` : String(value);
}

type LabChip = { label: string; value: string };

function buildLabChips(
  aiVision: { hba1c?: number | null; glucosa_ayuno?: number | null; trigliceridos?: number | null; hdl?: number | null; ldl?: number | null; insulina?: number | null; alt?: number | null; ast?: number | null; tsh?: number | null; creatinina?: number | null; acido_urico?: number | null; pcr_us?: number | null } | null,
  fallback: { hba1c?: { toString(): string } | null; glucosa_ayuno?: number | null; trigliceridos?: number | null; hdl?: number | null; ldl?: number | null } | null,
  labLabels: Record<string, string>
): LabChip[] {
  const chips: LabChip[] = [];
  
  if (aiVision) {
    if (aiVision.hba1c != null) chips.push({ label: labLabels.hba1c, value: `${aiVision.hba1c}%` });
    if (aiVision.glucosa_ayuno != null) chips.push({ label: labLabels.fastingGlucose, value: `${aiVision.glucosa_ayuno} mg/dL` });
    if (aiVision.trigliceridos != null) chips.push({ label: labLabels.triglycerides, value: `${aiVision.trigliceridos} mg/dL` });
    if (aiVision.hdl != null) chips.push({ label: labLabels.hdl, value: `${aiVision.hdl} mg/dL` });
    if (aiVision.ldl != null) chips.push({ label: labLabels.ldl, value: `${aiVision.ldl} mg/dL` });
    if (aiVision.insulina != null) chips.push({ label: labLabels.insulin, value: `${aiVision.insulina} \u03bcU/mL` });
    if (aiVision.alt != null) chips.push({ label: labLabels.alt, value: `${aiVision.alt} U/L` });
    if (aiVision.ast != null) chips.push({ label: labLabels.ast, value: `${aiVision.ast} U/L` });
    if (aiVision.tsh != null) chips.push({ label: labLabels.tsh, value: `${aiVision.tsh} \u03bcIU/mL` });
    if (aiVision.creatinina != null) chips.push({ label: labLabels.creatinine, value: `${aiVision.creatinina} mg/dL` });
    if (aiVision.acido_urico != null) chips.push({ label: labLabels.uricAcid, value: `${aiVision.acido_urico} mg/dL` });
    if (aiVision.pcr_us != null) chips.push({ label: labLabels.pcr_us, value: `${aiVision.pcr_us} mg/L` });
  } else if (fallback) {
    if (fallback.hba1c != null) chips.push({ label: labLabels.hba1c, value: `${Number(fallback.hba1c)}%` });
    if (fallback.glucosa_ayuno != null) chips.push({ label: labLabels.fastingGlucose, value: `${fallback.glucosa_ayuno} mg/dL` });
    if (fallback.trigliceridos != null) chips.push({ label: labLabels.triglycerides, value: `${fallback.trigliceridos} mg/dL` });
    if (fallback.hdl != null) chips.push({ label: labLabels.hdl, value: `${fallback.hdl} mg/dL` });
    if (fallback.ldl != null) chips.push({ label: labLabels.ldl, value: `${fallback.ldl} mg/dL` });
  }
  return chips;
}

const getCachedAISuggestions = unstable_cache(
  async (locale: "es" | "en", data: Record<string, unknown>) => buildClinicalSuggestions({ locale, data }),
  ["clinical-suggestions"],
  { revalidate: 3600 }
);

const getCachedLabVision = unstable_cache(
  async (imageUrl: string, locale: "es" | "en") => extractLabValuesFromImage({ imageUrl, locale }),
  ["lab-vision"],
  { revalidate: 86400 }
);

export default async function ResumenSemanal({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}>) {
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
        where: { fecha_estudio: { gte: startDate, lte: endDate } },
        orderBy: { fecha_estudio: 'desc' },
        take: 6
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
  const ultimoLaboratorio = paciente.laboratorios[0] ?? null;

  // Run AI vision extraction sequentially (to avoid concurrent 429s) 
  // and only for labs that don't have extracted values yet
  const labVisionResults: Array<Record<string, number | null> | null> = [];
  let visionErrorEncountered = false;

  for (const lab of paciente.laboratorios) {
    if (lab.archivo_url && !visionErrorEncountered && lab.hba1c == null && lab.glucosa_ayuno == null) {
      try {
        // Add a small delay between requests to stay under RPM limits (15 RPM for free tier)
        if (labVisionResults.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const result = await getCachedLabVision(lab.archivo_url, locale);
        labVisionResults.push(result);

        // SAVE BACK TO DB IF FOUND - Efficiency DRY: don't repeat vision next time
        if (result) {
          await prisma.laboratorio.update({
            where: { laboratorio_id: lab.laboratorio_id },
            data: {
              hba1c: result.hba1c,
              glucosa_ayuno: result.glucosa_ayuno,
              trigliceridos: result.trigliceridos,
              hdl: result.hdl,
              ldl: result.ldl,
              insulina: result.insulina,
              alt: result.alt,
              ast: result.ast,
              tsh: result.tsh,
              creatinina: result.creatinina,
              acido_urico: result.acido_urico,
              pcr_us: result.pcr_us,
            }
          });
        }
      } catch (err) {
        console.error("Lab vision error:", err);
        labVisionResults.push(null);
        // If it's a 429, don't try other labs in this request
        if (String(err).includes("429")) {
          visionErrorEncountered = true;
        }
      }
    } else {
      labVisionResults.push(null);
    }
  }
  
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
  const medicamentosResumen = paciente.medicacion.reduce<Record<string, number>>((acc, item) => {
    const key = item.medicamento?.trim() || "Sin nombre";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

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
  };

  const aiSuggestionPayload = {
    ...data,
    medicamentos: medicamentosResumen,
    laboratorios: paciente.laboratorios.map((item) => ({
      fecha: item.fecha_estudio,
      hba1c: item.hba1c ? Number(item.hba1c) : null,
      glucosa_ayuno: item.glucosa_ayuno,
      trigliceridos: item.trigliceridos,
      hdl: item.hdl,
      ldl: item.ldl,
      labels: messages.summary.labValues,
    })),
    comidas_recientes: filteredComidas.slice(0, 5).map((item) => ({
      alimento_principal: item.alimento_principal,
      nota: item.nota,
      foto_url: item.foto_url,
      clasificacion_final: item.clasificacion_final,
    })),
  };

  let aiSuggestions = null;
  try {
    aiSuggestions = await getCachedAISuggestions(
      locale,
      aiSuggestionPayload
    );
  } catch (err) {
    console.error("AI Suggestions error:", err);
  }

  const csvContent = buildSummaryCsv({
    patient: data.paciente,
    rangeFrom: startDateStr,
    rangeTo: endDateStr,
    averageGlucose: data.promedio_glucosa,
    latestHba1c: data.ultima_hba1c,
    mealsLogged: data.comidas.registradas_semana,
    mealsInadequate: data.comidas.inadecuadas,
    exerciseDays: data.habitos.dias_ejercicio,
    averageSleep: data.habitos.promedio_sueno,
    averageWater: data.habitos.promedio_agua,
    medicationAdherence: data.adherencia_medicacion_pct,
  });
  const csvDataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
  const exportFileName = `lifemetric-summary-${startDateStr}-to-${endDateStr}.csv`;

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
          <a
            href={csvDataUri}
            download={exportFileName}
            className="absolute right-5 top-5 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white shadow-sm backdrop-blur-md transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={messages.summary.exportToSheets}
            title={messages.summary.exportToSheets}
          >
            <span className="material-symbols-outlined text-[24px]">download</span>
          </a>
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

        <div className="grid md:grid-cols-1 gap-6">
          <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex gap-3 mb-2">
              <span className="material-symbols-outlined text-rose-500 mt-1" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              <div>
                <h3 className="font-bold text-rose-900">{messages.summary.mainAlert}</h3>
                <p className="text-rose-800/80 text-sm mt-1">{data.alerta_principal}</p>
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

        <section className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{messages.summary.medicationsSectionTitle}</h3>
              <p className="text-sm text-slate-500">{messages.summary.medicationsSectionSubtitle}</p>
            </div>
            <span className="material-symbols-outlined rounded-2xl bg-violet-100 p-3 text-violet-700">medication</span>
          </div>

          {Object.keys(medicamentosResumen).length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Object.entries(medicamentosResumen).map(([medicamento, total]) => (
                <article key={medicamento} className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
                  <p className="text-sm font-bold text-slate-900">{medicamento}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {messages.summary.medicationsTakenLabel}: {total}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">{messages.summary.noMedicationData}</p>
          )}
        </section>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{messages.summary.aiSuggestionsTitle}</h3>
              <p className="text-sm text-slate-500">{messages.summary.aiSuggestionsSubtitle}</p>
            </div>
            <span className="material-symbols-outlined rounded-2xl bg-emerald-100 p-3 text-emerald-700">auto_awesome</span>
          </div>

          <p className="mt-4 text-sm text-slate-700">
            {aiSuggestions?.summary ?? messages.summary.aiSuggestionsFallback}
          </p>

          <ul className="mt-4 space-y-2">
            {(aiSuggestions?.suggestions ?? [messages.summary.keepTracking]).map((suggestion) => (
              <li key={suggestion} className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                • {suggestion}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-slate-500">
            {messages.summary.aiSuggestionsDisclaimer}
          </p>
        </section>

        <section className="pt-8 border-t border-slate-100 space-y-5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined rounded-2xl bg-teal-100 p-3 text-teal-700" style={{ fontVariationSettings: "'FILL' 1" }}>biotech</span>
            <div>
              <h3 className="text-xl font-bold text-slate-800">{messages.summary.laboratorySection}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{messages.summary.historySubtitle}</p>
            </div>
          </div>

          {ultimoLaboratorio ? (
            <>
              <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <article className="rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-sky-50 to-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{messages.summary.latestResults}</p>
                      <h4 className="mt-2 text-2xl font-bold text-slate-900">{messages.summary.glycemicProfile}</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        {messages.summary.studyDate}: {new Date(ultimoLaboratorio.fecha_estudio).toLocaleDateString(locale)}
                      </p>
                    </div>
                    <span className="material-symbols-outlined rounded-2xl bg-white/80 p-3 text-cyan-700 shadow-sm">bloodtype</span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">HbA1c</p>
                      <p className="mt-2 text-3xl font-black text-slate-900">{formatLabValue(ultimoLaboratorio.hba1c ? Number(ultimoLaboratorio.hba1c) : null, "%")}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{messages.summary.fastingGlucose}</p>
                      <p className="mt-2 text-3xl font-black text-slate-900">{formatLabValue(ultimoLaboratorio.glucosa_ayuno, "mg/dL")}</p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[2rem] border border-orange-100 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">{messages.summary.latestResults}</p>
                      <h4 className="mt-2 text-2xl font-bold text-slate-900">{messages.summary.lipidProfile}</h4>
                      <p className="mt-1 text-sm text-slate-500">{messages.summary.studyDate}: {new Date(ultimoLaboratorio.fecha_estudio).toLocaleDateString(locale)}</p>
                    </div>
                    <span className="material-symbols-outlined rounded-2xl bg-white/80 p-3 text-orange-700 shadow-sm">monitor_heart</span>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{messages.summary.triglycerides}</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">{formatLabValue(ultimoLaboratorio.trigliceridos, "mg/dL")}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{messages.summary.hdl}</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">{formatLabValue(ultimoLaboratorio.hdl, "mg/dL")}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{messages.summary.ldl}</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">{formatLabValue(ultimoLaboratorio.ldl, "mg/dL")}</p>
                    </div>
                  </div>
                </article>
              </div>

              <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">{messages.summary.historyTitle}</h4>
                    <p className="mt-1 text-sm text-slate-500">{messages.summary.historySubtitle}</p>
                  </div>
                  <span className="material-symbols-outlined rounded-2xl bg-slate-100 p-3 text-slate-700">history</span>
                </div>

                <div className="mt-5 space-y-3">
                  {paciente.laboratorios.map((laboratorio, idx) => {
                    // Combine vision result from current call with DB data if vision is null
                    const visionRes = labVisionResults[idx];
                    const effectiveData = visionRes || {
                      hba1c: laboratorio.hba1c ? Number(laboratorio.hba1c) : null,
                      glucosa_ayuno: laboratorio.glucosa_ayuno ? Number(laboratorio.glucosa_ayuno) : null,
                      trigliceridos: laboratorio.trigliceridos ? Number(laboratorio.trigliceridos) : null,
                      hdl: laboratorio.hdl ? Number(laboratorio.hdl) : null,
                      ldl: laboratorio.ldl ? Number(laboratorio.ldl) : null,
                      insulina: laboratorio.insulina ? Number(laboratorio.insulina) : null,
                      alt: laboratorio.alt ? Number(laboratorio.alt) : null,
                      ast: laboratorio.ast ? Number(laboratorio.ast) : null,
                      tsh: laboratorio.tsh ? Number(laboratorio.tsh) : null,
                      creatinina: laboratorio.creatinina ? Number(laboratorio.creatinina) : null,
                      acido_urico: laboratorio.acido_urico ? Number(laboratorio.acido_urico) : null,
                      pcr_us: laboratorio.pcr_us ? Number(laboratorio.pcr_us) : null,
                    };
                    const chips = buildLabChips(effectiveData, laboratorio, messages.summary.labValues);
                    return (
                      <div
                        key={laboratorio.laboratorio_id}
                        className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {new Date(laboratorio.fecha_estudio).toLocaleDateString(locale)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">{messages.summary.studyDate}</p>
                          </div>
                          {laboratorio.archivo_url && (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-semibold text-teal-700">
                              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                              {messages.summary.aiRead}
                            </span>
                          )}
                        </div>
                        {chips.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {chips.map((chip) => (
                              <span
                                key={chip.label}
                                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                              >
                                <span className="font-bold text-slate-500">{chip.label}</span>
                                <span className="text-slate-800">{chip.value}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">{messages.summary.noValuesAvailable}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            </>
          ) : (
            <article className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <span className="material-symbols-outlined rounded-full bg-teal-50 p-4 text-4xl text-teal-500" style={{ fontVariationSettings: "'FILL' 1" }}>biotech</span>
              <h4 className="mt-4 text-xl font-bold text-slate-900">{messages.summary.noLabs}</h4>
              <p className="mt-2 text-sm text-slate-500">
                {messages.summary.noLabsDescription}
              </p>
            </article>
          )}
        </section>

        <div className="pt-8 border-t border-slate-100">
          <HistorialComidas initialComidas={paciente.comidas} />
        </div>

      </div>
    </div>
  );
}
