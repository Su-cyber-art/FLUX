import { Divider as MantineDivider } from "@mantine/core";
export function Divider({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  return <MantineDivider className={className} orientation={orientation} />;
}
