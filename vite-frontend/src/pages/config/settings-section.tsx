import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Console settings card: a title row, then hairline-separated setting rows. */
export function SettingsSection({
  id,
  title,
  description,
  actions,
  className,
  children,
}: SettingsSectionProps) {
  return (
    <Card className={cn("settings-card", className)} id={id}>
      <header className="settings-card-head">
        <div className="min-w-0">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="settings-card-actions">{actions}</div>}
      </header>
      <div className="settings-card-body">{children}</div>
    </Card>
  );
}

interface SettingsRowProps {
  label: ReactNode;
  description?: ReactNode;
  /** Stack the control under the label at every width. */
  wide?: boolean;
  changed?: boolean;
  children?: ReactNode;
}

/** One setting: label and description on the left, its control on the right. */
export function SettingsRow({
  label,
  description,
  wide,
  changed,
  children,
}: SettingsRowProps) {
  return (
    <div
      className="settings-row"
      data-changed={changed || undefined}
      data-wide={wide || undefined}
    >
      <div className="settings-row-text">
        <p className="settings-row-label">{label}</p>
        {description && <p className="settings-row-desc">{description}</p>}
      </div>
      {children !== undefined && (
        <div className="settings-row-control">{children}</div>
      )}
    </div>
  );
}
