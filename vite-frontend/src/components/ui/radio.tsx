import * as React from "react";
import { Radio as MantineRadio, Group, Stack } from "@mantine/core";
export interface RadioGroupProps {
  children: React.ReactNode;
  label?: React.ReactNode;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  value?: string;
}
export function RadioGroup({
  children,
  label,
  onValueChange,
  orientation,
  value,
}: RadioGroupProps) {
  return (
    <MantineRadio.Group label={label} value={value} onChange={onValueChange}>
      {orientation === "horizontal" ? (
        <Group mt="xs">{children}</Group>
      ) : (
        <Stack gap="sm" mt="xs">
          {children}
        </Stack>
      )}
    </MantineRadio.Group>
  );
}
export function Radio({
  children,
  value,
}: {
  children?: React.ReactNode;
  value: string;
}) {
  return <MantineRadio label={children} value={value} />;
}
