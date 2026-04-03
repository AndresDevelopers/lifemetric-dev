"use client";

import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useRef } from "react";
import { getSessionPacienteId } from "@/actions/data";
import { clasificarYGuardarComida, inferMealFromPhoto } from "@/actions/comida";
import { useLocale } from "@/components/providers/LocaleProvider";
import { supabase } from "@/lib/supabase";
import { guardFileUploadWithVirusTotal } from "@/lib/fileScan";
import { useRuntimeDateTimeDefaults } from "@/hooks/useRuntimeDateTimeDefaults";
import { IMAGE_UPLOAD_ACCEPT_ATTR, isAllowedUploadFile, resolveUploadFileMetadata } from "@/lib/uploadFileTypes";

const comidaSchema = z.object({
  paciente_id: z.string().min(1, "Paciente es requerido"),
  fecha: z.string(),
  hora: z.string(),
  tipo_comida: z.enum(["Desayuno", "Comida", "Cena", "Colacion"]),
  alimento_principal: z.string().optional(),
  foto_url: z.string().optional(),
  nota: z.string().optional(),
});

type FormValues = z.infer<typeof comidaSchema>;

type MealAiSnapshot = {
  kcal_estimadas?: number;
  proteina_g?: number;
  carbohidratos_g?: number;
  grasa_g?: number;
  fibra_g?: number;
  es_comida_valida?: boolean;
  es_saludable?: boolean;
  razon_inadecuada?: string;
  alternativa_saludable?: string;
};

