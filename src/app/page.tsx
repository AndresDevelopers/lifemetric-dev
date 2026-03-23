import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export default async function Home() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('lifemetric_session')?.value;

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
    <div className="p-6 md:p-10 max-w-7xl mx-auto flex flex-col gap-8">
      <header>
        <h1 className="text-4xl font-extrabold text-blue-900 dark:text-blue-200">
          Hola, {paciente.nombre} 👋
        </h1>
        <p className="text-slate-500 mt-2 text-lg">
          Recomendaciones clínicas activas para tí hoy.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/comidas/nuevo"
          className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-6 shadow-xl border border-white/20 hover:scale-[1.02] transition-transform flex flex-col items-center text-center gap-4 cursor-pointer text-primary"
        >
          <span
            className="material-symbols-outlined text-5xl bg-primary/10 p-4 rounded-full"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            restaurant
          </span>
          <div>
            <h2 className="text-xl font-bold">Registrar Comida</h2>
            <p className="text-slate-500 text-sm mt-1">Con auto-reconocimiento IA</p>
          </div>
        </Link>

        <Link
          href="/glucosa/nuevo"
          className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-6 shadow-xl border border-white/20 hover:scale-[1.02] transition-transform flex flex-col items-center text-center gap-4 cursor-pointer text-secondary"
        >
          <span
            className="material-symbols-outlined text-5xl bg-secondary/10 p-4 rounded-full"
          >
            glucose
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Registrar Glucosa</h2>
            <p className="text-slate-500 text-sm mt-1">Lleva el control de tus niveles</p>
          </div>
        </Link>

        <Link
          href="/habitos/nuevo"
          className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-6 shadow-xl border border-white/20 hover:scale-[1.02] transition-transform flex flex-col items-center text-center gap-4 cursor-pointer text-blue-500"
        >
          <span
            className="material-symbols-outlined text-5xl bg-blue-500/10 p-4 rounded-full"
          >
            settings_accessibility
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Hábitos Diarios</h2>
            <p className="text-slate-500 text-sm mt-1">Sueño, agua y actividad</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
