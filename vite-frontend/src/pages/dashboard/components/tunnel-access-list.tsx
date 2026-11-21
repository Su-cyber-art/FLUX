import { Network } from "lucide-react";
import { Progress } from "@mantine/core";

import { Card } from "@/components/ui/card";
import { uiColor, usageTone } from "@/components/ui/shared";
import { PanelHead } from "@/pages/dashboard/components/panel";
import {
  UNLIMITED,
  formatCount,
  formatResetTime,
  getExpiryStatus,
  isUnlimitedFlow,
  usagePercent,
} from "@/pages/dashboard/format";
import { type DashboardUserTunnel } from "@/pages/dashboard/use-dashboard-data";
import {
  flowLimitBytes,
  formatFlowLimit,
  formatTraffic,
} from "@/utils/traffic";

interface TunnelAccessListProps {
  tunnels: DashboardUserTunnel[];
  forwardCount: (tunnelId: number) => number;
}

function Meter({
  label,
  used,
  limit,
  percent,
  unlimited,
}: {
  label: string;
  used: string | number;
  limit: string;
  percent: number;
  unlimited: boolean;
}) {
  return (
    <div className="dash-meter min-w-0">
      <div className="dash-meter-text">
        <span>{label}</span>
        <span className="truncate">
          <b>{used}</b> / {limit}
        </span>
      </div>
      <Progress
        aria-label={label}
        color={
          unlimited ? "var(--default-soft-hover)" : uiColor(usageTone(percent))
        }
        radius="xl"
        value={unlimited ? 100 : percent}
      />
    </div>
  );
}

export function TunnelAccessList({
  tunnels,
  forwardCount,
}: TunnelAccessListProps) {
  return (
    <Card className="dash-panel">
      <PanelHead
        count={tunnels.length}
        description="你可以使用的隧道及其独立配额"
        title="隧道权限"
      />
      {tunnels.length === 0 ? (
        <p className="chart-empty">
          <Network size={15} />
          暂无隧道权限
        </p>
      ) : (
        <ul className="dash-list">
          {tunnels.map((tunnel) => {
            const expiry = getExpiryStatus(tunnel.expTime);
            const usedFlow = (tunnel.inFlow || 0) + (tunnel.outFlow || 0);
            const flowUnlimited = isUnlimitedFlow(tunnel.flow, tunnel.flowMiB);
            const used = forwardCount(tunnel.tunnelId);
            const reset = formatResetTime(tunnel.flowResetTime);

            return (
              <li key={tunnel.id} className="dash-row dash-tunnel-row">
                <div className="min-w-0">
                  <p className="dash-row-name" title={tunnel.tunnelName}>
                    {tunnel.tunnelName}
                  </p>
                  <p className="dash-row-meta mt-0.5">
                    ID {tunnel.id}
                    {" · "}
                    {tunnel.tunnelFlow === 1 ? "单向计费" : "双向计费"}
                    {reset ? ` · ${reset}` : ""}
                  </p>
                </div>
                <span
                  className="status-dot justify-self-end"
                  data-tone={expiry.tone}
                >
                  {expiry.text}
                </span>
                <div className="dash-tunnel-meters">
                  <Meter
                    label="流量"
                    limit={formatFlowLimit(tunnel.flow, tunnel.flowMiB)}
                    percent={usagePercent(
                      usedFlow,
                      flowLimitBytes(tunnel.flow || 0, tunnel.flowMiB),
                    )}
                    unlimited={flowUnlimited}
                    used={formatTraffic(usedFlow)}
                  />
                  <Meter
                    label="规则"
                    limit={formatCount(tunnel.num)}
                    percent={usagePercent(used, tunnel.num || 0)}
                    unlimited={tunnel.num === UNLIMITED}
                    used={used}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
