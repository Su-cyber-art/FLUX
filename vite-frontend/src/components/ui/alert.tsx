import * as React from "react";
import { Alert as MantineAlert } from "@mantine/core";
import { Info } from "lucide-react";

import { uiColor, uiVariant, type SemanticColor } from "./shared";
interface AlertProps
  extends Omit<React.ComponentProps<"div">, "color" | "title"> {
  color?: SemanticColor;
  description?: React.ReactNode;
  title?: React.ReactNode;
  variant?: "solid" | "flat" | "faded" | "bordered";
}
export function Alert({
  children,
  color = "primary",
  description,
  title,
  variant = "flat",
  ...props
}: AlertProps) {
  return (
    <MantineAlert
      {...props}
      color={uiColor(color)}
      icon={<Info size={18} />}
      title={title}
      variant={uiVariant(variant)}
    >
      {description ?? children}
    </MantineAlert>
  );
}
