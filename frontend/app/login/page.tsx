"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";

const STEPS = [
  { icon: "solar:magnifer-bold", label: "Research", desc: "Find faculty & programs that fit" },
  { icon: "solar:star-bold", label: "Shortlist", desc: "Save and compare the best matches" },
  { icon: "solar:calendar-bold", label: "Track", desc: "Stay on top of every deadline" },
  { icon: "solar:document-text-bold", label: "Draft", desc: "Write SOPs and outreach emails" },
];

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [user, loading, router]);

  return (
    <div className="min-h-screen w-full grid md:grid-cols-2" style={{ background: "#F7F0E3" }}>
      {/* Hero / value */}
      <div
        className="relative flex flex-col justify-between p-8 sm:p-12"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <Logo />

        <div className="py-12">
          <h1
            className="text-3xl sm:text-4xl font-bold font-space leading-tight mb-3"
            style={{ color: "#FFFFFF" }}
          >
            Your AI co-pilot for <span style={{ color: "#E8472A" }}>grad school.</span>
          </h1>
          <p
            className="text-sm sm:text-base font-dm mb-8 max-w-md"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Research faculty, build a shortlist, track applications, and draft outreach — all from
            one chat with a multi-step AI agent.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            {STEPS.map((s) => (
              <div key={s.label} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 shrink-0 flex items-center justify-center mt-0.5"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1.5px solid rgba(255,255,255,0.25)",
                    borderRadius: "4px",
                    color: "#E8472A",
                  }}
                >
                  <Icon icon={s.icon} width={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold font-space" style={{ color: "#FFFFFF" }}>
                    {s.label}
                  </div>
                  <div
                    className="text-xs font-dm leading-tight"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    {s.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
          Multi-step agent · faculty discovery · application tracking
        </p>
      </div>

      {/* Sign-in */}
      <div className="flex items-center justify-center p-8 sm:p-12">
        <div
          className="float-water w-full max-w-sm p-8"
          style={{
            background: "#FFFFFF",
            border: "2px solid #0D0D0D",
            boxShadow: "6px 6px 0 #0D0D0D",
            borderRadius: "4px",
          }}
        >
          <h2 className="text-xl font-bold font-space mb-1" style={{ color: "#0D0D0D" }}>
            Get started
          </h2>
          <p className="text-sm font-dm mb-8" style={{ color: "#9CA3AF" }}>
            Sign in to start your graduate school search.
          </p>

          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold font-space bouncy"
            style={{
              background: "#0D0D0D",
              color: "#FFFFFF",
              border: "2px solid #0D0D0D",
              borderRadius: "4px",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Icon icon="logos:google-icon" width={18} />
            Continue with Google
          </button>

          <p className="text-[11px] font-dm mt-6 text-center" style={{ color: "#B0A898" }}>
            By continuing you agree to use Grad Paddy for your own application research.
          </p>
        </div>
      </div>
    </div>
  );
}
