"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";

const pacienteSchema = z.object({
  nombre: z.string().min(2, "Obligatorio"),
  apellido: z.string().min(2, "Obligatorio"),
  edad: z.number().min(0).max(120),
  sexo: z.enum(["Masculino", "Femenino", "Otro"]),
  diagnostico_principal: z.string().min(3),
  usa_glucometro: z.boolean(),
  medicacion_base: z.string().optional(),
  peso_inicial_kg: z.number().optional(),
  cintura_inicial_cm: z.number().optional(),
  objetivo_clinico: z.string().optional(),
});

type FormValues = z.infer<typeof pacienteSchema>;

export default function NuevoPaciente() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(pacienteSchema),
  });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    // TODO: Connect to Server Action / Prisma
    console.log("Submit", data);
    setTimeout(() => {
      setLoading(false);
      alert("Paciente guardado (simulación)");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="sticky top-0 w-full z-40 bg-surface/80 backdrop-blur-xl shadow-sm px-6 h-16 flex items-center gap-3 md:hidden">
        <Link href="/" className="text-on-surface p-2 rounded-full hover:bg-slate-200">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
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
                <label htmlFor="nombre" className="text-sm font-semibold text-slate-600">Nombre</label>
                <input
                  id="nombre"
                  {...register("nombre")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej. Juan"
                />
                {errors.nombre && <span className="text-error text-xs">{errors.nombre.message}</span>}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="apellido" className="text-sm font-semibold text-slate-600">Apellido</label>
                <input
                  id="apellido"
                  {...register("apellido")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej. Perez"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="edad" className="text-sm font-semibold text-slate-600">Edad</label>
                <input
                  id="edad"
                  type="number"
                  {...register("edad", { valueAsNumber: true })}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <label htmlFor="sexo" className="text-sm font-semibold text-slate-600">Sexo</label>
                <select
                  id="sexo"
                  {...register("sexo")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <label htmlFor="diagnostico_principal" className="text-sm font-semibold text-slate-600">Diagnóstico Principal</label>
                <input
                  id="diagnostico_principal"
                  {...register("diagnostico_principal")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej. Diabetes tipo 2"
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-3">
                <input
                  id="usa_glucometro"
                  type="checkbox"
                  {...register("usa_glucometro")}
                  className="w-5 h-5 rounded text-primary border-outline-variant focus:ring-primary/20 transition-all"
                />
                <label htmlFor="usa_glucometro" className="text-sm font-semibold text-slate-600">¿Usa glucómetro?</label>
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <label htmlFor="medicacion_base" className="text-sm font-semibold text-slate-600">Medicación Base</label>
                <input
                  id="medicacion_base"
                  {...register("medicacion_base")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej. Metformina 850 mg"
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
