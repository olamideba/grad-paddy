import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Grad Paddy — AI Graduate School Agent",
  description: "Multi-step AI agent for graduate school search, faculty discovery, and application tracking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden font-grotesk" style={{ background: "var(--midnight)", color: "var(--fg)" }}>
        {/* Sidebar — desktop only */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
          {/* Bottom nav — mobile only */}
          <div className="md:hidden flex-shrink-0">
            <BottomNav />
          </div>
        </main>
      </body>
    </html>
  );
}
