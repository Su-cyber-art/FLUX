import { Progress } from "@mantine/core";
import { Activity, Clock } from "lucide-react";

import {
  DistroIcon,
  getDistroColor,
  parseDistroFromVersion,
} from "@/components/distro-icon";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { uiColor } from "@/components/ui/shared";
import {
  RealtimeNodeMetric,
  formatBytesPerSecond,
  formatUptime,
  getColorByUsage,
} from "@/pages/node/monitor-format";

export function ServerCard({
  node,
  metric,
  onClick,
}: {
  node: any;
  metric: RealtimeNodeMetric | null;
  onClick?: () => void;
}) {
  const isOnline = node.connectionStatus === "online";
  const distro = parseDistroFromVersion(node.version);
  const distroColor = getDistroColor(distro);

  return (
    <Card
      className="group relative hover:-translate-y-1 shadow-sm transition-all duration-300 h-full flex flex-col cursor-pointer"
      onClick={onClick}
    >
      {/* Dynamic top gradient bar based on status */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${isOnline ? "bg-success" : "bg-danger"}`}
      />

      {/* Decorative background glow */}
      <div
        className={`absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20 ${isOnline ? "bg-success" : "bg-danger"}`}
      />

      <CardHeader className="pb-2 pt-5 px-5 flex flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-default-soft flex items-center justify-center border border-divider">
              <DistroIcon
                className="w-5 h-5"
                distro={distro}
                style={{ color: isOnline ? distroColor : undefined }}
              />
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${isOnline ? "bg-success" : "bg-danger"}`}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-semibold text-foreground text-sm truncate">
              {node.name}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-default-500 mt-0.5">
              <span className="font-mono">{isOnline ? "在线" : "离线"}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardBody className="py-3 px-5 flex-1 flex flex-col justify-end gap-4 z-10 w-full overflow-hidden">
        <div className="grid grid-cols-2 gap-5 w-full">
          <div className="space-y-1.5 min-w-0">
            <div className="flex justify-between items-center text-xs">
              <span className="text-default-500">CPU</span>
              <span className="font-mono font-medium">
                {isOnline && metric ? `${metric.cpuUsage.toFixed(1)}%` : "-"}
              </span>
            </div>
            <Progress
              color={uiColor(getColorByUsage(metric?.cpuUsage))}
              size={4}
              value={isOnline && metric ? metric.cpuUsage : 0}
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex justify-between items-center text-xs">
              <span className="text-default-500">内存</span>
              <span className="font-mono font-medium">
                {isOnline && metric ? `${metric.memoryUsage.toFixed(1)}%` : "-"}
              </span>
            </div>
            <Progress
              color={uiColor(getColorByUsage(metric?.memoryUsage))}
              size={4}
              value={isOnline && metric ? metric.memoryUsage : 0}
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-lg bg-default-soft border border-divider mt-1 w-full">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[10px] text-default-500">
              <span className="text-primary-ink inline-block font-bold">↑</span>
              <span>上传</span>
            </div>
            <span className="font-mono text-xs font-semibold truncate">
              {isOnline && metric
                ? formatBytesPerSecond(metric.netOutSpeed)
                : "-"}
            </span>
          </div>
          <div className="w-px h-6 bg-divider mx-2" />
          <div className="flex flex-col gap-0.5 items-end min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[10px] text-default-500">
              <span>下载</span>
              <span className="text-success-ink inline-block font-bold">↓</span>
            </div>
            <span className="font-mono text-xs font-semibold truncate">
              {isOnline && metric
                ? formatBytesPerSecond(metric.netInSpeed)
                : "-"}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center mt-1 pt-3 border-t border-divider/50 w-full overflow-hidden">
          <div className="flex items-center gap-1.5 text-[11px] text-default-500 min-w-0">
            <Clock className="w-3.5 h-3.5 text-default-400 shrink-0" />
            <span className="font-mono truncate">
              {metric ? formatUptime(metric.uptime) : "-"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-default-500 shrink-0 ml-2">
            <Activity className="w-3.5 h-3.5 text-default-400" />
            <span className="font-mono">
              Load: {metric ? metric.load1.toFixed(2) : "-"}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
