import type { ReactNode } from "react";

import { Group, Paper, Text } from "@mantine/core";

import { cn } from "@/lib/utils";
export interface StatCardProps {
  title: string;
  value: string | number;
  iconClassName?: string;
  icon: ReactNode;
  bottomContent?: ReactNode;
}
export function StatCard({
  title,
  value,
  iconClassName,
  icon,
  bottomContent,
}: StatCardProps) {
  return (
    <Paper withBorder className="flex min-w-0 flex-col" p="lg" radius="md">
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Text truncate c="dimmed" fw={500} size="sm">
          {title}
        </Text>
        <div
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-lg shrink-0",
            iconClassName,
          )}
        >
          {icon}
        </div>
      </Group>
      <Text
        truncate
        className="metric-value"
        fw={650}
        lh={1.25}
        mt={12}
        size="28px"
      >
        {value}
      </Text>
      {bottomContent && <div className="mt-auto pt-3">{bottomContent}</div>}
    </Paper>
  );
}
