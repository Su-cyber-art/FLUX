import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  Alert,
  Button,
  Button as MantineButton,
  SegmentedControl,
} from "@mantine/core";
import {
  CircleArrowUp,
  Plus,
  SearchX,
  Server,
  Share2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  batchDeleteNodes,
  batchUpgradeNodes,
  createNode,
  deleteNode,
  dismissNodeExpiryReminder,
  getNodeInstallCommand,
  getNodeList,
  getNodeReleases,
  getPeerRemoteUsageList,
  rollbackNode,
  updateNode,
  updateNodeOrder,
  upgradeNode,
  type ReleaseChannel,
} from "@/api";
import { AnimatedPage } from "@/components/animated-page";
import { EmptyStateCard, PageLoadingState } from "@/components/page-state";
import { BatchModeButton, PageToolbar } from "@/components/page-toolbar";
import { SearchBar } from "@/components/search-bar";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import toast from "@/lib/notifications";
import { tryCopyInstallCommand } from "@/pages/node/install-command";
import { InstallCommandModal } from "@/pages/node/install-command-modal";
import { InstallSelectorModal } from "@/pages/node/install-selector-modal";
import { NodeBatchDeleteModal } from "@/pages/node/node-batch-delete-modal";
import { NodeDeleteModal } from "@/pages/node/node-delete-modal";
import { NodeFilterModal } from "@/pages/node/node-filter-modal";
import { NodeFormModal } from "@/pages/node/node-form-modal";
import {
  NodeCard,
  NodeListHeader,
  NodeRow,
  type NodeItemHandlers,
} from "@/pages/node/node-items";
import { NodeUpgradeModal } from "@/pages/node/node-upgrade-modal";
import {
  NODE_FALLBACK_REFRESH_INTERVAL_MS,
  Node,
  NodeFilterMode,
  NodeForm,
  NodeTab,
  RemoteUsageNode,
  SortableItem,
  getNodeExpiryMeta,
  getNodeReminderEnabled,
  mergeNodeRealtimeState,
} from "@/pages/node/presentation";
import { buildNodeSystemInfo } from "@/pages/node/system-info";
import { useNodeOfflineTimers } from "@/pages/node/use-node-offline-timers";
import { useNodeRealtime } from "@/pages/node/use-node-realtime";
import { loadStoredOrder, saveOrder } from "@/utils/order-storage";
import { formatTraffic } from "@/utils/traffic";

