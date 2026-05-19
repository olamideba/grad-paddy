"use client";

import { createContext, useContext, useState } from "react";

type AgentCtxType = { isRunning: boolean; setRunning: (v: boolean) => void };

const AgentCtx = createContext<AgentCtxType>({ isRunning: false, setRunning: () => {} });

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [isRunning, setRunning] = useState(false);
  return <AgentCtx.Provider value={{ isRunning, setRunning }}>{children}</AgentCtx.Provider>;
}

export function useAgent() { return useContext(AgentCtx); }
