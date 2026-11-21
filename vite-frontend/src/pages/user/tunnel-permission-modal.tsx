import { Button, Checkbox, Loader, Select, Switch } from "@mantine/core";

import { FormSection } from "@/components/form-section";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { TunnelPermissionList } from "@/pages/user/tunnel-permission-list";
import {
  type SpeedLimit,
  type Tunnel,
  type User,
  type UserTunnel,
} from "@/types";

interface TunnelPermissionModalProps {
  isTunnelModalOpen: boolean;
  onTunnelModalClose: () => void;
  currentUser: User | null;
  monitorPermissionLoading: boolean;
  monitorPermissionUserIds: Set<number>;
  monitorPermissionMutatingUserId: number | null;
  setUserMonitorPermission: (userId: number, enabled: boolean) => Promise<void>;
  tunnels: Tunnel[];
  isTunnelAssigned: (tunnelId: number) => boolean;
  batchTunnelSelections: Map<number, number | null>;
  getSpeedLimitsForTunnel: (_tunnelId: number) => SpeedLimit[];
  toggleTunnelSelection: (tunnelId: number) => void;
  updateTunnelSpeedLimit: (tunnelId: number, speedId: number | null) => void;
  assignLoading: boolean;
  handleBatchAssignTunnel: () => Promise<void>;
  userTunnels: UserTunnel[];
  tunnelListLoading: boolean;
  handleEditTunnel: (userTunnel: UserTunnel) => void;
  handleRemoveTunnel: (userTunnel: UserTunnel) => void;
  handleResetTunnelFlow: (userTunnel: UserTunnel) => void;
}

export function TunnelPermissionModal({
  isTunnelModalOpen,
  onTunnelModalClose,
  currentUser,
  monitorPermissionLoading,
  monitorPermissionUserIds,
  monitorPermissionMutatingUserId,
  setUserMonitorPermission,
  tunnels,
  isTunnelAssigned,
  batchTunnelSelections,
  getSpeedLimitsForTunnel,
  toggleTunnelSelection,
  updateTunnelSpeedLimit,
  assignLoading,
  handleBatchAssignTunnel,
  userTunnels,
  tunnelListLoading,
  handleEditTunnel,
  handleRemoveTunnel,
  handleResetTunnelFlow,
}: TunnelPermissionModalProps) {
  return (
    <Modal
      closeOnClickOutside={false}
      closeOnEscape={false}
      opened={isTunnelModalOpen}
      size="xl"
      onClose={onTunnelModalClose}
    >
      <ModalContent>
        <ModalHeader>
          <h2>隧道权限</h2>
          <p>管理用户 {currentUser?.user} 可使用的隧道与监控功能</p>
        </ModalHeader>
        <ModalBody>
          <FormSection title="监控权限">
            <div className="flex items-center justify-between gap-4 rounded-[10px] border border-divider px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">
                  允许访问监控功能
                </p>
                <p className="mt-0.5 text-xs text-default-500">
                  授予后，该用户可以访问监控页面并管理服务监控（TCP/ICMP）。
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {monitorPermissionLoading ? (
                  <Loader aria-label="加载中" role="status" size="sm" />
                ) : null}
                <Switch
                  checked={
                    currentUser
                      ? monitorPermissionUserIds.has(currentUser.id)
                      : false
                  }
                  disabled={
                    !currentUser ||
                    monitorPermissionLoading ||
                    monitorPermissionMutatingUserId === currentUser.id
                  }
                  onChange={({ currentTarget: { checked: v } }) =>
                    currentUser &&
                    void setUserMonitorPermission(currentUser.id, v)
                  }
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            description="流量限制、规则数量、到期时间与流量重置日期自动继承用户设置；选中后可单独指定限速。"
            title="分配新权限"
          >
            {tunnels.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-divider px-4 py-5 text-center text-[13px] text-default-500">
                暂无可用隧道
              </p>
            ) : (
              <div className="user-pick-list max-h-72">
                {tunnels.map((tunnel) => {
                  const isAssigned = isTunnelAssigned(tunnel.id);
                  const isSelected = batchTunnelSelections.has(tunnel.id);
                  const tunnelSpeedLimits = getSpeedLimitsForTunnel(tunnel.id);

                  return (
                    <div
                      key={tunnel.id}
                      aria-disabled={isAssigned}
                      className="user-pick-row"
                      data-selected={(isSelected && !isAssigned) || undefined}
                      role="button"
                      tabIndex={isAssigned ? -1 : 0}
                      onClick={() =>
                        !isAssigned && toggleTunnelSelection(tunnel.id)
                      }
                      onKeyDown={(event) => {
                        if (isAssigned) {
                          return;
                        }

                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleTunnelSelection(tunnel.id);
                        }
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isAssigned}
                        size="xs"
                        onChange={() => toggleTunnelSelection(tunnel.id)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] ${isAssigned ? "text-default-400" : "font-medium text-foreground"}`}
                      >
                        {tunnel.name}
                      </span>
                      {isAssigned && (
                        <span className="shrink-0 text-xs text-default-400">
                          已分配
                        </span>
                      )}
                      {isSelected && !isAssigned && (
                        <Select
                          clearable
                          searchable
                          aria-label={`${tunnel.name} 限速`}
                          className="w-36 shrink-0"
                          data={tunnelSpeedLimits.map((sl) => ({
                            value: sl.id.toString(),
                            label: sl.name,
                          }))}
                          placeholder="不限速"
                          size="xs"
                          value={
                            batchTunnelSelections.get(tunnel.id) !== null &&
                            batchTunnelSelections.get(tunnel.id) !== undefined
                              ? batchTunnelSelections.get(tunnel.id)!.toString()
                              : null
                          }
                          onChange={(value) => {
                            const selectedKey = value as string | undefined;

                            updateTunnelSpeedLimit(
                              tunnel.id,
                              selectedKey ? Number(selectedKey) : null,
                            );
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                className="w-full sm:w-auto"
                disabled={batchTunnelSelections.size === 0}
                loading={assignLoading}
                size="sm"
                onClick={handleBatchAssignTunnel}
              >
                分配权限
              </Button>
              {batchTunnelSelections.size > 0 && (
                <span className="text-xs text-default-500">
                  已选 {batchTunnelSelections.size} 个隧道
                </span>
              )}
            </div>
          </FormSection>

          <FormSection
            description={`共 ${userTunnels.length} 条隧道权限`}
            title="已有权限"
          >
            <TunnelPermissionList
              items={userTunnels}
              loading={tunnelListLoading}
              onEdit={handleEditTunnel}
              onRemove={handleRemoveTunnel}
              onResetFlow={handleResetTunnelFlow}
            />
          </FormSection>
        </ModalBody>
        <ModalFooter>
          <Button color="gray" variant="subtle" onClick={onTunnelModalClose}>
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