export default function NodePage() {
  const [nodeList, setNodeList] = useState<Node[]>([]);
  const [nodeOrder, setNodeOrder] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSearchKeyword, setLocalSearchKeyword] = useLocalStorageState(
    "node-search-keyword-local",
    "",
  );
  const [remoteSearchKeyword, setRemoteSearchKeyword] = useLocalStorageState(
    "node-search-keyword-remote",
    "",
  );
  const [activeTab, setActiveTab] = useLocalStorageState<NodeTab>(
    "node-active-tab",
    "local",
  );
  const [viewMode, setViewMode] = useLocalStorageState<"list" | "grid">(
    "node-view-mode",
    "grid",
  );

  // Backward-compat: older versions stored extra tab values.
  useEffect(() => {
    if (activeTab !== "local" && activeTab !== "remote") {
      setActiveTab("local");
    }
  }, [activeTab, setActiveTab]);
  const [remoteUsageMap, setRemoteUsageMap] = useState<
    Record<number, RemoteUsageNode>
  >({});
  const [nodeFilterMode, setNodeFilterMode, resetNodeFilterMode] =
    useLocalStorageState<NodeFilterMode>("node-expiry-filter-mode", "all");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [isEdit, setIsEdit] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [nodeToRollback, setNodeToRollback] = useState<Node | null>(null);
  const [nodeToDelete, setNodeToDelete] = useState<Node | null>(null);
  const forceNodeRemoval = forceDelete || nodeToDelete?.deleteState === 3;
  const [protocolDisabled, setProtocolDisabled] = useState(false);
  const [protocolDisabledReason, setProtocolDisabledReason] = useState("");
  const [form, setForm] = useState<NodeForm>({
    id: null,
    name: "",
    remark: "",
    expiryTime: 0,
    renewalCycle: "",
    serverHost: "",
    serverIpV4: "",
    serverIpV6: "",
    port: "10000-65535",
    tcpListenAddr: "[::]",
    udpListenAddr: "[::]",
    interfaceName: "",
    extraIPs: "",
    forwardMode: "agent",
    sshHost: "",
    sshPort: "22",
    sshUsername: "",
    sshAuthType: "private_key",
    sshPassword: "",
    sshPrivateKey: "",
    sshPassphrase: "",
    sshSudoMode: "none",
    http: 0,
    tls: 0,
    socks: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isNftablesMode = form.forwardMode === "nftables";
  const protocolControlsDisabled = protocolDisabled || isNftablesMode;
  const protocolControlsReason = isNftablesMode
    ? "nftables 模式不支持 agent 协议开关"
    : protocolDisabledReason || "等待节点上线后再设置";

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
  const [batchForceDelete, setBatchForceDelete] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  // 安装命令相关状态
  const [installCommandModal, setInstallCommandModal] = useState(false);
  const [installCommand, setInstallCommand] = useState("");
  const [currentNodeName, setCurrentNodeName] = useState("");
  const [installSelectorOpen, setInstallSelectorOpen] = useState(false);
  const [installTargetNode, setInstallTargetNode] = useState<Node | null>(null);
  const [installChannel, setInstallChannel] =
    useState<ReleaseChannel>("stable");

  // 升级相关状态
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<"single" | "batch">(
    "single",
  );
  const [upgradeTargetNodeId, setUpgradeTargetNodeId] = useState<number | null>(
    null,
  );
  const [releases, setReleases] = useState<
    Array<{
      version: string;
      name: string;
      publishedAt: string;
      prerelease: boolean;
      channel: ReleaseChannel;
    }>
  >([]);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [releaseChannel, setReleaseChannel] =
    useState<ReleaseChannel>("stable");
  const [selectedVersion, setSelectedVersion] = useState("");
  const [batchUpgradeLoading, setBatchUpgradeLoading] = useState(false);
  const [upgradeProgress, setUpgradeProgress] = useState<
    Record<number, { stage: string; percent: number; message: string }>
  >({});

  const handleNodeOffline = useCallback((nodeId: number) => {
    setNodeList((prev) =>
      prev.map((node) => {
        if (node.id !== nodeId) return node;
        if (node.connectionStatus === "offline" && node.systemInfo === null) {
          return node;
        }

        return { ...node, connectionStatus: "offline", systemInfo: null };
      }),
    );
  }, []);

  const { clearOfflineTimer, scheduleNodeOffline } = useNodeOfflineTimers({
    delayMs: 3000,
    onNodeOffline: handleNodeOffline,
  });

  const loadRemoteUsage = useCallback(async () => {
    try {
      const res = await getPeerRemoteUsageList();

      if (res.code === 0 && Array.isArray(res.data)) {
        const nextMap: Record<number, RemoteUsageNode> = {};

        (res.data as unknown as RemoteUsageNode[]).forEach((item) => {
          if (!item || typeof item.nodeId !== "number") return;
          nextMap[item.nodeId] = item;
        });

        setRemoteUsageMap(nextMap);
      }
    } catch {
      // ignore remote usage errors in node page
    }
  }, []);

  // 加载节点列表
  const loadNodes = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoading(true);
    }

    try {
      const res = await getNodeList();

      if (res.code === 0) {
        const nodesData: Node[] = (res.data || []).map((node: any) => ({
          ...node,
          inx: node.inx ?? 0,
          connectionStatus: node.syncError
            ? "offline"
            : node.status === 1
              ? "online"
              : "offline",
          syncError: node.syncError || undefined,
          systemInfo: null,
          copyLoading: false,
        }));

        setNodeList((prev) => {
          const previousById = new Map(prev.map((node) => [node.id, node]));

          return nodesData.map((node) =>
            mergeNodeRealtimeState(node, previousById.get(node.id)),
          );
        });
        setNodeToDelete((current) =>
          current
            ? nodesData.find((node) => node.id === current.id) || current
            : null,
        );

        // 优先使用数据库中的 inx 字段进行排序，否则回退到本地排序
        const hasDbOrdering = nodesData.some(
          (n) => n.inx !== undefined && n.inx !== 0,
        );

        if (hasDbOrdering) {
          const dbOrder = [...nodesData]
            .sort((a, b) => (a.inx ?? 0) - (b.inx ?? 0))
            .map((n) => n.id);

          setNodeOrder(dbOrder);
        } else {
          setNodeOrder(
            loadStoredOrder(
              "node-order",
              nodesData.map((n) => n.id),
            ),
          );
        }
      } else {
        if (!silent) {
          toast.error(res.msg || "加载节点列表失败");
        }
      }
    } catch {
      if (!silent) {
        toast.error("网络错误，请重试");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  // 处理WebSocket消息
  const handleWebSocketMessage = (data: any) => {
    const { id, type, data: messageData } = data;
    const nodeId = Number(id);

    if (Number.isNaN(nodeId)) return;

    if (type === "node_deleted") {
      clearOfflineTimer(nodeId);
      setNodeList((prev) => prev.filter((node) => node.id !== nodeId));
      setSelectedIds((prev) => {
        const next = new Set(prev);

        next.delete(nodeId);

        return next;
      });
    } else if (type === "status") {
      if (messageData === 1) {
        clearOfflineTimer(nodeId);
        setNodeList((prev) =>
          prev.map((node) => {
            if (node.id !== nodeId) return node;
            if (node.connectionStatus === "online") return node;

            return { ...node, connectionStatus: "online" };
          }),
        );
      } else {
        // 离线事件做延迟处理，避免短抖动导致频繁闪烁
        scheduleNodeOffline(nodeId);
      }
    } else if (type === "info") {
      clearOfflineTimer(nodeId);
      setNodeList((prev) =>
        prev.map((node) => {
          if (node.id === nodeId) {
            const systemInfo = buildNodeSystemInfo(
              messageData,
              node.systemInfo,
            );

            if (!systemInfo) {
              return node;
            }

            return {
              ...node,
              connectionStatus: "online",
              systemInfo,
            };
          }

          return node;
        }),
      );
    } else if (type === "upgrade_progress") {
      try {
        const progressData =
          typeof messageData === "string"
            ? JSON.parse(messageData)
            : messageData;

        if (progressData?.data) {
          setUpgradeProgress((prev) => ({
            ...prev,
            [nodeId]: {
              stage: progressData.data.stage || "",
              percent: progressData.data.percent || 0,
              message: progressData.message || "",
            },
          }));
        }
      } catch {
        // ignore parse errors
      }
    } else if (type === "metric") {
      clearOfflineTimer(nodeId);
      setNodeList((prev) =>
        prev.map((node) => {
          if (node.id !== nodeId) return node;

          const metric =
            typeof messageData === "string"
              ? JSON.parse(messageData)
              : messageData;

          if (!metric || typeof metric !== "object") return node;

          const incomingUptime = metric.uptime ?? 0;

          return {
            ...node,
            connectionStatus: "online",
            systemInfo: {
              cpuUsage: metric.cpuUsage ?? metric.cpu_usage ?? 0,
              memoryUsage: metric.memoryUsage ?? metric.memory_usage ?? 0,
              uploadTraffic:
                metric.netOutBytes ?? metric.bytes_transmitted ?? 0,
              downloadTraffic: metric.netInBytes ?? metric.bytes_received ?? 0,
              uploadSpeed: metric.netOutSpeed ?? metric.net_out_speed ?? 0,
              downloadSpeed: metric.netInSpeed ?? metric.net_in_speed ?? 0,
              uptime: incomingUptime || node.systemInfo?.uptime || 0,
              diskUsage: metric.diskUsage ?? metric.disk_usage,
              load1: metric.load1,
              load5: metric.load5,
              load15: metric.load15,
              tcpConns: metric.tcpConns ?? metric.tcp_conns,
              udpConns: metric.udpConns ?? metric.udp_conns,
              netInSpeed: metric.netInSpeed ?? metric.net_in_speed,
              netOutSpeed: metric.netOutSpeed ?? metric.net_out_speed,
            },
          };
        }),
      );
    }
  };

  const { wsConnected, wsConnecting, usingPollingFallback } = useNodeRealtime({
    onMessage: handleWebSocketMessage,
  });

  useEffect(() => {
    loadNodes();
    loadRemoteUsage();
  }, [loadNodes, loadRemoteUsage]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  useEffect(() => {
    if (!usingPollingFallback) {
      return;
    }

    void loadNodes({ silent: true });

    const interval = window.setInterval(() => {
      void loadNodes({ silent: true });
    }, NODE_FALLBACK_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadNodes, usingPollingFallback]);

  // 格式化速度
  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return "0 B/s";

    const k = 1024;
    const sizes = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));

    return (
      parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  };

  // 格式化开机时间
  const formatUptime = (seconds: number): string => {
    if (seconds === 0) return "-";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}天${hours}小时`;
    } else if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  };

  // 格式化流量

  const formatFlow = (bytes: number): string => {
    return formatTraffic(bytes);
  };

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

  // IPv4/IPv6 格式验证（仅用于判定地址族）
  const ipv4Regex =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

  const validateIpv4Literal = (ip: string): boolean =>
    ipv4Regex.test(ip.trim());
  const validateIpv6Literal = (ip: string): boolean =>
    ipv6Regex.test(ip.trim());

  // Hostname/domain validation (no scheme/port)
  const hostnameRegex =
    /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/;
  const validateHostname = (host: string): boolean => {
    const v = host.trim();

    if (!v) return false;
    if (v === "localhost") return true;

    return hostnameRegex.test(v);
  };

  // 验证端口格式：支持 80,443,100-600
  const validatePort = (
    portStr: string,
  ): { valid: boolean; error?: string } => {
    if (!portStr || !portStr.trim()) {
      return { valid: false, error: "请输入端口" };
    }

    const trimmed = portStr.trim();
    const parts = trimmed
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p);

    if (parts.length === 0) {
      return { valid: false, error: "请输入有效的端口" };
    }

    for (const part of parts) {
      // 检查是否是端口范围 (如 100-600)
      if (part.includes("-")) {
        const range = part.split("-").map((p) => p.trim());

        if (range.length !== 2) {
          return { valid: false, error: `端口范围格式错误: ${part}` };
        }

        const start = parseInt(range[0]);
        const end = parseInt(range[1]);

        if (isNaN(start) || isNaN(end)) {
          return { valid: false, error: `端口必须是数字: ${part}` };
        }

        if (start < 1 || start > 65535 || end < 1 || end > 65535) {
          return {
            valid: false,
            error: `端口范围必须在 1-65535 之间: ${part}`,
          };
        }

        if (start >= end) {
          return { valid: false, error: `起始端口必须小于结束端口: ${part}` };
        }
      } else {
        // 单个端口
        const port = parseInt(part);

        if (isNaN(port)) {
          return { valid: false, error: `端口必须是数字: ${part}` };
        }

        if (port < 1 || port > 65535) {
          return { valid: false, error: `端口必须在 1-65535 之间: ${part}` };
        }
      }
    }

    return { valid: true };
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = "请输入节点名称";
    } else if (form.name.trim().length < 2) {
      newErrors.name = "节点名称长度至少2位";
    } else if (form.name.trim().length > 50) {
      newErrors.name = "节点名称长度不能超过50位";
    }

    if (
      (form.renewalCycle && !form.expiryTime) ||
      (!form.renewalCycle && form.expiryTime)
    ) {
      newErrors.expiryTime = "请同时设置续费周期和续费基准时间";
    }

    const v4 = form.serverIpV4.trim();
    const v6 = form.serverIpV6.trim();
    const host = form.serverHost.trim();

    if (!v4 && !v6 && !host) {
      const msg = "请至少填写一个 IPv4/IPv6 地址或域名";

      newErrors.serverIpV4 = msg;
      newErrors.serverIpV6 = msg;
      newErrors.serverHost = msg;
    } else {
      if (v4 && !validateIpv4Literal(v4)) {
        newErrors.serverIpV4 = "请输入有效的IPv4地址";
      }
      if (v6 && !validateIpv6Literal(v6)) {
        newErrors.serverIpV6 = "请输入有效的IPv6地址";
      }
      if (host && !validateHostname(host)) {
        newErrors.serverHost = "请输入有效的域名/主机名";
      }
    }

    const portValidation = validatePort(form.port);

    if (!portValidation.valid) {
      newErrors.port = portValidation.error || "端口格式错误";
    }

    if (form.forwardMode === "nftables") {
      if (!form.sshHost.trim()) {
        newErrors.sshHost = "请输入 SSH 主机";
      }
      const sshPort = Number(form.sshPort);

      if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) {
        newErrors.sshPort = "SSH 端口必须为 1-65535";
      }
      if (!form.sshUsername.trim()) {
        newErrors.sshUsername = "请输入 SSH 用户名";
      }
      if (form.sshAuthType === "password") {
        if (!isEdit && !form.sshPassword.trim()) {
          newErrors.sshPassword = "请输入 SSH 密码";
        }
      } else if (!isEdit && !form.sshPrivateKey.trim()) {
        newErrors.sshPrivateKey = "请输入 SSH 私钥";
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // 新增节点
  const handleAdd = () => {
    setDialogTitle("新增节点");
    setIsEdit(false);
    setDialogVisible(true);
    resetForm();
    setProtocolDisabled(true);
    setProtocolDisabledReason("节点未在线，等待节点上线后再设置");
  };

  // 编辑节点
  const handleEdit = (node: Node) => {
    setDialogTitle("编辑节点");
    setIsEdit(true);

    const legacy = (node.serverIp || "").trim();
    const normalizedV4 =
      node.serverIpV4?.trim() || (validateIpv4Literal(legacy) ? legacy : "");
    const normalizedV6 =
      node.serverIpV6?.trim() || (validateIpv6Literal(legacy) ? legacy : "");
    const normalizedHost =
      !normalizedV4 && !normalizedV6 && legacy ? legacy : "";

    setForm({
      id: node.id,
      name: node.name,
      remark: node.remark || "",
      expiryTime: node.expiryTime || 0,
      renewalCycle: node.renewalCycle || "",
      serverHost: normalizedHost,
      serverIpV4: normalizedV4,
      serverIpV6: normalizedV6,
      port: node.port || "10000-65535",
      tcpListenAddr: node.tcpListenAddr || "[::]",
      udpListenAddr: node.udpListenAddr || "[::]",
      interfaceName: (node as any).interfaceName || "",
      extraIPs: node.extraIPs || "",
      forwardMode: node.forwardMode === "nftables" ? "nftables" : "agent",
      sshHost: node.sshConfig?.host || normalizedHost || legacy,
      sshPort: String(node.sshConfig?.port || 22),
      sshUsername: node.sshConfig?.username || "",
      sshAuthType: node.sshConfig?.authType || "private_key",
      sshPassword: node.sshConfig?.password || "",
      sshPrivateKey: node.sshConfig?.privateKey || "",
      sshPassphrase: node.sshConfig?.passphrase || "",
      sshSudoMode: node.sshConfig?.sudoMode || "none",
      http: typeof node.http === "number" ? node.http : 1,
      tls: typeof node.tls === "number" ? node.tls : 1,
      socks: typeof node.socks === "number" ? node.socks : 1,
    });
    const offline = node.connectionStatus !== "online";

    setProtocolDisabled(offline || node.forwardMode === "nftables");
    setProtocolDisabledReason(
      node.forwardMode === "nftables"
        ? "nftables 模式不支持 agent 协议开关"
        : offline
          ? "节点未在线，等待节点上线后再设置"
          : "",
    );
    setDialogVisible(true);
  };

  // 删除节点
  const handleDelete = (node: Node) => {
    setNodeToDelete(node);
    setForceDelete(node.deleteState === 3);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!nodeToDelete) return;

    setDeleteLoading(true);
    try {
      const res = await deleteNode(nodeToDelete.id, forceNodeRemoval);

      if (res.code === 0) {
        toast.success(
          forceNodeRemoval ? "节点已从面板移除，原接入凭证已失效" : "删除成功",
        );
        setNodeList((prev) => prev.filter((n) => n.id !== nodeToDelete.id));
        clearOfflineTimer(nodeToDelete.id);
        setSelectedIds((prev) => {
          const next = new Set(prev);

          next.delete(nodeToDelete.id);

          return next;
        });
        setDeleteModalOpen(false);
        setNodeToDelete(null);
      } else {
        toast.error(res.msg || "删除失败");
        void loadNodes({ silent: true });
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDismissExpiryReminder = async (nodeId: number) => {
    try {
      const res = await dismissNodeExpiryReminder(nodeId);

      if (res.code === 0) {
        setNodeList((prev) =>
          prev.map((n) =>
            n.id === nodeId ? { ...n, expiryReminderDismissed: 1 } : n,
          ),
        );
      } else {
        toast.error(res.msg || "操作失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    }
  };

  const openInstallSelector = (node: Node) => {
    setInstallTargetNode(node);
    setInstallChannel("stable");
    setInstallSelectorOpen(true);
  };

  // 复制安装命令
  const handleCopyInstallCommand = async (
    node: Node,
    channel: ReleaseChannel,
  ) => {
    setNodeList((prev) =>
      prev.map((n) => (n.id === node.id ? { ...n, copyLoading: true } : n)),
    );

    try {
      const res = await getNodeInstallCommand(node.id, channel);

      if (res.code === 0 && res.data) {
        const copied = await tryCopyInstallCommand(res.data);

        if (copied) {
          toast.success(
            `${channel === "stable" ? "正式版" : "测试版"}安装命令已复制到剪贴板`,
          );
        } else {
          setInstallCommand(res.data);
          setCurrentNodeName(node.name);
          setInstallCommandModal(true);
        }
      } else {
        toast.error(res.msg || "获取安装命令失败");
      }
    } catch {
      toast.error("获取安装命令失败");
    } finally {
      setNodeList((prev) =>
        prev.map((n) => (n.id === node.id ? { ...n, copyLoading: false } : n)),
      );
    }
  };

  const handleConfirmInstallCommand = async () => {
    if (!installTargetNode) return;

    setInstallSelectorOpen(false);
    await handleCopyInstallCommand(installTargetNode, installChannel);
  };

  // 手动复制安装命令
  const handleManualCopy = async () => {
    try {
      await navigator.clipboard.writeText(installCommand);
      toast.success("安装命令已复制到剪贴板");
      setInstallCommandModal(false);
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  };

  const loadReleasesByChannel = useCallback(async (channel: ReleaseChannel) => {
    setReleasesLoading(true);
    try {
      const res = await getNodeReleases(channel);

      if (res.code === 0 && Array.isArray(res.data)) {
        setReleases(res.data);
      } else {
        toast.error(res.msg || "获取版本列表失败");
      }
    } catch {
      toast.error("获取版本列表失败");
    } finally {
      setReleasesLoading(false);
    }
  }, []);

  // 打开版本选择弹窗
  const openUpgradeModal = async (
    target: "single" | "batch",
    nodeId?: number,
  ) => {
    const defaultChannel: ReleaseChannel = "stable";

    setUpgradeTarget(target);
    setUpgradeTargetNodeId(nodeId || null);
    setReleaseChannel(defaultChannel);
    setSelectedVersion("");
    setUpgradeModalOpen(true);
    await loadReleasesByChannel(defaultChannel);
  };

  // 确认升级（从版本弹窗）
  const handleConfirmUpgrade = async () => {
    const version = selectedVersion || undefined;

    if (upgradeTarget === "single" && upgradeTargetNodeId) {
      setUpgradeModalOpen(false);
      // Find the node
      const node = nodeList.find((n) => n.id === upgradeTargetNodeId);

      if (!node) return;
      setNodeList((prev) =>
        prev.map((n) =>
          n.id === upgradeTargetNodeId ? { ...n, upgradeLoading: true } : n,
        ),
      );
      try {
        const res = await upgradeNode(
          upgradeTargetNodeId,
          version,
          releaseChannel,
        );

        if (res.code === 0) {
          toast.success(`节点升级命令已发送，节点将自动重启`);
        } else {
          toast.error(res.msg || "升级失败");
        }
      } catch {
        toast.error("网络错误，请重试");
      } finally {
        setNodeList((prev) =>
          prev.map((n) =>
            n.id === upgradeTargetNodeId ? { ...n, upgradeLoading: false } : n,
          ),
        );
      }
    } else if (upgradeTarget === "batch") {
      const selectedLocalIds = Array.from(selectedIds).filter((id) => {
        const matchedNode = nodeList.find((node) => node.id === id);

        return matchedNode?.isRemote !== 1;
      });

      if (selectedLocalIds.length === 0) {
        toast.error("请选择本地节点进行升级");
        setUpgradeModalOpen(false);

        return;
      }

      setBatchUpgradeLoading(true);
      setUpgradeModalOpen(false);
      try {
        const res = await batchUpgradeNodes(
          selectedLocalIds,
          version,
          releaseChannel,
        );

        if (res.code === 0) {
          toast.success(
            `批量升级命令已发送到 ${selectedLocalIds.length} 个节点`,
          );
        } else {
          toast.error(res.msg || "批量升级失败");
        }
      } catch {
        toast.error("网络错误，请重试");
      } finally {
        setBatchUpgradeLoading(false);
      }
    }
  };

  // 回退节点
  const handleRollbackNode = (node: Node) => {
    setNodeToRollback(node);
    setRollbackModalOpen(true);
  };

  const confirmRollback = async () => {
    if (!nodeToRollback) return;
    const node = nodeToRollback;

    setRollbackModalOpen(false);
    setNodeList((prev) =>
      prev.map((n) => (n.id === node.id ? { ...n, rollbackLoading: true } : n)),
    );
    try {
      const res = await rollbackNode(node.id);

      if (res.code === 0) {
        toast.success(`节点 ${node.name} 回退命令已发送，节点将自动重启`);
      } else {
        toast.error(res.msg || "回退失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setNodeList((prev) =>
        prev.map((n) =>
          n.id === node.id ? { ...n, rollbackLoading: false } : n,
        ),
      );
      setNodeToRollback(null);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitLoading(true);

    try {
      const apiCall = isEdit ? updateNode : createNode;
      const { serverHost, ...rest } = form;
      const sshConfig =
        form.forwardMode === "nftables"
          ? {
              host: form.sshHost.trim(),
              port: Number(form.sshPort || 22),
              username: form.sshUsername.trim(),
              authType: form.sshAuthType,
              password:
                form.sshAuthType === "password"
                  ? form.sshPassword.trim()
                  : undefined,
              privateKey:
                form.sshAuthType === "private_key"
                  ? form.sshPrivateKey
                  : undefined,
              passphrase: form.sshPassphrase,
              sudoMode: form.sshSudoMode,
            }
          : null;
      const data = {
        ...rest,
        remark: form.remark.trim(),
        expiryTime: form.expiryTime,
        renewalCycle: form.renewalCycle,
        extraIPs: form.extraIPs,
        forwardMode: form.forwardMode,
        sshConfig,
        serverIp:
          form.serverIpV4?.trim() ||
          form.serverIpV6?.trim() ||
          serverHost?.trim() ||
          "",
      };

      const res = await apiCall(data);

      if (res.code === 0) {
        toast.success(isEdit ? "更新成功" : "创建成功");
        setDialogVisible(false);

        if (isEdit) {
          setNodeList((prev) =>
            prev.map((n) =>
              n.id === form.id
                ? {
                    ...n,
                    name: form.name,
                    remark: form.remark.trim(),
                    expiryTime: form.expiryTime,
                    renewalCycle: form.renewalCycle,
                    serverIp:
                      form.serverIpV4?.trim() ||
                      form.serverIpV6?.trim() ||
                      form.serverHost?.trim() ||
                      "",
                    serverIpV4: form.serverIpV4,
                    serverIpV6: form.serverIpV6,
                    port: form.port,
                    tcpListenAddr: form.tcpListenAddr,
                    udpListenAddr: form.udpListenAddr,
                    interfaceName: form.interfaceName,
                    forwardMode: form.forwardMode,
                    sshConfig,
                    http: form.http,
                    tls: form.tls,
                    socks: form.socks,
                  }
                : n,
            ),
          );
        } else {
          loadNodes();
        }
      } else {
        toast.error(res.msg || (isEdit ? "更新失败" : "创建失败"));
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSubmitLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setForm({
      id: null,
      name: "",
      remark: "",
      expiryTime: 0,
      renewalCycle: "",
      serverHost: "",
      serverIpV4: "",
      serverIpV6: "",
      port: "10000-65535",
      tcpListenAddr: "[::]",
      udpListenAddr: "[::]",
      interfaceName: "",
      extraIPs: "",
      forwardMode: "agent",
      sshHost: "",
      sshPort: "22",
      sshUsername: "",
      sshAuthType: "password",
      sshPassword: "",
      sshPrivateKey: "",
      sshPassphrase: "",
      sshSudoMode: "none",
      http: 0,
      tls: 0,
      socks: 0,
    });
    setErrors({});
  };

  // 处理拖拽结束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!active || !over || active.id === over.id) return;
    if (!nodeOrder || nodeOrder.length === 0) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);

    if (isNaN(activeId) || isNaN(overId)) return;

    const displayNodeIds = displayNodes.map((node) => node.id);
    const oldIndex = displayNodeIds.indexOf(activeId);
    const newIndex = displayNodeIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reorderedDisplayIds = arrayMove(displayNodeIds, oldIndex, newIndex);
    const displayIdSet = new Set(displayNodeIds);
    let reorderedDisplayIndex = 0;

    const newOrder = nodeOrder.map((id) => {
      if (!displayIdSet.has(id)) {
        return id;
      }

      const nextId = reorderedDisplayIds[reorderedDisplayIndex];

      reorderedDisplayIndex += 1;

      return nextId;
    });

    setNodeOrder(newOrder);

    saveOrder("node-order", newOrder);

    // 持久化到数据库
    try {
      const nodesToUpdate = newOrder.map((id, index) => ({ id, inx: index }));
      const response = await updateNodeOrder({ nodes: nodesToUpdate });

      if (response.code === 0) {
        setNodeList((prev) =>
          prev.map((node) => {
            const updated = nodesToUpdate.find((n) => n.id === node.id);

            return updated ? { ...node, inx: updated.inx } : node;
          }),
        );
      } else {
        toast.error("保存排序失败：" + (response.msg || "未知错误"));
      }
    } catch {
      toast.error("保存排序失败，请重试");
    }
  };

  // 批量操作处理函数
  const toggleSelectMode = () => {
    setSelectMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }

      return !prev;
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(displayNodes.map((n) => n.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const res = await batchDeleteNodes(
        Array.from(selectedIds),
        batchForceDelete,
      );

      if (res.code === 0) {
        const failures = res.data?.failures || [];

        if (res.data?.successCount)
          toast.success(
            batchForceDelete
              ? `已从面板移除 ${res.data.successCount} 个节点，原接入凭证已失效`
              : `成功删除 ${res.data.successCount} 个节点`,
          );
        if (failures.length)
          toast.error(
            failures
              .map((item) => `节点 ${item.id}：${item.reason}`)
              .join("\n"),
          );
        setSelectedIds(
          new Set(
            failures.flatMap((item) =>
              typeof item.id === "number" ? [item.id] : [],
            ),
          ),
        );
        setBatchDeleteModalOpen(failures.length > 0);
        setSelectMode(failures.length > 0);
        await loadNodes({ silent: true });
      } else {
        toast.error(res.msg || "删除失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setBatchLoading(false);
    }
  };

  // 传感器配置
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const nodeExpiryStats = useMemo(() => {
    return nodeList.reduce(
      (acc, node) => {
        if (node.isRemote === 1) {
          return acc;
        }

        const meta = getNodeExpiryMeta(node.expiryTime, node.renewalCycle);

        if (meta.state === "expired") acc.expired += 1;
        if (meta.state === "expiringSoon") acc.expiringSoon += 1;
        if (getNodeReminderEnabled(node)) {
          acc.withExpiry += 1;
        }

        return acc;
      },
      { expired: 0, expiringSoon: 0, withExpiry: 0 },
    );
  }, [nodeList]);

  // 根据排序顺序获取节点列表
  const sortedNodes = useMemo((): Node[] => {
    if (!nodeList || nodeList.length === 0) return [];

    const sortedByDb = [...nodeList].sort((a, b) => {
      const aInx = a.inx ?? 0;
      const bInx = b.inx ?? 0;

      return aInx - bInx;
    });

    // 如果数据库中没有排序信息，则使用本地存储的顺序
    if (
      nodeOrder &&
      nodeOrder.length > 0 &&
      sortedByDb.every((n) => n.inx === undefined || n.inx === 0)
    ) {
      const nodeMap = new Map(nodeList.map((n) => [n.id, n] as const));
      const localSorted: Node[] = [];

      nodeOrder.forEach((id) => {
        const node = nodeMap.get(id);

        if (node) localSorted.push(node);
      });

      nodeList.forEach((node) => {
        if (!nodeOrder.includes(node.id)) {
          localSorted.push(node);
        }
      });

      return localSorted;
    }

    return sortedByDb;
  }, [nodeList, nodeOrder]);

  const filterNodesByKeyword = useCallback((nodes: Node[], keyword: string) => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return nodes;
    }

    return nodes.filter(
      (node) =>
        (node.name && node.name.toLowerCase().includes(normalizedKeyword)) ||
        (node.remark &&
          node.remark.toLowerCase().includes(normalizedKeyword)) ||
        (node.serverIp &&
          node.serverIp.toLowerCase().includes(normalizedKeyword)) ||
        (node.serverIpV4 &&
          node.serverIpV4.toLowerCase().includes(normalizedKeyword)) ||
        (node.serverIpV6 &&
          node.serverIpV6.toLowerCase().includes(normalizedKeyword)),
    );
  }, []);

  const localNodes = useMemo(
    () => sortedNodes.filter((node) => node.isRemote !== 1),
    [sortedNodes],
  );

  const remoteNodes = useMemo(
    () => sortedNodes.filter((node) => node.isRemote === 1),
    [sortedNodes],
  );

  const filteredLocalNodes = useMemo(() => {
    const keywordFiltered = filterNodesByKeyword(
      localNodes,
      localSearchKeyword,
    );

    if (nodeFilterMode === "all") {
      return keywordFiltered;
    }

    return keywordFiltered.filter((node) => {
      const expiryMeta = getNodeExpiryMeta(node.expiryTime, node.renewalCycle);

      switch (nodeFilterMode) {
        case "expiringSoon":
          return expiryMeta.state === "expiringSoon";
        case "expired":
          return expiryMeta.state === "expired";
        case "withExpiry":
          return getNodeReminderEnabled(node);
        default:
          return true;
      }
    });
  }, [filterNodesByKeyword, localNodes, localSearchKeyword, nodeFilterMode]);

  const filteredRemoteNodes = useMemo(
    () => filterNodesByKeyword(remoteNodes, remoteSearchKeyword),
    [filterNodesByKeyword, remoteNodes, remoteSearchKeyword],
  );

  const currentSearchKeyword =
    activeTab === "remote" ? remoteSearchKeyword : localSearchKeyword;

  const setCurrentSearchKeyword =
    activeTab === "remote" ? setRemoteSearchKeyword : setLocalSearchKeyword;

  const displayNodes = useMemo(
    () => (activeTab === "remote" ? filteredRemoteNodes : filteredLocalNodes),
    [activeTab, filteredLocalNodes, filteredRemoteNodes],
  );

  const canBatchUpgrade = activeTab === "local";
  const canUseExpiryFilter = activeTab === "local";
  const hasKeywordSearch = currentSearchKeyword.trim().length > 0;
  const hasActiveFilters = nodeFilterMode !== "all";
  const isDisplayFiltered =
    hasKeywordSearch || (canUseExpiryFilter && hasActiveFilters);

  const sortableNodeIds = useMemo(
    () => displayNodes.map((n) => n.id),
    [displayNodes],
  );

  const nodeHandlers: NodeItemHandlers = {
    formatSpeed,
    formatUptime,
    formatFlow,
    formatChainType,
    onInstall: openInstallSelector,
    onUpgrade: (node) => openUpgradeModal("single", node.id),
    onRollback: handleRollbackNode,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onDismissReminder: handleDismissExpiryReminder,
    onToggleSelect: (nodeId) => {
      setSelectMode(true);
      toggleSelect(nodeId);
    },
  };
  const onlineCount = displayNodes.filter(
    (node) => node.connectionStatus === "online",
  ).length;
  const dueCount =
    activeTab === "local"
      ? displayNodes.filter(
          (node) =>
            !node.expiryReminderDismissed &&
            getNodeExpiryMeta(node.expiryTime, node.renewalCycle).isHighlighted,
        ).length
      : 0;
  const allDisplayedSelected =
    displayNodes.length > 0 && selectedIds.size === displayNodes.length;
  const clearDisplayFilters = () => {
    setCurrentSearchKeyword("");
    resetNodeFilterMode();
  };

  return (
    <AnimatedPage>
      <PageToolbar
        actions={
          <BatchModeButton active={selectMode} onToggle={toggleSelectMode} />
        }
        filter={{
          count: hasActiveFilters ? 1 : 0,
          disabled: !canUseExpiryFilter,
          title: canUseExpiryFilter
            ? "按到期状态筛选"
            : "远程节点不支持到期筛选",
          onOpen: () => setIsFilterModalOpen(true),
        }}
        primary={{
          label: "新增",
          noun: "节点",
          icon: <Plus size={16} />,
          onClick: handleAdd,
        }}
        search={
          <SearchBar
            placeholder={
              activeTab === "remote"
                ? "搜索远程节点名称或IP"
                : "搜索节点名称或IP"
            }
            value={currentSearchKeyword}
            onChange={setCurrentSearchKeyword}
          />
        }
        tabs={
          <SegmentedControl
            aria-label="节点类型"
            data={[
              { value: "local", label: `本地节点 ${localNodes.length}` },
              { value: "remote", label: `远程节点 ${remoteNodes.length}` },
            ]}
            size="sm"
            value={activeTab}
            onChange={(value) => setActiveTab(value as NodeTab)}
          />
        }
        view={{ value: viewMode, onChange: setViewMode }}
      />

      {!loading && nodeList.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-default-500">
          <span>
            共{" "}
            <span className="font-semibold text-foreground">
              {displayNodes.length}
            </span>{" "}
            个节点
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            在线 {onlineCount}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-default-400" />
            离线 {displayNodes.length - onlineCount}
          </span>
          {dueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-warning-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              {dueCount} 个需要续费
            </span>
          )}
        </div>
      )}

      {selectMode && (
        <div className="app-batch-bar">
          <span className="text-sm font-medium text-primary-ink">
            已选择 {selectedIds.size} 项
          </span>
          <Button color="gray" size="xs" variant="subtle" onClick={selectAll}>
            全选
          </Button>
          <Button color="gray" size="xs" variant="subtle" onClick={deselectAll}>
            取消选择
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              color="orange"
              disabled={selectedIds.size === 0 || !canBatchUpgrade}
              leftSection={<CircleArrowUp size={14} />}
              loading={batchUpgradeLoading}
              size="xs"
              variant="light"
              onClick={() => openUpgradeModal("batch")}
            >
              升级
            </Button>
            <Button
              color="red"
              disabled={selectedIds.size === 0}
              leftSection={<Trash2 size={14} />}
              size="xs"
              variant="light"
              onClick={() => {
                setBatchForceDelete(false);
                setBatchDeleteModalOpen(true);
              }}
            >
              删除
            </Button>
            <Button
              color="gray"
              size="xs"
              variant="light"
              onClick={toggleSelectMode}
            >
              完成
            </Button>
          </div>
        </div>
      )}

      {!wsConnected && (
        <Alert className="mb-4" color="orange">
          {wsConnecting
            ? "监控连接中..."
            : usingPollingFallback
              ? "监控连接已断开，已切换为列表自动刷新兜底模式。"
              : "监控连接已断开，正在重连..."}
        </Alert>
      )}

      {loading ? (
        <PageLoadingState message="正在加载..." />
      ) : displayNodes.length === 0 ? (
        isDisplayFiltered ? (
          <EmptyStateCard
            action={
              <Button variant="default" onClick={clearDisplayFilters}>
                清空筛选条件
              </Button>
            }
            description="调整关键词或到期筛选后再试。"
            icon={<SearchX size={20} />}
            title={
              activeTab === "remote" ? "没有匹配的远程节点" : "没有匹配的节点"
            }
            tone="default"
          />
        ) : activeTab === "remote" ? (
          <EmptyStateCard
            action={
              <MantineButton
                component={Link}
                to="/panel-sharing"
                variant="default"
              >
                前往面板共享
              </MantineButton>
            }
            description="在面板共享中导入其他面板分享的节点后，会显示在这里。"
            icon={<Share2 size={20} />}
            title="还没有远程节点"
          />
        ) : (
          <EmptyStateCard
            action={
              <Button leftSection={<Plus size={16} />} onClick={handleAdd}>
                新增节点
              </Button>
            }
            description="新增节点后，复制安装命令到服务器执行即可接入面板。"
            icon={<Server size={20} />}
            title="还没有节点"
          />
        )
      ) : viewMode === "list" ? (
        <div className="node-list">
          <NodeListHeader
            isAllSelected={allDisplayedSelected}
            isIndeterminate={selectedIds.size > 0 && !allDisplayedSelected}
            onToggleAll={(checked) => {
              if (checked) {
                setSelectMode(true);
                selectAll();
              } else {
                deselectAll();
              }
            }}
          />
          {displayNodes.map((node) => (
            <NodeRow
              key={node.id}
              handlers={nodeHandlers}
              node={node}
              selected={selectedIds.has(node.id)}
            />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortableNodeIds}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
              {displayNodes.map((node) => (
                <SortableItem key={node.id} id={node.id}>
                  {(listeners) => (
                    <NodeCard
                      dragListeners={listeners}
                      handlers={nodeHandlers}
                      node={node}
                      remoteUsage={
                        node.isRemote === 1
                          ? (remoteUsageMap[node.id] ?? null)
                          : null
                      }
                      selectMode={selectMode}
                      selected={selectedIds.has(node.id)}
                      upgradeProgress={upgradeProgress[node.id]}
                    />
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {/* 新增/编辑节点对话框 */}
      <NodeFormModal
        dialogTitle={dialogTitle}
        dialogVisible={dialogVisible}
        errors={errors}
        form={form}
        handleSubmit={handleSubmit}
        protocolControlsDisabled={protocolControlsDisabled}
        protocolControlsReason={protocolControlsReason}
        setDialogVisible={setDialogVisible}
        setForm={setForm}
        submitLoading={submitLoading}
      />

      {/* 回退确认模态框 */}
      <Modal
        opened={rollbackModalOpen}
        size="2xl"
        onClose={() => setRollbackModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">确认回退</h2>
          </ModalHeader>
          <ModalBody>
            <p>
              确定要将节点 <strong>&quot;{nodeToRollback?.name}&quot;</strong>{" "}
              回退到上一个版本吗？
            </p>
            <p className="text-small text-default-500">
              节点将执行版本回退并自动重启，期间会导致节点短暂离线。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="gray"
              variant="subtle"
              onClick={() => setRollbackModalOpen(false)}
            >
              取消
            </Button>
            <Button color="violet" onClick={confirmRollback}>
              确认回退
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除确认模态框 */}
      <NodeDeleteModal
        confirmDelete={confirmDelete}
        deleteLoading={deleteLoading}
        deleteModalOpen={deleteModalOpen}
        forceNodeRemoval={forceNodeRemoval}
        nodeToDelete={nodeToDelete}
        setDeleteModalOpen={setDeleteModalOpen}
        setForceDelete={setForceDelete}
      />

      <InstallSelectorModal
        handleConfirmInstallCommand={handleConfirmInstallCommand}
        installChannel={installChannel}
        installSelectorOpen={installSelectorOpen}
        installTargetNode={installTargetNode}
        setInstallChannel={setInstallChannel}
        setInstallSelectorOpen={setInstallSelectorOpen}
      />

      {/* 安装命令模态框 */}
      <InstallCommandModal
        currentNodeName={currentNodeName}
        handleManualCopy={handleManualCopy}
        installCommand={installCommand}
        installCommandModal={installCommandModal}
        setInstallCommandModal={setInstallCommandModal}
      />

      {/* 版本选择升级模态框 */}
      <NodeUpgradeModal
        handleConfirmUpgrade={handleConfirmUpgrade}
        loadReleasesByChannel={loadReleasesByChannel}
        releaseChannel={releaseChannel}
        releases={releases}
        releasesLoading={releasesLoading}
        selectedIds={selectedIds}
        selectedVersion={selectedVersion}
        setReleaseChannel={setReleaseChannel}
        setSelectedVersion={setSelectedVersion}
        setUpgradeModalOpen={setUpgradeModalOpen}
        upgradeModalOpen={upgradeModalOpen}
        upgradeTarget={upgradeTarget}
      />

      {/* 批量删除确认模态框 */}
      <NodeBatchDeleteModal
        batchDeleteModalOpen={batchDeleteModalOpen}
        batchForceDelete={batchForceDelete}
        batchLoading={batchLoading}
        handleBatchDelete={handleBatchDelete}
        selectedIds={selectedIds}
        setBatchDeleteModalOpen={setBatchDeleteModalOpen}
        setBatchForceDelete={setBatchForceDelete}
      />

      <NodeFilterModal
        isFilterModalOpen={isFilterModalOpen}
        nodeExpiryStats={nodeExpiryStats}
        nodeFilterMode={nodeFilterMode}
        resetNodeFilterMode={resetNodeFilterMode}
        setIsFilterModalOpen={setIsFilterModalOpen}
        setNodeFilterMode={setNodeFilterMode}
      />
    </AnimatedPage>
  );
}
