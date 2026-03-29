# Lifemetric

Aplicacion Next.js 16 para seguimiento metabolico con Prisma y PostgreSQL.

## Desarrollo

```bash
pnpm install --frozen-lockfile
pnpm dev
```

La app de desarrollo corre en [http://localhost:3003](http://localhost:3003).

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
- El **rate limiting** se aplica con Upstash Redis usando comandos nativos (`INCR` + `EXPIRE`) para reducir dependencias críticas en runtime.
- La firma de sesión busca secreto en `AUTH_SECRET`, `SESSION_SECRET` o `NEXTAUTH_SECRET` para evitar errores de login por configuración parcial.
- Prisma intenta resolver conexión desde `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_DB_URL`, `SUPABASE_DATABASE_URL`, `SUPABASE_POOLER_URL` o variables `POSTGRES_*` para compatibilidad con despliegues Supabase/Vercel.
- Evita introducir imports de paquetes opcionales en rutas críticas (`layout`, auth) sin fallback explícito, para prevenir errores 500 por resolución de módulos.


## Email y AI

La app ahora incluye integración server-side con:

- **Resend** para correos transaccionales (recuperación de contraseña y suscripción/desuscripción por correo, incluyendo check por defecto en registro).
- **Vercel AI Gateway** (endpoint OpenAI-compatible) para funciones de IA, con modelo configurable en `AI_GATEWAY_MODEL`.

Configura las variables nuevas en `.env` usando `.env.example` como guía.

El módulo de **Resumen** ahora incluye sección de medicamentos y sugerencias IA con disclaimer clínico.
Además, el formulario de laboratorios permite autocompletado de biomarcadores con IA a partir de PDF/imagen subidos.



## Escaneo anti-malware en subida de archivos

- Las subidas de **imagen/PDF** (comidas, laboratorios y avatar) intentan validar en VirusTotal antes de continuar.
- Si VirusTotal detecta indicadores maliciosos, la subida se bloquea.
- Si la API no está configurada o falla, la app continúa en modo resiliente (no se cae el flujo principal).
- Configura `VIRUSTOTAL_API_KEY` en `.env`.
