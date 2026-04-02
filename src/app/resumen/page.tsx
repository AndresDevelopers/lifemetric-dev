import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ExpandableSuggestions from "@/components/resumen/ExpandableSuggestions";
import HistorialComidas from "@/components/resumen/HistorialComidas";
import SummaryHeader from "@/components/resumen/SummaryHeader";
import { buildClinicalSuggestions, extractLabValuesFromImage } from "@/lib/ai/gemini";
import { unstable_cache } from "next/cache";
import { estimateGlucoseFromMeals } from "@/lib/glucoseInference";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_EXPLICIT_COOKIE_NAME,
  getMessages,
  isFoodClassificationInadequate,
  inferLocaleFromRequest,
} from "@/lib/i18n";
import { getPacienteProfileExtras } from "@/lib/pacienteProfile";
import { getSessionPacienteId } from "@/actions/data";
import {
  buildDetectedResultsFromStoredLab,
  buildLabChipsFromDetectedResults,
} from "@/lib/labResults";
import { getSummaryMealHistory } from "@/lib/mealHistoryData";

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

const getCachedLabVision = unstable_cache(
  async (imageUrl: string, locale: "es" | "en") => extractLabValuesFromImage({ imageUrl, locale }),
  ["lab-vision"],
  { revalidate: 86400 }
);

