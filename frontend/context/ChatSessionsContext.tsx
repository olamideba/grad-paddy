"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { Session as ApiSession } from "../lib/api";
import { useAuth } from "./AuthContext";

interface ChatSessionsCtx {
  sessions: ApiSession[];
  setSessions: React.Dispatch<React.SetStateAction<ApiSession[]>>;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  sessionsLoading: boolean;
  // Group the next-created chat should be assigned to (set when starting a new
  // chat from inside a group). Consumed and cleared on session creation.
  pendingGroupId: string | null;
  setPendingGroupId: (id: string | null) => void;
}

const ChatSessionsContext = createContext<ChatSessionsCtx | null>(null);

export function ChatSessionsProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      queueMicrotask(() => setSessionsLoading(false));
      return;
    }
    import("../lib/api").then(({ sessionsApi }) =>
      sessionsApi
        .list()
        .then((r) => setSessions(r.data))
        .catch(() => {})
        .finally(() => setSessionsLoading(false))
    );
  }, [authLoading, user]);

  return (
    <ChatSessionsContext.Provider
      value={{
        sessions,
        setSessions,
        activeSessionId,
        setActiveSessionId,
        sessionsLoading,
        pendingGroupId,
        setPendingGroupId,
      }}
    >
      {children}
    </ChatSessionsContext.Provider>
  );
}

export function useChatSessions() {
  const ctx = useContext(ChatSessionsContext);
  if (!ctx) throw new Error("useChatSessions must be used inside ChatSessionsProvider");
  return ctx;
}
