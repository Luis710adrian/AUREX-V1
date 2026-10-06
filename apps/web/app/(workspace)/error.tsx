'use client';
export default function ErrorState({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <h1>No se pudo cargar la operación</h1>
      <p role="alert">Revisa la conexión y tus permisos. No se han fabricado datos.</p>
      <button onClick={reset}>Reintentar</button>
    </section>
  );
}
