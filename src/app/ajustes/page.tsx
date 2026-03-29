/* eslint-disable @next/next/no-img-element */
'use client';

import { useActionState, useState, useEffect, useRef } from 'react';
import {
  changePasswordAction,
  deleteAccountAction,
  subscribeToEmailsAction,
  updateProfileAction,
  updateLanguageAction,
} from '@/actions/auth';
import { getSessionPaciente } from '@/actions/data';
import { guardFileUploadWithVirusTotal } from '@/lib/fileScan';
import { getMessages, normalizeLocale, getBrowserLocale, persistLocale, type Locale } from '@/lib/i18n';

type SettingsUser = Awaited<ReturnType<typeof getSessionPaciente>>;

export default function AjustesPage() {
  const [locale, setLocale] = useState<Locale>(() => {
    // If we are in the browser, check URL first, otherwise fallback to browser default.
    if (typeof globalThis.window !== 'undefined') {
      const urlLang = new URLSearchParams(globalThis.window.location.search).get('lang');
      if (urlLang) return normalizeLocale(urlLang);
    }
    return getBrowserLocale();
  });

  const messages = getMessages(locale);
  
  const [passwordState, passwordFormAction, isPasswordPending] = useActionState(changePasswordAction, undefined);
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(deleteAccountAction, undefined);
  const [profileState, profileFormAction, isProfilePending] = useActionState(updateProfileAction, undefined);
  const [subscriptionState, subscriptionFormAction, isSubscriptionPending] = useActionState(subscribeToEmailsAction, undefined);
  const [, languageFormAction, isLanguagePending] = useActionState(updateLanguageAction, undefined);
  
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
        if (data.idioma) setLocale(data.idioma as Locale);
      }
    }
    loadUser();
  }, []);

  const handleLanguageChange = (newLocale: Locale) => {
    setLocale(newLocale);
    persistLocale(newLocale);
    
    // Automatically persist to DB
    const formData = new FormData();
    formData.append('idioma', newLocale);
    formData.append('locale', newLocale);
    languageFormAction(formData);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const canProceed = await guardFileUploadWithVirusTotal(file, locale, {
        scanning: messages.settings.virusScanning,
        blockedPrefix: messages.settings.virusBlocked,
        fallbackPrefix: messages.settings.virusFallback,
        successPrefix: messages.settings.virusPassed,
      });

      if (!canProceed) {
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-surface-container-low overflow-hidden pb-20 lg:pb-0 lg:pl-64">
      {/* ── Background Blobs for Premium Feel ── */}
      <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-blue-200/30 blur-[100px] rounded-full animate-blob z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-200/20 blur-[120px] rounded-full animate-blob animation-delay-4000 z-0" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">
            {messages.settings.title}
          </h1>
        </div>

        <div className="space-y-8">
          {/* Profile Section */}
          <section className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/60 border border-white">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">
              {messages.settings.profileInfo}
            </h2>
            
            <form action={profileFormAction} className="space-y-6">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="avatar_url" value={avatarPreview || ''} />
              
              {/* Avatar Upload */}
              <div className="flex flex-col items-center">
                <button 
                  type="button"
                  onClick={handleAvatarClick}
                  className="relative group cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-500/20 rounded-full transition-all active:scale-95"
                  aria-label={messages.settings.changeAvatar}
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
                </button>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    {messages.settings.fields.height}
                  </label>
                  <input
                    type="number"
                    min="80"
                    max="272"
                    step="0.1"
                    name="altura_cm"
                    defaultValue={user.altura_cm ?? ''}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {messages.settings.fields.registrationReason}
                </label>
                <div className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-sm">
                  {user.motivo_registro || messages.settings.fields.registrationReasonFallback}
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


          <section className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/60 border border-white">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
              {messages.settings.emailSubscriptionTitle}
            </h2>
            <p className="text-sm font-medium text-slate-500 mb-6 leading-relaxed">
              {messages.settings.emailSubscriptionDescription}
            </p>
            <form action={subscriptionFormAction} className="space-y-4">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="newsletterSubscribed" value={String(!!user.newsletter_suscrito)} />
              <input type="hidden" name="email" value={user.email} />
              <div className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-semibold text-sm">
                {user.email}
              </div>
              <label htmlFor="newsletterToggleSettings" className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer group">
                <input
                  id="newsletterToggleSettings"
                  type="checkbox"
                  checked={!!user.newsletter_suscrito}
                  onChange={(event) => setUser((prev) => (prev ? { ...prev, newsletter_suscrito: event.target.checked } : prev))}
                  className="h-5 w-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 transition-all"
                />
                <span className="text-sm font-bold text-slate-700">{messages.settings.emailSubscriptionToggle}</span>
              </label>
              
              {subscriptionState?.success && <p className="text-sm font-bold text-emerald-600 px-2">{messages.settings.emailSubscriptionSuccess}</p>}
              {subscriptionState?.error && <p className="text-sm font-bold text-red-600 px-2">{subscriptionState.error}</p>}

              <button
                type="submit"
                disabled={isSubscriptionPending}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-[0.98] mt-2 uppercase tracking-widest text-xs"
              >
                {isSubscriptionPending ? messages.common.saving : messages.common.save}
              </button>
            </form>
          </section>

          {/* Change Password Section */}
          <section className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/60 border border-white">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
              {messages.settings.changePassword}
            </h2>
            <form action={passwordFormAction} className="space-y-4">
              <input type="hidden" name="locale" value={locale} />
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">
                  {messages.settings.newPassword}
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="new-password"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold"
                  placeholder="••••••••"
                />
              </div>

              {passwordState?.error && (
                <p className="text-sm font-bold text-red-500 px-2">{passwordState.error}</p>
              )}
              {passwordState?.success && (
                <p className="text-sm font-bold text-green-500 px-2">{passwordState.message}</p>
              )}
              <button
                type="submit"
                disabled={isPasswordPending}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-4 rounded-2xl transition-all disabled:opacity-50 active:scale-[0.98] uppercase tracking-widest text-xs"
              >
                {isPasswordPending ? messages.common.saving : messages.common.save}
              </button>
            </form>
          </section>

          {/* Language Section */}
          <section className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/60 border border-white">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">
              {messages.settings.languageTitle}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                disabled={isLanguagePending}
                onClick={() => handleLanguageChange('es')}
                className={`flex items-center justify-between px-6 py-4 rounded-2xl border-2 transition-all group ${
                  locale === 'es' 
                    ? 'border-blue-500 bg-blue-50/50 text-blue-900' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-600'
                } ${isLanguagePending ? 'opacity-50 cursor-wait' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇪🇸</span>
                  <span className="font-bold">Español</span>
                </div>
                {locale === 'es' && (
                  <span className="material-symbols-outlined text-blue-500 font-bold">check_circle</span>
                )}
              </button>

              <button
                type="button"
                disabled={isLanguagePending}
                onClick={() => handleLanguageChange('en')}
                className={`flex items-center justify-between px-6 py-4 rounded-2xl border-2 transition-all group ${
                  locale === 'en' 
                    ? 'border-blue-500 bg-blue-50/50 text-blue-900' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-600'
                } ${isLanguagePending ? 'opacity-50 cursor-wait' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇺🇸</span>
                  <span className="font-bold">English</span>
                </div>
                {locale === 'en' && (
                  <span className="material-symbols-outlined text-blue-500 font-bold">check_circle</span>
                )}
              </button>
            </div>
          </section>

          {/* Delete Account Section */}
          <section className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl shadow-red-100/50 border border-red-50">
            <h2 className="text-xs font-black text-red-400 uppercase tracking-widest mb-2">
              {messages.settings.deleteAccount}
            </h2>
            <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
              {messages.settings.deleteAccountConfirm}
            </p>

            {showDeleteConfirm ? (
              <form action={deleteFormAction} className="space-y-4 flex flex-col items-center">
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  disabled={isDeletePending}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-2xl transition-all disabled:opacity-50 shadow-xl shadow-red-500/20 uppercase tracking-widest text-xs"
                >
                  {isDeletePending ? messages.common.saving : messages.settings.deleteAccountSubmit}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="mt-2 text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]"
                >
                  {messages.common.back}
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-4 rounded-2xl border-2 border-red-100 text-red-600 font-black uppercase tracking-widest text-xs hover:bg-red-50 transition-all active:scale-95"
              >
                {messages.settings.deleteAccount}
              </button>
            )}
            {deleteState?.error && (
              <p className="text-sm font-bold text-red-500 mt-4 px-2">{deleteState.error}</p>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
