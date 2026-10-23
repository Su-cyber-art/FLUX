import { Network } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageEmptyState } from "@/components/page-state";
import { UsageMeter } from "@/pages/dashboard/components/quota-card";
import { SectionHeader } from "@/components/section-header";
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

export function TunnelAccessList({
  tunnels,
  forwardCount,
}: TunnelAccessListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          count={tunnels.length}
          description="你可以使用的隧道及其独立配额"
          icon={Network}
          title="隧道权限"
        />
      </CardHeader>
      <CardBody className="pt-0">
        {tunnels.length === 0 ? (
          <PageEmptyState className="h-40" message="暂无隧道权限" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {tunnels.map((tunnel) => {
              const expiry = getExpiryStatus(tunnel.expTime);
              const usedFlow = (tunnel.inFlow || 0) + (tunnel.outFlow || 0);
              const flowUnlimited = isUnlimitedFlow(
                tunnel.flow,
                tunnel.flowMiB,
              );
              const used = forwardCount(tunnel.tunnelId);
              const reset = formatResetTime(tunnel.flowResetTime);

              return (
                <div
                  key={tunnel.id}
                  className="min-w-0 rounded-lg border border-divider p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {tunnel.tunnelName}
                      </p>
                      <p className="mt-0.5 text-xs text-default-500">
                        ID {tunnel.id}
                        {reset ? ` · ${reset}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <Chip
                        color={tunnel.tunnelFlow === 1 ? "primary" : "warning"}
                        size="sm"
                      >
                        {tunnel.tunnelFlow === 1 ? "单向计费" : "双向计费"}
                      </Chip>
                      <Chip dot color={expiry.tone} size="sm">
                        {expiry.text}
                      </Chip>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <UsageMeter
                      label="流量"
                      limit={formatFlowLimit(tunnel.flow, tunnel.flowMiB)}
                      percent={usagePercent(
                        usedFlow,
                        flowLimitBytes(tunnel.flow || 0, tunnel.flowMiB),
                      )}
                      unlimited={flowUnlimited}
                      used={formatTraffic(usedFlow)}
                    />
                    <UsageMeter
                      label="规则"
                      limit={formatCount(tunnel.num)}
                      percent={usagePercent(used, tunnel.num || 0)}
                      unlimited={tunnel.num === UNLIMITED}
                      used={used}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
