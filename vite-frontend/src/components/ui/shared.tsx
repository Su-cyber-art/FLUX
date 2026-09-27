import * as React from "react";

export type SemanticColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger";
export const uiColor = (color?: string) =>
  ({
    default: "gray",
    primary: undefined,
    secondary: "violet",
    success: "teal",
    warning: "orange",
    danger: "red",
  })[color as SemanticColor] ?? (color === "primary" ? undefined : color);
export const uiVariant = (variant?: string) =>
  ({
    solid: "filled",
    flat: "light",
    light: "subtle",
    ghost: "subtle",
    bordered: "outline",
    shadow: "filled",
    faded: "light",
  })[variant as string] ?? variant;
export interface FieldMetaProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  isInvalid?: boolean;
  isRequired?: boolean;
}
export function extractText(content: React.ReactNode): string {
  if (typeof content === "string" || typeof content === "number")
    return String(content);
  if (Array.isArray(content)) return content.map(extractText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(content))
    return extractText(content.props.children);

  return "";
}
