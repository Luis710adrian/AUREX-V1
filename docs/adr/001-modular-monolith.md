# ADR-001 — Modular monolith and Supabase

Accepted: 2026-10-05.
Next.js App Router + TypeScript; Supabase PostgreSQL, Auth and Storage.
Database transactions own state transitions, financial invariants and audit events.
The web server authenticates with cookie sessions; every data request retains the
user JWT and is constrained by database RLS. No service-role key in web requests.
Each cloud task uses its existing isolated checkout, without additional worktrees.
Use local Supabase for reproducible auth/RLS/integration tests. Hosted Supabase,
OAuth providers, OpenAI and hosting require environment-specific configuration.
No alternative embedded database or simulated production authentication.
