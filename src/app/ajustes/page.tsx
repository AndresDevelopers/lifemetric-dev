'use client';

import { useActionState, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMessages, normalizeLocale } from '@/lib/i18n';
import { changePasswordAction, deleteAccountAction, logoutAction } from '@/actions/auth';
import Navigation from '@/components/Navigation';

export default function AjustesPage() {
  const searchParams = useSearchParams();
  const locale = normalizeLocale(searchParams.get('lang'));
  const messages = getMessages(locale);
  
  const [passwordState, passwordFormAction, isPasswordPending] = useActionState(changePasswordAction, undefined);
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(deleteAccountAction, undefined);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20 lg:pb-0 lg:pl-64">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {messages.settings.title}
          </h1>
          <button
            onClick={() => globalThis.history.back()}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-6">
          {/* Change Password Section */}
          <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-4">
              {messages.settings.changePassword}
            </h2>
            <form action={passwordFormAction} className="space-y-4">
              <input type="hidden" name="locale" value={locale} />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {messages.settings.newPassword}
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              {passwordState?.error && (
                <p className="text-sm text-red-500">{passwordState.error}</p>
              )}
              {passwordState?.success && (
                <p className="text-sm text-green-500">{passwordState.message}</p>
              )}

              <button
                type="submit"
                disabled={isPasswordPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
              >
                {isPasswordPending ? messages.common.saving : messages.common.save}
              </button>
            </form>
          </section>

          {/* Delete Account Section */}
          <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30">
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
              {messages.settings.deleteAccount}
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
              {messages.settings.deleteAccountConfirm}
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 hover:text-red-700 font-medium transition-colors"
              >
                {messages.settings.deleteAccount}
              </button>
            ) : (
              <form action={deleteFormAction} className="space-y-4">
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  disabled={isDeletePending}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
                >
                  {isDeletePending ? messages.common.saving : messages.settings.deleteAccountSubmit}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full text-gray-500 dark:text-slate-400 py-2"
                >
                  {messages.common.back}
                </button>
              </form>
            )}
            {deleteState?.error && (
              <p className="text-sm text-red-500 mt-2">{deleteState.error}</p>
            )}
          </section>

          {/* Logout Section */}
          <section className="pt-4">
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 font-bold border border-gray-100 dark:border-slate-700 shadow-sm active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined">logout</span>
                {messages.navigation.logout}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
