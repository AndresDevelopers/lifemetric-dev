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


## Email y AI

La app ahora incluye integración server-side con:

- **Resend** para correos transaccionales (recuperación de contraseña y suscripción/desuscripción por correo, incluyendo check por defecto en registro).
- **Gemini** vía API REST para futuras funciones de IA, con modelo configurable en `GEMINI_MODEL`.

Configura las variables nuevas en `.env` usando `.env.example` como guía.

El módulo de **Resumen** ahora incluye sección de medicamentos y sugerencias IA con disclaimer clínico.
Además, el formulario de laboratorios permite autocompletado de biomarcadores con IA a partir de PDF/imagen subidos.

