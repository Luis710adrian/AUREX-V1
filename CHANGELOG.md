# Changelog

## 0.1.0 — 2026-10-05 — Núcleo local verificado

### FASE 0 / vertical slice

- Next.js 16, React, TypeScript estricto, npm lockfile, lint, formato y CI definido.
- Tokens AUREX y shell responsive con Canvas, focus/reduced-motion y command palette.
- PostgreSQL, Supabase Auth, sesiones HttpOnly, renovación mediante Proxy, TOTP MFA,
  invitaciones con activación, UI de roles/bloqueo/reactivación; permisos/RLS y
  límite de último Owner activo.
- Esquema comercial/operativo/financiero con UUID, numeric, UTC, relaciones compuestas,
  auditoría append-only, historial y seed DEMO sin contraseñas en el repositorio.
- Transacciones Lead → Opportunity → Proposal → Won → Project → Task → Time →
  Invoice → Payment → KPI. Won y pagos idempotentes; saldo y estado derivados.
- Ocho KPIs SQL con fuente/definición; margen incompleto como null.
- Servicios oficiales ligeros por el límite de disco; migraciones desde base vacía.
- 25 pruebas unitarias/SQL y 4 E2E en build de producción local; capturas desktop/móvil.

### Entregas parciales posteriores

- FASE 1: gates ordenados con evidencia/revisor, riesgos e incidencias distintos,
  hitos y estados de tareas, eventos de notificación y límite seguro para clientes.
- FASE 2: rates históricos, horas, capacidad/ausencias, gastos con aprobación,
  presupuestos iniciales, AR/saldos, pagos parciales y costos por proyecto.

Estas fases siguen sin aceptación completa. FASES 3–6 no implementadas. El cierre
administrado de FASE 0 requiere el proyecto Supabase/hosting y su validación. Revisa
`docs/DELIVERY.md` para requisitos pendientes, riesgos y backlog priorizado.
