
import fs from 'fs';

const filePath = 'c:\\Trabajo\\Construyendo\\lifemetric\\src\\lib\\ai\\gemini.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Add field to PacienteContexto
content = content.replace(
  '  motivo_registro?: string | null;\n};',
  '  motivo_registro?: string | null;\n  ultima_glucosa?: {\n    valor: number;\n    tipo: string;\n    fecha: string;\n  } | null;\n};'
); || content.replace(
  '  motivo_registro?: string | null;\r\n};',
  '  motivo_registro?: string | null;\r\n  ultima_glucosa?: {\r\n    valor: number;\r\n    tipo: string;\r\n    fecha: string;\r\n  } | null;\r\n};'
);

// Update buildContextBlock
content = content.replace(
  "if (ctx.ldl != null) labs.push(`LDL ${ctx.ldl} mg/dL`);\n  if (labs.length > 0) parts.push(t(`Últimos laboratorios: ${labs.join(', ')}`, `Recent labs: ${labs.join(', ')}`));",
  "if (ctx.ldl != null) labs.push(`LDL ${ctx.ldl} mg/dL`);\n  if (ctx.ultima_glucosa) {\n    labs.push(t(\n      `Última glucosa registrada: ${ctx.ultima_glucosa.valor} mg/dL (${ctx.ultima_glucosa.tipo}) el ${ctx.ultima_glucosa.fecha}`,\n      `Last recorded glucose: ${ctx.ultima_glucosa.valor} mg/dL (${ctx.ultima_glucosa.tipo}) on ${ctx.ultima_glucosa.fecha}`\n    ));\n  }\n  if (labs.length > 0) parts.push(t(`Últimos laboratorios: ${labs.join(', ')}`, `Recent labs: ${labs.join(', ')}`));"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated gemini.ts');
