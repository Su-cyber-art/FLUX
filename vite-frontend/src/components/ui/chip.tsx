import * as React from "react";
import { Badge } from "@mantine/core";

import { uiColor, uiVariant, type SemanticColor } from "./shared";
export interface ChipProps
  extends Omit<React.ComponentPropsWithoutRef<"span">, "color"> {
  color?: SemanticColor;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "flat" | "light" | "bordered";
}
export function Chip({
  color = "default",
  variant = "flat",
  size = "md",
  ...props
}: ChipProps) {
  return (
    <Badge
      component="span"
      {...props}
      color={uiColor(color)}
      fw={600}
      radius="sm"
      size={size}
      tt="none"
      variant={uiVariant(variant)}
    />
  );
}
