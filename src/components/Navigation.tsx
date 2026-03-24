"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/components/providers/LocaleProvider";

export default function Navigation() {
  const pathname = usePathname();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Lifemetric";
  const { messages } = useLocale();

  const PUBLIC_PATHS = ["/login", "/registro", "/recuperar"];
  const isPublicPath = pathname && PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (isPublicPath) {
    return null;
  }

  const NAV_ITEMS = [
    { name: messages.navigation.home, path: "/", icon: "home_health" },
    { name: messages.navigation.food, path: "/comidas/nuevo", icon: "restaurant" },
    { name: messages.navigation.glucose, path: "/glucosa/nuevo", icon: "glucose" },
    { name: messages.navigation.habits, path: "/habitos/nuevo", icon: "settings_accessibility" },
    { name: messages.navigation.patients, path: "/pacientes/nuevo", icon: "person_add" },
    { name: messages.navigation.summary, path: "/resumen", icon: "insights" },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 pb-6 pt-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-3xl border-t border-slate-100 dark:border-slate-800 md:hidden">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              href={item.path}
              key={item.path}
              className={`flex flex-col items-center justify-center px-3 py-1.5 transition-transform active:scale-90 rounded-2xl ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-slate-400 dark:text-slate-500 hover:text-blue-500"
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest mt-1">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-72 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex-col py-4 z-50">
        <div className="text-2xl font-black text-blue-900 dark:text-blue-100 px-6 py-8">
          {appName}
        </div>
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
