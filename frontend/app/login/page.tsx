"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Search, Star, Calendar, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Starfield from "@/components/landing/Starfield";
import CursorGlow from "@/components/landing/CursorGlow";

const FEATURES = [
  { Icon: Search, label: "Research", glow: "#00ffff" },
  { Icon: Star, label: "Shortlist", glow: "#ff4500" },
  { Icon: Calendar, label: "Track", glow: "#00ffff" },
  { Icon: FileText, label: "Draft", glow: "#ff4500" },
];

// Zero-G repulsion: drifts away from the cursor, springs back with inertia.
function Repel({
  children,
  radius = 130,
  power = 46,
}: {
  children: ReactNode;
  radius?: number;
  power?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mvx = useMotionValue(0);
  const mvy = useMotionValue(0);
  const x = useSpring(mvx, { stiffness: 140, damping: 10 });
  const y = useSpring(mvy, { stiffness: 140, damping: 10 });
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d < radius && d > 0.01) {
        const f = (1 - d / radius) * power;
        mvx.set(-(dx / d) * f);
        mvy.set(-(dy / d) * f);
      } else {
        mvx.set(0);
        mvy.set(0);
      }
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mvx, mvy, radius, power]);
  return (
    <motion.div ref={ref} style={{ x, y }}>
      {children}
    </motion.div>
  );
}

// Magnetic button: the heavy black box stays put; the inner icon+text snaps
// toward the cursor.
function MagneticGoogle({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const mvx = useMotionValue(0);
  const mvy = useMotionValue(0);
  const x = useSpring(mvx, { stiffness: 220, damping: 13 });
  const y = useSpring(mvy, { stiffness: 220, damping: 13 });
  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mvx.set((e.clientX - (r.left + r.width / 2)) * 0.5);
    mvy.set((e.clientY - (r.top + r.height / 2)) * 0.5);
  }
  function reset() {
    mvx.set(0);
    mvy.set(0);
  }
  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={reset}
      disabled={loading}
      className="relative w-full overflow-hidden bg-white px-4 py-4 border-[3px] border-black disabled:opacity-60"
      style={{ boxShadow: "6px 6px 0 #000" }}
    >
      <motion.span
        style={{ x, y }}
        className="flex items-center justify-center gap-3 text-sm font-extrabold text-black font-syne uppercase tracking-wide"
      >
        <Icon icon="logos:google-icon" width={20} />
        Continue with Google
      </motion.span>
    </button>
  );
}

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [user, loading, router]);

  return (
    <div className="h-screen w-full font-space text-white md:cursor-none">
      <CursorGlow />
      <div className="grid md:grid-cols-2 h-screen">
        {/* ── Left: cosmic void hero ─────────────────────────────────────── */}
        <div
          className="relative flex flex-col justify-between p-8 sm:p-12 overflow-hidden"
          style={{ background: "#03030f" }}
        >
          <Starfield className="absolute inset-0 h-full w-full" />
          <div
            className="pointer-events-none absolute left-1/3 top-1/2 size-[420px] rounded-full blur-[120px]"
            style={{ background: "radial-gradient(circle, rgba(255,69,0,0.22), transparent 60%)" }}
          />

          <div className="relative z-10 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                className="size-9 grid place-items-center border-[3px] border-white bg-[#ff4500]"
                style={{ boxShadow: "0 0 18px rgba(255,69,0,0.7)" }}
              >
                <Icon icon="solar:diploma-bold" width={18} className="text-white" />
              </span>
              <span className="font-extrabold text-lg font-syne tracking-tight">GRAD PADDY</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-4" /> Home
            </Link>
          </div>

          <div className="relative z-10 py-10">
            <h1 className="font-syne font-extrabold uppercase leading-[0.92] tracking-tight text-5xl sm:text-6xl">
              Escape
              <br />
              application
              <br />
              <span style={{ color: "#ff4500", textShadow: "0 0 30px rgba(255,69,0,0.6)" }}>
                gravity
              </span>
            </h1>
            <p className="mt-6 max-w-md text-base text-white/55 leading-relaxed">
              Research faculty, build a shortlist, track every deadline, and draft outreach — all
              from one chat with a multi-step AI agent.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-sm">
              {FEATURES.map((f) => (
                <Repel key={f.label}>
                  <div
                    data-cursor
                    className="flex items-center gap-2.5 bg-white px-3 py-2.5 border-[3px] border-black"
                    style={{ boxShadow: `0 0 18px ${f.glow}66` }}
                  >
                    <span
                      className="grid size-7 place-items-center border-2 border-black"
                      style={{ background: f.glow }}
                    >
                      <f.Icon className="size-3.5 text-black" strokeWidth={2.75} />
                    </span>
                    <span className="font-syne font-extrabold uppercase text-xs text-black tracking-wide">
                      {f.label}
                    </span>
                  </div>
                </Repel>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs font-mono text-white/30">
            Multi-step agent · faculty discovery · application tracking
          </p>
        </div>

        {/* ── Right: blueprint grid + floating brutalist card ─────────────── */}
        <div className="relative grid place-items-center p-6 sm:p-12 blueprint-grid">
          <div className="relative float-bob">
            {/* pulsing neon aura behind the harsh shadow */}
            <div
              className="absolute -inset-4 -z-10 blur-2xl aura-pulse"
              style={{ background: "linear-gradient(120deg, #ff4500, #00ffff)" }}
            />
            <div
              className="relative w-full max-w-sm bg-white p-8 border-4 border-black"
              style={{ boxShadow: "8px 8px 0 #000" }}
            >
              <h2 className="font-syne font-extrabold uppercase text-2xl text-black tracking-tight">
                Get started
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Sign in to launch your graduate-school search.
              </p>

              <div className="mt-7">
                <MagneticGoogle onClick={signInWithGoogle} loading={loading} />
              </div>

              <p className="mt-6 text-[11px] text-neutral-500 leading-relaxed">
                By continuing you agree to our{" "}
                <a href="/terms" className="font-bold text-black underline">
                  Terms
                </a>{" "}
                and{" "}
                <a href="/privacy" className="font-bold text-black underline">
                  Privacy Policy
                </a>
                .
              </p>
              <p className="mt-2 text-[11px] text-neutral-500">
                Built for the{" "}
                <a
                  href="https://rapid-agent.devpost.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline"
                  style={{ color: "#ff4500" }}
                >
                  RapidAgent Hackathon
                </a>{" "}
                by Google.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
