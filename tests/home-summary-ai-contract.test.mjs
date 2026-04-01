import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const homePath = path.join(process.cwd(), 'src', 'app', 'page.tsx');
const summaryPath = path.join(process.cwd(), 'src', 'app', 'resumen', 'page.tsx');
const aiPath = path.join(process.cwd(), 'src', 'lib', 'ai', 'gemini.ts');
const inferencePath = path.join(process.cwd(), 'src', 'lib', 'glucoseInference.ts');
const foodHistoryPath = path.join(process.cwd(), 'src', 'components', 'resumen', 'HistorialComidas.tsx');
const mealHistoryPath = path.join(process.cwd(), 'src', 'lib', 'mealHistory.ts');
const mealHistoryDataPath = path.join(process.cwd(), 'src', 'lib', 'mealHistoryData.ts');
const i18nPath = path.join(process.cwd(), 'src', 'lib', 'i18n.ts');
const readmePath = path.join(process.cwd(), 'README.md');
const productCatalogPath = path.join(process.cwd(), 'src', 'lib', 'productCatalog.ts');
const medicationActionPath = path.join(process.cwd(), 'src', 'actions', 'medicacion.ts');
const medicationPagePath = path.join(process.cwd(), 'src', 'app', 'medicacion', 'nuevo', 'page.tsx');
const chatWidgetPath = path.join(process.cwd(), 'src', 'components', 'ChatWidget.tsx');
const medicationCatalogPath = path.join(process.cwd(), 'src', 'lib', 'medicationCatalog.ts');
const mealPagePath = path.join(process.cwd(), 'src', 'app', 'comidas', 'nuevo', 'page.tsx');
const mealActionPath = path.join(process.cwd(), 'src', 'actions', 'comida.ts');
const chatActionPath = path.join(process.cwd(), 'src', 'actions', 'chat.ts');
const appNavigationPath = path.join(process.cwd(), 'src', 'lib', 'appNavigation.ts');

const home = fs.readFileSync(homePath, 'utf8');
const summary = fs.readFileSync(summaryPath, 'utf8');
const ai = fs.readFileSync(aiPath, 'utf8');
const inference = fs.readFileSync(inferencePath, 'utf8');
const foodHistory = fs.readFileSync(foodHistoryPath, 'utf8');
const mealHistory = fs.readFileSync(mealHistoryPath, 'utf8');
const mealHistoryData = fs.readFileSync(mealHistoryDataPath, 'utf8');
const i18n = fs.readFileSync(i18nPath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');
const productCatalog = fs.readFileSync(productCatalogPath, 'utf8');
const medicationAction = fs.readFileSync(medicationActionPath, 'utf8');
const medicationPage = fs.readFileSync(medicationPagePath, 'utf8');
const chatWidget = fs.readFileSync(chatWidgetPath, 'utf8');
const medicationCatalog = fs.readFileSync(medicationCatalogPath, 'utf8');
const mealPage = fs.readFileSync(mealPagePath, 'utf8');
const mealAction = fs.readFileSync(mealActionPath, 'utf8');
const chatAction = fs.readFileSync(chatActionPath, 'utf8');
const appNavigation = fs.readFileSync(appNavigationPath, 'utf8');

test('home quick actions include laboratories shortcut', () => {
  assert.match(home, /href="\/laboratorios\/nuevo"/);
  assert.match(home, /messages\.home\.labsTitle/);
  assert.doesNotMatch(home, /paciente\.nombre\.charAt\(0\)/);
});

test('summary payload includes inferred glucose fallback when user has no logs', () => {
  assert.match(summary, /estimateGlucoseFromMeals/);
  assert.match(summary, /glucosa_estimada_por_comidas/);
  assert.match(summary, /promedioGlucosaConFallback/);
});

test('lab upload and summary preserve dynamic AI-detected lab fields', () => {
  assert.match(ai, /resultados_detectados/);
  assert.match(summary, /buildDetectedResultsFromStoredLab/);
  assert.match(summary, /messages\.summary\.scannedResults/);
  assert.match(readme, /campos detectados por IA/i);
  assert.match(ai, /use those extra analytes too|usa también esos analitos extra/);
});

test('lab autofill reconstructs fixed form fields from detected AI results when needed', () => {
  assert.match(summary, /buildDetectedResultsFromStoredLab/);
  assert.match(fs.readFileSync(path.join(process.cwd(), 'src', 'actions', 'laboratorio.ts'), 'utf8'), /inferStandardLabValuesFromDetectedResults/);
  assert.match(fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'labResults.ts'), 'utf8'), /standardLabFieldAliases/);
});

test('summary scanned results combine standard lab values with extra detected analytes', () => {
  const labResults = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'labResults.ts'), 'utf8');
  assert.match(labResults, /const standardDetected = buildStandardDetectedResults/);
  assert.match(labResults, /const combinedByKey = new Map<string, DetectedLabResult>\(\)/);
  assert.match(labResults, /for \(const item of detected\) \{\s*combinedByKey\.set\(item\.key, item\);/s);
});

