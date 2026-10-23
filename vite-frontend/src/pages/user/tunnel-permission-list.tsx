import { ActionIcon, Tooltip } from "@mantine/core";
import { RotateCcw, SquarePen, Trash2 } from "lucide-react";

import { UsageMeter } from "@/components/usage-meter";
import { Chip } from "@/components/ui/chip";
import { Spinner } from "@/components/ui/spinner";
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
        <Spinner size="sm" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-divider px-4 py-6 text-center text-sm text-default-500">
        还没有分配隧道权限
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-divider">
      {items.map((item) => (
        <div
          key={item.id}
          className="grid gap-3 border-divider px-4 py-3 [&+&]:border-t sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center"
        >
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {item.tunnelName}
              </span>
              {item.status !== 1 && (
                <Chip dot color="danger" size="xs">
                  禁用
                </Chip>
              )}
              <Chip
                color={item.speedLimitName ? "warning" : "default"}
                size="xs"
              >
                {item.speedLimitName || "不限速"}
              </Chip>
            </div>
            <p className="mt-1 truncate text-xs text-default-500">
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
          <div className="flex items-center justify-end gap-0.5">
            <Tooltip label="编辑权限">
              <ActionIcon
                aria-label={`编辑 ${item.tunnelName} 的权限`}
                color="gray"
                variant="subtle"
                onClick={() => onEdit(item)}
              >
                <SquarePen size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="重置流量">
              <ActionIcon
                aria-label={`重置 ${item.tunnelName} 的流量`}
                color="gray"
                variant="subtle"
                onClick={() => onResetFlow(item)}
              >
                <RotateCcw size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="移除权限">
              <ActionIcon
                aria-label={`移除 ${item.tunnelName} 的权限`}
                color="red"
                variant="subtle"
                onClick={() => onRemove(item)}
              >
                <Trash2 size={16} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}
