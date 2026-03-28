"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { pacienteSchema } from "@/app/pacientes/nuevo/page";
import { z } from "zod";

export async function createPacienteAction(rawData: unknown) {
  try {
    // Server-side validation
    const validatedData = pacienteSchema.parse(rawData);

    // Use environment variable for default password if available, otherwise fallback to a secure default
    const defaultPassword = process.env.DEFAULT_PATIENT_PASSWORD || "Lifemetric2025!";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const newPaciente = await prisma.paciente.create({
      data: {
        nombre: validatedData.nombre,
        apellido: validatedData.apellido,
        email: validatedData.email,
        password_hash: hashedPassword,
        edad: validatedData.edad,
        sexo: validatedData.sexo,
        diagnostico_principal: validatedData.diagnostico_principal,
        usa_glucometro: validatedData.usa_glucometro,
        medicacion_base: validatedData.medicacion_base,
        peso_inicial_kg: validatedData.peso_inicial_kg,
        cintura_inicial_cm: validatedData.cintura_inicial_cm,
        objetivo_clinico: validatedData.objetivo_clinico,
        activo: true,
      },
    });

    return { success: true, id: newPaciente.paciente_id };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Datos de formulario inválidos." };
    }

    console.error("Error creating paciente:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && (error as Prisma.PrismaClientKnownRequestError).code === "P2002") {
      return { success: false, error: "El correo electrónico ya está registrado." };
    }

    return { success: false, error: "Error al crear el paciente." };
  }
}