test('lab autofill keeps valid AI values ahead of noisy PDF fallbacks', () => {
  assert.match(ai, /function mergeStandardLabValues/);
  assert.match(ai, /aiValues\[key\] \?\? extractedPdfValues\[key\]/);
  assert.match(ai, /sanitizeStandardLabValues/);
  assert.match(fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'labResults.ts'), 'utf8'), /"mul\/l"/);
});

test('lab autofill returns partial success when only some fields are available', () => {
  assert.match(ai, /if \(!hasAnyStandardLabValue\(mergedStandardValues\) && detectedResults\.length === 0\)/);
  assert.doesNotMatch(ai, /if \(!hasAnyStandardLabValue\(mergedStandardValues\)\) {\s*return null;\s*}/);
});

test('lab save tolerates empty optional numeric fields', () => {
  const labPage = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'laboratorios', 'nuevo', 'page.tsx'), 'utf8');
  const labAction = fs.readFileSync(path.join(process.cwd(), 'src', 'actions', 'laboratorio.ts'), 'utf8');
  const labSchema = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'laboratorioSchema.ts'), 'utf8');

  assert.match(labPage, /optionalLabMeasurementShape/);
  assert.match(labAction, /optionalLabMeasurementShape/);
  assert.match(labSchema, /Number\.isNaN\(value\)/);
  assert.match(labSchema, /z\.preprocess\(emptyToUndefined, z\.number\(\)\.min\(min\)\.max\(max\)\.optional\(\)\)/);
});

test('AI suggestion prompt explicitly handles inferred glucose context', () => {
  assert.match(ai, /glucosa_real_registrada/);
  assert.match(ai, /glucosa_estimada_por_comidas/);
});

test('glucose inference helper keeps estimation bounded and deterministic', () => {
  assert.match(inference, /GLUCOSE_BASELINE/);
  assert.match(inference, /clamp\(Math\.round\(estimated\),\s*70,\s*240\)/);
});

test('readme documents inferred glucose fallback and laboratories quick action', () => {
  assert.match(readme, /acceso rápido a Laboratorios/i);
  assert.match(readme, /glucosa estimada basada en comidas/i);
});


test('summary AI response supports clinical sections for alert/plan/labs/products', () => {
  assert.match(ai, /importantAlert/);
  assert.match(ai, /centralProblems/);
  assert.match(ai, /priorityPlan/);
  assert.match(ai, /recommendedLabs/);
  assert.match(ai, /productsGuidance/);
});

