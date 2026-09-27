import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
export const AnimatedPage = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => <div className={cn("app-page", className)}>{children}</div>;
export const StaggerList = ({
  children,
  className,
  as: Component = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "tbody";
}) => <Component className={className}>{children}</Component>;
export const StaggerItem = ({
  children,
  className,
  as: Component = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "tr";
}) => <Component className={className}>{children}</Component>;
export const FadeIn = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => <div className={className}>{children}</div>;
