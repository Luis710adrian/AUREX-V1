# Entrega y continuidad — AUREX OS

Fecha de inicio: 2026-10-05 (America/Tijuana). Contrato: secciones 01–22 del DOCX.
**Estado: implementación parcial en desarrollo. La Sección 20 completa no está terminada.**
Ninguna fase se acepta solo por contar con tablas o una pantalla.

## FASE 0 y vertical slice

Implementado: Next/TS, lockfile, validación, CI definido, tokens AUREX, shell responsive,
Canvas de marca, reduced-motion/focus, command palette de módulos; PostgreSQL real,
UUID/numeric/UTC, nueve roles, permisos backend/RLS, sesiones Supabase Auth, TOTP MFA,
tenants DEMO, migraciones transaccionales, auditoría append-only y helpers compartidos.
Login/logout/MFA e invitaciones con activación por correo local son operativos y
probados. La UI de miembros permite asignar roles, bloquear/reactivar y protege al
último Owner activo; su directorio está limitado al tenant y al Owner con MFA. CI está escrito y los comandos se ejecutan localmente; GitHub Actions no
se ha ejecutado en el remoto y no hay deploy preview publicado.

Slice implementado: Lead → Opportunity → Proposal → etapas comerciales → Won →
Contract/Project/Budget/6 phases → Task/Milestone → Time Entry → Invoice → Payment → KPI.
Won/pagos son idempotentes; relaciones tenant/proyecto, historiales y costos históricos
se conservan. 8 KPIs persistidos tienen definiciones y enlaces a tablas fuente.
Los filtros KPI todavía no se preservan completamente en el enlace de drill-down.

Pendiente de aceptación FASE 0: deployment preview y validación administrada; componentes UI reutilizables
avanzados/gráficas y búsqueda universal de registros. Pruebas completas de Storage
no se pueden atribuir al harness mínimo porque ese servicio no está instalado.

## FASE 1 — avance parcial

Implementado: núcleo CRM/proyectos; estados de tareas; hitos separados; seis fases y
reviews de gates en orden, con evidencia; riesgos separados de incidencias; tabla de
notificaciones; separación cliente/proyecto y registro de entidades críticas.
Pendiente: CRUD completo y edición/archivo por dominio, ficha 360°, actividades/SLA,
aprobaciones de propuestas con umbrales, planificación de facturas, gates con
artefactos estructurados, Gantt/dependencias/baseline, calendario, archivos/versiones,
aprobación interna/cliente y bandeja de notificaciones funcional. No aceptada.

## FASE 2 — avance parcial

Implementado: horas con rate histórico; capacidad disponible/ausencias y vista semanal;
presupuestos iniciales; gastos pendientes con aprobación; facturas/pagos parciales y
completos; saldos/AR aging; costo directo y margen con estado de completitud; KPIs SQL.
Pendiente: timesheets/aprobación, gestión de equipo/rates desde UI, capacidad 2/4/8
semanas, cambios presupuestales formalizados, revenue devengado, P&L, DSO, cuentas de
caja reales, escenarios, forecast 90d, CFDI/exportaciones y CRUD completo. No aceptada.

## FASES 3–6

Research Ops; Marketing/Data Hub; IA/Portal; Scale/Hardening no están implementadas.
Los avisos de “pendiente/desactivado” son estados explícitos, no conectores simulados.
OAuth/aprobaciones de Meta/LinkedIn y OpenAI requieren configuración externa para
validación, pero el desarrollo pendiente de estos módulos es trabajo de software:
**no se presenta como un bloqueo de credenciales**.

## Bloqueos externos frente a trabajo pendiente

- No hay proyecto Supabase administrado ni hosting especificado/configurado: bloquea
  validar deploy preview, redirects reales, SMTP, Storage administrado y publicación.
- No hay accesos/scopes/aprobaciones de APIs externas ni credencial OpenAI usable:
  bloquea las llamadas reales a esas APIs, no el desarrollo de sus dominios locales.
