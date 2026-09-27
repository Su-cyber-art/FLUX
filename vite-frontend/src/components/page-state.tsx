import { Loader, Stack, Text, ThemeIcon } from "@mantine/core";
import { Inbox, CircleAlert } from "lucide-react";

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
    <ThemeIcon color="gray" radius="xl" size={44} variant="light">
      <Inbox size={22} />
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
    <ThemeIcon color="red" radius="xl" size={44} variant="light">
      <CircleAlert size={22} />
    </ThemeIcon>
    <Text c="red" size="sm">
      {message}
    </Text>
  </Stack>
);
