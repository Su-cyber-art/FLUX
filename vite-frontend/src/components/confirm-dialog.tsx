import type { ReactNode } from "react";

import { Button } from "@mantine/core";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { uiColor } from "@/components/ui/shared";

interface ConfirmDialogProps {
  opened: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  /** Confirm button color; reversible-but-lossy actions such as resets use warning. */
  tone?: "danger" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  zIndex?: number;
}

/** Small destructive-action confirmation shared by list pages. */
export function ConfirmDialog({
  opened,
  title,
  message,
  confirmLabel = "删除",
  tone = "danger",
  loading,
  onConfirm,
  onClose,
  zIndex,
}: ConfirmDialogProps) {
  return (
    <Modal opened={opened} size="sm" zIndex={zIndex} onClose={onClose}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <div className="text-sm text-default-600">{message}</div>
        </ModalBody>
        <ModalFooter>
          <Button color="gray" variant="subtle" onClick={onClose}>
            取消
          </Button>
          <Button color={uiColor(tone)} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
