"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import Lenis from "lenis";

const LenisContext = createContext<{
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => Lenis | null;
}>({
  subscribe: () => () => {},
  getSnapshot: () => null,
});

export function useLenis(): Lenis | null {
  const store = useContext(LenisContext);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
}

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const subscribersRef = useRef(new Set<() => void>());

  const subscribe = useCallback((cb: () => void) => {
    subscribersRef.current.add(cb);
    return () => {
      subscribersRef.current.delete(cb);
    };
  }, []);

  const getSnapshot = useCallback(() => lenisRef.current, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const instance = new Lenis({
      duration: prefersReduced ? 0 : 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: !prefersReduced,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    lenisRef.current = instance;
    subscribersRef.current.forEach((cb) => cb());

    function raf(time: number) {
      instance.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      instance.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <LenisContext.Provider value={{ subscribe, getSnapshot }}>
      {children}
    </LenisContext.Provider>
  );
}
