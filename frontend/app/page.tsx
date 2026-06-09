"use client";

import { useAuth } from "@/context/AuthContext";
import Landing from "@/components/landing/Landing";

export default function Home() {
  const { loading } = useAuth();

  // Logged-in users still see the landing page (e.g. by clicking the logo);
  // the CTAs route them straight to /chat instead of /login.
  if (loading) {
    return (
      <div className="flex-1 grid place-items-center" style={{ background: "#0B0A0F" }}>
        <div className="size-5 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <Landing />;
}
