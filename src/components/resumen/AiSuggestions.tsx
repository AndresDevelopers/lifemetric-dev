import { buildClinicalSuggestions } from "@/lib/ai/gemini";
import { registerCacheKey } from "@/lib/cache-invalidation";
import ExpandableSuggestions from "@/components/resumen/ExpandableSuggestions";
import { intelligentCache } from "@/lib/redis";
import { createHash } from "node:crypto";

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, nestedValue]) => `"${key}":${stableSerialize(nestedValue)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function computePayloadHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}

async function getCachedAiSuggestions(params: {
  pacienteId: string;
  locale: "es" | "en";
  rangeFrom: Date;
  rangeTo: Date;
  aiSuggestionPayload: Record<string, unknown>;
}) {
  const payloadHash = computePayloadHash(params.aiSuggestionPayload);
  const rangeFromKey = params.rangeFrom.toISOString().slice(0, 10);
  const rangeToKey = params.rangeTo.toISOString().slice(0, 10);
  const cacheKey = [
    "ai-suggestions",
    params.pacienteId,
    params.locale,
    rangeFromKey,
    rangeToKey,
    payloadHash,
  ].join(":");

  const aiSuggestions = await intelligentCache(
    cacheKey,
    async () =>
      buildClinicalSuggestions({
        locale: params.locale,
        data: params.aiSuggestionPayload,
      }),
    {
      revalidate: 300,
      tags: [
        `ai-suggestions-${params.pacienteId}`,
        `patient-${params.pacienteId}`,
      ],
    },
  );

  await registerCacheKey(params.pacienteId, cacheKey);

  return aiSuggestions;
}

export default async function AiSuggestions({
  pacienteId,
  locale,
  rangeFrom,
  rangeTo,
  aiSuggestionPayload,
  messages,
}: {
  pacienteId: string;
  locale: "es" | "en";
  rangeFrom: Date;
  rangeTo: Date;
  aiSuggestionPayload: Record<string, unknown>;
  messages: {
    aiSuggestionsTitle: string;
    aiSuggestionsSubtitle: string;
    showMore: string;
    showLess: string;
    aiSuggestionsFallback: string;
    centralProblems: string;
    priorityPlan: string;
    nutritionFocus: string;
    lifestyleFocus: string;
    recommendedLabs: string;
    productsGuidance: string;
    expectedProgress: string;
    aiSuggestionsDisclaimer: string;
    keepTracking: string;
  };
}) {
  let aiSuggestions: Awaited<ReturnType<typeof buildClinicalSuggestions>> | null = null;

  try {
    aiSuggestions = await getCachedAiSuggestions({
      pacienteId,
      locale,
      rangeFrom,
      rangeTo,
      aiSuggestionPayload,
    });
  } catch (error) {
    console.error("Failed to load AI suggestions:", error);
    aiSuggestions = null;
  }

  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{messages.aiSuggestionsTitle}</h3>
          <p className="text-sm text-slate-500">{messages.aiSuggestionsSubtitle}</p>
        </div>
        <span className="material-symbols-outlined rounded-2xl bg-emerald-100 p-3 text-emerald-700">auto_awesome</span>
      </div>

      {aiSuggestions ? (
        <ExpandableSuggestions
          showMoreLabel={messages.showMore}
          showLessLabel={messages.showLess}
        >
          <p className="mt-4 text-sm text-slate-700">
            {aiSuggestions.summary || messages.aiSuggestionsFallback}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {aiSuggestions.centralProblems?.length ? (
              <article className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-600">{messages.centralProblems}</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-800">
                  {aiSuggestions.centralProblems.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </article>
            ) : null}
            {aiSuggestions.priorityPlan?.length ? (
              <article className="rounded-xl bg-blue-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-wider text-blue-700">{messages.priorityPlan}</p>
                <ul className="mt-2 space-y-1 text-sm text-blue-900">
                  {aiSuggestions.priorityPlan.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </article>
            ) : null}
            {aiSuggestions.nutritionFocus?.length ? (
              <article className="rounded-xl bg-emerald-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700">{messages.nutritionFocus}</p>
                <ul className="mt-2 space-y-1 text-sm text-emerald-900">
                  {aiSuggestions.nutritionFocus.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </article>
            ) : null}
            {aiSuggestions.lifestyleFocus?.length ? (
              <article className="rounded-xl bg-violet-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-wider text-violet-700">{messages.lifestyleFocus}</p>
                <ul className="mt-2 space-y-1 text-sm text-violet-900">
                  {aiSuggestions.lifestyleFocus.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </article>
            ) : null}
          </div>

          {aiSuggestions.recommendedLabs?.length ? (
            <article className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wider text-cyan-700">{messages.recommendedLabs}</p>
              <ul className="mt-2 space-y-1 text-sm text-cyan-900">
                {aiSuggestions.recommendedLabs.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </article>
          ) : null}

          {aiSuggestions.productsGuidance?.length ? (
            <article className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wider text-rose-700">{messages.productsGuidance}</p>
              <ul className="mt-2 space-y-1 text-sm text-rose-900">
                {aiSuggestions.productsGuidance.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </article>
          ) : null}

          {aiSuggestions.expectedProgress?.length ? (
            <article className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wider text-teal-700">{messages.expectedProgress}</p>
              <ul className="mt-2 space-y-1 text-sm text-teal-900">
                {aiSuggestions.expectedProgress.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </article>
          ) : null}

          {aiSuggestions.patientMessage && (
            <blockquote className="mt-4 rounded-xl border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm text-slate-700 italic">
              "{aiSuggestions.patientMessage}"
            </blockquote>
          )}

          <ul className="mt-4 space-y-2">
            {(aiSuggestions.suggestions ?? [messages.keepTracking]).map((suggestion) => (
              <li key={suggestion} className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                • {suggestion}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-slate-500">
            {messages.aiSuggestionsDisclaimer}
          </p>
        </ExpandableSuggestions>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-slate-700">{messages.aiSuggestionsFallback}</p>
          <ul className="mt-4 space-y-2">
            <li className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              • {messages.keepTracking}
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
