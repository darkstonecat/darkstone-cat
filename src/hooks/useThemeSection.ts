import { useRef, useEffect } from "react";
import { useInView } from "motion/react";
import { useThemeStore } from "@/stores/useThemeStore";

interface ThemeSectionOptions {
  invertTexture?: boolean;
  externalRef?: React.RefObject<Element | null>;
}

export function useThemeSection<T extends Element = HTMLElement>(
  bg: string,
  text: string,
  optionsOrRef?: ThemeSectionOptions | React.RefObject<T | null>
) {
  const internalRef = useRef<T>(null);

  // Support both old signature (externalRef) and new options object
  const options: ThemeSectionOptions =
    optionsOrRef && "current" in optionsOrRef
      ? { externalRef: optionsOrRef }
      : optionsOrRef ?? {};

  const ref = (options.externalRef as React.RefObject<T | null>) ?? internalRef;
  const isInView = useInView(ref, { margin: "-50% 0px -50% 0px" });
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    if (isInView) {
      setTheme(bg, text, options.invertTexture);
    }
  }, [isInView, bg, text, options.invertTexture, setTheme]);

  return ref;
}
