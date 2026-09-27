import * as React from "react";
import { Checkbox as MantineCheckbox } from "@mantine/core";

import { uiColor } from "./shared";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "color"> {
  classNames?: Record<string, string>;
  color?: string;
  size?: string;
  isDisabled?: boolean;
  isIndeterminate?: boolean;
  isSelected?: boolean;
  onValueChange?: (value: boolean) => void;
}
export function Checkbox({
  children,
  isSelected,
  checked,
  isIndeterminate,
  isDisabled,
  disabled,
  onValueChange,
  onChange,
  classNames: _classNames,
  color,
  size = "sm",
  ...props
}: CheckboxProps) {
  return (
    <MantineCheckbox
      {...props}
      checked={isSelected ?? checked ?? false}
      color={uiColor(color)}
      disabled={isDisabled || disabled}
      indeterminate={isIndeterminate}
      label={children}
      size={size}
      onChange={(event) => {
        onChange?.(event);
        onValueChange?.(event.currentTarget.checked);
      }}
    />
  );
}
