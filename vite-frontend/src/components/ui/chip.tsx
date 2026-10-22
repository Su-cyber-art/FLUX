import * as React from "react";
import { Badge } from "@mantine/core";

import { uiColor, uiVariant, type SemanticColor } from "./shared";
export interface ChipProps
  extends Omit<React.ComponentPropsWithoutRef<"span">, "color"> {
  color?: SemanticColor;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "solid" | "flat" | "light" | "bordered";
  /** Leading status dot in the chip's color. */
  dot?: boolean;
  startContent?: React.ReactNode;
}
export function Chip({
  color = "default",
  variant = "flat",
  size = "md",
  dot,
  startContent,
  ...props
}: ChipProps) {
  return (
    <Badge
      component="span"
      {...props}
      color={uiColor(color)}
      fw={600}
      leftSection={
        dot ? (
          <span className="block h-1.5 w-1.5 rounded-full bg-current" />
        ) : (
          startContent
        )
      }
      radius="sm"
      size={size}
      tt="none"
      variant={uiVariant(variant)}
    />
  );
}
