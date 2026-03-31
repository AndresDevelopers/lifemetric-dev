export type SupportedLocale = "es" | "en";

export type ChatNavigationAction = {
  label: string;
  path: string;
  reason: string;
};

type LocalizedText = Record<SupportedLocale, string>;

type AppRouteGuide = {
  path: string;
  label: LocalizedText;
  purpose: LocalizedText;
  whenToUse: LocalizedText;
  navigationHint: LocalizedText;
  keywords: string[];
};

export const APP_ROUTE_GUIDES: AppRouteGuide[] = [
  {
    path: "/",
    label: { es: "Inicio", en: "Home" },
    purpose: {
      es: "Panel principal con resumen del dia y accesos rapidos.",
      en: "Main dashboard with today's overview and quick actions.",
    },
    whenToUse: {
      es: "Cuando el usuario quiere ubicarse, revisar su dia o empezar un nuevo registro.",
      en: "When the user wants orientation, a daily overview, or to start a new entry.",
    },
    navigationHint: {
      es: "Desde aqui puede abrir Comidas, Glucosa, Habitos, Medicacion, Laboratorios y Resumen.",
      en: "From here the user can open Food, Glucose, Habits, Medication, Labs, and Summary.",
    },
    keywords: ["inicio", "panel", "home", "dashboard", "resumen de hoy"],
  },
  {
    path: "/comidas/nuevo",
    label: { es: "Comidas", en: "Food" },
    purpose: {
      es: "Registrar una comida, analizar foto y guardar contexto nutricional.",
      en: "Log a meal, analyze a photo, and store nutrition context.",
    },
    whenToUse: {
      es: "Cuando el usuario quiere subir o describir lo que comio.",
      en: "When the user wants to upload or describe what they ate.",
    },
    navigationHint: {
      es: "Se abre desde Inicio o desde el acceso central del menu inferior.",
      en: "Open it from Home or from the center action in the bottom navigation.",
    },
    keywords: ["comida", "comer", "almuerzo", "desayuno", "cena", "snack", "meal", "food", "foto de comida"],
  },
  {
    path: "/glucosa/nuevo",
    label: { es: "Glucosa", en: "Glucose" },
    purpose: {
      es: "Registrar una medicion de glucosa y vincularla con una comida reciente.",
      en: "Log a glucose reading and optionally link it to a recent meal.",
    },
    whenToUse: {
      es: "Cuando el usuario necesita guardar un valor de glucosa por momento del dia.",
      en: "When the user needs to save a glucose value for a moment of the day.",
    },
    navigationHint: {
      es: "Se encuentra en los accesos rapidos de Inicio.",
      en: "It is available from the Home quick actions.",
    },
    keywords: ["glucosa", "azucar", "glucose", "medicion", "fasting"],
  },
  {
    path: "/habitos/nuevo",
    label: { es: "Habitos", en: "Habits" },
    purpose: {
      es: "Guardar agua, sueno, ejercicio y signos vitales del dia.",
      en: "Save water intake, sleep, exercise, and vital signs for the day.",
    },
    whenToUse: {
      es: "Cuando el usuario quiere actualizar su rutina o constantes del dia.",
      en: "When the user wants to update daily routines or vitals.",
    },
    navigationHint: {
      es: "Esta en Inicio y en la navegacion lateral o inferior.",
      en: "It is in Home and in the side or bottom navigation.",
    },
    keywords: ["habito", "habitos", "agua", "sueno", "ejercicio", "presion", "pulse", "sleep", "exercise", "water"],
  },
  {
    path: "/medicacion/nuevo",
    label: { es: "Medicacion", en: "Medication" },
    purpose: {
      es: "Registrar medicamentos, dosis, evidencia fotografica y estado de toma.",
      en: "Log medications, doses, photo evidence, and intake status.",
    },
    whenToUse: {
      es: "Cuando el usuario necesita anotar una toma o actualizar adherencia.",
      en: "When the user needs to log a dose or update adherence.",
    },
    navigationHint: {
      es: "Esta disponible desde Inicio y desde la navegacion principal.",
      en: "It is available from Home and from the main navigation.",
    },
    keywords: ["medicacion", "medicina", "medicamento", "dosis", "pastilla", "medication", "dose"],
  },
  {
    path: "/laboratorios/nuevo",
    label: { es: "Laboratorios", en: "Labs" },
    purpose: {
      es: "Subir examenes, escanearlos con IA y completar valores clinicos.",
      en: "Upload labs, scan them with AI, and complete clinical values.",
    },
    whenToUse: {
      es: "Cuando el usuario quiere cargar un estudio nuevo o digitalizar resultados.",
      en: "When the user wants to add a new study or digitize results.",
    },
    navigationHint: {
      es: "Se abre desde la tarjeta de Laboratorios en Inicio.",
      en: "Open it from the Labs card on Home.",
    },
    keywords: ["laboratorio", "laboratorios", "examen", "examenes", "labs", "lab", "pdf", "resultado"],
  },
  {
    path: "/resumen",
    label: { es: "Resumen", en: "Summary" },
    purpose: {
      es: "Ver metricas, alertas, sugerencias IA, historial de comidas y laboratorios.",
      en: "View metrics, alerts, AI suggestions, meal history, and labs.",
    },
    whenToUse: {
      es: "Cuando el usuario quiere analizar progreso, exportar datos o revisar tendencias.",
      en: "When the user wants to analyze progress, export data, or review trends.",
    },
    navigationHint: {
      es: "Se accede desde Inicio o desde el menu principal.",
      en: "It can be opened from Home or from the main navigation.",
    },
    keywords: ["resumen", "analisis", "metricas", "progreso", "summary", "history", "historial"],
  },
  {
    path: "/ajustes",
    label: { es: "Ajustes", en: "Settings" },
    purpose: {
      es: "Gestionar perfil, avatar, idioma, correo, contrasena y cuenta.",
      en: "Manage profile, avatar, language, email, password, and account.",
    },
    whenToUse: {
      es: "Cuando el usuario quiere cambiar datos personales o preferencias.",
      en: "When the user wants to change personal data or preferences.",
    },
    navigationHint: {
      es: "Se abre desde el avatar o la tarjeta de perfil.",
      en: "Open it from the avatar menu or profile card.",
    },
    keywords: ["ajustes", "perfil", "cuenta", "idioma", "configuracion", "settings", "profile", "account"],
  },
  {
    path: "/feedback",
    label: { es: "Feedback", en: "Feedback" },
    purpose: {
      es: "Enviar errores o sugerencias al equipo.",
      en: "Send bugs or suggestions to the team.",
    },
    whenToUse: {
      es: "Cuando algo falla o el usuario quiere proponer una mejora.",
      en: "When something breaks or the user wants to suggest an improvement.",
    },
    navigationHint: {
      es: "Se encuentra en el menu adicional del avatar o en la barra lateral.",
      en: "It is in the avatar extra menu or the sidebar.",
    },
    keywords: ["feedback", "error", "bug", "sugerencia", "suggestion", "reportar"],
  },
  {
    path: "/changelog",
    label: { es: "Changelog", en: "Changelog" },
    purpose: {
      es: "Consultar cambios recientes de la aplicacion en lenguaje simple.",
      en: "Review recent app changes in plain language.",
    },
    whenToUse: {
      es: "Cuando el usuario quiere saber que se actualizo hoy.",
      en: "When the user wants to know what changed today.",
    },
    navigationHint: {
      es: "Se encuentra junto a Feedback en el menu adicional.",
      en: "It sits next to Feedback in the extra menu.",
    },
    keywords: ["changelog", "cambios", "update", "actualizacion", "release notes"],
  },
];

