import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { type SemanticColor } from "@/components/ui/shared";

export { UsageBar, UsageMeter } from "@/components/usage-meter";

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
    <Card className="stat-tile">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile size="sm" tone={tone}>
            <Icon size={16} />
          </IconTile>
          <span className="truncate text-[13px] font-semibold text-default-600">
            {title}
          </span>
        </div>
        {badge}
      </div>
      <div className="mt-3 flex min-w-0 items-baseline gap-1.5">
        <span className="metric-value truncate text-[24px] leading-tight text-foreground">
          {value}
        </span>
        {suffix && (
          <span className="truncate text-[13px] font-medium text-default-500">
            {suffix}
          </span>
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
