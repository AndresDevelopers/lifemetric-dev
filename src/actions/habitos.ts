'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionPacienteId } from '@/actions/data';
import { invalidateOnDataChange } from '@/lib/cache-invalidation';

const guardarHabitoSchema = z.object({
  paciente_id: z.string().uuid(),
  fecha: z.string().min(1),
  hora: z.string().min(1),
  sueno_horas: z.number().min(0).max(24),
  agua_vasos: z.number().min(0),
  ejercicio_min: z.number().min(0),
  pa_sistolica: z.number().min(0).optional(),
  pa_diastolica: z.number().min(0).optional(),
  pulso: z.number().min(0).optional(),
  peso_kg: z.number().min(0).optional(),
});

export async function guardarHabitoAction(input: z.infer<typeof guardarHabitoSchema>) {
  try {
    const sessionPacienteId = await getSessionPacienteId();
    if (!sessionPacienteId || sessionPacienteId !== input.paciente_id) {
      return { success: false, error: 'No autorizado.' };
    }

    const data = guardarHabitoSchema.parse(input);
    const fecha = new Date(`${data.fecha}T00:00:00`);
    const hora = new Date(`1970-01-01T${data.hora}:00`);

    await prisma.habito.create({
      data: {
        paciente_id: data.paciente_id,
        fecha,
        hora,
        sueno_horas: data.sueno_horas,
        agua_vasos: data.agua_vasos,
        ejercicio_min: data.ejercicio_min,
        pa_sistolica: data.pa_sistolica ?? null,
        pa_diastolica: data.pa_diastolica ?? null,
        pulso: data.pulso ?? null,
        peso_kg: data.peso_kg ?? null,
      },
    });

    // Invalidar caché de sugerencias de IA
    await invalidateOnDataChange(data.paciente_id, 'habito');

    return { success: true };
  } catch {
    return { success: false, error: 'No se pudo guardar el hábito.' };
  }
}
