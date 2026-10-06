import { execFileSync } from 'node:child_process';
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const compose = [
  'compose',
  '--project-name',
  process.env.AUREX_COMPOSE_PROJECT || 'aurex-dev',
  '--env-file',
  'infra/local/.env',
  '-f',
  'infra/local/compose.yml',
];
run('node', ['scripts/local-config.mjs']);
run('docker', [...compose, 'up', '-d', '--wait', 'db']);
run('node', ['scripts/db-prepare.mjs', '--roles-only']);
run('docker', [...compose, 'up', '-d']);
let ready = false;
for (let i = 0; i < 30; i++) {
  try {
    const r = await fetch('http://127.0.0.1:54321/auth/v1/health', {
      signal: AbortSignal.timeout(2000),
    });
    if (r.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
if (!ready) throw new Error('Supabase Auth did not pass health check; inspect auth logs');
run('node', ['scripts/db-prepare.mjs']);
run('node', ['scripts/demo.mjs']);
console.log(
  'Local PostgreSQL/Auth/REST ready. Start Next with npm run dev. Storage and external integrations remain pending.',
);
