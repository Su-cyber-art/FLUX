import * as React from "react";
import { Anchor } from "@mantine/core";
export interface LinkProps
  extends Omit<React.ComponentPropsWithoutRef<"a">, "color"> {
  color?: "default" | "foreground" | "primary";
}
export function Link({ color = "primary", ...props }: LinkProps) {
  return (
    <Anchor
      {...props}
      c={
        color === "foreground"
          ? "var(--foreground)"
          : color === "default"
            ? "dimmed"
            : undefined
      }
      underline="hover"
    />
  );
}
