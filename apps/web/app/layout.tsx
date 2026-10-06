import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AUREX OS · Research. Data. Strategy.',
  description: 'Centro de operación de AUREX BI Solutions',
};
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
