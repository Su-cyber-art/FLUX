import type * as React from "react";

import { Button, Select, Switch, TextInput } from "@mantine/core";

import {
  type ServiceMonitorApiItem,
  type ServiceMonitorLimitsApiData,
} from "@/api/types";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";

export interface MonitorForm {
  name: string;
  type: "tcp" | "icmp";
  target: string;
  intervalSec: number;
  timeoutSec: number;
  nodeId: number;
  enabled: boolean;
}

interface MonitorEditModalProps {
  editModalOpen: boolean;
  setEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingMonitor: ServiceMonitorApiItem | null;
  monitorForm: MonitorForm;
  setMonitorForm: React.Dispatch<React.SetStateAction<MonitorForm>>;
  onlineNodes: {
    id: number;
    name: string;
    connectionStatus: string;
    version?: string;
  }[];
  resolvedServiceMonitorLimits: ServiceMonitorLimitsApiData;
  submitLoading: boolean;
  handleSubmitMonitor: () => Promise<void>;
}

export function MonitorEditModal({
  editModalOpen,
  setEditModalOpen,
  editingMonitor,
  monitorForm,
  setMonitorForm,
  onlineNodes,
  resolvedServiceMonitorLimits,
  submitLoading,
  handleSubmitMonitor,
}: MonitorEditModalProps) {
  return (
    <Modal opened={editModalOpen} onClose={() => setEditModalOpen(false)}>
      <ModalContent>
        <ModalHeader>{editingMonitor ? "编辑监控" : "添加监控"}</ModalHeader>
        <ModalBody className="space-y-4">
          <TextInput
            label="名称"
            placeholder="例如: Google DNS"
            value={monitorForm.name}
            onChange={(e) =>
              setMonitorForm((f) => ({ ...f, name: e.target.value }))
            }
          />
          <Select
            data={[
              { value: "tcp", label: "TCP" },
              { value: "icmp", label: "ICMP Ping" },
            ]}
            label="类型"
            value={monitorForm.type}
            onChange={(value) => {
              const nextType = value as "tcp" | "icmp";

              setMonitorForm((f) => {
                let nextNodeId = f.nodeId;

                if (nextType === "icmp" && (!nextNodeId || nextNodeId <= 0)) {
                  nextNodeId = onlineNodes.length > 0 ? onlineNodes[0].id : 0;
                }

                return {
                  ...f,
                  type: nextType,
                  nodeId: nextNodeId,
                };
              });
            }}
          />
          <TextInput
            label="目标"
            placeholder={
              monitorForm.type === "icmp"
                ? "例如: 8.8.8.8 或 1.1.1.1"
                : "例如: 8.8.8.8:53"
            }
            value={monitorForm.target}
            onChange={(e) =>
              setMonitorForm((f) => ({ ...f, target: e.target.value }))
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <TextInput
              description={`最小 ${resolvedServiceMonitorLimits.minIntervalSec}s（扫描周期 ${resolvedServiceMonitorLimits.checkerScanIntervalSec}s）`}
              error={
                monitorForm.intervalSec <
                resolvedServiceMonitorLimits.minIntervalSec
                  ? `不能小于 ${resolvedServiceMonitorLimits.minIntervalSec}s`
                  : undefined
              }
              label="检查间隔(秒)"
              type="number"
              value={String(monitorForm.intervalSec)}
              onChange={(e) =>
                setMonitorForm((f) => ({
                  ...f,
                  intervalSec:
                    Number(e.target.value) ||
                    resolvedServiceMonitorLimits.defaultIntervalSec,
                }))
              }
            />
            <TextInput
              description={`范围 ${resolvedServiceMonitorLimits.minTimeoutSec}-${resolvedServiceMonitorLimits.maxTimeoutSec}s`}
              error={
                monitorForm.timeoutSec <
                  resolvedServiceMonitorLimits.minTimeoutSec ||
                monitorForm.timeoutSec >
                  resolvedServiceMonitorLimits.maxTimeoutSec
                  ? `需在 ${resolvedServiceMonitorLimits.minTimeoutSec}-${resolvedServiceMonitorLimits.maxTimeoutSec}s 范围内`
                  : undefined
              }
              label="超时时间(秒)"
              type="number"
              value={String(monitorForm.timeoutSec)}
              onChange={(e) =>
                setMonitorForm((f) => ({
                  ...f,
                  timeoutSec:
                    Number(e.target.value) ||
                    resolvedServiceMonitorLimits.defaultTimeoutSec,
                }))
              }
            />
          </div>
          <Select
            searchable
            data={[
              ...(monitorForm.type !== "icmp"
                ? [{ value: "0", label: "面板执行" }]
                : []),
              ...onlineNodes.map((node) => ({
                value: String(node.id),
                label: node.name,
              })),
            ]}
            label="执行节点"
            value={
              Array.from(
                monitorForm.type === "icmp"
                  ? monitorForm.nodeId
                    ? [String(monitorForm.nodeId)]
                    : []
                  : monitorForm.nodeId
                    ? [String(monitorForm.nodeId)]
                    : ["0"],
                String,
              )[0] ?? null
            }
            onChange={(value) =>
              setMonitorForm((f) => ({
                ...f,
                nodeId: Number(value),
              }))
            }
          />
          <div className="flex items-center gap-2">
            <Switch
              checked={monitorForm.enabled}
              onChange={({ currentTarget: { checked: v } }) =>
                setMonitorForm((f) => ({ ...f, enabled: v }))
              }
            />
            <span className="text-sm">启用</span>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="light"
            onClick={() => setEditModalOpen(false)}
          >
            取消
          </Button>
          <Button loading={submitLoading} onClick={handleSubmitMonitor}>
            {editingMonitor ? "更新" : "创建"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
