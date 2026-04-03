# Password Recovery Alignment

- Supabase Auth remains the source of truth for credentials in registration, password recovery, and password changes from settings.
- The `/recuperar` screen now consumes the recovery link, establishes the temporary Supabase session, and lets the user define a new password in place.
- After a successful Supabase password update, the app synchronizes `pacientes.password_hash` so internal actions that still depend on that column stay consistent.
- The minimum password rule is centralized in `src/lib/auth/passwordPolicy.ts` and reused by registration, recovery, and settings.