export default function NuevaComida() {
  const [loading, setLoading] = useState(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [aiPersonalized, setAiPersonalized] = useState(false);
  const [aiMealSnapshot, setAiMealSnapshot] = useState<MealAiSnapshot>({});
  const [pacienteId, setPacienteId] = useState<string>("");
  const [esSaludable, setEsSaludable] = useState<boolean | undefined>(undefined);
  const [razonInadecuada, setRazonInadecuada] = useState<string | null>(null);
  const [alternativaSaludable, setAlternativaSaludable] = useState<string | null>(null);
  const { locale, messages } = useLocale();
  const foodMessages = messages.foodForm;
  
  const runtimeDateTime = useRuntimeDateTimeDefaults();

  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(comidaSchema),
    defaultValues: {
      fecha: runtimeDateTime.date,
      hora: runtimeDateTime.time,
      tipo_comida: "Desayuno",
      paciente_id: "", 
    }
  });


  useEffect(() => {
    setValue("fecha", runtimeDateTime.date, { shouldDirty: false });
    setValue("hora", runtimeDateTime.time, { shouldDirty: false });
  }, [runtimeDateTime.date, runtimeDateTime.time, setValue]);

  useEffect(() => {
    async function loadData() {
      const pId = await getSessionPacienteId();
      if (pId) {
        setPacienteId(pId);
        setValue("paciente_id", pId);
      }
    }
    loadData();
  }, [setValue]);

  const tipo_comida = watch("tipo_comida");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAiMealAnalysis = () => {
    setAiMealSnapshot({});
    setAiReason(null);
    setAiPersonalized(false);
    setEsSaludable(undefined);
    setRazonInadecuada(null);
    setAlternativaSaludable(null);
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
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const runAiPhotoAnalysis = async (photoUrl: string) => {
    setAnalyzingPhoto(true);
    resetAiMealAnalysis();
    try {
      // Read directly to avoid race condition with useEffect/setState
      const pid = pacienteId || await getSessionPacienteId();
      if (!pid) return;

      const aiResult = await inferMealFromPhoto({
        paciente_id: pid,
        foto_url: photoUrl,
        locale,
      });

      if (aiResult.success && aiResult.data) {
        const {
          alimento_principal,
          alimento_principal_razon,
          meal_description,
          kcal_estimadas,
          proteina_g,
          carbohidratos_g,
          grasa_g,
          fibra_g,
          es_comida_valida,
          es_saludable,
          razon_inadecuada,
          alternativa_saludable,
        } = aiResult.data;

        setAiMealSnapshot({
          kcal_estimadas: kcal_estimadas ?? undefined,
          proteina_g: proteina_g ?? undefined,
          carbohidratos_g: carbohidratos_g ?? undefined,
          grasa_g: grasa_g ?? undefined,
          fibra_g: fibra_g ?? undefined,
          es_comida_valida: es_comida_valida ?? undefined,
          es_saludable: es_saludable ?? undefined,
          razon_inadecuada: razon_inadecuada ?? undefined,
          alternativa_saludable: alternativa_saludable ?? undefined,
        });

        if (alimento_principal) {
          setValue("alimento_principal", alimento_principal, { shouldValidate: true });
        }
        if (alimento_principal_razon) {
          setAiReason(alimento_principal_razon);
          setAiPersonalized(true);
        }
        if (meal_description) {
          setValue("nota", meal_description);
        }
        // Guardar info de salud del alimento
        if (es_saludable !== undefined && es_saludable !== null) {
          setEsSaludable(es_saludable);
        }
        if (razon_inadecuada) {
          setRazonInadecuada(razon_inadecuada);
        }
        if (alternativa_saludable) {
          setAlternativaSaludable(alternativa_saludable);
        }
      } else {
        console.error("[AI] inferMealFromPhoto failed — error code:", (aiResult as { success: false; error: string }).error);
        resetAiMealAnalysis();
        alert(foodMessages.aiFailed);
      }
    } catch (error) {
      console.error("Error with meal AI autofill:", error);
      resetAiMealAnalysis();
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!isAllowedUploadFile(file, "image")) {
      alert(foodMessages.imageOnly);
      return;
    }
    setIsUploading(true);
    const canProceed = await guardFileUploadWithVirusTotal(file, locale, {
      scanning: foodMessages.virusScanning,
      blockedPrefix: foodMessages.virusBlocked,
      fallbackPrefix: foodMessages.virusFallback,
      successPrefix: foodMessages.virusPassed,
    });
    if (!canProceed) {
      setIsUploading(false);
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => { setImagePreview(e.target?.result as string); };
    reader.readAsDataURL(file);

    try {
      const photoUrl = await uploadImage(file);
      setUploadedPhotoUrl(photoUrl);
      setValue("foto_url", photoUrl);
      await runAiPhotoAnalysis(photoUrl);
    } catch (error) {
      console.error("Error with image upload:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const uploadImage = async (file: File) => {
    const uploadMetadata = resolveUploadFileMetadata(file, "image");
    if (!uploadMetadata) {
      throw new Error("Unsupported image type");
    }

    const fileName = `${crypto.randomUUID()}.${uploadMetadata.extension}`;
    const filePath = `comidas/${fileName}`;

    const { error } = await supabase.storage
      .from('comidas')
      .upload(filePath, file, {
        contentType: uploadMetadata.contentType,
      });

    if (error) {
      console.error('Error subiendo imagen: ', error);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from('comidas')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
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

      const submissionData = { ...data, foto_url, ...aiMealSnapshot };
      const response = await clasificarYGuardarComida(submissionData);

      if (response.success) {
        alert(foodMessages.saveSuccess);
        setImageFile(null);
        setImagePreview(null);
        setUploadedPhotoUrl(null);
        setValue("alimento_principal", "");
        setValue("nota", "");
        setValue("foto_url", "");
        resetAiMealAnalysis();
      } else {
        alert(response.error || foodMessages.saveError);
      }
    } catch (error) {
      console.error("Error submitting:", error);
      alert(foodMessages.saveError);
    } finally {
      setLoading(false);
    }
  };

  const getTipoStyle = (tipo: string) => {
    return tipo_comida === tipo
      ? "bg-white/90 backdrop-blur-md text-primary shadow-lg ring-2 ring-primary border-transparent"
      : "bg-white/20 backdrop-blur-md text-slate-500 border border-slate-300 dark:border-slate-700 dark:text-slate-300 hover:bg-white/50";
  };

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 z-0">
        <Image
          className="w-full h-full object-cover opacity-60 dark:opacity-40"
          alt={foodMessages.healthyFoodAlt}
          src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80"
          fill
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent"></div>
      </div>

      <header className="fixed top-0 w-full z-40 bg-surface/80 backdrop-blur-xl shadow-sm px-6 h-16 flex items-center gap-3">
        <Link href="/" className="hidden md:flex text-on-surface p-2 rounded-full hover:bg-slate-200">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-xl font-bold tracking-tighter text-blue-800">{foodMessages.title}</h1>
      </header>
      
      <main className="relative z-10 flex flex-col h-full justify-end pt-24 pb-24 md:pb-12 px-6 max-w-2xl mx-auto">
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          <button type="button" onClick={() => setValue("tipo_comida", "Desayuno")} className={`flex-shrink-0 font-bold px-6 py-3 rounded-full active:scale-95 transition-all flex items-center gap-2 ${getTipoStyle("Desayuno")}`}>
            <span className="material-symbols-outlined">breakfast_dining</span> {foodMessages.breakfast}
          </button>
          <button type="button" onClick={() => setValue("tipo_comida", "Comida")} className={`flex-shrink-0 font-bold px-6 py-3 rounded-full active:scale-95 transition-all flex items-center gap-2 ${getTipoStyle("Comida")}`}>
            <span className="material-symbols-outlined">restaurant</span> {foodMessages.lunch}
          </button>
          <button type="button" onClick={() => setValue("tipo_comida", "Cena")} className={`flex-shrink-0 font-bold px-6 py-3 rounded-full active:scale-95 transition-all flex items-center gap-2 ${getTipoStyle("Cena")}`}>
            <span className="material-symbols-outlined">dinner_dining</span> {foodMessages.dinner}
          </button>
          <button type="button" onClick={() => setValue("tipo_comida", "Colacion")} className={`flex-shrink-0 font-bold px-6 py-3 rounded-full active:scale-95 transition-all flex items-center gap-2 ${getTipoStyle("Colacion")}`}>
            <span className="material-symbols-outlined">cookie</span> {foodMessages.snack}
          </button>
        </div>

        <div className="bg-surface-container-lowest/95 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-2xl border border-white/20">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">{foodMessages.date}</label>
                <input
                  type="date"
                  {...register("fecha")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-2xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">{foodMessages.time}</label>
                <input
                  type="time"
                  {...register("hora")}
                  className="w-full bg-surface-container-highest/50 border-none rounded-2xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <span className="text-label-sm font-bold uppercase tracking-widest text-slate-500">
                {foodMessages.mealPhoto} ({messages.common.optional})
              </span>
              <div className="relative">
                {/* Close button is outside the drag-zone div to avoid nested <button> */}
                {imagePreview && (
                  <button
                    type="button"
                    className="absolute top-3 right-3 z-10 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setUploadedPhotoUrl(null);
                      setValue("foto_url", "");
                      setValue("alimento_principal", "");
                      setValue("nota", "");
                      resetAiMealAnalysis();
                    }}
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
                <div
                  role="button"
                  tabIndex={0}
                  className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 transition-all w-full ${dragActive ? 'border-primary bg-primary/10' : 'border-slate-300 bg-surface-container-highest/50'} ${imagePreview ? 'p-2 h-48' : 'h-40'}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={IMAGE_UPLOAD_ACCEPT_ATTR}
                    className="hidden"
                    onChange={handleChange}
                  />

                  {imagePreview ? (
                    <div className="relative w-full h-full rounded-xl overflow-hidden">
                      <Image src={imagePreview} alt={foodMessages.mealPhoto} fill className="object-cover" />
                    </div>
                  ) : isUploading ? (
                    <div className="flex flex-col items-center text-slate-500 pointer-events-none">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-50 animate-spin">sync</span>
                      <p className="text-sm font-medium text-center">{foodMessages.uploadingImage}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-500 pointer-events-none">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-50">add_a_photo</span>
                      <p className="text-sm font-medium text-center">{foodMessages.dragAndDrop}<br/>{foodMessages.clickToSelect}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <span className="text-label-sm font-bold uppercase tracking-widest text-slate-500">
                {foodMessages.mainFoodLabel}
              </span>
              {aiPersonalized && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>neurology</span>
                  {foodMessages.aiContextReady}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                {...register("alimento_principal")}
                className="w-full bg-surface-container-highest/50 border-none rounded-2xl py-4 px-5 text-on-surface placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder={foodMessages.mainFoodPlaceholder}
              />
              {aiReason && esSaludable === false ? (
                <div className="mt-2 flex items-start gap-2 px-4 py-3 bg-red-50/80 border border-red-100 rounded-xl">
                  <span className="material-symbols-outlined text-red-500 text-base mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-0.5">{foodMessages.aiMainFoodReason}</p>
                    <p className="text-xs text-red-600 leading-relaxed">{razonInadecuada || aiReason}</p>
                  </div>
                </div>
              ) : aiReason ? (
                <div className="mt-2 flex items-start gap-2 px-4 py-3 bg-blue-50/80 border border-blue-100 rounded-xl">
                  <span className="material-symbols-outlined text-blue-500 text-base mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-0.5">{foodMessages.aiMainFoodReason}</p>
                    <p className="text-xs text-blue-600 leading-relaxed">{aiReason}</p>
                  </div>
                </div>
              ) : null}

              {/* Alternativa saludable cuando el alimento no es recomendado */}
              {esSaludable === false && alternativaSaludable && (
                <div className="mt-2 flex items-start gap-2 px-4 py-3 bg-emerald-50/80 border border-emerald-100 rounded-xl">
                  <span className="material-symbols-outlined text-emerald-500 text-base mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 mb-0.5">¿Qué puedes comer?</p>
                    <p className="text-xs text-emerald-600 leading-relaxed">{alternativaSaludable}</p>
                  </div>
                </div>
              )}
            </div>


            {analyzingPhoto && (
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl animate-pulse">
                <span className="material-symbols-outlined text-blue-600 animate-spin">progress_activity</span>
                <span className="text-sm font-medium text-blue-700">{foodMessages.aiAnalyzing}</span>
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full mt-6 bg-gradient-to-r from-primary to-primary-container text-white font-bold py-5 rounded-2xl shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                {loading ? "hourglass_empty" : "check_circle"}
              </span>
              <span className="text-lg">{loading ? foodMessages.submitting : foodMessages.submit}</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
