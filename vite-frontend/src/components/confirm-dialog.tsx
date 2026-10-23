import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  /** Confirm button color; reversible-but-lossy actions such as resets use warning. */
  tone?: "danger" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Small destructive-action confirmation shared by list pages. */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "删除",
  tone = "danger",
  loading,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} size="sm" onClose={onClose}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <div className="text-sm text-default-600">{message}</div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            取消
          </Button>
          <Button color={tone} isLoading={loading} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