test('food history includes informative icon and meal insight content', () => {
  assert.match(foodHistory, /mealInsightLabel/);
  assert.match(foodHistory, /material-symbols-outlined text-\[15px\]">info/);
  assert.match(foodHistory, /getMealInsight\(comida\)/);
});

test('food history defaults to the latest meal date and live-syncs only that section', () => {
  assert.match(summary, /getSummaryMealHistory/);
  assert.match(mealAction, /export async function getResumenMealHistory/);
  assert.match(foodHistory, /const MEAL_HISTORY_REFRESH_MS = 15_000/);
  assert.match(foodHistory, /useEffectEvent\(async \(\) =>/);
  assert.match(foodHistory, /const \[filterDate, setFilterDate\] = useState<string \| null>\(initialLatestDate\)/);
  assert.match(foodHistory, /const nextFilterDate = resolveMealHistoryFilterDate/);
  assert.match(foodHistory, /setComidas\(nextComidas\)/);
  assert.match(foodHistory, /{comida\.hora}/);
  assert.doesNotMatch(foodHistory, /toLocaleTimeString\(/);
  assert.match(mealHistory, /getUTCFullYear/);
  assert.match(mealHistory, /resolveMealHistoryFilterDate/);
  assert.match(mealHistoryData, /serializeMealHistoryEntries/);
  assert.match(readme, /Historial de comidas.*resincroniza solo ese bloque/i);
});

test('i18n includes new labels for summary sections and meal insight', () => {
  assert.match(i18n, /importantAlert/);
  assert.match(i18n, /priorityPlan/);
  assert.match(i18n, /mealInsightTitle/);
});


test('AI prompt includes ThermoRush product framework and safety framing', () => {
  assert.match(ai, /THERMORUSH_CONTEXT/);
  assert.match(ai, /ThermoRush/);
  assert.match(ai, /antes de desayuno y almuerzo/);
  assert.match(ai, /no reemplaza/);
});


test('product catalog defines allowed and restricted product groups', () => {
  assert.match(productCatalog, /BANNED_PROMO_PRODUCTS/);
  assert.match(productCatalog, /PROMO_FOCUS_PRODUCTS/);
  assert.match(productCatalog, /Sugar Beat/);
  assert.match(productCatalog, /Thermorush/);
});

test('AI prompts and chat include restricted-product safety rule', () => {
  assert.match(ai, /Never mention restricted products/);
  assert.match(productCatalog, /Productos restringidos/);
});

test('medication save flow blocks restricted products without AI photo autofill', () => {
  assert.match(medicationAction, /restricted_product/);
  assert.match(medicationAction, /foto_url:\s*z\.string\(\)\.url\(\)\.optional\(\)/);
  assert.doesNotMatch(medicationAction, /photo_validation_required/);
  assert.doesNotMatch(medicationAction, /product_name_photo_mismatch/);
  assert.doesNotMatch(medicationAction, /inferMedicationFromPhoto/);
  assert.doesNotMatch(medicationPage, /ai_detected_medicamento/);
  assert.doesNotMatch(medicationPage, /inferMedicationFromPhoto/);
  assert.match(medicationPage, /guardFileUploadWithVirusTotal/);
  assert.match(medicationPage, /supabase\.storage\.from\("medicina"\)/);
  assert.match(medicationPage, /register\("foto_url"\)/);
});

test('medication form supports optional dose with automatic fallback and catalog guidance', () => {
  assert.match(medicationAction, /dosis:\s*z\.string\(\)\.optional\(\)/);
  assert.match(medicationAction, /No especificada/);
  assert.match(medicationPage, /getMedicationCatalogDescription/);
  assert.match(medicationPage, /detectedMedicationDescription/);
  assert.match(medicationCatalog, /metformina/);
});

test('chat widget exposes history and clear-conversation controls', () => {
  assert.match(chatWidget, /history/);
  assert.match(chatWidget, /delete_sweep/);
  assert.match(chatWidget, /lifemetric_chat_conversations_v1/);
});

test('chat guidance uses current route and shared app navigation map', () => {
  assert.match(chatWidget, /usePathname/);
  assert.match(chatWidget, /chatWithAIAction\(\s*userMessage,\s*historyForAction,\s*newUserMsg\.imageUrl,\s*pathname,\s*locale/s);
  assert.match(chatAction, /buildAppNavigationContext/);
  assert.match(chatAction, /Debes responder SIEMPRE en espanol/);
  assert.match(chatAction, /You must ALWAYS reply in English/);
  assert.match(appNavigation, /"\/laboratorios\/nuevo"/);
  assert.match(appNavigation, /"\/ajustes"/);
});

test('chat navigation help stays on-demand instead of always pushing routes', () => {
  assert.match(appNavigation, /hasNavigationIntent/);
  assert.match(appNavigation, /if \(!hasNavigationIntent\(normalizedMessage\)\) \{\s*return \[\];\s*\}/s);
  assert.match(chatAction, /Solo si el usuario pide ayuda para usar la app, un tutorial o pregunta donde hacer algo/);
  assert.match(chatAction, /No menciones el widget del chat, tutoriales, rutas ni botones de forma proactiva/);
  assert.match(readme, /guia de navegacion del chat es bajo demanda/i);
});

test('chat locale strings and live locale sync are wired to the configured app language', () => {
  assert.match(i18n, /statusOnline/);
  assert.match(i18n, /historyAssistantLabel/);
  assert.match(chatAction, /normalizeLocale\(localeInput\)/);
  assert.match(chatAction, /getPromoProductGuidance\(locale\)/);
  assert.match(chatWidget, /const \{ locale, messages \} = useLocale\(\)/);
  assert.match(chatWidget, /toLocaleString\(locale\)/);
});

test('meal form auto-fills main food with AI and removes manual notes field', () => {
  assert.match(mealPage, /inferMealFromPhoto/);
  assert.match(mealPage, /const \[aiMealSnapshot, setAiMealSnapshot\]/);
  assert.match(mealPage, /const submissionData = \{ \.\.\.data, foto_url, \.\.\.aiMealSnapshot \}/);
  assert.doesNotMatch(mealPage, /readOnly/);
  assert.doesNotMatch(mealPage, /register\("nota"\)/);
  assert.match(mealAction, /export async function inferMealFromPhoto/);
});

test('food history avoids hardcoded zero calories when AI data is missing', () => {
  assert.match(foodHistory, /comida\.kcal_estimadas \?\? '--'/);
  assert.doesNotMatch(foodHistory, /comida\.kcal_estimadas \|\| 0/);
  assert.match(readme, /persiste las kcal\/macros inferidas/i);
});

test('inadequate meals use a normalized badge label and count in summary cards', () => {
  assert.match(i18n, /export function isFoodClassificationInadequate/);
  assert.match(i18n, /normalized\.startsWith\('inadecuada'\)/);
  assert.match(foodHistory, /isFoodClassificationInadequate\(comida\.clasificacion_final\)/);
  assert.match(summary, /isFoodClassificationInadequate\(c\.clasificacion_final\)/);
  assert.match(readme, /badge del historial se normaliza a `Inadecuada`/i);
});


test('summary main alert waits for data before showing alert message', () => {
  assert.match(summary, /hasAlertData/);
  assert.match(summary, /waitingForAlertData/);
  assert.match(i18n, /waitingForAlertData/);
});
