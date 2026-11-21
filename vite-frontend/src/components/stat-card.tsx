import type { ReactNode } from "react";

import { type SemanticColor } from "@/components/ui/shared";
import { cn } from "@/lib/utils";

/* ─── KPI strip ──────────────────────────────────────────────────────
 * One bordered surface split into cells by hairlines. The strip is its own
 * size container, so the column count follows the space it actually gets
 * (sidebar open or not) rather than the viewport. Styles: `.kpi-*` in
 * styles/pages/monitor.css.
 */

const STRIP_COLUMNS = {
  2: "grid-cols-1 @md:grid-cols-2",
  3: "grid-cols-1 @xl:grid-cols-3",
  4: "grid-cols-2 @3xl:grid-cols-4",
  6: "grid-cols-2 @xl:grid-cols-3 @5xl:grid-cols-6",
} as const;

export function KpiStrip({
  columns = 4,
  className,
  children,
  label,
}: {
  columns?: keyof typeof STRIP_COLUMNS;
  className?: string;
  children: ReactNode;
  /** Accessible name for the group of metrics. */
  label?: string;
}) {
  return (
    <div className={cn("@container min-w-0", className)}>
      <div
        aria-label={label}
        className={cn("kpi-strip grid", STRIP_COLUMNS[columns])}
        role={label ? "group" : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export interface KpiCellProps {
  label: ReactNode;
  value: ReactNode;
  /** Muted text after the value, e.g. "/ 100 GB". */
  unit?: ReactNode;
  /** Optional small muted icon before the label. */
  icon?: ReactNode;
  /** Right side of the label row, e.g. a percentage. */
  aside?: ReactNode;
  /** One-line caption under the value. */
  caption?: ReactNode;
  /** Thin meter between value and caption. */
  meter?: ReactNode;
  className?: string;
}

export function KpiCell({
  label,
  value,
  unit,
  icon,
  aside,
  caption,
  meter,
  className,
}: KpiCellProps) {
  return (
    <div className={cn("kpi-cell", className)}>
      <div className="kpi-label">
        {icon && <span className="kpi-label-icon">{icon}</span>}
        <span className="truncate">{label}</span>
        {aside && <span className="kpi-label-aside">{aside}</span>}
      </div>
      <div className="kpi-value">
        <span className="kpi-value-main">{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {meter && <div className="kpi-meter">{meter}</div>}
      {caption && <div className="kpi-caption">{caption}</div>}
    </div>
  );
}

/* ─── Standalone stat card (kept for existing callers) ─────────────── */

export interface StatCardProps {
  title: string;
  value: string | number;
  /** Kept for compatibility; the console style keeps the value neutral. */
  tone?: SemanticColor;
  icon: ReactNode;
  bottomContent?: ReactNode;
}

export function StatCard({ title, value, icon, bottomContent }: StatCardProps) {
  return (
    <div className="kpi-strip kpi-strip-single min-w-0">
      <KpiCell
        caption={bottomContent}
        icon={icon}
        label={title}
        value={value}
      />
    </div>
  );
}
