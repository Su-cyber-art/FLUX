import type * as React from "react";

import {
  ActionIcon,
  Button,
  Divider,
  MultiSelect,
  Select,
  Textarea,
  TextInput,
} from "@mantine/core";
import { Plus, X } from "lucide-react";

import { AdvancedSection } from "@/components/advanced-section";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {
  type ChainTunnel,
  type Node,
  type TunnelForm,
} from "@/pages/tunnel/presentation";

interface TunnelFormModalProps {
  modalOpen: boolean;
  setModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isEdit: boolean;
  errors: { [key: string]: string };
  form: TunnelForm;
  setForm: React.Dispatch<React.SetStateAction<TunnelForm>>;
  handleTypeChange: (type: number) => void;
  nodeOptions: (
    disabledIds: string[],
  ) => { value: string; label: string; disabled: boolean }[];
  nodes: Node[];
  getSelectedChainNodeIds: () => number[];
  toSelectedNodeIds: (keys: Iterable<unknown>) => number[];
  mergeOrderedNodes: (
    currentNodes: ChainTunnel[],
    selectedNodeIds: number[],
    buildDefault: (nodeId: number) => ChainTunnel,
  ) => ChainTunnel[];
  getChainGroups: () => ChainTunnel[][];
  getCommonIpOptions: (nodeIds: number[]) => string[];
  removeChainNode: (groupIndex: number) => void;
  syncChainGroupNodes: (groupIndex: number, selectedNodeIds: number[]) => void;
  updateChainProtocol: (groupIndex: number, protocol: string) => void;
  updateChainStrategy: (groupIndex: number, strategy: string) => void;
  updateChainConnectIp: (groupIndex: number, connectIp: string) => void;
  submitLoading: boolean;
  handleSubmit: () => Promise<void>;
}

