"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getSessionPacienteId } from "@/actions/data";
import { guardarRegistroMedicacion } from "@/actions/medicacion";
import { useLocale } from "@/components/providers/LocaleProvider";
import { guardFileUploadWithVirusTotal } from "@/lib/fileScan";
import { getMedicationCatalogDescription } from "@/lib/medicationCatalog";
import { supabase } from "@/lib/supabase";
import { useRuntimeDateTimeDefaults } from "@/hooks/useRuntimeDateTimeDefaults";

const medicacionSchema = z.object({
  paciente_id: z.string().min(1, "Paciente es requerido"),
  fecha: z.string(),
  hora: z.string(),
  medicamento: z.string().min(2, "Obligatorio"),
  dosis: z.string().optional(),
  estado_toma: z.enum(["tomada", "olvidada", "omitida_por_efecto", "retrasada"]),
  comentarios: z.string().optional(),
  foto_url: z.string().optional(),
});

type FormValues = z.infer<typeof medicacionSchema>;

export default function NuevaMedicacion() {
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [detectedMedicationDescription, setDetectedMedicationDescription] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { locale, messages } = useLocale();
  const medicationMessages = messages.medicationForm;
  const runtimeDateTime = useRuntimeDateTimeDefaults();

  const { register, handleSubmit, setValue, control } = useForm<FormValues>({
    resolver: zodResolver(medicacionSchema),
    defaultValues: {
      fecha: runtimeDateTime.date,
      hora: runtimeDateTime.time,
      estado_toma: "tomada",
      paciente_id: "",
      foto_url: "",
    },
  });

  useEffect(() => {
    async function loadData() {
      const pId = await getSessionPacienteId();
      if (pId) {
        setValue("paciente_id", pId);
      }
    }

    void loadData();
  }, [setValue]);


  useEffect(() => {
    setValue("fecha", runtimeDateTime.date, { shouldDirty: false });
    setValue("hora", runtimeDateTime.time, { shouldDirty: false });
  }, [runtimeDateTime.date, runtimeDateTime.time, setValue]);
  const estado = useWatch({ control, name: "estado_toma" });
  const medicamento = useWatch({ control, name: "medicamento" });

  useEffect(() => {
    setDetectedMedicationDescription(
      medicamento ? getMedicationCatalogDescription(medicamento, locale) : null,
    );
  }, [locale, medicamento]);

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
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `medicacion/${fileName}`;

    const { error } = await supabase.storage.from("medicina").upload(filePath, file);
    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from("medicina").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert(medicationMessages.imageOnly);
      return;
    }

    setIsUploading(true);
    const canProceed = await guardFileUploadWithVirusTotal(file, locale, {
      scanning: medicationMessages.virusScanning,
      blockedPrefix: medicationMessages.virusBlocked,
      fallbackPrefix: medicationMessages.virusFallback,
      successPrefix: medicationMessages.virusPassed,
    });

    if (!canProceed) {
      setIsUploading(false);
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const photoUrl = await uploadImage(file);
      setUploadedPhotoUrl(photoUrl);
      setValue("foto_url", photoUrl);
    } catch {
      alert(medicationMessages.saveError);
      setImageFile(null);
      setImagePreview(null);
      setUploadedPhotoUrl(null);
      setValue("foto_url", "");
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      let foto_url = data.foto_url;
      if (uploadedPhotoUrl) {
        foto_url = uploadedPhotoUrl;
      } else if (imageFile) {
        foto_url = await uploadImage(imageFile);
      }

      const response = await guardarRegistroMedicacion({
        ...data,
        comentarios: data.comentarios || undefined,
        foto_url: foto_url || undefined,
      });

      if (!response.success) {
        if (response.error === "restricted_product") {
          alert("Este producto esta restringido y no puede registrarse.");
          return;
        }

        alert(medicationMessages.saveError);
        return;
      }

      alert(medicationMessages.success);
      setValue("medicamento", "");
      setValue("dosis", "");
      setValue("comentarios", "");
      setValue("foto_url", "");
      setDetectedMedicationDescription(null);
      setImageFile(null);
      setImagePreview(null);
      setUploadedPhotoUrl(null);
    } catch {
      alert(medicationMessages.saveError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between bg-surface/90 px-6 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/" className="hidden rounded-full p-2 text-on-surface hover:bg-slate-200 md:flex">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tighter text-blue-800">{medicationMessages.title}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl p-6 pb-32 md:p-10 md:pb-12">
        <div className="rounded-[2rem] border border-white/50 bg-surface-container-lowest/95 p-6 shadow-2xl backdrop-blur-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="mb-2 flex items-center gap-4 py-4">
              <span
                className="material-symbols-outlined rounded-full bg-blue-50 p-4 text-5xl text-blue-500"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                medication
              </span>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{medicationMessages.heading}</h2>
                <p className="text-slate-500">{medicationMessages.subtitle}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="medicamento" className="text-sm font-semibold text-slate-600">
                  {medicationMessages.medication}
                </label>
                <input
                  id="medicamento"
                  {...register("medicamento")}
                  className="w-full rounded-xl border-none bg-surface-container-highest/50 px-4 py-3 font-medium text-on-surface transition-all focus:ring-2 focus:ring-primary/20"
                  placeholder={locale === "es" ? "Ej. Metformina" : "E.g. Metformin"}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="dosis" className="text-sm font-semibold text-slate-600">
                  {medicationMessages.dose}
                </label>
                <input
                  id="dosis"
                  {...register("dosis")}
                  className="w-full rounded-xl border-none bg-surface-container-highest/50 px-4 py-3 font-medium text-on-surface transition-all focus:ring-2 focus:ring-primary/20"
                  placeholder={locale === "es" ? "Ej. 850 mg" : "E.g. 850 mg"}
                />
              </div>
            </div>

            <input type="hidden" {...register("foto_url")} />

            <div className="mt-2 flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-600">
                {medicationMessages.photoLabel} ({messages.common.optional})
              </span>
              <div className="relative">
                {imagePreview && (
                  <button
                    type="button"
                    className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setUploadedPhotoUrl(null);
                      setValue("foto_url", "");
                    }}
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}

                <div
                  role="button"
                  tabIndex={0}
                  aria-label={medicationMessages.photoLabel}
                  className={`relative flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition-all ${
                    dragActive ? "border-primary bg-primary/10" : "border-slate-300 bg-surface-container-highest/50"
                  } ${imagePreview ? "h-48 p-2" : "h-40"}`}
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
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleChange}
                  />

                  {imagePreview ? (
                    <div className="relative h-full w-full overflow-hidden rounded-xl">
                      <Image src={imagePreview} alt={medicationMessages.photoLabel} fill className="object-cover" />
                    </div>
                  ) : isUploading ? (
                    <div className="pointer-events-none flex flex-col items-center text-slate-500">
                      <span className="material-symbols-outlined mb-2 animate-spin text-4xl opacity-50">sync</span>
                      <p className="text-center text-sm font-medium">
                        {locale === "es" ? "Subiendo imagen..." : "Uploading image..."}
                      </p>
                    </div>
                  ) : (
                    <div className="pointer-events-none flex flex-col items-center text-slate-500">
                      <span className="material-symbols-outlined mb-2 text-4xl opacity-50">add_a_photo</span>
                      <p className="text-center text-sm font-medium">
                        {medicationMessages.dragAndDrop}
                        <br />
                        {medicationMessages.clickToSelect}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {detectedMedicationDescription && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {medicationMessages.aiDescriptionTitle}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-emerald-800">{detectedMedicationDescription}</p>
              </div>
            )}

            <div className="mt-2 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">{medicationMessages.date}</label>
                <input
                  type="date"
                  {...register("fecha")}
                  className="w-full rounded-xl border-none bg-surface px-4 py-3 font-medium text-on-surface transition-all focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">{medicationMessages.intakeTime}</label>
                <input
                  type="time"
                  {...register("hora")}
                  className="w-full rounded-xl border-none bg-surface px-4 py-3 font-medium text-on-surface transition-all focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <label className="text-sm font-semibold text-slate-600">{medicationMessages.intakeStatus}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setValue("estado_toma", "tomada")}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm transition-all ${getEstadoStyle("tomada")}`}
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  {medicationMessages.taken}
                </button>
                <button
                  type="button"
                  onClick={() => setValue("estado_toma", "retrasada")}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm transition-all ${getEstadoStyle("retrasada")}`}
                >
                  <span className="material-symbols-outlined text-[18px]">schedule</span>
                  {medicationMessages.delayed}
                </button>
                <button
                  type="button"
                  onClick={() => setValue("estado_toma", "olvidada")}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm transition-all ${getEstadoStyle("olvidada")}`}
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  {medicationMessages.forgotten}
                </button>
                <button
                  type="button"
                  onClick={() => setValue("estado_toma", "omitida_por_efecto")}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm transition-all ${getEstadoStyle("omitida_por_efecto")}`}
                >
                  <span className="material-symbols-outlined text-[18px]">sick</span>
                  {medicationMessages.omittedEffects}
                </button>
              </div>
            </div>

            {estado !== "tomada" && (
              <div className="relative pt-2">
                <input
                  {...register("comentarios")}
                  className="w-full rounded-xl bg-rose-50 px-5 py-4 text-on-surface transition-all placeholder:text-rose-400 focus:ring-2 focus:ring-rose-500/30"
                  placeholder={medicationMessages.commentPlaceholder}
                />
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-800 py-5 font-bold text-white shadow-xl transition-all hover:bg-slate-900 active:scale-[0.98]"
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
