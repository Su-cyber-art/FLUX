import type { ReactNode } from "react";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  Clock,
  Cpu,
  HardDrive,
  MemoryStick,
  WifiOff,
} from "lucide-react";

import { KpiCell, KpiStrip } from "@/components/stat-card";
import { UsageBar } from "@/components/usage-meter";
import {
  formatBytesPerSecond,
  formatUptime,
  type RealtimeNodeMetric,
} from "@/pages/node/monitor-format";

interface RealtimeMetricGridProps {
  metric: RealtimeNodeMetric | null;
  /** Used only to word the empty state. */
  online?: boolean;
}

export function RealtimeMetricGrid({
  metric,
  online = true,
}: RealtimeMetricGridProps) {
  if (!metric) {
    return (
      <p className="chart-empty app-surface min-h-0 justify-start px-4 py-3">
        {online ? <Activity size={14} /> : <WifiOff size={14} />}
        {online
          ? "节点在线，正在等待上报实时指标（CPU、内存、磁盘、网络）"
          : "节点离线，暂无实时指标"}
      </p>
    );
  }

  const percentCell = (label: string, icon: ReactNode, percent: number) => (
    <KpiCell
      icon={icon}
      label={label}
      meter={<UsageBar label={label} percent={percent} />}
      unit="%"
      value={percent.toFixed(1)}
    />
  );

  return (
    <KpiStrip columns={6} label="实时指标">
      {percentCell("CPU", <Cpu />, metric.cpuUsage)}
      {percentCell("内存", <MemoryStick />, metric.memoryUsage)}
      {percentCell("磁盘", <HardDrive />, metric.diskUsage)}
      <KpiCell
        caption={<span>入站</span>}
        icon={<ArrowDown />}
        label="下行速度"
        value={formatBytesPerSecond(metric.netInSpeed)}
      />
      <KpiCell
        caption={<span>出站</span>}
        icon={<ArrowUp />}
        label="上行速度"
        value={formatBytesPerSecond(metric.netOutSpeed)}
      />
      <KpiCell
        caption={
          <span>
            负载 {metric.load1.toFixed(2)} · {metric.load5.toFixed(2)} ·{" "}
            {metric.load15.toFixed(2)}
          </span>
        }
        icon={<Clock />}
        label="运行时间"
        value={formatUptime(metric.uptime)}
      />
    </KpiStrip>
  );
}