export function TunnelFormModal({
  modalOpen,
  setModalOpen,
  isEdit,
  errors,
  form,
  setForm,
  handleTypeChange,
  nodeOptions,
  nodes,
  getSelectedChainNodeIds,
  toSelectedNodeIds,
  mergeOrderedNodes,
  getChainGroups,
  getCommonIpOptions,
  removeChainNode,
  syncChainGroupNodes,
  updateChainProtocol,
  updateChainStrategy,
  updateChainConnectIp,
  submitLoading,
  handleSubmit,
}: TunnelFormModalProps) {
  return (
    <Modal opened={modalOpen} size="2xl" onClose={() => setModalOpen(false)}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">
            {isEdit ? "编辑隧道" : "新增隧道"}
          </h2>
          <p className="text-small text-default-500">
            {isEdit
              ? "修改节点配置会中断现有连接，隧道类型不可修改"
              : "创建新的隧道配置"}
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                error={errors.name}
                label="隧道名称"
                placeholder="请输入隧道名称"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />

              <Select
                data={[
                  { value: "1", label: "端口转发" },
                  { value: "2", label: "隧道转发" },
                ]}
                disabled={isEdit}
                error={errors.type}
                label="隧道类型"
                placeholder="请选择隧道类型"
                value={form.type.toString()}
                onChange={(value) => {
                  const selectedKey = value as string;

                  if (selectedKey) {
                    handleTypeChange(parseInt(selectedKey));
                  }
                }}
              />
            </div>

            <Divider />
            <h3 className="text-sm font-semibold text-foreground">入口配置</h3>

            <div className="space-y-2">
              <MultiSelect
                searchable
                data={nodeOptions([
                  ...nodes
                    .filter(
                      (node) =>
                        node.status !== 1 &&
                        !(
                          isEdit &&
                          form.inNodeId.some((ct) => ct.nodeId === node.id)
                        ),
                    )
                    .map((node) => node.id.toString()),
                  ...(form.outNodeId || []).map((ct) => ct.nodeId.toString()),
                  ...getSelectedChainNodeIds().map((id) => id.toString()),
                ])}
                error={errors.inNodeId}
                label="入口节点"
                placeholder="请选择入口节点（可多选）"
                value={form.inNodeId.map((ct) => ct.nodeId.toString())}
                onChange={(values) => {
                  const selectedIds = toSelectedNodeIds(values);

                  setForm((prev) => ({
                    ...prev,
                    inNodeId: mergeOrderedNodes(
                      prev.inNodeId,
                      selectedIds,
                      (nodeId) => ({ nodeId, chainType: 1 }),
                    ),
                  }));
                }}
              />
            </div>

            {/* 隧道转发时显示转发链配置 */}
            {form.type === 2 && (
              <>
                <Divider />
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    转发链配置
                  </h3>
                  <Button
                    leftSection={<Plus className="w-4 h-4" />}
                    size="xs"
                    variant="light"
                    onClick={() => {
                      // 添加新的一跳（一个空组，或包含占位节点）
                      setForm((prev) => ({
                        ...prev,
                        chainNodes: [
                          ...(prev.chainNodes || []),
                          [
                            {
                              nodeId: -1,
                              chainType: 2,
                              protocol: "tls",
                              strategy: "round",
                            },
                          ],
                        ],
                      }));
                    }}
                  >
                    添加一跳
                  </Button>
                </div>

                {getChainGroups().length > 0 && (
                  <div className="space-y-3">
                    {getChainGroups().map((groupNodes, groupIndex) => {
                      const protocol =
                        groupNodes.length > 0
                          ? groupNodes[0].protocol || "tls"
                          : "tls";
                      const strategy =
                        groupNodes.length > 0
                          ? groupNodes[0].strategy || "round"
                          : "round";
                      const groupSelectedNodeIds = groupNodes
                        .filter((ct) => ct.nodeId !== -1)
                        .map((ct) => ct.nodeId);
                      const groupIpOptions =
                        getCommonIpOptions(groupSelectedNodeIds);
                      const isMultiNodeGroup = groupSelectedNodeIds.length > 1;
                      const selectedGroupConnectIp =
                        groupNodes.length > 0
                          ? groupNodes[0].connectIp || ""
                          : "";

                      return (
                        <div
                          key={groupIndex}
                          className="border border-default-200 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-default-600">
                              第{groupIndex + 1}跳
                            </span>
                            <ActionIcon
                              aria-label={`删除第${groupIndex + 1}跳`}
                              color="red"
                              size={30}
                              variant="subtle"
                              onClick={() => removeChainNode(groupIndex)}
                            >
                              <X className="w-4 h-4" />
                            </ActionIcon>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            {/* 节点选择 - 移动端100%，桌面端50% */}
                            <div className="col-span-1 md:col-span-2">
                              <MultiSelect
                                searchable
                                comboboxProps={{
                                  position: "top",
                                }}
                                data={nodeOptions([
                                  ...nodes
                                    .filter(
                                      (node) =>
                                        node.status !== 1 &&
                                        !(
                                          isEdit &&
                                          groupNodes.some(
                                            (ct) =>
                                              ct.nodeId === node.id &&
                                              ct.nodeId !== -1,
                                          )
                                        ),
                                    )
                                    .map((node) => node.id.toString()),
                                  ...form.inNodeId.map((ct) =>
                                    ct.nodeId.toString(),
                                  ),
                                  ...(form.outNodeId || []).map((ct) =>
                                    ct.nodeId.toString(),
                                  ),
                                  // 排除其他跳数已选的节点
                                  ...(form.chainNodes || [])
                                    .flatMap((group, idx) =>
                                      idx !== groupIndex
                                        ? group.map((ct) => ct.nodeId)
                                        : [],
                                    )
                                    .filter((id) => id !== -1)
                                    .map((id) => id.toString()),
                                ])}
                                label="节点"
                                placeholder="选择节点（可多选）"
                                size="sm"
                                value={groupNodes
                                  .filter((ct) => ct.nodeId !== -1)
                                  .map((ct) => ct.nodeId.toString())}
                                onChange={(values) => {
                                  syncChainGroupNodes(
                                    groupIndex,
                                    toSelectedNodeIds(values),
                                  );
                                }}
                              />
                            </div>

                            {/* 协议选择 - 25% */}
                            <Select
                              data={[
                                { value: "tls", label: "TLS" },
                                { value: "wss", label: "WSS" },
                                { value: "tcp", label: "TCP" },
                                { value: "mtls", label: "MTLS" },
                                { value: "mwss", label: "MWSS" },
                                { value: "mtcp", label: "MTCP" },
                                { value: "kcp", label: "KCP" },
                              ]}
                              label="协议"
                              placeholder="选择协议"
                              size="sm"
                              value={protocol}
                              onChange={(value) => {
                                const selectedKey = value as string;

                                if (selectedKey) {
                                  updateChainProtocol(groupIndex, selectedKey);
                                }
                              }}
                            />

                            {/* 负载策略 - 25% */}
                            <Select
                              data={[
                                { value: "fifo", label: "主备" },
                                { value: "round", label: "轮询" },
                                { value: "rand", label: "随机" },
                              ]}
                              label="负载策略"
                              placeholder="选择策略"
                              size="sm"
                              value={strategy}
                              onChange={(value) => {
                                const selectedKey = value as string;

                                if (selectedKey) {
                                  updateChainStrategy(groupIndex, selectedKey);
                                }
                              }}
                            />
                          </div>

                          {/* 连接IP - 转发链节点 */}
                          <Select
                            searchable
                            data={[
                              {
                                value: "__default__",
                                label: "默认连接IP",
                              },
                              ...groupIpOptions.map((ip) => ({
                                value: String(ip),
                                label: ip,
                              })),
                            ]}
                            description={
                              isMultiNodeGroup
                                ? "多节点跳不支持设置自定义连接IP，使用各节点默认IP"
                                : "按当前跳所选节点的共有IP进行选择，留空使用默认"
                            }
                            disabled={
                              groupSelectedNodeIds.length === 0 ||
                              groupIpOptions.length === 0 ||
                              isMultiNodeGroup
                            }
                            label="连接IP"
                            placeholder={
                              isMultiNodeGroup
                                ? "多节点跳使用节点默认IP"
                                : groupSelectedNodeIds.length === 0
                                  ? "请先选择节点"
                                  : groupIpOptions.length > 0
                                    ? "选择连接IP"
                                    : "所选节点无共同可选IP"
                            }
                            size="sm"
                            value={selectedGroupConnectIp || "__default__"}
                            onChange={(value) => {
                              const selectedKey = value as string;

                              updateChainConnectIp(
                                groupIndex,
                                selectedKey === "__default__"
                                  ? ""
                                  : selectedKey,
                              );
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {getChainGroups().length === 0 && (
                  <div className="text-center py-8 rounded-lg border border-dashed border-divider text-default-500">
                    <p className="text-sm text-default-500">
                      还没有添加转发链，点击上方&quot;添加一跳&quot;按钮开始添加
                    </p>
                  </div>
                )}
              </>
            )}

            {/* 隧道转发时显示出口配置 */}
            {form.type === 2 && (
              <>
                <Divider />
                <h3 className="text-sm font-semibold text-foreground">
                  出口配置
                </h3>

                {(() => {
                  const selectedOutNodeIds = (form.outNodeId || [])
                    .filter((ct) => ct.nodeId !== -1)
                    .map((ct) => ct.nodeId);
                  const isMultiExit = selectedOutNodeIds.length > 1;
                  const commonOutIpOptions =
                    getCommonIpOptions(selectedOutNodeIds);

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        {/* 节点选择 - 移动端100%，桌面端50% */}
                        <div className="col-span-1 md:col-span-2">
                          <MultiSelect
                            searchable
                            comboboxProps={{
                              position: "top",
                            }}
                            data={nodeOptions([
                              ...nodes
                                .filter(
                                  (node) =>
                                    node.status !== 1 &&
                                    !(
                                      isEdit &&
                                      (form.outNodeId || []).some(
                                        (ct) =>
                                          ct.nodeId === node.id &&
                                          ct.nodeId !== -1,
                                      )
                                    ),
                                )
                                .map((node) => node.id.toString()),
                              ...form.inNodeId.map((ct) =>
                                ct.nodeId.toString(),
                              ),
                              ...getSelectedChainNodeIds().map((id) =>
                                id.toString(),
                              ),
                            ])}
                            error={errors.outNodeId}
                            label="节点"
                            placeholder="请选择出口节点（可多选）"
                            value={
                              form.outNodeId
                                ? form.outNodeId
                                    .filter((ct) => ct.nodeId !== -1)
                                    .map((ct) => ct.nodeId.toString())
                                : []
                            }
                            onChange={(values) => {
                              const selectedIds = toSelectedNodeIds(values);

                              setForm((prev) => {
                                const currentOutNodes = prev.outNodeId || [];
                                const protocol =
                                  currentOutNodes[0]?.protocol || "tls";
                                const strategy =
                                  currentOutNodes[0]?.strategy || "round";
                                const realNodes = currentOutNodes.filter(
                                  (ct) => ct.nodeId !== -1,
                                );

                                return {
                                  ...prev,
                                  outNodeId: mergeOrderedNodes(
                                    realNodes,
                                    selectedIds,
                                    (nodeId) => ({
                                      nodeId,
                                      chainType: 3,
                                      protocol,
                                      strategy,
                                    }),
                                  ),
                                };
                              });
                            }}
                          />
                        </div>

                        {/* 协议选择 - 25% */}
                        <Select
                          data={[
                            { value: "tls", label: "TLS" },
                            { value: "wss", label: "WSS" },
                            { value: "tcp", label: "TCP" },
                            { value: "mtls", label: "MTLS" },
                            { value: "mwss", label: "MWSS" },
                            { value: "mtcp", label: "MTCP" },
                            { value: "kcp", label: "KCP" },
                          ]}
                          error={errors.protocol}
                          label="协议"
                          placeholder="选择协议"
                          value={(() => {
                            if (!form.outNodeId || form.outNodeId.length === 0)
                              return "tls";

                            return form.outNodeId[0].protocol || "tls";
                          })()}
                          onChange={(value) => {
                            const selectedKey = value as string;

                            if (selectedKey) {
                              setForm((prev) => {
                                const currentOutNodes = prev.outNodeId || [];
                                const currentStrategy =
                                  currentOutNodes.length > 0
                                    ? currentOutNodes[0].strategy || "round"
                                    : "round";

                                if (currentOutNodes.length === 0) {
                                  // 如果还没有出口节点，创建一个占位节点保存设置
                                  return {
                                    ...prev,
                                    outNodeId: [
                                      {
                                        nodeId: -1,
                                        chainType: 3,
                                        protocol: selectedKey,
                                        strategy: currentStrategy,
                                      },
                                    ],
                                  };
                                }

                                // 更新所有出口节点的协议
                                return {
                                  ...prev,
                                  outNodeId: currentOutNodes.map((ct) => ({
                                    ...ct,
                                    protocol: selectedKey,
                                  })),
                                };
                              });
                            }
                          }}
                        />

                        {/* 负载策略 - 25% */}
                        <Select
                          data={[
                            { value: "fifo", label: "主备" },
                            { value: "round", label: "轮询" },
                            { value: "rand", label: "随机" },
                            { value: "best", label: "最优" },
                          ]}
                          label="负载策略"
                          placeholder="选择策略"
                          value={(() => {
                            if (!form.outNodeId || form.outNodeId.length === 0)
                              return "round";

                            return form.outNodeId[0].strategy || "round";
                          })()}
                          onChange={(value) => {
                            const selectedKey = value as string;

                            if (selectedKey) {
                              setForm((prev) => {
                                const currentOutNodes = prev.outNodeId || [];
                                const currentProtocol =
                                  currentOutNodes.length > 0
                                    ? currentOutNodes[0].protocol || "tls"
                                    : "tls";

                                if (currentOutNodes.length === 0) {
                                  return {
                                    ...prev,
                                    outNodeId: [
                                      {
                                        nodeId: -1,
                                        chainType: 3,
                                        protocol: currentProtocol,
                                        strategy: selectedKey,
                                      },
                                    ],
                                  };
                                }

                                return {
                                  ...prev,
                                  outNodeId: currentOutNodes.map((ct) => ({
                                    ...ct,
                                    strategy: selectedKey,
                                  })),
                                };
                              });
                            }
                          }}
                        />
                      </div>

                      {/* 连接IP - 出口节点 */}
                      <Select
                        searchable
                        data={[
                          { value: "__default__", label: "默认连接IP" },
                          ...commonOutIpOptions.map((ip) => ({
                            value: String(ip),
                            label: ip,
                          })),
                        ]}
                        description={
                          isMultiExit
                            ? "多出口隧道不支持设置自定义连接IP，使用各节点默认IP"
                            : "按出口节点共同可用IP选择，留空使用默认"
                        }
                        disabled={
                          selectedOutNodeIds.length === 0 ||
                          commonOutIpOptions.length === 0 ||
                          isMultiExit
                        }
                        label="连接IP"
                        placeholder={
                          isMultiExit
                            ? "多出口隧道使用节点默认IP"
                            : selectedOutNodeIds.length === 0
                              ? "请先选择出口节点"
                              : commonOutIpOptions.length > 0
                                ? "选择连接IP"
                                : "所选节点无共同可选IP"
                        }
                        size="sm"
                        value={
                          form.outNodeId && form.outNodeId.length > 0
                            ? form.outNodeId[0].connectIp || "__default__"
                            : "__default__"
                        }
                        onChange={(selectedKey) => {
                          const value =
                            !selectedKey || selectedKey === "__default__"
                              ? ""
                              : selectedKey;

                          setForm((prev) => {
                            const currentOutNodes = prev.outNodeId || [];

                            if (currentOutNodes.length === 0) {
                              return {
                                ...prev,
                                outNodeId: [
                                  {
                                    nodeId: -1,
                                    chainType: 3,
                                    protocol: "tls",
                                    strategy: "round",
                                    connectIp: value,
                                  },
                                ],
                              };
                            }

                            return {
                              ...prev,
                              outNodeId: currentOutNodes.map((ct) => ({
                                ...ct,
                                connectIp: value,
                              })),
                            };
                          });
                        }}
                      />
                    </>
                  );
                })()}
              </>
            )}

            <AdvancedSection title="高级设置">
              <div className="space-y-4 pb-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    data={[
                      { value: "1", label: "单向计算（仅上传）" },
                      { value: "2", label: "双向计算（上传+下载）" },
                    ]}
                    error={errors.flow}
                    label="流量计算"
                    placeholder="请选择流量计算方式"
                    value={form.flow.toString()}
                    onChange={(value) => {
                      const selectedKey = value as string;

                      if (selectedKey) {
                        setForm((prev) => ({
                          ...prev,
                          flow: parseInt(selectedKey),
                        }));
                      }
                    }}
                  />

                  <TextInput
                    error={errors.trafficRatio}
                    label="流量倍率"
                    max={100}
                    min={0.01}
                    placeholder="例如：0.5 或 1 或 2"
                    step="any"
                    type="number"
                    value={form.trafficRatio.toString()}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        trafficRatio: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>

                <Textarea
                  description="入口IP由系统自动从入口节点采集，无需手动填写。支持多个IP，每行一个地址，留空则使用入口节点IP"
                  error={errors.inIp}
                  label="入口IP"
                  maxRows={5}
                  placeholder="一行一个IP地址或域名，例如:&#10;192.168.1.100&#10;example.com"
                  value={form.inIp}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      inIp: e.target.value,
                    }))
                  }
                />

                {form.type === 2 && (
                  <Select
                    data={[
                      { value: "v4", label: "优先IPv4" },
                      { value: "v6", label: "优先IPv6" },
                    ]}
                    description="当节点同时拥有IPv4和IPv6地址时，选择隧道连接使用的地址类型"
                    label="隧道连接地址偏好"
                    placeholder="自动选择"
                    value={form.ipPreference || ""}
                    onChange={(value) => {
                      const selectedKey = value as string;

                      setForm((prev) => ({
                        ...prev,
                        ipPreference: selectedKey || "",
                      }));
                    }}
                  />
                )}

                <div>
                  <div className="text-sm font-medium">质量检测目标</div>
                  <p className="text-xs text-default-500 mt-0.5">
                    用于实时隧道质量检测、诊断目标和 best 最优出口评分，留空使用
                    www.bing.com:443
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3">
                  <TextInput
                    error={errors.probeTargetHost}
                    label="Host"
                    placeholder="www.bing.com"
                    value={form.probeTargetHost || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        probeTargetHost: e.target.value,
                      }))
                    }
                  />
                  <TextInput
                    error={errors.probeTargetPort}
                    label="Port"
                    max={65535}
                    min={1}
                    placeholder="443"
                    type="number"
                    value={
                      form.probeTargetPort ? String(form.probeTargetPort) : ""
                    }
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        probeTargetPort: e.target.value
                          ? Number(e.target.value)
                          : 0,
                      }))
                    }
                  />
                </div>
              </div>
            </AdvancedSection>
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
            {submitLoading
              ? isEdit
                ? "更新中..."
                : "创建中..."
              : isEdit
                ? "更新"
                : "创建"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
