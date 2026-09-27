import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createTheme, MantineProvider } from "@mantine/core";

export type ThemeMode = "light" | "dark" | "system";
export const ACCENTS = [
  { value: "blue", label: "海蓝" },
  { value: "teal", label: "青绿" },
  { value: "violet", label: "紫罗兰" },
] as const;
export type Accent = (typeof ACCENTS)[number]["value"];
interface ThemeState {
  mode: ThemeMode;
  effectiveMode: "light" | "dark";
  accent: Accent;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: Accent) => void;
}
const ThemeContext = createContext<ThemeState | null>(null);
const readMode = (): ThemeMode => {
  const value = localStorage.getItem("flvx:theme");

  return value === "light" || value === "dark" ? value : "system";
};
const readAccent = (): Accent => {
  const value = localStorage.getItem("flvx:accent");

  return value === "teal" || value === "violet" ? value : "blue";
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, updateMode] = useState<ThemeMode>(readMode);
  const [accent, updateAccent] = useState<Accent>(readAccent);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const effectiveMode =
    mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => setSystemDark(media.matches);
    const syncStorage = (event: StorageEvent) => {
      if (event.key === "flvx:theme") updateMode(readMode());
      if (event.key === "flvx:accent") updateAccent(readAccent());
    };

    media.addEventListener("change", syncSystem);
    window.addEventListener("storage", syncStorage);

    return () => {
      media.removeEventListener("change", syncSystem);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", effectiveMode === "dark");
    document.documentElement.style.colorScheme = effectiveMode;
  }, [effectiveMode]);
  const theme = useMemo(
    () =>
      createTheme({
        primaryColor: accent,
        primaryShade: { light: 6, dark: 5 },
        defaultRadius: "md",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontFamilyMonospace: '"SFMono-Regular", Consolas, monospace',
        headings: { fontFamily: "inherit", fontWeight: "650" },
        colors: {
          dark: [
            "#cbd5e1",
            "#a6b3c5",
            "#8595aa",
            "#526176",
            "#354155",
            "#263246",
            "#1b2638",
            "#151f2e",
            "#101927",
            "#0c1320",
          ],
        },
        components: {
          Button: { defaultProps: { radius: "md", size: "sm" } },
          ActionIcon: { defaultProps: { radius: "md" } },
          Input: { defaultProps: { radius: "md" } },
          Menu: { defaultProps: { radius: "md" } },
          Modal: { defaultProps: { radius: "lg" } },
          Tooltip: { defaultProps: { withArrow: true } },
        },
      }),
    [accent],
  );
  const value: ThemeState = {
    mode,
    effectiveMode,
    accent,
    setMode: (next) => {
      localStorage.setItem("flvx:theme", next);
      updateMode(next);
    },
    setAccent: (next) => {
      localStorage.setItem("flvx:accent", next);
      updateAccent(next);
    },
  };

  return (
    <ThemeContext.Provider value={value}>
      <MantineProvider forceColorScheme={effectiveMode} theme={theme}>
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
}
export function useThemeContext() {
  const context = useContext(ThemeContext);

  if (!context) throw new Error("ThemeProvider is required");

  return context;
}
