
const fs = require('fs');
const path = require('path');

function updateFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const { target, replacement } of replacements) {
        if (!content.includes(target)) {
            console.error(`Target not found in ${filePath}:`, JSON.stringify(target));
            // Try removing trailing whitespaces just in case
            const normalizedTarget = target.trimEnd();
            if (content.includes(normalizedTarget)) {
              console.log(`Found normalized target in ${filePath}`);
              content = content.replace(normalizedTarget, replacement);
            } else {
              console.error(`Normalized target not found either in ${filePath}`);
              process.exit(1);
            }
        } else {
          content = content.replace(target, replacement);
        }
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Successfully updated ${filePath}`);
}

const geminiPath = 'c:\\Trabajo\\Construyendo\\lifemetric\\src\\lib\\ai\\gemini.ts';
const comidaPath = 'c:\\Trabajo\\Construyendo\\lifemetric\\src\\actions\\comida.ts';

// Replacements for gemini.ts
const geminiReplacements = [
    {
        target: '  motivo_registro?: string | null;\n};',
        replacement: '  motivo_registro?: string | null;\n  ultima_glucosa?: {\n    valor: number;\n    tipo: string;\n    fecha: string;\n  } | null;\n};'
    },
    {
        target: "  if (ctx.ldl != null) labs.push(`LDL ${ctx.ldl} mg/dL`);\n  if (labs.length > 0) parts.push(t(`Últimos laboratorios: ${labs.join(', ')}`, `Recent labs: ${labs.join(', ')}`));",
        replacement: "  if (ctx.ldl != null) labs.push(`LDL ${ctx.ldl} mg/dL`);\n  if (ctx.ultima_glucosa) {\n    labs.push(t(\n      `Última glucosa registrada: ${ctx.ultima_glucosa.valor} mg/dL (${ctx.ultima_glucosa.tipo}) el ${ctx.ultima_glucosa.fecha}`,\n      `Last recorded glucose: ${ctx.ultima_glucosa.valor} mg/dL (${ctx.ultima_glucosa.tipo}) on ${ctx.ultima_glucosa.fecha}`\n    ));\n  }\n  if (labs.length > 0) parts.push(t(`Últimos laboratorios: ${labs.join(', ')}`, `Recent labs: ${labs.join(', ')}`));"
    }
];

// Replacements for comida.ts
const comidaReplacements = [
    {
        target: "        select: { alimento_principal: true },\n      }).catch(() => []),\n    ]);",
        replacement: "        select: { alimento_principal: true },\n      }).catch(() => []),\n      prisma.glucosa.findFirst({\n        where: { paciente_id: pacienteId },\n        orderBy: [{ fecha: 'desc' }, { hora: 'desc' }],\n      }).catch(() => null),\n    ]);"
    },
    {
        target: "      ldl: labRows?.ldl ?? null,\n      alimentos_frecuentes: frecuentes,\n    };",
        replacement: "      ldl: labRows?.ldl ?? null,\n      alimentos_frecuentes: frecuentes,\n      ultima_glucosa: ultimaGlucosa ? {\n        valor: Number(ultimaGlucosa.valor_glucosa),\n        tipo: ultimaGlucosa.tipo_medicion || 'general',\n        fecha: ultimaGlucosa.fecha.toLocaleDateString(),\n      } : null,\n    };"
    }
];

// Try both \n and \r\n
function applyUpdate(path, replacements) {
  try {
     updateFile(path, replacements);
  } catch (e) {
     console.log(`Failed with \n, trying \r\n for ${path}`);
     const rcReplacements = replacements.map(r => ({
       target: r.target.replace(/\n/g, '\r\n'),
       replacement: r.replacement.replace(/\n/g, '\r\n')
     }));
     updateFile(path, rcReplacements);
  }
}

applyUpdate(geminiPath, geminiReplacements);
applyUpdate(comidaPath, comidaReplacements);