export function normalizeAppPath(pathname?: string | null): string {
  if (!pathname) return "/";

  const normalized = pathname.split("?")[0]?.split("#")[0]?.trim();
  if (!normalized) return "/";

  return normalized === "" ? "/" : normalized;
}

export function getRouteGuide(pathname?: string | null): AppRouteGuide | null {
  const normalized = normalizeAppPath(pathname);
  return APP_ROUTE_GUIDES.find((route) => route.path === normalized) ?? null;
}

export function buildAppNavigationContext(
  locale: SupportedLocale,
  pathname?: string | null,
): string {
  const normalized = normalizeAppPath(pathname);
  const currentRoute = getRouteGuide(normalized);

  const currentLocation = currentRoute
    ? [
        `Pantalla actual: ${currentRoute.label[locale]}.`,
        `Ruta actual: ${currentRoute.path}.`,
        `Objetivo de esta pantalla: ${currentRoute.purpose[locale]}.`,
      ].join("\n")
    : [
        "Pantalla actual: fuera del mapa principal conocido.",
        `Ruta actual: ${normalized}.`,
      ].join("\n");

  const routeLines = APP_ROUTE_GUIDES.map((route) => {
    return [
      `- ${route.label[locale]} (${route.path})`,
      `  Objetivo: ${route.purpose[locale]}`,
      `  Cuando usarlo: ${route.whenToUse[locale]}`,
      `  Como llegar: ${route.navigationHint[locale]}`,
    ].join("\n");
  }).join("\n");

  return `${currentLocation}

Mapa funcional disponible:
${routeLines}`;
}

function includesKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function dedupeActions(actions: ChatNavigationAction[]): ChatNavigationAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.path)) return false;
    seen.add(action.path);
    return true;
  });
}

export function getContextualChatActions(
  locale: SupportedLocale,
  pathname?: string | null,
  userMessage?: string,
): ChatNavigationAction[] {
  const normalizedPath = normalizeAppPath(pathname);
  const currentRoute = getRouteGuide(normalizedPath);
  const normalizedMessage = userMessage?.trim().toLowerCase() ?? "";
  const actions: ChatNavigationAction[] = [];

  if (currentRoute) {
    actions.push({
      label: locale === "es" ? `Seguir en ${currentRoute.label[locale]}` : `Continue in ${currentRoute.label[locale]}`,
      path: currentRoute.path,
      reason:
        locale === "es"
          ? `Ya estas en ${currentRoute.label[locale]}. ${currentRoute.purpose[locale]}`
          : `You are already on ${currentRoute.label[locale]}. ${currentRoute.purpose[locale]}`,
    });
  }

  if (normalizedMessage) {
    for (const route of APP_ROUTE_GUIDES) {
      if (!includesKeyword(normalizedMessage, route.keywords)) continue;
      actions.push({
        label: locale === "es" ? `Ir a ${route.label[locale]}` : `Go to ${route.label[locale]}`,
        path: route.path,
        reason:
          locale === "es"
            ? `${route.whenToUse[locale]} ${route.navigationHint[locale]}`
            : `${route.whenToUse[locale]} ${route.navigationHint[locale]}`,
      });
    }
  }

  const pathFallbacks: Record<string, string[]> = {
    "/": ["/comidas/nuevo", "/glucosa/nuevo", "/resumen"],
    "/comidas/nuevo": ["/glucosa/nuevo", "/resumen", "/"],
    "/glucosa/nuevo": ["/comidas/nuevo", "/resumen", "/"],
    "/habitos/nuevo": ["/resumen", "/ajustes", "/"],
    "/medicacion/nuevo": ["/resumen", "/ajustes", "/"],
    "/laboratorios/nuevo": ["/resumen", "/"],
    "/resumen": ["/laboratorios/nuevo", "/comidas/nuevo", "/ajustes"],
    "/ajustes": ["/feedback", "/changelog", "/"],
    "/feedback": ["/ajustes", "/"],
    "/changelog": ["/", "/resumen"],
  };

  for (const fallbackPath of pathFallbacks[normalizedPath] ?? ["/", "/resumen"]) {
    const route = getRouteGuide(fallbackPath);
    if (!route) continue;
    actions.push({
      label: locale === "es" ? `Abrir ${route.label[locale]}` : `Open ${route.label[locale]}`,
      path: route.path,
      reason:
        locale === "es"
          ? route.navigationHint[locale]
          : route.navigationHint[locale],
    });
  }

  return dedupeActions(actions).slice(0, 3);
}
