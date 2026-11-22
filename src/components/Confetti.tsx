import { useEffect, useRef } from "react";

const COLORS = [
  "#58cc02",
  "#ffc800",
  "#1cb0f6",
  "#ff9600",
  "#ce82ff",
  "#ff4b4b",
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rot: number;
  vRot: number;
}

export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 180,
      vx: (Math.random() - 0.5) * 4,
      vy: 2.5 + Math.random() * 4.5,
      w: 7 + Math.random() * 6,
      h: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.22,
    }));

    let rafId = 0;
    const started = performance.now();

    const tick = (now: number) => {
      const elapsed = now - started;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const alpha = elapsed > 2400 ? Math.max(0, 1 - (elapsed - 2400) / 800) : 1;
      ctx.globalAlpha = alpha;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.rot += p.vRot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (elapsed < 3200) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
}
