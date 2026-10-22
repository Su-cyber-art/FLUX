import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Progress } from "@mantine/core";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { uiColor, type SemanticColor } from "@/components/ui/shared";
import { usageTone } from "@/pages/dashboard/format";

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

interface QuotaCardProps {
  icon: LucideIcon;
  tone: SemanticColor;
  title: string;
  value: ReactNode;
  suffix?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export function QuotaCard({
  icon: Icon,
  tone,
  title,
  value,
  suffix,
  badge,
  children,
  footer,
}: QuotaCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile size="sm" tone={tone}>
            <Icon size={16} />
          </IconTile>
          <span className="truncate text-sm font-medium text-default-600">
            {title}
          </span>
        </div>
        {badge}
      </div>
      <div className="mt-4 flex min-w-0 items-baseline gap-1.5">
        <span className="metric-value truncate text-[26px] font-semibold leading-tight text-foreground">
          {value}
        </span>
        {suffix && (
          <span className="truncate text-sm text-default-500">{suffix}</span>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
      {footer && (
        <div className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-default-500">
          {footer}
        </div>
      )}
    </Card>
  );
}
