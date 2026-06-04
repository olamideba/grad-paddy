import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AgentProvider } from "@/components/AgentProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ChatSessionsProvider } from "@/context/ChatSessionsContext";

export const metadata: Metadata = {
  title: "Grad Paddy — AI Graduate School Agent",
  description:
    "Multi-step AI agent for graduate school search, faculty discovery, and application tracking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className="flex h-screen overflow-hidden font-dm"
        style={{ background: "#F7F0E3", color: "#0D0D0D" }}
      >
        <AuthProvider>
          <AgentProvider>
            <ChatSessionsProvider>
              <AppShell>{children}</AppShell>
            </ChatSessionsProvider>
          </AgentProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
