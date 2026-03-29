"use server";

import { generateGeminiText } from "@/lib/ai/gemini";
import { getSessionPaciente } from "@/actions/data";
import { checkRateLimit } from "@/lib/redis";
import { getPromoProductGuidance } from "@/lib/productCatalog";
import { prisma } from "@/lib/prisma";

function formatDate(value?: Date | null): string {
  return value ? value.toISOString().split('T')[0] : 'N/D';
}

function formatMaybe(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === '') return 'N/D';
  const normalized = typeof value === 'object' ? String(value) : value;
  return unit ? `${normalized} ${unit}` : String(normalized);
}

export async function chatWithAIAction(userMessage: string, chatHistory: { role: 'user' | 'ai', content: string }[] = []) {
  try {
    const session = await getSessionPaciente();
    if (!session) {
      return { success: false, text: "No autorizado" };
    }

    const isAllowed = await checkRateLimit(`chat_api:${session.email}`);
    if (!isAllowed) {
      return { success: false, text: "Por el momento hay demasiadas consultas. Por favor, intenta de nuevo en unos segundos." };
    }

    const patientSnapshot = await prisma.paciente.findUnique({
      where: { paciente_id: session.paciente_id },
      include: {
        glucosa: {
          orderBy: [{ fecha: 'desc' }, { hora: 'desc' }],
          take: 8,
        },
        habitos: {
          orderBy: { fecha: 'desc' },
          take: 7,
        },
        laboratorios: {
          orderBy: { fecha_estudio: 'desc' },
          take: 4,
        },
        medicacion: {
          orderBy: [{ fecha: 'desc' }, { hora_toma: 'desc' }],
          take: 12,
        },
        comidas: {
          orderBy: [{ fecha: 'desc' }, { hora: 'desc' }],
          take: 8,
        },
      },
    });

    if (!patientSnapshot) {
      return { success: false, text: "No se encontró el perfil clínico del paciente." };
    }

    const latestLab = await prisma.laboratorio.findFirst({
      where: { paciente_id: session.paciente_id },
      orderBy: { fecha_estudio: 'desc' },
      select: { fecha_estudio: true },
    });
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
    const labDataIsOutdated = latestLab ? new Date(latestLab.fecha_estudio) < threeMonthsAgo : true;

    // Build context-aware prompt with system instructions
    const historyContext = chatHistory.length > 0
      ? chatHistory.map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n')
      : '';

    const latestGlucose = patientSnapshot.glucosa[0] ?? null;
    const latestHabits = patientSnapshot.habitos[0] ?? null;
    const latestMedicationEntries = patientSnapshot.medicacion.slice(0, 5);
    const latestMeals = patientSnapshot.comidas.slice(0, 5);
    const latestLabs = patientSnapshot.laboratorios.slice(0, 3);

    const medicationSummary = latestMedicationEntries.length
      ? latestMedicationEntries.map((item: (typeof latestMedicationEntries)[number]) => `- ${formatDate(item.fecha)} ${item.hora ? new Date(item.hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''} | ${item.medicamento ?? 'N/D'} | ${item.dosis ?? 'N/D'} | estado: ${item.estado_toma ?? 'N/D'}`).join('\n')
      : '- Sin registros recientes.';

    const mealSummary = latestMeals.length
      ? latestMeals.map((item: (typeof latestMeals)[number]) => `- ${formatDate(item.fecha)} ${item.hora ?? ''} | ${item.tipo_comida ?? 'N/D'} | ${item.alimento_principal ?? 'N/D'}`).join('\n')
      : '- Sin registros recientes.';

    const labsSummary = latestLabs.length
      ? latestLabs.map((item: (typeof latestLabs)[number]) => `- ${formatDate(item.fecha_estudio)} | HbA1c: ${formatMaybe(item.hba1c, '%')} | Glucosa ayuno: ${formatMaybe(item.glucosa_ayuno, 'mg/dL')} | TG: ${formatMaybe(item.trigliceridos, 'mg/dL')} | HDL: ${formatMaybe(item.hdl, 'mg/dL')} | LDL: ${formatMaybe(item.ldl, 'mg/dL')}`).join('\n')
      : '- Sin laboratorios cargados.';
    
    const fullPrompt = `Eres un asistente de salud metabólica especializado en diabetes para la aplicación Lifemetric. 
Tu objetivo es ayudar al usuario (${session.nombre}) con dudas sobre su metabolismo, alimentación, hábitos y el uso de la app.

REGLAS CRÍTICAS:
1. Responde de manera cálida, profesional y empoderadora.
2. SIEMPRE aclara que tus sugerencias son EDUCATIVAS y NO reemplazan el consejo médico profesional.
3. Si el usuario pregunta cosas fuera de salud/bienestar, redirígelo amablemente a temas de salud.
4. Mantén las respuestas concisas pero útiles.
5. En recomendaciones comerciales, usa solo productos permitidos y NUNCA menciones productos restringidos.
6. Si la persona NO toma medicación activa y el contexto clínico lo permite, puedes reforzar el uso prudente de productos permitidos como apoyo (siempre con disclaimer médico).
7. Si el usuario pregunta sobre exámenes o laboratorios y detectas que sus resultados están desactualizados (más de 3 meses), recomienda actualizarse con un nuevo examen.

MARCO DE PRODUCTOS:
${getPromoProductGuidance('es')}

CONTEXTO DE LABORATORIOS DEL PACIENTE:
- Último laboratorio registrado: ${latestLab ? new Date(latestLab.fecha_estudio).toISOString().split('T')[0] : 'Sin registros'}.
- ¿Está desactualizado (>3 meses)?: ${labDataIsOutdated ? 'Sí' : 'No'}.

SNAPSHOT CLÍNICO COMPLETO DEL PACIENTE:
- Nombre: ${patientSnapshot.nombre} ${patientSnapshot.apellido}
- Sexo: ${formatMaybe(patientSnapshot.sexo)}
- Edad: ${formatMaybe(patientSnapshot.edad, 'años')}
- Diagnóstico principal: ${formatMaybe(patientSnapshot.diagnostico_principal)}
- Objetivo clínico: ${formatMaybe(patientSnapshot.objetivo_clinico)}
- Medicación base: ${formatMaybe(patientSnapshot.medicacion_base)}
- Peso inicial: ${formatMaybe(patientSnapshot.peso_inicial_kg, 'kg')}
- Cintura inicial: ${formatMaybe(patientSnapshot.cintura_inicial_cm, 'cm')}

Última glucosa:
- Fecha: ${latestGlucose ? formatDate(latestGlucose.fecha) : 'N/D'}
- Valor: ${latestGlucose ? formatMaybe(latestGlucose.valor_glucosa, 'mg/dL') : 'N/D'}
- Momento: ${latestGlucose?.momento_dia ?? 'N/D'}

Últimos hábitos:
- Fecha: ${latestHabits ? formatDate(latestHabits.fecha) : 'N/D'}
- Agua: ${latestHabits ? formatMaybe(latestHabits.agua_vasos, 'vasos') : 'N/D'}
- Sueño: ${latestHabits ? formatMaybe(latestHabits.sueno_horas, 'h') : 'N/D'}
- Ejercicio: ${latestHabits ? formatMaybe(latestHabits.ejercicio_min, 'min') : 'N/D'}

Medicaciones recientes:
${medicationSummary}

Comidas recientes:
${mealSummary}

Laboratorios recientes:
${labsSummary}

Contexto del chat anterior:
${historyContext}

Usuario: ${userMessage}
Asistente:`;

    const result = await generateGeminiText({ 
      prompt: fullPrompt,
      temperature: 0.7,
      maxOutputTokens: 512
    });

    return { success: true, text: result };
  } catch (error) {
    console.error("Chat Action Error:", error);
    return { success: false, text: "Error procesando el chat" };
  }
}
