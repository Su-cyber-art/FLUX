import { useState, useEffect, useCallback } from "react";
import {
  ActionIcon,
  SegmentedControl,
  Tooltip,
  Button,
  Badge,
  TextInput,
  Select,
} from "@mantine/core";
import {
  Copy,
  Download,
  KeyRound,
  Plus,
  RotateCcw,
  Server,
  Share2,
  SquarePen,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { toast } from "@/lib/notifications";
import { PageToolbar } from "@/components/page-toolbar";
import { AnimatedPage } from "@/components/animated-page";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyStateCard, PageLoadingState } from "@/components/page-state";
import { UsageMeter } from "@/components/usage-meter";
import { Card } from "@/components/ui/card";
import { TrafficLimitField } from "@/components/traffic-limit-field";
import {
  formatTraffic,
  MIB,
  parseTrafficInput,
  preferredTrafficUnit,
  TRAFFIC_UNIT_MIB,
  type TrafficUnit,
} from "@/utils/traffic";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import {
  getNodeList,
  createPeerShare,
  getPeerShareList,
  deletePeerShare,
  resetPeerShareFlow,
  getPeerRemoteUsageList,
  importRemoteNode,
  updatePeerShare,
} from "@/api";
import { uiColor } from "@/components/ui/shared";

interface Node {
  id: number;
  name: string;
  isRemote?: number;
}

interface PeerShare {
  id: number;
  name: string;
  token: string;
  maxBandwidth: number;
  currentFlow: number;
  expiryTime: number;
  portRangeStart: number;
  portRangeEnd: number;
  isActive: number;
  allowedDomains?: string;
  allowedIps?: string;
  usedPorts?: number[];
  usedPortDetails?: Array<{
    runtimeId: number;
    port: number;
    role: string;
    protocol: string;
    resourceKey: string;
    applied: number;
    updatedTime: number;
  }>;
  activeRuntimeNum?: number;
}

interface RemoteUsageBinding {
  bindingId: number;
  tunnelId: number;
  tunnelName: string;
  chainType: number;
  hopInx: number;
  allocatedPort: number;
  resourceKey: string;
  remoteBindingId: string;
  updatedTime: number;
}

interface RemoteUsageNode {
  nodeId: number;
  nodeName: string;
  remoteUrl: string;
  shareId: number;
  portRangeStart: number;
  portRangeEnd: number;
  maxBandwidth: number;
  currentFlow: number;
  usedPorts: number[];
  bindings: RemoteUsageBinding[];
  activeBindingNum: number;
  syncError?: string;
}

const MAX_SAFE_BANDWIDTH_MIB = Math.floor(Number.MAX_SAFE_INTEGER / MIB);

