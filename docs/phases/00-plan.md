# Phase 0 plan and acceptance

1. Bootstrap Next/TypeScript, branded accessible shell, CI and reproducible setup.
2. SQL first: identity, role permissions, tenant isolation, core business entities,
   append-only audit, method phases, transactional lead-to-cash and real KPI SQL.
3. Supabase cookie login, invite-ready memberships, MFA enforcement for sensitive roles.
4. Clearly labeled DEMO seed with two tenants for cross-tenant negative tests.
5. Verify migration/reset, full transaction slice, role/tenant denial, unit tests,
   build/type/lint and Playwright browser workflow; save evidence and changelog.

Acceptance: persistence; no privileged browser credentials; backend authorization;
RLS read/write tests; accessible empty/error/denied states; full vertical slice;
financial decimal arithmetic; idempotent Won conversion and payments; KPI drill-down.
Deploy preview and hosted environment are external deliverables and must be reported
separately from verified local runtime. Do not mark later phases accepted until
all their functionality, tests and end-to-end demos pass.
