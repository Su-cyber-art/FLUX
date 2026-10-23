import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button as MantineButton, SegmentedControl } from "@mantine/core";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  CircleArrowUp,
  Copy,
  CreditCard,
  Download,
  LayoutGrid,
  List,
  Lock,
  Plus,
  SearchX,
  Server,
  Share2,
  SlidersHorizontal,
  SquareCheckBig,
  Trash2,
} from "lucide-react";

import {
  NODE_FALLBACK_REFRESH_INTERVAL_MS,
  Node,
  NodeForm,
  NodeTab,
  RemoteUsageNode,
  NodeFilterMode,
  getNodeReminderEnabled,
  getNodeExpiryMeta,
  mergeNodeRealtimeState,
  SortableItem,
} from "@/pages/node/presentation";
import toast from "@/lib/notifications";
import { SearchBar } from "@/components/search-bar";
import { FormSection } from "@/components/form-section";
import { formatTraffic } from "@/utils/traffic";
import { AnimatedPage } from "@/components/animated-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Chip } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Select, SelectItem } from "@/components/ui/select";
import {
  createNode,
  getNodeList,
  updateNode,
  deleteNode,
  getNodeInstallCommand,
  updateNodeOrder,
  batchDeleteNodes,
  upgradeNode,
  batchUpgradeNodes,
  getNodeReleases,
  rollbackNode,
  getPeerRemoteUsageList,
  dismissNodeExpiryReminder,
  type ReleaseChannel,
} from "@/api";
import { EmptyStateCard, PageLoadingState } from "@/components/page-state";
import {
  NodeCard,
  NodeListHeader,
  NodeRow,
  type NodeItemHandlers,
} from "@/pages/node/node-items";
import { tryCopyInstallCommand } from "@/pages/node/install-command";
import { type NodeRenewalCycle } from "@/pages/node/renewal";
import { buildNodeSystemInfo } from "@/pages/node/system-info";
import { useNodeOfflineTimers } from "@/pages/node/use-node-offline-timers";
import { useNodeRealtime } from "@/pages/node/use-node-realtime";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { loadStoredOrder, saveOrder } from "@/utils/order-storage";

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
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [isEdit, setIsEdit] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [nodeToRollback, setNodeToRollback] = useState<Node | null>(null);
  const [nodeToDelete, setNodeToDelete] = useState<Node | null>(null);
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
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!nodeToDelete) return;

    setDeleteLoading(true);
    try {
      const res = await deleteNode(nodeToDelete.id);

      if (res.code === 0) {
        toast.success("删除成功");
        setNodeList((prev) => prev.filter((n) => n.id !== nodeToDelete.id));
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
      const res = await batchDeleteNodes(Array.from(selectedIds));

      if (res.code === 0) {
        const failures = res.data?.failures || [];

        if (res.data?.successCount)
          toast.success(`成功删除 ${res.data.successCount} 个节点`);
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
      <div className="page-toolbar">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-1">
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
          <div className="min-w-40 flex-1 sm:max-w-64">
            <SearchBar
              isVisible={isSearchVisible}
              placeholder={
                activeTab === "remote"
                  ? "搜索远程节点名称或IP"
                  : "搜索节点名称或IP"
              }
              value={currentSearchKeyword}
              onChange={setCurrentSearchKeyword}
              onClose={() => setIsSearchVisible(false)}
              onOpen={() => setIsSearchVisible(true)}
            />
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            aria-label="筛选"
            endContent={
              canUseExpiryFilter && hasActiveFilters ? (
                <Chip color="primary" size="xs" variant="solid">
                  1
                </Chip>
              ) : undefined
            }
            isDisabled={!canUseExpiryFilter}
            startContent={<SlidersHorizontal size={15} />}
            title={
              canUseExpiryFilter ? "按到期状态筛选" : "远程节点不支持到期筛选"
            }
            onPress={() => setIsFilterModalOpen(true)}
          >
            <span className="hidden sm:inline">筛选</span>
          </Button>
          <SegmentedControl
            aria-label="显示方式"
            data={[
              {
                value: "grid",
                label: (
                  <span className="flex items-center gap-1.5">
                    <LayoutGrid size={15} />
                    <span className="hidden sm:inline">卡片</span>
                  </span>
                ),
              },
              {
                value: "list",
                label: (
                  <span className="flex items-center gap-1.5">
                    <List size={15} />
                    <span className="hidden sm:inline">列表</span>
                  </span>
                ),
              },
            ]}
            size="sm"
            value={viewMode}
            onChange={(value) => setViewMode(value as "list" | "grid")}
          />
          <Button
            aria-label={selectMode ? "完成批量操作" : "批量操作"}
            startContent={<SquareCheckBig size={15} />}
            onPress={toggleSelectMode}
          >
            <span className="hidden sm:inline">
              {selectMode ? "完成" : "批量"}
            </span>
          </Button>
          <Button
            className="ml-auto sm:ml-0"
            color="primary"
            startContent={<Plus size={16} />}
            onPress={handleAdd}
          >
            新增<span className="hidden sm:inline">节点</span>
          </Button>
        </div>
      </div>

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
          <Button size="sm" variant="light" onPress={selectAll}>
            全选
          </Button>
          <Button size="sm" variant="light" onPress={deselectAll}>
            取消选择
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              color="warning"
              isDisabled={selectedIds.size === 0 || !canBatchUpgrade}
              isLoading={batchUpgradeLoading}
              size="sm"
              startContent={<CircleArrowUp size={14} />}
              variant="flat"
              onPress={() => openUpgradeModal("batch")}
            >
              升级
            </Button>
            <Button
              color="danger"
              isDisabled={selectedIds.size === 0}
              size="sm"
              startContent={<Trash2 size={14} />}
              variant="flat"
              onPress={() => setBatchDeleteModalOpen(true)}
            >
              删除
            </Button>
            <Button size="sm" variant="flat" onPress={toggleSelectMode}>
              完成
            </Button>
          </div>
        </div>
      )}

      {!wsConnected && (
        <Alert
          className="mb-4"
          color="warning"
          description={
            wsConnecting
              ? "监控连接中..."
              : usingPollingFallback
                ? "监控连接已断开，已切换为列表自动刷新兜底模式。"
                : "监控连接已断开，正在重连..."
          }
          variant="flat"
        />
      )}

      {loading ? (
        <PageLoadingState message="正在加载..." />
      ) : displayNodes.length === 0 ? (
        isDisplayFiltered ? (
          <EmptyStateCard
            action={<Button onPress={clearDisplayFilters}>清空筛选条件</Button>}
            description="调整关键词或到期筛选后再试。"
            icon={<SearchX size={20} />}
            title={
              activeTab === "remote" ? "没有匹配的远程节点" : "没有匹配的节点"
            }
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
              <Button
                color="primary"
                startContent={<Plus size={16} />}
                onPress={handleAdd}
              >
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
      <Modal
        backdrop="blur"
        isOpen={dialogVisible}
        placement="center"
        scrollBehavior="inside"
        size="xl"
        onClose={() => setDialogVisible(false)}
      >
        <ModalContent>
          <ModalHeader>{dialogTitle}</ModalHeader>
          <ModalBody>
            <div>
              <FormSection title="基本信息">
                <Input
                  errorMessage={errors.name}
                  isInvalid={!!errors.name}
                  label="节点名称"
                  placeholder="请输入节点名称"
                  value={form.name}
                  variant="bordered"
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />

                <Textarea
                  description="可记录供应商、用途、续费说明等补充信息"
                  label="备注"
                  maxRows={4}
                  minRows={3}
                  placeholder="例如: 搬瓦工年付，2026-12 续费，日本中转"
                  value={form.remark}
                  variant="bordered"
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
                    description="按月、季或年循环续费"
                    label="续费周期"
                    placeholder="选择续费周期"
                    selectedKeys={form.renewalCycle ? [form.renewalCycle] : []}
                    variant="bordered"
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as
                        | NodeRenewalCycle
                        | undefined;

                      setForm((prev) => ({
                        ...prev,
                        renewalCycle: selected || "",
                      }));
                    }}
                  >
                    <SelectItem key="month" textValue="month">
                      月付
                    </SelectItem>
                    <SelectItem key="quarter" textValue="quarter">
                      季付
                    </SelectItem>
                    <SelectItem key="year" textValue="year">
                      年付
                    </SelectItem>
                  </Select>

                  <Input
                    description="最近一次续费或周期起始日期，例如月付填 2026-03-01 即按每月 1 日推算"
                    errorMessage={errors.expiryTime}
                    isInvalid={!!errors.expiryTime}
                    label="续费基准时间"
                    max="9999-12-31"
                    type="date"
                    value={
                      form.expiryTime > 0
                        ? new Date(form.expiryTime).toISOString().slice(0, 10)
                        : ""
                    }
                    variant="bordered"
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
                <Input
                  description="可选：不带协议、不带端口。建议在 IPv4 和 IPv6 都未填写时使用。至少填写一个 IPv4/IPv6 域名"
                  errorMessage={errors.serverHost}
                  isInvalid={!!errors.serverHost}
                  label="域名/主机名"
                  placeholder="例如: test.example.com"
                  value={form.serverHost}
                  variant="bordered"
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, serverHost: e.target.value }))
                  }
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    description="填写一个 IPv4 地址"
                    errorMessage={errors.serverIpV4}
                    isInvalid={!!errors.serverIpV4}
                    label="IPv4 地址"
                    placeholder="例如: 192.168.1.100"
                    value={form.serverIpV4}
                    variant="bordered"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        serverIpV4: e.target.value,
                      }))
                    }
                  />

                  <Input
                    description="填写一个 IPv6 地址"
                    errorMessage={errors.serverIpV6}
                    isInvalid={!!errors.serverIpV6}
                    label="IPv6 地址"
                    placeholder="例如: 2001:db8::10"
                    value={form.serverIpV6}
                    variant="bordered"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        serverIpV6: e.target.value,
                      }))
                    }
                  />
                </div>

                <Input
                  classNames={{
                    input: "font-mono",
                  }}
                  description="支持单个端口(80)、多个端口(80,443)或端口范围(10000-65535)，多个可用逗号分隔"
                  errorMessage={errors.port}
                  isInvalid={!!errors.port}
                  label="可用端口"
                  placeholder="例如: 80,443,10000-65535"
                  value={form.port}
                  variant="bordered"
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, port: e.target.value }))
                  }
                />
              </FormSection>

              <FormSection title="运行模式">
                <Select
                  label="转发模式"
                  selectedKeys={[form.forwardMode]}
                  variant="bordered"
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as
                      | NodeForm["forwardMode"]
                      | undefined;

                    setForm((prev) => ({
                      ...prev,
                      forwardMode: selected || "agent",
                    }));
                  }}
                >
                  <SelectItem key="agent" textValue="agent">
                    agent 模式
                  </SelectItem>
                  <SelectItem key="nftables" textValue="nftables">
                    nftables 模式
                  </SelectItem>
                </Select>

                {form.forwardMode === "nftables" ? (
                  <Alert
                    color="warning"
                    description="nftables 模式仅支持纯转发，不支持隧道、流量控制和 agent 安装，规则将由面板通过 SSH 下发。"
                    variant="flat"
                  />
                ) : (
                  <Alert
                    color="primary"
                    description="agent 模式会继续使用节点 agent 执行转发与管理操作。"
                    variant="flat"
                  />
                )}
              </FormSection>

              {/* 高级配置 */}
              <section className="form-section">
                <Accordion className="px-0" variant="light">
                  <AccordionItem
                    key="advanced"
                    aria-label="高级配置"
                    className="border-b-0 [&_[data-slot=accordion-trigger]]:no-underline [&_[data-slot=accordion-trigger]]:hover:no-underline"
                    title={
                      <span className="text-small text-default-500 font-medium">
                        高级配置
                      </span>
                    }
                  >
                    <div className="space-y-4 pb-2">
                      {form.forwardMode === "nftables" ? (
                        <div className="space-y-4 rounded-xl border border-warning-line bg-warning-soft p-4">
                          <div>
                            <div className="text-sm font-medium text-warning-ink">
                              SSH 配置
                            </div>
                            <div className="text-xs text-default-500">
                              面板会通过 SSH 下发 nftables 规则，不会安装
                              agent。
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                              errorMessage={errors.sshHost}
                              isInvalid={!!errors.sshHost}
                              label="SSH 主机"
                              placeholder="例如: 192.0.2.10"
                              value={form.sshHost}
                              variant="bordered"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  sshHost: e.target.value,
                                }))
                              }
                            />

                            <Input
                              errorMessage={errors.sshPort}
                              isInvalid={!!errors.sshPort}
                              label="SSH 端口"
                              placeholder="22"
                              value={form.sshPort}
                              variant="bordered"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  sshPort: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                              errorMessage={errors.sshUsername}
                              isInvalid={!!errors.sshUsername}
                              label="SSH 用户名"
                              placeholder="例如: root"
                              value={form.sshUsername}
                              variant="bordered"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  sshUsername: e.target.value,
                                }))
                              }
                            />

                            <Select
                              label="SSH 认证方式"
                              selectedKeys={[form.sshAuthType]}
                              variant="bordered"
                              onSelectionChange={(keys) => {
                                const selected = Array.from(keys)[0] as
                                  | "password"
                                  | "private_key"
                                  | undefined;

                                setForm((prev) => ({
                                  ...prev,
                                  sshAuthType: selected || "private_key",
                                }));
                              }}
                            >
                              <SelectItem
                                key="private_key"
                                textValue="private_key"
                              >
                                私钥
                              </SelectItem>
                              <SelectItem key="password" textValue="password">
                                密码
                              </SelectItem>
                            </Select>
                          </div>

                          {form.sshAuthType === "password" ? (
                            <Input
                              errorMessage={errors.sshPassword}
                              isInvalid={!!errors.sshPassword}
                              label="SSH 密码"
                              placeholder="请输入 SSH 密码"
                              type="password"
                              value={form.sshPassword}
                              variant="bordered"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  sshPassword: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <Textarea
                              errorMessage={errors.sshPrivateKey}
                              isInvalid={!!errors.sshPrivateKey}
                              label="SSH 私钥"
                              minRows={6}
                              placeholder="粘贴 PEM 格式私钥内容"
                              value={form.sshPrivateKey}
                              variant="bordered"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  sshPrivateKey: e.target.value,
                                }))
                              }
                            />
                          )}

                          <Input
                            label="SSH 私钥密码短语"
                            placeholder="可选"
                            type="password"
                            value={form.sshPassphrase}
                            variant="bordered"
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                sshPassphrase: e.target.value,
                              }))
                            }
                          />

                          <Select
                            label="sudo 提权方式"
                            selectedKeys={[form.sshSudoMode]}
                            variant="bordered"
                            onSelectionChange={(keys) => {
                              const selected = Array.from(keys)[0] as
                                | "none"
                                | "sudo"
                                | "sudo_su"
                                | undefined;

                              setForm((prev) => ({
                                ...prev,
                                sshSudoMode: selected || "none",
                              }));
                            }}
                          >
                            <SelectItem key="none" textValue="none">
                              无需提权
                            </SelectItem>
                            <SelectItem key="sudo" textValue="sudo">
                              sudo
                            </SelectItem>
                            <SelectItem key="sudo_su" textValue="sudo_su">
                              sudo su
                            </SelectItem>
                          </Select>
                        </div>
                      ) : (
                        <Alert
                          color="primary"
                          description="agent 模式下无需填写 SSH 配置；节点安装 agent 后会自行接管转发。"
                          variant="flat"
                        />
                      )}

                      <Input
                        description="用于多IP服务器指定使用那个IP请求远程地址，不懂的默认为空就行"
                        errorMessage={errors.interfaceName}
                        isInvalid={!!errors.interfaceName}
                        label="出口网卡名或IP"
                        placeholder="请输入出口网卡名或IP"
                        value={form.interfaceName}
                        variant="bordered"
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            interfaceName: e.target.value,
                          }))
                        }
                      />

                      <Input
                        description="多IP服务器可填写额外IP地址，逗号分隔"
                        label="额外IP地址"
                        placeholder="例如: 192.168.1.100, 10.0.0.5"
                        value={form.extraIPs}
                        variant="bordered"
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            extraIPs: e.target.value,
                          }))
                        }
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          errorMessage={errors.tcpListenAddr}
                          isInvalid={!!errors.tcpListenAddr}
                          label="TCP监听地址"
                          placeholder="请输入TCP监听地址"
                          startContent={
                            <div className="pointer-events-none flex items-center">
                              <span className="text-default-400 text-small">
                                TCP
                              </span>
                            </div>
                          }
                          value={form.tcpListenAddr}
                          variant="bordered"
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              tcpListenAddr: e.target.value,
                            }))
                          }
                        />

                        <Input
                          errorMessage={errors.udpListenAddr}
                          isInvalid={!!errors.udpListenAddr}
                          label="UDP监听地址"
                          placeholder="请输入UDP监听地址"
                          startContent={
                            <div className="pointer-events-none flex items-center">
                              <span className="text-default-400 text-small">
                                UDP
                              </span>
                            </div>
                          }
                          value={form.udpListenAddr}
                          variant="bordered"
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
                          <Alert
                            className="mb-2"
                            color="warning"
                            description={protocolControlsReason}
                            variant="flat"
                          />
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
                                isDisabled={protocolControlsDisabled}
                                isSelected={form.http === 1}
                                size="sm"
                                onValueChange={(v) =>
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
                                isDisabled={protocolControlsDisabled}
                                isSelected={form.tls === 1}
                                size="sm"
                                onValueChange={(v) =>
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
                                isDisabled={protocolControlsDisabled}
                                isSelected={form.socks === 1}
                                size="sm"
                                onValueChange={(v) =>
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

                      <Alert
                        color="danger"
                        description="请不要在出口节点执行屏蔽协议，否则可能影响转发；屏蔽协议仅需在入口节点执行。"
                        variant="flat"
                      />
                    </div>
                  </AccordionItem>
                </Accordion>
              </section>

              <Alert
                className="mt-4"
                color="primary"
                description="节点ip地址是你要添加的入口/出口的ip地址，不是面板的ip地址。"
                variant="flat"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setDialogVisible(false)}>
              取消
            </Button>
            <Button
              color="primary"
              isLoading={submitLoading}
              onPress={handleSubmit}
            >
              {submitLoading ? "提交中..." : "确定"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 回退确认模态框 */}
      <Modal
        backdrop="blur"
        isOpen={rollbackModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={setRollbackModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">确认回退</h2>
              </ModalHeader>
              <ModalBody>
                <p>
                  确定要将节点{" "}
                  <strong>&quot;{nodeToRollback?.name}&quot;</strong>{" "}
                  回退到上一个版本吗？
                </p>
                <p className="text-small text-default-500">
                  节点将执行版本回退并自动重启，期间会导致节点短暂离线。
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button color="secondary" onPress={confirmRollback}>
                  确认回退
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        backdrop="blur"
        isOpen={deleteModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={setDeleteModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">确认删除</h2>
              </ModalHeader>
              <ModalBody>
                <p>
                  确定要删除节点{" "}
                  <strong>&quot;{nodeToDelete?.name}&quot;</strong> 吗？
                </p>
                <p className="text-small text-default-500">
                  本地节点会停止转发、清除配置并卸载
                  agent；离线节点上线后自动清理。请先解除隧道、转发和共享引用。远程共享节点仅移除本面板的接入。
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button
                  color="danger"
                  isLoading={deleteLoading}
                  onPress={confirmDelete}
                >
                  {deleteLoading ? "删除中..." : "确认删除"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal
        backdrop="blur"
        isOpen={installSelectorOpen}
        placement="center"
        size="md"
        onOpenChange={setInstallSelectorOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">
                  选择安装通道
                  {installTargetNode ? ` - ${installTargetNode.name}` : ""}
                </h2>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <Select
                    label="版本通道"
                    selectedKeys={[installChannel]}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as ReleaseChannel;

                      setInstallChannel(selected || "stable");
                    }}
                  >
                    <SelectItem key="stable" textValue="stable">
                      正式版（纯数字版本，如 2.1.4）
                    </SelectItem>
                    <SelectItem key="dev" textValue="dev">
                      测试版（含 alpha / beta / rc）
                    </SelectItem>
                  </Select>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button color="primary" onPress={handleConfirmInstallCommand}>
                  生成命令
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 安装命令模态框 */}
      <Modal
        backdrop="blur"
        isOpen={installCommandModal}
        placement="center"
        scrollBehavior="inside"
        size="lg"
        onClose={() => setInstallCommandModal(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h2>安装节点</h2>
            <p>{currentNodeName}</p>
          </ModalHeader>
          <ModalBody>
            <ol className="install-steps">
              <li>以 root 身份登录目标服务器</li>
              <li>复制下方命令并在终端中执行</li>
              <li>安装完成后，节点状态会自动变为在线</li>
            </ol>
            <div className="code-block">
              <div className="code-block-head">
                <span>bash</span>
                <Button
                  size="sm"
                  startContent={<Copy size={14} />}
                  variant="light"
                  onPress={handleManualCopy}
                >
                  复制
                </Button>
              </div>
              <pre>{installCommand}</pre>
            </div>
            <p className="text-xs text-default-500">
              复制按钮不可用时，点击命令区域即可全选后手动复制。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => setInstallCommandModal(false)}
            >
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 版本选择升级模态框 */}
      <Modal
        backdrop="blur"
        isOpen={upgradeModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="md"
        onOpenChange={setUpgradeModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">
                  {upgradeTarget === "batch"
                    ? `批量升级 (${selectedIds.size} 个节点)`
                    : "升级节点"}
                </h2>
              </ModalHeader>
              <ModalBody>
                {releasesLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner size="lg" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Select
                      label="版本通道"
                      selectedKeys={[releaseChannel]}
                      onSelectionChange={(keys) => {
                        const selected =
                          (Array.from(keys)[0] as ReleaseChannel) || "stable";

                        setReleaseChannel(selected);
                        setSelectedVersion("");
                        void loadReleasesByChannel(selected);
                      }}
                    >
                      <SelectItem key="stable" textValue="stable">
                        正式版（纯数字版本，如 2.1.4）
                      </SelectItem>
                      <SelectItem key="dev" textValue="dev">
                        测试版（含 alpha / beta / rc）
                      </SelectItem>
                    </Select>
                    <Select
                      label="选择版本"
                      placeholder="留空则使用当前通道最新版本"
                      selectedKeys={selectedVersion ? [selectedVersion] : []}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;

                        setSelectedVersion(selected || "");
                      }}
                    >
                      {releases.map((r) => (
                        <SelectItem key={r.version} textValue={r.version}>
                          <div className="flex justify-between items-center">
                            <span>{r.version}</span>
                            <span className="text-xs text-default-400">
                              {r.publishedAt
                                ? new Date(r.publishedAt).toLocaleDateString()
                                : ""}
                              {r.channel === "dev" && (
                                <Chip
                                  className="ml-1 shrink-0 whitespace-nowrap"
                                  color="warning"
                                  size="sm"
                                  variant="flat"
                                >
                                  测试
                                </Chip>
                              )}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </Select>
                    <p className="text-sm text-default-500">
                      {selectedVersion
                        ? `将升级到版本 ${selectedVersion}`
                        : `未选择版本，将自动使用最新${releaseChannel === "stable" ? "正式" : "测试"}版`}
                    </p>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button
                  color="warning"
                  isDisabled={releasesLoading}
                  onPress={handleConfirmUpgrade}
                >
                  确认升级
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 批量删除确认模态框 */}
      <Modal
        backdrop="blur"
        isOpen={batchDeleteModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="md"
        onOpenChange={setBatchDeleteModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">确认删除</h2>
              </ModalHeader>
              <ModalBody>
                <p>
                  确定要删除选中的 <strong>{selectedIds.size}</strong>{" "}
                  个节点吗？
                </p>
                <p className="text-small text-default-500">
                  将逐项清理并卸载本地
                  agent；离线节点上线后自动重试。有关联资源或清理失败的节点会保留并显示原因。
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button
                  color="danger"
                  isLoading={batchLoading}
                  onPress={handleBatchDelete}
                >
                  {batchLoading ? "删除中..." : "确认删除"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isFilterModalOpen}
        placement="center"
        size="md"
        onOpenChange={setIsFilterModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                筛选条件
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">按到期状态筛选</p>
                    <Select
                      aria-label="按到期状态筛选"
                      className="w-full"
                      selectedKeys={[nodeFilterMode]}
                      variant="bordered"
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as
                          | NodeFilterMode
                          | undefined;

                        setNodeFilterMode(selected || "all");
                      }}
                    >
                      <SelectItem key="all">全部节点</SelectItem>
                      <SelectItem key="expiringSoon">
                        7天内续费 ({nodeExpiryStats.expiringSoon})
                      </SelectItem>
                      <SelectItem key="expired">
                        已逾期 ({nodeExpiryStats.expired})
                      </SelectItem>
                      <SelectItem key="withExpiry">
                        已启用续费提醒 ({nodeExpiryStats.withExpiry})
                      </SelectItem>
                    </Select>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  color="default"
                  variant="flat"
                  onPress={resetNodeFilterMode}
                >
                  重置
                </Button>
                <Button color="primary" onPress={onClose}>
                  完成
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </AnimatedPage>
  );
}
