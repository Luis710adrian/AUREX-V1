'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { modules } from '../../../packages/domain/catalog';
export function Shell({
  children,
  role,
  demo,
  domains,
}: {
  children: React.ReactNode;
  role: string;
  demo: boolean;
  domains: string[];
}) {
  const router = useRouter();
  const path = usePathname();
  const [command, setCommand] = useState(false);
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommand((v) => !v);
      }
      if (e.key === 'Escape') setCommand(false);
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const entries = [
    ['command', 'Command Center'],
    ...Object.entries(modules)
      .filter(([, v]) => domains.includes(v.domain))
      .map(([k, v]) => [k, v.name]),
  ];
  return (
    <div className="shell">
      <aside>
        <Link className="brand" href="/command">
          AUREX<span>OS / OPERATING INTELLIGENCE</span>
        </Link>
        <nav aria-label="Navegación principal">
          {entries.map(([key, label]) => (
            <Link key={key} href={'/' + key} aria-current={path === '/' + key ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          Research. Data. Strategy.<small>Sesión: {role}</small>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            BI SOLUTIONS <b>/</b> {demo ? 'ENTORNO DEMO' : 'OPERACIÓN'}
          </span>
          <div>
            <button onClick={() => setCommand(true)}>
              Buscar <kbd>⌘ K</kbd>
            </button>
            <button
              aria-pressed={focus}
              onClick={() => {
                setFocus(!focus);
                if (!focus) document.documentElement.dataset.focus = 'true';
                else delete document.documentElement.dataset.focus;
              }}
            >
              Focus
            </button>
            <button
              onClick={async () => {
                await fetch('/api/auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'logout' }),
                });
                router.push('/login');
                router.refresh();
              }}
            >
              Salir
            </button>
          </div>
        </header>
        {demo && (
          <p className="demo">
            DEMO · Datos de prueba persistentes. No representan operación real de AUREX.
          </p>
        )}
        <main id="main">{children}</main>
        <footer>
          AUREX OS <span>DECISIÓN, NO DECORACIÓN.</span>
        </footer>
      </div>
      {command && (
        <dialog open className="palette" aria-label="Command palette">
          <input
            autoFocus
            aria-label="Buscar módulo"
            placeholder="Buscar módulo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {entries
            .filter(([, label]) => label.toLowerCase().includes(query.toLowerCase()))
            .map(([key, label]) => (
              <Link key={key} href={'/' + key} onClick={() => setCommand(false)}>
                {label}
              </Link>
            ))}
          <button onClick={() => setCommand(false)}>Cerrar (Esc)</button>
        </dialog>
      )}
    </div>
  );
}
