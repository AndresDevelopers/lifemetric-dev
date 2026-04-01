
$gemini = 'c:\Trabajo\Construyendo\lifemetric\src\lib\ai\gemini.ts'
$comida = 'c:\Trabajo\Construyendo\lifemetric\src\actions\comida.ts'

# gemini.ts buildContextBlock
$gContent = Get-Content -Raw $gemini
$target1 = '  if (ctx.ldl != null) labs.push(`LDL ${ctx.ldl} mg/dL`);'
$replacement1 = '  if (ctx.ldl != null) labs.push(`LDL ${ctx.ldl} mg/dL`);
  if (ctx.ultima_glucosa) {
    labs.push(t(
      `Última glucosa registrada: ${ctx.ultima_glucosa.valor} mg/dL (${ctx.ultima_glucosa.tipo}) el ${ctx.ultima_glucosa.fecha}`,
      `Last recorded glucose: ${ctx.ultima_glucosa.valor} mg/dL (${ctx.ultima_glucosa.tipo}) on ${ctx.ultima_glucosa.fecha}`
    ));
  }'
$gContent = $gContent.Replace($target1, $replacement1)
$gContent | Set-Content -Path $gemini -Encoding UTF8

# comida.ts query
$cContent = Get-Content -Raw $comida
$target2 = '        select: { alimento_principal: true },
      }).catch(() => []),
    ]);'
$replacement2 = '        select: { alimento_principal: true },
      }).catch(() => []),
      prisma.glucosa.findFirst({
        where: { paciente_id: pacienteId },
        orderBy: [{ fecha: "desc" }, { hora: "desc" }],
      }).catch(() => null),
    ]);'
$cContent = $cContent.Replace($target2, $replacement2)

# comida.ts return object
$target3 = '      ldl: labRows?.ldl ?? null,
      alimentos_frecuentes: frecuentes,
    };'
$replacement3 = '      ldl: labRows?.ldl ?? null,
      alimentos_frecuentes: frecuentes,
      ultima_glucosa: ultimaGlucosa ? {
        valor: Number(ultimaGlucosa.valor_glucosa),
        tipo: ultimaGlucosa.tipo_medicion || "general",
        fecha: ultimaGlucosa.fecha.toLocaleDateString(),
      } : null,
    };'
$cContent = $cContent.Replace($target3, $replacement3)
$cContent | Set-Content -Path $comida -Encoding UTF8

Write-Host "Success updating files"
