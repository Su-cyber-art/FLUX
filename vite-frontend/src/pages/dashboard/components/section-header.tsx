import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Chip } from "@/components/ui/chip";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  count?: number;
  actions?: ReactNode;
}

export function SectionHeader({
  icon: Icon,
  title,
  description,
  count,
  actions,
}: SectionHeaderProps) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon className="mt-0.5 shrink-0 text-primary" size={18} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {count !== undefined && <Chip size="sm">{count}</Chip>}
          </div>
          {description && (
            <p className="mt-1 text-xs text-default-500">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
