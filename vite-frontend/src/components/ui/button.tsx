import * as React from "react";
import { ActionIcon, Button as MantineButton } from "@mantine/core";

import { uiColor, uiVariant, type SemanticColor } from "./shared";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  color?: SemanticColor;
  variant?: "solid" | "light" | "flat" | "ghost" | "bordered" | "shadow";
  size?: "sm" | "md" | "lg";
  isIconOnly?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  onPress?: React.MouseEventHandler<HTMLButtonElement>;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      color = "default",
      variant = "solid",
      size = "md",
      isIconOnly,
      isLoading,
      isDisabled,
      disabled,
      startContent,
      endContent,
      onPress,
      onClick,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    const common = {
      ...props,
      ref,
      type,
      color: uiColor(color),
      variant:
        color === "default" && variant === "solid"
          ? "default"
          : uiVariant(variant),
      disabled: disabled || isDisabled,
      loading: isLoading,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        onPress?.(event);
      },
    };

    if (isIconOnly)
      return (
        <ActionIcon
          {...common}
          aria-label={props["aria-label"] || props.title || "更多操作"}
          size={size === "sm" ? 30 : size === "lg" ? 42 : 36}
        >
          {children}
        </ActionIcon>
      );

    return (
      <MantineButton
        {...common}
        leftSection={startContent}
        rightSection={endContent}
        size={size === "sm" ? "xs" : size === "lg" ? "md" : "sm"}
      >
        {children}
      </MantineButton>
    );
  },
);
