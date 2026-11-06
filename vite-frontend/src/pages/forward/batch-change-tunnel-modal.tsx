import type * as React from "react";

import { Button, Select } from "@mantine/core";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { type Tunnel } from "@/pages/forward/presentation";

interface BatchChangeTunnelModalProps {
  batchChangeTunnelModalOpen: boolean;
  setBatchChangeTunnelModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedIds: Set<number>;
  tunnels: Tunnel[];
  batchTargetTunnelId: number | null;
  setBatchTargetTunnelId: React.Dispatch<React.SetStateAction<number | null>>;
  batchLoading: boolean;
  handleBatchChangeTunnel: () => Promise<void>;
}

export function BatchChangeTunnelModal({
  batchChangeTunnelModalOpen,
  setBatchChangeTunnelModalOpen,
  selectedIds,
  tunnels,
  batchTargetTunnelId,
  setBatchTargetTunnelId,
  batchLoading,
  handleBatchChangeTunnel,
}: BatchChangeTunnelModalProps) {
  return (
    <Modal
      opened={batchChangeTunnelModalOpen}
      onClose={() => setBatchChangeTunnelModalOpen(false)}
    >
      <ModalContent>
        <ModalHeader>隧道</ModalHeader>
        <ModalBody>
          <p className="mb-4">
            将选中的 {selectedIds.size} 项规则迁移到新隧道：
          </p>
          <Select
            clearable
            searchable
            data={tunnels.map((tunnel) => ({
              value: String(tunnel.id),
              label: tunnel.name,
            }))}
            label="目标隧道"
            placeholder="请选择目标隧道"
            value={batchTargetTunnelId ? String(batchTargetTunnelId) : null}
            onChange={(selected) => {
              setBatchTargetTunnelId(selected ? Number(selected) : null);
            }}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={() => setBatchChangeTunnelModalOpen(false)}
          >
            取消
          </Button>
          <Button
            disabled={!batchTargetTunnelId}
            loading={batchLoading}
            onClick={handleBatchChangeTunnel}
          >
            确认换隧道
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
