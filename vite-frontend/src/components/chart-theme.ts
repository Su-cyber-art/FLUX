import type { CSSProperties } from "react";

import { useComputedColorScheme, useMantineTheme } from "@mantine/core";

export type ChartSeriesColor = "blue" | "violet" | "orange" | "teal" | "red";

/**
 * Series colors from the Mantine palette, one shade lighter in dark mode so
 * lines keep their contrast on dark cards.
 */
export function useChartPalette(): Record<ChartSeriesColor, string> {
  const theme = useMantineTheme();
  const scheme = useComputedColorScheme("light");
  const shade = scheme === "dark" ? 4 : 6;

  return {
    blue: theme.colors.blue[shade],
    violet: theme.colors.violet[shade],
    orange: theme.colors.orange[shade],
    teal: theme.colors.teal[shade],
    red: theme.colors.red[shade],
  };
}

/** Recharts <Tooltip> styling that matches the app's glass surfaces. */
export const chartTooltipProps: {
  contentStyle: CSSProperties;
  labelStyle: CSSProperties;
  itemStyle: CSSProperties;
} = {
  contentStyle: {
    background: "var(--glass)",
    border: "1px solid var(--glass-border)",
    borderRadius: 10,
    boxShadow: "var(--elevation-2)",
    backdropFilter: "saturate(180%) blur(14px)",
    WebkitBackdropFilter: "saturate(180%) blur(14px)",
    padding: "8px 12px",
  },
  labelStyle: { color: "var(--default-500)", fontSize: 12, marginBottom: 4 },
  itemStyle: { fontSize: 12, padding: 0 },
};

/** Axis tick props; color comes from the surrounding `.chart-axis` text color. */
export const chartTick = { fill: "currentColor", fontSize: 11 } as const;
