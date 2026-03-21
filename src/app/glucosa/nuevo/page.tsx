"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";

const glucosaSchema = z.object({
  paciente_id: z.string().min(1, "Paciente es requerido"),
  fecha: z.string(),
  hora: z.string(),
  tipo_glucosa: z.enum(["ayuno", "antes_comer", "1h_post", "2h_post"]),
  valor_glucosa: z.number().min(20).max(600),
  comida_relacionada_id: z.string().optional(),
});

type FormValues = z.infer<typeof glucosaSchema>;

export default function NuevaGlucosa() {
  const [loading, setLoading] = useState(false);
  
  const now = new Date();
  
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(glucosaSchema),
    defaultValues: {
      fecha: now.toISOString().slice(0, 10),
      hora: now.toTimeString().slice(0, 5),
      tipo_glucosa: "ayuno",
      paciente_id: "demo-id",
    }
  });

  const tipo_glucosa = watch("tipo_glucosa");

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    console.log("Submit", data);
    
    // Clasifica glucosa según ayuno/post, aquí podríamos aplicar lógica
    setTimeout(() => {
      setLoading(false);
      alert("Glucosa registrada con éxito");
    }, 1000);
  };

  const getTipoStyle = (tipo: string) => {
    return tipo_glucosa === tipo
      ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg ring-2 ring-blue-500/50 scale-105"
      : "bg-surface text-slate-500 border border-slate-200 dark:border-slate-800 hover:bg-slate-50";
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-on-surface p-2 rounded-full hover:bg-slate-200">
            <span className="material-symbols-outlined">arrow_back</span>
          </a>
          <h1 className="text-xl font-bold tracking-tighter text-blue-800">Registrar Glucosa</h1>
        </div>
      </header>
      
      <div className="p-6 md:p-10 max-w-2xl mx-auto pb-32 md:pb-12">
        <div className="bg-surface-container-lowest/95 backdrop-blur-2xl rounded-[2rem] p-6 shadow-2xl border border-white/50">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Medición Input Gigante */}
            <div className="flex flex-col items-center justify-center py-6">
              <label className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">Nivel de glucosa (mg/dL)</label>
              <div className="relative flex items-end justify-center w-full">
                <input
                  type="number"
                  {...register("valor_glucosa", { valueAsNumber: true })}
                  className="w-1/2 bg-transparent border-b-2 border-slate-200 text-center text-6xl font-black text-blue-950 focus:border-blue-500 focus:outline-none focus:ring-0 transition-colors py-2"
                  placeholder="0"
                />
                <span className="absolute right-8 bottom-4 text-slate-400 font-bold">mg/dL</span>
              </div>
              {errors.valor_glucosa && <span className="text-error text-sm mt-3">{errors.valor_glucosa.message}</span>}
            </div>

            {/* Fecha y Hora */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Fecha</label>
                <input
                  type="date"
                  {...register("fecha")}
                  className="w-full bg-surface border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">Hora</label>
                <input
                  type="time"
                  {...register("hora")}
                  className="w-full bg-surface border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Tipo de Lectura */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-600">Momento del día</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setValue("tipo_glucosa", "ayuno")} className={`py-4 rounded-2xl font-bold transition-all ${getTipoStyle("ayuno")}`}>
                  Ayuno
                </button>
                <button type="button" onClick={() => setValue("tipo_glucosa", "antes_comer")} className={`py-4 rounded-2xl font-bold transition-all ${getTipoStyle("antes_comer")}`}>
                  Antes de comer
                </button>
                <button type="button" onClick={() => setValue("tipo_glucosa", "1h_post")} className={`py-4 rounded-2xl font-bold transition-all ${getTipoStyle("1h_post")}`}>
                  1h Post-Comida
                </button>
                <button type="button" onClick={() => setValue("tipo_glucosa", "2h_post")} className={`py-4 rounded-2xl font-bold transition-all ${getTipoStyle("2h_post")}`}>
                  2h Post-Comida
                </button>
              </div>
            </div>

            {/* Relacionar con Comida (Automático / Selección Múltiple real requeriría fetch a BD) */}
            {(tipo_glucosa !== "ayuno") && (
              <div className="space-y-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <label className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-500">link</span>
                  Relacionar con Comida
                </label>
                <select
                  {...register("comida_relacionada_id")}
                  className="w-full bg-white border-none shadow-sm rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                >
                  <option value="">(No relacionar / Opcional)</option>
                  <option value="test-comida-1">Doble pizza - Hoy 2:00 PM</option>
                  <option value="test-comida-2">Ensalada ligera - Hoy 1:00 PM</option>
                </select>
                <p className="text-xs text-blue-700/70">
                  Seleccionar una comida nos ayuda a calcular su respuesta metabólica (A/B testing alimenticio).
                </p>
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full mt-8 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold py-5 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined">{loading ? "hourglass_empty" : "check_circle"}</span>
              <span className="text-lg">{loading ? "Registrando Nivel..." : "Guardar Glucosa"}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
