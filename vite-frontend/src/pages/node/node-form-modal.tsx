import type * as React from "react";

import {
  Alert,
  Button,
  Select,
  Switch,
  TextInput,
  Textarea,
} from "@mantine/core";
import { CreditCard, Download, Lock } from "lucide-react";

import { AdvancedSection } from "@/components/advanced-section";
import { FormSection } from "@/components/form-section";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { NodeForm } from "@/pages/node/presentation";
import { type NodeRenewalCycle } from "@/pages/node/renewal";

interface NodeFormModalProps {
  dialogVisible: boolean;
  setDialogVisible: React.Dispatch<React.SetStateAction<boolean>>;
  dialogTitle: string;
  errors: Record<string, string>;
  form: NodeForm;
  setForm: React.Dispatch<React.SetStateAction<NodeForm>>;
  protocolControlsDisabled: boolean;
  protocolControlsReason: string;
  submitLoading: boolean;
  handleSubmit: () => Promise<void>;
}

export function NodeFormModal({
  dialogVisible,
  setDialogVisible,
  dialogTitle,
  errors,
  form,
  setForm,
  protocolControlsDisabled,
  protocolControlsReason,
  submitLoading,
  handleSubmit,
}: NodeFormModalProps) {
  return (
    <Modal
      opened={dialogVisible}
      size="xl"
      onClose={() => setDialogVisible(false)}
    >
      <ModalContent>
        <ModalHeader>{dialogTitle}</ModalHeader>
        <ModalBody>
          <div>
            <FormSection title="基本信息">
              <TextInput
                error={errors.name}
                label="节点名称"
                placeholder="请输入节点名称"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />

              <Textarea
                description="可记录供应商、用途、续费说明等补充信息"
                label="备注"
                maxRows={4}
                placeholder="例如: 搬瓦工年付，2026-12 续费，日本中转"
                value={form.remark}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, remark: e.target.value }))
                }
              />
            </FormSection>

            <FormSection
              description="系统按周期从基准时间自动推算下次续费，并在仪表盘提醒"
              title="续费"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  clearable
                  data={[
                    { value: "month", label: "月付" },
                    { value: "quarter", label: "季付" },
                    { value: "year", label: "年付" },
                  ]}
                  description="按月、季或年循环续费"
                  label="续费周期"
                  placeholder="选择续费周期"
                  value={form.renewalCycle ? form.renewalCycle : null}
                  onChange={(value) => {
                    const selected = value as NodeRenewalCycle | undefined;

                    setForm((prev) => ({
                      ...prev,
                      renewalCycle: selected || "",
                    }));
                  }}
                />

                <TextInput
                  description="最近一次续费或周期起始日期，例如月付填 2026-03-01 即按每月 1 日推算"
                  error={errors.expiryTime}
                  label="续费基准时间"
                  max="9999-12-31"
                  type="date"
                  value={
                    form.expiryTime > 0
                      ? new Date(form.expiryTime).toISOString().slice(0, 10)
                      : ""
                  }
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      expiryTime: e.target.value
                        ? new Date(e.target.value).getTime()
                        : 0,
                    }))
                  }
                />
              </div>
            </FormSection>

            <FormSection
              description="面板与转发规则使用的节点地址和端口范围"
              title="连接地址"
            >
              <TextInput
                description="可选：不带协议、不带端口。建议在 IPv4 和 IPv6 都未填写时使用。至少填写一个 IPv4/IPv6 域名"
                error={errors.serverHost}
                label="域名/主机名"
                placeholder="例如: test.example.com"
                value={form.serverHost}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, serverHost: e.target.value }))
                }
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  description="填写一个 IPv4 地址"
                  error={errors.serverIpV4}
                  label="IPv4 地址"
                  placeholder="例如: 192.168.1.100"
                  value={form.serverIpV4}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      serverIpV4: e.target.value,
                    }))
                  }
                />

                <TextInput
                  description="填写一个 IPv6 地址"
                  error={errors.serverIpV6}
                  label="IPv6 地址"
                  placeholder="例如: 2001:db8::10"
                  value={form.serverIpV6}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      serverIpV6: e.target.value,
                    }))
                  }
                />
              </div>

              <TextInput
                classNames={{
                  input: "font-mono",
                }}
                description="支持单个端口(80)、多个端口(80,443)或端口范围(10000-65535)，多个可用逗号分隔"
                error={errors.port}
                label="可用端口"
                placeholder="例如: 80,443,10000-65535"
                value={form.port}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, port: e.target.value }))
                }
              />
            </FormSection>

            <FormSection title="运行模式">
              <Select
                data={[
                  { value: "agent", label: "agent 模式" },
                  { value: "nftables", label: "nftables 模式" },
                ]}
                label="转发模式"
                value={form.forwardMode}
                onChange={(value) => {
                  const selected = value as NodeForm["forwardMode"] | undefined;

                  setForm((prev) => ({
                    ...prev,
                    forwardMode: selected || "agent",
                  }));
                }}
              />

              {form.forwardMode === "nftables" ? (
                <Alert color="orange">
                  {
                    "nftables 模式仅支持纯转发，不支持隧道、流量控制和 agent 安装，规则将由面板通过 SSH 下发。"
                  }
                </Alert>
              ) : (
                <Alert>
                  {"agent 模式会继续使用节点 agent 执行转发与管理操作。"}
                </Alert>
              )}
            </FormSection>

            {/* 高级配置 */}
            <section className="form-section">
              <AdvancedSection title="高级配置">
                <div className="space-y-4 pb-2">
                  {form.forwardMode === "nftables" ? (
                    <div className="space-y-4 rounded-xl border border-warning-line bg-warning-soft p-4">
                      <div>
                        <div className="text-sm font-medium text-warning-ink">
                          SSH 配置
                        </div>
                        <div className="text-xs text-default-500">
                          面板会通过 SSH 下发 nftables 规则，不会安装 agent。
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextInput
                          error={errors.sshHost}
                          label="SSH 主机"
                          placeholder="例如: 192.0.2.10"
                          value={form.sshHost}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              sshHost: e.target.value,
                            }))
                          }
                        />

                        <TextInput
                          error={errors.sshPort}
                          label="SSH 端口"
                          placeholder="22"
                          value={form.sshPort}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              sshPort: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextInput
                          error={errors.sshUsername}
                          label="SSH 用户名"
                          placeholder="例如: root"
                          value={form.sshUsername}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              sshUsername: e.target.value,
                            }))
                          }
                        />

                        <Select
                          data={[
                            { value: "private_key", label: "私钥" },
                            { value: "password", label: "密码" },
                          ]}
                          label="SSH 认证方式"
                          value={form.sshAuthType}
                          onChange={(value) => {
                            const selected = value as
                              | "password"
                              | "private_key"
                              | undefined;

                            setForm((prev) => ({
                              ...prev,
                              sshAuthType: selected || "private_key",
                            }));
                          }}
                        />
                      </div>

                      {form.sshAuthType === "password" ? (
                        <TextInput
                          error={errors.sshPassword}
                          label="SSH 密码"
                          placeholder="请输入 SSH 密码"
                          type="password"
                          value={form.sshPassword}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              sshPassword: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <Textarea
                          error={errors.sshPrivateKey}
                          label="SSH 私钥"
                          minRows={6}
                          placeholder="粘贴 PEM 格式私钥内容"
                          value={form.sshPrivateKey}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              sshPrivateKey: e.target.value,
                            }))
                          }
                        />
                      )}

                      <TextInput
                        label="SSH 私钥密码短语"
                        placeholder="可选"
                        type="password"
                        value={form.sshPassphrase}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            sshPassphrase: e.target.value,
                          }))
                        }
                      />

                      <Select
                        data={[
                          { value: "none", label: "无需提权" },
                          { value: "sudo", label: "sudo" },
                          { value: "sudo_su", label: "sudo su" },
                        ]}
                        label="sudo 提权方式"
                        value={form.sshSudoMode}
                        onChange={(value) => {
                          const selected = value as
                            | "none"
                            | "sudo"
                            | "sudo_su"
                            | undefined;

                          setForm((prev) => ({
                            ...prev,
                            sshSudoMode: selected || "none",
                          }));
                        }}
                      />
                    </div>
                  ) : (
                    <Alert>
                      {
                        "agent 模式下无需填写 SSH 配置；节点安装 agent 后会自行接管转发。"
                      }
                    </Alert>
                  )}

                  <TextInput
                    description="用于多IP服务器指定使用那个IP请求远程地址，不懂的默认为空就行"
                    error={errors.interfaceName}
                    label="出口网卡名或IP"
                    placeholder="请输入出口网卡名或IP"
                    value={form.interfaceName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        interfaceName: e.target.value,
                      }))
                    }
                  />

                  <TextInput
                    description="多IP服务器可填写额外IP地址，逗号分隔"
                    label="额外IP地址"
                    placeholder="例如: 192.168.1.100, 10.0.0.5"
                    value={form.extraIPs}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        extraIPs: e.target.value,
                      }))
                    }
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                      error={errors.tcpListenAddr}
                      label="TCP监听地址"
                      leftSection={
                        <div className="pointer-events-none flex items-center">
                          <span className="text-default-400 text-small">
                            TCP
                          </span>
                        </div>
                      }
                      placeholder="请输入TCP监听地址"
                      value={form.tcpListenAddr}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          tcpListenAddr: e.target.value,
                        }))
                      }
                    />

                    <TextInput
                      error={errors.udpListenAddr}
                      label="UDP监听地址"
                      leftSection={
                        <div className="pointer-events-none flex items-center">
                          <span className="text-default-400 text-small">
                            UDP
                          </span>
                        </div>
                      }
                      placeholder="请输入UDP监听地址"
                      value={form.udpListenAddr}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          udpListenAddr: e.target.value,
                        }))
                      }
                    />
                  </div>
                  {/* 屏蔽协议 */}
                  <div>
                    <div className="text-sm font-medium text-default-700 mb-2">
                      屏蔽协议
                    </div>
                    <div className="text-xs text-default-500 mb-2">
                      开启开关以屏蔽对应协议
                    </div>
                    {protocolControlsDisabled && (
                      <Alert className="mb-2" color="orange">
                        {protocolControlsReason}
                      </Alert>
                    )}
                    <div
                      className={`grid grid-cols-1 sm:grid-cols-3 gap-3 bg-content1 bg-content1 p-3 rounded-md border border-divider ${protocolControlsDisabled ? "opacity-70" : ""}`}
                    >
                      {/* HTTP tile */}
                      <div className="px-3 py-3 rounded-lg bg-content1 border border-divider hover:border-primary-line transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="w-4 h-4 text-default-500" />
                          <div className="text-sm font-medium text-default-700">
                            HTTP
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-default-500">
                            禁用/启用
                          </div>
                          <Switch
                            checked={form.http === 1}
                            disabled={protocolControlsDisabled}
                            size="sm"
                            onChange={({ currentTarget: { checked: v } }) =>
                              setForm((prev) => ({
                                ...prev,
                                http: v ? 1 : 0,
                              }))
                            }
                          />
                        </div>
                        <div className="mt-1 text-xs text-default-400">
                          {form.http === 1 ? "已开启" : "已关闭"}
                        </div>
                      </div>

                      {/* TLS tile */}
                      <div className="px-3 py-3 rounded-lg bg-content1 border border-divider hover:border-primary-line transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className="w-4 h-4 text-default-500" />
                          <div className="text-sm font-medium text-default-700">
                            TLS
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-default-500">
                            禁用/启用
                          </div>
                          <Switch
                            checked={form.tls === 1}
                            disabled={protocolControlsDisabled}
                            size="sm"
                            onChange={({ currentTarget: { checked: v } }) =>
                              setForm((prev) => ({
                                ...prev,
                                tls: v ? 1 : 0,
                              }))
                            }
                          />
                        </div>
                        <div className="mt-1 text-xs text-default-400">
                          {form.tls === 1 ? "已开启" : "已关闭"}
                        </div>
                      </div>

                      {/* SOCKS tile */}
                      <div className="px-3 py-3 rounded-lg bg-content1 border border-divider hover:border-primary-line transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <Download className="w-4 h-4 text-default-500" />
                          <div className="text-sm font-medium text-default-700">
                            SOCKS
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-default-500">
                            禁用/启用
                          </div>
                          <Switch
                            checked={form.socks === 1}
                            disabled={protocolControlsDisabled}
                            size="sm"
                            onChange={({ currentTarget: { checked: v } }) =>
                              setForm((prev) => ({
                                ...prev,
                                socks: v ? 1 : 0,
                              }))
                            }
                          />
                        </div>
                        <div className="mt-1 text-xs text-default-400">
                          {form.socks === 1 ? "已开启" : "已关闭"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Alert color="red">
                    {
                      "请不要在出口节点执行屏蔽协议，否则可能影响转发；屏蔽协议仅需在入口节点执行。"
                    }
                  </Alert>
                </div>
              </AdvancedSection>
            </section>

            <Alert className="mt-4">
              {"节点ip地址是你要添加的入口/出口的ip地址，不是面板的ip地址。"}
            </Alert>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="light"
            onClick={() => setDialogVisible(false)}
          >
            取消
          </Button>
          <Button loading={submitLoading} onClick={handleSubmit}>
            {submitLoading ? "提交中..." : "确定"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
