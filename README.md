# Lifemetric

Aplicacion Next.js 16 para seguimiento metabolico con Prisma y PostgreSQL.

## Desarrollo

```bash
pnpm install --frozen-lockfile
pnpm dev
```

La app de desarrollo corre en [http://localhost:3003](http://localhost:3003).

## PWA

La app ya expone capacidades de Progressive Web App (PWA):

- Manifest web en `src/app/manifest.ts` con modo `standalone`, `start_url` raíz e iconos.
- Registro de Service Worker cliente en `src/components/PwaRegistrar.tsx`.
- Service Worker en `public/sw.js` con cache de app-shell y estrategia cache-first para recursos GET.

Esto habilita instalación en dispositivos compatibles y mejora resiliencia offline básica de rutas críticas.

## Prisma

Este proyecto usa `prisma.config.ts` como fuente de configuracion. `DATABASE_URL` y `DIRECT_URL` deben vivir en archivos `.env`; no se definen dentro de `prisma/schema.prisma`.

El esquema de Prisma debe mantenerse alineado con las tablas reales existentes en PostgreSQL:

- `Paciente` -> `pacientes`
- `Comida` -> `comidas`
- `Glucosa` -> `glucosa`
- `Habito` -> `habitos`
- `Laboratorio` -> `laboratorios`
- `RegistroMedicacion` -> `medicacion`

Despues de cualquier cambio en `prisma/schema.prisma`, regenera el cliente:

```bash
pnpm prisma generate
```

Si necesitas introspectar el esquema desde la base, usa una conexion directa compatible con migraciones/introspection en `DIRECT_URL`.

## Validacion

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

## Resiliencia de autenticación y runtime

- Si **Turnstile no está disponible** (bloqueo de script, timeout o falta de `NEXT_PUBLIC_TURNSTILE_SITE_KEY`), los formularios de autenticación no deben quedar bloqueados indefinidamente en cliente y cambian al proveedor de fallback `botid` (si la señal de BotID no llega por navegador/ad-blocker, el flujo sigue en modo resiliente).
- Login/registro/recuperación usan **Supabase Auth** como fuente de verdad de credenciales; la tabla `pacientes` se mantiene para perfil clínico y sesión interna.
- Si la lectura de perfil en PostgreSQL falla temporalmente, la sesión no se suplanta con datos ficticios: el runtime trata al usuario como no autenticado para evitar bucles `/login` ↔ `/` y estados inconsistentes.
- El **rate limiting** se aplica con Upstash Redis usando comandos nativos (`INCR` + `EXPIRE`) para reducir dependencias críticas en runtime.
- La firma de sesión busca secreto en `AUTH_SECRET`, `SESSION_SECRET` o `NEXTAUTH_SECRET` para evitar errores de login por configuración parcial.
- Prisma intenta resolver conexión desde `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_DB_URL`, `SUPABASE_DATABASE_URL`, `SUPABASE_POOLER_URL` o variables `POSTGRES_*` para compatibilidad con despliegues Supabase/Vercel. Si ninguna variable está presente, el runtime falla rápido con error explícito (no hace fallback silencioso a `127.0.0.1`).
- Evita introducir imports de paquetes opcionales en rutas críticas (`layout`, auth) sin fallback explícito, para prevenir errores 500 por resolución de módulos.
- El parser de PDF para laboratorios (`pdf-parse`) se carga de forma diferida (lazy import) para evitar fallos SSR por dependencias que requieren APIs del DOM en rutas de autenticación.
- En login/registro se persiste geocontexto de ejecución (ciudad, país y zona horaria detectada) para que cálculos diarios y etiquetas de fecha/hora se alineen automáticamente con la ubicación del paciente.


## Email y AI

La app ahora incluye integración server-side con:

- **Resend** para correos transaccionales (recuperación de contraseña y suscripción/desuscripción por correo, incluyendo check por defecto en registro).
- **Fallback SMTP con Nodemailer** cuando `RESEND_API_KEY` no estÃ¡ configurada o Resend falla. En Windows no se depende de `sendmail`, asÃ­ que con `SMTP_HOST` o `SMTP_URL` y credenciales el correo debe seguir saliendo por SMTP.
- **Vercel AI Gateway** (endpoint OpenAI-compatible) para funciones de IA, con modelo configurable en `AI_GATEWAY_MODEL`.

Configura las variables nuevas en `.env` usando `.env.example` como guía.

El módulo de **Resumen** ahora incluye sección de medicamentos y sugerencias IA con disclaimer clínico.
Además, el formulario de laboratorios permite autocompletado de biomarcadores con IA a partir de PDF/imagen subidos.


- En el inicio autenticado se agregó acceso rápido a Laboratorios para registrar estudios sin fricción.
- Si no hay mediciones de glucosa en el rango, las sugerencias IA usan una glucosa estimada basada en comidas (carbohidratos/fibra/proteína) para mejorar el contexto, dejando explícito que es una estimación.
- La sección de sugerencias del Resumen ahora permite estructura clínica (alerta importante, problemas centrales, plan prioritario, nutrición, hábitos, labs sugeridos, guía de productos y progreso esperado), incluso cuando medicación/laboratorios no estén cargados.
- El historial alimenticio muestra un icono informativo por plato con interpretación metabólica y recomendaciones rápidas de optimización.
- La IA del resumen incorpora un marco de producto para ThermoRush en recomendaciones (uso sugerido antes de desayuno/almuerzo, enfoque en apetito-estrés-energía-glucosa, y advertencia de que no reemplaza tratamiento médico).
- Se agregó control de catálogo para IA/chat: productos permitidos para sugerencia comercial y productos restringidos que nunca deben mencionarse.
- En medicación, si el nombre ingresado pertenece al catálogo controlado, se exige validación por foto IA y coincidencia nombre↔imagen antes de guardar.
- En medicación, la IA completa automáticamente nombre/dosis al subir foto; además, cuando identifica un medicamento del catálogo, muestra debajo de la imagen una descripción breve de para qué se utiliza.
- La dosis en el formulario de medicación es opcional; si no se captura, se guarda como "No especificada" para mantener consistencia del registro.
- El widget de chat incluye iconos de historial y limpieza de conversación para recuperar sesiones previas o iniciar una nueva conversación rápidamente.
- El widget de chat ahora consume el contexto completo del paciente: perfil clínico, datos de Ajustes y el historial completo de comidas, glucosa, hábitos, medicación y laboratorios para responder con más contexto.
- En login, el logo de marca se adapta para ocupar casi todo el ancho de su fila con padding vertical para mantener proporción visual en logos alargados.
- En comidas, al subir foto la IA autocompleta automáticamente el campo del plato principal y ahora también persiste las kcal/macros inferidas para que el historial del Resumen muestre el valor real calculado por la IA.
- En `Resumen > Historial de comidas`, la vista abre automáticamente el día más reciente con registros, conserva fecha/hora sin corrimientos por zona horaria y resincroniza solo ese bloque cuando entra una comida nueva.
- Cuando una comida queda clasificada como inadecuada, el badge del historial se normaliza a `Inadecuada` y esa misma clasificación alimenta el contador de comidas inadecuadas del Resumen.
- Tanto en comidas como en medicación, los nombres autocompletados por IA siguen siendo editables para corrección manual del usuario.
- El guardado de comidas debe mantener alineado el payload de `src/actions/comida.ts` con los nombres exactos del modelo `Comida` en Prisma, especialmente `clasificacion_carbohidrato`, para evitar errores de persistencia en PostgreSQL.
- En la página de inicio autenticada se removió el indicador circular junto al título del header para un diseño más limpio.
- Retención automática de archivos:
  - Imágenes de comidas: se eliminan automáticamente a los **365 días**.
  - Archivos/imágenes de laboratorios: se eliminan automáticamente a los **2 años**.
- Al eliminar cuenta desde Ajustes se purgan registros del usuario (comidas, glucosa, hábitos, medicación y datos personales), pero se conservan temporalmente las evidencias de laboratorio hasta cumplir su retención de 2 años para mejora de modelos de IA.
- Para eliminar cuenta en Ajustes ahora se exige repetir la contraseña actual. Si es válida, la sesión se cierra y se redirige a login mostrando confirmación de cuenta eliminada.
- Si el usuario pasa 1 año sin iniciar sesión, el job de retención elimina su cuenta por inactividad con el mismo criterio de purga (conservando evidencias de laboratorio hasta su vencimiento de 2 años).
- Registro ahora incluye selección de Producto (Permitido) por parte del paciente.

### Job de retención (cron)

- Endpoint: `POST /api/maintenance/storage-retention`
- Auth: header `Authorization: Bearer <MAINTENANCE_JOB_TOKEN>`
- Configura `MAINTENANCE_JOB_TOKEN` en `.env`.


- El widget de chat ahora responde en el idioma configurado dentro de la app y cambia en caliente cuando el usuario actualiza su preferencia en Ajustes.
- En `Resumen > Laboratorios`, la app ahora muestra todos los campos detectados por IA y conserva esos resultados aunque el examen use un panel distinto al metabólico estándar.

- La guia de navegacion del chat es bajo demanda: solo muestra pasos, rutas y accesos cuando el usuario pide ayuda para usar la app o solicita un tutorial.

## Escaneo anti-malware en subida de archivos

- Las subidas de **imagen/PDF** (comidas, laboratorios y avatar) intentan validar en VirusTotal antes de continuar.
- Si VirusTotal detecta indicadores maliciosos, la subida se bloquea.
- Si la API no está configurada o falla, la app continúa en modo resiliente (no se cae el flujo principal).
- Configura `VIRUSTOTAL_API_KEY` en `.env`.
