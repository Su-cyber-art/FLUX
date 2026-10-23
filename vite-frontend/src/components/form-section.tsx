import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Titled group of fields inside a dialog form; sections are separated by a rule. */
export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <section className={cn("form-section", className)}>
      <div className="form-section-head">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="form-section-body">{children}</div>
    </section>
  );
}
