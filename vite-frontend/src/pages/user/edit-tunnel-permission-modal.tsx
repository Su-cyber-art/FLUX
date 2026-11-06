import type * as React from "react";

import { Button, Group, Radio, Select, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";

import { TrafficLimitField } from "@/components/traffic-limit-field";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { endOfDay } from "@/pages/user/presentation";
import { type SpeedLimit, type User, type UserTunnel } from "@/types";
import { type TrafficUnit } from "@/utils/traffic";

interface EditTunnelPermissionModalProps {
  isEditTunnelModalOpen: boolean;
  onEditTunnelModalClose: () => void;
  currentUser: User | null;
  editTunnelForm: UserTunnel | null;
  tunnelFlowUnit: TrafficUnit;
  tunnelFlowInput: string;
  setTunnelFlowInput: React.Dispatch<React.SetStateAction<string>>;
  setTunnelFlowUnit: React.Dispatch<React.SetStateAction<TrafficUnit>>;
  setEditTunnelForm: React.Dispatch<React.SetStateAction<UserTunnel | null>>;
  editAvailableSpeedLimits: SpeedLimit[];
  editTunnelSelectedSpeedId: number | null;
  editTunnelLoading: boolean;
  handleUpdateTunnel: () => Promise<void>;
}

export function EditTunnelPermissionModal({
  isEditTunnelModalOpen,
  onEditTunnelModalClose,
  currentUser,
  editTunnelForm,
  tunnelFlowUnit,
  tunnelFlowInput,
  setTunnelFlowInput,
  setTunnelFlowUnit,
  setEditTunnelForm,
  editAvailableSpeedLimits,
  editTunnelSelectedSpeedId,
  editTunnelLoading,
  handleUpdateTunnel,
}: EditTunnelPermissionModalProps) {
  return (
    <Modal
      closeOnClickOutside={false}
      closeOnEscape={false}
      opened={isEditTunnelModalOpen}
      size="lg"
      onClose={onEditTunnelModalClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">编辑隧道权限</h2>
          <p className="text-small text-default-500">
            {currentUser?.user} · {editTunnelForm?.tunnelName}
          </p>
        </ModalHeader>
        <ModalBody>
          {editTunnelForm && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TrafficLimitField
                  isRequired
                  label="流量限制"
                  unit={tunnelFlowUnit}
                  value={tunnelFlowInput}
                  onChange={(value, unit) => {
                    setTunnelFlowInput(value);
                    setTunnelFlowUnit(unit);
                  }}
                />

                <TextInput
                  label="规则数量"
                  max="99999"
                  min="1"
                  type="number"
                  value={editTunnelForm.num.toString()}
                  onChange={(e) => {
                    const value = Math.min(
                      Math.max(Number(e.target.value) || 0, 1),
                      99999,
                    );

                    setEditTunnelForm((prev) =>
                      prev ? { ...prev, num: value } : null,
                    );
                  }}
                />

                <Select
                  clearable
                  searchable
                  data={editAvailableSpeedLimits.map((speedLimit) => ({
                    value: speedLimit.id.toString(),
                    label: speedLimit.name,
                  }))}
                  label="限速规则"
                  placeholder="不限速"
                  value={
                    editTunnelSelectedSpeedId !== null
                      ? editTunnelSelectedSpeedId.toString()
                      : null
                  }
                  onChange={(value) => {
                    const selectedKey = value as string | undefined;

                    setEditTunnelForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            speedId: selectedKey ? Number(selectedKey) : null,
                          }
                        : null,
                    );
                  }}
                />

                <Select
                  searchable
                  data={[
                    { value: "0", label: "不重置" },
                    ...Array.from({ length: 31 }, (_, i) => i + 1).map(
                      (day) => ({
                        value: day.toString(),
                        label: `每月${day}号（0点重置）`,
                      }),
                    ),
                  ]}
                  label="流量重置日期"
                  value={editTunnelForm.flowResetTime.toString()}
                  onChange={(value) => {
                    setEditTunnelForm((prev) =>
                      prev ? { ...prev, flowResetTime: Number(value) } : null,
                    );
                  }}
                />

                <DateInput
                  required
                  label="到期时间"
                  value={
                    editTunnelForm.expTime
                      ? dayjs(editTunnelForm.expTime).format("YYYY-MM-DD")
                      : null
                  }
                  onChange={(date) =>
                    setEditTunnelForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            expTime: date
                              ? endOfDay(date).getTime()
                              : Date.now(),
                          }
                        : null,
                    )
                  }
                />
              </div>

              <Radio.Group
                label="状态"
                value={editTunnelForm.status.toString()}
                onChange={(value) =>
                  setEditTunnelForm((prev) =>
                    prev ? { ...prev, status: Number(value) } : null,
                  )
                }
              >
                <Group mt="xs">
                  <Radio label="正常" value="1" />
                  <Radio label="禁用" value="0" />
                </Group>
              </Radio.Group>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={onEditTunnelModalClose}
          >
            取消
          </Button>
          <Button loading={editTunnelLoading} onClick={handleUpdateTunnel}>
            保存修改
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
