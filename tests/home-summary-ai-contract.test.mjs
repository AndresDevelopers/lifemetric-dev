import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const homePath = path.join(process.cwd(), 'src', 'app', 'page.tsx');
const summaryPath = path.join(process.cwd(), 'src', 'app', 'resumen', 'page.tsx');
const aiPath = path.join(process.cwd(), 'src', 'lib', 'ai', 'gemini.ts');
const inferencePath = path.join(process.cwd(), 'src', 'lib', 'glucoseInference.ts');
const foodHistoryPath = path.join(process.cwd(), 'src', 'components', 'resumen', 'HistorialComidas.tsx');
const i18nPath = path.join(process.cwd(), 'src', 'lib', 'i18n.ts');
const readmePath = path.join(process.cwd(), 'README.md');
const productCatalogPath = path.join(process.cwd(), 'src', 'lib', 'productCatalog.ts');
const medicationActionPath = path.join(process.cwd(), 'src', 'actions', 'medicacion.ts');
const medicationPagePath = path.join(process.cwd(), 'src', 'app', 'medicacion', 'nuevo', 'page.tsx');
const chatWidgetPath = path.join(process.cwd(), 'src', 'components', 'ChatWidget.tsx');
const medicationCatalogPath = path.join(process.cwd(), 'src', 'lib', 'medicationCatalog.ts');
const mealPagePath = path.join(process.cwd(), 'src', 'app', 'comidas', 'nuevo', 'page.tsx');
const mealActionPath = path.join(process.cwd(), 'src', 'actions', 'comida.ts');

const home = fs.readFileSync(homePath, 'utf8');
const summary = fs.readFileSync(summaryPath, 'utf8');
const ai = fs.readFileSync(aiPath, 'utf8');
const inference = fs.readFileSync(inferencePath, 'utf8');
const foodHistory = fs.readFileSync(foodHistoryPath, 'utf8');
const i18n = fs.readFileSync(i18nPath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');
const productCatalog = fs.readFileSync(productCatalogPath, 'utf8');
const medicationAction = fs.readFileSync(medicationActionPath, 'utf8');
const medicationPage = fs.readFileSync(medicationPagePath, 'utf8');
const chatWidget = fs.readFileSync(chatWidgetPath, 'utf8');
const medicationCatalog = fs.readFileSync(medicationCatalogPath, 'utf8');
const mealPage = fs.readFileSync(mealPagePath, 'utf8');
const mealAction = fs.readFileSync(mealActionPath, 'utf8');

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

test('medication save flow blocks restricted products and enforces photo-name match', () => {
  assert.match(medicationAction, /restricted_product/);
  assert.match(medicationAction, /photo_validation_required/);
  assert.match(medicationAction, /product_name_photo_mismatch/);
  assert.match(medicationPage, /ai_detected_medicamento/);
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

test('meal form auto-fills main food with AI and removes manual notes field', () => {
  assert.match(mealPage, /inferMealFromPhoto/);
  assert.doesNotMatch(mealPage, /readOnly/);
  assert.doesNotMatch(mealPage, /register\("nota"\)/);
  assert.match(mealAction, /export async function inferMealFromPhoto/);
});


test('summary main alert waits for data before showing alert message', () => {
  assert.match(summary, /hasAlertData/);
  assert.match(summary, /waitingForAlertData/);
  assert.match(i18n, /waitingForAlertData/);
});
