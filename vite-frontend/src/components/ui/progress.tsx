import * as React from "react";
import { Progress as MantineProgress, Group, Text } from "@mantine/core";

import { uiColor, type SemanticColor } from "./shared";
export interface ProgressProps {
  "aria-label"?: string;
  className?: string;
  color?: SemanticColor;
  label?: React.ReactNode;
  showValueLabel?: boolean;
  size?: "sm" | "md" | "lg";
  value?: number;
}
export function Progress({
  value = 0,
  label,
  showValueLabel,
  className,
  color = "primary",
  size = "sm",
  ...props
}: ProgressProps) {
  const percent = Math.max(
    0,
    Math.min(100, Number.isFinite(value) ? value : 0),
  );

  return (
    <div className={className}>
      {(label || showValueLabel) && (
        <Group justify="space-between" mb={4}>
          <Text c="dimmed" size="xs">
            {label}
          </Text>
          {showValueLabel && (
            <Text c="dimmed" size="xs">
              {Math.round(percent)}%
            </Text>
          )}
        </Group>
      )}
      <MantineProgress
        {...props}
        color={uiColor(color)}
        radius="xl"
        size={size}
        value={percent}
      />
    </div>
  );
}
