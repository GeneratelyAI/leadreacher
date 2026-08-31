"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  createInitialDemoState,
  DEMO_STORAGE_KEY,
  demoReducer,
  readDemoState,
  writeDemoState,
  type DemoAction,
  type DemoOnboardingState,
} from "@/lib/onboarding/demo-store";

type DemoContextValue = {
  state: DemoOnboardingState;
  dispatch: Dispatch<DemoAction>;
  ready: boolean;
  reset: () => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoOnboardingProvider({
  children,
  defaultWebsite,
}: {
  children: ReactNode;
  defaultWebsite?: string;
}) {
  const [state, dispatch] = useReducer(demoReducer, defaultWebsite, (website) =>
    createInitialDemoState(website),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readDemoState(window.sessionStorage);
    if (stored) {
      dispatch({ type: "hydrate", state: stored });
    } else {
      writeDemoState(window.sessionStorage, state);
    }
    setReady(true);
    // State intentionally seeds storage once; subsequent changes persist below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) writeDemoState(window.sessionStorage, state);
  }, [ready, state]);

  const reset = useCallback(() => {
    window.sessionStorage.removeItem(DEMO_STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({ state, dispatch, ready, reset }), [ready, reset, state]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoOnboarding(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemoOnboarding must be used inside DemoOnboardingProvider");
  return context;
}
