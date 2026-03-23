"use client";

import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { getSessionPacienteId } from "@/actions/data";

const comidaSchema = z.object({
  paciente_id: z.string().min(1, "Paciente es requerido"),
  fecha: z.string(),
  hora: z.string(),
  tipo_comida: z.enum(["Desayuno", "Comida", "Cena", "Colacion"]),
  nota: z.string().optional(),
  alimento_principal: z.string().optional(),
});

type FormValues = z.infer<typeof comidaSchema>;

export default function NuevaComida() {
  const [loading, setLoading] = useState(false);
  
  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10);
  const currentTime = now.toTimeString().slice(0, 5);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(comidaSchema),
    defaultValues: {
      fecha: currentDate,
      hora: currentTime,
      tipo_comida: "Desayuno",
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

  const tipo_comida = watch("tipo_comida");

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    console.log("Submit", data);
    setTimeout(() => {
      setLoading(false);
      alert("Comida registrada (simulación)");
    }, 1000);
  };

  const getTipoStyle = (tipo: string) => {
    return tipo_comida === tipo
      ? "bg-white/90 backdrop-blur-md text-primary shadow-lg ring-2 ring-primary border-transparent"
      : "bg-white/20 backdrop-blur-md text-slate-500 border border-slate-300 dark:border-slate-700 dark:text-slate-300 hover:bg-white/50";
  };

  return (
    <div className="relative min-h-screen">
      {/* Simulation Photo Background */}
      <div className="absolute inset-0 z-0">
        <Image
          className="w-full h-full object-cover opacity-60 dark:opacity-40"
          alt="Comida saludable"
          src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80"
          fill
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent"></div>
      </div>

      <header className="fixed top-0 w-full z-40 bg-surface/80 backdrop-blur-xl shadow-sm px-6 h-16 flex items-center gap-3">
        <Link href="/" className="text-on-surface p-2 rounded-full hover:bg-slate-200">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-xl font-bold tracking-tighter text-blue-800">Registrar Comida</h1>
      </header>
      
      <main className="relative z-10 flex flex-col h-full justify-end pt-24 pb-24 md:pb-12 px-6 max-w-2xl mx-auto">
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          <button type="button" onClick={() => setValue("tipo_comida", "Desayuno")} className={`flex-shrink-0 font-bold px-6 py-3 rounded-full active:scale-95 transition-all flex items-center gap-2 ${getTipoStyle("Desayuno")}`}>
            <span className="material-symbols-outlined">breakfast_dining</span> Desayuno
          </button>
          <button type="button" onClick={() => setValue("tipo_comida", "Comida")} className={`flex-shrink-0 font-bold px-6 py-3 rounded-full active:scale-95 transition-all flex items-center gap-2 ${getTipoStyle("Comida")}`}>
            <span className="material-symbols-outlined">restaurant</span> Comida
          </button>
          <button type="button" onClick={() => setValue("tipo_comida", "Cena")} className={`flex-shrink-0 font-bold px-6 py-3 rounded-full active:scale-95 transition-all flex items-center gap-2 ${getTipoStyle("Cena")}`}>
            <span className="material-symbols-outlined">dinner_dining</span> Cena
          </button>
          <button type="button" onClick={() => setValue("tipo_comida", "Colacion")} className={`flex-shrink-0 font-bold px-6 py-3 rounded-full active:scale-95 transition-all flex items-center gap-2 ${getTipoStyle("Colacion")}`}>
            <span className="material-symbols-outlined">cookie</span> Colación
          </button>
        </div>

        <div className="bg-surface-container-lowest/95 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-2xl border border-white/20">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Fecha</label>
                <input
                  type="date"
                  {...register("fecha")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-2xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Hora</label>
                <input
                  type="time"
                  {...register("hora")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-2xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-label-sm font-bold uppercase tracking-widest text-slate-500">
                Alimento Principal / Notas
              </span>
            </div>
            
            <div className="relative">
              <input
                {...register("alimento_principal")}
                className="w-full bg-surface-container-highest/50 border-none rounded-2xl py-4 px-5 text-on-surface placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Ej. Pollo con vegetales"
              />
            </div>

            <div className="relative mt-2 hover:translate-y-px">
              <input
                {...register("nota")}
                className="w-full bg-surface-container-highest/50 border-none rounded-2xl py-4 px-5 text-on-surface placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="¿Cómo te sentiste? (opcional)"
              />
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full mt-6 bg-gradient-to-r from-primary to-primary-container text-white font-bold py-5 rounded-2xl shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                {loading ? "hourglass_empty" : "check_circle"}
              </span>
              <span className="text-lg">{loading ? "Guardando..." : "Guardar Registro"}</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
