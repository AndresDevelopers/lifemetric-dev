'use client';

import type { MealHistoryEntry } from '@/lib/mealHistory';
import dynamic from 'next/dynamic';

const HistorialComidasContent = dynamic(() => import('@/components/resumen/HistorialComidas'), {
  ssr: false,
  loading: () => (
    <section className="space-y-6 pb-12">
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-6 rounded-[2.5rem] border border-slate-200/50 bg-white/40 p-6 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center">
          <div className="space-y-2">
            <div className="h-8 w-48 rounded-full bg-slate-200/70" />
            <div className="h-4 w-64 rounded-full bg-slate-100" />
          </div>
          <div className="flex gap-3">
            <div className="h-11 w-32 rounded-2xl bg-white shadow-sm" />
            <div className="h-11 w-24 rounded-2xl bg-white shadow-sm" />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="h-20 rounded-2xl bg-slate-100/80" />
        </div>
      </div>
    </section>
  ),
});

export default function HistorialComidasClient({
  initialComidas,
}: {
  readonly initialComidas: readonly MealHistoryEntry[];
}) {
  return <HistorialComidasContent initialComidas={initialComidas} />;
}
