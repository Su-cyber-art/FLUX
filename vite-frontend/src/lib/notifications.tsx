import type { CSSProperties, ReactNode } from "react";

import { notifications } from "@mantine/notifications";
import { Check, Info, X } from "lucide-react";
interface ToastOptions {
  id?: string;
  duration?: number;
  icon?: ReactNode;
  style?: CSSProperties;
  position?:
    | "top-center"
    | "top-right"
    | "top-left"
    | "bottom-center"
    | "bottom-right"
    | "bottom-left";
}
type Message = ReactNode | ((notification: { id: string }) => ReactNode);
let sequence = 0;

function show(
  message: Message,
  options: ToastOptions = {},
  tone: "info" | "success" | "error" = "info",
) {
  const id = options.id || `flvx-notification-${++sequence}`;
  const Icon = tone === "success" ? Check : tone === "error" ? X : Info;

  notifications.show({
    id,
    message: typeof message === "function" ? message({ id }) : message,
    autoClose:
      options.duration === Infinity
        ? false
        : (options.duration ?? (tone === "error" ? 5000 : 3000)),
    color: tone === "success" ? "teal" : tone === "error" ? "red" : "blue",
    icon: options.icon ?? <Icon size={16} />,
    position: options.position,
    withCloseButton: true,
  });

  return id;
}
export const toast = Object.assign(show, {
  success: (message: Message, options?: ToastOptions) =>
    show(message, options, "success"),
  error: (message: Message, options?: ToastOptions) =>
    show(message, options, "error"),
  dismiss: (id?: string) =>
    id ? notifications.hide(id) : notifications.clean(),
});
export default toast;
