import type {
  NodeMetricApiItem,
  ServiceMonitorApiItem,
  ServiceMonitorLimitsApiData,
  ServiceMonitorMutationPayload,
  ServiceMonitorResultApiItem,
} from "@/api/types";

import { ActionIcon, Badge, Tooltip as MantineTooltip } from "@mantine/core";
import { Activity, ArrowLeft, Server } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createServiceMonitor,
  deleteServiceMonitor,
  getNodeMetrics,
  getServiceMonitorLatestResults,
  getServiceMonitorLimits,
  getServiceMonitorList,
  getServiceMonitorResults,
  runServiceMonitor,
  updateServiceMonitor,
} from "@/api";
import { useChartPalette } from "@/components/chart-theme";
import { confirmAction } from "@/components/confirm-host";
import { EmptyStateCard } from "@/components/page-state";
import { IconTile } from "@/components/ui/icon-tile";
import { uiColor } from "@/components/ui/shared";
import toast from "@/lib/notifications";
import {
  MonitorEditModal,
  type MonitorForm,
} from "@/pages/node/monitor-edit-modal";
import {
  RealtimeNodeMetric,
  formatTimestamp,
  isSupportedMonitorType,
} from "@/pages/node/monitor-format";
import { MonitorNodeTable } from "@/pages/node/monitor-node-table";
import { MonitorResultsModal } from "@/pages/node/monitor-results-modal";
import { ServerCard } from "@/pages/node/monitor-server-card";
import {
  METRICS_MAX_ROWS,
  MetricType,
  NodeMetricsChartCard,
} from "@/pages/node/node-metrics-chart-card";
import { RealtimeMetricGrid } from "@/pages/node/realtime-metric-grid";
import { ServiceMonitorPanel } from "@/pages/node/service-monitor-panel";
import { useNodeRealtime } from "@/pages/node/use-node-realtime";

/* ─── Memoized Node Metrics Chart sub-component ─────────────────── */
const DEFAULT_SERVICE_MONITOR_LIMITS: ServiceMonitorLimitsApiData = {
  checkerScanIntervalSec: 1,
  minIntervalSec: 1,
  defaultIntervalSec: 1,
  minTimeoutSec: 1,
  defaultTimeoutSec: 5,
  maxTimeoutSec: 60,
};

interface MonitorViewProps {
  nodeMap: Map<
    number,
    { id: number; name: string; connectionStatus: string; version?: string }
  >;
  viewMode?: "list" | "grid";
}

