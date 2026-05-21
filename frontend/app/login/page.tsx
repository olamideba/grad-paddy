"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [user, loading, router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#F7F0E3" }}
    >
      <div
        className="w-full max-w-sm p-8"
        style={{ background: "#FFFFFF", border: "2px solid #0D0D0D", boxShadow: "6px 6px 0 #0D0D0D", borderRadius: "4px" }}
      >
        <div className="flex items-center gap-2 mb-8">
          <div
            className="w-8 h-8 flex items-center justify-center"
            style={{ background: "#E8472A", border: "2px solid #0D0D0D", borderRadius: "4px" }}
          >
            <Icon icon="solar:diploma-bold" width={16} style={{ color: "#FFFFFF" }} />
          </div>
          <span className="text-base font-bold font-space" style={{ color: "#0D0D0D" }}>Grad Paddy</span>
        </div>

        <h1 className="text-xl font-bold font-space mb-1" style={{ color: "#0D0D0D" }}>
          Sign in
        </h1>
        <p className="text-sm font-dm mb-8" style={{ color: "#9CA3AF" }}>
          Your AI graduate school agent.
        </p>

        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold font-space bouncy"
          style={{
            background: "#0D0D0D", color: "#FFFFFF",
            border: "2px solid #0D0D0D", borderRadius: "4px",
          }}
        >
          <Icon icon="logos:google-icon" width={18} />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
