import type { ReactNode } from "react";

import { Group, Paper, Text } from "@mantine/core";

import { IconTile } from "@/components/ui/icon-tile";
import { type SemanticColor } from "@/components/ui/shared";
export interface StatCardProps {
  title: string;
  value: string | number;
  tone?: SemanticColor;
  icon: ReactNode;
  bottomContent?: ReactNode;
}
export function StatCard({
  title,
  value,
  tone = "primary",
  icon,
  bottomContent,
}: StatCardProps) {
  return (
    <Paper withBorder className="flex min-w-0 flex-col" p="lg" radius="md">
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Text truncate c="dimmed" fw={500} size="sm">
          {title}
        </Text>
        <IconTile size="sm" tone={tone}>
          {icon}
        </IconTile>
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
