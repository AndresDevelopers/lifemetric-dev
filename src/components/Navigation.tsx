/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/components/providers/LocaleProvider";

type UserName = { nombre: string; apellido: string; avatar_url?: string | null };

function getInitials(user: UserName): string {
  return `${user.nombre.charAt(0)}${user.apellido.charAt(0)}`.toUpperCase();
}

/** Deterministic hue from user name for avatar background */
function getAvatarHue(user: UserName): number {
  const str = `${user.nombre}${user.apellido}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

interface NavigationProps {
  userName?: UserName;
}

export default function Navigation({ userName }: NavigationProps) {
  const pathname = usePathname();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Lifemetric";
  const { messages } = useLocale();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const PUBLIC_PATHS = ["/login", "/recuperar", "/registro"];
  const isPublicPath = pathname && PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (isPublicPath) {
    return null;
  }

  const NAV_ITEMS = [
    { name: messages.navigation.home, path: "/", icon: "home_health" },
    { name: messages.navigation.habits, path: "/habitos/nuevo", icon: "settings_accessibility" },
    { name: messages.navigation.food, path: "/comidas/nuevo", icon: "add_circle" },
    { name: messages.navigation.medication, path: "/medicacion/nuevo", icon: "medication" },
    { name: messages.navigation.summary, path: "/resumen", icon: "insights" },
  ];

  const initials = userName ? getInitials(userName) : null;
  const hue = userName ? getAvatarHue(userName) : 220;
  const avatarStyle = {
    background: `hsl(${hue} 65% 50%)`,
  };

  return (
    <>
      {/* ── Mobile: floating avatar chip (top-right) with menu ── */}
      {userName && (
        <>
          <button
            onClick={() => setIsMenuOpen(true)}
            className="fixed top-4 right-4 z-[60] flex items-center gap-2 md:hidden active:scale-95 transition-transform"
            aria-label={messages.settings?.title || "Settings"}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ring-2 ring-white dark:ring-slate-900 select-none"
              style={avatarStyle}
            >
              {userName.avatar_url ? (
                <img src={userName.avatar_url} alt="Avatar" className="w-full h-full object-cover rounded-full" />
              ) : (
                initials
              )}
            </div>
          </button>

          {/* Mobile Overlay Menu */}
          {isMenuOpen && (
            <div className="fixed inset-0 z-[100] md:hidden">
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                onClick={() => setIsMenuOpen(false)}
              />
              
              {/* Menu Content */}
              <div className="absolute bottom-6 left-4 right-4 bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
                <div className="flex items-center gap-4 px-4 py-6 border-b border-slate-100 dark:border-slate-700/50 mb-2">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-sm font-bold shadow-md overflow-hidden"
                    style={avatarStyle}
                  >
                    {userName.avatar_url ? (
                      <img src={userName.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                      {userName.nombre} {userName.apellido}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{appName}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link
                    href="/ajustes"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">settings</span>
                    <span className="font-semibold">{messages.settings.title}</span>
                  </Link>

                  <form action={logoutAction} className="block">
                    <button
                      type="submit"
                      className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <span className="material-symbols-outlined">logout</span>
                      <span className="font-semibold">{messages.navigation.logout}</span>
                    </button>
                  </form>

                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full mt-2 py-4 rounded-2xl bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold active:scale-[0.98] transition-all"
                  >
                    {messages.common.close}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Mobile: bottom nav ── */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-end px-2 pb-6 pt-2 bg-white/80 dark:bg-slate-950/80 backdrop-blur-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] rounded-t-[40px] border-t border-slate-200/50 dark:border-slate-800/50 md:hidden">
        {NAV_ITEMS.map((item, index) => {
          const isActive = pathname === item.path;
          const isCenter = index === 2; // Food (Add button)

          if (isCenter) {
            return (
              <Link
                href={item.path}
                key={item.path}
                className="relative -top-5 flex flex-col items-center justify-center group"
                aria-label={item.name}
              >
                <div className={`
                  w-14 h-14 rounded-[22px] flex items-center justify-center 
                  shadow-2xl shadow-blue-500/20 dark:shadow-blue-500/30
                  ${isActive 
                    ? 'bg-blue-600' 
                    : 'bg-gradient-to-br from-blue-600 to-blue-500'}
                  transition-all duration-300 active:scale-90 group-hover:scale-110
                `}>
                  <span className="material-symbols-outlined text-white text-[32px] font-bold">
                    add
                  </span>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest mt-2 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                  {item.name}
                </span>
              </Link>
            );
          }

          return (
            <Link
              href={item.path}
              key={item.path}
              className={`flex-1 flex flex-col items-center justify-center py-4 transition-all active:scale-95 ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-400 dark:text-slate-600"
              }`}
            >
              <div className={`
                flex flex-col items-center transition-all duration-300
                ${isActive ? 'scale-110' : ''}
              `}>
                <span
                  className="material-symbols-outlined text-[26px]"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span className={`text-[9.5px] font-bold uppercase tracking-tight mt-1.5 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                  {item.name}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* ── Desktop: sidebar ── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-72 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex-col py-4 z-50">
        {/* Profile card */}
        {userName ? (
          <div className="px-3 pt-4 mb-4">
            <Link
              href="/ajustes"
              className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all group"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md select-none flex-shrink-0 group-hover:scale-105 transition-transform overflow-hidden"
                style={avatarStyle}
              >
                {userName.avatar_url ? (
                  <img src={userName.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {userName.nombre} {userName.apellido}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="material-symbols-outlined text-[14px] text-slate-400">settings</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{messages.settings.title}</span>
                </div>
              </div>
            </Link>
          </div>
        ) : (
          <div className="text-2xl font-black text-blue-900 dark:text-blue-100 px-6 py-8">
            {appName}
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                href={item.path}
                key={item.path}
                className={`flex items-center gap-4 mx-3 px-4 py-3 rounded-lg transition-all hover:translate-x-1 cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span className="text-sm font-semibold">{item.name}</span>
              </Link>
            );
          })}
        </div>
        <div className="px-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <LanguageSwitcher className="justify-between rounded-2xl bg-white/70 px-4 py-3 dark:bg-slate-800/70" />
        </div>
        <form action={logoutAction} className="px-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="submit"
            className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="text-sm font-semibold">{messages.navigation.logout}</span>
          </button>
        </form>
      </aside>
      
      <div className="hidden md:block w-72 flex-shrink-0" />
    </>
  );
}
