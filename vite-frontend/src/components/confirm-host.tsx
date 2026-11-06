import { useEffect, useState, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "warning";
}
interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

let show: ((request: PendingConfirm) => void) | null = null;

/**
 * Promise-based replacement for window.confirm that uses the app's dialog.
 * Requires <ConfirmHost /> to be mounted (see provider.tsx).
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) {
      resolve(false);

      return;
    }
    show({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const [request, setRequest] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    show = (next) =>
      setRequest((current) => {
        // A newer request supersedes an unanswered one.
        current?.resolve(false);

        return next;
      });

    return () => {
      show = null;
    };
  }, []);

  const settle = (confirmed: boolean) => {
    request?.resolve(confirmed);
    setRequest(null);
  };

  return (
    <ConfirmDialog
      confirmLabel={request?.confirmLabel}
      message={request?.message}
      opened={request !== null}
      title={request?.title ?? ""}
      tone={request?.tone}
      // Above page modals: it may be raised from inside one.
      zIndex={350}
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );
}
