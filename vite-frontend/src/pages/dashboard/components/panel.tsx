import type { ReactNode } from "react";

import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/** Header row of a dashboard panel: title, muted count, optional link. */
export function PanelHead({
  title,
  icon,
  count,
  description,
  link,
  children,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  description?: ReactNode;
  link?: { to: string; label: string };
  children?: ReactNode;
}) {
  return (
    <div className="dash-panel-head">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h2 className="dash-panel-title shrink-0">
          {icon && <span className="self-center">{icon}</span>}
          {title}
          {count !== undefined && <small>{count}</small>}
        </h2>
        {description && (
          <span className="dash-panel-desc hidden sm:block">{description}</span>
        )}
      </div>
      {children}
      {link && (
        <Link className="dash-panel-link" to={link.to}>
          {link.label}
          <ChevronRight size={13} />
        </Link>
      )}
    </div>
  );
}