const LAB_VISION_TIMEOUT_MS = 2500;

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, nestedValue]) => `"${key}":${stableSerialize(nestedValue)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function computePayloadHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}

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
  const locale = inferLocaleFromRequest({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    explicitCookie: cookieStore.get(LOCALE_EXPLICIT_COOKIE_NAME)?.value,
    acceptLanguage: headerStore.get('accept-language'),
    country: headerStore.get('x-vercel-ip-country') ?? headerStore.get('cf-ipcountry'),
    city: headerStore.get('x-vercel-ip-city') ?? headerStore.get('cf-ipcity'),
  });
  const messages = getMessages(locale);
  
  const pacienteId = await getSessionPacienteId();
  if (!pacienteId) {
    redirect('/login');
  }

  const hoy = new Date();
  const unaSemanaAtras = new Date();
  unaSemanaAtras.setDate(hoy.getDate() - 7);

  const startDate = fromParam ? new Date(fromParam + 'T00:00:00Z') : unaSemanaAtras;
  const endDate = toParam ? new Date(toParam + 'T23:59:59Z') : hoy;

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const [paciente, profileExtras, latestHabit, earliestHabit, recentMealHistory] = await Promise.all([
    prisma.paciente.findUnique({
      where: { paciente_id: pacienteId },
      select: {
        nombre: true,
        apellido: true,
        edad: true,
        sexo: true,
        peso_inicial_kg: true,
        cintura_inicial_cm: true,
        habitos: {
          where: { fecha: { gte: startDate, lte: endDate } }
        },
        laboratorios: {
          orderBy: { fecha_estudio: 'desc' },
          take: 10
        },
        medicacion: {
          where: { fecha: { gte: startDate, lte: endDate } }
        },
        glucosa: {
          where: { fecha: { gte: startDate, lte: endDate } },
          include: { comida_relacionada: true }
        }
      }
    }),
    getPacienteProfileExtras(pacienteId),
    prisma.habito.findFirst({
      where: { paciente_id: pacienteId, peso_kg: { not: null } },
      orderBy: { fecha: 'desc' }
    }),
    prisma.habito.findFirst({
      where: { paciente_id: pacienteId },
      orderBy: { fecha: 'asc' }
    }),
    getSummaryMealHistory(pacienteId),
  ]);

  if (!paciente) {
    redirect('/login');
  }

  type LaboratorioItem = (typeof paciente.laboratorios)[number];

  const ultimaHba1c = paciente.laboratorios?.[0]?.hba1c ? Number(paciente.laboratorios[0].hba1c) : 0;
  const ultimoLaboratorio = paciente.laboratorios[0] ?? null;
  const latestLabOverall = paciente.laboratorios[0] ?? null;
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const isLabDataOlderThanThreeMonths = latestLabOverall
    ? new Date(latestLabOverall.fecha_estudio) < ninetyDaysAgo
    : false;

  const allLaboratorios = paciente.laboratorios;
  
  // Intentar extracción IA solo para el laboratorio más reciente faltante
  // y con timeout para no bloquear el render de la página.
  const labVisionResults = new Map<string, Awaited<ReturnType<typeof extractLabValuesFromImage>>>();
  const latestPendingLab = paciente.laboratorios.find(
    (lab: (typeof paciente.laboratorios)[number]) =>
      lab.archivo_url &&
      lab.hba1c == null &&
      lab.glucosa_ayuno == null &&
      (!lab.resultados_detectados || !Array.isArray(lab.resultados_detectados) || lab.resultados_detectados.length === 0),
  );

  if (latestPendingLab?.archivo_url) {
    try {
      const result = await Promise.race([
        getCachedLabVision(latestPendingLab.archivo_url, locale),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), LAB_VISION_TIMEOUT_MS)),
      ]);

      if (result) {
        labVisionResults.set(latestPendingLab.laboratorio_id, result);
        await prisma.laboratorio.update({
          where: { laboratorio_id: latestPendingLab.laboratorio_id },
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
            resultados_detectados: result.resultados_detectados,
          }
        });
      }
    } catch {}
  }

  const latestVisionResult = ultimoLaboratorio
    ? labVisionResults.get(ultimoLaboratorio.laboratorio_id)
    : null;
  const latestDetectedResults = ultimoLaboratorio
    ? buildDetectedResultsFromStoredLab(
        {
          standardValues: {
            hba1c: latestVisionResult?.hba1c ?? (ultimoLaboratorio.hba1c ? Number(ultimoLaboratorio.hba1c) : null),
            glucosa_ayuno: latestVisionResult?.glucosa_ayuno ?? ultimoLaboratorio.glucosa_ayuno,
            trigliceridos: latestVisionResult?.trigliceridos ?? ultimoLaboratorio.trigliceridos,
            hdl: latestVisionResult?.hdl ?? ultimoLaboratorio.hdl,
            ldl: latestVisionResult?.ldl ?? ultimoLaboratorio.ldl,
            insulina: latestVisionResult?.insulina ?? (ultimoLaboratorio.insulina ? Number(ultimoLaboratorio.insulina) : null),
            alt: latestVisionResult?.alt ?? ultimoLaboratorio.alt,
            ast: latestVisionResult?.ast ?? ultimoLaboratorio.ast,
            tsh: latestVisionResult?.tsh ?? (ultimoLaboratorio.tsh ? Number(ultimoLaboratorio.tsh) : null),
            creatinina: latestVisionResult?.creatinina ?? (ultimoLaboratorio.creatinina ? Number(ultimoLaboratorio.creatinina) : null),
            acido_urico: latestVisionResult?.acido_urico ?? (ultimoLaboratorio.acido_urico ? Number(ultimoLaboratorio.acido_urico) : null),
            pcr_us: latestVisionResult?.pcr_us ?? (ultimoLaboratorio.pcr_us ? Number(ultimoLaboratorio.pcr_us) : null),
          },
          detectedResults: latestVisionResult?.resultados_detectados ?? ultimoLaboratorio.resultados_detectados,
        },
        messages.summary.labValues,
      )
    : [];
  
  const promedioGlucosa = paciente.glucosa.length 
    ? Math.round(paciente.glucosa.reduce((acc: number, curr: (typeof paciente.glucosa)[number]) => acc + curr.valor_glucosa, 0) / paciente.glucosa.length)
    : 0;

  const filteredComidas = recentMealHistory.filter((c: (typeof recentMealHistory)[number]) => {
    return c.fecha >= startDateStr && c.fecha <= endDateStr;
  });
  const comidasRegistradas = filteredComidas.length;
  const comidasInadecuadasCount = filteredComidas.filter((c: (typeof filteredComidas)[number]) => isFoodClassificationInadequate(c.clasificacion_final)).length;
  const comidasInadecuadas = filteredComidas.filter((c: (typeof filteredComidas)[number]) => isFoodClassificationInadequate(c.clasificacion_final)); 
  const glucosaEstimadaPorComida = estimateGlucoseFromMeals(
    filteredComidas.map((item: (typeof filteredComidas)[number]) => ({
      carbohidratos_g: item.carbohidratos_g,
      fibra_g: item.fibra_g,
      proteina_g: item.proteina_g,
      clasificacion_final: item.clasificacion_final,
    })),
  );
  const promedioGlucosaConFallback = promedioGlucosa > 0 ? promedioGlucosa : (glucosaEstimadaPorComida ?? 0);
  const diasEjercicio = paciente.habitos.filter((h: (typeof paciente.habitos)[number]) => (h.ejercicio_min || 0) > 0).length;
  const promedioSueno = paciente.habitos.length 
    ? Math.round(paciente.habitos.reduce((acc: number, curr: (typeof paciente.habitos)[number]) => acc + Number(curr.sueno_horas || 0), 0) / paciente.habitos.length * 10) / 10
    : 0;
  
  const promedioAgua = paciente.habitos.length 
    ? Math.round(paciente.habitos.reduce((acc: number, curr: (typeof paciente.habitos)[number]) => acc + (curr.agua_vasos || 0), 0) / paciente.habitos.length)
    : 0;

  const tomasProgramadas = paciente.medicacion.length;
  const tomasRealizadas = paciente.medicacion.filter((m: (typeof paciente.medicacion)[number]) => m.estado_toma === 'Tomada' || m.estado_toma === 'tomada').length;
  const adherenciaMedicacion = tomasProgramadas === 0 ? 0 : Math.round((tomasRealizadas / tomasProgramadas) * 100);
  const medicacionTomadaResumen = tomasProgramadas === 0 ? "--" : `${tomasRealizadas}/${tomasProgramadas}`;
  const hasAlertData =
    paciente.glucosa.length > 0 ||
    filteredComidas.length > 0 ||
    paciente.habitos.length > 0 ||
    paciente.medicacion.length > 0 ||
    paciente.laboratorios.length > 0;

  // Detectar alertas reales: glucosa alta o trigliceridos altos
  const tieneGlucosaAlta = paciente.glucosa.some((g: (typeof paciente.glucosa)[number]) => g.valor_glucosa > 140) || 
    (!paciente.glucosa.length && (glucosaEstimadaPorComida ?? 0) > 140);
  
  const tieneTrigliceridosAltos = allLaboratorios.some((lab: typeof allLaboratorios[number]) => 
    lab.trigliceridos != null && Number(lab.trigliceridos) > 200
  );
  
  const tieneAlertaReal = tieneGlucosaAlta || tieneTrigliceridosAltos;
  const mostrarAlerta = hasAlertData && tieneAlertaReal;

  const medicamentosResumen = (paciente.medicacion as Array<{ medicamento?: string | null }>).reduce((acc: Record<string, number>, item) => {
    const key = item.medicamento?.trim() || "Sin nombre";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});


  let alertaPrincipal: string | null = null;
  if (hasAlertData) {
    const tienePicos = paciente.glucosa.some((g: (typeof paciente.glucosa)[number]) => g.valor_glucosa > 140) || 
                      (!paciente.glucosa.length && (glucosaEstimadaPorComida ?? 0) > 140);
    alertaPrincipal = tienePicos ? messages.summary.glucosePeaks : messages.summary.glucoseInRange;
  }

  const weightActual = latestHabit?.peso_kg ? Number(latestHabit.peso_kg) : null;
  const cinturaActual = latestHabit?.cintura_cm ? Number(latestHabit.cintura_cm) : null;
  const suenoActual = latestHabit?.sueno_horas ? Number(latestHabit.sueno_horas) : null;

  const weightInicial = paciente.peso_inicial_kg ? Number(paciente.peso_inicial_kg) : (earliestHabit?.peso_kg ? Number(earliestHabit.peso_kg) : null);
  const cinturaInicial = paciente.cintura_inicial_cm ? Number(paciente.cintura_inicial_cm) : (earliestHabit?.cintura_cm ? Number(earliestHabit.cintura_cm) : null);
  const suenoInicial = earliestHabit?.sueno_horas ? Number(earliestHabit.sueno_horas) : null;

  const hba1cInicial = [...paciente.laboratorios].reverse().find((laboratorio: LaboratorioItem) => laboratorio.hba1c != null)?.hba1c ?? null;
  const hba1cActual = paciente.laboratorios.find((laboratorio: LaboratorioItem) => laboratorio.hba1c != null)?.hba1c ?? null;
  
  const glucosaInicial = [...paciente.laboratorios].reverse().find((laboratorio: LaboratorioItem) => laboratorio.glucosa_ayuno != null)?.glucosa_ayuno ?? null;
  const glucosaActual = paciente.laboratorios.find((laboratorio: LaboratorioItem) => laboratorio.glucosa_ayuno != null)?.glucosa_ayuno ?? null;

  const data = {
    paciente: `${paciente.nombre} ${paciente.apellido}`,
    edad: paciente.edad ?? null,
    sexo: paciente.sexo ?? null,
    altura_cm: profileExtras.altura_cm ?? null,
    motivo_registro: profileExtras.motivo_registro ?? null,
    fecha_nacimiento: profileExtras.fecha_nacimiento
      ? profileExtras.fecha_nacimiento.toISOString().split("T")[0]
      : null,
    ultima_hba1c: ultimaHba1c,
    promedio_glucosa: promedioGlucosaConFallback,
    comidas: {
      registradas_semana: comidasRegistradas,
      inadecuadas: comidasInadecuadasCount,
      inadecuadas_list: comidasInadecuadas,
    },
    habitos: {
      dias_ejercicio: diasEjercicio,
      promedio_sueno: promedioSueno,
      promedio_agua: promedioAgua,
    },
    adherencia_medicacion_pct: adherenciaMedicacion,
    alerta_principal: alertaPrincipal,
    evolution: {
      diagnostico_inicial: profileExtras.motivo_registro ?? null,
      producto_permitido: profileExtras.producto_permitido_registro ?? null,
      peso_inicial: weightInicial,
      peso_actual: weightActual,
      cintura_inicial: cinturaInicial,
      cintura_actual: cinturaActual,
      sueno_inicial: suenoInicial,
      sueno_actual: suenoActual,
      hba1c_inicial: hba1cInicial ? Number(hba1cInicial) : null,
      hba1c_actual: hba1cActual ? Number(hba1cActual) : null,
      glucosa_inicial: glucosaInicial ? Number(glucosaInicial) : null,
      glucosa_actual: glucosaActual ? Number(glucosaActual) : null,
    },
  };

  const aiSuggestionPayload = {
    ...data,
    medicamentos: medicamentosResumen,
    tiene_habitos: paciente.habitos.length > 0,
    tiene_medicacion: paciente.medicacion.length > 0,
    tiene_laboratorios: allLaboratorios.length > 0,
    // Usar todos los laboratorios (no solo los de la semana) para contexto de IA
    // Incluir TODOS los valores de laboratorio disponibles para mejor contexto de IA
    laboratorios: allLaboratorios.map((item: typeof allLaboratorios[number]) => ({
      fecha: item.fecha_estudio,
      hba1c: item.hba1c ? Number(item.hba1c) : null,
      glucosa_ayuno: item.glucosa_ayuno,
      trigliceridos: item.trigliceridos,
      hdl: item.hdl,
      ldl: item.ldl,
      insulina: item.insulina ? Number(item.insulina) : null,
      alt: item.alt ? Number(item.alt) : null,
      ast: item.ast ? Number(item.ast) : null,
      tsh: item.tsh ? Number(item.tsh) : null,
      creatinina: item.creatinina ? Number(item.creatinina) : null,
      acido_urico: item.acido_urico ? Number(item.acido_urico) : null,
      pcr_us: item.pcr_us ? Number(item.pcr_us) : null,
      resultados_detectados: buildDetectedResultsFromStoredLab(
        {
          standardValues: {
            hba1c: item.hba1c ? Number(item.hba1c) : null,
            glucosa_ayuno: item.glucosa_ayuno,
            trigliceridos: item.trigliceridos,
            hdl: item.hdl,
            ldl: item.ldl,
            insulina: item.insulina ? Number(item.insulina) : null,
            alt: item.alt,
            ast: item.ast,
            tsh: item.tsh ? Number(item.tsh) : null,
            creatinina: item.creatinina ? Number(item.creatinina) : null,
            acido_urico: item.acido_urico ? Number(item.acido_urico) : null,
            pcr_us: item.pcr_us ? Number(item.pcr_us) : null,
          },
          detectedResults: item.resultados_detectados,
        },
        messages.summary.labValues,
      ).map((result) => ({
        nombre: result.label,
        valor: result.value,
        unidad: result.unit ?? null,
      })),
    })),
    comidas_recientes: filteredComidas.slice(0, 5).map((item: (typeof filteredComidas)[number]) => ({
      alimento_principal: item.alimento_principal,
      nota: item.nota,
      foto_url: item.foto_url,
      clasificacion_final: item.clasificacion_final,
      carbohidratos_g: item.carbohidratos_g,
      fibra_g: item.fibra_g,
      proteina_g: item.proteina_g,
    })),
    comidas_inadecuadas: data.comidas.inadecuadas_list.map((item: (typeof filteredComidas)[number]) => ({
      alimento_principal: item.alimento_principal,
      nota: item.nota,
      clasificacion_final: item.clasificacion_final,
      fecha: item.fecha,
    })),
    glucosa_real_registrada: paciente.glucosa.length > 0,
    glucosa_estimada_por_comidas: paciente.glucosa.length > 0 ? null : glucosaEstimadaPorComida,
    glucosa_con_relacion_comida: paciente.glucosa
      .filter((g: (typeof paciente.glucosa)[number]) => g.comida_relacionada)
      .map((g: (typeof paciente.glucosa)[number]) => ({
        fecha: g.fecha instanceof Date ? g.fecha.toISOString().split('T')[0] : String(g.fecha).split('T')[0],
        hora: g.hora instanceof Date ? g.hora.toISOString().split('T')[0] + 'T' + g.hora.toISOString().split('T')[1].substring(0, 5) : null,
        tipo: g.tipo_glucosa,
        valor: g.valor_glucosa,
        clasificacion: g.clasificacion_glucosa,
        comida_alimento_principal: g.comida_relacionada?.alimento_principal,
        comida_tipo: g.comida_relacionada?.tipo_comida,
        comida_carbohidratos_g: g.comida_relacionada?.carbohidratos_g ? Number(g.comida_relacionada.carbohidratos_g) : null,
        comida_proteina_g: g.comida_relacionada?.proteina_g ? Number(g.comida_relacionada.proteina_g) : null,
        comida_grasa_g: g.comida_relacionada?.grasa_g ? Number(g.comida_relacionada.grasa_g) : null,
        comida_kcal: g.comida_relacionada?.kcal_estimadas,
        comida_clasificacion: g.comida_relacionada?.clasificacion_final,
      })),
  };

  const rangeFromDate = new Date(`${startDateStr}T00:00:00.000Z`);
  const rangeToDate = new Date(`${endDateStr}T00:00:00.000Z`);
  const summaryPayloadHash = computePayloadHash(aiSuggestionPayload);

  let cachedSummary: {
    payload_hash: string;
    suggestions: unknown;
  } | null = null;

  try {
    cachedSummary = await prisma.summaryAiCache.findUnique({
      where: {
        paciente_id_locale_range_from_range_to: {
          paciente_id: pacienteId,
          locale,
          range_from: rangeFromDate,
          range_to: rangeToDate,
        },
      },
      select: {
        payload_hash: true,
        suggestions: true,
      },
    });
  } catch {
    cachedSummary = null;
  }

  let aiSuggestions: Awaited<ReturnType<typeof buildClinicalSuggestions>> | null = null;
  const hasValidPersistentSummary =
    cachedSummary &&
    cachedSummary.payload_hash === summaryPayloadHash &&
    cachedSummary.suggestions != null;

  if (cachedSummary && hasValidPersistentSummary) {
    aiSuggestions = cachedSummary.suggestions as Awaited<ReturnType<typeof buildClinicalSuggestions>>;
  } else {
    try {
      const generatedSuggestions = await buildClinicalSuggestions({ locale, data: aiSuggestionPayload });
      aiSuggestions = generatedSuggestions;

      try {
        await prisma.summaryAiCache.upsert({
          where: {
            paciente_id_locale_range_from_range_to: {
              paciente_id: pacienteId,
              locale,
              range_from: rangeFromDate,
              range_to: rangeToDate,
            },
          },
          update: {
            payload_hash: summaryPayloadHash,
            suggestions: generatedSuggestions,
          },
          create: {
            paciente_id: pacienteId,
            locale,
            range_from: rangeFromDate,
            range_to: rangeToDate,
            payload_hash: summaryPayloadHash,
            suggestions: generatedSuggestions,
          },
        });
      } catch {}
    } catch {
      aiSuggestions = (cachedSummary?.suggestions as Awaited<ReturnType<typeof buildClinicalSuggestions>> | null) ?? null;
    }
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
            className="absolute right-8 bottom-8 bg-white/20 hover:bg-white/30 backdrop-blur-md p-3 rounded-full transition-all border border-white/20 group"
            title={messages.summary.exportToSheets}
          >
            <span className="material-symbols-outlined text-white group-hover:scale-110 transition-transform">download_for_offline</span>
          </a>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-400/30 p-2 rounded-xl backdrop-blur-sm">
                  <span className="material-symbols-outlined text-blue-200">patient_list</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{data.paciente}</h1>
                <span className="bg-green-500/20 text-green-300 text-xs font-medium px-2.5 py-1 rounded-full border border-green-500/30">
                  {messages.summary.aiRead}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-blue-100/80">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  <span className="text-sm font-medium">{data.edad} {messages.common.yearsOld}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-blue-100/30 self-center"></div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">person</span>
                  <span className="text-sm font-medium">{data.sexo}</span>
                </div>
                {data.altura_cm && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-blue-100/30 self-center"></div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">straighten</span>
                      <span className="text-sm font-medium">{data.altura_cm} cm</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mt-4 md:mt-0 md:pr-20">
              {data.evolution.diagnostico_inicial && (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/20">
                  <span className="text-xs text-white font-medium">{data.evolution.diagnostico_inicial}</span>
                </div>
              )}
              {data.evolution.producto_permitido && (
                <div className="bg-green-500/20 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-green-500/30">
                  <span className="material-symbols-outlined text-green-300 text-sm">check_circle</span>
                  <span className="text-xs text-green-100 font-medium ml-1">{data.evolution.producto_permitido}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-green-100 p-3 rounded-2xl">
                <span className="material-symbols-outlined text-green-600 text-2xl">workspace_premium</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 leading-tight text-lg">{messages.summary.evolution.currentStatus}</h3>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Peso Logro */}
                {data.evolution.peso_inicial && data.evolution.peso_actual && (
                  <div className="bg-green-50/50 rounded-2xl p-4 border border-green-100 flex flex-col justify-center items-center text-center transition-all hover:bg-green-50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-2">{messages.summary.evolution.weightChange}</p>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase leading-none mb-1">{messages.summary.evolution.initialMeasure}</span>
                        <span className="text-slate-600 font-black text-xl">{data.evolution.peso_inicial}kg</span>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 text-sm">arrow_forward</span>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase leading-none mb-1">{messages.summary.evolution.currentMeasure}</span>
                        <span className="text-green-600 font-black text-xl">{data.evolution.peso_actual}kg</span>
                      </div>
                    </div>
                    {data.evolution.peso_actual < data.evolution.peso_inicial && (
                      <p className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold mt-1">
                        {messages.summary.evolution.reducedWeight}
                      </p>
                    )}
                  </div>
                )}



                {/* Cintura Logro */}
                {data.evolution.cintura_inicial && data.evolution.cintura_actual && (
                  <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100 flex flex-col justify-center items-center text-center transition-all hover:bg-orange-50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-2">{messages.summary.evolution.waistChange}</p>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase leading-none mb-1">{messages.summary.evolution.initialMeasure}</span>
                        <span className="text-slate-600 font-black text-xl">{data.evolution.cintura_inicial}cm</span>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 text-sm">arrow_forward</span>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase leading-none mb-1">{messages.summary.evolution.currentMeasure}</span>
                        <span className="text-orange-600 font-black text-xl">{data.evolution.cintura_actual}cm</span>
                      </div>
                    </div>
                    {data.evolution.cintura_actual < data.evolution.cintura_inicial && (
                      <p className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold mt-1">
                        {messages.summary.evolution.reducedWaist}
                      </p>
                    )}
                  </div>
                )}

                {/* Sueño Logro */}
                {data.evolution.sueno_inicial && data.evolution.sueno_actual && (
                  <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex flex-col justify-center items-center text-center transition-all hover:bg-blue-50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-2">{messages.summary.evolution.sleepImprovement}</p>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase leading-none mb-1">{messages.summary.evolution.initialMeasure}</span>
                        <span className="text-slate-600 font-black text-xl">{data.evolution.sueno_inicial}h</span>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 text-sm">arrow_forward</span>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase leading-none mb-1">{messages.summary.evolution.currentMeasure}</span>
                        <span className="text-blue-600 font-black text-xl">{data.evolution.sueno_actual}h</span>
                      </div>
                    </div>
                    {data.evolution.sueno_actual > data.evolution.sueno_inicial && (
                      <p className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold mt-1">
                        {messages.summary.evolution.stabilizedSleep}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 transition-all hover:bg-emerald-100/50">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-emerald-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                  <div className="flex flex-col">
                    <p className="text-xs text-emerald-800 font-bold mb-1">Impacto de {data.evolution.producto_permitido || 'Lifemetric'}:</p>
                    <p className="text-xs text-slate-700 italic leading-relaxed">
                      {aiSuggestions?.evolutionMessage || (
                        (data.evolution.peso_actual && data.evolution.peso_inicial && data.evolution.peso_actual < data.evolution.peso_inicial)
                          ? `Lograste bajar ${Math.round((data.evolution.peso_inicial - data.evolution.peso_actual) * 10) / 10} kg gracias al producto y tu constancia. ${messages.summary.evolution.evolutionPositive}`
                          : messages.summary.evolution.evolutionStatic
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {mostrarAlerta && (
          <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 shadow-sm mt-6">
            <div className="flex gap-3 mb-2">
              <span className="material-symbols-outlined text-rose-500 mt-1" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              <div>
                <h3 className="font-bold text-rose-900">{messages.summary.mainAlert}</h3>
                <p className="text-rose-800/80 text-sm mt-1">{data.alerta_principal ?? messages.summary.waitingForAlertData}</p>
              </div>
            </div>
          </div>
        )}

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
            <div className="flex items-end gap-1"><span className="text-3xl font-black text-slate-800">{medicacionTomadaResumen}</span></div>
            <span className="text-[11px] font-semibold text-slate-400 mt-1">{data.adherencia_medicacion_pct}%</span>
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
              {Object.entries(medicamentosResumen as Record<string, number>).map(([medicamento, total]: [string, number]) => (
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

          <ExpandableSuggestions
            showMoreLabel={messages.summary.showMore}
            showLessLabel={messages.summary.showLess}
          >
          <p className="mt-4 text-sm text-slate-700">
            {aiSuggestions?.summary ? aiSuggestions.summary : messages.summary.aiSuggestionsFallback}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {aiSuggestions?.centralProblems?.length ? (
              <article className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-600">{messages.summary.centralProblems}</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-800">
                  {aiSuggestions.centralProblems.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </article>
            ) : null}
            {aiSuggestions?.priorityPlan?.length ? (
              <article className="rounded-xl bg-blue-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-wider text-blue-700">{messages.summary.priorityPlan}</p>
                <ul className="mt-2 space-y-1 text-sm text-blue-900">
                  {aiSuggestions.priorityPlan.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </article>
            ) : null}
            {aiSuggestions?.nutritionFocus?.length ? (
              <article className="rounded-xl bg-emerald-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700">{messages.summary.nutritionFocus}</p>
                <ul className="mt-2 space-y-1 text-sm text-emerald-900">
                  {aiSuggestions.nutritionFocus.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </article>
            ) : null}
            {aiSuggestions?.lifestyleFocus?.length ? (
              <article className="rounded-xl bg-violet-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-wider text-violet-700">{messages.summary.lifestyleFocus}</p>
                <ul className="mt-2 space-y-1 text-sm text-violet-900">
                  {aiSuggestions.lifestyleFocus.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </article>
            ) : null}
          </div>

          {aiSuggestions?.recommendedLabs?.length ? (
            <article className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wider text-cyan-700">{messages.summary.recommendedLabs}</p>
              <ul className="mt-2 space-y-1 text-sm text-cyan-900">
                {aiSuggestions.recommendedLabs.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </article>
          ) : null}

          {aiSuggestions?.productsGuidance?.length ? (
            <article className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wider text-rose-700">{messages.summary.productsGuidance}</p>
              <ul className="mt-2 space-y-1 text-sm text-rose-900">
                {aiSuggestions.productsGuidance.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </article>
          ) : null}

          {aiSuggestions?.expectedProgress?.length ? (
            <article className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wider text-teal-700">{messages.summary.expectedProgress}</p>
              <ul className="mt-2 space-y-1 text-sm text-teal-900">
                {aiSuggestions.expectedProgress.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </article>
          ) : null}

          {aiSuggestions?.patientMessage && (
            <blockquote className="mt-4 rounded-xl border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm text-slate-700 italic">
              “{aiSuggestions.patientMessage}”
            </blockquote>
          )}

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
          </ExpandableSuggestions>
        </section>

        <section className="pt-8 border-t border-slate-100 space-y-5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined rounded-2xl bg-teal-100 p-3 text-teal-700" style={{ fontVariationSettings: "'FILL' 1" }}>biotech</span>
            <div>
              <h3 className="text-xl font-bold text-slate-800">{messages.summary.laboratorySection}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{messages.summary.historySubtitle}</p>
            </div>
          </div>

          {isLabDataOlderThanThreeMonths ? (
            <article className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wider text-amber-700">{messages.summary.labsOutdatedTitle}</p>
              <p className="mt-1 text-sm text-amber-900">{messages.summary.labsOutdatedDescription}</p>
              {latestLabOverall ? (
                <p className="mt-1 text-xs text-amber-700">
                  {messages.summary.studyDate}: {new Date(latestLabOverall.fecha_estudio).toLocaleDateString(locale)}
                </p>
              ) : null}
            </article>
          ) : null}

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
                      <p className="mt-2 text-3xl font-black text-slate-900">
                        {formatLabValue(latestVisionResult?.hba1c ?? (ultimoLaboratorio.hba1c ? Number(ultimoLaboratorio.hba1c) : null), "%")}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{messages.summary.fastingGlucose}</p>
                      <p className="mt-2 text-3xl font-black text-slate-900">
                        {formatLabValue(latestVisionResult?.glucosa_ayuno ?? ultimoLaboratorio.glucosa_ayuno, "mg/dL")}
                      </p>
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
                      <p className="mt-2 text-2xl font-black text-slate-900">
                        {formatLabValue(latestVisionResult?.trigliceridos ?? ultimoLaboratorio.trigliceridos, "mg/dL")}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{messages.summary.hdl}</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">
                        {formatLabValue(latestVisionResult?.hdl ?? ultimoLaboratorio.hdl, "mg/dL")}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{messages.summary.ldl}</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">
                        {formatLabValue(latestVisionResult?.ldl ?? ultimoLaboratorio.ldl, "mg/dL")}
                      </p>
                    </div>
                  </div>
                </article>
              </div>

              <article className="rounded-[2rem] border border-teal-100 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">{messages.summary.latestResults}</p>
                    <h4 className="mt-2 text-2xl font-bold text-slate-900">{messages.summary.scannedResults}</h4>
                    <p className="mt-1 text-sm text-slate-500">
                      {messages.summary.studyDate}: {new Date(ultimoLaboratorio.fecha_estudio).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <span className="material-symbols-outlined rounded-2xl bg-teal-50 p-3 text-teal-700 shadow-sm">lab_profile</span>
                </div>

                {latestDetectedResults.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {buildLabChipsFromDetectedResults(latestDetectedResults).map((chip) => (
                      <span
                        key={`${chip.label}-${chip.value}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        <span className="font-bold text-slate-500">{chip.label}</span>
                        <span className="text-slate-900">{chip.value}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">{messages.summary.noValuesAvailable}</p>
                )}
              </article>

              <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">{messages.summary.historyTitle}</h4>
                    <p className="mt-1 text-sm text-slate-500">{messages.summary.historySubtitle}</p>
                  </div>
                  <span className="material-symbols-outlined rounded-2xl bg-slate-100 p-3 text-slate-700">history</span>
                </div>

                <div className="mt-5 space-y-3">
                  {paciente.laboratorios.map((laboratorio: (typeof paciente.laboratorios)[number]) => {
                    // Combine vision result from current call with DB data if vision is null
                    const visionRes = labVisionResults.get(laboratorio.laboratorio_id);
                    const chips = buildLabChipsFromDetectedResults(
                      buildDetectedResultsFromStoredLab(
                        {
                          standardValues: {
                            hba1c: visionRes?.hba1c ?? (laboratorio.hba1c ? Number(laboratorio.hba1c) : null),
                            glucosa_ayuno: visionRes?.glucosa_ayuno ?? laboratorio.glucosa_ayuno,
                            trigliceridos: visionRes?.trigliceridos ?? laboratorio.trigliceridos,
                            hdl: visionRes?.hdl ?? laboratorio.hdl,
                            ldl: visionRes?.ldl ?? laboratorio.ldl,
                            insulina: visionRes?.insulina ?? (laboratorio.insulina ? Number(laboratorio.insulina) : null),
                            alt: visionRes?.alt ?? laboratorio.alt,
                            ast: visionRes?.ast ?? laboratorio.ast,
                            tsh: visionRes?.tsh ?? (laboratorio.tsh ? Number(laboratorio.tsh) : null),
                            creatinina: visionRes?.creatinina ?? (laboratorio.creatinina ? Number(laboratorio.creatinina) : null),
                            acido_urico: visionRes?.acido_urico ?? (laboratorio.acido_urico ? Number(laboratorio.acido_urico) : null),
                            pcr_us: visionRes?.pcr_us ?? (laboratorio.pcr_us ? Number(laboratorio.pcr_us) : null),
                          },
                          detectedResults: visionRes?.resultados_detectados ?? laboratorio.resultados_detectados,
                        },
                        messages.summary.labValues,
                      ),
                    );
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
                                key={`${chip.label}-${chip.value}`}
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
          <HistorialComidas initialComidas={recentMealHistory} />
        </div>

      </div>
    </div>
  );
}
