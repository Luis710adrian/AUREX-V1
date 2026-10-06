'use client';
import { useEffect, useRef } from 'react';
export function BrandNetwork() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let id = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const points = Array.from({ length: 26 }, (_, i) => ({
      x: (i * 137) % 800,
      y: (i * 83) % 230,
    }));
    function draw() {
      if (!c || !ctx) return;
      c.width = c.clientWidth * devicePixelRatio;
      c.height = 230 * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const x = a.x * (c.clientWidth / 800),
          y = a.y + (reduced.matches ? 0 : Math.sin(frame / 80 + i) * 8);
        ctx.fillStyle = '#C6A664';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 7);
        ctx.fill();
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < 150) {
            ctx.strokeStyle = '#C6A66422';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(b.x * (c.clientWidth / 800), b.y);
            ctx.stroke();
          }
        }
      }
      frame++;
      if (!reduced.matches && !document.documentElement.dataset.focus)
        id = requestAnimationFrame(draw);
    }
    draw();
    const redraw = () => {
      cancelAnimationFrame(id);
      draw();
    };
    window.addEventListener('resize', redraw);
    reduced.addEventListener('change', redraw);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', redraw);
      reduced.removeEventListener('change', redraw);
    };
  }, []);
  return <canvas ref={canvas} className="network" aria-hidden="true" />;
}
