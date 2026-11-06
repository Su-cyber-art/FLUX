import type * as React from "react";

import { Button, Select, Textarea, TextInput } from "@mantine/core";

import { type SpeedLimitApiItem } from "@/api/types";
import { AdvancedSection } from "@/components/advanced-section";
import { FormSection } from "@/components/form-section";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { type ForwardForm, type Tunnel } from "@/pages/forward/presentation";

interface ForwardFormModalProps {
  modalOpen: boolean;
  setModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isEdit: boolean;
  errors: { [key: string]: string };
  form: ForwardForm;
  setForm: React.Dispatch<React.SetStateAction<ForwardForm>>;
  tunnels: Tunnel[];
  handleTunnelChange: (tunnelId: string) => void;
  currentTunnelPortRange: { min: number; max: number } | null;
  currentTunnelIpOptions: string[];
  isCurrentTunnelMultiEntrance: boolean;
  setInIpTouched: React.Dispatch<React.SetStateAction<boolean>>;
  getAddressCount: (addressString: string) => number;
  isAdmin: boolean;
  availableSpeedLimits: SpeedLimitApiItem[];
  selectedSpeedId: number | null;
  selectedIPSpeedId: number | null;
  submitLoading: boolean;
  handleSubmit: () => Promise<void>;
}

