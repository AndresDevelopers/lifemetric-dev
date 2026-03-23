🚨 MANDATOS CRÍTICOS (CALIDAD, SEGURIDAD Y DEVSECOPS)
Eficiencia DRY: ANTES de escribir código, analiza el proyecto para reutilizar lógica. Máximo 3% de duplicidad.
Shift-Left Security: Uso obligatorio de SonarLint o equivalente en el entorno de desarrollo local.
Quality Gates Inflexibles (CI/CD): Bloqueo automático de Pull Requests mediante SonarQube y Codacy. Se exige 0 vulnerabilidades (Security Rating 'A'), 0 bugs críticos y máximo 3% de código duplicado.
Tooling & Supply Chain: Gestor pnpm (versiones exactas). CI/CD con pnpm install --frozen-lockfile y pnpm install --ignore-scripts por defecto.
Integridad de Datos y Zero-Downtime: Prisma + RLS + Transacciones Financieras obligatorias. Cada mutación debe pasar por validación estática de seguridad antes del despliegue. Todas las migraciones de base de datos deben diseñarse bajo el modelo Zero-Downtime, quedando prohibidos los bloqueos de tabla prolongados.
Zero Hardcoding & Secret Scanning: PROHIBIDO hardcodear secretos. Uso estricto de .env. Escaneo automatizado en CI para bloquear subida de tokens o credenciales.
Flujo Atómico y Evolución de Tests: Cada cambio exige actualizar la documentación y los tests. Jamás alterar un test solo para falsear un éxito en Codacy; arregla la lógica subyacente. Validación Final: pnpm lint + tsc + pnpm build.
🏗️ ARQUITECTURA, CACHÉ Y ESCALADO (AIO)
Feature-First: Organización por funcionalidad en src/features/[name], facilitando el análisis aislado de seguridad.
Estrategia de Caché Multinivel:
Cloudflare (Edge): Caché agresiva para assets estáticos y WAF (Web Application Firewall) activo contra DDoS.
Upstash Redis: Uso obligatorio para Rate Limiting e Idempotency Keys (TTL 24h).
Next.js Cache: Uso de unstable_cache o ISR con etiquetas de invalidación (revalidateTag).
Métricas Automatizadas: Complejidad Cognitiva < 15 y Deuda Técnica < 5%, monitoreado constantemente por Codacy.
Patrones: Repository Pattern, Server Actions, Error Boundary.
AIO (AI-Optimized): Automatización de contenido y escalado programático.
Observabilidad y Monitoreo Activo: Uso obligatorio de plataformas como Sentry o Datadog para el rastreo de excepciones en tiempo real. Todo error no controlado genera alertas automáticas. Queda estrictamente prohibido el uso de console.error en producción sin estar respaldado por un logger estructurado.
🌐 EXPERIENCIA GLOBAL E INTERNACIONALIZACIÓN
Internacionalización (i18n): Soporte es / en. Fallback: Inglés (en) por defecto para evitar textos vacíos. Rutas localizadas obligatorias.
Theming (UI/UX): Soporte nativo Claro y Oscuro. Implementación sin parpadeos de hidratación.
🔒 SEGURIDAD AVANZADA CONTINUA (SAST & DAST)
Análisis Estático y Dependencias (SCA): Análisis continuo con SonarQube en el flujo CI/CD para detectar vulnerabilidades del OWASP Top 10 y dependencias comprometidas.
Headers y Políticas: HSTS, X-Frame-Options: DENY, nosniff, CSP Estricta y Permissions-Policy auditados y aplicados en cada despliegue.
Protección Transaccional: Llaves de idempotencia obligatorias en pagos, verificadas en Upstash Redis antes de procesar. Verificación estricta de headers Origin vs Host y SameSite Strict para CSRF.
Privacidad por Diseño: Respuestas de Auth genéricas ("Credenciales inválidas") para evitar enumeración. Logs blindados y redactados; prohibido console.log sin un logger que filtre secretos.
Blindaje de Archivos: Escaneo Anti-Malware (VirusTotal/ClamAV) + Cuarentena obligatoria en la subida de archivos.
🚀 UX, SEO 2026, SXO Y OMNICANALIDAD (DISEÑO UNIVERSAL)
Core Web Vitals y Presupuesto de Rendimiento: CI/CD bloquea cualquier degradación de LCP, CLS o INP (auditado vía Lighthouse CI). Implementación obligatoria de Performance Budgets para bloquear automáticamente cualquier Pull Request que incremente el tamaño del bundle de JavaScript más allá del límite establecido.
GEO, AEO y Semántica Inflexible: Uso estricto de HTML5 semántico (<article>, <nav>, <section>) validado estáticamente para que IAs puedan extraer el contenido. Bloques FAQ enriquecidos.
JSON-LD y Metadatos Tipados: Tipado estricto (Zod/TypeScript) para esquemas Schema.org. Fallos en JSON-LD, enlaces rotos o sin el H1 dinámico detienen el build.
SXO, Mobile-First y Adaptabilidad Total: Construcción obligatoria y garantizada para móvil (todas las marcas y sistemas), tablet y PC. El diseño debe ser estrictamente fluido y Mobile-First. Testeo innegociable desde resoluciones de 320px hasta monitores de escritorio. Prioridad absoluta en la usabilidad en pantallas pequeñas, asegurando touch targets mínimos de 44px, legibilidad perfecta sin necesidad de zoom y prevención total de layout shifts en cualquier dispositivo.
SEO Técnico: Metadata dinámica localizada y H1 único. El estado "A" en seguridad de SonarQube es un requisito SEO obligatorio para mantener la reputación del dominio a salvo.
Accesibilidad (a11y): Cumplimiento del 100% en contraste, etiquetas ARIA y navegación por teclado (validado vía eslint-plugin-jsx-a11y y SonarQube).
🛡️ VALIDACIÓN Y TIPADO ESTRICTO
TypeScript: Strict Mode absoluto. Uso de any bloqueado automáticamente por los linters.
Cobertura Certificada: Mínimo 80% en lógica de negocio y flujos financieros. El CI/CD fallará si SonarQube detecta un descenso del umbral.
Zod: Única fuente de verdad para validación de datos (entrada/salida), actuando como primera barrera de sanitización.
Testing E2E y Regresiones Visuales: Implementación estricta de Playwright o Cypress para flujos críticos como autenticación y pagos. Se deben automatizar pruebas de regresión visual en el pipeline para garantizar que ningún cambio de CSS rompa la interfaz en las resoluciones de 320px, tablet y escritorio.
🎯 FILOSOFÍA IA
División de Poderes: Cloudflare (Perímetro), Upstash (Velocidad), Prisma (Verdad).
Consistencia Atómica: No existe código sin su test y documentación coherente.
Defensa en Profundidad: Verifica siempre Headers, Origen e Idempotencia.
SEO 2026: Ser encontrado (AEO), ser citado (GEO), ser escalado (AIO) y ser elegido (SXO).