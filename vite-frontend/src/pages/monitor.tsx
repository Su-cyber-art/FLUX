import type { MonitorNodeApiItem } from "@/api/types";

import { SegmentedControl, Group } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRightLeft,
  Gauge,
  LayoutGrid,
  List,
  RefreshCw,
  Server,
} from "lucide-react";

import { StatCard } from "@/components/stat-card";
import toast from "@/lib/notifications";
import { AnimatedPage } from "@/components/animated-page";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getMonitorNodes } from "@/api";
import { MonitorView } from "@/pages/node/monitor-view";
import { TunnelMonitorView } from "@/pages/node/tunnel-monitor-view";
import { useNodeRealtime } from "@/pages/node/use-node-realtime";

type MonitorNode = {
  id: number;
  name: string;
  connectionStatus: "online" | "offline";
  version?: string;
};

type MonitorTab = "nodes" | "tunnels";

const formatBytesPerSecond = (bytesPerSecond: number): string => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "0 B/s";

  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));

  return `${parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export default function MonitorPage() {
  const [nodes, setNodes] = useState<MonitorNodeApiItem[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesError, setNodesError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [activeTab, setActiveTab] = useState<MonitorTab>("nodes");

  const [realtimeNodeStatus, setRealtimeNodeStatus] = useState<
    Record<number, "online" | "offline">
  >({});
  const [realtimeNodeMetrics, setRealtimeNodeMetrics] = useState<
    Record<number, any>
  >({});

  const handleRealtimeMessage = useCallback((message: any) => {
    const nodeId = Number(message?.id ?? 0);

    if (!nodeId || Number.isNaN(nodeId)) return;

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
      if (!raw || typeof raw !== "object") return;
      const metric = raw as any;

      setRealtimeNodeMetrics((prev) => ({
        ...prev,
        [nodeId]: {
          cpuUsage: Number(metric.cpuUsage ?? metric.cpu_usage ?? 0),
          netInSpeed: Number(metric.netInSpeed ?? metric.net_in_speed ?? 0),
          netOutSpeed: Number(metric.netOutSpeed ?? metric.net_out_speed ?? 0),
          tcpConns: Number(metric.tcpConns ?? metric.tcp_conns ?? 0),
          udpConns: Number(metric.udpConns ?? metric.udp_conns ?? 0),
        },
      }));
    }
  }, []);

  useNodeRealtime({
    onMessage: handleRealtimeMessage,
    enabled: true,
  });

  const loadNodes = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) setNodesLoading(true);
    try {
      const response = await getMonitorNodes();

      if (response.code === 0 && Array.isArray(response.data)) {
        setNodesError(null);
        setNodes(response.data);

        return;
      }

      if (response.code === 403) {
        setNodes([]);
        setNodesError(response.msg || "暂无监控权限，请联系管理员授权");

        return;
      }

      if (!silent) toast.error(response.msg || "加载节点失败");
    } catch {
      if (!silent) toast.error("加载节点失败");
    } finally {
      if (!silent) setNodesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNodes();
  }, [loadNodes]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadNodes({ silent: true });
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [loadNodes]);

  const nodeMap = useMemo(() => {
    const list: MonitorNode[] = nodes
      .filter((n) => Number(n.id) > 0)
      .map((n) => ({
        id: Number(n.id),
        name: String(n.name ?? ""),
        connectionStatus:
          realtimeNodeStatus[Number(n.id)] ||
          (n.status === 1 ? "online" : "offline"),
        version: n.version,
      }));

    return new Map<number, MonitorNode>(list.map((n) => [n.id, n]));
  }, [nodes, realtimeNodeStatus]);

  const aggregateMetrics = useMemo(() => {
    let totalCpu = 0;
    let totalConns = 0;
    let totalNetIn = 0;
    let totalNetOut = 0;
    let onlineCount = 0;

    nodeMap.forEach((node) => {
      if (node.connectionStatus === "online") {
        onlineCount++;
        const metric = realtimeNodeMetrics[node.id];

        if (metric) {
          totalCpu += metric.cpuUsage;
          totalConns += metric.tcpConns + metric.udpConns;
          totalNetIn += metric.netInSpeed;
          totalNetOut += metric.netOutSpeed;
        }
      }
    });

    const avgCpu = onlineCount > 0 ? totalCpu / onlineCount : 0;

    return {
      onlineCount,
      avgCpu,
      totalConns,
      totalBandwidth: totalNetIn + totalNetOut,
    };
  }, [nodeMap, realtimeNodeMetrics]);

  return (
    <AnimatedPage>
      <div className="monitor-summary">
        <StatCard
          bottomContent={
            <p className="text-xs text-default-500">
              {nodeMap.size - aggregateMetrics.onlineCount > 0
                ? `${nodeMap.size - aggregateMetrics.onlineCount} 个节点离线`
                : "全部节点在线"}
            </p>
          }
          icon={<Activity size={18} />}
          title="在线节点"
          tone={
            nodeMap.size > 0 && aggregateMetrics.onlineCount < nodeMap.size
              ? "warning"
              : "success"
          }
          value={`${aggregateMetrics.onlineCount} / ${nodeMap.size}`}
        />
        <StatCard
          bottomContent={
            <p className="text-xs text-default-500">在线节点平均负载</p>
          }
          icon={<Server size={18} />}
          title="平均 CPU 负载"
          tone="primary"
          value={`${aggregateMetrics.avgCpu.toFixed(1)}%`}
        />
        <StatCard
          bottomContent={
            <p className="text-xs text-default-500">TCP 与 UDP 连接合计</p>
          }
          icon={<ArrowRightLeft size={18} />}
          title="活跃连接"
          tone="info"
          value={aggregateMetrics.totalConns}
        />
        <StatCard
          bottomContent={
            <p className="text-xs text-default-500">在线节点收发速率合计</p>
          }
          icon={<Gauge size={18} />}
          title="实时带宽"
          tone="secondary"
          value={formatBytesPerSecond(aggregateMetrics.totalBandwidth)}
        />
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SegmentedControl
            aria-label="监控类型"
            data={[
              {
                value: "nodes",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <Server size={15} />
                    节点监控
                  </Group>
                ),
              },
              {
                value: "tunnels",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <ArrowRightLeft size={15} />
                    隧道监控
                  </Group>
                ),
              },
            ]}
            size="sm"
            value={activeTab}
            onChange={(value) => setActiveTab(value as MonitorTab)}
          />
          <div className="flex items-center gap-2">
            <SegmentedControl
              aria-label="显示方式"
              data={[
                {
                  value: "grid",
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <LayoutGrid size={15} />
                      <span className="hidden sm:inline">卡片</span>
                    </Group>
                  ),
                },
                {
                  value: "list",
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <List size={15} />
                      <span className="hidden sm:inline">列表</span>
                    </Group>
                  ),
                },
              ]}
              size="sm"
              value={viewMode}
              onChange={(value) => setViewMode(value as "list" | "grid")}
            />
            {activeTab === "nodes" && (
              <Button
                aria-label="刷新节点"
                isLoading={nodesLoading}
                startContent={<RefreshCw size={15} />}
                onPress={() => loadNodes()}
              >
                <span className="hidden sm:inline">刷新</span>
              </Button>
            )}
          </div>
        </div>

        {nodesError && activeTab === "nodes" ? (
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">节点列表</h3>
            </CardHeader>
            <CardBody>
              <div className="text-sm text-default-600">{nodesError}</div>
            </CardBody>
          </Card>
        ) : null}
      </div>

      {activeTab === "nodes" ? (
        <MonitorView nodeMap={nodeMap} viewMode={viewMode} />
      ) : (
        <TunnelMonitorView viewMode={viewMode} />
      )}
    </AnimatedPage>
  );
}
