import {
  ArrowDown,
  ArrowUp,
  Clock,
  Cpu,
  HardDrive,
  MemoryStick,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { UsageBar } from "@/components/usage-meter";
import {
  formatBytesPerSecond,
  formatUptime,
  type RealtimeNodeMetric,
} from "@/pages/node/monitor-format";

interface RealtimeMetricGridProps {
  metric: RealtimeNodeMetric;
}

export function RealtimeMetricGrid({ metric }: RealtimeMetricGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {(
        [
          {
            label: "CPU",
            icon: Cpu,
            value: `${metric.cpuUsage.toFixed(1)}%`,
            percent: metric.cpuUsage,
          },
          {
            label: "内存",
            icon: MemoryStick,
            value: `${metric.memoryUsage.toFixed(1)}%`,
            percent: metric.memoryUsage,
          },
          {
            label: "磁盘",
            icon: HardDrive,
            value: `${metric.diskUsage.toFixed(1)}%`,
            percent: metric.diskUsage,
          },
          {
            label: "下行速度",
            icon: ArrowDown,
            value: formatBytesPerSecond(metric.netInSpeed),
          },
          {
            label: "上行速度",
            icon: ArrowUp,
            value: formatBytesPerSecond(metric.netOutSpeed),
          },
          {
            label: "运行时间",
            icon: Clock,
            value: formatUptime(metric.uptime),
          },
        ] as {
          label: string;
          icon: typeof Cpu;
          value: string;
          percent?: number;
        }[]
      ).map((item) => (
        <Card key={item.label} className="flex flex-col gap-2 p-4">
          <span className="flex items-center gap-1.5 text-xs text-default-500">
            <item.icon size={13} />
            {item.label}
          </span>
          <span className="metric-value truncate text-lg font-semibold text-foreground">
            {item.value}
          </span>
          {item.percent !== undefined && (
            <UsageBar label={item.label} percent={item.percent} />
          )}
        </Card>
      ))}
    </div>
  );
}
