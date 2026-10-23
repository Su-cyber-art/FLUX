import type { BatchOperationFailure } from "@/api/types";

import { CircleX, Copy } from "lucide-react";

import toast from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";

interface BatchActionResultModalProps {
  failures: BatchOperationFailure[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  summary: string;
  title: string;
}

const getFailureTitle = (
  failure: BatchOperationFailure,
  index: number,
): string => {
  const name = typeof failure.name === "string" ? failure.name.trim() : "";

  if (name) {
    return name;
  }

  if (typeof failure.id === "number" && Number.isFinite(failure.id)) {
    return `ID ${failure.id}`;
  }

  return `失败项 ${index + 1}`;
};

const getFailureReason = (failure: BatchOperationFailure): string => {
  const reason =
    typeof failure.reason === "string" ? failure.reason.trim() : "";

  return reason || "未知错误";
};

const buildFailureCopyText = (
  title: string,
  summary: string,
  failures: BatchOperationFailure[],
): string => {
  return [
    title,
    summary,
    "",
    ...failures.map(
      (failure, index) =>
        `${index + 1}. ${getFailureTitle(failure, index)}\n${getFailureReason(failure)}`,
    ),
  ].join("\n");
};

export function BatchActionResultModal({
  failures,
  isOpen,
  onOpenChange,
  summary,
  title,
}: BatchActionResultModalProps) {
  const handleCopy = async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      toast.error("当前环境不支持复制");

      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildFailureCopyText(title, summary, failures),
      );
      toast.success(`已复制 ${failures.length} 项失败原因`);
    } catch {
      toast.error("复制失败，请稍后重试");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      scrollBehavior="inside"
      size="lg"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2>{title}</h2>
              <p>{summary}</p>
            </ModalHeader>
            <ModalBody>
              <p className="text-xs font-medium text-default-500">
                {failures.length} 项未完成
              </p>
              <div className="overflow-hidden rounded-[10px] border border-divider">
                {failures.map((failure, index) => (
                  <div
                    key={`${failure.id ?? "unknown"}-${index}`}
                    className="flex items-start gap-3 border-divider px-4 py-3 [&+&]:border-t"
                  >
                    <CircleX
                      className="mt-0.5 shrink-0 text-danger-ink"
                      size={16}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {getFailureTitle(failure, index)}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-default-500">
                        {getFailureReason(failure)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                startContent={<Copy size={14} />}
                variant="light"
                onPress={handleCopy}
              >
                复制失败原因
              </Button>
              <Button color="primary" onPress={onClose}>
                我知道了
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
