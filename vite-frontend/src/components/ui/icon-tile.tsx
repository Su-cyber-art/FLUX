import * as React from "react";
import { ThemeIcon } from "@mantine/core";

import { uiColor, type SemanticColor } from "./shared";
export interface IconTileProps {
  children: React.ReactNode;
  className?: string;
  tone?: SemanticColor;
  size?: "sm" | "md" | "lg";
  round?: boolean;
}
/** Tinted square (or circle) holding a lucide icon; replaces ad-hoc bg-x-100 icon wrappers. */
export function IconTile({
  children,
  className,
  tone = "primary",
  size = "md",
  round,
}: IconTileProps) {
  return (
    <ThemeIcon
      aria-hidden
      className={className}
      color={uiColor(tone)}
      radius={round ? "xl" : "md"}
      size={{ sm: 28, md: 36, lg: 40 }[size]}
      variant="light"
    >
      {children}
    </ThemeIcon>
  );
}
