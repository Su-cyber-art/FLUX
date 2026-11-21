import { Progress } from "@mantine/core";
import { Activity, ArrowDown, ArrowUp, Clock } from "lucide-react";

import {
  DistroIcon,
  getDistroColor,
  parseDistroFromVersion,
} from "@/components/distro-icon";
import { uiColor } from "@/components/ui/shared";
import {
  RealtimeNodeMetric,
  formatBytesPerSecond,
  formatUptime,
  getColorByUsage,
} from "@/pages/node/monitor-format";

const DASH = "—";

function UsageKv({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="mon-kv">
      <span className="mon-kv-label">{label}</span>
      <span className={`mon-kv-value ${value === null ? "mon-muted" : ""}`}>
        {value === null ? DASH : `${value.toFixed(1)}%`}
      </span>
      {value === null ? (
        <div className="mon-usage-track mt-1 w-full" />
      ) : (
        <Progress
          className="mt-1"
          color={uiColor(getColorByUsage(value))}
          radius="xl"
          size={4}
          value={value}
        />
      )}
    </div>
  );
}

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
  const live = isOnline && metric ? metric : null;

  return (
    <button
      className="mon-tile"
      data-idle={live ? undefined : ""}
      type="button"
      onClick={onClick}
    >
      <div className="mon-tile-head">
        <DistroIcon
          className="h-4 w-4 shrink-0 text-default-400"
          distro={distro}
          style={{ color: isOnline ? getDistroColor(distro) : undefined }}
        />
        <span className="mon-tile-name">{node.name}</span>
        <span
          className="status-dot mon-tile-sub"
          data-tone={isOnline ? (live ? "success" : "warning") : "danger"}
        >
          {isOnline ? (live ? "在线" : "等待上报") : "离线"}
        </span>
      </div>

      <div className="mon-tile-metrics">
        <UsageKv label="CPU" value={live ? live.cpuUsage : null} />
        <UsageKv label="内存" value={live ? live.memoryUsage : null} />
        <div className="mon-kv">
          <span className="mon-kv-label inline-flex items-center gap-1">
            <ArrowUp size={11} />
            上传
          </span>
          <span className={`mon-kv-value ${live ? "" : "mon-muted"}`}>
            {live ? formatBytesPerSecond(live.netOutSpeed) : DASH}
          </span>
        </div>
        <div className="mon-kv">
          <span className="mon-kv-label inline-flex items-center gap-1">
            <ArrowDown size={11} />
            下载
          </span>
          <span className={`mon-kv-value ${live ? "" : "mon-muted"}`}>
            {live ? formatBytesPerSecond(live.netInSpeed) : DASH}
          </span>
        </div>
      </div>

      <div className="mon-tile-foot">
        <span>
          <Clock className="shrink-0" size={12} />
          {metric ? formatUptime(metric.uptime) : DASH}
        </span>
        <span className="shrink-0 tabular-nums">
          <Activity className="shrink-0" size={12} />
          负载 {metric ? metric.load1.toFixed(2) : DASH}
        </span>
      </div>
    </button>
  );
}
