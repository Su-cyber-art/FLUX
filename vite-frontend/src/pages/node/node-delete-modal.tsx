import type * as React from "react";

import { Button } from "@mantine/core";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { type Node } from "@/pages/node/presentation";
import { NodeRemovalOptions } from "@/pages/node/removal-options";

interface NodeDeleteModalProps {
  deleteModalOpen: boolean;
  setDeleteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  forceNodeRemoval: boolean;
  nodeToDelete: Node | null;
  deleteLoading: boolean;
  setForceDelete: React.Dispatch<React.SetStateAction<boolean>>;
  confirmDelete: () => Promise<void>;
}

export function NodeDeleteModal({
  deleteModalOpen,
  setDeleteModalOpen,
  forceNodeRemoval,
  nodeToDelete,
  deleteLoading,
  setForceDelete,
  confirmDelete,
}: NodeDeleteModalProps) {
  return (
    <Modal
      opened={deleteModalOpen}
      size="2xl"
      onClose={() => setDeleteModalOpen(false)}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">
            {forceNodeRemoval ? "确认强制移除" : "确认删除"}
          </h2>
        </ModalHeader>
        <ModalBody>
          <p>
            确定要{forceNodeRemoval ? "从面板移除" : "删除"}节点{" "}
            <strong>&quot;{nodeToDelete?.name}&quot;</strong> 吗？
          </p>
          {!forceNodeRemoval && (
            <p className="text-small text-default-500">
              本地节点会停止转发、清除配置并卸载
              agent；离线节点上线后自动清理。请先解除隧道、转发和共享引用。远程共享节点仅移除本面板的接入。
            </p>
          )}
          <NodeRemovalOptions
            disabled={deleteLoading}
            force={forceNodeRemoval}
            locked={nodeToDelete?.deleteState === 3}
            onChange={setForceDelete}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={() => setDeleteModalOpen(false)}
          >
            取消
          </Button>
          <Button color="red" loading={deleteLoading} onClick={confirmDelete}>
            {deleteLoading
              ? "处理中..."
              : forceNodeRemoval
                ? "确认强制移除"
                : "确认删除"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
