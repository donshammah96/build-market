import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface AccessibilitySettings {
  // Motion & Animation
  reduceMotion: "system" | "on" | "off";
  reduceTransparency: boolean;

  // Visual
  highContrast: boolean;
  largeText: boolean;
  fontSize: number; // percentage: 100 = normal, 125 = 25% larger

  // Focus & Navigation
  enhancedFocus: boolean;
  keyboardShortcuts: boolean;

  // Color
  colorBlindMode: "none" | "protanopia" | "deuteranopia" | "tritanopia";

  // Reading
  dyslexiaFont: boolean;
  lineSpacing: "normal" | "relaxed" | "loose";
}

interface AccessibilityState extends AccessibilitySettings {
  // Actions
  setReduceMotion: (value: "system" | "on" | "off") => void;
  setReduceTransparency: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
  setLargeText: (value: boolean) => void;
  setFontSize: (value: number) => void;
  setEnhancedFocus: (value: boolean) => void;
  setKeyboardShortcuts: (value: boolean) => void;
  setColorBlindMode: (
    value: "none" | "protanopia" | "deuteranopia" | "tritanopia",
  ) => void;
  setDyslexiaFont: (value: boolean) => void;
  setLineSpacing: (value: "normal" | "relaxed" | "loose") => void;
  resetToDefaults: () => void;

  // Computed
  shouldReduceMotion: () => boolean;
}

const defaultSettings: AccessibilitySettings = {
  reduceMotion: "system",
  reduceTransparency: false,
  highContrast: false,
  largeText: false,
  fontSize: 100,
  enhancedFocus: false,
  keyboardShortcuts: true,
  colorBlindMode: "none",
  dyslexiaFont: false,
  lineSpacing: "normal",
};

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      setReduceMotion: (value) => set({ reduceMotion: value }),
      setReduceTransparency: (value) => set({ reduceTransparency: value }),
      setHighContrast: (value) => set({ highContrast: value }),
      setLargeText: (value) => set({ largeText: value }),
      setFontSize: (value) => set({ fontSize: value }),
      setEnhancedFocus: (value) => set({ enhancedFocus: value }),
      setKeyboardShortcuts: (value) => set({ keyboardShortcuts: value }),
      setColorBlindMode: (value) => set({ colorBlindMode: value }),
      setDyslexiaFont: (value) => set({ dyslexiaFont: value }),
      setLineSpacing: (value) => set({ lineSpacing: value }),

      resetToDefaults: () => set(defaultSettings),

      shouldReduceMotion: () => {
        const { reduceMotion } = get();
        if (reduceMotion === "on") return true;
        if (reduceMotion === "off") return false;
        // System preference - check media query
        if (typeof window !== "undefined") {
          return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        }
        return false;
      },
    }),
    {
      name: "accessibility-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        reduceMotion: state.reduceMotion,
        reduceTransparency: state.reduceTransparency,
        highContrast: state.highContrast,
        largeText: state.largeText,
        fontSize: state.fontSize,
        enhancedFocus: state.enhancedFocus,
        keyboardShortcuts: state.keyboardShortcuts,
        colorBlindMode: state.colorBlindMode,
        dyslexiaFont: state.dyslexiaFont,
        lineSpacing: state.lineSpacing,
      }),
    },
  ),
);

// Selector hooks for better performance (prevents unnecessary re-renders)
export const useReduceMotion = () =>
  useAccessibilityStore((state) => state.reduceMotion);
export const useHighContrast = () =>
  useAccessibilityStore((state) => state.highContrast);
export const useFontSize = () =>
  useAccessibilityStore((state) => state.fontSize);
export const useEnhancedFocus = () =>
  useAccessibilityStore((state) => state.enhancedFocus);
export const useColorBlindMode = () =>
  useAccessibilityStore((state) => state.colorBlindMode);
export const useDyslexiaFont = () =>
  useAccessibilityStore((state) => state.dyslexiaFont);
export const useLineSpacing = () =>
  useAccessibilityStore((state) => state.lineSpacing);
