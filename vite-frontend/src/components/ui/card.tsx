import * as React from "react";
import { Paper } from "@mantine/core";

import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <Paper
      withBorder
      className={cn("app-card min-w-0", className)}
      data-slot="card"
      radius="md"
      {...props}
    />
  );
}
export function CardHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("min-w-0 flex flex-col gap-1.5 p-5", className)}
      data-slot="card-header"
      {...props}
    />
  );
}
export function CardBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("min-w-0 p-5", className)}
      data-slot="card-content"
      {...props}
    />
  );
}
