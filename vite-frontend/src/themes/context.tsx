import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
  createTheme,
  MantineProvider,
  type CSSVariablesResolver,
} from "@mantine/core";

export type ThemeMode = "light" | "dark" | "system";
export const ACCENTS = [
  { value: "blue", label: "海蓝" },
  { value: "indigo", label: "靛青" },
  { value: "teal", label: "青绿" },
  { value: "violet", label: "紫罗兰" },
  { value: "grape", label: "葡萄紫" },
] as const;
export type Accent = (typeof ACCENTS)[number]["value"];
interface ThemeState {
  mode: ThemeMode;
  effectiveMode: "light" | "dark";
  accent: Accent;
  /** Pass the triggering pointer position to reveal the new scheme from it. */
  setMode: (mode: ThemeMode, origin?: { x: number; y: number }) => void;
  setAccent: (accent: Accent) => void;
}
const ThemeContext = createContext<ThemeState | null>(null);
// Light-variant text (Badge, ThemeIcon, light Button) uses the same shades as
// the --*-ink tone tokens in styles/globals.css, so tinted UI stays readable.
const cssVariablesResolver: CSSVariablesResolver = (theme) => {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};

  Object.keys(theme.colors).forEach((color) => {
    if (color === "dark") return;
    const lightShade = color === "gray" ? 7 : color === "yellow" ? 9 : 8;

    light[`--mantine-color-${color}-light-color`] =
      `var(--mantine-color-${color}-${lightShade})`;
    dark[`--mantine-color-${color}-light-color`] =
      `var(--mantine-color-${color}-3)`;
  });

  return { variables: {}, light, dark };
};
const readMode = (): ThemeMode => {
  const value = localStorage.getItem("flvx:theme");

  return value === "light" || value === "dark" ? value : "system";
};
const readAccent = (): Accent => {
  const value = localStorage.getItem("flvx:accent");

  return ACCENTS.some((item) => item.value === value)
    ? (value as Accent)
    : "blue";
};
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

/**
 * Runs a color-scheme change inside a View Transition so the new scheme grows
 * as a circle from the origin. Browsers without the API just switch instantly.
 */
function revealSchemeChange(
  update: () => void,
  origin?: { x: number; y: number },
) {
  const doc = document as ViewTransitionDocument;

  if (!doc.startViewTransition || prefersReducedMotion()) {
    update();

    return;
  }
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? 0;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  const transition = doc.startViewTransition(() => flushSync(update));

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 520,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {});
}

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
  // Layout effect so the class flips inside the same frame a view transition captures.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", effectiveMode === "dark");
    document.documentElement.style.colorScheme = effectiveMode;
  }, [effectiveMode]);
  const theme = useMemo(
    () =>
      createTheme({
        primaryColor: accent,
        primaryShade: { light: 6, dark: 5 },
        defaultRadius: "md",
        cursorType: "pointer",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        fontFamilyMonospace:
          '"JetBrains Mono", "SFMono-Regular", "Cascadia Code", Consolas, monospace',
        headings: { fontFamily: "inherit", fontWeight: "650" },
        radius: {
          xs: "6px",
          sm: "8px",
          md: "10px",
          lg: "14px",
          xl: "20px",
        },
        // Layered, low-opacity shadows read as soft elevation in both schemes.
        shadows: {
          xs: "0 1px 2px rgb(15 23 42 / 0.05)",
          sm: "0 1px 2px rgb(15 23 42 / 0.04), 0 2px 6px -1px rgb(15 23 42 / 0.06)",
          md: "0 2px 4px -1px rgb(15 23 42 / 0.05), 0 8px 20px -4px rgb(15 23 42 / 0.1)",
          lg: "0 4px 8px -2px rgb(15 23 42 / 0.06), 0 16px 36px -8px rgb(15 23 42 / 0.16)",
          xl: "0 8px 16px -4px rgb(15 23 42 / 0.08), 0 28px 60px -12px rgb(15 23 42 / 0.25)",
        },
        colors: {
          dark: [
            "#cbd5e1",
            "#a6b3c5",
            "#8190a7",
            "#4d5b73",
            "#2e3b52",
            "#222e42",
            "#182335",
            "#111a29",
            "#0a111e",
            "#070c16",
          ],
        },
        components: {
          Button: { defaultProps: { radius: "md", size: "sm" } },
          ActionIcon: { defaultProps: { radius: "md" } },
          Input: { defaultProps: { radius: "md" } },
          Menu: {
            defaultProps: {
              radius: "md",
              shadow: "lg",
              transitionProps: { transition: "pop", duration: 160 },
            },
          },
          Popover: {
            defaultProps: {
              radius: "md",
              shadow: "lg",
              transitionProps: { transition: "pop", duration: 160 },
            },
          },
          Combobox: {
            defaultProps: {
              shadow: "lg",
              transitionProps: { transition: "pop", duration: 140 },
            },
          },
          HoverCard: {
            defaultProps: {
              shadow: "lg",
              transitionProps: { transition: "pop", duration: 160 },
            },
          },
          Modal: { defaultProps: { radius: "lg" } },
          Drawer: {
            defaultProps: {
              overlayProps: { backgroundOpacity: 0.35, blur: 3 },
              transitionProps: { duration: 260 },
            },
          },
          Tooltip: {
            defaultProps: {
              withArrow: true,
              arrowSize: 6,
              openDelay: 80,
              transitionProps: { transition: "pop", duration: 140 },
            },
          },
          SegmentedControl: {
            defaultProps: { transitionDuration: 260 },
          },
          Progress: {
            defaultProps: { transitionDuration: 600 },
          },
          Notification: { defaultProps: { radius: "lg" } },
        },
      }),
    [accent],
  );
  const value: ThemeState = {
    mode,
    effectiveMode,
    accent,
    setMode: (next, origin) => {
      localStorage.setItem("flvx:theme", next);
      const nextEffective =
        next === "system" ? (systemDark ? "dark" : "light") : next;

      if (nextEffective === effectiveMode) updateMode(next);
      else revealSchemeChange(() => updateMode(next), origin);
    },
    setAccent: (next) => {
      localStorage.setItem("flvx:accent", next);
      updateAccent(next);
    },
  };

  return (
    <ThemeContext.Provider value={value}>
      <MantineProvider
        cssVariablesResolver={cssVariablesResolver}
        forceColorScheme={effectiveMode}
        theme={theme}
      >
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
