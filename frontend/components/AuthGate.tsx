"use client";

import { useEffect, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") router.replace("/login");
    if (user && pathname === "/login") router.replace("/chat");
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "#F7F0E3" }}>
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "#E8472A" }} />
      </div>
    );
  }

  if (!user && pathname !== "/login") return null;

  return <>{children}</>;
}
