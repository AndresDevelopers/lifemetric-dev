'use client';

import { useActionState, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMessages, normalizeLocale } from '@/lib/i18n';
import { changePasswordAction, deleteAccountAction, logoutAction, updateProfileAction } from '@/actions/auth';
import { getSessionPaciente } from '@/actions/data';

type SettingsUser = Awaited<ReturnType<typeof getSessionPaciente>>;

export default function AjustesPage() {
  const searchParams = useSearchParams();
  const locale = normalizeLocale(searchParams.get('lang'));
  const messages = getMessages(locale);
  
  const [passwordState, passwordFormAction, isPasswordPending] = useActionState(changePasswordAction, undefined);
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(deleteAccountAction, undefined);
  const [profileState, profileFormAction, isProfilePending] = useActionState(updateProfileAction, undefined);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [user, setUser] = useState<SettingsUser>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadUser() {
      const data = await getSessionPaciente();
      if (data) {
        setUser(data);
        if (data.avatar_url) setAvatarPreview(data.avatar_url);
      }
    }
    loadUser();
  }, []);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
          {/* Profile Section */}
          <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-6">
              {messages.auth.register.title}
            </h2>
            
            <form action={profileFormAction} className="space-y-6">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="avatar_url" value={avatarPreview || ''} />
              
              {/* Avatar Upload */}
              <div className="flex flex-col items-center">
                <div 
                  onClick={handleAvatarClick}
                  className="relative group cursor-pointer"
                >
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 group-hover:border-blue-500 transition-colors">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-4xl text-slate-400">add_a_photo</span>
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 rounded-full transition-opacity">
                    <span className="material-symbols-outlined text-white">edit</span>
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <p className="mt-2 text-xs text-slate-500 font-medium">{messages.settings.fields.avatar}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {messages.settings.fields.firstName}
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    defaultValue={user.nombre}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {messages.settings.fields.lastName}
                  </label>
                  <input
                    type="text"
                    name="apellido"
                    defaultValue={user.apellido}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {messages.settings.fields.email}
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={user.email}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {messages.settings.fields.birthday}
                  </label>
                  <input
                    type="date"
                    name="fecha_nacimiento"
                    defaultValue={user.fecha_nacimiento ? new Date(user.fecha_nacimiento).toISOString().split('T')[0] : ''}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {messages.settings.fields.gender}
                  </label>
                  <select
                    name="sexo"
                    defaultValue={user.sexo}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none"
                  >
                    <option value="M">{messages.settings.fields.genderMale}</option>
                    <option value="F">{messages.settings.fields.genderFemale}</option>
                  </select>
                </div>
              </div>

              {profileState?.error && (
                <p className="text-sm text-red-500 font-medium">{profileState.error}</p>
              )}
              {profileState?.success && (
                <p className="text-sm text-green-500 font-medium">{profileState.message}</p>
              )}

              <button
                type="submit"
                disabled={isProfilePending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {isProfilePending ? messages.common.saving : messages.common.save}
              </button>
            </form>
          </section>

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
                <p className="text-sm text-red-500 font-medium">{passwordState.error}</p>
              )}
              {passwordState?.success && (
                <p className="text-sm text-green-500 font-medium">{passwordState.message}</p>
              )}

              <button
                type="submit"
                disabled={isPasswordPending}
                className="w-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
              >
                {isPasswordPending ? messages.common.saving : messages.common.save}
              </button>
            </form>
          </section>

          {/* Delete Account Section */}
          <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/10">
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
              {messages.settings.deleteAccount}
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
              {messages.settings.deleteAccountConfirm}
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 hover:text-red-700 font-bold transition-colors"
              >
                {messages.settings.deleteAccount}
              </button>
            ) : (
              <form action={deleteFormAction} className="space-y-4">
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  disabled={isDeletePending}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
                >
                  {isDeletePending ? messages.common.saving : messages.settings.deleteAccountSubmit}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full text-slate-500 dark:text-slate-400 py-2 font-medium"
                >
                  {messages.common.back}
                </button>
              </form>
            )}
            {deleteState?.error && (
              <p className="text-sm text-red-500 mt-2 font-medium">{deleteState.error}</p>
            )}
          </section>

          {/* Logout Section */}
          <section className="pt-4">
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 font-bold border border-gray-100 dark:border-slate-700 shadow-sm active:scale-95 transition-all group"
              >
                <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">logout</span>
                {messages.navigation.logout}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
