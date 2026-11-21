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

/** Recharts <Tooltip> styling: a solid card surface with a hairline. */
export const chartTooltipProps: {
  contentStyle: CSSProperties;
  labelStyle: CSSProperties;
  itemStyle: CSSProperties;
  cursor: { stroke: string; strokeWidth: number };
} = {
  contentStyle: {
    background: "var(--content1)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    boxShadow: "var(--elevation-2)",
    padding: "6px 10px",
    fontSize: 12,
  },
  labelStyle: { color: "var(--default-500)", fontSize: 11.5, marginBottom: 2 },
  itemStyle: { fontSize: 12, padding: 0, fontVariantNumeric: "tabular-nums" },
  cursor: { stroke: "var(--border-strong)", strokeWidth: 1 },
};

/** Axis tick props; color comes from the surrounding `.chart-axis` text color. */
export const chartTick = { fill: "currentColor", fontSize: 11 } as const;

/** Quiet axes: no axis line or tick marks, small muted labels. */
export const chartAxisProps = {
  axisLine: false,
  tickLine: false,
  tick: chartTick,
  tickMargin: 8,
} as const;

/** Horizontal-only hairline grid (stroke color comes from components.css). */
export const chartGridProps = {
  strokeDasharray: "2 4",
  vertical: false,
} as const;

/** Thin series line without dots; a small active dot on hover. */
export const chartLineProps = {
  dot: false,
  strokeWidth: 1.5,
  type: "monotone",
  activeDot: { r: 3, strokeWidth: 0 },
  isAnimationActive: false,
} as const;
