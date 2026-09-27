import { Loader } from "@mantine/core";
export function Spinner({
  size = "md",
  className,
  label,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  return (
    <Loader
      aria-label={label || "加载中"}
      className={className}
      role="status"
      size={size}
    />
  );
}