export function ForwardFormModal({
  modalOpen,
  setModalOpen,
  isEdit,
  errors,
  form,
  setForm,
  tunnels,
  handleTunnelChange,
  currentTunnelPortRange,
  currentTunnelIpOptions,
  isCurrentTunnelMultiEntrance,
  setInIpTouched,
  getAddressCount,
  isAdmin,
  availableSpeedLimits,
  selectedSpeedId,
  selectedIPSpeedId,
  submitLoading,
  handleSubmit,
}: ForwardFormModalProps) {
  return (
    <Modal opened={modalOpen} size="xl" onClose={() => setModalOpen(false)}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">
            {isEdit ? "编辑规则" : "新增规则"}
          </h2>
          <p className="text-small text-default-500">
            {isEdit ? "修改现有规则配置的信息" : "创建新的规则配置"}
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="pb-2">
            <FormSection title="基本信息">
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  error={errors.name}
                  label="规则名称"
                  placeholder="请输入规则名称"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />

                <Select
                  searchable
                  data={tunnels.map((tunnel) => ({
                    value: String(tunnel.id),
                    label: tunnel.name,
                  }))}
                  description={
                    isEdit
                      ? "更改隧道将释放原端口并在新隧道分配端口"
                      : undefined
                  }
                  error={errors.tunnelId}
                  label="选择隧道"
                  placeholder="请选择关联的隧道"
                  value={form.tunnelId ? form.tunnelId.toString() : null}
                  onChange={(value) => {
                    const selectedKey = value as string;

                    if (selectedKey) {
                      handleTunnelChange(selectedKey);
                    }
                  }}
                />
              </div>
            </FormSection>

            <FormSection
              description="外部客户端连接的端口与监听地址"
              title="入口"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  description={
                    currentTunnelPortRange
                      ? `指定入口端口，留空自动分配 (允许范围: ${currentTunnelPortRange.min}-${currentTunnelPortRange.max})`
                      : "指定入口端口，留空则从节点可用端口中自动分配"
                  }
                  error={errors.inPort}
                  label="入口端口"
                  placeholder="留空则自动分配可用端口"
                  type="number"
                  value={form.inPort !== null ? form.inPort.toString() : ""}
                  onChange={(e) => {
                    const value = e.target.value;

                    setForm((prev) => ({
                      ...prev,
                      inPort: value ? parseInt(value) : null,
                    }));
                  }}
                />

                <Select
                  searchable
                  data={[
                    { value: "__default__", label: "默认入口IP" },
                    ...currentTunnelIpOptions.map((ip) => ({
                      value: String(ip),
                      label: ip,
                    })),
                  ]}
                  description={
                    isCurrentTunnelMultiEntrance
                      ? "多入口隧道不支持自定义监听IP，使用各节点默认IP"
                      : "从入口节点IP中选择，留空使用默认"
                  }
                  disabled={
                    !form.tunnelId ||
                    currentTunnelIpOptions.length === 0 ||
                    isCurrentTunnelMultiEntrance
                  }
                  label="监听IP"
                  placeholder={
                    isCurrentTunnelMultiEntrance
                      ? "多入口隧道使用节点默认IP"
                      : form.tunnelId
                        ? currentTunnelIpOptions.length > 0
                          ? "选择入口监听IP"
                          : "当前隧道入口节点暂无可选IP"
                        : "请先选择隧道"
                  }
                  value={form.inIp || "__default__"}
                  onChange={(value) => {
                    const selectedKey = value as string;

                    setInIpTouched(true);

                    setForm((prev) => ({
                      ...prev,
                      inIp: selectedKey === "__default__" ? "" : selectedKey,
                    }));
                  }}
                />
              </div>
            </FormSection>

            <FormSection description="流量最终转发到的地址" title="目标">
              <Textarea
                description="格式: IP:端口 或 域名:端口，支持多个地址（每行一个）"
                error={errors.remoteAddr}
                label="落地地址"
                maxRows={6}
                placeholder="请输入落地地址，多个地址用换行分隔，例如:&#10;192.168.1.100:10000&#10;[2001:db8::10]:10086&#10;test.example.com:10010"
                value={form.remoteAddr}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    remoteAddr: e.target.value,
                  }))
                }
              />

              {getAddressCount(form.remoteAddr) > 1 && (
                <Select
                  data={[
                    { value: "fifo", label: "主备模式 - 自上而下" },
                    { value: "round", label: "轮询模式 - 依次轮换" },
                    { value: "rand", label: "随机模式 - 随机选择" },
                    { value: "hash", label: "哈希模式 - IP哈希" },
                  ]}
                  description="多个目标地址的负载均衡策略"
                  label="负载策略"
                  placeholder="请选择负载均衡策略"
                  value={form.strategy}
                  onChange={(value) => {
                    const selectedKey = value as string;

                    setForm((prev) => ({
                      ...prev,
                      strategy: selectedKey,
                    }));
                  }}
                />
              )}
            </FormSection>
            <section className="form-section">
              <AdvancedSection title="高级设置">
                <div className="space-y-4 pb-2">
                  <TextInput
                    description="大于 0 时优先于用户全局限制；0 或空表示使用用户全局限制，用户也为 0 时不限制。"
                    label="最大连接数"
                    min="0"
                    placeholder="0 或空表示使用用户全局限制"
                    type="number"
                    value={form.maxConn === 0 ? "" : String(form.maxConn || "")}
                    onChange={(e) => {
                      const value = Math.max(Number(e.target.value) || 0, 0);

                      setForm((prev) => ({ ...prev, maxConn: value }));
                    }}
                  />
                  <TextInput
                    description="每个客户端 IP 可同时建立的最大连接数；0 或空表示不限制。"
                    label="每 IP 最大连接数"
                    min="0"
                    placeholder="0 或空表示不限制"
                    type="number"
                    value={
                      form.ipMaxConn === 0 ? "" : String(form.ipMaxConn || "")
                    }
                    onChange={(e) => {
                      const value = Math.max(Number(e.target.value) || 0, 0);

                      setForm((prev) => ({
                        ...prev,
                        ipMaxConn: value,
                      }));
                    }}
                  />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Select
                      data={[
                        { value: "0", label: "禁用" },
                        { value: "1", label: "Version 1" },
                        { value: "2", label: "Version 2" },
                      ]}
                      description="入口监听接收 PROXY protocol，用于读取上游传入的真实客户端 IP。"
                      label="Proxy Protocol 接收"
                      placeholder="禁用"
                      value={String(form.proxyProtocolReceive || 0)}
                      onChange={(value) => {
                        const selectedKey = value as string;

                        setForm((prev) => ({
                          ...prev,
                          proxyProtocolReceive: Number(selectedKey),
                        }));
                      }}
                    />
                    <Select
                      data={[
                        { value: "0", label: "禁用" },
                        { value: "1", label: "Version 1" },
                        { value: "2", label: "Version 2" },
                      ]}
                      description="连接目标地址时发送 PROXY protocol，用于向下游透传客户端真实 IP。"
                      label="Proxy Protocol 发送"
                      placeholder="禁用"
                      value={String(form.proxyProtocolSend || 0)}
                      onChange={(value) => {
                        const selectedKey = value as string;
                        const proxyProtocolSend = Number(selectedKey);

                        setForm((prev) => ({
                          ...prev,
                          proxyProtocol: proxyProtocolSend,
                          proxyProtocolSend,
                        }));
                      }}
                    />
                  </div>
                  {isAdmin && (
                    <Select
                      clearable
                      searchable
                      data={availableSpeedLimits.map((speedLimit) => ({
                        value: speedLimit.id.toString(),
                        label: speedLimit.name,
                      }))}
                      label="规则限速"
                      placeholder="不限速"
                      value={
                        selectedSpeedId !== null
                          ? selectedSpeedId.toString()
                          : null
                      }
                      onChange={(value) => {
                        const selectedKey = value as string | undefined;

                        setForm((prev) => ({
                          ...prev,
                          speedId: selectedKey ? Number(selectedKey) : null,
                        }));
                      }}
                    />
                  )}
                  {isAdmin && (
                    <Select
                      clearable
                      searchable
                      data={availableSpeedLimits.map((speedLimit) => ({
                        value: speedLimit.id.toString(),
                        label: speedLimit.name,
                      }))}
                      description="每个客户端 IP 独享该限速规则；不选择表示不限制。"
                      label="每 IP 限速"
                      placeholder="不限速"
                      value={
                        selectedIPSpeedId !== null
                          ? selectedIPSpeedId.toString()
                          : null
                      }
                      onChange={(value) => {
                        const selectedKey = value as string | undefined;

                        setForm((prev) => ({
                          ...prev,
                          ipSpeedId: selectedKey ? Number(selectedKey) : null,
                        }));
                      }}
                    />
                  )}
                </div>
              </AdvancedSection>
            </section>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={() => setModalOpen(false)}
          >
            取消
          </Button>
          <Button loading={submitLoading} onClick={handleSubmit}>
            {isEdit ? "保存修改" : "创建规则"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
