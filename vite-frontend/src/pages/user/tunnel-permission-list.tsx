import { ActionIcon, Tooltip, Loader } from "@mantine/core";
import { Gauge, RotateCcw, SquarePen, Trash2 } from "lucide-react";

import { UsageMeter } from "@/components/usage-meter";
import { calculateTunnelUsedFlow, formatFlow } from "@/pages/user/presentation";
import { UserTunnel } from "@/types";
import { flowLimitBytes, formatFlowLimit } from "@/utils/traffic";

interface TunnelPermissionListProps {
  items: UserTunnel[];
  loading: boolean;
  onEdit: (item: UserTunnel) => void;
  onResetFlow: (item: UserTunnel) => void;
  onRemove: (item: UserTunnel) => void;
}

const isUnlimited = (item: UserTunnel) => item.flow === 99999 && !item.flowMiB;

const flowPercent = (item: UserTunnel) => {
  if (isUnlimited(item) || item.flow <= 0) return 0;
  const limit = flowLimitBytes(item.flow, item.flowMiB);

  return limit > 0
    ? Math.min((calculateTunnelUsedFlow(item) / limit) * 100, 100)
    : 0;
};

/** Tunnels a user can access, with quota usage and per-permission actions. */
export function TunnelPermissionList({
  items,
  loading,
  onEdit,
  onResetFlow,
  onRemove,
}: TunnelPermissionListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader aria-label="加载中" role="status" size="sm" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-divider px-4 py-5 text-center text-[13px] text-default-500">
        还没有分配隧道权限
      </p>
    );
  }

  return (
    <div className="user-perm-list">
      {items.map((item) => (
        <div key={item.id} className="user-perm-row">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="truncate text-[13px] font-medium text-foreground">
                {item.tunnelName}
              </span>
              {item.status !== 1 && (
                <span className="status-dot shrink-0" data-tone="danger">
                  禁用
                </span>
              )}
              <span
                className={`inline-flex shrink-0 items-center gap-1 text-xs ${item.speedLimitName ? "text-warning-ink" : "text-default-500"}`}
              >
                <Gauge size={12} />
                {item.speedLimitName || "不限速"}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-default-500">
              规则 {item.num} 条 ·{" "}
              {item.flowResetTime === 0
                ? "不自动重置"
                : `每月 ${item.flowResetTime} 日重置`}{" "}
              ·{" "}
              {item.expTime
                ? `${new Date(item.expTime).toLocaleDateString("zh-CN")} 到期`
                : "长期有效"}
            </p>
          </div>
          <UsageMeter
            label="流量"
            limit={formatFlowLimit(item.flow, item.flowMiB)}
            percent={flowPercent(item)}
            unlimited={isUnlimited(item)}
            used={formatFlow(calculateTunnelUsedFlow(item))}
          />
          <div className="flex items-center justify-end">
            <Tooltip label="编辑权限">
              <ActionIcon
                aria-label={`编辑 ${item.tunnelName} 的权限`}
                color="gray"
                variant="subtle"
                onClick={() => onEdit(item)}
              >
                <SquarePen size={15} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="重置流量">
              <ActionIcon
                aria-label={`重置 ${item.tunnelName} 的流量`}
                color="gray"
                variant="subtle"
                onClick={() => onResetFlow(item)}
              >
                <RotateCcw size={15} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="移除权限">
              <ActionIcon
                aria-label={`移除 ${item.tunnelName} 的权限`}
                color="red"
                variant="subtle"
                onClick={() => onRemove(item)}
              >
                <Trash2 size={15} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}