- Las imágenes Supabase/PostgreSQL actuales excedieron los 32 GB durante extracción.
  Resuelto para Auth/RLS/slice local mediante servicios oficiales ligeros (ADR-002).
- Todo lo enumerado como pendiente por fase es alcance aún por implementar y probar,
  no una supuesta restricción del entorno. El sistema no está listo para producción.

## Backlog priorizado

1. Cerrar FASE 0: componentes/gráficas y búsqueda universal, preview staging y pruebas
   de roles/login en Supabase administrado. Documentar screenshot y evidencia de CI.
2. Cerrar FASE 1: archivos/gates estructurados, ficha de cliente, actividades/SLA,
   planificación contractual de facturación, Gantt/dependencias, notificaciones,
   CRUD/archivado y drill-down filtrado. Completar su demo end-to-end.
3. Cerrar FASE 2: timesheets/rates/capacidad de equipo, costos y cierres, DSO/forecast,
   cash accounts, P&L, escenarios y pruebas financieras adicionales.
4. FASE 3: estudios/muestreo, instrumentos versionados, campo/mystery, evidencias/QA,
   snapshots de dataset inmutables, hallazgos/linaje, pruebas de QA end-to-end.
5. FASE 4: calendario/campañas/atribución, import manual, conectores pending, OAuth,
   worker con retries/idempotencia, quality rules y prueba de fallo sin duplicados.
6. FASE 5: portal compartido, Responses server-side, recuperación con permisos,
   citas/acciones con aprobación, denegación de consultas no autorizadas.
7. FASE 6: observabilidad, paginación, DR/backups/restore, permisos granulares, SSO,
   políticas nonce CSP y rate limit distribuido; medir SLOs y probar recuperación.

## Riesgos y deuda aceptada para desarrollo

Moneda inicial MXN; un tenant seleccionado por primera membership; UI con campos
UUID y límite 100 registros; ausencia de timezone por perfil; importes calculados
correctamente en SQL, visualización numeric JSON adecuada al volumen inicial;
rate limiter en memoria; CSP permite inline, y eval exclusivamente en desarrollo
por requisito de React DevTools. Las animaciones usan Canvas 2D sin interacción de
cursor avanzada. Jobs, tokens OAuth, OpenAI y Storage aún no están provisionados.
No se han enviado mensajes externos, realizado pagos bancarios ni desplegado producción.

## Evidencia ejecutada

- Instalación `npm ci` con lockfile: exit 0; Node 24.19.0.
- Stack local desde volumen vacío: migraciones y seed aplicados; Auth/REST/PostgreSQL
  reales. Arranque posterior conserva la base; imágenes fijadas por digest.
- 25 pruebas unitarias/SQL: 25 passed, 0 failed, 0 skipped. Incluyen aislamiento de
  tenants, todos los roles, MFA, pagos/duplicados, gates, capacidad, costo histórico,
  bloqueo de usuarios, último Owner y confidencialidad de clientes asignados.
- 4 Playwright E2E sobre el build de producción local: 4 passed; ciclo Lead-to-Cash,
  login/MFA, invitación/activación por correo local, bloqueo/reactivación y protección
  del último Owner desde UI, denegación URL/API y CSRF/origin.
- Build, TypeScript y lint comprobados. CI remoto y publicación no ejecutados.
- Capturas desktop y móvil: `docs/evidence/command-center*.png`; datos DEMO persistidos.

Los clientes no leen tablas internas de proyectos/presupuestos: reciben solo
metadatos de archivos explícitamente compartidos y comentarios/aprobaciones externas.
El Portal ampliará esa superficie con vistas seguras, sin exponer columnas financieras.

El volumen Docker conserva datos en esta máquina. Su restauración a una nueva tarea
cloud/publicación aún no ha sido verificada; el bootstrap recrea el entorno DEMO si
no hay volumen. No confundir este almacenamiento de desarrollo con una base administrada.
