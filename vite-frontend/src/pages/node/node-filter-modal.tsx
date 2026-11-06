import type * as React from "react";

import { Button, Select } from "@mantine/core";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { NodeFilterMode } from "@/pages/node/presentation";

interface NodeFilterModalProps {
  isFilterModalOpen: boolean;
  setIsFilterModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  nodeExpiryStats: {
    expired: number;
    expiringSoon: number;
    withExpiry: number;
  };
  nodeFilterMode: NodeFilterMode;
  setNodeFilterMode: (value: React.SetStateAction<NodeFilterMode>) => void;
  resetNodeFilterMode: () => void;
}

export function NodeFilterModal({
  isFilterModalOpen,
  setIsFilterModalOpen,
  nodeExpiryStats,
  nodeFilterMode,
  setNodeFilterMode,
  resetNodeFilterMode,
}: NodeFilterModalProps) {
  return (
    <Modal
      opened={isFilterModalOpen}
      size="md"
      onClose={() => setIsFilterModalOpen(false)}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">筛选条件</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">按到期状态筛选</p>
              <Select
                aria-label="按到期状态筛选"
                className="w-full"
                data={[
                  { value: "all", label: "全部节点" },
                  {
                    value: "expiringSoon",
                    label: `7天内续费 (${nodeExpiryStats.expiringSoon})`,
                  },
                  {
                    value: "expired",
                    label: `已逾期 (${nodeExpiryStats.expired})`,
                  },
                  {
                    value: "withExpiry",
                    label: `已启用续费提醒 (${nodeExpiryStats.withExpiry})`,
                  },
                ]}
                value={nodeFilterMode}
                onChange={(value) => {
                  const selected = value as NodeFilterMode | undefined;

                  setNodeFilterMode(selected || "all");
                }}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="gray" variant="light" onClick={resetNodeFilterMode}>
            重置
          </Button>
          <Button onClick={() => setIsFilterModalOpen(false)}>完成</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
