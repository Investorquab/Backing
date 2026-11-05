"use client";
import { createContext, useCallback, useContext, useState } from "react";

/** App-wide UI: the composer and the back dialog can be opened from anywhere. */
type BackTarget = { creator: `0x${string}` } | null;
type Ctx = {
  composeOpen: boolean;
  openCompose: () => void;
  closeCompose: () => void;
  backTarget: BackTarget;
  openBack: (t: NonNullable<BackTarget>) => void;
  closeBack: () => void;
};
const UiCtx = createContext<Ctx>({
  composeOpen: false,
  openCompose: () => {},
  closeCompose: () => {},
  backTarget: null,
  openBack: () => {},
  closeBack: () => {},
});

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [composeOpen, setCompose] = useState(false);
  const [backTarget, setBack] = useState<BackTarget>(null);
  return (
    <UiCtx.Provider
      value={{
        composeOpen,
        openCompose: useCallback(() => setCompose(true), []),
        closeCompose: useCallback(() => setCompose(false), []),
        backTarget,
        openBack: useCallback((t) => setBack(t), []),
        closeBack: useCallback(() => setBack(null), []),
      }}
    >
      {children}
    </UiCtx.Provider>
  );
}

export const useUi = () => useContext(UiCtx);
