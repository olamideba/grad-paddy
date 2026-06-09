"use client";

import { useEffect, useRef } from "react";

/**
 * Holographic cursor: an instant inner dot + a lagging glowing ring that grows
 * when hovering interactive elements. Desktop / fine-pointer only.
 */
export default function CursorGlow() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let rx = window.innerWidth / 2;
    let ry = window.innerHeight / 2;
    const target = { x: rx, y: ry };
    let hover = false;
    let raf = 0;

    function move(e: MouseEvent) {
      target.x = e.clientX;
      target.y = e.clientY;
      dot!.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
      const el = e.target as HTMLElement;
      hover = !!el?.closest?.("a, button, [data-cursor]");
    }
    function loop() {
      rx += (target.x - rx) * 0.2;
      ry += (target.y - ry) * 0.2;
      const s = hover ? 2.4 : 1;
      ring!.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) scale(${s})`;
      ring!.style.opacity = hover ? "0.9" : "0.55";
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener("mousemove", move);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] hidden md:block" aria-hidden>
      <div
        ref={ringRef}
        className="fixed top-0 left-0 size-8 rounded-full border border-[#4ecdc4]/70"
        style={{ boxShadow: "0 0 16px 2px rgba(78,205,196,0.5)", transition: "opacity 150ms" }}
      />
      <div
        ref={dotRef}
        className="fixed top-0 left-0 size-1.5 rounded-full bg-[#4ecdc4]"
        style={{ boxShadow: "0 0 10px 2px rgba(78,205,196,0.9)" }}
      />
    </div>
  );
}