export function MonitorView({ nodeMap, viewMode = "grid" }: MonitorViewProps) {
  const palette = useChartPalette();
  const [detailNodeId, setDetailNodeId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<NodeMetricApiItem[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsTruncated, setMetricsTruncated] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [activeMetricType, setActiveMetricType] = useState<MetricType>("cpu");

  const [metricsRangeMs, setMetricsRangeMs] = useState(60 * 60 * 1000);

  const [serviceMonitors, setServiceMonitors] = useState<
    ServiceMonitorApiItem[]
  >([]);
  const [monitorsLoading, setMonitorsLoading] = useState(false);
  const [, setMonitorsError] = useState<string | null>(null);
  const [, setLatestResultsError] = useState<string | null>(null);
  const [monitorResults, setMonitorResults] = useState<
    Record<number, ServiceMonitorResultApiItem[]>
  >({});

  const [serviceMonitorLimits, setServiceMonitorLimits] =
    useState<ServiceMonitorLimitsApiData | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] =
    useState<ServiceMonitorApiItem | null>(null);
  const [monitorForm, setMonitorForm] = useState<MonitorForm>({
    name: "",
    type: "tcp",
    target: "",
    intervalSec: DEFAULT_SERVICE_MONITOR_LIMITS.defaultIntervalSec,
    timeoutSec: DEFAULT_SERVICE_MONITOR_LIMITS.defaultTimeoutSec,
    nodeId: 0,
    enabled: true,
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [activeServiceMonitorId, setActiveServiceMonitorId] = useState<
    number | null
  >(null);
  const [serviceMonitorRangeMs, setServiceMonitorRangeMs] = useState(
    60 * 60 * 1000,
  );

  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [resultsMonitorId, setResultsMonitorId] = useState<number | null>(null);
  const [resultsLimit, setResultsLimit] = useState(50);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [realtimeNodeStatus, setRealtimeNodeStatus] = useState<
    Record<number, "online" | "offline">
  >({});
  const [realtimeNodeMetrics, setRealtimeNodeMetrics] = useState<
    Record<number, RealtimeNodeMetric>
  >({});

  const nodes = useMemo(() => {
    return Array.from(nodeMap.values()).map((n) => {
      const status = realtimeNodeStatus[n.id];

      if (!status) {
        return n;
      }

      return {
        ...n,
        connectionStatus: status,
      };
    });
  }, [nodeMap, realtimeNodeStatus]);

  const onlineNodes = nodes.filter((n) => n.connectionStatus === "online");
  const preferredNodeId = onlineNodes[0]?.id ?? nodes[0]?.id ?? 0;

  const resolvedServiceMonitorLimits =
    serviceMonitorLimits ?? DEFAULT_SERVICE_MONITOR_LIMITS;

  const handleRealtimeMessage = useCallback((message: any) => {
    const nodeId = Number(message?.id ?? 0);

    if (!nodeId || Number.isNaN(nodeId)) {
      return;
    }

    const type = String(message?.type ?? "");
    const payload = message?.data;

    if (type === "status") {
      const status = Number(payload);

      setRealtimeNodeStatus((prev) => ({
        ...prev,
        [nodeId]: status === 1 ? "online" : "offline",
      }));

      return;
    }

    if (type === "metric") {
      let raw = payload;

      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          return;
        }
      }
      if (!raw || typeof raw !== "object") {
        return;
      }

      const metric = raw as Record<string, unknown>;
      const receivedAt = Date.now();
      const incomingUptime = Number(metric.uptime ?? 0);

      setRealtimeNodeMetrics((prev) => {
        const normalized: RealtimeNodeMetric = {
          receivedAt,
          cpuUsage: Number(metric.cpuUsage ?? metric.cpu_usage ?? 0),
          memoryUsage: Number(metric.memoryUsage ?? metric.memory_usage ?? 0),
          diskUsage: Number(metric.diskUsage ?? metric.disk_usage ?? 0),
          netInBytes: Number(metric.netInBytes ?? metric.bytes_received ?? 0),
          netOutBytes: Number(
            metric.netOutBytes ?? metric.bytes_transmitted ?? 0,
          ),
          netInSpeed: Number(metric.netInSpeed ?? metric.net_in_speed ?? 0),
          netOutSpeed: Number(metric.netOutSpeed ?? metric.net_out_speed ?? 0),
          load1: Number(metric.load1 ?? 0),
          load5: Number(metric.load5 ?? 0),
          load15: Number(metric.load15 ?? 0),
          tcpConns: Number(metric.tcpConns ?? metric.tcp_conns ?? 0),
          udpConns: Number(metric.udpConns ?? metric.udp_conns ?? 0),
          uptime: incomingUptime || prev[nodeId]?.uptime || 0,
        };

        return {
          ...prev,
          [nodeId]: normalized,
        };
      });
      setRealtimeNodeStatus((prev) => ({
        ...prev,
        [nodeId]: "online",
      }));

      return;
    }

    if (type === "info") {
      setRealtimeNodeStatus((prev) => ({
        ...prev,
        [nodeId]: "online",
      }));
    }
  }, []);

  const { wsConnected, wsConnecting } = useNodeRealtime({
    onMessage: handleRealtimeMessage,
    enabled: !accessDenied,
  });

  useEffect(() => {
    if (!selectedNodeId && preferredNodeId > 0) {
      setSelectedNodeId(preferredNodeId);
    }
  }, [preferredNodeId, selectedNodeId]);

  const loadMetrics = useCallback(
    async (nodeId: number, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (!silent) setMetricsLoading(true);
      try {
        const end = Date.now();
        const start = end - metricsRangeMs;
        const response = await getNodeMetrics(nodeId, start, end);

        if (response.code === 0 && Array.isArray(response.data)) {
          setAccessDenied(null);
          setMetricsError(null);
          setMetricsTruncated(response.data.length >= METRICS_MAX_ROWS);
          const ordered = [...response.data].sort(
            (a, b) => a.timestamp - b.timestamp,
          );

          setMetrics(ordered);

          return;
        }
        if (response.code === 403) {
          setAccessDenied(response.msg || "暂无监控权限，请联系管理员授权");
          setMetricsTruncated(false);
          setMetricsError(null);

          return;
        }
        setMetricsTruncated(false);
        const msg = response.msg || "加载指标失败";
        const isTimeout = msg.toLowerCase().includes("timeout");
        const friendlyMsg = isTimeout
          ? "加载指标超时，请缩小时间范围后重试"
          : msg;

        setMetricsError(friendlyMsg);
        if (!silent) toast.error(friendlyMsg);
      } catch {
        setMetricsTruncated(false);
        if (!silent) setMetricsError("加载指标失败");
      } finally {
        if (!silent) setMetricsLoading(false);
      }
    },
    [metricsRangeMs],
  );

  const loadServiceMonitors = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (!silent) setMonitorsLoading(true);
      try {
        const response = await getServiceMonitorList();

        if (response.code === 0 && response.data) {
          setAccessDenied(null);
          setMonitorsError(null);
          setServiceMonitors(response.data);

          return;
        }
        if (response.code === 403) {
          setAccessDenied(response.msg || "暂无监控权限，请联系管理员授权");
          setMonitorsError(null);

          return;
        }
        setMonitorsError(response.msg || "加载服务监控失败");
        if (!silent) toast.error(response.msg || "加载服务监控失败");
      } catch {
        if (!silent) setMonitorsError("加载服务监控失败");
      } finally {
        if (!silent) setMonitorsLoading(false);
      }
    },
    [],
  );

  const loadServiceMonitorLimits = useCallback(async () => {
    try {
      const response = await getServiceMonitorLimits();

      if (response.code === 0 && response.data) {
        setAccessDenied(null);
        setServiceMonitorLimits(response.data);

        return;
      }
      if (response.code === 403) {
        setAccessDenied(response.msg || "暂无监控权限，请联系管理员授权");

        return;
      }
    } catch {
      toast.error("加载服务监控限制失败，已使用默认值");
    }
  }, []);

  const loadMonitorResults = useCallback(
    async (
      monitorId: number,
      options?: { rangeMs?: number; limit?: number },
    ) => {
      try {
        const apiOptions =
          options?.rangeMs != null
            ? { start: Date.now() - options.rangeMs, end: Date.now() }
            : { limit: options?.limit ?? 100 };
        const response = await getServiceMonitorResults(monitorId, apiOptions);

        if (response.code === 0 && response.data) {
          setMonitorResults((prev) => ({
            ...prev,
            [monitorId]: response.data,
          }));

          return;
        }
        if (response.code === 403) {
          setAccessDenied(response.msg || "暂无监控权限，请联系管理员授权");
        }
      } catch {
        toast.error("加载监控记录失败");
      }
    },
    [],
  );

  const loadLatestMonitorResults = useCallback(async () => {
    try {
      const response = await getServiceMonitorLatestResults();

      if (response.code === 0 && Array.isArray(response.data)) {
        setAccessDenied(null);
        setLatestResultsError(null);
        setMonitorResults((prev) => {
          const next: Record<number, ServiceMonitorResultApiItem[]> = {
            ...prev,
          };

          response.data.forEach((r) => {
            const monitorId = Number(r?.monitorId ?? 0);

            if (monitorId <= 0) return;

            const existing = next[monitorId];

            if (existing && existing.length > 1) {
              const rest = existing.filter((x) => x.id !== r.id);

              next[monitorId] = [r, ...rest];

              return;
            }

            next[monitorId] = [r];
          });

          return next;
        });

        return;
      }
      if (response.code === 403) {
        setAccessDenied(response.msg || "暂无监控权限，请联系管理员授权");
        setLatestResultsError(null);

        return;
      }

      setLatestResultsError(response.msg || "加载最新监控结果失败");
    } catch {
      setLatestResultsError("加载最新监控结果失败");
    }
  }, []);

  const loadResultsForModal = useCallback(async () => {
    if (!resultsMonitorId) return;
    setResultsLoading(true);
    try {
      await loadMonitorResults(resultsMonitorId, { limit: resultsLimit });
    } finally {
      setResultsLoading(false);
    }
  }, [loadMonitorResults, resultsLimit, resultsMonitorId]);

  useEffect(() => {
    void loadServiceMonitors();
    void loadServiceMonitorLimits();
    void loadLatestMonitorResults();
  }, [loadLatestMonitorResults, loadServiceMonitorLimits, loadServiceMonitors]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadServiceMonitors({ silent: true });
      void loadLatestMonitorResults();
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [loadLatestMonitorResults, loadServiceMonitors]);

  useEffect(() => {
    if (selectedNodeId) {
      loadMetrics(selectedNodeId);
    }
  }, [selectedNodeId, loadMetrics]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const timer = window.setInterval(() => {
      void loadMetrics(selectedNodeId, { silent: true });
    }, 15_000);

    return () => window.clearInterval(timer);
  }, [selectedNodeId, loadMetrics]);

  useEffect(() => {
    if (!resultsModalOpen || !resultsMonitorId) return;
    void loadResultsForModal();
  }, [resultsModalOpen, resultsMonitorId, resultsLimit, loadResultsForModal]);

  // Auto-load results for the resolved default monitor when entering detail view
  useEffect(() => {
    if (!detailNodeId) return;
    if (activeServiceMonitorId) return; // user already selected one
    // Find the first monitor belonging to this node (or panel-level)
    const firstMonitor = serviceMonitors.find(
      (m) => m.nodeId === detailNodeId || m.nodeId === 0,
    );

    if (
      firstMonitor &&
      (!monitorResults[firstMonitor.id] ||
        monitorResults[firstMonitor.id].length <= 1)
    ) {
      void loadMonitorResults(firstMonitor.id, {
        rangeMs: serviceMonitorRangeMs,
      });
    }
  }, [detailNodeId, serviceMonitors]);

  // Reload results for the active service monitor chart when time range changes
  useEffect(() => {
    if (!activeServiceMonitorId) return;
    void loadMonitorResults(activeServiceMonitorId, {
      rangeMs: serviceMonitorRangeMs,
    });
  }, [activeServiceMonitorId, serviceMonitorRangeMs, loadMonitorResults]);

  const chartData = useMemo(
    () =>
      metrics.map((m) => ({
        time: formatTimestamp(m.timestamp, metricsRangeMs),
        cpu: m.cpuUsage,
        memory: m.memoryUsage,
        disk: m.diskUsage,
        netIn: m.netInSpeed,
        netOut: m.netOutSpeed,
        load1: m.load1,
        load5: m.load5,
        load15: m.load15,
        tcp: m.tcpConns,
        udp: m.udpConns,
      })),
    [metrics, metricsRangeMs],
  );

  const handleOpenEditModal = (monitor?: ServiceMonitorApiItem) => {
    if (monitor) {
      if (!isSupportedMonitorType(monitor.type)) {
        toast.error("该监控类型已不支持，仅支持删除");

        return;
      }
      setEditingMonitor(monitor);
      setMonitorForm({
        name: monitor.name,
        type: monitor.type as "tcp" | "icmp",
        target: monitor.target,
        intervalSec: monitor.intervalSec,
        timeoutSec: monitor.timeoutSec,
        nodeId: monitor.nodeId,
        enabled: monitor.enabled === 1,
      });
    } else {
      setEditingMonitor(null);
      setMonitorForm({
        name: "",
        type: "tcp",
        target: "",
        intervalSec: resolvedServiceMonitorLimits.defaultIntervalSec,
        timeoutSec: resolvedServiceMonitorLimits.defaultTimeoutSec,
        nodeId: 0,
        enabled: true,
      });
    }
    setEditModalOpen(true);
  };

  const handleSubmitMonitor = async () => {
    if (!monitorForm.name || !monitorForm.target) {
      toast.error("请填写完整信息");

      return;
    }

    if (
      monitorForm.type === "icmp" &&
      (!monitorForm.nodeId || monitorForm.nodeId <= 0)
    ) {
      toast.error("ICMP 监控必须选择执行节点");

      return;
    }

    if (monitorForm.intervalSec < resolvedServiceMonitorLimits.minIntervalSec) {
      toast.error(
        `检查间隔不能小于 ${resolvedServiceMonitorLimits.minIntervalSec}s`,
      );

      return;
    }

    if (
      monitorForm.timeoutSec < resolvedServiceMonitorLimits.minTimeoutSec ||
      monitorForm.timeoutSec > resolvedServiceMonitorLimits.maxTimeoutSec
    ) {
      toast.error(
        `超时时间需在 ${resolvedServiceMonitorLimits.minTimeoutSec}-${resolvedServiceMonitorLimits.maxTimeoutSec}s 范围内`,
      );

      return;
    }

    setSubmitLoading(true);
    try {
      const payload: ServiceMonitorMutationPayload = {
        name: monitorForm.name,
        type: monitorForm.type,
        target: monitorForm.target,
        intervalSec: monitorForm.intervalSec,
        timeoutSec: monitorForm.timeoutSec,
        nodeId: monitorForm.nodeId,
        enabled: monitorForm.enabled ? 1 : 0,
      };

      if (editingMonitor) {
        const response = await updateServiceMonitor({
          ...payload,
          id: editingMonitor.id,
        });

        if (response.code === 0) {
          toast.success("更新成功");
        } else {
          toast.error(response.msg || "更新失败");
        }
      } else {
        const response = await createServiceMonitor(payload);

        if (response.code === 0) {
          toast.success("创建成功");
        } else {
          toast.error(response.msg || "创建失败");
        }
      }

      setEditModalOpen(false);
      void loadServiceMonitors();
      void loadLatestMonitorResults();
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteMonitor = async (id: number) => {
    const confirmed = await confirmAction({
      title: "删除监控项",
      message: "删除后将停止该项检查并清除其历史记录。",
    });

    if (!confirmed) return;
    try {
      const response = await deleteServiceMonitor(id);

      if (response.code === 0) {
        toast.success("删除成功");
        void loadServiceMonitors();
        void loadLatestMonitorResults();
      } else {
        toast.error(response.msg || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleRunMonitor = async (id: number) => {
    try {
      const response = await runServiceMonitor(id);

      if (response.code === 0) {
        const ok = response.data?.success === 1;

        if (ok) {
          toast.success("检查成功");
        } else {
          toast.error(response.data?.errorMessage || "检查失败");
        }

        if (response.data) {
          const latest = response.data;

          setMonitorResults((prev) => {
            const next = { ...prev };
            const existing = next[id];

            if (existing && existing.length > 1) {
              next[id] = [
                latest,
                ...existing.filter((x) => x.id !== latest.id),
              ];
            } else {
              next[id] = [latest];
            }

            return next;
          });
        }

        void loadLatestMonitorResults();
        if (resultsMonitorId === id && resultsModalOpen) {
          void loadResultsForModal();
        }
      } else if (response.code === 403) {
        setAccessDenied(response.msg || "暂无监控权限，请联系管理员授权");
      } else {
        toast.error(response.msg || "执行失败");
      }
    } catch {
      toast.error("执行失败");
    }
  };

  const openResultsModal = (monitorId: number) => {
    setResultsMonitorId(monitorId);
    setResultsModalOpen(true);
  };

  const getLatestResult = (
    monitorId: number,
  ): ServiceMonitorResultApiItem | null => {
    const results = monitorResults[monitorId];

    return results && results.length > 0 ? results[0] : null;
  };

  const resultsMonitor =
    resultsMonitorId != null
      ? serviceMonitors.find((m) => m.id === resultsMonitorId) || null
      : null;
  const modalResults =
    resultsMonitorId != null ? monitorResults[resultsMonitorId] || [] : [];

  const resolveMonitorIntervalSec = useCallback(
    (monitor: ServiceMonitorApiItem) => {
      let interval = Number(monitor.intervalSec ?? 0);

      if (!interval || interval <= 0) {
        interval = resolvedServiceMonitorLimits.defaultIntervalSec;
      }

      return Math.max(interval, resolvedServiceMonitorLimits.minIntervalSec);
    },
    [
      resolvedServiceMonitorLimits.defaultIntervalSec,
      resolvedServiceMonitorLimits.minIntervalSec,
    ],
  );

  // Backend batches DB writes every 30s, but latest API reads from in-memory cache.
  // The cache timestamp reflects the real check time (every ~1s), so stale detection
  // should still allow for the batch report interval + scan jitter.
  const SERVICE_MONITOR_REPORT_INTERVAL_MS = 30_000; // matches backend serviceMonitorReportInterval

  const isResultStale = useCallback(
    (
      monitor: ServiceMonitorApiItem,
      latestResult: ServiceMonitorResultApiItem | null,
    ) => {
      if (monitor.enabled !== 1) {
        return false;
      }
      if (!latestResult || !latestResult.timestamp) {
        return false;
      }

      const intervalMs = resolveMonitorIntervalSec(monitor) * 1000;
      // Budget = batch report interval + one check interval + scan jitter + grace
      const budgetMs =
        SERVICE_MONITOR_REPORT_INTERVAL_MS +
        intervalMs +
        resolvedServiceMonitorLimits.checkerScanIntervalSec * 1000 +
        5000;

      return Date.now() - latestResult.timestamp > budgetMs;
    },
    [
      resolveMonitorIntervalSec,
      resolvedServiceMonitorLimits.checkerScanIntervalSec,
    ],
  );

  const monitorSummary = useMemo(() => {
    let disabled = 0;
    let ok = 0;
    let fail = 0;
    let unknown = 0;
    let stale = 0;

    serviceMonitors.forEach((m) => {
      if (m.enabled !== 1) {
        disabled += 1;

        return;
      }

      const latest = getLatestResult(m.id);

      if (!latest) {
        unknown += 1;

        return;
      }

      if (isResultStale(m, latest)) {
        stale += 1;
      }
      if (latest.success === 1) {
        ok += 1;
      } else {
        fail += 1;
      }
    });

    return { disabled, ok, fail, unknown, stale };
  }, [getLatestResult, isResultStale, serviceMonitors]);

  const detailNode =
    detailNodeId != null ? nodes.find((n) => n.id === detailNodeId) : null;
  const detailRealtimeMetric =
    detailNodeId != null ? realtimeNodeMetrics[detailNodeId] || null : null;

  // Service monitors filtered for the detail node (0 = panel-executed, show all in that case)
  const detailServiceMonitors =
    detailNodeId != null
      ? serviceMonitors.filter(
          (m) => m.nodeId === detailNodeId || m.nodeId === 0,
        )
      : serviceMonitors;

  return (
    <div className="space-y-6">
      {accessDenied && (
        <EmptyStateCard
          description={
            <>
              {accessDenied}
              <br />
              如需使用监控功能，请联系管理员在用户页面授予监控权限。
            </>
          }
          icon={<Activity size={20} />}
          title="暂无监控权限"
        />
      )}

      {/* ====== GRID/LIST VIEW ====== */}
      {!accessDenied && !detailNodeId && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <div className="flex items-center gap-2 text-xs text-default-500">
              <div
                className={`w-2 h-2 rounded-full ${wsConnected ? "bg-success" : wsConnecting ? "bg-warning" : "bg-default-300"}`}
              />
              <span>
                {wsConnected
                  ? "实时已连接"
                  : wsConnecting
                    ? "实时连接中"
                    : "实时未连接"}
              </span>
            </div>
            <Badge size="sm" variant="light">
              节点在线 {onlineNodes.length}/{nodes.length}
            </Badge>
            <Badge color="teal" size="sm" variant="light">
              监控 成功 {monitorSummary.ok} / 失败 {monitorSummary.fail}
            </Badge>
            {monitorSummary.stale > 0 && (
              <Badge color="orange" size="sm" variant="light">
                陈旧 {monitorSummary.stale}
              </Badge>
            )}
          </div>

          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {nodes.map((node) => {
                const metric = realtimeNodeMetrics[node.id] || null;

                return (
                  <ServerCard
                    key={node.id}
                    metric={metric}
                    node={node}
                    onClick={() => {
                      setDetailNodeId(node.id);
                      setSelectedNodeId(node.id);
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <MonitorNodeTable
              nodes={nodes}
              realtimeNodeMetrics={realtimeNodeMetrics}
              setDetailNodeId={setDetailNodeId}
              setSelectedNodeId={setSelectedNodeId}
            />
          )}
        </>
      )}

      {/* ====== DETAIL VIEW ====== */}
      {!accessDenied && detailNodeId && (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3">
            <MantineTooltip label="返回总览">
              <ActionIcon
                aria-label="返回总览"
                color="gray"
                size="lg"
                variant="default"
                onClick={() => setDetailNodeId(null)}
              >
                <ArrowLeft size={16} />
              </ActionIcon>
            </MantineTooltip>
            <div className="flex min-w-0 items-center gap-2.5">
              <IconTile
                size="sm"
                tone={
                  detailNode?.connectionStatus === "online"
                    ? "success"
                    : "default"
                }
              >
                <Server size={15} />
              </IconTile>
              <h2 className="truncate text-base font-semibold text-foreground">
                {detailNode?.name || `节点 #${detailNodeId}`}
              </h2>
              <Badge
                color={uiColor(
                  detailNode?.connectionStatus === "online"
                    ? "success"
                    : "danger",
                )}
                leftSection={<span className="badge-dot" />}
                size="xs"
                variant="light"
              >
                {detailNode?.connectionStatus === "online" ? "在线" : "离线"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-default-500 ml-auto">
              <div
                className={`w-2 h-2 rounded-full ${wsConnected ? "bg-success" : wsConnecting ? "bg-warning" : "bg-default-300"}`}
              />
              <span>
                {wsConnected
                  ? "实时已连接"
                  : wsConnecting
                    ? "实时连接中"
                    : "实时未连接"}
              </span>
            </div>
          </div>

          {/* Realtime KPI cards */}
          {detailRealtimeMetric && (
            <RealtimeMetricGrid metric={detailRealtimeMetric} />
          )}

          {/* Node metrics chart */}
          <NodeMetricsChartCard
            activeMetricType={activeMetricType}
            data={chartData}
            error={metricsError}
            loading={metricsLoading}
            maxRows={METRICS_MAX_ROWS}
            nodeId={selectedNodeId}
            rangeMs={metricsRangeMs}
            truncated={metricsTruncated}
            onMetricTypeChange={setActiveMetricType}
            onRangeChange={setMetricsRangeMs}
            onRefresh={loadMetrics}
          />

          {/* Service monitors chart – same style as node metrics */}
          {(() => {
            // Resolve which monitor is active
            const resolvedActiveMonitor =
              detailServiceMonitors.find(
                (m) => m.id === activeServiceMonitorId,
              ) ||
              detailServiceMonitors[0] ||
              null;
            const resolvedActiveMonitorId = resolvedActiveMonitor?.id ?? null;
            const activeLatestResult =
              resolvedActiveMonitorId != null
                ? getLatestResult(resolvedActiveMonitorId)
                : null;
            const activeStale = resolvedActiveMonitor
              ? isResultStale(resolvedActiveMonitor, activeLatestResult)
              : false;
            const activeResults =
              resolvedActiveMonitorId != null
                ? monitorResults[resolvedActiveMonitorId] || []
                : [];
            const activeLatencyData = [...activeResults].map((r) => ({
              time: formatTimestamp(r.timestamp, serviceMonitorRangeMs),
              latency: r.success === 1 ? r.latencyMs : null,
              success: r.success,
            }));

            return (
              <ServiceMonitorPanel
                activeLatencyData={activeLatencyData}
                activeLatestResult={activeLatestResult}
                activeStale={activeStale}
                detailServiceMonitors={detailServiceMonitors}
                getLatestResult={getLatestResult}
                handleDeleteMonitor={handleDeleteMonitor}
                handleOpenEditModal={handleOpenEditModal}
                handleRunMonitor={handleRunMonitor}
                loadMonitorResults={loadMonitorResults}
                monitorResults={monitorResults}
                monitorsLoading={monitorsLoading}
                openResultsModal={openResultsModal}
                palette={palette}
                resolvedActiveMonitor={resolvedActiveMonitor}
                resolvedActiveMonitorId={resolvedActiveMonitorId}
                serviceMonitorRangeMs={serviceMonitorRangeMs}
                setActiveServiceMonitorId={setActiveServiceMonitorId}
                setServiceMonitorRangeMs={setServiceMonitorRangeMs}
              />
            );
          })()}
        </>
      )}

      <MonitorResultsModal
        handleRunMonitor={handleRunMonitor}
        loadResultsForModal={loadResultsForModal}
        modalResults={modalResults}
        nodeMap={nodeMap}
        resultsLimit={resultsLimit}
        resultsLoading={resultsLoading}
        resultsModalOpen={resultsModalOpen}
        resultsMonitor={resultsMonitor}
        resultsMonitorId={resultsMonitorId}
        setResultsLimit={setResultsLimit}
        setResultsModalOpen={setResultsModalOpen}
        setResultsMonitorId={setResultsMonitorId}
      />

      <MonitorEditModal
        editModalOpen={editModalOpen}
        editingMonitor={editingMonitor}
        handleSubmitMonitor={handleSubmitMonitor}
        monitorForm={monitorForm}
        onlineNodes={onlineNodes}
        resolvedServiceMonitorLimits={resolvedServiceMonitorLimits}
        setEditModalOpen={setEditModalOpen}
        setMonitorForm={setMonitorForm}
        submitLoading={submitLoading}
      />
    </div>
  );
}
