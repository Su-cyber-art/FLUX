import * as React from "react";
import { Menu } from "@mantine/core";
export function Dropdown({
  children,
  placement = "bottom-start",
}: {
  children: React.ReactNode;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
}) {
  return (
    <Menu withinPortal position={placement} shadow="md" zIndex={450}>
      {children}
    </Menu>
  );
}
export function DropdownTrigger({ children }: { children: React.ReactNode }) {
  return <Menu.Target>{children}</Menu.Target>;
}
export function DropdownMenu({
  children,
  className,
  "aria-label": label,
}: {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Menu.Dropdown aria-label={label} className={className}>
      {children}
    </Menu.Dropdown>
  );
}
export function DropdownItem({
  children,
  className,
  color,
  onPress,
  startContent,
}: {
  children: React.ReactNode;
  className?: string;
  color?: "default" | "danger";
  onPress?: () => void;
  startContent?: React.ReactNode;
}) {
  return (
    <Menu.Item
      className={className}
      color={color === "danger" ? "red" : undefined}
      leftSection={startContent}
      onClick={onPress}
    >
      {children}
    </Menu.Item>
  );
}
export function DropdownSection({
  children,
  title,
  showDivider,
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  showDivider?: boolean;
}) {
  return (
    <>
      {title && <Menu.Label>{title}</Menu.Label>}
      {children}
      {showDivider && <Menu.Divider />}
    </>
  );
}
