import { create } from "zustand";

interface ThemeState {
  backgroundColor: string;
  textColor: string;
  invertTexture: boolean;
  setTheme: (bg: string, text: string, invertTexture?: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  backgroundColor: "#EEE8DC",
  textColor: "#1c1917",
  invertTexture: false,
  setTheme: (bg, text, invertTexture = false) =>
    set({ backgroundColor: bg, textColor: text, invertTexture }),
}));
