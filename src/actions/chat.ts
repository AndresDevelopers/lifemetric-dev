"use server";

import { getSessionPaciente } from "@/actions/data";
import { generateGeminiText } from "@/lib/ai/gemini";
import {
  buildAppNavigationContext,
  getContextualChatActions,
  normalizeAppPath,
  type ChatNavigationAction,
} from "@/lib/appNavigation";
import { buildPatientChatContext } from "@/lib/chatContext";
import { getMessages, normalizeLocale } from "@/lib/i18n";
import { getPacienteProfileExtras } from "@/lib/pacienteProfile";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/redis";
import { getPromoProductGuidance } from "@/lib/productCatalog";

function buildPatientRiskSignals(
  laboratorios: Array<{
    ldl: number | null;
    trigliceridos: number | null;
    hdl: number | null;
    glucosa_ayuno: number | null;
    hba1c: unknown;
  }>,
): string {
  const hasHighLdl = laboratorios.some((lab) => lab.ldl != null && lab.ldl >= 130);
  const hasHighTriglycerides = laboratorios.some((lab) => lab.trigliceridos != null && lab.trigliceridos >= 150);
  const hasLowHdl = laboratorios.some((lab) => lab.hdl != null && lab.hdl < 40);
  const hasHighFastingGlucose = laboratorios.some((lab) => lab.glucosa_ayuno != null && lab.glucosa_ayuno >= 100);
  const hasHighHba1c = laboratorios.some((lab) => {
    if (lab.hba1c == null) return false;
    const numericHba1c = Number(lab.hba1c);
    return Number.isFinite(numericHba1c) && numericHba1c >= 5.7;
  });

  return [
    `LDL alto detectado: ${hasHighLdl ? "Sí" : "No"}`,
    `Triglicéridos altos detectados: ${hasHighTriglycerides ? "Sí" : "No"}`,
    `HDL bajo detectado: ${hasLowHdl ? "Sí" : "No"}`,
    `Glucosa en ayuno elevada detectada: ${hasHighFastingGlucose ? "Sí" : "No"}`,
    `HbA1c elevada detectada: ${hasHighHba1c ? "Sí" : "No"}`,
  ].join("\n");
}

