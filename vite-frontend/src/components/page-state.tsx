import { Loader, Stack, Text, ThemeIcon } from "@mantine/core";
import { Inbox, CircleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
interface StateProps {
  message: string;
  className?: string;
}
export const PageLoadingState = ({ message, className }: StateProps) => (
  <Stack
    align="center"
    aria-live="polite"
    className={cn("min-h-48", className)}
    gap="sm"
    justify="center"
    role="status"
  >
    <Loader size="sm" />
    <Text c="dimmed" size="sm">
      {message}
    </Text>
  </Stack>
);
export const PageEmptyState = ({ message, className }: StateProps) => (
  <Stack
    align="center"
    className={cn("min-h-40", className)}
    gap="sm"
    justify="center"
  >
    <ThemeIcon
      className="empty-state-icon"
      color="gray"
      radius="md"
      size={36}
      variant="light"
    >
      <Inbox size={18} />
    </ThemeIcon>
    <Text c="dimmed" size="sm">
      {message}
    </Text>
  </Stack>
);
export const PageErrorState = ({ message, className }: StateProps) => (
  <Stack
    align="center"
    className={cn("min-h-40", className)}
    gap="sm"
    justify="center"
    role="alert"
  >
    <ThemeIcon
      className="empty-state-icon"
      color="red"
      radius="md"
      size={36}
      variant="light"
    >
      <CircleAlert size={18} />
    </ThemeIcon>
    <Text c="red" size="sm">
      {message}
    </Text>
  </Stack>
);

/** Empty state with a title, a hint and an optional call to action. */
/**
 * Empty list card. "primary" invites the first action (nothing created yet);
 * "default" is for filters or searches that matched nothing.
 */
export const EmptyStateCard = ({
  icon,
  title,
  description,
  action,
  tone = "primary",
}: {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "primary" | "default";
}) => (
  <Card className="items-center border-dashed px-6 py-12 text-center">
    <ThemeIcon
      className="empty-state-icon"
      color={tone === "default" ? "gray" : undefined}
      radius="md"
      size={36}
      variant="light"
    >
      {icon}
    </ThemeIcon>
    <Text fw={600} mt="sm" size="sm">
      {title}
    </Text>
    {description && (
      <Text c="dimmed" maw={380} mt={6} size="sm">
        {description}
      </Text>
    )}
    {action && <div className="mt-4">{action}</div>}
  </Card>
);
