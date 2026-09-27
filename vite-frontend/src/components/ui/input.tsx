import * as React from "react";
import { TextInput, Textarea as MantineTextarea } from "@mantine/core";

import { type FieldMetaProps } from "./shared";

import { cn } from "@/lib/utils";

type Slots = {
  base?: string;
  input?: string;
  inputWrapper?: string;
  label?: string;
  description?: string;
  errorMessage?: string;
};
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    FieldMetaProps {
  classNames?: Slots;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  isDisabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: string;
}
export function Input({
  classNames,
  className,
  errorMessage,
  isInvalid,
  isRequired,
  isDisabled,
  disabled,
  variant: _variant,
  startContent,
  endContent,
  size = "sm",
  ...props
}: InputProps) {
  return (
    <TextInput
      {...props}
      className={classNames?.base}
      classNames={{
        input: cn(classNames?.input, className),
        label: classNames?.label,
        description: classNames?.description,
        error: classNames?.errorMessage,
      }}
      disabled={disabled || isDisabled}
      error={isInvalid ? errorMessage || true : undefined}
      leftSection={startContent}
      required={isRequired || props.required}
      rightSection={endContent}
      size={size}
    />
  );
}
export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    FieldMetaProps {
  classNames?: Slots;
  isDisabled?: boolean;
  minRows?: number;
  maxRows?: number;
  size?: "sm" | "md" | "lg";
  variant?: string;
}
export function Textarea({
  classNames,
  errorMessage,
  isInvalid,
  isRequired,
  isDisabled,
  disabled,
  variant: _variant,
  minRows = 3,
  maxRows = 8,
  ...props
}: TextareaProps) {
  return (
    <MantineTextarea
      {...props}
      autosize
      classNames={{ root: classNames?.base, input: classNames?.input }}
      disabled={disabled || isDisabled}
      error={isInvalid ? errorMessage || true : undefined}
      maxRows={maxRows}
      minRows={minRows}
      required={isRequired || props.required}
    />
  );
}
