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
    where: { paciente_id: pacienteId }
  });

  if (!paciente) {
    redirect('/login');
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ── Background Blobs ── */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />

      <div className="relative p-6 md:p-10 max-w-7xl mx-auto flex flex-col gap-10 pb-32">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight text-balance">
            {translateTemplate(messages.home.greeting, { name: paciente.nombre })}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg md:text-xl font-medium max-w-2xl leading-relaxed">
            {messages.home.subtitle}
          </p>
        </header>

        {/* ── Spotlight Section: Summary Preview ── */}
        <section className="group">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              {messages.home.healthOverview}
            </h3>
            <Link href="/resumen" className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-1 group/link">
              Ver mas <span className="material-symbols-outlined text-sm group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2rem] p-6 border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-1">
              <span className="material-symbols-outlined text-blue-500 text-2xl mb-2">glucose</span>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ultimo nivel</p>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-black text-slate-900 dark:text-white">--</span>
                <span className="text-sm font-bold text-slate-400 pb-1">mg/dL</span>
              </div>
            </div>
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2rem] p-6 border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-1">
              <span className="material-symbols-outlined text-emerald-500 text-2xl mb-2">fitness_center</span>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Actividad hoy</p>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-black text-slate-900 dark:text-white">--</span>
                <span className="text-sm font-bold text-slate-400 pb-1">min</span>
              </div>
            </div>
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2rem] p-6 border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-1">
              <span className="material-symbols-outlined text-indigo-400 text-2xl mb-2">bedtime</span>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sueño</p>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-black text-slate-900 dark:text-white">--</span>
                <span className="text-sm font-bold text-slate-400 pb-1">h</span>
              </div>
            </div>
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2rem] p-6 border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-1">
              <span className="material-symbols-outlined text-orange-400 text-2xl mb-2">medication</span>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Adherencia</p>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-black text-slate-900 dark:text-white">--</span>
                <span className="text-sm font-bold text-slate-400 pb-1">%</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main Actions Section ── */}
        <section>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 mb-6">
            {messages.home.quickActions}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              href="/comidas/nuevo"
              className="group relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-6 cursor-pointer hover:-translate-y-2 transition-all duration-300 card-shine overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center transform group-hover:rotate-6 transition-transform">
                <span className="material-symbols-outlined text-5xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  restaurant
                </span>
              </div>
              <div className="relative">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{messages.home.foodTitle}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">{messages.home.foodSubtitle}</p>
              </div>
            </Link>

            <Link
              href="/glucosa/nuevo"
              className="group relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-6 cursor-pointer hover:-translate-y-2 transition-all duration-300 card-shine overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-20 h-20 bg-secondary/10 rounded-3xl flex items-center justify-center transform group-hover:-rotate-6 transition-transform">
                <span className="material-symbols-outlined text-5xl text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  glucose
                </span>
              </div>
              <div className="relative">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{messages.home.glucoseTitle}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">{messages.home.glucoseSubtitle}</p>
              </div>
            </Link>

            <Link
              href="/habitos/nuevo"
              className="group relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-6 cursor-pointer hover:-translate-y-2 transition-all duration-300 card-shine overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center transform group-hover:rotate-6 transition-transform">
                <span className="material-symbols-outlined text-5xl text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                  settings_accessibility
                </span>
              </div>
              <div className="relative">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{messages.home.habitsTitle}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">{messages.home.habitsSubtitle}</p>
              </div>
            </Link>

            <Link
              href="/medicacion/nuevo"
              className="group relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-6 cursor-pointer hover:-translate-y-2 transition-all duration-300 card-shine overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center transform group-hover:-rotate-6 transition-transform">
                <span className="material-symbols-outlined text-5xl text-orange-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                  medication
                </span>
              </div>
              <div className="relative">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{messages.home.medicationTitle}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">{messages.home.medicationSubtitle}</p>
              </div>
            </Link>

            <Link
              href="/laboratorios/nuevo"
              className="group relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-6 cursor-pointer hover:-translate-y-2 transition-all duration-300 card-shine overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center transform group-hover:rotate-6 transition-transform">
                <span className="material-symbols-outlined text-5xl text-purple-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                  lab_research
                </span>
              </div>
              <div className="relative">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{messages.home.labsTitle}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">{messages.home.labsSubtitle}</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
