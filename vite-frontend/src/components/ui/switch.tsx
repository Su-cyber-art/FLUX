import * as React from "react";
import { Switch as MantineSwitch } from "@mantine/core";

import { uiColor } from "./shared";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "color"> {
  classNames?: Record<string, string>;
  color?: string;
  size?: string;
  isDisabled?: boolean;
  isSelected?: boolean;
  onValueChange?: (value: boolean) => void;
}
export function Switch({
  children,
  isSelected,
  checked,
  isDisabled,
  disabled,
  onValueChange,
  onChange,
  classNames: _classNames,
  color,
  size = "sm",
  ...props
}: SwitchProps) {
  return (
    <MantineSwitch
      {...props}
      checked={isSelected ?? checked ?? false}
      color={uiColor(color)}
      disabled={isDisabled || disabled}
      label={children}
      size={size}
      onChange={(event) => {
        onChange?.(event);
        onValueChange?.(event.currentTarget.checked);
      }}
    />
  );
}
