export default function AiSuggestionsLoading({
  messages,
}: {
  messages: {
    aiSuggestionsTitle: string;
    aiSuggestionsSubtitle: string;
  };
}) {
  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{messages.aiSuggestionsTitle}</h3>
          <p className="text-sm text-slate-500">{messages.aiSuggestionsSubtitle}</p>
        </div>
        <span className="material-symbols-outlined rounded-2xl bg-emerald-100 p-3 text-emerald-700">auto_awesome</span>
      </div>

      <div className="mt-4 space-y-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-full"></div>
        <div className="h-4 bg-slate-200 rounded w-5/6"></div>
        <div className="h-4 bg-slate-200 rounded w-4/6"></div>
        
        <div className="grid gap-3 sm:grid-cols-2 mt-4">
          <div className="rounded-xl bg-slate-100 px-4 py-3 h-24"></div>
          <div className="rounded-xl bg-slate-100 px-4 py-3 h-24"></div>
        </div>

        <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <span>Generando sugerencias personalizadas...</span>
        </div>
      </div>
    </section>
  );
}
