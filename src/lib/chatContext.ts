type ChatGlucoseRecord = {
  fecha: Date | null;
  hora: Date | null;
  tipo_glucosa: string | null;
  valor_glucosa: number | null;
  delta_glucosa: number | null;
  clasificacion_glucosa: string | null;
  comida_relacionada_id?: string | null;
};

type ChatHabitRecord = {
  fecha: Date | null;
  agua_vasos: number | null;
  sueno_horas: unknown;
  ejercicio_min: number | null;
  pa_sistolica: number | null;
  pa_diastolica: number | null;
  pulso: number | null;
  peso_kg: unknown;
};

type ChatMedicationRecord = {
  fecha: Date | null;
  hora: Date | null;
  medicamento: string | null;
  dosis: string | null;
  estado_toma: string | null;
  comentarios: string | null;
};

type ChatMealRecord = {
  fecha: Date | null;
  hora: Date | null;
  tipo_comida: string | null;
  alimento_principal: string | null;
  nota: string | null;
  kcal_estimadas: number | null;
  proteina_g: unknown;
  carbohidratos_g: unknown;
  grasa_g: unknown;
  fibra_g: unknown;
  clasificacion_proteina: string | null;
  clasificacion_carbohidrato: string | null;
  clasificacion_fibra: string | null;
  clasificacion_final: string | null;
  razon_inadecuada: string | null;
  alternativa_saludable: string | null;
};

type ChatLabRecord = {
  fecha_estudio: Date | null;
  hba1c: unknown;
  glucosa_ayuno: number | null;
  insulina: unknown;
  trigliceridos: number | null;
  hdl: number | null;
  ldl: number | null;
  alt: number | null;
  ast: number | null;
  tsh: unknown;
  pcr_us: unknown;
  creatinina: unknown;
  acido_urico: unknown;
  archivo_url: string | null;
};

type ChatPatientSnapshot = {
  nombre: string;
  apellido: string;
  email: string | null;
  sexo: string | null;
  edad: number | null;
  diagnostico_principal: string | null;
  objetivo_clinico: string | null;
  medicacion_base: string | null;
  peso_inicial_kg: unknown;
  cintura_inicial_cm: unknown;
  usa_glucometro: boolean;
  activo: boolean;
  idioma: string | null;
  newsletter_suscrito: boolean;
  fecha_alta: Date | null;
  created_at: Date | null;
  glucosa: ChatGlucoseRecord[];
  habitos: ChatHabitRecord[];
  medicacion: ChatMedicationRecord[];
  comidas: ChatMealRecord[];
  laboratorios: ChatLabRecord[];
};

type ChatProfileExtras = {
  fecha_nacimiento: Date | null;
  avatar_url: string | null;
  altura_cm: number | null;
  motivo_registro: string | null;
  producto_permitido_registro: string | null;
  doctor_asignado: string | null;
};

export type BuildPatientChatContextInput = {
  patientSnapshot: ChatPatientSnapshot;
  profileExtras: ChatProfileExtras;
  latestLabDate: Date | null;
  labDataIsOutdated: boolean;
};

function formatDate(value?: Date | null): string {
  return value ? value.toISOString().split("T")[0] : "N/D";
}

function formatTime(value?: Date | null): string {
  if (!value) return "N/D";
  return new Date(value).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMaybe(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === "") return "N/D";
  const normalized = typeof value === "object" ? String(value) : value;
  return unit ? `${normalized} ${unit}` : String(normalized);
}

function buildSection(title: string, items: string[], emptyMessage: string): string {
  if (items.length === 0) {
    return `${title}:\n- ${emptyMessage}`;
  }

  return `${title} (${items.length}):\n${items.join("\n")}`;
}

