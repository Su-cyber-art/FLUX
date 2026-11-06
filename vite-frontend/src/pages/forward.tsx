import type { BatchOperationFailure, SpeedLimitApiItem } from "@/api/types";

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Button as MantineButton,
  Menu,
  Progress,
} from "@mantine/core";
import {
  ArrowDownUp,
  ArrowLeftRight,
  ChevronDown,
  Download,
  Pause,
  Play,
  Plus,
  SearchX,
  Send,
  Shuffle,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createForward,
  deleteForward,
  forceDeleteForward,
  getConfigByName,
  getForwardList,
  getNodeList,
  getSpeedLimitList,
  getTunnelList,
  pauseForwardService,
  resetForwardFlow,
  resumeForwardService,
  updateConfig,
  updateForward,
  updateForwardOrder,
  userTunnel,
} from "@/api";
import { AnimatedPage } from "@/components/animated-page";
import { BatchActionResultModal } from "@/components/batch-action-result-modal";
import { confirmAction } from "@/components/confirm-host";
import { EmptyStateCard, PageLoadingState } from "@/components/page-state";
import { PageToolbar } from "@/components/page-toolbar";
import { SearchBar } from "@/components/search-bar";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import toast from "@/lib/notifications";
import {
  resolveForwardAddressAction,
  type ForwardAddressItem,
} from "@/pages/forward/address";
import {
  executeForwardBatchChangeTunnel,
  executeForwardBatchDelete,
  executeForwardBatchRedeploy,
  executeForwardBatchToggleService,
} from "@/pages/forward/batch-actions";
import { getForwardDiagnosisQualityDisplay } from "@/pages/forward/diagnosis";
import { buildForwardOrder, FORWARD_ORDER_KEY } from "@/pages/forward/order";
import {
  BatchProgressState,
  BatchResultModalState,
  buildAvailableGroupData,
  buildForwardGroupCollapsedLocalKey,
  buildForwardGroupOrderLocalKey,
  buildForwardTunnelGroupKey,
  buildTunnelGroupCollapseKey,
  buildTunnelGroupSortableId,
  compareForwardTunnelNameAsc,
  compareForwardUserNameAsc,
  EMPTY_BATCH_RESULT_MODAL_STATE,
  Forward,
  FORWARD_CARD_GRID_CLASS,
  FORWARD_COMPACT_MODE_CONFIG_KEY,
  FORWARD_COMPACT_MODE_EVENT,
  FORWARD_GROUP_COLLAPSED_CONFIG_KEY,
  FORWARD_GROUP_ORDER_CONFIG_KEY,
  ForwardCard,
  ForwardForm,
  ForwardGroupCollapsedMap,
  ForwardGroupOrderMap,
  ForwardListHeader,
  ForwardTunnelGroup,
  ForwardUserGroup,
  getForwardDisplayFlow,
  isSameGroupCollapsedMap,
  isSameGroupOrderMap,
  mapForwardApiItems,
  Node,
  normalizeForwardItems,
  normalizeForwardTunnelName,
  normalizeForwardUserName,
  normalizeTunnelTrafficRatio,
  parseGroupCollapsedMap,
  parseGroupOrderMap,
  parsePreferenceMap,
  parseTunnelGroupSortableId,
  sanitizeGroupCollapsedMap,
  sanitizeGroupOrderMap,
  SortableForwardCard,
  SortableForwardRow,
  SortableTunnelGroupContainer,
  Tunnel,
  UNCATEGORIZED_FORWARD_TUNNEL_NAME,
  UNKNOWN_FORWARD_USER_NAME,
  type ForwardItemHandlers,
} from "@/pages/forward/presentation";
import { formatTraffic } from "@/utils/traffic";
// import { useMobileBreakpoint } from "@/hooks/useMobileBreakpoint";
import { DiagnosisModal } from "@/components/diagnosis-modal";
import { BatchChangeTunnelModal } from "@/pages/forward/batch-change-tunnel-modal";
import { mergeFederationShareFlow } from "@/pages/forward/federation-flow";
import { ForwardExportModal } from "@/pages/forward/forward-export-modal";
import { ForwardFilterModal } from "@/pages/forward/forward-filter-modal";
import { ForwardFormModal } from "@/pages/forward/forward-form-modal";
import { ForwardImportModal } from "@/pages/forward/forward-import-modal";
import { useForwardDiagnosis } from "@/pages/forward/use-forward-diagnosis";
import { useForwardExport } from "@/pages/forward/use-forward-export";
import { useForwardImport } from "@/pages/forward/use-forward-import";
import { JwtUtil } from "@/utils/jwt";
import { saveOrder } from "@/utils/order-storage";

