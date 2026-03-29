import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  LOCALE_COOKIE_NAME,
  LOCALE_EXPLICIT_COOKIE_NAME,
  getMessages,
  inferLocaleFromRequest,
  translateTemplate,
} from '@/lib/i18n';
import { verifySession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export default async function Home() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const sessionToken = cookieStore.get('lifemetric_session')?.value;
  
  const locale = inferLocaleFromRequest({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    explicitCookie: cookieStore.get(LOCALE_EXPLICIT_COOKIE_NAME)?.value,
    acceptLanguage: headerStore.get('accept-language'),
    country: headerStore.get('x-vercel-ip-country') ?? headerStore.get('cf-ipcountry'),
    city: headerStore.get('x-vercel-ip-city') ?? headerStore.get('cf-ipcity'),
  });
  
  const messages = getMessages(locale);

  if (!sessionToken) {
    redirect('/login');
  }

  const payload = await verifySession(sessionToken);
  if (!payload) {
    redirect('/login');
  }

  let parsedPayload;
  try {
    parsedPayload = JSON.parse(payload);
  } catch {
    redirect('/login');
  }

  const pacienteId = parsedPayload.pacienteId;
  const paciente = await prisma.paciente.findUnique({
    where: { paciente_id: pacienteId },
    include: {
      glucosa: {
        orderBy: { fecha: 'desc' },
        take: 1,
      },
      habitos: {
        where: {
          fecha: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        orderBy: { fecha: 'desc' },
        take: 1,
      },
      medicacion: {
        where: {
          fecha: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      },
    },
  });

  if (!paciente) {
    redirect('/login');
  }

  // Calculate metrics
  const lastGlucoseVal = paciente.glucosa?.[0]?.valor_glucosa;
  const lastGlucose = lastGlucoseVal !== null && lastGlucoseVal !== undefined ? String(lastGlucoseVal) : '--';
  
  const exerciseToday = paciente.habitos?.[0]?.ejercicio_min ?? 0;
  const sleepToday = paciente.habitos?.[0]?.sueno_horas ?? 0;
  
  const totalMedication = paciente.medicacion.length;
  const takenMedication = paciente.medicacion.filter(m => m.estado_toma?.toLowerCase() === 'tomada').length;
  const adherence = totalMedication === 0 ? 0 : Math.round((takenMedication / totalMedication) * 100);

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-container-low">
      {/* ── Background Elements for Premium Feel ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/40 blur-[100px] rounded-full animate-blob z-0" />
      <div className="absolute top-[20%] right-[-5%] w-[35%] h-[35%] bg-indigo-200/30 blur-[100px] rounded-full animate-blob animation-delay-2000 z-0" />
      <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] bg-blue-100/40 blur-[120px] rounded-full animate-blob animation-delay-4000 z-0" />

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl shadow-sm h-16 flex items-center justify-between px-6 border-b border-slate-200/50">
        <h1 className="text-xl font-black tracking-tighter text-blue-800 uppercase">
          Lifemetric
        </h1>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 text-xs font-black ring-2 ring-white shadow-sm">
            {paciente.nombre.charAt(0)}
          </div>
        </div>
      </header>

      <div className="relative z-10 p-6 md:p-10 max-w-5xl mx-auto flex flex-col gap-10 pb-32">
        
        {/* ── Premium Hero Card ── */}
        <section className="group relative overflow-hidden bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-800 rounded-[3rem] p-8 md:p-12 text-white shadow-2xl shadow-blue-900/20 card-shine">
          <div className="absolute right-0 top-0 opacity-10 scale-150 transform translate-x-12 -translate-y-12 select-none pointer-events-none transition-transform group-hover:rotate-12 duration-700">
            <span className="material-symbols-outlined text-[240px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              analytics
            </span>
          </div>
          
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-[10px] font-bold tracking-widest uppercase text-blue-100">
                {messages.summary.patientReport}
              </p>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
                {translateTemplate(messages.home.greeting, { name: paciente.nombre })}
              </h1>
              <p className="text-blue-100/80 text-lg md:text-xl font-medium max-w-xl text-balance">
                {messages.home.subtitle}
              </p>
            </div>
          </div>
        </section>

        {/* ── Today's Health Overview ── */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              {messages.home.healthOverview}
            </h3>
            <Link href="/resumen" className="text-xs font-bold text-primary hover:underline transition-all flex items-center gap-1 group">
              {messages.summary.detailedAnalysis} <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </Link>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label={messages.summary.fastingGlucose}
              value={lastGlucose}
              unit="mg/dL"
              icon="glucose"
              color="text-blue-500"
              bgColor="bg-blue-50"
            />
            <MetricCard
              label={messages.summary.exerciseDays}
              value={String(exerciseToday)}
              unit="min"
              icon="fitness_center"
              color="text-emerald-500"
              bgColor="bg-emerald-50"
            />
            <MetricCard
              label={messages.summary.sleepAverage}
              value={String(sleepToday)}
              unit="h"
              icon="bedtime"
              color="text-indigo-400"
              bgColor="bg-indigo-50"
            />
            <MetricCard
              label={messages.summary.medicationAdherence}
              value={String(adherence)}
              unit="%"
              icon="medication"
              color="text-orange-400"
              bgColor="bg-orange-50"
            />
          </div>
        </section>

        {/* ── Quick Actions ── */}
        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 px-2">
            {messages.home.quickActions}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <QuickActionCard
              href="/comidas/nuevo"
              title={messages.home.foodTitle}
              subtitle={messages.home.foodSubtitle}
              icon="restaurant"
              color="text-primary"
              bgColor="bg-primary/10"
              gradientColor="from-primary/5"
            />
            <QuickActionCard
              href="/glucosa/nuevo"
              title={messages.home.glucoseTitle}
              subtitle={messages.home.glucoseSubtitle}
              icon="glucose"
              color="text-secondary"
              bgColor="bg-secondary/10"
              gradientColor="from-secondary/5"
            />
            <QuickActionCard
              href="/habitos/nuevo"
              title={messages.home.habitsTitle}
              subtitle={messages.home.habitsSubtitle}
              icon="settings_accessibility"
              color="text-blue-500"
              bgColor="bg-blue-500/10"
              gradientColor="from-blue-500/5"
            />
            <QuickActionCard
              href="/medicacion/nuevo"
              title={messages.home.medicationTitle}
              subtitle={messages.home.medicationSubtitle}
              icon="medication"
              color="text-orange-500"
              bgColor="bg-orange-500/10"
              gradientColor="from-orange-500/5"
            />
            <QuickActionCard
              href="/laboratorios/nuevo"
              title={messages.home.labsTitle}
              subtitle={messages.home.labsSubtitle}
              icon="biotech"
              color="text-purple-500"
              bgColor="bg-purple-500/10"
              gradientColor="from-purple-500/5"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, icon, color, bgColor }: Readonly<{ label: string; value: string; unit: string; icon: string; color: string; bgColor: string }>) {
  return (
    <div className="bg-white rounded-[2rem] p-5 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col gap-1 hover:scale-[1.02] transition-all">
      <span className={`material-symbols-outlined ${color} text-2xl mb-1 p-2 ${bgColor} w-fit rounded-2xl`}>{icon}</span>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-black text-slate-800 tracking-tighter">{value}</span>
        <span className="text-[10px] font-bold text-slate-400 pb-1 uppercase">{unit}</span>
      </div>
    </div>
  );
}

function QuickActionCard({ href, title, subtitle, icon, color, bgColor, gradientColor }: Readonly<{ href: string; title: string; subtitle: string; icon: string; color: string; bgColor: string; gradientColor: string }>) {
  return (
    <Link
      href={href}
      className="group relative bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/60 border border-white hover:-translate-y-2 transition-all duration-300 card-shine overflow-hidden"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientColor} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className={`relative w-16 h-16 ${bgColor} rounded-2xl flex items-center justify-center transform group-hover:rotate-6 transition-transform mb-6 shadow-sm`}>
        <span className={`material-symbols-outlined text-4xl ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
      </div>
      <div className="relative">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">{title}</h2>
        <p className="text-slate-500 text-sm font-medium mt-2 leading-relaxed opacity-80">{subtitle}</p>
      </div>
      <div className="mt-6 flex justify-end">
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </div>
      </div>
    </Link>
  );
}
