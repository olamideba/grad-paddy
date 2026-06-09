"use client";

import { useEffect, useRef } from "react";

type Star = {
  ox: number; // anchor
  oy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number; // depth 0.15..1 → size, parallax, speed
  r: number;
  tw: number; // twinkle phase
  color: string;
};

type Wave = { x: number; y: number; r: number };

const STAR_COLORS = ["#ffffff", "#ffffff", "#cfefff", "#4ecdc4", "#e8472a", "#7dd3fc"];

/**
 * Deep-space starfield. Twinkling stars at varied depth drift slowly; the whole
 * field parallaxes with the cursor and scroll. A click fires a shockwave ring
 * that shoves nearby stars outward before they spring back to anchor.
 */
export default function Starfield({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stars: Star[] = [];
    let waves: Wave[] = [];
    let w = 0;
    let h = 0;
    let t = 0;
    const mouse = { x: -9999, y: -9999 };
    const par = { x: 0, y: 0 }; // eased cursor parallax
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function build() {
      const parent = canvas!.parentElement;
      w = parent?.clientWidth ?? window.innerWidth;
      h = parent?.clientHeight ?? window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(280, Math.floor((w * h) / 6000));
      stars = Array.from({ length: count }, () => {
        const z = 0.15 + Math.random() * 0.85;
        const x = Math.random() * w;
        const y = Math.random() * h;
        return {
          ox: x,
          oy: y,
          x,
          y,
          vx: 0,
          vy: 0,
          z,
          r: z * 1.6 + 0.3,
          tw: Math.random() * Math.PI * 2,
          color: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0],
        };
      });
    }

    function frame() {
      t += 0.016;
      ctx!.clearRect(0, 0, w, h);

      // ease parallax toward cursor offset from center
      const tx = mouse.x < 0 ? 0 : (mouse.x - w / 2) * 0.03;
      const ty = mouse.y < 0 ? 0 : (mouse.y - h / 2) * 0.03;
      par.x += (tx - par.x) * 0.05;
      par.y += (ty - par.y) * 0.05;

      // advance shockwaves
      waves = waves.filter((wv) => wv.r < Math.max(w, h) * 1.2);
      for (const wv of waves) wv.r += 14;

      for (const s of stars) {
        // slow anchor drift
        s.ox += Math.sin(t * 0.2 + s.tw) * 0.04 * s.z;
        s.oy += Math.cos(t * 0.18 + s.tw) * 0.04 * s.z;

        // shockwave impulse (ring push)
        for (const wv of waves) {
          const dx = s.x - wv.x;
          const dy = s.y - wv.y;
          const d = Math.hypot(dx, dy);
          if (Math.abs(d - wv.r) < 60 && d > 0.01) {
            const f = (1 - Math.abs(d - wv.r) / 60) * 3.2;
            s.vx += (dx / d) * f;
            s.vy += (dy / d) * f;
          }
        }

        // integrate + friction + spring to parallaxed anchor
        const ax = s.ox + par.x * s.z;
        const ay = s.oy + par.y * s.z;
        s.vx *= 0.9;
        s.vy *= 0.9;
        s.vx += (ax - s.x) * 0.05;
        s.vy += (ay - s.y) * 0.05;
        s.x += s.vx;
        s.y += s.vy;

        const twinkle = 0.55 + 0.45 * Math.sin(t * 2 + s.tw);
        ctx!.globalAlpha = twinkle * (0.4 + s.z * 0.6);
        ctx!.fillStyle = s.color;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
        // glow for the brighter near stars
        if (s.z > 0.7) {
          ctx!.globalAlpha = twinkle * 0.18;
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    function onMove(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    }
    function onClick(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      waves.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 0 });
      if (waves.length > 6) waves.shift();
    }

    build();
    if (reduce) {
      frame();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }
    window.addEventListener("resize", build);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", build);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
