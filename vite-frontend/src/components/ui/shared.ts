export type SemanticColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info";
// Keep in sync with the --*-ink tone tokens in styles/globals.css.
export const uiColor = (color?: string) =>
  ({
    default: "gray",
    primary: undefined,
    secondary: "violet",
    success: "teal",
    warning: "orange",
    danger: "red",
    info: "cyan",
  })[color as SemanticColor] ?? (color === "primary" ? undefined : color);
/** Tone for a usage percentage: warning from 70%, danger from 90%. */
export const usageTone = (percent: number): SemanticColor => {
  if (percent >= 90) return "danger";
  if (percent >= 70) return "warning";

  return "primary";
};
