import { useEffect, useRef } from "react";

/**
 * Antigravity-style floating particle field (https://antigravity.google).
 * Small colored dots that drift slowly upward on a dark base. Purely
 * decorative. Colors are read from CSS variables --ag-p1/2/3 set by the
 * background-theme engine, so changing the site background recolors them live.
 */
export default function ParticleField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;

    const readColors = (): string[] => {
      const cs = getComputedStyle(document.documentElement);
      const pick = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
      return [pick("--ag-p1", "#5b6cff"), pick("--ag-p2", "#c026ff"), pick("--ag-p3", "#ff2d82")];
    };
    let colors = readColors();

    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; a: number };
    let parts: P[] = [];

    const make = (atBottom = false): P => ({
      x: Math.random() * w,
      y: atBottom ? h + Math.random() * 40 : Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.15 + Math.random() * 0.55),
      r: Math.random() * 1.7 + 0.5,
      c: colors[Math.floor(Math.random() * colors.length)],
      a: Math.random() * 0.55 + 0.2,
    });

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(30, Math.min(140, Math.round((w * h) / 11000)));
      parts = Array.from({ length: count }, () => make());
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = () => {
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) Object.assign(p, make(true));
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    resize();
    if (reduce) draw();
    else tick();

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    // Recolor live when the background theme changes (CSS vars on <html>).
    const mo = new MutationObserver(() => {
      const next = readColors();
      if (next.join() === colors.join()) return;
      colors = next;
      for (const p of parts) p.c = colors[Math.floor(Math.random() * colors.length)];
      if (reduce) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      mo.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
