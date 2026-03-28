"use client";

import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { getSessionPacienteId } from "@/actions/data";
import { useLocale } from "@/components/providers/LocaleProvider";

const medicacionSchema = z.object({
  paciente_id: z.string().min(1, "Paciente es requerido"),
  fecha: z.string(),
  hora: z.string(),
  medicamento: z.string().min(2, "Obligatorio"),
  dosis: z.string().min(1, "Obligatorio"),
  estado_toma: z.enum(["tomada", "olvidada", "omitida_por_efecto", "retrasada"]),
  comentarios: z.string().optional()
});

type FormValues = z.infer<typeof medicacionSchema>;

export default function NuevaMedicacion() {
  const [loading, setLoading] = useState(false);
  const { locale, messages } = useLocale();
  const medicationMessages = messages.medicationForm;
  const now = new Date();
  
  const { register, handleSubmit, setValue, control } = useForm<FormValues>({
    resolver: zodResolver(medicacionSchema),
    defaultValues: {
      fecha: now.toISOString().slice(0, 10),
      hora: now.toTimeString().slice(0, 5),
      estado_toma: "tomada",
      paciente_id: "",
    }
  });

  useEffect(() => {
    async function loadData() {
      const pId = await getSessionPacienteId();
      if (pId) setValue("paciente_id", pId);
    }
    loadData();
  }, [setValue]);

  const estado = useWatch({ control, name: "estado_toma" });

  const getEstadoStyle = (tipo: string) => {
    return estado === tipo
      ? "bg-slate-800 text-white shadow-md ring-2 ring-slate-400 font-bold scale-105"
      : "bg-surface text-slate-500 border border-slate-200 hover:bg-slate-50 font-medium";
  };

  const onSubmit = async () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert(medicationMessages.success);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="hidden md:flex text-on-surface p-2 rounded-full hover:bg-slate-200">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tighter text-blue-800">{medicationMessages.title}</h1>
        </div>
      </header>

      <div className="p-6 md:p-10 max-w-2xl mx-auto pb-32 md:pb-12">
        <div className="bg-surface-container-lowest/95 backdrop-blur-2xl rounded-[2rem] p-6 shadow-2xl border border-white/50">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            <div className="flex items-center gap-4 py-4 mb-2">
              <span className="material-symbols-outlined text-5xl text-blue-500 bg-blue-50 p-4 rounded-full" style={{ fontVariationSettings: "'FILL' 1" }}>
                medication
              </span>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{medicationMessages.heading}</h2>
                <p className="text-slate-500">{medicationMessages.subtitle}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="medicamento" className="text-sm font-semibold text-slate-600">{medicationMessages.medication}</label>
                <input
                  id="medicamento"
                  {...register("medicamento")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  placeholder={locale === 'es' ? 'Ej. Metformina' : 'E.g. Metformin'}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="dosis" className="text-sm font-semibold text-slate-600">{medicationMessages.dose}</label>
                <input
                  id="dosis"
                  {...register("dosis")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  placeholder={locale === 'es' ? 'Ej. 850 mg' : 'E.g. 850 mg'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">{medicationMessages.date}</label>
                <input
                  type="date"
                  {...register("fecha")}
                  className="w-full bg-surface border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">{medicationMessages.intakeTime}</label>
                <input
                  type="time"
                  {...register("hora")}
                  className="w-full bg-surface border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <label className="text-sm font-semibold text-slate-600">{medicationMessages.intakeStatus}</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setValue("estado_toma", "tomada")} className={`py-3 px-2 rounded-xl text-sm transition-all flex justify-center items-center gap-2 ${getEstadoStyle("tomada")}`}>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span> {medicationMessages.taken}
                </button>
                <button type="button" onClick={() => setValue("estado_toma", "retrasada")} className={`py-3 px-2 rounded-xl text-sm transition-all flex justify-center items-center gap-2 ${getEstadoStyle("retrasada")}`}>
                  <span className="material-symbols-outlined text-[18px]">schedule</span> {medicationMessages.delayed}
                </button>
                <button type="button" onClick={() => setValue("estado_toma", "olvidada")} className={`py-3 px-2 rounded-xl text-sm transition-all flex justify-center items-center gap-2 ${getEstadoStyle("olvidada")}`}>
                  <span className="material-symbols-outlined text-[18px]">cancel</span> {medicationMessages.forgotten}
                </button>
                <button type="button" onClick={() => setValue("estado_toma", "omitida_por_efecto")} className={`py-3 px-2 rounded-xl text-sm transition-all flex justify-center items-center gap-2 ${getEstadoStyle("omitida_por_efecto")}`}>
                  <span className="material-symbols-outlined text-[18px]">sick</span> {medicationMessages.omittedEffects}
                </button>
              </div>
            </div>

            {estado !== "tomada" && (
               <div className="relative pt-2">
                <input
                  {...register("comentarios")}
                  className="w-full bg-rose-50 border-none rounded-xl py-4 px-5 text-on-surface placeholder:text-rose-400 focus:ring-2 focus:ring-rose-500/30 transition-all"
                  placeholder={medicationMessages.commentPlaceholder}
                />
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full mt-8 bg-slate-800 text-white font-bold py-5 rounded-2xl shadow-xl hover:bg-slate-900 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined">{loading ? "hourglass_empty" : "save"}</span>
              <span className="text-lg">{loading ? medicationMessages.submitting : medicationMessages.submit}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
