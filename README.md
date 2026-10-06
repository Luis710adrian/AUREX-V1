# AUREX OS

Monolito modular en Next.js App Router + TypeScript, PostgreSQL y Supabase Auth.
La fuente funcional es `docs/master-build-specification.txt`, extraída del DOCX
adjunto. **Este repositorio contiene una entrega parcial; no la plataforma completa.**
El estado verificable de cada fase está en `docs/DELIVERY.md`.

## Desarrollo reproducible

Requisitos: Node 24, npm, Docker con Compose, aproximadamente 3 GB disponibles para
el stack ligero y un navegador Chromium para E2E. Este entorno cloud ya incluye
`/usr/bin/chromium`. En otros equipos, `npx playwright install --with-deps chromium`.

```sh
cd /workspace/AUREX-V1
npm ci
npm run db:start
npm run dev
```

`db:start` genera credenciales de desarrollo en archivos ignorados con permisos
0600, inicia PostgreSQL + Supabase GoTrue + PostgREST + Kong + Mailpit, aplica
migraciones pendientes en transacciones y prepara usuarios/datos DEMO. Es repetible
sin borrar la base existente ni recrear registros comerciales. No se debe ejecutar
contra producción. Rechaza sobrescribir una configuración de Supabase alojada.
Los contenedores y el servidor web deben reiniciarse en cada nueva máquina; no se
asume que los procesos sobrevivan al snapshot. Cada tarea cloud usa el checkout
existente y aislado, sin worktrees adicionales.

Los usuarios locales son `<rol>@aurex.demo`, con los nueve roles definidos en
`packages/domain/catalog.ts` y `outsider@aurex.demo` para pruebas de otro tenant.
La contraseña DEMO está en `AUREX_DEMO_PASSWORD` del archivo ignorado
`apps/web/.env.local`: **no la copies al repositorio, logs o chat**. Owner y Finance
requieren configurar TOTP en el login antes de consultar datos. Invitaciones y
activación de contraseña se prueban mediante correo local. No hay signup público.
El email local queda capturado en Mailpit; no se envía a proveedores externos.

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run start
```

E2E usa datos persistidos y autenticación real; sus registros están identificados
como E2E dentro de un tenant DEMO. La preparación E2E elimina únicamente los factores
MFA del usuario local `owner@aurex.demo`, para poder probar su enrolamiento desde cero.
No ejecutar este comando contra un sistema operativo real. Los artefactos de pruebas
son ignorados: algunas trazas pueden contener credenciales de prueba y no deben publicarse.
`npm run db:stop` detiene servicios sin eliminar volúmenes. No hay reset automático.

## Estructura

- `apps/web`: login/MFA, shell AUREX, API protegida, formularios y tablas.
- `packages/domain`: roles, catálogo y contratos de entrada Zod.
- `packages/analytics`: lógica financiera decimal comprobada.
- `supabase/migrations`: esquema, RLS, integridad, auditoría y transacciones.
- `supabase/seed.sql`: tenants y definiciones KPI DEMO, sin contraseñas.
- `infra/local`: servicios oficiales para validación local ligera (ADR-002).
- `tests`: pruebas SQL/RLS y flujos Playwright.
- `docs/adr`, `docs/phases`: decisiones, planes y criterios de aceptación.

## Datos, permisos y eventos

`tenant_id` aparece en todas las entidades comerciales. Las relaciones usan FK
compuestas para impedir cruces de tenant y de proyecto. UUID, importes numeric y
UTC son obligatorios. `memberships` determina permisos, nunca datos enviados por el
navegador. Los roles PM/Analyst/Field/Client están limitados por `project_members`.
Owner y Finance necesitan `aal2`, también en las políticas SQL. El usuario Client
no accede a finanzas, CRM ni tablas internas de proyectos; solo ve archivos
explícitamente compartidos y comentarios/aprobaciones externos.

Las transiciones comerciales y financieras usan RPC transaccionales con controles
de autorización. Won genera contrato, proyecto, presupuesto y seis fases AUREX,
y es idempotente. El pago bloquea la factura, valida saldo y actualiza estado; no
existe una acción directa de “marcar pagada”. No se permite modificar facturas,
pagos, horas o histories desde REST. Los rates quedan capturados por fecha en las
horas y los gates guardan evidencia/revisor. Audit es append-only para los usuarios.
Las acciones SQL importantes registran tenant, actor, entidad, antes/después y UTC.

Rutas: `/command`, `/crm`, `/clients`, `/projects`, `/work`, `/finance`, `/files`,
`/admin`, `/login`; API `/api/auth`, `/api/data`, `/api/actions`, `/api/admin/invite`, `/api/health`;
`/invite` activa el acceso. El health check valida Auth y una consulta SQL real.
Las rutas sin permisos devuelven un estado denied; acceso directo a API se rechaza.
La UI no contiene claves privilegiadas ni calcula KPIs desde arrays hardcoded.

Los ocho KPIs del slice se calculan en SQL. Facturación **no es revenue reconocido**;
cobros **no son saldo total de caja**. Cartera y costos son acumulados; facturación,
cobros y horas usan el periodo, pipeline usa fecha de cierre. La moneda es explícita
(MXN en la UI inicial). Los márgenes son nulos mientras no se atestigüen los costos
completos. Las definiciones y fuentes se guardan en `kpi_definitions`.

## Variables y despliegue

| Variable                        | Uso                                     | Exposición    |
| ------------------------------- | --------------------------------------- | ------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL de API del proyecto                 | Pública       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública limitada por RLS          | Pública       |
| `SUPABASE_SERVICE_ROLE_KEY`     | Invitaciones de usuarios, solo servidor | Secreta       |
| `DATABASE_URL`                  | Scripts/tests locales, nunca navegador  | Secreta       |
| `AUREX_DEMO_PASSWORD`           | Solo tests/usuarios locales DEMO        | Secreta local |

El target administrado sigue siendo Supabase + Vercel o equivalente. Configura un
proyecto dev/staging separado, aplica las migraciones con `supabase db push`, usa
claves de ese proyecto en los ajustes seguros, configura redirects/SMTP/MFA y
valida Auth/RLS/Storage ahí antes de publicar. **No ejecutes el seed DEMO ni el
bootstrap local contra producción.** En Vercel usa raíz `apps/web`, Next.js,
Node 24, Install Command `cd ../.. && npm ci` y Build Command `npm run build`.
Activa el acceso a archivos fuera del Root Directory para los paquetes compartidos.
Consulta `docs/DEPLOYMENT.md`. No hay despliegue externo verificado todavía.

No se ha provisionado Storage/Realtime en el harness ligero. La tabla `files` guarda
solo metadatos: cargar/versionar/aprobar entregables sigue pendiente. No hay APIs
sociales conectadas, ni llamadas OpenAI, ni portal operativo. El límite de tablas
es 100 registros recientes y el rate limit actual es por proceso; ambos requieren
ampliación antes de producción. Consulta `docs/DELIVERY.md` y el backlog priorizado.
