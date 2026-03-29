"use client";

import Link from "next/link";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useRef } from "react";
import { getSessionPacienteId } from "@/actions/data";
import { guardarRegistroMedicacion, inferMedicationFromPhoto } from "@/actions/medicacion";
import { useLocale } from "@/components/providers/LocaleProvider";
import { guardFileUploadWithVirusTotal } from "@/lib/fileScan";
import { getMedicationCatalogDescription } from "@/lib/medicationCatalog";
import { supabase } from "@/lib/supabase";

const medicacionSchema = z.object({
  paciente_id: z.string().min(1, "Paciente es requerido"),
  fecha: z.string(),
  hora: z.string(),
  medicamento: z.string().min(2, "Obligatorio"),
  dosis: z.string().optional(),
  estado_toma: z.enum(["tomada", "olvidada", "omitida_por_efecto", "retrasada"]),
  comentarios: z.string().optional()
});

type FormValues = z.infer<typeof medicacionSchema>;

export default function NuevaMedicacion() {
  const [loading, setLoading] = useState(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [detectedMedicationName, setDetectedMedicationName] = useState<string | null>(null);
  const [detectedMedicationDescription, setDetectedMedicationDescription] = useState<string | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      void handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) {
      void handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert(medicationMessages.imageOnly);
      return;
    }

    const canProceed = await guardFileUploadWithVirusTotal(file, locale, {
      scanning: medicationMessages.virusScanning,
      blockedPrefix: medicationMessages.virusBlocked,
      fallbackPrefix: medicationMessages.virusFallback,
      successPrefix: medicationMessages.virusPassed,
    });

    if (!canProceed) {
      return;
    }


    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Auto-analyze with IA
    void handleIAAnalysis(file);
  };

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `medicacion/${fileName}`;

    const { error } = await supabase.storage
      .from("comidas")
      .upload(filePath, file);

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from("comidas")
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const handleIAAnalysis = async (file: File) => {
    setAnalyzingPhoto(true);
    try {
      const photoUrl = await uploadImage(file);
      const response = await inferMedicationFromPhoto({
        imageUrl: photoUrl,
        locale,
      });

      if (response.success && response.data) {
        if (response.data.medicamento) {
          setDetectedMedicationName(response.data.medicamento);
          setValue("medicamento", response.data.medicamento, { shouldValidate: true });
          const catalogDescription = getMedicationCatalogDescription(response.data.medicamento, locale);
          setDetectedMedicationDescription(catalogDescription ?? response.data.descripcion_para_que_sirve ?? null);
        }
        if (response.data.dosis) {
          setValue("dosis", response.data.dosis, { shouldValidate: true });
        }
      }
    } catch (error) {
      console.error("AI Analysis error:", error);
    } finally {
      setAnalyzingPhoto(false);
    }
  };



  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      const response = await guardarRegistroMedicacion({
        ...data,
        comentarios: data.comentarios || undefined,
        ai_detected_medicamento: detectedMedicationName ?? undefined,
      });

      if (!response.success) {
        if (response.error === "restricted_product") {
          alert("Este producto está restringido y no puede registrarse.");
          return;
        }
        if (response.error === "photo_validation_required") {
          alert("Para este producto debes subir una foto válida del medicamento antes de guardarlo.");
          return;
        }
        if (response.error === "product_name_photo_mismatch") {
          alert("El nombre ingresado no coincide con el producto detectado en la foto. Verifica por seguridad.");
          return;
        }
        alert(medicationMessages.saveError);
        return;
      }

      alert(medicationMessages.success);
      setValue("medicamento", "");
      setValue("dosis", "");
      setValue("comentarios", "");
      setImagePreview(null);
      setDetectedMedicationName(null);
      setDetectedMedicationDescription(null);
    } catch {
      alert(medicationMessages.saveError);
    } finally {
      setLoading(false);
    }
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

            <div className="mt-2 flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-600">{medicationMessages.photoLabel}</span>
              <div
                className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 transition-all ${dragActive ? "border-primary bg-primary/10" : "border-slate-300 bg-surface-container-highest/50"} ${imagePreview ? "p-2" : "h-40"}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={medicationMessages.photoLabel}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleChange}
                />

                {imagePreview ? (
                  <div className="relative w-full h-48 rounded-xl overflow-hidden">
                    <Image src={imagePreview} alt={medicationMessages.photoLabel} fill className="object-cover" />
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImagePreview(null);
                        setDetectedMedicationName(null);
                        setDetectedMedicationDescription(null);
                      }}
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-500 pointer-events-none">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">add_a_photo</span>
                    <p className="text-sm font-medium text-center">{medicationMessages.dragAndDrop}<br />{medicationMessages.clickToSelect}</p>
                  </div>
                )}
              </div>
              {analyzingPhoto && (
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl animate-pulse">
                  <span className="material-symbols-outlined text-blue-600 animate-spin">progress_activity</span>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{medicationMessages.aiAnalyzing}</span>
                </div>
              )}
              {detectedMedicationDescription && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {medicationMessages.aiDescriptionTitle}
                  </p>
                  <p className="mt-1 text-sm text-emerald-900">{detectedMedicationDescription}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="medicamento" className="text-sm font-semibold text-slate-600">{medicationMessages.medication}</label>
                <input
                  id="medicamento"
                  {...register("medicamento")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  placeholder={locale === "es" ? "Ej. Metformina" : "E.g. Metformin"}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="dosis" className="text-sm font-semibold text-slate-600">{medicationMessages.dose}</label>
                <input
                  id="dosis"
                  {...register("dosis")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  placeholder={locale === "es" ? "Ej. 850 mg" : "E.g. 850 mg"}
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
