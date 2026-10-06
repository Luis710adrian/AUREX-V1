# ADR-002 — Resource-limited local verification

Accepted: 2026-10-05.
The 32 GB cloud filesystem cannot expand the current Supabase PostgreSQL 17 or 15
Docker image: both failed with `failed to register layer: no space left on device`.
The standard Supabase CLI installation was tested, then stopped; unused artifacts
created by this task were removed.
For local development use official PostgreSQL 15 Alpine + official Supabase
GoTrue Auth and PostgREST + Kong. These are real services, persistent volumes,
JWT authentication, real PostgreSQL RLS, MFA and the same application migrations.
No mock database or authentication and no relaxation of TLS/checksum checks.
Supabase-managed PostgreSQL/Auth/Storage remains the production target.
Storage, Realtime, Edge Functions and Supabase extensions are NOT validated by
this minimal harness. Local startup uses a purpose-built Compose configuration;
standard `supabase db push` deployment must be tested on the chosen managed project.
All development credentials are generated into ignored local files and never
printed or published. Reuse existing isolated checkout; no worktrees.
