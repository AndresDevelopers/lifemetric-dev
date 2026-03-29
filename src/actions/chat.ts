"use server";

import { generateGeminiText } from "@/lib/ai/gemini";
import { getSessionPaciente } from "@/actions/data";
import { checkRateLimit } from "@/lib/redis";
import { getPromoProductGuidance } from "@/lib/productCatalog";
import { prisma } from "@/lib/prisma";

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
