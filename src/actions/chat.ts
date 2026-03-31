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
8. Si el usuario pide ayuda para usar la app, guialo con pasos concretos usando los modulos disponibles (Inicio, Comidas, Glucosa, Habitos, Medicacion, Laboratorios, Resumen, Ajustes).
9. Si el usuario pide ayuda para navegar o completar una tarea dentro de Lifemetric, incluye siempre la pantalla actual, la ruta exacta, pasos numerados y que hacer si ya esta en la pantalla correcta.
10. No inventes modulos, rutas ni botones. Usa solo el mapa funcional entregado.

MARCO DE PRODUCTOS:
${getPromoProductGuidance(locale)}

MAPA FUNCIONAL DE LA APP:
${appNavigationContext}

DATOS COMPLETOS DEL PACIENTE DISPONIBLES PARA EL CHAT:
${patientContext}

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
8. If the user asks for help using the app, guide them with concrete steps using the available modules (Home, Food, Glucose, Habits, Medication, Labs, Summary, Settings).
9. If the user asks for help navigating or completing a task inside Lifemetric, always include the current screen, the exact route, numbered steps, and what to do if they are already on the correct screen.
10. Do not invent modules, routes, or buttons. Use only the provided functional map.

PRODUCT GUIDANCE:
${getPromoProductGuidance(locale)}

APP FUNCTIONAL MAP:
${appNavigationContext}

FULL PATIENT DATA AVAILABLE FOR CHAT:
${patientContext}

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
