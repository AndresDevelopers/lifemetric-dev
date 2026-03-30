"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { getSessionPacienteId } from "@/actions/data";
import { useLocale } from "@/components/providers/LocaleProvider";
import { autofillLaboratorioFromDocumentAction, guardarLaboratorioAction } from "@/actions/laboratorio";
import { guardFileUploadWithVirusTotal } from "@/lib/fileScan";
import { supabase } from "@/lib/supabase";

const labSchema = z.object({
  paciente_id: z.string().min(1, "Paciente es requerido"),
  fecha_estudio: z.string(),
  hba1c: z.number().min(0).max(20).optional(),
  glucosa_ayuno: z.number().min(0).max(1000).optional(),
  trigliceridos: z.number().min(0).max(2000).optional(),
  hdl: z.number().min(0).max(300).optional(),
  ldl: z.number().min(0).max(1000).optional(),
  insulina: z.number().min(0).max(500).optional(),
  alt: z.number().min(0).max(500).optional(),
  ast: z.number().min(0).max(500).optional(),
  tsh: z.number().min(0).max(20).optional(),
  creatinina: z.number().min(0).max(20).optional(),
  acido_urico: z.number().min(0).max(20).optional(),
  pcr_us: z.number().min(0).max(100).optional(),
  archivo_url: z.string().optional(),
});

type FormValues = z.infer<typeof labSchema>;

