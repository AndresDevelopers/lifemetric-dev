export default function ResumenLoading() {
  return (
    <div className="min-h-screen bg-surface-container-low">
      <div className="p-6 md:p-10 max-w-4xl mx-auto pb-32 md:pb-12 space-y-6 animate-pulse">
        <div className="rounded-[2.5rem] bg-slate-200/70 h-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-3xl bg-slate-200/70 h-28" />
          ))}
        </div>
        <div className="rounded-[2rem] bg-slate-200/70 h-40" />
        <div className="rounded-[2rem] bg-slate-200/70 h-72" />
      </div>
    </div>
  );
}
