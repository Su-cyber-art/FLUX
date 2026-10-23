import type { ReactNode } from "react";

import { Progress } from "@mantine/core";

import { uiColor, usageTone } from "@/components/ui/shared";

interface UsageBarProps {
  percent: number;
  unlimited?: boolean;
  label: string;
}

/** Quota bar: tone follows usage; unlimited quotas show a neutral full track. */
export function UsageBar({ percent, unlimited, label }: UsageBarProps) {
  return (
    <Progress
      aria-label={label}
      color={
        unlimited ? "var(--default-soft-hover)" : uiColor(usageTone(percent))
      }
      radius="xl"
      size={6}
      value={unlimited ? 100 : percent}
    />
  );
}

interface UsageMeterProps extends UsageBarProps {
  used: ReactNode;
  limit: ReactNode;
}

export function UsageMeter({ label, used, limit, ...bar }: UsageMeterProps) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="shrink-0 text-default-500">{label}</span>
        <span className="truncate tabular-nums text-default-500">
          <span className="font-medium text-foreground">{used}</span> / {limit}
        </span>
      </div>
      <UsageBar label={label} {...bar} />
    </div>
  );
}