export default function SubirLaboratorios() {
  const [loading, setLoading] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'scanning' | 'uploading' | 'analyzing' | 'done'>('idle');
  const [scanResult, setScanResult] = useState<'passed' | 'blocked' | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const { locale, messages } = useLocale();
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
    const response = await guardarLaboratorioAction(data);
    if (response.success) {
      alert(labsMessages.success);
      window.location.href = "/";
    } else {
      alert(response.error);
    }
    setLoading(false);
  };

  const handleFileClick = () => {
    const input = document.getElementById("archivo_input") as HTMLInputElement;
    if (input) input.click();
  };

  const onSelectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert("Solo se permiten archivos JPG, PNG o PDF");
      event.target.value = "";
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("El archivo no debe exceder 10MB");
      event.target.value = "";
      return;
    }

    setDocumentName(file.name);
    setUploadProgress('scanning');
    setAiError(null);

    const canProceed = await guardFileUploadWithVirusTotal(file, locale, {
      scanning: labsMessages.virusScanning,
      blockedPrefix: labsMessages.virusBlocked,
      fallbackPrefix: labsMessages.virusFallback,
      successPrefix: labsMessages.virusPassed,
    });

    if (!canProceed) {
      setDocumentName(null);
      setValue("archivo_url", "");
      event.target.value = "";
      setUploadProgress('idle');
      setScanResult('blocked');
      return;
    }

    setScanResult('passed');
    setUploadProgress('uploading');

    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const filePath = `laboratorios/${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from("laboratorios").upload(filePath, file, {
        contentType: file.type,
      });
      
      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }
      
      const { data: publicUrlData } = supabase.storage.from("laboratorios").getPublicUrl(filePath);
      const uploadedUrl = publicUrlData.publicUrl;
      setValue("archivo_url", uploadedUrl);

      setUploadProgress('analyzing');
      setIsAutofilling(true);

      const ai = await autofillLaboratorioFromDocumentAction({
        imageUrl: uploadedUrl,
        locale,
      });

      console.log('[laboratorios] AI response:', ai);

      if (!ai.success) {
        console.error("AI autofill failed:", ai.error);
        setAiError(ai.error || "Error al analizar el documento");
        setUploadProgress('done');
        return;
      }

      console.log('[laboratorios] AI data:', ai.data);

      // Check if AI returned data
      const hasData = ai.data && Object.keys(ai.data).length > 0;
      
      if (hasData) {
        // AI successfully extracted values - fill the form
        Object.entries(ai.data).forEach(([key, value]) => {
          console.log(`[laboratorios] Setting ${key}:`, value);
          setValue(key as any, value);
        });
        setUploadProgress('done');
      } else {
        // AI succeeded but couldn't extract values
        setUploadProgress('done');
        alert(labsMessages.autoCompleteError || "La IA no pudo extraer valores del documento. Puedes completar los campos manualmente.");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      setUploadProgress('done');
      alert(labsMessages.autoCompleteError);
    } finally {
      setIsAutofilling(false);
    }
  };

  useEffect(() => {
    register("archivo_url");
  }, [register]);

  const getUploadStatusText = () => {
    switch (uploadProgress) {
      case 'scanning':
        return labsMessages.virusScanning || "Escaneando archivo...";
      case 'uploading':
        return "Subiendo archivo...";
      case 'analyzing':
        return labsMessages.autoCompleting || "Analizando con IA...";
      case 'done':
        return scanResult === 'passed' ? "✓ Análisis completado" : "✗ Archivo bloqueado";
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (uploadProgress) {
      case 'scanning':
      case 'uploading':
      case 'analyzing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'done':
        return scanResult === 'passed' 
          ? 'text-teal-600 bg-teal-50 border-teal-200'
          : 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-teal-600 bg-teal-50 border-teal-200';
    }
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

            {/* Sección: Subida de documento PDF/Imagen */}
            <div 
              className="border-2 border-dashed border-teal-200 rounded-3xl p-6 hover:bg-teal-50 transition-all cursor-pointer"
              onClick={handleFileClick}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-5xl text-teal-500 mb-3">
                  {uploadProgress === 'idle' ? 'upload_file' : 
                   uploadProgress === 'scanning' || uploadProgress === 'uploading' ? 'cloud_upload' :
                   uploadProgress === 'analyzing' ? 'auto_awesome' : 'check_circle'}
                </span>
                <span className="text-base font-bold text-teal-700">{labsMessages.clickToUpload}</span>
                <span className="text-xs text-teal-500/70 mt-2">{labsMessages.uploadHint}</span>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span className="px-3 py-1 bg-teal-100 text-teal-700 text-xs font-semibold rounded-full">JPG</span>
                  <span className="px-3 py-1 bg-teal-100 text-teal-700 text-xs font-semibold rounded-full">PNG</span>
                  <span className="px-3 py-1 bg-teal-100 text-teal-700 text-xs font-semibold rounded-full">PDF</span>
                </div>
              </div>
              <input 
                id="archivo_input" 
                type="file" 
                className="hidden" 
                accept=".pdf,image/jpeg,image/png,application/pdf" 
                onChange={onSelectFile}
                aria-label="Subir archivo de laboratorio"
                title="Seleccionar archivo PDF, JPG o PNG"
              />
            </div>

            {/* Estado de subida */}
            {uploadProgress !== 'idle' && (
              <div className={`rounded-2xl p-4 border ${getStatusColor()} transition-all`}>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined animate-pulse">
                    {uploadProgress === 'scanning' ? 'security' :
                     uploadProgress === 'uploading' ? 'cloud_upload' :
                     uploadProgress === 'analyzing' ? 'auto_awesome' : 
                     scanResult === 'passed' ? 'check_circle' : 'block'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{getUploadStatusText()}</p>
                    {documentName && (
                      <p className="text-xs mt-0.5 opacity-80">{documentName}</p>
                    )}
                  </div>
                  {(uploadProgress === 'uploading' || uploadProgress === 'analyzing') && (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  )}
                </div>
              </div>
            )}

            {/* Error de IA */}
            {aiError && (
              <div className="rounded-2xl p-4 border border-red-200 bg-red-50 text-red-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined">error</span>
                  <p className="text-sm">{aiError}</p>
                </div>
              </div>
            )}

            {/* Sección: Perfil Glucémico */}
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
                    placeholder="6.5"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="glucosa_ayuno" className="text-xs font-semibold text-slate-600">{labsMessages.fastingGlucose}</label>
                  <input
                    id="glucosa_ayuno"
                    type="number"
                    {...register("glucosa_ayuno", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    placeholder="110"
                  />
                </div>
              </div>
            </div>

            {/* Sección: Perfil Lipídico */}
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

            {/* Sección: Función Hepática */}
            <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100 mt-4">
              <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">healing</span>
                Función Hepática
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="alt" className="text-xs font-semibold text-slate-600">ALT (U/L)</label>
                  <input
                    id="alt"
                    type="number"
                    {...register("alt", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    placeholder="U/L"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="ast" className="text-xs font-semibold text-slate-600">AST (U/L)</label>
                  <input
                    id="ast"
                    type="number"
                    {...register("ast", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    placeholder="U/L"
                  />
                </div>
              </div>
            </div>

            {/* Sección: Hormonas y Función Renal */}
            <div className="bg-purple-50/50 p-5 rounded-3xl border border-purple-100 mt-4">
              <h3 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">psychology</span>
                Hormonas y Función Renal
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="tsh" className="text-xs font-semibold text-slate-600">TSH (μIU/mL)</label>
                  <input
                    id="tsh"
                    type="number" step="0.01"
                    {...register("tsh", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    placeholder="μIU/mL"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="creatinina" className="text-xs font-semibold text-slate-600">Creatinina (mg/dL)</label>
                  <input
                    id="creatinina"
                    type="number" step="0.01"
                    {...register("creatinina", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    placeholder="mg/dL"
                  />
                </div>
              </div>
            </div>

            {/* Sección: Metabolismo */}
            <div className="bg-rose-50/50 p-5 rounded-3xl border border-rose-100 mt-4">
              <h3 className="font-bold text-rose-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">science</span>
                Metabolismo e Inflamación
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="acido_urico" className="text-xs font-semibold text-slate-600">Ácido Úrico</label>
                  <input
                    id="acido_urico"
                    type="number" step="0.1"
                    {...register("acido_urico", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                    placeholder="mg/dL"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="insulina" className="text-xs font-semibold text-slate-600">Insulina</label>
                  <input
                    id="insulina"
                    type="number" step="0.1"
                    {...register("insulina", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                    placeholder="μU/mL"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="pcr_us" className="text-xs font-semibold text-slate-600">PCR-US</label>
                  <input
                    id="pcr_us"
                    type="number" step="0.1"
                    {...register("pcr_us", { valueAsNumber: true })}
                    className="w-full bg-white border-none rounded-xl py-3 px-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                    placeholder="mg/L"
                  />
                </div>
              </div>
            </div>

            <button
              disabled={loading || isAutofilling}
              type="submit"
              className="w-full mt-8 bg-gradient-to-r from-teal-600 to-teal-800 text-white font-bold py-5 rounded-2xl shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
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
