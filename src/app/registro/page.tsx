'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { registerAction } from '@/actions/auth';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';

export default function RegisterPage() {
  const [state, action, isPending] = useActionState(registerAction, undefined);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push('/resumen');
    }
  }, [state, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-container-low)] p-4 sm:p-8 relative overflow-hidden">
      
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--color-tertiary-container)] rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob"></div>
      <div className="absolute bottom-[20%] left-[-10%] w-[40%] h-[50%] bg-[var(--color-primary-container)] rounded-full mix-blend-multiply filter blur-[100px] opacity-30 animate-blob animation-delay-2000"></div>

      <div className="glass-surface w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-white/20 relative z-10 transition-all duration-500 hover:shadow-[var(--color-tertiary-fixed-dim)]/20 hover:shadow-3xl">
        
        {/* Left Side: Summary / Benefits */}
        <div className="md:w-5/12 p-8 md:p-12 flex flex-col justify-center bg-gradient-to-br from-[var(--color-tertiary)] to-[var(--color-tertiary-container)] text-[var(--color-on-tertiary)] relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
          
          <div className="z-10 relative">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl">monitor_heart</span>
              Regístrate
            </h1>
            <p className="text-[var(--color-tertiary-fixed)] text-lg mb-8 leading-relaxed">
              Únete a Lifemetric y toma el control de tu metabolismo y salud con herramientas avanzadas.
            </p>
          </div>
        </div>

        {/* Right Side: Register Form */}
        <div className="md:w-7/12 p-8 md:p-12 flex flex-col justify-center bg-[var(--color-surface-container-lowest)]/80 backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--color-on-surface)] mb-1">Crea tu cuenta</h2>
            <p className="text-[var(--color-on-surface-variant)] text-sm">Completa tus datos iniciales de paciente</p>
          </div>

          {state?.error && (
            <div className="mb-6 p-4 rounded-xl bg-[var(--color-error-container)] text-[var(--color-on-error-container)] flex items-center gap-2 text-sm font-semibold">
              <span className="material-symbols-outlined">error</span>
              {state.error}
            </div>
          )}

          <form action={action} className="space-y-4">
            <input type="hidden" name="captchaToken" value={captchaToken} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Nombre */}
               <div className="space-y-1">
                 <label className="text-sm font-semibold text-[var(--color-on-surface-variant)]">Nombre</label>
                 <input type="text" name="nombre" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required />
               </div>
               
               {/* Apellido */}
               <div className="space-y-1">
                 <label className="text-sm font-semibold text-[var(--color-on-surface-variant)]">Apellido</label>
                 <input type="text" name="apellido" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Email */}
               <div className="space-y-1">
                 <label className="text-sm font-semibold text-[var(--color-on-surface-variant)]">Correo Electrónico</label>
                 <input type="email" name="email" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required />
               </div>
               
               {/* Password */}
               <div className="space-y-1">
                 <label className="text-sm font-semibold text-[var(--color-on-surface-variant)]">Contraseña</label>
                 <input type="password" name="password" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" placeholder="Min. 6 caracteres" required />
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               {/* Edad */}
               <div className="space-y-1">
                 <label className="text-sm font-semibold text-[var(--color-on-surface-variant)]">Edad</label>
                 <input type="number" name="edad" min="1" max="150" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required />
               </div>
               
               {/* Sexo */}
               <div className="space-y-1 sm:col-span-2">
                 <label className="text-sm font-semibold text-[var(--color-on-surface-variant)]">Sexo Biológico</label>
                 <select name="sexo" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required>
                    <option value="">Seleccione</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                 </select>
               </div>
            </div>

            <div className="space-y-1">
                <label className="text-sm font-semibold text-[var(--color-on-surface-variant)]">Diagnóstico Principal (Inicial)</label>
                <input type="text" name="diagnostico" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" placeholder="Ej. Prediabetes, control metabólico..." required />
            </div>

            <TurnstileWidget onVerify={(t) => setCaptchaToken(t)} />

            <button
              type="submit"
              disabled={isPending || !captchaToken}
              className="w-full py-3.5 px-4 bg-[var(--color-tertiary)] hover:bg-[var(--color-on-tertiary-fixed-variant)] text-white font-semibold rounded-xl transition-all shadow-lg shadow-[var(--color-tertiary)]/30 hover:shadow-[var(--color-tertiary)]/50 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Creando cuenta...
                </>
              ) : (
                'Registrarme'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[var(--color-on-surface-variant)] text-sm">
              ¿Ya tienes una cuenta? <Link href="/login" className="font-semibold text-[var(--color-tertiary)] hover:underline ml-1">Inicia sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
