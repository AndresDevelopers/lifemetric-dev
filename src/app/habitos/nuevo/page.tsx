"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { getSessionPacienteId } from "@/actions/data";
import { useLocale } from "@/components/providers/LocaleProvider";

const habitosSchema = z.object({
  paciente_id: z.string().min(1, "Paciente es requerido"),
  fecha: z.string(),
  sueno_horas: z.number().min(0).max(24),
  agua_vasos: z.number().min(0),
  ejercicio_min: z.number().min(0),
  pa_sistolica: z.number().min(0).optional(),
  pa_diastolica: z.number().min(0).optional(),
  pulso: z.number().min(0).optional(),
  peso_kg: z.number().min(0).optional(),
});

type FormValues = z.infer<typeof habitosSchema>;

export default function NuevoHabito() {
  const [loading, setLoading] = useState(false);
  const { messages } = useLocale();
  const habitsMessages = messages.habitsForm;
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(habitosSchema),
    defaultValues: {
      fecha: new Date().toISOString().slice(0, 10),
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

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    console.log("Submit", data);
    setTimeout(() => {
      setLoading(false);
      alert(habitsMessages.success);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-on-surface p-2 rounded-full hover:bg-slate-200">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tighter text-blue-800">{habitsMessages.title}</h1>
        </div>
      </header>
      
      <div className="p-6 md:p-10 max-w-2xl mx-auto pb-32 md:pb-12">
        <div className="md:mb-8 text-center md:text-left mb-6">
          <h2 className="text-3xl font-bold text-slate-800">{habitsMessages.heading}</h2>
          <p className="text-slate-500 mt-2">{habitsMessages.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="bg-surface-container-lowest/95 backdrop-blur-2xl rounded-3xl p-6 shadow-xl border border-white/50">
            <div className="flex items-center gap-4 mb-4">
              <span className="material-symbols-outlined text-4xl text-blue-400 bg-blue-50 p-3 rounded-full">water_drop</span>
              <div>
                <h3 className="font-bold text-lg"><label htmlFor="agua_vasos">{habitsMessages.water}</label></h3>
                <p className="text-xs text-slate-500">{habitsMessages.waterHint}</p>
              </div>
            </div>
            <input
              id="agua_vasos"
              type="number"
              {...register("agua_vasos", { valueAsNumber: true })}
              className="w-full bg-surface border-none rounded-xl py-4 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 text-center text-xl font-bold transition-all"
              placeholder="0"
            />
          </div>

          <div className="bg-surface-container-lowest/95 backdrop-blur-2xl rounded-3xl p-6 shadow-xl border border-white/50">
            <div className="flex items-center gap-4 mb-4">
              <span className="material-symbols-outlined text-4xl text-indigo-400 bg-indigo-50 p-3 rounded-full">bedtime</span>
              <div>
                <h3 className="font-bold text-lg"><label htmlFor="sueno_horas">{habitsMessages.sleep}</label></h3>
                <p className="text-xs text-slate-500">{habitsMessages.sleepHint}</p>
              </div>
            </div>
            <input
              id="sueno_horas"
              type="number" step="0.5"
              {...register("sueno_horas", { valueAsNumber: true })}
              className="w-full bg-surface border-none rounded-xl py-4 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 text-center text-xl font-bold transition-all"
              placeholder="Ej. 7.5"
            />
          </div>

          <div className="bg-surface-container-lowest/95 backdrop-blur-2xl rounded-3xl p-6 shadow-xl border border-white/50">
            <div className="flex items-center gap-4 mb-4">
              <span className="material-symbols-outlined text-4xl text-orange-400 bg-orange-50 p-3 rounded-full">fitness_center</span>
              <div>
                <h3 className="font-bold text-lg">{habitsMessages.exercise}</h3>
                <p className="text-xs text-slate-500">{habitsMessages.exerciseHint}</p>
              </div>
            </div>
            <input
              type="number"
              {...register("ejercicio_min", { valueAsNumber: true })}
              className="w-full bg-surface border-none rounded-xl py-4 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 text-center text-xl font-bold transition-all"
              placeholder="Ej. 30"
            />
          </div>

          <div className="bg-surface-container-lowest/95 backdrop-blur-2xl rounded-3xl p-6 shadow-xl border border-white/50">
            <div className="flex items-center gap-4 mb-4">
              <span className="material-symbols-outlined text-4xl text-rose-400 bg-rose-50 p-3 rounded-full">favorite</span>
              <div>
                <h3 className="font-bold text-lg">{habitsMessages.vitals}</h3>
                <p className="text-xs text-slate-500">{habitsMessages.vitalsHint}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">{habitsMessages.systolic}</label>
                <input
                  type="number"
                  {...register("pa_sistolica", { valueAsNumber: true })}
                  className="w-full bg-surface border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all text-center"
                  placeholder="120"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">{habitsMessages.diastolic}</label>
                <input
                  type="number"
                  {...register("pa_diastolica", { valueAsNumber: true })}
                  className="w-full bg-surface border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all text-center"
                  placeholder="80"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">{habitsMessages.pulse}</label>
                <input
                  type="number"
                  {...register("pulso", { valueAsNumber: true })}
                  className="w-full bg-surface border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all text-center"
                  placeholder="70"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">{habitsMessages.weight}</label>
                <input
                  type="number" step="0.1"
                  {...register("peso_kg", { valueAsNumber: true })}
                  className="w-full bg-surface border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all text-center"
                  placeholder="75.5"
                />
              </div>
            </div>
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full mt-4 bg-gradient-to-r from-primary to-primary-container text-white font-bold py-5 rounded-2xl shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <span className="material-symbols-outlined">{loading ? "hourglass_empty" : "check_circle"}</span>
            <span className="text-lg">{loading ? habitsMessages.submitting : habitsMessages.submit}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
