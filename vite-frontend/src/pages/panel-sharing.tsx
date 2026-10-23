import { useState, useEffect, useCallback } from "react";
import { ActionIcon, SegmentedControl, Tooltip } from "@mantine/core";
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
} from "lucide-react";

import { toast } from "@/lib/notifications";
import { AnimatedPage } from "@/components/animated-page";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyStateCard, PageLoadingState } from "@/components/page-state";
import { UsageMeter } from "@/components/usage-meter";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconTile } from "@/components/ui/icon-tile";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Select, SelectItem } from "@/components/ui/select";
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
      <div className="page-toolbar">
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
        {selectedTab === "my-shares" ? (
          <Button
            color="primary"
            startContent={<Plus size={16} />}
            onPress={() => setCreateShareOpen(true)}
          >
            创建分享
          </Button>
        ) : (
          <Button
            color="primary"
            startContent={<Download size={16} />}
            onPress={() => setImportNodeOpen(true)}
          >
            导入远程节点
          </Button>
        )}
      </div>

      <p className="-mt-2 mb-5 px-1 text-xs text-default-500">
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
                color="primary"
                startContent={<Plus size={16} />}
                onPress={() => setCreateShareOpen(true)}
              >
                创建分享
              </Button>
            }
            description="创建分享后，把生成的 Token 交给对方面板导入即可。"
            icon={<Share2 size={20} />}
            title="还没有分享"
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {shares.map((share) => {
              const expiry = shareExpiry(share);
              const totalPorts = portTotal(
                share.portRangeStart,
                share.portRangeEnd,
              );
              const usedPorts = share.usedPorts?.length ?? 0;
              const flowLimited = share.maxBandwidth > 0;

              return (
                <Card key={share.id} className="h-full gap-4 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <IconTile size="sm" tone="primary">
                        <Share2 size={15} />
                      </IconTile>
                      <span
                        className="truncate text-sm font-semibold text-foreground"
                        title={share.name}
                      >
                        {share.name}
                      </span>
                    </div>
                    <Chip className="shrink-0" color={expiry.tone} size="xs">
                      {expiry.text}
                    </Chip>
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

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-default-soft px-3 py-2.5 text-xs">
                    <div>
                      <dt className="text-default-500">端口范围</dt>
                      <dd className="font-mono text-foreground">
                        {share.portRangeStart} - {share.portRangeEnd}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-default-500">运行中绑定</dt>
                      <dd className="text-foreground">
                        {share.activeRuntimeNum ?? 0}
                      </dd>
                    </div>
                    {share.allowedDomains && (
                      <div className="col-span-2 min-w-0">
                        <dt className="text-default-500">允许域名</dt>
                        <dd
                          className="truncate text-foreground"
                          title={share.allowedDomains}
                        >
                          {share.allowedDomains}
                        </dd>
                      </div>
                    )}
                    {share.allowedIps && (
                      <div className="col-span-2 min-w-0">
                        <dt className="text-default-500">允许 API IP</dt>
                        <dd
                          className="truncate font-mono text-foreground"
                          title={share.allowedIps}
                        >
                          {share.allowedIps}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {share.usedPortDetails &&
                    share.usedPortDetails.length > 0 && (
                      <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
                        {share.usedPortDetails.map((item) => (
                          <Chip
                            key={item.runtimeId}
                            className="font-mono"
                            size="xs"
                          >
                            {item.port} · {item.role || "reserved"}
                          </Chip>
                        ))}
                      </div>
                    )}

                  <div className="flex min-w-0 items-center gap-2 rounded-lg border border-divider px-2.5 py-1.5">
                    <KeyRound className="shrink-0 text-default-400" size={14} />
                    <code className="min-w-0 flex-1 truncate font-mono text-xs text-default-700">
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
                        <Copy size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </div>

                  <div className="mt-auto flex items-center gap-1.5 border-t border-divider pt-3">
                    <Button
                      size="sm"
                      startContent={<SquarePen size={14} />}
                      variant="light"
                      onPress={() => openEditShare(share)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      startContent={<RotateCcw size={14} />}
                      variant="light"
                      onPress={() => setPendingAction({ kind: "reset", share })}
                    >
                      重置流量
                    </Button>
                    <Tooltip label="删除分享">
                      <ActionIcon
                        aria-label={`删除分享 ${share.name}`}
                        className="ml-auto"
                        color="red"
                        variant="subtle"
                        onClick={() =>
                          setPendingAction({ kind: "delete", share })
                        }
                      >
                        <Trash2 size={16} />
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
              color="primary"
              startContent={<Download size={16} />}
              onPress={() => setImportNodeOpen(true)}
            >
              导入远程节点
            </Button>
          }
          description="导入远程节点并用它创建隧道后，这里会显示远端端口占用情况。"
          icon={<Server size={20} />}
          title="暂无远程接入"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {remoteUsageNodes.map((node) => {
            const totalPorts = portTotal(
              node.portRangeStart,
              node.portRangeEnd,
            );
            const flowLimited = node.maxBandwidth > 0;

            return (
              <Card key={node.nodeId} className="h-full gap-4 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconTile size="sm" tone="secondary">
                      <Server size={15} />
                    </IconTile>
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold text-foreground"
                        title={node.nodeName}
                      >
                        {node.nodeName}
                      </p>
                      {node.remoteUrl && (
                        <p
                          className="truncate font-mono text-xs text-default-500"
                          title={node.remoteUrl}
                        >
                          {node.remoteUrl}
                        </p>
                      )}
                    </div>
                  </div>
                  <Chip className="shrink-0" size="xs">
                    绑定 {node.activeBindingNum || 0}
                  </Chip>
                </div>

                {node.syncError && (
                  <p className="rounded-md bg-warning-soft px-2.5 py-1.5 text-xs text-warning-ink">
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

                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-default-soft px-3 py-2.5 text-xs">
                  <div>
                    <dt className="text-default-500">共享 ID</dt>
                    <dd className="font-mono text-foreground">
                      {node.shareId ? `#${node.shareId}` : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-default-500">端口范围</dt>
                    <dd className="font-mono text-foreground">
                      {totalPorts > 0
                        ? `${node.portRangeStart} - ${node.portRangeEnd}`
                        : "-"}
                    </dd>
                  </div>
                </dl>

                {node.bindings && node.bindings.length > 0 ? (
                  <ul className="max-h-40 divide-y divide-divider overflow-y-auto rounded-lg border border-divider text-xs">
                    {node.bindings.map((binding) => (
                      <li
                        key={binding.bindingId}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {binding.tunnelName || `#${binding.tunnelId}`}
                          </span>
                          <span className="text-[11px] text-default-500">
                            {formatChainType(binding.chainType, binding.hopInx)}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-default-500">
                          :{binding.allocatedPort}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-default-400">暂无绑定的隧道</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        confirmLabel={pendingAction?.kind === "reset" ? "重置" : "删除"}
        isOpen={pendingAction !== null}
        loading={pendingActionLoading}
        message={
          pendingAction?.kind === "reset"
            ? `重置“${pendingAction.share.name}”的共享流量统计？`
            : `删除“${pendingAction?.share.name ?? ""}”后，已导入该分享的面板将无法继续使用。此操作无法撤销。`
        }
        title={pendingAction?.kind === "reset" ? "重置共享流量" : "删除分享"}
        onClose={() => setPendingAction(null)}
        onConfirm={() => void confirmPendingAction()}
      />

      {/* Create Share Modal */}
      <Modal
        backdrop="blur"
        isOpen={createShareOpen}
        scrollBehavior="inside"
        onClose={() => setCreateShareOpen(false)}
      >
        <ModalContent>
          <ModalHeader>创建分享</ModalHeader>
          <ModalBody>
            <Input
              label="名称"
              placeholder="备注名称"
              value={shareForm.name}
              onChange={(e) =>
                setShareForm({ ...shareForm, name: e.target.value })
              }
            />
            <Select
              label="选择节点"
              placeholder="选择要分享的本地节点"
              selectedKeys={shareForm.nodeId ? [shareForm.nodeId] : []}
              onChange={(e) =>
                setShareForm({ ...shareForm, nodeId: e.target.value })
              }
            >
              {nodes.map((node) => (
                <SelectItem key={node.id} textValue={node.name}>
                  {node.name}
                </SelectItem>
              ))}
            </Select>
            <div className="flex gap-4">
              <Input
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
              <Input
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
            <Input
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
            <Input
              description="限制使用此Token的来源面板域名，多个域名用逗号分隔，留空不限制"
              label="允许的域名 (可选)"
              placeholder="example.com, panel.test.com"
              value={shareForm.allowedDomains}
              onChange={(e) =>
                setShareForm({ ...shareForm, allowedDomains: e.target.value })
              }
            />
            <Input
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
            <Button onPress={() => setCreateShareOpen(false)}>取消</Button>
            <Button color="primary" onPress={handleCreateShare}>
              创建
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Share Modal */}
      <Modal
        backdrop="blur"
        isOpen={editShareOpen}
        scrollBehavior="inside"
        onClose={() => setEditShareOpen(false)}
      >
        <ModalContent>
          <ModalHeader>编辑分享</ModalHeader>
          <ModalBody>
            <Input
              label="名称"
              placeholder="备注名称"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
            />
            <div className="flex gap-4">
              <Input
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
              <Input
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
            <Input
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
            <Input
              description="限制使用此Token的来源面板域名，多个域名用逗号分隔，留空不限制"
              label="允许的域名 (可选)"
              placeholder="example.com, panel.test.com"
              value={editForm.allowedDomains}
              onChange={(e) =>
                setEditForm({ ...editForm, allowedDomains: e.target.value })
              }
            />
            <Input
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
            <Button onPress={() => setEditShareOpen(false)}>取消</Button>
            <Button color="primary" onPress={handleEditShare}>
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Import Node Modal */}
      <Modal
        backdrop="blur"
        isOpen={importNodeOpen}
        onClose={() => setImportNodeOpen(false)}
      >
        <ModalContent>
          <ModalHeader>导入远程节点</ModalHeader>
          <ModalBody>
            <Input
              label="远程面板地址"
              placeholder="http://panel.example.com:8088"
              value={importForm.remoteUrl}
              onChange={(e) =>
                setImportForm({ ...importForm, remoteUrl: e.target.value })
              }
            />
            <Input
              label="Token"
              placeholder="Bearer Token"
              value={importForm.token}
              onChange={(e) =>
                setImportForm({ ...importForm, token: e.target.value })
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button onPress={() => setImportNodeOpen(false)}>取消</Button>
            <Button color="secondary" onPress={handleImportNode}>
              导入
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </AnimatedPage>
  );
}
