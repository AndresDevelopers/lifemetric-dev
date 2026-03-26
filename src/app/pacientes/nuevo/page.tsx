"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { createPacienteAction } from "@/actions/paciente";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/providers/LocaleProvider";

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
  const { locale, messages } = useLocale();
  const patientMessages = messages.patientForm;
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
        alert(patientMessages.success);
        router.push("/resumen");
      } else {
        const fallbackError = result.error?.includes("correo") ? patientMessages.emailTaken : patientMessages.saveError;
        alert(fallbackError);
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert(patientMessages.unexpectedError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 w-full z-40 bg-surface/80 backdrop-blur-xl shadow-sm px-6 h-16 flex items-center gap-3 md:hidden">
        <Link href="/" className="hidden text-on-surface p-2 rounded-full hover:bg-slate-200">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-xl font-bold tracking-tighter text-blue-800">{patientMessages.title}</h1>
      </header>
      
      <div className="p-6 md:p-10 max-w-2xl mx-auto">
        <div className="hidden md:block mb-8">
          <h1 className="text-3xl font-bold text-blue-900">{patientMessages.title}</h1>
          <p className="text-slate-500 mt-2">{patientMessages.subtitle}</p>
        </div>

        <div className="bg-surface-container-lowest/95 backdrop-blur-2xl rounded-[2rem] p-6 shadow-2xl border border-white/20">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="nombre" className="text-sm font-semibold text-slate-600">{patientMessages.firstName}</label>
                <input
                  id="nombre"
                  {...register("nombre")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder={locale === "es" ? "Ej. Juan" : "E.g. John"}
                />
                {errors.nombre && <span className="text-error text-xs">{errors.nombre.message}</span>}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="apellido" className="text-sm font-semibold text-slate-600">{patientMessages.lastName}</label>
                <input
                  id="apellido"
                  {...register("apellido")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder={locale === "es" ? "Ej. Pérez" : "E.g. Perez"}
                />
                {errors.apellido && <span className="text-error text-xs">{errors.apellido.message}</span>}
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">{patientMessages.email}</label>
                <input
                  type="email"
                  {...register("email")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder={locale === "es" ? "ejemplo@correo.com" : "example@email.com"}
                />
                {errors.email && <span className="text-error text-xs">{errors.email.message}</span>}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="edad" className="text-sm font-semibold text-slate-600">{patientMessages.age}</label>
                <input
                  id="edad"
                  type="number"
                  {...register("edad", { valueAsNumber: true })}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {errors.edad && <span className="text-error text-xs">{errors.edad.message}</span>}
              </div>
              
              <div className="flex flex-col gap-2">
                <label htmlFor="sexo" className="text-sm font-semibold text-slate-600">{patientMessages.sex}</label>
                <select
                  id="sexo"
                  {...register("sexo")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="Masculino">{patientMessages.male}</option>
                  <option value="Femenino">{patientMessages.female}</option>
                  <option value="Otro">{patientMessages.other}</option>
                </select>
                {errors.sexo && <span className="text-error text-xs">{errors.sexo.message}</span>}
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <label htmlFor="diagnostico_principal" className="text-sm font-semibold text-slate-600">{patientMessages.diagnosis}</label>
                <input
                  id="diagnostico_principal"
                  {...register("diagnostico_principal")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder={locale === "es" ? "Ej. Diabetes tipo 2" : "E.g. Type 2 diabetes"}
                />
                {errors.diagnostico_principal && <span className="text-error text-xs">{errors.diagnostico_principal.message}</span>}
              </div>

              <div className="md:col-span-2 flex items-center gap-3">
                <input
                  id="usa_glucometro"
                  type="checkbox"
                  {...register("usa_glucometro")}
                  className="w-5 h-5 rounded text-primary border-outline-variant focus:ring-primary/20 transition-all"
                />
                <label htmlFor="usa_glucometro" className="text-sm font-semibold text-slate-600">{patientMessages.usesGlucoseMeter}</label>
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <label htmlFor="medicacion_base" className="text-sm font-semibold text-slate-600">{patientMessages.baselineMedication}</label>
                <input
                  id="medicacion_base"
                  {...register("medicacion_base")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder={locale === "es" ? "Ej. Metformina 850 mg" : "E.g. Metformin 850 mg"}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">{patientMessages.initialWeight}</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("peso_inicial_kg", { valueAsNumber: true })}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">{patientMessages.initialWaist}</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("cintura_inicial_cm", { valueAsNumber: true })}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">{patientMessages.clinicalGoal}</label>
                <textarea
                  {...register("objetivo_clinico")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder={locale === "es" ? "Ej. Control de niveles de glucosa en ayuno" : "E.g. Control fasting glucose levels"}
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
              {loading ? patientMessages.submitting : patientMessages.submit}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
