"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import AuthGate from "@/components/AuthGate";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/login";

  return (
    <AuthGate>
      {bare ? (
        children
      ) : (
        <>
          <div className="hidden md:flex">
            <Sidebar />
          </div>
          <main className="flex-1 overflow-hidden flex flex-col min-w-0">
            <MobileNav />
            <div className="flex-1 overflow-y-auto">{children}</div>
          </main>
        </>
      )}
    </AuthGate>
  );
}