export async function chatWithAIAction(
  userMessage: string,
  chatHistory: { role: "user" | "ai"; content: string }[] = [],
  imageUrl?: string,
  currentPath?: string | null,
  localeInput?: string | null,
): Promise<{ success: boolean; text: string; actions?: ChatNavigationAction[] }> {
  try {
    const locale = normalizeLocale(localeInput);
    const chatMessages = getMessages(locale).chat;
    const session = await getSessionPaciente();
    if (!session) {
      return { success: false, text: chatMessages.unauthorized };
    }

    const isAllowed = await checkRateLimit(`chat_api:${session.email}`);
    if (!isAllowed) {
      return {
        success: false,
        text: chatMessages.rateLimited,
      };
    }

    const patientSnapshot = await prisma.paciente.findUnique({
      where: { paciente_id: session.paciente_id },
      include: {
        glucosa: {
          orderBy: [{ fecha: "desc" }, { hora: "desc" }],
          include: {
            comida_relacionada: true,
          },
        },
        habitos: {
          orderBy: { fecha: "desc" },
        },
        laboratorios: {
          orderBy: { fecha_estudio: "desc" },
        },
        medicacion: {
          orderBy: [{ fecha: "desc" }, { hora: "desc" }],
        },
        comidas: {
          orderBy: [{ fecha: "desc" }, { hora: "desc" }],
        },
      },
    });

    if (!patientSnapshot) {
      return { success: false, text: chatMessages.missingProfile };
    }

    const profileExtras = await getPacienteProfileExtras(session.paciente_id);
    const latestLabDate = patientSnapshot.laboratorios[0]?.fecha_estudio ?? null;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
    const labDataIsOutdated = latestLabDate ? new Date(latestLabDate) < threeMonthsAgo : true;

    const historyContext =
      chatHistory.length > 0
        ? chatHistory
            .map(
              (message) =>
                `${message.role === "user" ? chatMessages.historyUserLabel : chatMessages.historyAssistantLabel}: ${message.content}`,
            )
            .join("\n")
        : "";
    const normalizedCurrentPath = normalizeAppPath(currentPath);
    const appNavigationContext = buildAppNavigationContext(locale, normalizedCurrentPath);
    const contextualActions = getContextualChatActions(locale, normalizedCurrentPath, userMessage);

    const patientContext = buildPatientChatContext({
      patientSnapshot,
      profileExtras,
      latestLabDate,
      labDataIsOutdated,
    });
    const riskSignals = buildPatientRiskSignals(patientSnapshot.laboratorios);
    const imageContext = imageUrl
      ? locale === "es"
        ? `El usuario adjuntó una imagen en este turno: Sí (${imageUrl}).`
        : `The user attached an image in this turn: Yes (${imageUrl}).`
      : locale === "es"
        ? "El usuario adjuntó una imagen en este turno: No."
        : "The user attached an image in this turn: No.";

    const fullPrompt =
      locale === "es"
        ? `Eres un asistente de salud metabolica especializado en diabetes para la aplicacion Lifemetric.
Tu objetivo es ayudar al usuario (${session.nombre}) con dudas sobre su metabolismo, alimentacion, habitos y el uso de la app.
Debes responder SIEMPRE en espanol porque ese es el idioma configurado actualmente en la app del usuario.

REGLAS CRITICAS:
1. Responde de manera calida, profesional y empoderadora.
2. SIEMPRE aclara que tus sugerencias son EDUCATIVAS y NO reemplazan el consejo medico profesional.
3. Si el usuario pregunta cosas fuera de salud/bienestar, redirigelo amablemente a temas de salud.
4. Manten las respuestas concisas pero utiles.
5. En recomendaciones comerciales, usa solo productos permitidos y NUNCA menciones productos restringidos.
6. Si la persona NO toma medicacion activa y el contexto clinico lo permite, puedes reforzar el uso prudente de productos permitidos como apoyo (siempre con disclaimer medico).
7. Si el usuario pregunta sobre examenes o laboratorios y detectas que sus resultados estan desactualizados (mas de 3 meses), recomienda actualizarse con un nuevo examen.
8. Solo si el usuario pide ayuda para usar la app, un tutorial o pregunta donde hacer algo, guialo con pasos concretos usando los modulos disponibles (Inicio, Comidas, Glucosa, Habitos, Medicacion, Laboratorios, Resumen, Ajustes).
9. Solo si el usuario pide ayuda para navegar o completar una tarea dentro de Lifemetric, incluye la pantalla actual, la ruta exacta, pasos numerados y que hacer si ya esta en la pantalla correcta.
10. No menciones el widget del chat, tutoriales, rutas ni botones de forma proactiva en respuestas clinicas o informativas. Solo dirigelo dentro de la app cuando lo pida explicitamente.
11. No inventes modulos, rutas ni botones. Usa solo el mapa funcional entregado.
12. Si los laboratorios estan desactualizados (>3 meses), incluye SIEMPRE una recomendacion breve para actualizar examenes y aclara que el panel exacto lo define su doctor.
13. Si hay imagen adjunta (comida o medicacion), describe primero lo que observas y luego personaliza la recomendacion cruzando con TODO el contexto clinico del paciente (laboratorios, glucosa, habitos, medicacion). Si hay riesgo (ej. colesterol alto), mencionalo de forma clara y accionable.
14. ANALISIS DE RESPUESTA GLUCEMICA: Cuando en el historial de glucosa aparezca el patron "TRAS COMER", significa que esa lectura de glucosa fue tomada DESPUES de consumir esa comida especifica. USA ESTE PATRON PARA IDENTIFICAR QUE ALIMENTOS PROVOCAN RESPUESTAS GLUCEMICAS ALTAS O BAJAS en el paciente. Si ves que un paciente tiene glucosa elevada "TRAS COMER" ciertos alimentos con alto contenido de carbohidratos o clasificacion inadecuada, mencionaselo al usuario y sugiere alternativas. Este es tu mecanismo de aprendizaje para dar mejores recomendaciones nutricionales.
15. Si en los laboratorios existen "otros resultados detectados" u otros analitos extraidos por IA, usalos activamente para personalizar tus recomendaciones y explicaciones al paciente.

MARCO DE PRODUCTOS:
${getPromoProductGuidance(locale)}

MAPA FUNCIONAL DE LA APP:
${appNavigationContext}

DATOS COMPLETOS DEL PACIENTE DISPONIBLES PARA EL CHAT:
${patientContext}

SEÑALES CLINICAS RESUMIDAS:
${riskSignals}

CONTEXTO DE IMAGEN DEL TURNO:
${imageContext}

Contexto del chat anterior:
${historyContext}

Ruta activa reportada por el cliente: ${normalizedCurrentPath}

Usuario: ${userMessage}
Asistente:`
        : `You are a metabolic health assistant specialized in diabetes for the Lifemetric app.
Your goal is to help the user (${session.nombre}) with questions about metabolism, nutrition, habits, and how to use the app.
You must ALWAYS reply in English because that is the language currently configured in the user's app.

CRITICAL RULES:
1. Respond in a warm, professional, and empowering way.
2. ALWAYS clarify that your suggestions are EDUCATIONAL and DO NOT replace professional medical advice.
3. If the user asks about topics outside health or wellbeing, gently redirect them back to health-related topics.
4. Keep answers concise but useful.
5. For commercial recommendations, use only allowed products and NEVER mention restricted products.
6. If the person is not taking active medication and the clinical context allows it, you may cautiously reinforce allowed products as support, always with a medical disclaimer.
7. If the user asks about tests or labs and you detect their results are outdated (older than 3 months), recommend getting updated tests.
8. Only if the user asks for help using the app, requests a tutorial, or asks where to do something should you guide them with concrete steps using the available modules (Home, Food, Glucose, Habits, Medication, Labs, Summary, Settings).
9. Only if the user asks for help navigating or completing a task inside Lifemetric should you include the current screen, the exact route, numbered steps, and what to do if they are already on the correct screen.
10. Do not proactively mention the chat widget, tutorials, routes, or buttons in clinical or informational answers. Only direct the user inside the app when they explicitly ask for it.
11. Do not invent modules, routes, or buttons. Use only the provided functional map.
12. If labs are outdated (>3 months), ALWAYS include a brief recommendation to update labs and clarify the exact panel should be defined by the doctor.
13. If there is an attached image (food or medication), first describe what you observe and then personalize guidance using ALL available patient context (labs, glucose, habits, medication). If there is a risk signal (e.g., high cholesterol), mention it clearly and actionably.
14. GLUCEMIC RESPONSE ANALYSIS: When the glucose history shows the pattern "TRAS COMER" (AFTER EATING), it means that glucose reading was taken AFTER consuming that specific meal. USE THIS PATTERN TO IDENTIFY WHICH FOODS CAUSE HIGH OR LOW GLUCEMIC RESPONSES in the patient. If you see a patient has elevated glucose "AFTER EATING" certain foods with high carbohydrate content or inadequate classification, tell the user and suggest alternatives. This is your learning mechanism to provide better nutritional recommendations.
15. If the lab history includes "other detected results" or extra analytes extracted by AI, actively use them to personalize your recommendations and explanations for the patient.

PRODUCT GUIDANCE:
${getPromoProductGuidance(locale)}

APP FUNCTIONAL MAP:
${appNavigationContext}

FULL PATIENT DATA AVAILABLE FOR CHAT:
${patientContext}

SUMMARIZED CLINICAL SIGNALS:
${riskSignals}

TURN IMAGE CONTEXT:
${imageContext}

Previous chat context:
${historyContext}

Active route reported by the client: ${normalizedCurrentPath}

User: ${userMessage}
Assistant:`;

    const result = await generateGeminiText({
      prompt: fullPrompt,
      imageUrl,
      temperature: 0.7,
      maxOutputTokens: 1024,
    });

    return { success: true, text: result, actions: contextualActions };
  } catch (error) {
    console.error("Chat Action Error:", error);
    return { success: false, text: getMessages(normalizeLocale(localeInput)).chat.errorProcessing };
  }
}
