"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { getSessionPacienteId } from "@/actions/data";
import { useLocale } from "@/components/providers/LocaleProvider";

const labSchema = z.object({
  paciente_id: z.string().min(1, "Paciente es requerido"),
  fecha_estudio: z.string(),
  hba1c: z.number().min(0).max(20).optional(),
  glucosa_ayuno: z.number().min(0).max(1000).optional(),
  trigliceridos: z.number().min(0).max(2000).optional(),
  hdl: z.number().min(0).max(300).optional(),
  ldl: z.number().min(0).max(1000).optional(),
  archivo_url: z.string().optional()
});

type FormValues = z.infer<typeof labSchema>;

export default function SubirLaboratorios() {
  const [loading, setLoading] = useState(false);
  const { messages } = useLocale();
  const labsMessages = messages.labsForm;
  const now = new Date();
  
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(labSchema),
    defaultValues: {
      fecha_estudio: now.toISOString().slice(0, 10),
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
      alert(labsMessages.success);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="hidden md:flex text-on-surface p-2 rounded-full hover:bg-slate-200">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tighter text-blue-800">{labsMessages.title}</h1>
        </div>
      </header>

      <div className="p-6 md:p-10 max-w-2xl mx-auto pb-32 md:pb-12">
        <div className="bg-surface-container-lowest/95 backdrop-blur-2xl rounded-[2rem] p-6 shadow-2xl border border-white/50">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            <div className="text-center pb-4">
              <span className="material-symbols-outlined text-5xl text-teal-600 bg-teal-50 p-4 rounded-full mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>
                science
              </span>
              <h2 className="text-2xl font-bold text-slate-800">{labsMessages.heading}</h2>
              <p className="text-slate-500 text-sm mt-1">{labsMessages.subtitle}</p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="fecha_estudio" className="text-sm font-semibold text-slate-600">{labsMessages.studyDate}</label>
              <input
                id="fecha_estudio"
                type="date"
                {...register("fecha_estudio")}
                className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>

            <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100">
              <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">bloodtype</span>
                {labsMessages.glycemicProfile}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="hba1c" className="text-xs font-semibold text-slate-600">HbA1c (%)</label>
                  <input
                    id="hba1c"
                    type="number" step="0.1"
                    {...register("hba1c", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    placeholder="Ej. 6.5"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="glucosa_ayuno" className="text-xs font-semibold text-slate-600">{labsMessages.fastingGlucose}</label>
                  <input
                    id="glucosa_ayuno"
                    type="number"
                    {...register("glucosa_ayuno", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    placeholder="Ej. 110"
                  />
                </div>
              </div>
            </div>

            <div className="bg-orange-50/50 p-5 rounded-3xl border border-orange-100 mt-4">
              <h3 className="font-bold text-orange-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">monitor_heart</span>
                {labsMessages.lipidProfile}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="trigliceridos" className="text-xs font-semibold text-slate-600">{labsMessages.triglycerides}</label>
                  <input
                    id="trigliceridos"
                    type="number"
                    {...register("trigliceridos", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                    placeholder="mg/dL"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="hdl" className="text-xs font-semibold text-slate-600">{labsMessages.hdl}</label>
                  <input
                    id="hdl"
                    type="number"
                    {...register("hdl", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                    placeholder="mg/dL"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="ldl" className="text-xs font-semibold text-slate-600">{labsMessages.ldl}</label>
                  <input
                    id="ldl"
                    type="number"
                    {...register("ldl", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                    placeholder="mg/dL"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <label htmlFor="archivo_input" className="text-sm font-semibold text-slate-600">{labsMessages.attachResults}</label>
              <div className="w-full border-2 border-dashed border-teal-200 rounded-3xl p-8 hover:bg-teal-50 transition-colors flex flex-col items-center justify-center cursor-pointer text-teal-600">
                <span className="material-symbols-outlined text-4xl mb-2">upload_file</span>
                <span className="text-sm font-bold">{labsMessages.clickToUpload}</span>
                <span className="text-xs text-teal-500/70 mt-1">{labsMessages.uploadHint}</span>
                <input id="archivo_input" type="file" className="hidden" />
              </div>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full mt-8 bg-gradient-to-r from-teal-600 to-teal-800 text-white font-bold py-5 rounded-2xl shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined">{loading ? "hourglass_empty" : "upload"}</span>
              <span className="text-lg">{loading ? labsMessages.submitting : labsMessages.submit}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
