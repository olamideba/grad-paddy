"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Landing from "@/components/landing/Landing";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Logged-in users skip the marketing page and go straight to the app.
  useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex-1 grid place-items-center" style={{ background: "#0B0A0F" }}>
        <div className="size-5 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <Landing />;
}