export function buildPatientChatContext({
  patientSnapshot,
  profileExtras,
  latestLabDate,
  labDataIsOutdated,
}: BuildPatientChatContextInput): string {
  const latestGlucose = patientSnapshot.glucosa[0] ?? null;
  const latestHabits = patientSnapshot.habitos[0] ?? null;

  const glucoseHistory = patientSnapshot.glucosa.map((item) =>
    `- ${formatDate(item.fecha)} ${formatTime(item.hora)} | tipo: ${formatMaybe(item.tipo_glucosa)} | valor: ${formatMaybe(item.valor_glucosa, "mg/dL")} | delta: ${formatMaybe(item.delta_glucosa, "mg/dL")} | clasificacion: ${formatMaybe(item.clasificacion_glucosa)} | comida relacionada: ${formatMaybe(item.comida_relacionada_id)}`
  );

  const habitsHistory = patientSnapshot.habitos.map((item) =>
    `- ${formatDate(item.fecha)} | agua: ${formatMaybe(item.agua_vasos, "vasos")} | sueno: ${formatMaybe(item.sueno_horas, "h")} | ejercicio: ${formatMaybe(item.ejercicio_min, "min")} | PA: ${formatMaybe(item.pa_sistolica)}/${formatMaybe(item.pa_diastolica)} | pulso: ${formatMaybe(item.pulso, "lpm")} | peso: ${formatMaybe(item.peso_kg, "kg")}`
  );

  const medicationHistory = patientSnapshot.medicacion.map((item) =>
    `- ${formatDate(item.fecha)} ${formatTime(item.hora)} | medicamento: ${formatMaybe(item.medicamento)} | dosis: ${formatMaybe(item.dosis)} | estado: ${formatMaybe(item.estado_toma)} | comentarios: ${formatMaybe(item.comentarios)}`
  );

  const mealsHistory = patientSnapshot.comidas.map((item) =>
    `- ${formatDate(item.fecha)} ${formatTime(item.hora)} | tipo: ${formatMaybe(item.tipo_comida)} | alimento principal: ${formatMaybe(item.alimento_principal)} | nota: ${formatMaybe(item.nota)} | kcal: ${formatMaybe(item.kcal_estimadas)} | P: ${formatMaybe(item.proteina_g, "g")} | C: ${formatMaybe(item.carbohidratos_g, "g")} | G: ${formatMaybe(item.grasa_g, "g")} | fibra: ${formatMaybe(item.fibra_g, "g")} | clasificacion final: ${formatMaybe(item.clasificacion_final)} | prot: ${formatMaybe(item.clasificacion_proteina)} | carb: ${formatMaybe(item.clasificacion_carbohidrato)} | fibra calidad: ${formatMaybe(item.clasificacion_fibra)} | razon inadecuada: ${formatMaybe(item.razon_inadecuada)} | alternativa saludable: ${formatMaybe(item.alternativa_saludable)}`
  );

  const labsHistory = patientSnapshot.laboratorios.map((item) =>
    `- ${formatDate(item.fecha_estudio)} | HbA1c: ${formatMaybe(item.hba1c, "%")} | glucosa ayuno: ${formatMaybe(item.glucosa_ayuno, "mg/dL")} | insulina: ${formatMaybe(item.insulina)} | TG: ${formatMaybe(item.trigliceridos, "mg/dL")} | HDL: ${formatMaybe(item.hdl, "mg/dL")} | LDL: ${formatMaybe(item.ldl, "mg/dL")} | ALT: ${formatMaybe(item.alt, "U/L")} | AST: ${formatMaybe(item.ast, "U/L")} | TSH: ${formatMaybe(item.tsh)} | PCR-us: ${formatMaybe(item.pcr_us)} | creatinina: ${formatMaybe(item.creatinina, "mg/dL")} | acido urico: ${formatMaybe(item.acido_urico, "mg/dL")} | archivo: ${formatMaybe(item.archivo_url)}`
  );

  return `CONTEXTO DE LABORATORIOS DEL PACIENTE:
- Ultimo laboratorio registrado: ${latestLabDate ? formatDate(latestLabDate) : "Sin registros"}.
- Esta desactualizado (>3 meses): ${labDataIsOutdated ? "Si" : "No"}.

RESUMEN RAPIDO DEL PACIENTE:
- Nombre: ${patientSnapshot.nombre}
- Apellido: ${patientSnapshot.apellido}
- Correo electronico: ${formatMaybe(patientSnapshot.email)}
- Fecha de nacimiento: ${formatDate(profileExtras.fecha_nacimiento)}
- Sexo: ${formatMaybe(patientSnapshot.sexo)}
- Edad: ${formatMaybe(patientSnapshot.edad, "anos")}
- Diagnostico principal: ${formatMaybe(patientSnapshot.diagnostico_principal)}
- Objetivo clinico: ${formatMaybe(patientSnapshot.objetivo_clinico)}
- Medicacion base: ${formatMaybe(patientSnapshot.medicacion_base)}
- Usa glucometro: ${patientSnapshot.usa_glucometro ? "Si" : "No"}
- Producto permitido seleccionado: ${formatMaybe(profileExtras.producto_permitido_registro)}
- Doctor asignado: ${formatMaybe(profileExtras.doctor_asignado)}
- Motivo de registro: ${formatMaybe(profileExtras.motivo_registro)}
- Altura: ${formatMaybe(profileExtras.altura_cm, "cm")}
- Peso inicial: ${formatMaybe(patientSnapshot.peso_inicial_kg, "kg")}
- Cintura inicial: ${formatMaybe(patientSnapshot.cintura_inicial_cm, "cm")}
- Idioma: ${formatMaybe(patientSnapshot.idioma)}
- Newsletter: ${patientSnapshot.newsletter_suscrito ? "Si" : "No"}
- Perfil activo: ${patientSnapshot.activo ? "Si" : "No"}
- Fecha de alta: ${formatDate(patientSnapshot.fecha_alta)}
- Perfil creado: ${formatDate(patientSnapshot.created_at)}
- Avatar URL: ${formatMaybe(profileExtras.avatar_url)}

ULTIMOS SIGNOS Y REGISTROS CLAVE:
- Ultima glucosa: ${latestGlucose ? `${formatDate(latestGlucose.fecha)} ${formatTime(latestGlucose.hora)} | ${formatMaybe(latestGlucose.valor_glucosa, "mg/dL")} | ${formatMaybe(latestGlucose.tipo_glucosa)}` : "N/D"}
- Ultimos habitos: ${latestHabits ? `${formatDate(latestHabits.fecha)} | agua ${formatMaybe(latestHabits.agua_vasos, "vasos")} | sueno ${formatMaybe(latestHabits.sueno_horas, "h")} | ejercicio ${formatMaybe(latestHabits.ejercicio_min, "min")}` : "N/D"}

${buildSection("HISTORIAL COMPLETO DE GLUCOSA", glucoseHistory, "Sin registros de glucosa.")}

${buildSection("HISTORIAL COMPLETO DE HABITOS", habitsHistory, "Sin registros de habitos.")}

${buildSection("HISTORIAL COMPLETO DE MEDICACION", medicationHistory, "Sin registros de medicacion.")}

${buildSection("HISTORIAL COMPLETO DE COMIDAS", mealsHistory, "Sin registros de comidas.")}

${buildSection("HISTORIAL COMPLETO DE LABORATORIOS", labsHistory, "Sin laboratorios cargados.")}`;
}