export default function PanelSharingPage() {
  const [selectedTab, setSelectedTab] = useState("my-shares");
  const [shares, setShares] = useState<PeerShare[]>([]);
  const [remoteUsageNodes, setRemoteUsageNodes] = useState<RemoteUsageNode[]>(
    [],
  );
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [remoteUsageLoading, setRemoteUsageLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    kind: "delete" | "reset";
    share: PeerShare;
  } | null>(null);
  const [pendingActionLoading, setPendingActionLoading] = useState(false);

  // Modals
  const [createShareOpen, setCreateShareOpen] = useState(false);
  const [editShareOpen, setEditShareOpen] = useState(false);
  const [importNodeOpen, setImportNodeOpen] = useState(false);

  // Forms
  const [shareForm, setShareForm] = useState({
    name: "",
    nodeId: "",
    maxBandwidth: 0,
    expiryDays: 30,
    portRangeStart: 10000,
    portRangeEnd: 20000,
    allowedDomains: "",
    allowedIps: "",
  });
  const [shareUnit, setShareUnit] = useState<TrafficUnit>("GB");

  const [importForm, setImportForm] = useState({
    remoteUrl: "",
    token: "",
  });

  const [editForm, setEditForm] = useState({
    id: 0,
    name: "",
    maxBandwidth: 0,
    expiryTime: 0,
    portRangeStart: 10000,
    portRangeEnd: 20000,
    allowedDomains: "",
    allowedIps: "",
  });
  const [editUnit, setEditUnit] = useState<TrafficUnit>("GB");
  const [editOriginalMaxBandwidth, setEditOriginalMaxBandwidth] = useState(0);
  const [editBandwidthChanged, setEditBandwidthChanged] = useState(false);

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPeerShareList();

      if (res.code === 0) {
        setShares(
          Array.isArray(res.data) ? (res.data as unknown as PeerShare[]) : [],
        );
      } else {
        toast.error(res.msg || "加载分享列表失败");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNodes = useCallback(async () => {
    try {
      const res = await getNodeList();

      if (res.code === 0) {
        const localNodes: Node[] = (
          Array.isArray(res.data) ? (res.data as Node[]) : []
        ).filter((node: Node) => (node?.isRemote ?? 0) !== 1);

        setNodes(localNodes);
        setShareForm((prev) => {
          if (!prev.nodeId) {
            return prev;
          }
          const hasSelectedNode = localNodes.some(
            (node: Node) => String(node.id) === prev.nodeId,
          );

          return hasSelectedNode ? prev : { ...prev, nodeId: "" };
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const loadRemoteUsage = useCallback(async () => {
    setRemoteUsageLoading(true);
    try {
      const res = await getPeerRemoteUsageList();

      if (res.code === 0) {
        setRemoteUsageNodes(
          Array.isArray(res.data)
            ? (res.data as unknown as RemoteUsageNode[])
            : [],
        );
      } else {
        toast.error(res.msg || "加载远程占用端口失败");
      }
    } finally {
      setRemoteUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTab === "my-shares") {
      loadShares();
      loadNodes();

      return;
    }
    if (selectedTab === "remote-nodes") {
      loadRemoteUsage();
    }
  }, [selectedTab, loadShares, loadNodes, loadRemoteUsage]);

  const handleCreateShare = async () => {
    if (!shareForm.name || !shareForm.nodeId) {
      toast.error("请填写必要信息");

      return;
    }
    const nodeId = parseInt(shareForm.nodeId, 10);

    if (Number.isNaN(nodeId) || !nodes.some((node) => node.id === nodeId)) {
      toast.error("仅可选择本地节点");

      return;
    }
    const limitMiB =
      shareForm.maxBandwidth === 0
        ? 0
        : parseTrafficInput(String(shareForm.maxBandwidth), shareUnit);

    if (
      limitMiB === null ||
      limitMiB > MAX_SAFE_BANDWIDTH_MIB ||
      shareForm.maxBandwidth < 0
    ) {
      toast.error("请输入有效的流量上限，0 表示不限流量");

      return;
    }
    try {
      const expiryTime =
        Date.now() + shareForm.expiryDays * 24 * 60 * 60 * 1000;
      const res = await createPeerShare({
        name: shareForm.name,
        nodeId,
        maxBandwidth: limitMiB * MIB,
        expiryTime: shareForm.expiryDays === 0 ? 0 : expiryTime,
        portRangeStart: shareForm.portRangeStart,
        portRangeEnd: shareForm.portRangeEnd,
        allowedDomains: shareForm.allowedDomains,
        allowedIps: shareForm.allowedIps,
      });

      if (res.code === 0) {
        toast.success("创建成功");
        setCreateShareOpen(false);
        loadShares();
      } else {
        toast.error(res.msg || "创建失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleDeleteShare = async (id: number) => {
    try {
      const res = await deletePeerShare(id);

      if (res.code === 0) {
        toast.success("删除成功");
        loadShares();
      } else {
        toast.error(res.msg || "删除失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleResetShareFlow = async (id: number) => {
    try {
      const res = await resetPeerShareFlow(id);

      if (res.code === 0) {
        toast.success("共享流量已重置");
        loadShares();
      } else {
        toast.error(res.msg || "重置流量失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const openEditShare = (share: PeerShare) => {
    const mib = share.maxBandwidth / MIB;
    const unit = preferredTrafficUnit(mib);

    setEditUnit(unit);
    setEditOriginalMaxBandwidth(share.maxBandwidth);
    setEditBandwidthChanged(false);
    setEditForm({
      id: share.id,
      name: share.name,
      maxBandwidth: share.maxBandwidth > 0 ? mib / TRAFFIC_UNIT_MIB[unit] : 0,
      expiryTime: share.expiryTime,
      portRangeStart: share.portRangeStart,
      portRangeEnd: share.portRangeEnd,
      allowedDomains: share.allowedDomains || "",
      allowedIps: share.allowedIps || "",
    });
    setEditShareOpen(true);
  };

  const handleEditShare = async () => {
    if (!editForm.name) {
      toast.error("名称不能为空");

      return;
    }
    const limitMiB =
      editForm.maxBandwidth === 0
        ? 0
        : parseTrafficInput(String(editForm.maxBandwidth), editUnit);

    if (
      editBandwidthChanged &&
      (limitMiB === null ||
        limitMiB > MAX_SAFE_BANDWIDTH_MIB ||
        editForm.maxBandwidth < 0)
    ) {
      toast.error("请输入有效的流量上限，0 表示不限流量");

      return;
    }
    try {
      const res = await updatePeerShare({
        id: editForm.id,
        name: editForm.name,
        maxBandwidth: editBandwidthChanged
          ? (limitMiB as number) * MIB
          : editOriginalMaxBandwidth,
        expiryTime: editForm.expiryTime,
        portRangeStart: editForm.portRangeStart,
        portRangeEnd: editForm.portRangeEnd,
        allowedDomains: editForm.allowedDomains,
        allowedIps: editForm.allowedIps,
      });

      if (res.code === 0) {
        toast.success("编辑成功");
        setEditShareOpen(false);
        loadShares();
      } else {
        toast.error(res.msg || "编辑失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleImportNode = async () => {
    if (!importForm.remoteUrl || !importForm.token) {
      toast.error("请填写完整信息");

      return;
    }
    try {
      // Automatically add http/https if missing
      let url = importForm.remoteUrl.trim();

      if (!url.startsWith("http")) {
        url = "http://" + url;
      }

      const res = await importRemoteNode({
        remoteUrl: url,
        token: importForm.token.trim(),
      });

      if (res.code === 0) {
        toast.success("导入成功，请前往节点列表查看");
        setImportNodeOpen(false);
        setImportForm({ remoteUrl: "", token: "" });
        loadRemoteUsage();
      } else {
        toast.error(res.msg || "导入失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token已复制");
  };

  const formatFlowGB = formatTraffic;

  const formatChainType = (chainType: number, hopInx: number) => {
    if (chainType === 1) {
      return "入口节点";
    }
    if (chainType === 2) {
      return `中继跳点 #${hopInx}`;
    }
    if (chainType === 3) {
      return "出口节点";
    }

    return "未知链路";
  };

  const portTotal = (start: number, end: number) =>
    start > 0 && end >= start ? end - start + 1 : 0;
  const syncErrorText = (syncError: string) =>
    syncError === "provider_share_deleted"
      ? "提供方已删除该分享"
      : syncError === "provider_share_disabled"
        ? "提供方已禁用该分享"
        : syncError === "provider_share_expired"
          ? "提供方分享已过期"
          : `远程同步失败: ${syncError}`;
  const shareExpiry = (share: PeerShare) => {
    if (!share.expiryTime)
      return { tone: "success" as const, text: "长期有效" };
    if (share.expiryTime < Date.now()) {
      return { tone: "danger" as const, text: "已过期" };
    }

    return {
      tone: "default" as const,
      text: `${new Date(share.expiryTime).toLocaleDateString("zh-CN")} 到期`,
    };
  };
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setPendingActionLoading(true);
    try {
      if (pendingAction.kind === "delete") {
        await handleDeleteShare(pendingAction.share.id);
      } else {
        await handleResetShareFlow(pendingAction.share.id);
      }
    } finally {
      setPendingActionLoading(false);
      setPendingAction(null);
    }
  };

  return (
    <AnimatedPage>
      <PageToolbar
        primary={
          selectedTab === "my-shares"
            ? {
                label: "创建分享",
                icon: <Plus size={16} />,
                onClick: () => setCreateShareOpen(true),
              }
            : {
                label: "导入远程节点",
                icon: <Download size={16} />,
                onClick: () => setImportNodeOpen(true),
              }
        }
        tabs={
          <SegmentedControl
            aria-label="面板共享类型"
            data={[
              { value: "my-shares", label: `我分享的 ${shares.length}` },
              {
                value: "remote-nodes",
                label: `远程接入 ${remoteUsageNodes.length}`,
              },
            ]}
            size="sm"
            value={selectedTab}
            onChange={setSelectedTab}
          />
        }
      />

      <p className="-mt-1 mb-4 text-xs text-default-500">
        {selectedTab === "my-shares"
          ? "把本地节点开放给其他面板使用，按分享统一管理 Token、端口范围、流量上限与到期时间。"
          : "导入其他面板分享的节点后，可以在这里查看远端端口占用、绑定的隧道与同步状态。"}
      </p>

      {selectedTab === "my-shares" ? (
        loading ? (
          <PageLoadingState message="正在加载..." />
        ) : shares.length === 0 ? (
          <EmptyStateCard
            action={
              <Button
                leftSection={<Plus size={16} />}
                onClick={() => setCreateShareOpen(true)}
              >
                创建分享
              </Button>
            }
            description="创建分享后，把生成的 Token 交给对方面板导入即可。"
            icon={<Share2 size={20} />}
            title="还没有分享"
          />
        ) : (
          <div className="access-grid share-grid">
            {shares.map((share) => {
              const expiry = shareExpiry(share);
              const totalPorts = portTotal(
                share.portRangeStart,
                share.portRangeEnd,
              );
              const usedPorts = share.usedPorts?.length ?? 0;
              const flowLimited = share.maxBandwidth > 0;
              const portDetails = share.usedPortDetails ?? [];
              const portDetailText = portDetails
                .map((item) => `${item.port} ${item.role || "reserved"}`)
                .join(" · ");

              return (
                <Card key={share.id} className="share-card">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className="truncate text-[13.5px] font-semibold text-foreground"
                        title={share.name}
                      >
                        {share.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        {expiry.tone === "danger" ? (
                          <Badge
                            color={uiColor("danger")}
                            size="sm"
                            variant="light"
                          >
                            {expiry.text}
                          </Badge>
                        ) : (
                          <span className="text-xs text-default-500">
                            {expiry.text}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="access-actions">
                      <Tooltip label="编辑">
                        <ActionIcon
                          aria-label={`编辑分享 ${share.name}`}
                          color="gray"
                          variant="subtle"
                          onClick={() => openEditShare(share)}
                        >
                          <SquarePen size={15} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="重置流量">
                        <ActionIcon
                          aria-label={`重置分享 ${share.name} 的流量`}
                          color="gray"
                          variant="subtle"
                          onClick={() =>
                            setPendingAction({ kind: "reset", share })
                          }
                        >
                          <RotateCcw size={15} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="删除分享">
                        <ActionIcon
                          aria-label={`删除分享 ${share.name}`}
                          color="red"
                          variant="subtle"
                          onClick={() =>
                            setPendingAction({ kind: "delete", share })
                          }
                        >
                          <Trash2 size={15} />
                        </ActionIcon>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <UsageMeter
                      label="流量"
                      limit={
                        flowLimited ? formatFlowGB(share.maxBandwidth) : "不限"
                      }
                      percent={
                        flowLimited
                          ? Math.min(
                              ((share.currentFlow || 0) / share.maxBandwidth) *
                                100,
                              100,
                            )
                          : 0
                      }
                      unlimited={!flowLimited}
                      used={formatFlowGB(share.currentFlow || 0)}
                    />
                    <UsageMeter
                      label="端口"
                      limit={totalPorts || "-"}
                      percent={
                        totalPorts > 0
                          ? Math.min((usedPorts / totalPorts) * 100, 100)
                          : 0
                      }
                      used={usedPorts}
                    />
                  </div>

                  <dl className="share-meta">
                    <div>
                      <dt>端口范围</dt>
                      <dd className="mono-value">
                        {share.portRangeStart}–{share.portRangeEnd}
                      </dd>
                    </div>
                    <div>
                      <dt>运行中绑定</dt>
                      <dd className="tabular-nums">
                        {share.activeRuntimeNum ?? 0}
                      </dd>
                    </div>
                    {share.allowedDomains && (
                      <div className="share-meta-wide">
                        <dt>允许域名</dt>
                        <dd className="truncate" title={share.allowedDomains}>
                          {share.allowedDomains}
                        </dd>
                      </div>
                    )}
                    {share.allowedIps && (
                      <div className="share-meta-wide">
                        <dt>允许 API IP</dt>
                        <dd
                          className="mono-value truncate"
                          title={share.allowedIps}
                        >
                          {share.allowedIps}
                        </dd>
                      </div>
                    )}
                    {portDetails.length > 0 && (
                      <div className="share-meta-wide">
                        <dt>已占用</dt>
                        <dd
                          className="mono-value truncate"
                          title={portDetailText}
                        >
                          {portDetailText}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="share-token">
                    <KeyRound className="shrink-0 text-default-400" size={13} />
                    <code className="mono-value min-w-0 flex-1 truncate">
                      {share.token}
                    </code>
                    <Tooltip label="复制 Token">
                      <ActionIcon
                        aria-label="复制 Token"
                        color="gray"
                        size="sm"
                        variant="subtle"
                        onClick={() => copyToken(share.token)}
                      >
                        <Copy size={13} />
                      </ActionIcon>
                    </Tooltip>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : remoteUsageLoading ? (
        <PageLoadingState message="正在加载..." />
      ) : remoteUsageNodes.length === 0 ? (
        <EmptyStateCard
          action={
            <Button
              leftSection={<Download size={16} />}
              onClick={() => setImportNodeOpen(true)}
            >
              导入远程节点
            </Button>
          }
          description="导入远程节点并用它创建隧道后，这里会显示远端端口占用情况。"
          icon={<Server size={20} />}
          title="暂无远程接入"
        />
      ) : (
        <div className="access-grid share-grid">
          {remoteUsageNodes.map((node) => {
            const totalPorts = portTotal(
              node.portRangeStart,
              node.portRangeEnd,
            );
            const flowLimited = node.maxBandwidth > 0;

            return (
              <Card key={node.nodeId} className="share-card">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className="truncate text-[13.5px] font-semibold text-foreground"
                      title={node.nodeName}
                    >
                      {node.nodeName}
                    </p>
                    {node.remoteUrl && (
                      <p
                        className="mono-value truncate text-xs text-default-500"
                        title={node.remoteUrl}
                      >
                        {node.remoteUrl}
                      </p>
                    )}
                  </div>
                  <span
                    className="status-dot shrink-0"
                    data-tone={
                      node.syncError
                        ? "warning"
                        : node.activeBindingNum
                          ? "success"
                          : undefined
                    }
                  >
                    绑定 {node.activeBindingNum || 0}
                  </span>
                </div>

                {node.syncError && (
                  <p className="flex items-start gap-1.5 text-xs text-warning-ink">
                    <TriangleAlert className="mt-px shrink-0" size={13} />
                    {syncErrorText(node.syncError)}
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <UsageMeter
                    label="共享流量"
                    limit={
                      flowLimited ? formatFlowGB(node.maxBandwidth) : "不限"
                    }
                    percent={
                      flowLimited
                        ? Math.min(
                            ((node.currentFlow || 0) / node.maxBandwidth) * 100,
                            100,
                          )
                        : 0
                    }
                    unlimited={!flowLimited}
                    used={formatFlowGB(node.currentFlow || 0)}
                  />
                  <UsageMeter
                    label="远端端口"
                    limit={totalPorts || "-"}
                    percent={
                      totalPorts > 0
                        ? Math.min(
                            ((node.usedPorts?.length ?? 0) / totalPorts) * 100,
                            100,
                          )
                        : 0
                    }
                    used={node.usedPorts?.length ?? 0}
                  />
                </div>

                <dl className="share-meta">
                  <div>
                    <dt>共享 ID</dt>
                    <dd className="mono-value">
                      {node.shareId ? `#${node.shareId}` : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt>端口范围</dt>
                    <dd className="mono-value">
                      {totalPorts > 0
                        ? `${node.portRangeStart}–${node.portRangeEnd}`
                        : "-"}
                    </dd>
                  </div>
                </dl>

                {node.bindings && node.bindings.length > 0 ? (
                  <ul className="share-bindings">
                    {node.bindings.map((binding) => (
                      <li key={binding.bindingId}>
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {binding.tunnelName || `#${binding.tunnelId}`}
                        </span>
                        <span className="shrink-0 text-default-500">
                          {formatChainType(binding.chainType, binding.hopInx)}
                        </span>
                        <span className="mono-value ml-auto shrink-0 text-default-500">
                          :{binding.allocatedPort}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-auto text-xs text-default-400">
                    暂无绑定的隧道
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        confirmLabel={pendingAction?.kind === "reset" ? "重置" : "删除"}
        loading={pendingActionLoading}
        message={
          pendingAction?.kind === "reset"
            ? `重置“${pendingAction.share.name}”的共享流量统计？`
            : `删除“${pendingAction?.share.name ?? ""}”后，已导入该分享的面板将无法继续使用。此操作无法撤销。`
        }
        opened={pendingAction !== null}
        title={pendingAction?.kind === "reset" ? "重置共享流量" : "删除分享"}
        onClose={() => setPendingAction(null)}
        onConfirm={() => void confirmPendingAction()}
      />

      {/* Create Share Modal */}
      <Modal opened={createShareOpen} onClose={() => setCreateShareOpen(false)}>
        <ModalContent>
          <ModalHeader>
            <h2>创建分享</h2>
            <p>把本地节点开放给其他面板，生成导入用的 Token</p>
          </ModalHeader>
          <ModalBody>
            <TextInput
              label="名称"
              placeholder="备注名称"
              value={shareForm.name}
              onChange={(e) =>
                setShareForm({ ...shareForm, name: e.target.value })
              }
            />
            <Select
              clearable
              searchable
              data={nodes.map((node) => ({
                value: String(node.id),
                label: node.name,
              }))}
              label="选择节点"
              placeholder="选择要分享的本地节点"
              value={shareForm.nodeId ? shareForm.nodeId : null}
              onChange={(nodeId) =>
                setShareForm({ ...shareForm, nodeId: nodeId ?? "" })
              }
            />
            <div className="grid grid-cols-2 gap-4">
              <TextInput
                label="起始端口"
                type="number"
                value={shareForm.portRangeStart.toString()}
                onChange={(e) =>
                  setShareForm({
                    ...shareForm,
                    portRangeStart: parseInt(e.target.value),
                  })
                }
              />
              <TextInput
                label="结束端口"
                type="number"
                value={shareForm.portRangeEnd.toString()}
                onChange={(e) =>
                  setShareForm({
                    ...shareForm,
                    portRangeEnd: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <TextInput
              description="0 表示永久"
              label="有效期 (天)"
              type="number"
              value={shareForm.expiryDays.toString()}
              onChange={(e) =>
                setShareForm({
                  ...shareForm,
                  expiryDays: parseInt(e.target.value),
                })
              }
            />
            <TrafficLimitField
              description="0 表示不限流量"
              label="流量上限"
              unit={shareUnit}
              value={shareForm.maxBandwidth.toString()}
              onChange={(value, unit) => {
                setShareForm((prev) => ({
                  ...prev,
                  maxBandwidth: Number(value) || 0,
                }));
                setShareUnit(unit);
              }}
            />
            <TextInput
              description="限制使用此Token的来源面板域名，多个域名用逗号分隔，留空不限制"
              label="允许的域名 (可选)"
              placeholder="example.com, panel.test.com"
              value={shareForm.allowedDomains}
              onChange={(e) =>
                setShareForm({ ...shareForm, allowedDomains: e.target.value })
              }
            />
            <TextInput
              description="仅白名单IP可导入此分享，支持IPv4/IPv6/CIDR，多个用逗号分隔"
              label="允许的API IP (可选)"
              placeholder="203.0.113.10, 2001:db8::10, 198.51.100.0/24"
              value={shareForm.allowedIps}
              onChange={(e) =>
                setShareForm({ ...shareForm, allowedIps: e.target.value })
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button
              color="gray"
              variant="subtle"
              onClick={() => setCreateShareOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleCreateShare}>创建</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Share Modal */}
      <Modal opened={editShareOpen} onClose={() => setEditShareOpen(false)}>
        <ModalContent>
          <ModalHeader>
            <h2>编辑分享</h2>
          </ModalHeader>
          <ModalBody>
            <TextInput
              label="名称"
              placeholder="备注名称"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
            />
            <div className="grid grid-cols-2 gap-4">
              <TextInput
                label="起始端口"
                type="number"
                value={editForm.portRangeStart.toString()}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    portRangeStart: parseInt(e.target.value) || 0,
                  })
                }
              />
              <TextInput
                label="结束端口"
                type="number"
                value={editForm.portRangeEnd.toString()}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    portRangeEnd: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <TrafficLimitField
              description="0 表示不限流量"
              label="流量上限"
              unit={editUnit}
              value={editForm.maxBandwidth.toString()}
              onChange={(value, unit) => {
                setEditForm((prev) => ({
                  ...prev,
                  maxBandwidth: Number(value) || 0,
                }));
                setEditUnit(unit);
                setEditBandwidthChanged(true);
              }}
            />
            <TextInput
              description="留空或清除表示永久有效"
              label="过期时间"
              type="datetime-local"
              value={
                editForm.expiryTime > 0
                  ? new Date(editForm.expiryTime).toISOString().slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  expiryTime: e.target.value
                    ? new Date(e.target.value).getTime()
                    : 0,
                })
              }
            />
            <TextInput
              description="限制使用此Token的来源面板域名，多个域名用逗号分隔，留空不限制"
              label="允许的域名 (可选)"
              placeholder="example.com, panel.test.com"
              value={editForm.allowedDomains}
              onChange={(e) =>
                setEditForm({ ...editForm, allowedDomains: e.target.value })
              }
            />
            <TextInput
              description="仅白名单IP可导入此分享，支持IPv4/IPv6/CIDR，多个用逗号分隔"
              label="允许的API IP (可选)"
              placeholder="203.0.113.10, 2001:db8::10, 198.51.100.0/24"
              value={editForm.allowedIps}
              onChange={(e) =>
                setEditForm({ ...editForm, allowedIps: e.target.value })
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button
              color="gray"
              variant="subtle"
              onClick={() => setEditShareOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleEditShare}>保存</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Import Node Modal */}
      <Modal opened={importNodeOpen} onClose={() => setImportNodeOpen(false)}>
        <ModalContent>
          <ModalHeader>
            <h2>导入远程节点</h2>
            <p>填写对方面板地址与分享 Token</p>
          </ModalHeader>
          <ModalBody>
            <TextInput
              label="远程面板地址"
              placeholder="http://panel.example.com:8088"
              value={importForm.remoteUrl}
              onChange={(e) =>
                setImportForm({ ...importForm, remoteUrl: e.target.value })
              }
            />
            <TextInput
              label="Token"
              placeholder="Bearer Token"
              value={importForm.token}
              onChange={(e) =>
                setImportForm({ ...importForm, token: e.target.value })
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button
              color="gray"
              variant="subtle"
              onClick={() => setImportNodeOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleImportNode}>导入</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </AnimatedPage>
  );
}
