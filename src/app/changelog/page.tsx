import { execSync } from 'node:child_process';
import { cookies, headers } from 'next/headers';
import { getMessages, inferLocaleFromRequest, LOCALE_COOKIE_NAME, LOCALE_EXPLICIT_COOKIE_NAME } from '@/lib/i18n';
import { generateGeminiText } from '@/lib/ai/gemini';

type CommitEntry = {
  hash: string;
  date: string;
  subject: string;
};

function getTrackedCommits(): CommitEntry[] {
  try {
    const since = '2026-04-03T00:00:00.000Z';
    const output = execSync(`git log main --since="${since}" --pretty=format:"%H|%cI|%s"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (!output) return [];
    return output
      .split('\n')
      .map((line) => {
        const [hash, date, subject] = line.split('|');
        if (!hash || !date || !subject) return null;
        return { hash, date, subject };
      })
      .filter((entry): entry is CommitEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function fallbackSummary(commits: CommitEntry[], locale: 'es' | 'en'): string {
  if (!commits.length) {
    return locale === 'es'
      ? 'Hoy no hay commits nuevos para mostrar.'
      : 'There are no new commits today.';
  }

  const intro = locale === 'es'
    ? 'Resumen rápido de cambios del día:'
    : "Quick summary of today's changes:";
  const lines = commits.slice(0, 8).map((commit) => `• ${commit.subject}`);
  return `${intro}\n${lines.join('\n')}`;
}

async function summarizeCommitsWithAI(commits: CommitEntry[], locale: 'es' | 'en'): Promise<string> {
  if (!commits.length) {
    return fallbackSummary(commits, locale);
  }

  try {
    const prompt = locale === 'es'
      ? `Resume estos commits del día para usuarios finales, con lenguaje claro y no técnico. 
Incluye:
1) Qué se corrigió o agregó.
2) Impacto para el usuario.
3) Si hay cambios de seguridad o estabilidad.
Máximo 8 viñetas.

Commits:
${commits.map((c) => `- ${c.subject}`).join('\n')}`
      : `Summarize these commits for end users in clear, non-technical language.
Include:
1) What was fixed or added.
2) User impact.
3) Any reliability or security impact.
Maximum 8 bullet points.

Commits:
${commits.map((c) => `- ${c.subject}`).join('\n')}`;

    const response = await generateGeminiText({
      prompt,
      maxOutputTokens: 420,
      temperature: 0.4,
    });

    return response.trim() || fallbackSummary(commits, locale);
  } catch {
    return fallbackSummary(commits, locale);
  }
}

export default async function ChangelogPage() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = inferLocaleFromRequest({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    explicitCookie: cookieStore.get(LOCALE_EXPLICIT_COOKIE_NAME)?.value,
    acceptLanguage: headerStore.get('accept-language'),
    country: headerStore.get('x-vercel-ip-country') ?? headerStore.get('cf-ipcountry'),
    city: headerStore.get('x-vercel-ip-city') ?? headerStore.get('cf-ipcity'),
  });
  const messages = getMessages(locale);
  const changelogMessages = messages.changelog;

  const commits = getTrackedCommits();
  const summary = await summarizeCommitsWithAI(commits, locale);

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-container-low pb-24 lg:pl-64">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/40 blur-[100px] rounded-full animate-blob z-0" />
      <div className="absolute top-[20%] right-[-5%] w-[35%] h-[35%] bg-indigo-200/30 blur-[100px] rounded-full animate-blob animation-delay-2000 z-0" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <section className="rounded-[2.5rem] bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-800 p-8 md:p-10 text-white shadow-2xl shadow-blue-900/20">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">{changelogMessages.badge}</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">{changelogMessages.title}</h1>
        </section>

        <section className="rounded-[2.5rem] bg-white p-6 md:p-8 border border-white shadow-xl shadow-slate-200/60">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">{changelogMessages.todaySummary}</h2>
          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {summary}
          </div>
        </section>
      </div>
    </div>
  );
}
