import type * as React from "react";

import { Button } from "@mantine/core";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { NodeRemovalOptions } from "@/pages/node/removal-options";

interface NodeBatchDeleteModalProps {
  batchDeleteModalOpen: boolean;
  setBatchDeleteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  batchForceDelete: boolean;
  selectedIds: Set<number>;
  batchLoading: boolean;
  setBatchForceDelete: React.Dispatch<React.SetStateAction<boolean>>;
  handleBatchDelete: () => Promise<void>;
}

export function NodeBatchDeleteModal({
  batchDeleteModalOpen,
  setBatchDeleteModalOpen,
  batchForceDelete,
  selectedIds,
  batchLoading,
  setBatchForceDelete,
  handleBatchDelete,
}: NodeBatchDeleteModalProps) {
  return (
    <Modal
      opened={batchDeleteModalOpen}
      size="md"
      onClose={() => setBatchDeleteModalOpen(false)}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">
            {batchForceDelete ? "确认批量强制移除" : "确认删除"}
          </h2>
        </ModalHeader>
        <ModalBody>
          <p>
            确定要{batchForceDelete ? "从面板移除" : "删除"}选中的{" "}
            <strong>{selectedIds.size}</strong> 个节点吗？
          </p>
          {!batchForceDelete && (
            <p className="text-small text-default-500">
              将逐项清理并卸载本地
              agent；离线节点上线后自动重试。有关联资源或清理失败的节点会保留并显示原因。
            </p>
          )}
          <NodeRemovalOptions
            disabled={batchLoading}
            force={batchForceDelete}
            onChange={setBatchForceDelete}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={() => setBatchDeleteModalOpen(false)}
          >
            取消
          </Button>
          <Button
            color="red"
            loading={batchLoading}
            onClick={handleBatchDelete}
          >
            {batchLoading
              ? "处理中..."
              : batchForceDelete
                ? "确认强制移除"
                : "确认删除"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
