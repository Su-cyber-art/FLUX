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
import { Info } from "lucide-react";

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
    const lightShade = color === "yellow" ? 9 : 7;

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
          '"Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        fontFamilyMonospace:
          '"Geist Mono Variable", "SFMono-Regular", "Cascadia Code", Consolas, monospace',
        headings: { fontFamily: "inherit", fontWeight: "750" },
        radius: {
          xs: "6px",
          sm: "8px",
          md: "10px",
          lg: "14px",
          xl: "22px",
        },
        // Surfaces are separated by hairlines; shadows only lift floating layers.
        shadows: {
          xs: "0 1px 2px rgb(24 24 27 / 0.04)",
          sm: "0 1px 2px rgb(24 24 27 / 0.05)",
          md: "0 1px 2px rgb(24 24 27 / 0.05), 0 8px 20px -8px rgb(24 24 27 / 0.12)",
          lg: "0 2px 6px -2px rgb(24 24 27 / 0.08), 0 16px 36px -10px rgb(24 24 27 / 0.16)",
          xl: "0 2px 6px -2px rgb(24 24 27 / 0.08), 0 20px 48px -12px rgb(24 24 27 / 0.2)",
        },
        // Neutral ramps shared with the --default-* tokens in styles/globals.css.
        colors: {
          gray: [
            "#fafafa",
            "#f4f4f5",
            "#ececee",
            "#e4e4e7",
            "#d4d4d8",
            "#a1a1aa",
            "#71717a",
            "#52525b",
            "#3f3f46",
            "#18181b",
          ],
          dark: [
            "#e4e4e7",
            "#b0b0b8",
            "#8e8e98",
            "#5a5a62",
            "#3a3a3f",
            "#2c2c30",
            "#242427",
            "#1c1c1f",
            "#121214",
            "#09090b",
          ],
          // Accent and status ramps tuned to the tray-and-card palette.
          blue: [
            "#eff6ff",
            "#dbeafe",
            "#bfdbfe",
            "#93c5fd",
            "#60a5fa",
            "#3b82f6",
            "#2563eb",
            "#1d4ed8",
            "#1e40af",
            "#1e3a8a",
          ],
          violet: [
            "#f5f3ff",
            "#ede9fe",
            "#ddd6fe",
            "#c4b5fd",
            "#a78bfa",
            "#8b5cf6",
            "#7c3aed",
            "#6d28d9",
            "#5b21b6",
            "#4c1d95",
          ],
          teal: [
            "#ecfdf5",
            "#d1fae5",
            "#a7f3d0",
            "#6ee7b7",
            "#34d399",
            "#10b981",
            "#059669",
            "#047857",
            "#065f46",
            "#064e3b",
          ],
          orange: [
            "#fff7ed",
            "#ffedd5",
            "#fed7aa",
            "#fdba74",
            "#fb923c",
            "#f97316",
            "#ea580c",
            "#c2410c",
            "#9a3412",
            "#7c2d12",
          ],
          red: [
            "#fef2f2",
            "#fee2e2",
            "#fecaca",
            "#fca5a5",
            "#f87171",
            "#ef4444",
            "#dc2626",
            "#b91c1c",
            "#991b1b",
            "#7f1d1d",
          ],
          cyan: [
            "#ecfeff",
            "#cffafe",
            "#a5f3fc",
            "#67e8f9",
            "#22d3ee",
            "#06b6d4",
            "#0891b2",
            "#0e7490",
            "#155e75",
            "#164e63",
          ],
        },
        components: {
          // Explicit variant so `[data-variant="filled"]` styles apply to default buttons.
          Button: {
            defaultProps: { radius: "md", size: "sm", variant: "filled" },
            styles: { label: { fontWeight: 600 } },
          },
          ActionIcon: { defaultProps: { radius: "md" } },
          Input: { defaultProps: { radius: "md" } },
          Menu: {
            defaultProps: {
              zIndex: 450,
              radius: "md",
              shadow: "lg",
              transitionProps: { transition: "pop", duration: 160 },
            },
          },
          Popover: {
            defaultProps: {
              zIndex: 450,
              radius: "md",
              shadow: "lg",
              transitionProps: { transition: "pop", duration: 160 },
            },
          },
          Combobox: {
            defaultProps: {
              shadow: "lg",
              // Above modals (z-index 300); flip/shift keep long lists on screen.
              zIndex: 450,
              middlewares: { flip: true, shift: { padding: 12 } },
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
            defaultProps: { radius: "xl", size: "sm", transitionDuration: 600 },
          },
          Notification: { defaultProps: { radius: "lg" } },
          Alert: { defaultProps: { icon: <Info size={18} /> } },
          Badge: {
            defaultProps: { radius: "sm", fw: 600, tt: "none" },
          },
          Select: {
            defaultProps: {
              allowDeselect: false,
              nothingFoundMessage: "没有匹配项",
            },
          },
          MultiSelect: {
            defaultProps: {
              clearable: true,
              clearButtonProps: { "aria-label": "清除选择" },
              nothingFoundMessage: "没有匹配项",
            },
          },
          Table: {
            defaultProps: {
              highlightOnHover: true,
              horizontalSpacing: "md",
              verticalSpacing: "sm",
            },
          },
          DateInput: {
            defaultProps: {
              clearable: true,
              placeholder: "选择日期",
              valueFormat: "YYYY-MM-DD",
            },
          },
          Textarea: {
            defaultProps: { autosize: true, minRows: 3, maxRows: 8 },
          },
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