export default function ForwardPage() {
  const tokenUserId = JwtUtil.getUserIdFromToken();
  const tokenRoleId = JwtUtil.getRoleIdFromToken();
  const isAdmin = tokenRoleId === 0;

  const [compactMode, setCompactMode] = useState(false);

  // 在非精简模式下（compactMode=false），管理员默认展示全部用户规则（与 2.1.8-beta9 行为一致）。
  // 精简模式下默认仅展示管理员本人规则，避免在表格里混看不清所属用户。
  const defaultSearchUserId = useMemo(() => {
    if (isAdmin) {
      if (!compactMode) {
        return "all";
      }

      return tokenUserId ? tokenUserId.toString() : "all";
    }

    return tokenUserId ? tokenUserId.toString() : "all";
  }, [compactMode, isAdmin, tokenUserId]);

  const [searchParams, setSearchParams] = useState({
    name: "",
    userId: defaultSearchUserId,
    tunnelId: "all",
    inPort: "",
    remoteAddr: "",
  });
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const resetSearchParams = useCallback(() => {
    setSearchParams({
      name: "",
      userId: defaultSearchUserId,
      tunnelId: "all",
      inPort: "",
      remoteAddr: "",
    });
  }, [defaultSearchUserId]);

  const lastDefaultSearchUserIdRef = useRef(defaultSearchUserId);

  useEffect(() => {
    const previousDefault = lastDefaultSearchUserIdRef.current;

    lastDefaultSearchUserIdRef.current = defaultSearchUserId;

    if (!isAdmin || previousDefault === defaultSearchUserId) {
      return;
    }

    setSearchParams((prev) => {
      const hasOtherFilters =
        Boolean(prev.name.trim()) ||
        prev.tunnelId !== "all" ||
        Boolean(prev.inPort.trim()) ||
        Boolean(prev.remoteAddr.trim());

      if (hasOtherFilters) {
        return prev;
      }

      if (prev.userId !== previousDefault) {
        return prev;
      }

      return {
        ...prev,
        userId: defaultSearchUserId,
      };
    });
  }, [defaultSearchUserId, isAdmin]);

  const activeFilterCount =
    (searchParams.name.trim() ? 1 : 0) +
    (searchParams.userId !== defaultSearchUserId ? 1 : 0) +
    (searchParams.tunnelId !== "all" ? 1 : 0) +
    (searchParams.inPort.trim() ? 1 : 0) +
    (searchParams.remoteAddr.trim() ? 1 : 0);
  const [loading, setLoading] = useState(true);
  const [forwards, setForwards] = useState<Forward[]>([]);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [allTunnels, setAllTunnels] = useState<Tunnel[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [speedLimits, setSpeedLimits] = useState<SpeedLimitApiItem[]>([]);
  //   const isMobile = useMobileBreakpoint();
  // searchKeyword removed

  // 显示模式状态 - 从localStorage读取，默认为平铺显示
  const [viewMode, setViewMode] = useState<"grouped" | "direct">(() => {
    try {
      const savedMode = localStorage.getItem("forward-view-mode");

      return (savedMode as "grouped" | "direct") || "direct";
    } catch {
      return "direct";
    }
  });

  // 筛选状态
  // filterUserId removed
  // filterTunnelId removed

  // 拖拽排序相关状态
  const [forwardOrder, setForwardOrder] = useState<number[]>([]);

  // 模态框状态
  const [modalOpen, setModalOpen] = useState(false);
  // isFilterModalOpen removed
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [resetFlowModalOpen, setResetFlowModalOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const {
    diagnosisModalOpen,
    diagnosisLoading,
    currentDiagnosisForward,
    diagnosisResult,
    diagnosisProgress,
    closeDiagnosis,
    handleDiagnose,
  } = useForwardDiagnosis();
  const [isEdit, setIsEdit] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetFlowLoading, setResetFlowLoading] = useState(false);
  const [forwardToDelete, setForwardToDelete] = useState<Forward | null>(null);
  const [forwardToResetFlow, setForwardToResetFlow] = useState<Forward | null>(
    null,
  );
  const [addressModalTitle, setAddressModalTitle] = useState("");
  const [addressList, setAddressList] = useState<ForwardAddressItem[]>([]);

  // 导出相关状态
  // 导入相关状态
  // 表单状态
  const [form, setForm] = useState<ForwardForm>({
    name: "",
    tunnelId: null,
    inPort: null,
    inIp: "",
    remoteAddr: "",
    interfaceName: "",
    strategy: "fifo",
    speedId: null,
    ipMaxConn: 0,
    ipSpeedId: null,
    maxConn: 0,
    proxyProtocol: 0,
    proxyProtocolReceive: 0,
    proxyProtocolSend: 0,
  });
  const [inIpTouched, setInIpTouched] = useState(false);

  // 表单验证错误
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 批量操作相关状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
  const [batchChangeTunnelModalOpen, setBatchChangeTunnelModalOpen] =
    useState(false);
  const [batchTargetTunnelId, setBatchTargetTunnelId] = useState<number | null>(
    null,
  );
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgressState>({
    active: false,
    label: "",
    percent: 0,
  });
  const [batchResultModal, setBatchResultModal] =
    useState<BatchResultModalState>(EMPTY_BATCH_RESULT_MODAL_STATE);
  const [groupOrderMap, setGroupOrderMap] = useState<ForwardGroupOrderMap>({});
  const [collapsedTunnelGroups, setCollapsedTunnelGroups] =
    useState<ForwardGroupCollapsedMap>({});
  const [groupPreferenceHydrated, setGroupPreferenceHydrated] = useState(false);

  const parseNodeIPs = (node?: Node): string[] => {
    if (!node) {
      return [];
    }

    const ips: string[] = [];
    const add = (value?: string) => {
      const trimmed = (value || "").trim();

      if (trimmed) {
        ips.push(trimmed);
      }
    };

    add(node.serverIpV4);
    add(node.serverIpV6);
    add(node.serverIp);

    (node.extraIPs || "")
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v)
      .forEach((v) => ips.push(v));

    return Array.from(new Set(ips));
  };

  const tunnelInIpOptionMap = useMemo(() => {
    const map = new Map<number, string[]>();
    const nodeMap = new Map<number, Node>(nodes.map((n) => [n.id, n]));

    for (const tunnel of allTunnels) {
      const collected: string[] = [];
      const entryNodes = tunnel.inNodeId || [];

      for (const entry of entryNodes) {
        collected.push(...parseNodeIPs(nodeMap.get(entry.nodeId)));
      }

      if (collected.length === 0) {
        (tunnel.inIp || "")
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v)
          .forEach((v) => collected.push(v));
      }

      map.set(tunnel.id, Array.from(new Set(collected)));
    }

    return map;
  }, [allTunnels, nodes]);

  const currentTunnelIpOptions = useMemo(() => {
    if (!form.tunnelId) {
      return [];
    }

    return tunnelInIpOptionMap.get(form.tunnelId) || [];
  }, [form.tunnelId, tunnelInIpOptionMap]);

  const isCurrentTunnelMultiEntrance = useMemo(() => {
    if (!form.tunnelId) {
      return false;
    }

    const currentTunnel = allTunnels.find(
      (tunnel) => tunnel.id === form.tunnelId,
    );

    return (currentTunnel?.inNodeId?.length || 0) > 1;
  }, [allTunnels, form.tunnelId]);

  const currentTunnelPortRange = useMemo(() => {
    if (!form.tunnelId) {
      return null;
    }

    const currentTunnel = allTunnels.find(
      (tunnel) => tunnel.id === form.tunnelId,
    );

    if (
      currentTunnel?.portRangeMin &&
      currentTunnel?.portRangeMax &&
      currentTunnel.portRangeMin > 0 &&
      currentTunnel.portRangeMax > 0
    ) {
      return {
        min: currentTunnel.portRangeMin,
        max: currentTunnel.portRangeMax,
      };
    }

    return null;
  }, [allTunnels, form.tunnelId]);
  const persistGroupOrderToLocal = (nextOrderMap: ForwardGroupOrderMap) => {
    if (tokenUserId === null) {
      return;
    }

    try {
      localStorage.setItem(
        buildForwardGroupOrderLocalKey(tokenUserId),
        JSON.stringify(nextOrderMap),
      );
    } catch {}
  };

  const persistGroupCollapsedToLocal = (
    nextCollapsedMap: ForwardGroupCollapsedMap,
  ) => {
    if (tokenUserId === null) {
      return;
    }

    try {
      localStorage.setItem(
        buildForwardGroupCollapsedLocalKey(tokenUserId),
        JSON.stringify(nextCollapsedMap),
      );
    } catch {}
  };

  const persistGroupOrderToGlobal = async (
    nextOrderMap: ForwardGroupOrderMap,
  ): Promise<void> => {
    if (!isAdmin || tokenUserId === null) {
      return;
    }

    try {
      const currentRes = await getConfigByName(FORWARD_GROUP_ORDER_CONFIG_KEY);
      const globalMap =
        parsePreferenceMap<ForwardGroupOrderMap>(
          currentRes.code === 0 && typeof currentRes.data?.value === "string"
            ? currentRes.data.value
            : null,
        ) || {};

      globalMap[tokenUserId.toString()] = nextOrderMap;

      const saveRes = await updateConfig(
        FORWARD_GROUP_ORDER_CONFIG_KEY,
        JSON.stringify(globalMap),
      );

      if (saveRes.code !== 0) {
        toast.error(saveRes.msg || "保存分组排序失败");
      }
    } catch {
      toast.error("保存分组排序失败");
    }
  };

  const persistGroupCollapsedToGlobal = async (
    nextCollapsedMap: ForwardGroupCollapsedMap,
  ): Promise<void> => {
    if (!isAdmin || tokenUserId === null) {
      return;
    }

    try {
      const currentRes = await getConfigByName(
        FORWARD_GROUP_COLLAPSED_CONFIG_KEY,
      );
      const globalMap =
        parsePreferenceMap<ForwardGroupCollapsedMap>(
          currentRes.code === 0 && typeof currentRes.data?.value === "string"
            ? currentRes.data.value
            : null,
        ) || {};

      globalMap[tokenUserId.toString()] = nextCollapsedMap;

      const saveRes = await updateConfig(
        FORWARD_GROUP_COLLAPSED_CONFIG_KEY,
        JSON.stringify(globalMap),
      );

      if (saveRes.code !== 0) {
        toast.error(saveRes.msg || "保存分组折叠状态失败");
      }
    } catch {
      toast.error("保存分组折叠状态失败");
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadGroupPreferences = async () => {
      if (tokenUserId === null) {
        if (!cancelled) {
          setGroupOrderMap({});
          setCollapsedTunnelGroups({});
          setGroupPreferenceHydrated(true);
        }

        return;
      }

      let localOrderMap: ForwardGroupOrderMap = {};
      let localCollapsedMap: ForwardGroupCollapsedMap = {};

      try {
        localOrderMap = parseGroupOrderMap(
          localStorage.getItem(buildForwardGroupOrderLocalKey(tokenUserId)),
        );
      } catch {
        localOrderMap = {};
      }

      try {
        localCollapsedMap = parseGroupCollapsedMap(
          localStorage.getItem(buildForwardGroupCollapsedLocalKey(tokenUserId)),
        );
      } catch {
        localCollapsedMap = {};
      }

      if (isAdmin) {
        try {
          const [globalOrderRes, globalCollapsedRes] = await Promise.all([
            getConfigByName(FORWARD_GROUP_ORDER_CONFIG_KEY),
            getConfigByName(FORWARD_GROUP_COLLAPSED_CONFIG_KEY),
          ]);

          const globalOrderMap = parsePreferenceMap<ForwardGroupOrderMap>(
            globalOrderRes.code === 0 &&
              typeof globalOrderRes.data?.value === "string"
              ? globalOrderRes.data.value
              : null,
          );
          const globalCollapsedMap =
            parsePreferenceMap<ForwardGroupCollapsedMap>(
              globalCollapsedRes.code === 0 &&
                typeof globalCollapsedRes.data?.value === "string"
                ? globalCollapsedRes.data.value
                : null,
            );

          const globalOrderBucket = globalOrderMap?.[tokenUserId.toString()];
          const globalCollapsedBucket =
            globalCollapsedMap?.[tokenUserId.toString()];

          if (
            globalOrderBucket &&
            typeof globalOrderBucket === "object" &&
            !Array.isArray(globalOrderBucket)
          ) {
            localOrderMap = parseGroupOrderMap(
              JSON.stringify(globalOrderBucket),
            );
          }

          if (
            globalCollapsedBucket &&
            typeof globalCollapsedBucket === "object" &&
            !Array.isArray(globalCollapsedBucket)
          ) {
            localCollapsedMap = parseGroupCollapsedMap(
              JSON.stringify(globalCollapsedBucket),
            );
          }
        } catch {}
      }

      if (cancelled) {
        return;
      }

      setGroupOrderMap(localOrderMap);
      setCollapsedTunnelGroups(localCollapsedMap);
      persistGroupOrderToLocal(localOrderMap);
      persistGroupCollapsedToLocal(localCollapsedMap);
      setGroupPreferenceHydrated(true);
    };

    setGroupPreferenceHydrated(false);
    loadGroupPreferences();

    return () => {
      cancelled = true;
    };
  }, [tokenUserId, isAdmin]);

  useEffect(() => {
    const loadForwardCompactMode = async () => {
      try {
        const response = await getConfigByName(FORWARD_COMPACT_MODE_CONFIG_KEY);
        const enabled =
          response.code === 0 &&
          typeof response.data?.value === "string" &&
          response.data.value === "true";

        setCompactMode(enabled);
      } catch {
        setCompactMode(false);
      }
    };

    const handleCompactModeChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled?: boolean }>;

      if (typeof customEvent.detail?.enabled === "boolean") {
        setCompactMode(customEvent.detail.enabled);
      }
    };

    loadForwardCompactMode();
    window.addEventListener(
      FORWARD_COMPACT_MODE_EVENT,
      handleCompactModeChanged,
    );

    return () => {
      window.removeEventListener(
        FORWARD_COMPACT_MODE_EVENT,
        handleCompactModeChanged,
      );
    };
  }, []);

  // 切换显示模式并保存到localStorage
  const handleViewModeChange = () => {
    const newMode = viewMode === "grouped" ? "direct" : "grouped";

    setViewMode(newMode);
    try {
      localStorage.setItem("forward-view-mode", newMode);
    } catch {}
  };

  const applyForwardList = useCallback(async (items: Forward[]) => {
    const mergedForwards = await mergeFederationShareFlow(
      normalizeForwardItems(items),
    );

    setForwards(mergedForwards);

    const currentUserId = JwtUtil.getUserIdFromToken();
    const { order, fromDatabase } = buildForwardOrder(
      mergedForwards,
      currentUserId,
    );

    setForwardOrder(order);

    if (fromDatabase) {
      saveOrder(FORWARD_ORDER_KEY, order);
    }
  }, []);

  const refreshForwardList = useCallback(
    async (lod = true) => {
      if (lod) {
        setLoading(true);
      }

      try {
        const forwardsRes = await getForwardList();

        if (forwardsRes.code === 0) {
          await applyForwardList(mapForwardApiItems(forwardsRes.data || []));
        } else {
          toast.error(forwardsRes.msg || "获取规则列表失败");
        }
      } catch {
        toast.error("获取规则列表失败");
      } finally {
        if (lod) {
          setLoading(false);
        }
      }
    },
    [applyForwardList],
  );
  const {
    importModalOpen,
    setImportModalOpen,
    importData,
    setImportData,
    importLoading,
    importFormat,
    setImportFormat,
    selectedTunnelForImport,
    setSelectedTunnelForImport,
    importResults,
    setImportResults,
    handleImport,
    executeImport,
  } = useForwardImport({
    refreshForwardList,
  });

  // 加载所有数据
  const loadData = useCallback(
    async (lod = true) => {
      setLoading(lod);
      try {
        const [tunnelsRes, speedLimitsRes] = await Promise.all([
          userTunnel(),
          getSpeedLimitList(),
        ]);
        const [allTunnelsRes, nodesRes] = await Promise.allSettled([
          getTunnelList(),
          getNodeList(),
        ]);

        await refreshForwardList(false);

        if (tunnelsRes.code === 0) {
          setTunnels(tunnelsRes.data || []);
        } else {
        }

        if (
          allTunnelsRes.status === "fulfilled" &&
          allTunnelsRes.value.code === 0
        ) {
          setAllTunnels((allTunnelsRes.value.data || []) as Tunnel[]);
        }

        if (nodesRes.status === "fulfilled" && nodesRes.value.code === 0) {
          setNodes((nodesRes.value.data || []) as Node[]);
        }

        if (speedLimitsRes.code === 0) {
          setSpeedLimits(speedLimitsRes.data || []);
        }
      } catch {
        toast.error("加载数据失败");
      } finally {
        setLoading(false);
      }
    },
    [refreshForwardList],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 表单验证
  const noLimitSpeedLimitIds = useMemo(() => {
    return new Set(
      speedLimits
        .filter((speedLimit) => speedLimit.name.trim() === "不限速")
        .map((speedLimit) => speedLimit.id),
    );
  }, [speedLimits]);

  const speedLimitIds = useMemo(() => {
    return new Set(speedLimits.map((speedLimit) => speedLimit.id));
  }, [speedLimits]);

  const availableSpeedLimits = useMemo(() => {
    return speedLimits.filter(
      (speedLimit) => !noLimitSpeedLimitIds.has(speedLimit.id),
    );
  }, [speedLimits, noLimitSpeedLimitIds]);

  const normalizeSpeedId = (speedId?: number | null): number | null => {
    if (speedId === null || speedId === undefined) {
      return null;
    }

    if (noLimitSpeedLimitIds.has(speedId)) {
      return null;
    }

    if (speedLimits.length > 0 && !speedLimitIds.has(speedId)) {
      return null;
    }

    return speedId;
  };

  const isMissingSpeedLimit = (speedId?: number | null): boolean => {
    if (speedId === null || speedId === undefined) {
      return false;
    }

    if (speedLimits.length === 0 || noLimitSpeedLimitIds.has(speedId)) {
      return false;
    }

    return !speedLimitIds.has(speedId);
  };

  const selectedSpeedId = normalizeSpeedId(form.speedId);
  const selectedIPSpeedId = normalizeSpeedId(form.ipSpeedId);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!form.name.trim()) {
      newErrors.name = "请输入规则名称";
    } else if (form.name.length < 2 || form.name.length > 50) {
      newErrors.name = "规则名称长度应在2-50个字符之间";
    }

    if (!form.tunnelId) {
      newErrors.tunnelId = "请选择关联隧道";
    }

    if (
      form.inPort !== null &&
      form.inPort !== undefined &&
      form.inPort > 0 &&
      currentTunnelPortRange
    ) {
      if (
        form.inPort < currentTunnelPortRange.min ||
        form.inPort > currentTunnelPortRange.max
      ) {
        newErrors.inPort = `端口 ${currentTunnelPortRange.min}-${currentTunnelPortRange.max} 超出允许范围`;
      }
    }

    if (!form.remoteAddr.trim()) {
      newErrors.remoteAddr = "请输入落地地址";
    } else {
      // 验证地址格式
      const addresses = form.remoteAddr
        .split("\n")
        .map((addr) => addr.trim())
        .filter((addr) => addr);
      const ipv4Pattern =
        /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d+$/;
      const ipv6FullPattern =
        /^\[((([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4}|:))|(([0-9a-fA-F]{1,4}:){6}(:[0-9a-fA-F]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-fA-F]{1,4}:){5}(((:[0-9a-fA-F]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-fA-F]{1,4}:){4}(((:[0-9a-fA-F]{1,4}){1,3})|((:[0-9a-fA-F]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-fA-F]{1,4}:){3}(((:[0-9a-fA-F]{1,4}){1,4})|((:[0-9a-fA-F]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-fA-F]{1,4}:){2}(((:[0-9a-fA-F]{1,4}){1,5})|((:[0-9a-fA-F]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-fA-F]{1,4}:){1}(((:[0-9a-fA-F]{1,4}){1,6})|((:[0-9a-fA-F]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-fA-F]{1,4}){1,7})|((:[0-9a-fA-F]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))\]:\d+$/;
      const domainPattern =
        /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*:\d+$/;

      for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i];

        if (
          !ipv4Pattern.test(addr) &&
          !ipv6FullPattern.test(addr) &&
          !domainPattern.test(addr)
        ) {
          newErrors.remoteAddr = `第${i + 1}行地址格式错误`;
          break;
        }
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // 新增规则
  const handleAdd = () => {
    setIsEdit(false);
    setInIpTouched(false);
    setForm({
      name: "",
      tunnelId: null,
      inPort: null,
      inIp: "",
      remoteAddr: "",
      interfaceName: "",
      strategy: "fifo",
      speedId: null,
      ipMaxConn: 0,
      ipSpeedId: null,
      proxyProtocol: 0,
      proxyProtocolReceive: 0,
      proxyProtocolSend: 0,
    });
    setErrors({});
    setModalOpen(true);
  };

  // 编辑规则
  const handleEdit = (forward: Forward) => {
    setIsEdit(true);
    setInIpTouched(false);
    setForm({
      id: forward.id,
      userId: forward.userId,
      name: forward.name,
      tunnelId: forward.tunnelId,
      inPort: forward.inPort,
      inIp: forward.inIp || "",
      remoteAddr: forward.remoteAddr.split(",").join("\n"),
      interfaceName: forward.interfaceName || "",
      strategy: forward.strategy || "fifo",
      speedId: normalizeSpeedId(forward.speedId),
      ipMaxConn: forward.ipMaxConn ?? 0,
      ipSpeedId: normalizeSpeedId(forward.ipSpeedId),
      maxConn: forward.maxConn ?? 0,
      proxyProtocol: forward.proxyProtocol ?? 0,
      proxyProtocolReceive: forward.proxyProtocolReceive ?? 0,
      proxyProtocolSend:
        forward.proxyProtocolSend ?? forward.proxyProtocol ?? 0,
    });
    setErrors({});
    setModalOpen(true);
  };

  // 显示删除确认
  const handleDelete = (forward: Forward) => {
    setForwardToDelete(forward);
    setDeleteModalOpen(true);
  };

  const handleResetFlow = (forward: Forward) => {
    if ((forward.inFlow || 0) + (forward.outFlow || 0) <= 0) return;

    setForwardToResetFlow(forward);
    setResetFlowModalOpen(true);
  };

  const handleResetFlowModalOpenChange = (isOpen: boolean) => {
    if (resetFlowLoading) return;

    setResetFlowModalOpen(isOpen);
    if (!isOpen) {
      setForwardToResetFlow(null);
    }
  };

  const confirmResetFlow = async () => {
    if (!forwardToResetFlow) return;

    setResetFlowLoading(true);
    try {
      const res = await resetForwardFlow(forwardToResetFlow.id);

      if (res.code !== 0) {
        toast.error(res.msg || "流量清零失败");

        return;
      }

      toast.success("规则流量已清零");
      setResetFlowModalOpen(false);
      setForwardToResetFlow(null);
      await refreshForwardList(false);
    } catch {
      toast.error("流量清零失败");
    } finally {
      setResetFlowLoading(false);
    }
  };

  // 确认删除规则
  const confirmDelete = async () => {
    if (!forwardToDelete) return;

    setDeleteLoading(true);
    try {
      const res = await deleteForward(forwardToDelete.id);

      if (res.code === 0) {
        toast.success("删除成功");
        setDeleteModalOpen(false);
        setForwardToDelete(null);
        setForwards((prev) =>
          prev.filter((forward) => forward.id !== forwardToDelete.id),
        );
        setForwardOrder((prev) => {
          const next = prev.filter((id) => id !== forwardToDelete.id);

          saveOrder(FORWARD_ORDER_KEY, next);

          return next;
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);

          next.delete(forwardToDelete.id);

          return next;
        });
      } else {
        // 删除失败，询问是否强制删除
        const confirmed = await confirmAction({
          title: "常规删除失败，是否强制删除？",
          message: (
            <>
              <p>{res.msg || "删除失败"}</p>
              <p className="mt-2 text-default-500">
                强制删除不会验证节点端是否已删除对应的规则服务。
              </p>
            </>
          ),
          confirmLabel: "强制删除",
        });

        if (confirmed) {
          const forceRes = await forceDeleteForward(forwardToDelete.id);

          if (forceRes.code === 0) {
            toast.success("强制删除成功");
            setDeleteModalOpen(false);
            setForwardToDelete(null);
            setForwards((prev) =>
              prev.filter((forward) => forward.id !== forwardToDelete.id),
            );
            setForwardOrder((prev) => {
              const next = prev.filter((id) => id !== forwardToDelete.id);

              saveOrder(FORWARD_ORDER_KEY, next);

              return next;
            });
            setSelectedIds((prev) => {
              const next = new Set(prev);

              next.delete(forwardToDelete.id);

              return next;
            });
          } else {
            toast.error(forceRes.msg || "强制删除失败");
          }
        }
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleteLoading(false);
    }
  };

  // 处理隧道选择变化
  const handleTunnelChange = (tunnelId: string) => {
    const nextTunnelId = parseInt(tunnelId);
    const options = tunnelInIpOptionMap.get(nextTunnelId) || [];

    setInIpTouched(false);

    setForm((prev) => {
      const tunnelChanged = prev.tunnelId !== nextTunnelId;

      return {
        ...prev,
        tunnelId: nextTunnelId,
        inIp: tunnelChanged ? "" : options.includes(prev.inIp) ? prev.inIp : "",
      };
    });
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitLoading(true);
    try {
      const processedRemoteAddr = form.remoteAddr
        .split("\n")
        .map((addr) => addr.trim())
        .filter((addr) => addr)
        .join(",");

      const addressCount = processedRemoteAddr.split(",").length;

      let res: { code: number; msg: string };
      const normalizedSpeedId = normalizeSpeedId(form.speedId);
      const speedLimitAutoCleared = isMissingSpeedLimit(form.speedId);
      const normalizedIPSpeedId = normalizeSpeedId(form.ipSpeedId);
      const ipSpeedLimitAutoCleared = isMissingSpeedLimit(form.ipSpeedId);

      if (isEdit) {
        const updateData = {
          id: form.id,
          name: form.name,
          tunnelId: form.tunnelId,
          inPort: form.inPort,
          ...(inIpTouched ? { inIp: form.inIp || "" } : {}),
          remoteAddr: processedRemoteAddr,
          strategy: addressCount > 1 ? form.strategy : "fifo",
          speedId: normalizedSpeedId,
          ipMaxConn: form.ipMaxConn,
          ...(isAdmin ? { ipSpeedId: normalizedIPSpeedId } : {}),
          maxConn: form.maxConn,
          proxyProtocol: form.proxyProtocolSend,
          proxyProtocolReceive: form.proxyProtocolReceive,
          proxyProtocolSend: form.proxyProtocolSend,
        };

        res = await updateForward(updateData);
      } else {
        const createData = {
          name: form.name,
          tunnelId: form.tunnelId,
          inPort: form.inPort,
          inIp: form.inIp || undefined,
          remoteAddr: processedRemoteAddr,
          strategy: addressCount > 1 ? form.strategy : "fifo",
          speedId: normalizedSpeedId,
          ipMaxConn: form.ipMaxConn,
          ...(isAdmin ? { ipSpeedId: normalizedIPSpeedId } : {}),
          maxConn: form.maxConn,
          proxyProtocol: form.proxyProtocolSend,
          proxyProtocolReceive: form.proxyProtocolReceive,
          proxyProtocolSend: form.proxyProtocolSend,
        };

        res = await createForward(createData);
      }
      if (res.code === 0) {
        const warningItems = Array.isArray((res as any).data?.warnings)
          ? (res as any).data.warnings
              .map((item: unknown) =>
                typeof item === "string" ? item.trim() : "",
              )
              .filter((item: string) => item)
          : [];

        warningItems.forEach((warning: string) => {
          toast.warning(warning, { duration: 5000 });
        });
        if (speedLimitAutoCleared) {
          toast.warning("所选限速规则不存在，已自动清除为不限速", {
            duration: 5000,
          });
        }
        if (isAdmin && ipSpeedLimitAutoCleared) {
          toast.warning("所选每 IP 限速规则不存在，已自动清除为不限速", {
            duration: 5000,
          });
        }
        toast.success(isEdit ? "修改成功" : "创建成功");
        setModalOpen(false);
        await refreshForwardList(false);
      } else {
        toast.error(res.msg || "操作失败");
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitLoading(false);
    }
  };

  // 处理服务开关
  const handleServiceToggle = async (forward: Forward) => {
    if (forward.status !== 1 && forward.status !== 0) {
      toast.error("规则状态异常，无法操作");

      return;
    }

    const targetState = !forward.serviceRunning;

    try {
      // 乐观更新UI
      setForwards((prev) =>
        prev.map((f) =>
          f.id === forward.id ? { ...f, serviceRunning: targetState } : f,
        ),
      );

      let res: { code: number; msg: string };

      if (targetState) {
        res = await resumeForwardService(forward.id);
      } else {
        res = await pauseForwardService(forward.id);
      }

      if (res.code === 0) {
        toast.success(targetState ? "服务已启动" : "服务已暂停");
        // 更新规则状态
        setForwards((prev) =>
          prev.map((f) =>
            f.id === forward.id ? { ...f, status: targetState ? 1 : 0 } : f,
          ),
        );
      } else {
        // 操作失败，恢复UI状态
        setForwards((prev) =>
          prev.map((f) =>
            f.id === forward.id ? { ...f, serviceRunning: !targetState } : f,
          ),
        );
        toast.error(res.msg || "操作失败");
      }
    } catch {
      // 操作失败，恢复UI状态
      setForwards((prev) =>
        prev.map((f) =>
          f.id === forward.id ? { ...f, serviceRunning: !targetState } : f,
        ),
      );
      toast.error("网络错误，操作失败");
    }
  };

  // 诊断规则
  // 格式化流量
  const formatFlow = (value: number): string => {
    return formatTraffic(value);
  };

  // 显示地址列表弹窗
  const showAddressModal = (
    addressString: string,
    port: number | null,
    title: string,
  ) => {
    const action = resolveForwardAddressAction(addressString, port, title);

    if (action.type === "none") {
      return;
    }

    if (action.type === "copy") {
      copyToClipboard(action.text, action.label);

      return;
    }

    setAddressList(action.items);
    setAddressModalTitle(action.title);
    setAddressModalOpen(true);
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string, label: string = "内容") => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.success(`已复制${label}`);
      } else {
        const textArea = document.createElement("textarea");

        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          toast.success(`已复制${label}`);
        } catch {
          toast.error("复制失败");
        }
        document.body.removeChild(textArea);
      }
    } catch {
      toast.error("复制失败");
    }
  };

  // 复制地址
  const copyAddress = async (addressItem: ForwardAddressItem) => {
    try {
      setAddressList((prev) =>
        prev.map((item) =>
          item.id === addressItem.id ? { ...item, copying: true } : item,
        ),
      );
      await copyToClipboard(addressItem.address, "地址");
    } catch {
      toast.error("复制失败");
    } finally {
      setAddressList((prev) =>
        prev.map((item) =>
          item.id === addressItem.id ? { ...item, copying: false } : item,
        ),
      );
    }
  };

  // 复制所有地址
  const copyAllAddresses = async () => {
    if (addressList.length === 0) return;
    const allAddresses = addressList.map((item) => item.address).join("\n");

    await copyToClipboard(allAddresses, "所有地址");
  };

  // 导出规则数据
  // 执行导出
  // 复制导出数据
  // 导入规则数据
  // 执行导入
  // 获取策略显示
  const getStrategyDisplay = (strategy: string) => {
    switch (strategy) {
      case "fifo":
        return { color: "primary", text: "主备" };
      case "round":
        return { color: "success", text: "轮询" };
      case "rand":
        return { color: "warning", text: "随机" };
      default:
        return { color: "default", text: "未知" };
    }
  };

  // 获取地址数量
  const getAddressCount = (addressString: string): number => {
    if (!addressString) return 0;
    const addresses = addressString
      .split("\n")
      .map((addr) => addr.trim())
      .filter((addr) => addr);

    return addresses.length;
  };

  // 处理拖拽结束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!active || !over || active.id === over.id) return;

    const activeGroup = parseTunnelGroupSortableId(active.id);
    const overGroup = parseTunnelGroupSortableId(over.id);

    if (activeGroup && overGroup) {
      if (compactMode || !groupPreferenceHydrated) {
        return;
      }

      if (activeGroup.userId !== overGroup.userId) {
        return;
      }

      const userIdKey = activeGroup.userId.toString();
      const currentOrder = groupOrderMap[userIdKey] || [];
      const oldIndex = currentOrder.indexOf(activeGroup.tunnelKey);
      const newIndex = currentOrder.indexOf(overGroup.tunnelKey);

      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        return;
      }

      const moved = arrayMove(currentOrder, oldIndex, newIndex);
      const nextOrderMap: ForwardGroupOrderMap = {
        ...groupOrderMap,
        [userIdKey]: moved,
      };

      setGroupOrderMap(nextOrderMap);
      persistGroupOrderToLocal(nextOrderMap);
      void persistGroupOrderToGlobal(nextOrderMap);

      return;
    }

    // 确保 forwardOrder 存在且有效
    if (!forwardOrder || forwardOrder.length === 0) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);

    // 检查 ID 是否有效
    if (isNaN(activeId) || isNaN(overId)) return;

    const activeForward = forwards.find((forward) => forward.id === activeId);
    const overForward = forwards.find((forward) => forward.id === overId);
    const activeUserId = activeForward?.userId ?? 0;
    const overUserId = overForward?.userId ?? 0;
    const activeTunnelGroupKey = buildForwardTunnelGroupKey(
      activeForward?.tunnelName,
    );
    const overTunnelGroupKey = buildForwardTunnelGroupKey(
      overForward?.tunnelName,
    );

    // 非精简模式仅允许在同一用户+隧道分组内拖拽，避免混排
    if (!compactMode) {
      if (
        activeUserId !== overUserId ||
        activeTunnelGroupKey !== overTunnelGroupKey
      ) {
        return;
      }
    }

    let oldIndex: number;
    let newIndex: number;
    let currentOrder: number[];

    if (compactMode) {
      currentOrder = sortedForwards.map((f) => f.id);
      oldIndex = currentOrder.indexOf(activeId);
      newIndex = currentOrder.indexOf(overId);
    } else {
      currentOrder = forwardOrder;
      oldIndex = forwardOrder.indexOf(activeId);
      newIndex = forwardOrder.indexOf(overId);
    }

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);

      if (!compactMode) {
        setForwardOrder(newOrder);
        saveOrder(FORWARD_ORDER_KEY, newOrder);
      }

      // 持久化到数据库
      try {
        const forwardsToUpdate = newOrder.map((id, index) => ({
          id,
          inx: index,
        }));

        const response = await updateForwardOrder({
          forwards: forwardsToUpdate,
        });

        if (response.code === 0) {
          // 更新本地数据中的 inx 字段
          setForwards((prev) =>
            prev.map((forward) => {
              const updatedForward = forwardsToUpdate.find(
                (f) => f.id === forward.id,
              );

              if (updatedForward) {
                return { ...forward, inx: updatedForward.inx };
              }

              return forward;
            }),
          );
        } else {
          toast.error("保存排序失败：" + (response.msg || "未知错误"));
        }
      } catch {
        toast.error("保存排序失败，请重试");
      }
    }
  };
  const toggleSelect = (id: number, explicitSelected?: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldSelect =
        typeof explicitSelected === "boolean"
          ? explicitSelected
          : !next.has(id);

      if (shouldSelect) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  };
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const presentBatchOutcome = useCallback(
    (outcome: {
      failureDetails?: BatchOperationFailure[];
      resultSummary?: string;
      resultTitle?: string;
      toastMessage: string;
      toastVariant: "success" | "error";
    }) => {
      const failureDetails = outcome.failureDetails || [];

      if (failureDetails.length > 0) {
        setBatchResultModal({
          failures: failureDetails,
          open: true,
          summary: outcome.resultSummary || outcome.toastMessage,
          title: outcome.resultTitle || "批量操作结果",
        });

        return;
      }

      if (outcome.toastVariant === "success") {
        toast.success(outcome.toastMessage);
      } else {
        toast.error(outcome.toastMessage);
      }
    },
    [],
  );

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    setBatchProgress({
      active: true,
      label: `正在删除 ${selectedIds.size} 项规则...`,
      percent: 30,
    });
    try {
      const outcome = await executeForwardBatchDelete(Array.from(selectedIds));

      presentBatchOutcome(outcome);

      if (outcome.shouldRefresh) {
        setBatchProgress({
          active: true,
          label: outcome.progressLabel || "正在刷新规则列表...",
          percent: outcome.progressPercent ?? 75,
        });
        setSelectedIds(new Set());
        if (outcome.closeDeleteModal) {
          setBatchDeleteModalOpen(false);
        }
        await refreshForwardList(false);
      }
    } finally {
      setBatchProgress({ active: false, label: "", percent: 0 });
      setBatchLoading(false);
    }
  };

  const handleBatchToggleService = async (enable: boolean) => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    setBatchProgress({
      active: true,
      label: `正在${enable ? "启用" : "停用"} ${selectedIds.size} 项规则...`,
      percent: 30,
    });
    try {
      const outcome = await executeForwardBatchToggleService(
        Array.from(selectedIds),
        enable,
      );

      if (outcome.toastVariant === "success") {
        toast.success(outcome.toastMessage);
      } else {
        toast.error(outcome.toastMessage);
      }

      if (outcome.shouldRefresh) {
        setBatchProgress({
          active: true,
          label: outcome.progressLabel || "正在刷新规则列表...",
          percent: outcome.progressPercent ?? 75,
        });
        setSelectedIds(new Set());
        await refreshForwardList(false);
      }
    } finally {
      setBatchProgress({ active: false, label: "", percent: 0 });
      setBatchLoading(false);
    }
  };

  const handleBatchRedeploy = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    setBatchProgress({
      active: true,
      label: `正在重新下发 ${selectedIds.size} 项规则...`,
      percent: 30,
    });
    try {
      const outcome = await executeForwardBatchRedeploy(
        Array.from(selectedIds),
      );

      if (outcome.toastVariant === "success") {
        toast.success(outcome.toastMessage);
      } else {
        toast.error(outcome.toastMessage);
      }

      if (outcome.shouldRefresh) {
        setBatchProgress({
          active: true,
          label: outcome.progressLabel || "正在刷新规则列表...",
          percent: outcome.progressPercent ?? 75,
        });
        setSelectedIds(new Set());
        await refreshForwardList(false);
      }
    } finally {
      setBatchProgress({ active: false, label: "", percent: 0 });
      setBatchLoading(false);
    }
  };

  const handleBatchChangeTunnel = async () => {
    if (selectedIds.size === 0 || !batchTargetTunnelId) return;
    setBatchLoading(true);
    setBatchProgress({
      active: true,
      label: `正在为 ${selectedIds.size} 项规则切换隧道...`,
      percent: 30,
    });
    try {
      const outcome = await executeForwardBatchChangeTunnel(
        Array.from(selectedIds),
        batchTargetTunnelId,
      );

      if (outcome.toastVariant === "success") {
        toast.success(outcome.toastMessage);
      } else {
        toast.error(outcome.toastMessage);
      }

      if (outcome.shouldRefresh) {
        setBatchProgress({
          active: true,
          label: outcome.progressLabel || "正在刷新规则列表...",
          percent: outcome.progressPercent ?? 75,
        });
        setSelectedIds(new Set());
        if (outcome.closeChangeTunnelModal) {
          setBatchChangeTunnelModalOpen(false);
        }
        if (outcome.resetTargetTunnel) {
          setBatchTargetTunnelId(null);
        }
        await refreshForwardList(false);
      }
    } finally {
      setBatchProgress({ active: false, label: "", percent: 0 });
      setBatchLoading(false);
    }
  };

  // 传感器配置 - 使用默认配置避免错误
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

  // 根据排序顺序获取规则列表
  const orderedForwards = useMemo((): Forward[] => {
    // 确保 forwards 数组存在且有效
    if (!forwards || forwards.length === 0) {
      return [];
    }

    let filteredForwards = forwards;

    if (searchParams.userId !== "all") {
      const targetUserId = parseInt(searchParams.userId);

      filteredForwards = filteredForwards.filter(
        (f) => f.userId === targetUserId || (targetUserId === 0 && !f.userId),
      );
    }
    if (searchParams.tunnelId !== "all") {
      const targetTunnelId = parseInt(searchParams.tunnelId);

      filteredForwards = filteredForwards.filter(
        (f) => f.tunnelId === targetTunnelId,
      );
    }
    if (searchParams.name.trim()) {
      const lowerName = searchParams.name.toLowerCase();

      filteredForwards = filteredForwards.filter(
        (f) => f.name && f.name.toLowerCase().includes(lowerName),
      );
    }
    if (searchParams.inPort.trim()) {
      const targetPort = parseInt(searchParams.inPort.trim());

      if (!isNaN(targetPort)) {
        filteredForwards = filteredForwards.filter(
          (f) => f.inPort === targetPort,
        );
      }
    }
    if (searchParams.remoteAddr.trim()) {
      const lowerAddr = searchParams.remoteAddr.toLowerCase();

      filteredForwards = filteredForwards.filter(
        (f) => f.remoteAddr && f.remoteAddr.toLowerCase().includes(lowerAddr),
      );
    }

    // 确保过滤后的规则列表有效
    if (!filteredForwards || filteredForwards.length === 0) {
      return [];
    }

    // 优先使用数据库中的 inx 字段进行排序
    const sortedByDb = [...filteredForwards].sort((a, b) => {
      const aInx = a.inx ?? 0;
      const bInx = b.inx ?? 0;

      if (aInx !== bInx) {
        return aInx - bInx;
      }

      return (a.id ?? 0) - (b.id ?? 0);
    });

    // 如果数据库中没有排序信息，则使用本地存储的顺序
    if (
      forwardOrder &&
      forwardOrder.length > 0 &&
      sortedByDb.every((f) => f.inx === undefined || f.inx === 0)
    ) {
      const forwardMap = new Map(filteredForwards.map((f) => [f.id, f]));
      const localSortedForwards: Forward[] = [];

      forwardOrder.forEach((id) => {
        const forward = forwardMap.get(id);

        if (forward) {
          localSortedForwards.push(forward);
        }
      });

      // 添加不在排序列表中的规则（新添加的）
      filteredForwards.forEach((forward) => {
        if (!forwardOrder.includes(forward.id)) {
          localSortedForwards.push(forward);
        }
      });

      return localSortedForwards;
    }

    return sortedByDb;
  }, [forwards, forwardOrder, searchParams]);

  const availableGroupData = useMemo(
    () => buildAvailableGroupData(forwards),
    [forwards],
  );

  const sanitizedGroupOrderMap = useMemo(
    () =>
      sanitizeGroupOrderMap(
        groupOrderMap,
        availableGroupData.availableTunnelKeysByUser,
      ),
    [groupOrderMap, availableGroupData],
  );

  const sanitizedCollapsedTunnelGroups = useMemo(
    () =>
      sanitizeGroupCollapsedMap(
        collapsedTunnelGroups,
        availableGroupData.availableCollapseKeys,
      ),
    [collapsedTunnelGroups, availableGroupData],
  );

  useEffect(() => {
    if (!groupPreferenceHydrated || tokenUserId === null) {
      return;
    }

    if (forwards.length === 0) {
      return;
    }

    if (!isSameGroupOrderMap(groupOrderMap, sanitizedGroupOrderMap)) {
      setGroupOrderMap(sanitizedGroupOrderMap);
      persistGroupOrderToLocal(sanitizedGroupOrderMap);
      void persistGroupOrderToGlobal(sanitizedGroupOrderMap);
    }

    if (
      !isSameGroupCollapsedMap(
        collapsedTunnelGroups,
        sanitizedCollapsedTunnelGroups,
      )
    ) {
      setCollapsedTunnelGroups(sanitizedCollapsedTunnelGroups);
      persistGroupCollapsedToLocal(sanitizedCollapsedTunnelGroups);
      void persistGroupCollapsedToGlobal(sanitizedCollapsedTunnelGroups);
    }
  }, [
    groupPreferenceHydrated,
    tokenUserId,
    forwards,
    groupOrderMap,
    sanitizedGroupOrderMap,
    collapsedTunnelGroups,
    sanitizedCollapsedTunnelGroups,
  ]);

  const groupedForwards = useMemo((): ForwardUserGroup[] => {
    if (orderedForwards.length === 0) {
      return [];
    }

    type MutableForwardUserGroup = {
      userId: number;
      userName: string;
      tunnelMap: Map<string, ForwardTunnelGroup>;
    };

    const userGroupMap = new Map<number, MutableForwardUserGroup>();

    orderedForwards.forEach((forward) => {
      const userId = forward.userId ?? 0;
      const userName = normalizeForwardUserName(forward.userName);
      const tunnelName = normalizeForwardTunnelName(forward.tunnelName);
      const tunnelKey = buildForwardTunnelGroupKey(forward.tunnelName);

      let existingGroup = userGroupMap.get(userId);

      if (!existingGroup) {
        existingGroup = {
          userId,
          userName,
          tunnelMap: new Map<string, ForwardTunnelGroup>(),
        };
        userGroupMap.set(userId, existingGroup);
      } else if (
        existingGroup.userName === UNKNOWN_FORWARD_USER_NAME &&
        userName !== UNKNOWN_FORWARD_USER_NAME
      ) {
        existingGroup.userName = userName;
      }

      const existingTunnelGroup = existingGroup.tunnelMap.get(tunnelKey);

      if (!existingTunnelGroup) {
        existingGroup.tunnelMap.set(tunnelKey, {
          tunnelKey,
          tunnelName,
          tunnelTrafficRatio: normalizeTunnelTrafficRatio(
            forward.tunnelTrafficRatio,
          ),
          items: [forward],
        });

        return;
      }

      existingTunnelGroup.items.push(forward);

      if (
        existingTunnelGroup.tunnelName === UNCATEGORIZED_FORWARD_TUNNEL_NAME &&
        tunnelName !== UNCATEGORIZED_FORWARD_TUNNEL_NAME
      ) {
        existingTunnelGroup.tunnelName = tunnelName;
      }

      if (
        normalizeTunnelTrafficRatio(existingTunnelGroup.tunnelTrafficRatio) ===
          1 &&
        normalizeTunnelTrafficRatio(forward.tunnelTrafficRatio) !== 1
      ) {
        existingTunnelGroup.tunnelTrafficRatio = normalizeTunnelTrafficRatio(
          forward.tunnelTrafficRatio,
        );
      }
    });

    const groups = Array.from(userGroupMap.values()).map((group) => {
      const tunnels = Array.from(group.tunnelMap.values());
      const tunnelOrder = sanitizedGroupOrderMap[group.userId.toString()] || [];
      const tunnelOrderIndex = new Map<string, number>();

      tunnelOrder.forEach((key, index) => {
        tunnelOrderIndex.set(key, index);
      });

      tunnels.sort((a, b) => {
        const aIndex = tunnelOrderIndex.get(a.tunnelKey);
        const bIndex = tunnelOrderIndex.get(b.tunnelKey);

        if (aIndex !== undefined || bIndex !== undefined) {
          if (aIndex === undefined) {
            return 1;
          }

          if (bIndex === undefined) {
            return -1;
          }

          return aIndex - bIndex;
        }

        const nameCompare = compareForwardTunnelNameAsc(
          a.tunnelName,
          b.tunnelName,
        );

        if (nameCompare !== 0) {
          return nameCompare;
        }

        return compareForwardTunnelNameAsc(a.tunnelKey, b.tunnelKey);
      });

      return {
        userId: group.userId,
        userName: group.userName,
        tunnels,
      };
    });

    groups.sort((a, b) => {
      if (isAdmin && tokenUserId !== null) {
        const aIsSelf = a.userId === tokenUserId;
        const bIsSelf = b.userId === tokenUserId;

        if (aIsSelf !== bIsSelf) {
          return aIsSelf ? -1 : 1;
        }
      }

      const nameCompare = compareForwardUserNameAsc(a.userName, b.userName);

      if (nameCompare !== 0) {
        return nameCompare;
      }

      return a.userId - b.userId;
    });

    return groups;
  }, [orderedForwards, isAdmin, tokenUserId, sanitizedGroupOrderMap]);

  const sortedForwards = useMemo(() => {
    if (compactMode) {
      return orderedForwards;
    }

    return groupedForwards.flatMap((group) =>
      group.tunnels.flatMap((tunnel) => tunnel.items),
    );
  }, [compactMode, orderedForwards, groupedForwards]);
  const {
    exportModalOpen,
    setExportModalOpen,
    exportData,
    setExportData,
    exportLoading,
    selectedTunnelForExport,
    setSelectedTunnelForExport,
    handleExport,
    executeExport,
    copyExportData,
  } = useForwardExport({
    sortedForwards,
    copyToClipboard,
  });

  const sortableForwardIds = useMemo(
    () => sortedForwards.map((f) => f.id).filter((id) => id > 0),
    [sortedForwards],
  );

  const selectAll = () => {
    const allIds = sortedForwards.map((f) => f.id);

    setSelectedIds(new Set(allIds));
  };

  const isAllSelected = useMemo(() => {
    return (
      sortedForwards &&
      sortedForwards.length > 0 &&
      selectedIds.size === sortedForwards.length
    );
  }, [sortedForwards, selectedIds]);

  const isIndeterminate = useMemo(() => {
    return (
      selectedIds.size > 0 &&
      sortedForwards &&
      selectedIds.size < sortedForwards.length
    );
  }, [sortedForwards, selectedIds]);

  const handleSelectAllToggle = (isSelected: boolean) => {
    if (isSelected) {
      const allIds = sortedForwards.map((f) => f.id);

      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleTunnelGroupCollapsed = (userId: number, tunnelKey: string) => {
    const collapseKey = buildTunnelGroupCollapseKey(userId, tunnelKey);
    const nextCollapsedMap: ForwardGroupCollapsedMap = {
      ...sanitizedCollapsedTunnelGroups,
    };

    if (nextCollapsedMap[collapseKey] === true) {
      delete nextCollapsedMap[collapseKey];
    } else {
      nextCollapsedMap[collapseKey] = true;
    }

    setCollapsedTunnelGroups(nextCollapsedMap);
    persistGroupCollapsedToLocal(nextCollapsedMap);
    void persistGroupCollapsedToGlobal(nextCollapsedMap);
  };

  // 生成用作筛选项的用户和隧道列表
  const uniqueUsers = useMemo(() => {
    const userMap = new Map<number, { id: number; name: string }>();

    forwards.forEach((f) => {
      const uId = f.userId ?? 0;
      const userName = normalizeForwardUserName(f.userName);
      const existingUser = userMap.get(uId);

      if (!existingUser) {
        userMap.set(uId, { id: uId, name: userName });

        return;
      }

      if (
        existingUser.name === UNKNOWN_FORWARD_USER_NAME &&
        userName !== UNKNOWN_FORWARD_USER_NAME
      ) {
        existingUser.name = userName;
      }
    });

    const users = Array.from(userMap.values());

    users.sort((a, b) => {
      if (isAdmin && tokenUserId !== null) {
        const aIsSelf = a.id === tokenUserId;
        const bIsSelf = b.id === tokenUserId;

        if (aIsSelf !== bIsSelf) {
          return aIsSelf ? -1 : 1;
        }
      }

      const nameCompare = compareForwardUserNameAsc(a.name, b.name);

      if (nameCompare !== 0) {
        return nameCompare;
      }

      return a.id - b.id;
    });

    return users;
  }, [forwards, isAdmin, tokenUserId]);

  const forwardHandlers: ForwardItemHandlers = {
    formatFlow,
    getStrategyDisplay,
    onSelect: toggleSelect,
    onToggleService: handleServiceToggle,
    onEdit: handleEdit,
    onDiagnose: handleDiagnose,
    onResetFlow: handleResetFlow,
    onDelete: handleDelete,
    onAddresses: showAddressModal,
    onCopyName: (name) => copyToClipboard(name, "规则名"),
  };
  const runningCount = sortedForwards.filter(
    (forward) => forward.serviceRunning,
  ).length;
  const totalFlow = sortedForwards.reduce(
    (sum, forward) => sum + getForwardDisplayFlow(forward),
    0,
  );

  // 渲染规则卡片
  const renderForwardCard = (
    forward: Forward,
    listeners?: React.HTMLAttributes<HTMLButtonElement>,
  ) => (
    <ForwardCard
      key={forward.id}
      dragListeners={listeners}
      forward={forward}
      handlers={forwardHandlers}
      selected={selectedIds.has(forward.id)}
    />
  );

  if (loading || !groupPreferenceHydrated) {
    return <PageLoadingState message="正在加载..." />;
  }

  return (
    <AnimatedPage>
      <PageToolbar
        actions={
          <Menu withinPortal position="bottom-end" shadow="md" width={160}>
            <Menu.Target>
              <MantineButton
                aria-label="导入或导出规则"
                leftSection={<ArrowDownUp size={15} />}
                loading={exportLoading}
                rightSection={<ChevronDown size={14} />}
                variant="default"
              >
                <span className="hidden sm:inline">导入 / 导出</span>
              </MantineButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<Upload size={14} />}
                onClick={handleImport}
              >
                导入规则
              </Menu.Item>
              <Menu.Item
                leftSection={<Download size={14} />}
                onClick={handleExport}
              >
                导出规则
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        }
        filter={{
          count: activeFilterCount,
          onOpen: () => setIsSearchModalOpen(true),
          onClear: resetSearchParams,
        }}
        primary={{
          label: "新增",
          noun: "规则",
          icon: <Plus size={16} />,
          onClick: handleAdd,
        }}
        search={
          <SearchBar
            placeholder="搜索规则名称"
            value={searchParams.name}
            onChange={(name) => setSearchParams((prev) => ({ ...prev, name }))}
          />
        }
        view={{
          value: viewMode === "direct" ? "grid" : "list",
          onChange: (next) => {
            if ((next === "grid") !== (viewMode === "direct")) {
              handleViewModeChange();
            }
          },
        }}
      />

      {forwards.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-default-500">
          <span>
            共{" "}
            <span className="font-semibold text-foreground">
              {sortedForwards.length}
            </span>{" "}
            条规则
            {sortedForwards.length !== forwards.length &&
              `（已筛选，全部 ${forwards.length} 条）`}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            运行中 {runningCount}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-default-400" />
            未运行 {sortedForwards.length - runningCount}
          </span>
          <span>累计流量 {formatFlow(totalFlow)}</span>
        </div>
      )}

      {selectedIds.size > 0 && (
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
              color="teal"
              leftSection={<Play size={14} />}
              loading={batchLoading}
              size="xs"
              variant="light"
              onClick={() => handleBatchToggleService(true)}
            >
              启用
            </Button>
            <Button
              color="orange"
              leftSection={<Pause size={14} />}
              loading={batchLoading}
              size="xs"
              variant="light"
              onClick={() => handleBatchToggleService(false)}
            >
              暂停
            </Button>
            <Button
              color="gray"
              leftSection={<Send size={14} />}
              loading={batchLoading}
              size="xs"
              variant="light"
              onClick={handleBatchRedeploy}
            >
              重新下发
            </Button>
            <Button
              color="gray"
              leftSection={<Shuffle size={14} />}
              size="xs"
              variant="light"
              onClick={() => setBatchChangeTunnelModalOpen(true)}
            >
              更换隧道
            </Button>
            <Button
              color="red"
              leftSection={<Trash2 size={14} />}
              size="xs"
              variant="light"
              onClick={() => setBatchDeleteModalOpen(true)}
            >
              删除
            </Button>
          </div>
        </div>
      )}

      {batchProgress.active && (
        <div className="mb-4">
          <Alert>{batchProgress.label}</Alert>
          <Progress
            aria-label={batchProgress.label}
            className="mt-3"
            value={batchProgress.percent}
          />
        </div>
      )}

      {sortedForwards.length === 0 ? (
        forwards.length > 0 ? (
          <EmptyStateCard
            action={
              <Button variant="default" onClick={resetSearchParams}>
                清空筛选条件
              </Button>
            }
            description="调整或清空筛选条件后再试。"
            icon={<SearchX size={20} />}
            title="没有符合条件的规则"
            tone="default"
          />
        ) : (
          <EmptyStateCard
            action={
              <Button leftSection={<Plus size={16} />} onClick={handleAdd}>
                新增规则
              </Button>
            }
            description="新增一条规则，把入口端口的流量转发到目标地址。"
            icon={<ArrowLeftRight size={20} />}
            title="还没有转发规则"
          />
        )
      ) : compactMode ? (
        <DndContext
          collisionDetection={pointerWithin}
          sensors={sensors}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableForwardIds}
            strategy={
              viewMode === "grouped"
                ? verticalListSortingStrategy
                : rectSortingStrategy
            }
          >
            {viewMode === "grouped" ? (
              <div className="forward-group">
                <div className="forward-list">
                  <ForwardListHeader
                    isAllSelected={isAllSelected}
                    isIndeterminate={isIndeterminate}
                    onToggleAll={handleSelectAllToggle}
                  />
                  {sortedForwards.map((forward) => (
                    <SortableForwardRow
                      key={forward.id}
                      showTunnel
                      forward={forward}
                      handlers={forwardHandlers}
                      selected={selectedIds.has(forward.id)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className={FORWARD_CARD_GRID_CLASS}>
                {sortedForwards.map((forward) =>
                  forward && forward.id ? (
                    <SortableForwardCard
                      key={forward.id}
                      forward={forward}
                      renderCard={renderForwardCard}
                    />
                  ) : null,
                )}
              </div>
            )}
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-6">
          {groupedForwards.map((group) => {
            const isSelfGroup =
              isAdmin && tokenUserId !== null && group.userId === tokenUserId;
            const groupForwardCount = group.tunnels.reduce(
              (total, tunnel) => total + tunnel.items.length,
              0,
            );

            return (
              <section
                key={`forward-group-${group.userId}-${group.userName}`}
                className="space-y-3"
              >
                <div className="flex items-center justify-between gap-3 px-1">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      color="initials"
                      name={group.userName}
                      radius="xl"
                      size={28}
                    />
                    <span className="truncate text-sm font-semibold text-foreground">
                      {group.userName}
                    </span>
                    {isSelfGroup && (
                      <Badge size="sm" variant="light">
                        管理员本人
                      </Badge>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-default-500">
                    {groupForwardCount} 条规则
                  </span>
                </div>

                <DndContext
                  collisionDetection={pointerWithin}
                  sensors={sensors}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={group.tunnels.map((tunnel) =>
                      buildTunnelGroupSortableId(
                        group.userId,
                        tunnel.tunnelKey,
                      ),
                    )}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {group.tunnels.map((tunnel) => {
                        const tunnelSortableForwardIds = tunnel.items
                          .map((item) => item.id)
                          .filter((id) => id > 0);
                        const tunnelSelectedCount =
                          tunnelSortableForwardIds.reduce(
                            (count, id) =>
                              count + (selectedIds.has(id) ? 1 : 0),
                            0,
                          );
                        const handleTunnelSelectAllToggle = (
                          isSelected: boolean,
                        ) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);

                            tunnelSortableForwardIds.forEach((id) => {
                              if (isSelected) next.add(id);
                              else next.delete(id);
                            });

                            return next;
                          });
                        };
                        const collapsed =
                          sanitizedCollapsedTunnelGroups[
                            buildTunnelGroupCollapseKey(
                              group.userId,
                              tunnel.tunnelKey,
                            )
                          ] === true;

                        return (
                          <SortableTunnelGroupContainer
                            key={`forward-tunnel-${group.userId}-${tunnel.tunnelKey}`}
                            collapsed={collapsed}
                            groupUserId={group.userId}
                            tunnel={tunnel}
                            onToggleCollapsed={() =>
                              toggleTunnelGroupCollapsed(
                                group.userId,
                                tunnel.tunnelKey,
                              )
                            }
                          >
                            <DndContext
                              collisionDetection={pointerWithin}
                              sensors={sensors}
                              onDragEnd={handleDragEnd}
                            >
                              <SortableContext
                                items={tunnelSortableForwardIds}
                                strategy={
                                  viewMode === "grouped"
                                    ? verticalListSortingStrategy
                                    : rectSortingStrategy
                                }
                              >
                                {viewMode === "grouped" ? (
                                  <div className="forward-list">
                                    <ForwardListHeader
                                      isAllSelected={
                                        tunnelSortableForwardIds.length > 0 &&
                                        tunnelSelectedCount ===
                                          tunnelSortableForwardIds.length
                                      }
                                      isIndeterminate={
                                        tunnelSelectedCount > 0 &&
                                        tunnelSelectedCount <
                                          tunnelSortableForwardIds.length
                                      }
                                      onToggleAll={handleTunnelSelectAllToggle}
                                    />
                                    {tunnel.items.map((forward) => (
                                      <SortableForwardRow
                                        key={forward.id}
                                        forward={forward}
                                        handlers={forwardHandlers}
                                        selected={selectedIds.has(forward.id)}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div
                                    className={`${FORWARD_CARD_GRID_CLASS} p-3`}
                                  >
                                    {tunnel.items.map((forward) =>
                                      forward && forward.id ? (
                                        <SortableForwardCard
                                          key={forward.id}
                                          forward={forward}
                                          renderCard={renderForwardCard}
                                        />
                                      ) : null,
                                    )}
                                  </div>
                                )}
                              </SortableContext>
                            </DndContext>
                          </SortableTunnelGroupContainer>
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </section>
            );
          })}
        </div>
      )}

      {/* 新增/编辑模态框 */}
      <ForwardFormModal
        availableSpeedLimits={availableSpeedLimits}
        currentTunnelIpOptions={currentTunnelIpOptions}
        currentTunnelPortRange={currentTunnelPortRange}
        errors={errors}
        form={form}
        getAddressCount={getAddressCount}
        handleSubmit={handleSubmit}
        handleTunnelChange={handleTunnelChange}
        isAdmin={isAdmin}
        isCurrentTunnelMultiEntrance={isCurrentTunnelMultiEntrance}
        isEdit={isEdit}
        modalOpen={modalOpen}
        selectedIPSpeedId={selectedIPSpeedId}
        selectedSpeedId={selectedSpeedId}
        setForm={setForm}
        setInIpTouched={setInIpTouched}
        setModalOpen={setModalOpen}
        submitLoading={submitLoading}
        tunnels={tunnels}
      />

      {/* 删除确认模态框 */}
      <Modal
        opened={deleteModalOpen}
        size="2xl"
        onClose={() => setDeleteModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-danger">确认删除</h2>
          </ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              确定要删除规则{" "}
              <span className="font-semibold text-foreground">
                &quot;{forwardToDelete?.name}&quot;
              </span>{" "}
              吗？
            </p>
            <p className="text-small text-default-500 mt-2">
              此操作无法撤销，删除后该规则将永久消失。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="gray"
              variant="subtle"
              onClick={() => setDeleteModalOpen(false)}
            >
              取消
            </Button>
            <Button color="red" loading={deleteLoading} onClick={confirmDelete}>
              确认删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 规则流量清零确认模态框 */}
      <Modal
        opened={resetFlowModalOpen}
        size="lg"
        onClose={() => handleResetFlowModalOpenChange(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-secondary">确认流量清零</h2>
          </ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              确定要清零规则{" "}
              <span className="font-semibold text-foreground">
                &quot;{forwardToResetFlow?.name}&quot;
              </span>{" "}
              当前显示的上传和下载流量吗？
            </p>
            <p className="text-small text-default-500 mt-2">
              此操作不可撤销，但不会影响用户总流量、用户隧道配额和历史统计。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="gray"
              disabled={resetFlowLoading}
              variant="subtle"
              onClick={() => handleResetFlowModalOpenChange(false)}
            >
              取消
            </Button>
            <Button
              color="violet"
              loading={resetFlowLoading}
              onClick={confirmResetFlow}
            >
              确认清零
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 地址列表弹窗 */}
      <Modal
        opened={addressModalOpen}
        size="lg"
        onClose={() => setAddressModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="text-base">{addressModalTitle}</ModalHeader>
          <ModalBody className="pb-6">
            <div className="mb-4 text-right">
              <Button size="xs" variant="default" onClick={copyAllAddresses}>
                复制
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {addressList.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 border border-divider rounded-lg"
                >
                  <code className="font-mono text-sm flex-1 min-w-0 break-all mr-3 text-foreground">
                    {item.address}
                  </code>
                  <Button
                    color="gray"
                    loading={item.copying}
                    size="xs"
                    variant="subtle"
                    onClick={() => copyAddress(item)}
                  >
                    复制
                  </Button>
                </div>
              ))}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 导出数据模态框 */}
      <ForwardExportModal
        copyExportData={copyExportData}
        executeExport={executeExport}
        exportData={exportData}
        exportLoading={exportLoading}
        exportModalOpen={exportModalOpen}
        selectedTunnelForExport={selectedTunnelForExport}
        setExportData={setExportData}
        setExportModalOpen={setExportModalOpen}
        setSelectedTunnelForExport={setSelectedTunnelForExport}
        tunnels={tunnels}
      />

      {/* 导入数据模态框 */}
      <ForwardImportModal
        executeImport={executeImport}
        importData={importData}
        importFormat={importFormat}
        importLoading={importLoading}
        importModalOpen={importModalOpen}
        importResults={importResults}
        selectedTunnelForImport={selectedTunnelForImport}
        setImportData={setImportData}
        setImportFormat={setImportFormat}
        setImportModalOpen={setImportModalOpen}
        setImportResults={setImportResults}
        setSelectedTunnelForImport={setSelectedTunnelForImport}
        tunnels={tunnels}
      />

      {/* 诊断结果模态框 */}
      <DiagnosisModal
        loading={diagnosisLoading}
        opened={diagnosisModalOpen}
        progress={diagnosisProgress}
        quality={getForwardDiagnosisQualityDisplay}
        results={diagnosisResult?.results ?? null}
        subject={
          currentDiagnosisForward && {
            name: currentDiagnosisForward.name,
            badge: (
              <Badge size="sm" variant="light">
                规则服务
              </Badge>
            ),
          }
        }
        title="规则诊断结果"
        onClose={closeDiagnosis}
        onRetry={
          currentDiagnosisForward
            ? () => void handleDiagnose(currentDiagnosisForward)
            : undefined
        }
      />

      {/* 批量删除确认模态框 */}
      <Modal
        opened={batchDeleteModalOpen}
        onClose={() => setBatchDeleteModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>确认删除</ModalHeader>
          <ModalBody>
            <p>
              确定要删除选中的 {selectedIds.size} 项规则吗？此操作不可撤销。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="gray"
              variant="subtle"
              onClick={() => setBatchDeleteModalOpen(false)}
            >
              取消
            </Button>
            <Button
              color="red"
              loading={batchLoading}
              onClick={handleBatchDelete}
            >
              确认删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 批量换隧道模态框 */}
      <BatchChangeTunnelModal
        batchChangeTunnelModalOpen={batchChangeTunnelModalOpen}
        batchLoading={batchLoading}
        batchTargetTunnelId={batchTargetTunnelId}
        handleBatchChangeTunnel={handleBatchChangeTunnel}
        selectedIds={selectedIds}
        setBatchChangeTunnelModalOpen={setBatchChangeTunnelModalOpen}
        setBatchTargetTunnelId={setBatchTargetTunnelId}
        tunnels={tunnels}
      />

      {/* 搜索与筛选五合一模态框 */}
      <ForwardFilterModal
        isAdmin={isAdmin}
        isSearchModalOpen={isSearchModalOpen}
        resetSearchParams={resetSearchParams}
        searchParams={searchParams}
        setIsSearchModalOpen={setIsSearchModalOpen}
        setSearchParams={setSearchParams}
        tunnels={tunnels}
        uniqueUsers={uniqueUsers}
      />

      <BatchActionResultModal
        failures={batchResultModal.failures}
        opened={batchResultModal.open}
        summary={batchResultModal.summary}
        title={batchResultModal.title}
        onClose={() => setBatchResultModal(EMPTY_BATCH_RESULT_MODAL_STATE)}
      />
    </AnimatedPage>
  );
}
