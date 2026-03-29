'use client';

import { useActionState } from 'react';
import { submitFeedbackAction } from '@/actions/feedback';
import { useLocale } from '@/components/providers/LocaleProvider';

export default function FeedbackPage() {
  const { locale, messages } = useLocale();
  const feedbackMessages = messages.feedback;
  const [state, action, isPending] = useActionState(submitFeedbackAction, undefined);

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-container-low pb-24 lg:pl-64">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/40 blur-[100px] rounded-full animate-blob z-0" />
      <div className="absolute top-[20%] right-[-5%] w-[35%] h-[35%] bg-indigo-200/30 blur-[100px] rounded-full animate-blob animation-delay-2000 z-0" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <section className="rounded-[2.5rem] bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-800 p-8 md:p-10 text-white shadow-2xl shadow-blue-900/20">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">{feedbackMessages.badge}</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">{feedbackMessages.title}</h1>
          <p className="mt-3 max-w-2xl text-blue-100/90 text-sm md:text-base">{feedbackMessages.subtitle}</p>
        </section>

        <section className="rounded-[2.5rem] bg-white p-6 md:p-8 border border-white shadow-xl shadow-slate-200/60">
          {state?.error ? (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">
              {state.error}
            </div>
          ) : null}
          {state?.success ? (
            <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700">
              {state.message}
            </div>
          ) : null}

          <form action={action} className="space-y-5">
            <input type="hidden" name="locale" value={locale} />

            <div className="space-y-2">
              <label htmlFor="type" className="text-sm font-bold text-slate-700">{feedbackMessages.typeLabel}</label>
              <select
                id="type"
                name="type"
                defaultValue="error"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value="error">{feedbackMessages.typeError}</option>
                <option value="suggestion">{feedbackMessages.typeSuggestion}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="subject" className="text-sm font-bold text-slate-700">{feedbackMessages.subjectLabel}</label>
              <input
                id="subject"
                name="subject"
                required
                minLength={4}
                maxLength={120}
                placeholder={feedbackMessages.subjectPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-bold text-slate-700">{feedbackMessages.messageLabel}</label>
              <textarea
                id="message"
                name="message"
                required
                minLength={12}
                maxLength={2000}
                rows={7}
                placeholder={feedbackMessages.messagePlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-y"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 disabled:opacity-70"
            >
              <span className="material-symbols-outlined text-base">{isPending ? 'progress_activity' : 'send'}</span>
              {isPending ? feedbackMessages.sending : feedbackMessages.send}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
