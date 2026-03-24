"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { createPacienteAction } from "@/actions/paciente";
import { useRouter } from "next/navigation";

export const pacienteSchema = z.object({
  nombre: z.string().min(2, "Obligatorio"),
  apellido: z.string().min(2, "Obligatorio"),
  email: z.string().email("Email inválido"),
  edad: z.number().min(0, "Mínimo 0").max(120, "Máximo 120"),
  sexo: z.enum(["Masculino", "Femenino", "Otro"]),
  diagnostico_principal: z.string().min(3, "Mínimo 3 caracteres"),
  usa_glucometro: z.boolean(),
  medicacion_base: z.string().optional(),
  peso_inicial_kg: z.number().optional(),
  cintura_inicial_cm: z.number().optional(),
  objetivo_clinico: z.string().optional(),
});

export type FormValues = z.infer<typeof pacienteSchema>;

export default function NuevoPaciente() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(pacienteSchema),
    defaultValues: {
      usa_glucometro: false,
    }
  });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      const result = await createPacienteAction(data);
      if (result.success) {
        alert("Paciente guardado exitosamente");
        router.push("/resumen");
      } else {
        alert(result.error || "Error al guardar el paciente");
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="sticky top-0 w-full z-40 bg-surface/80 backdrop-blur-xl shadow-sm px-6 h-16 flex items-center gap-3 md:hidden">
        <a href="/" className="text-on-surface p-2 rounded-full hover:bg-slate-200">
          <span className="material-symbols-outlined">arrow_back</span>
        </a>
        <h1 className="text-xl font-bold tracking-tighter text-blue-800">Alta de Paciente</h1>
      </header>
      
      <div className="p-6 md:p-10 max-w-2xl mx-auto">
        <div className="hidden md:block mb-8">
          <h1 className="text-3xl font-bold text-blue-900">Alta de Paciente</h1>
          <p className="text-slate-500 mt-2">Danos los datos iniciales para el seguimiento.</p>
        </div>

        <div className="bg-surface-container-lowest/95 backdrop-blur-2xl rounded-[2rem] p-6 shadow-2xl border border-white/20">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Nombre</label>
                <input
                  {...register("nombre")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej. Juan"
                />
                {errors.nombre && <span className="text-error text-xs">{errors.nombre.message}</span>}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Apellido</label>
                <input
                  {...register("apellido")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej. Perez"
                />
                {errors.apellido && <span className="text-error text-xs">{errors.apellido.message}</span>}
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Correo Electrónico</label>
                <input
                  type="email"
                  {...register("email")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="ejemplo@correo.com"
                />
                {errors.email && <span className="text-error text-xs">{errors.email.message}</span>}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Edad</label>
                <input
                  type="number"
                  {...register("edad", { valueAsNumber: true })}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {errors.edad && <span className="text-error text-xs">{errors.edad.message}</span>}
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Sexo</label>
                <select
                  {...register("sexo")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
                {errors.sexo && <span className="text-error text-xs">{errors.sexo.message}</span>}
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Diagnóstico Principal</label>
                <input
                  {...register("diagnostico_principal")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej. Diabetes tipo 2"
                />
                {errors.diagnostico_principal && <span className="text-error text-xs">{errors.diagnostico_principal.message}</span>}
              </div>

              <div className="md:col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  {...register("usa_glucometro")}
                  className="w-5 h-5 rounded text-primary border-outline-variant focus:ring-primary/20 transition-all"
                />
                <label className="text-sm font-semibold text-slate-600">¿Usa glucómetro?</label>
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Medicación Base</label>
                <input
                  {...register("medicacion_base")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej. Metformina 850 mg"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Peso Inicial (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("peso_inicial_kg", { valueAsNumber: true })}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Cintura Inicial (cm)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("cintura_inicial_cm", { valueAsNumber: true })}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Objetivo Clínico</label>
                <textarea
                  {...register("objetivo_clinico")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej. Control de niveles de glucosa en ayuno"
                  rows={3}
                />
              </div>

            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full mt-4 bg-gradient-to-r from-primary to-primary-container text-white font-bold py-4 rounded-xl shadow-lg hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">{loading ? "hourglass_empty" : "check_circle"}</span>
              {loading ? "Guardando..." : "Registrar Paciente"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
