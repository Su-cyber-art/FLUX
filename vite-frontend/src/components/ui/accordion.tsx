import * as React from "react";
import { Accordion as MantineAccordion } from "@mantine/core";
export function Accordion({
  children,
  className,
  variant = "light",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "bordered" | "light" | "splitted";
}) {
  return (
    <MantineAccordion
      multiple
      className={className}
      variant={
        variant === "splitted"
          ? "separated"
          : variant === "bordered"
            ? "contained"
            : "default"
      }
    >
      {children}
    </MantineAccordion>
  );
}
export function AccordionItem({
  children,
  title,
  value,
  className,
  "aria-label": label,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
  value?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const id = React.useId();

  return (
    <MantineAccordion.Item className={className} value={value ?? id}>
      <MantineAccordion.Control aria-label={label}>
        {title}
      </MantineAccordion.Control>
      <MantineAccordion.Panel>{children}</MantineAccordion.Panel>
    </MantineAccordion.Item>
  );
}
