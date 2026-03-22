"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type UpgradeModalState = {
  isOpen:   boolean;
  forced:   boolean;  // true = no X button (expired hard-block)
};

type UpgradeModalContext = {
  open:  (opts?: { forced?: boolean }) => void;
  close: () => void;
  state: UpgradeModalState;
};

const Ctx = createContext<UpgradeModalContext | null>(null);

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpgradeModalState>({ isOpen: false, forced: false });

  const open  = useCallback((opts?: { forced?: boolean }) => {
    setState({ isOpen: true, forced: opts?.forced ?? false });
  }, []);

  const close = useCallback(() => {
    setState(s => s.forced ? s : { isOpen: false, forced: false });
  }, []);

  return <Ctx.Provider value={{ open, close, state }}>{children}</Ctx.Provider>;
}

export function useUpgradeModal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUpgradeModal must be used inside UpgradeModalProvider");
  return ctx;
}
