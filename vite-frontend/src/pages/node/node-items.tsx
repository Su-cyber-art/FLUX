import type { ReactNode } from "react";

import { ActionIcon, Menu, Progress, Tooltip } from "@mantine/core";
import {
  ArrowDown,
  ArrowUp,
  BellOff,
  CircleArrowUp,
  Clock,
  Ellipsis,
  GripVertical,
  Plug,
  RotateCcw,
  SquarePen,
  Terminal,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { uiColor, usageTone } from "@/components/ui/shared";
import { cn } from "@/lib/utils";
import { getRemoteSyncErrorMessage } from "@/pages/node/display";
import {
  getNodeExpiryMeta,
  type Node,
  type RemoteUsageNode,
} from "@/pages/node/presentation";

export interface NodeItemHandlers {
  formatSpeed: (bytesPerSecond: number) => string;
  formatUptime: (seconds: number) => string;
  formatFlow: (bytes: number) => string;
  formatChainType: (chainType: number, hopInx: number) => string;
  onInstall: (node: Node) => void;
  onUpgrade: (node: Node) => void;
  onRollback: (node: Node) => void;
  onEdit: (node: Node) => void;
  onDelete: (node: Node) => void;
  onDismissReminder: (nodeId: number) => void;
  onToggleSelect: (nodeId: number) => void;
}

export interface NodeUpgradeProgress {
  stage: string;
  percent: number;
  message: string;
}

const remoteHost = (url?: string): string => {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return url || "";
  }
};

/** Addresses shown under the node name: IPv4/IPv6 when set, else the server IP. */
export const nodeAddresses = (node: Node): string[] => {
  if (node.isRemote === 1) {
    return [remoteHost(node.remoteUrl)].filter(Boolean);
  }
  const split = [node.serverIpV4?.trim(), node.serverIpV6?.trim()].filter(
    (value): value is string => Boolean(value),
  );

  return split.length > 0 ? split : [node.serverIp?.trim()].filter(Boolean);
};

const isOnline = (node: Node) => node.connectionStatus === "online";

const StatusChip = ({ node }: { node: Node }) =>
  node.deleteState ? (
    <Chip dot color="warning" size="xs">
      {node.deleteState === 3 ? "待移除" : "待清理"}
    </Chip>
  ) : (
    <Chip dot color={isOnline(node) ? "success" : "default"} size="xs">
      {isOnline(node) ? "在线" : "离线"}
    </Chip>
  );

const NodeMeter = ({ label, value }: { label: string; value?: number }) => {
  const percent = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-1 text-[11px]">
        <span className="text-default-500">{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {value === undefined ? "-" : `${percent.toFixed(0)}%`}
        </span>
      </div>
      <Progress
        aria-label={label}
        color={uiColor(usageTone(percent))}
        radius="xl"
        size={5}
        value={percent}
      />
    </div>
  );
};

const NodeMetrics = ({ node }: { node: Node }) => {
  const info = node.systemInfo;

  if (!isOnline(node) || !info) {
    return (
      <p className="node-metrics-empty">
        {isOnline(node) ? "等待节点上报数据…" : "节点离线，暂无实时数据"}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <NodeMeter label="CPU" value={info.cpuUsage} />
      <NodeMeter label="内存" value={info.memoryUsage} />
      <NodeMeter label="磁盘" value={info.diskUsage} />
    </div>
  );
};

const NodeTraffic = ({
  node,
  handlers,
  showUptime = true,
}: {
  node: Node;
  handlers: NodeItemHandlers;
  showUptime?: boolean;
}) => {
  const info = node.systemInfo;

  if (!isOnline(node) || !info) {
    return null;
  }
  const conns = (info.tcpConns ?? 0) + (info.udpConns ?? 0);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-default-500">
      <span className="inline-flex items-center gap-1" title="下载速度">
        <ArrowDown className="text-success-ink" size={12} />
        {handlers.formatSpeed(info.netInSpeed ?? info.downloadSpeed)}
      </span>
      <span className="inline-flex items-center gap-1" title="上传速度">
        <ArrowUp className="text-primary-ink" size={12} />
        {handlers.formatSpeed(info.netOutSpeed ?? info.uploadSpeed)}
      </span>
      <span className="inline-flex items-center gap-1" title="TCP + UDP 连接数">
        <Plug size={12} />
        {conns}
      </span>
      {showUptime && (
        <span className="inline-flex items-center gap-1" title="运行时长">
          <Clock size={12} />
          {handlers.formatUptime(info.uptime)}
        </span>
      )}
    </div>
  );
};

const NodeMoreMenu = ({
  node,
  handlers,
}: {
  node: Node;
  handlers: NodeItemHandlers;
}) => {
  const isRemote = node.isRemote === 1;
  const reminderOn = Boolean(
    node.expiryTime &&
      node.expiryTime > 0 &&
      node.renewalCycle &&
      !node.expiryReminderDismissed,
  );

  return (
    <Menu withinPortal position="bottom-end" shadow="md" width={168}>
      <Menu.Target>
        <ActionIcon aria-label="更多操作" color="gray" variant="subtle">
          <Ellipsis size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {!isRemote && (
          <Menu.Item
            disabled={!isOnline(node) || node.rollbackLoading}
            leftSection={<RotateCcw size={14} />}
            onClick={() => handlers.onRollback(node)}
          >
            回退版本
          </Menu.Item>
        )}
        {reminderOn && (
          <Menu.Item
            leftSection={<BellOff size={14} />}
            onClick={() => handlers.onDismissReminder(node.id)}
          >
            关闭到期提醒
          </Menu.Item>
        )}
        {(!isRemote || reminderOn) && <Menu.Divider />}
        <Menu.Item
          color="red"
          leftSection={<Trash2 size={14} />}
          onClick={() => handlers.onDelete(node)}
        >
          删除节点
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

const NodeTags = ({ node }: { node: Node }) => {
  const remark = node.remark?.trim();
  const reminderOn = Boolean(
    node.expiryTime &&
      node.expiryTime > 0 &&
      node.renewalCycle &&
      !node.expiryReminderDismissed,
  );
  const expiry = reminderOn
    ? getNodeExpiryMeta(node.expiryTime, node.renewalCycle)
    : null;

  if (!expiry && !remark) return null;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {expiry && (
        <Chip className="shrink-0" color={expiry.tone} size="xs">
          {expiry.label}
        </Chip>
      )}
      {remark && (
        <span className="truncate text-xs text-default-500" title={remark}>
          {remark}
        </span>
      )}
    </div>
  );
};

const RemoteUsagePanel = ({
  node,
  usage,
  handlers,
}: {
  node: Node;
  usage: RemoteUsageNode | null;
  handlers: NodeItemHandlers;
}) => {
  if (!usage) {
    return <p className="node-metrics-empty">暂未获取到远程占用数据</p>;
  }
  const portTotal = Math.max(usage.portRangeEnd - usage.portRangeStart + 1, 0);

  return (
    <div className="space-y-3 text-xs">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-default-soft p-3">
        <div className="col-span-2 min-w-0">
          <dt className="text-default-500">远程地址</dt>
          <dd
            className="truncate font-mono text-default-700"
            title={usage.remoteUrl || node.remoteUrl}
          >
            {usage.remoteUrl || node.remoteUrl || "-"}
          </dd>
        </div>
        <div>
          <dt className="text-default-500">共享 ID</dt>
          <dd className="font-mono text-default-700">#{usage.shareId}</dd>
        </div>
        <div>
          <dt className="text-default-500">流量</dt>
          <dd className="font-mono text-default-700">
            {handlers.formatFlow(usage.currentFlow)}
          </dd>
        </div>
        <div>
          <dt className="text-default-500">带宽上限</dt>
          <dd className="font-mono text-default-700">
            {usage.maxBandwidth > 0
              ? handlers.formatSpeed(usage.maxBandwidth)
              : "不限"}
          </dd>
        </div>
        <div>
          <dt className="text-default-500">占用端口</dt>
          <dd className="font-mono text-default-700">
            {usage.usedPorts.length}/{portTotal}
          </dd>
        </div>
      </dl>
      {usage.usedPorts.length > 0 && (
        <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
          {usage.usedPorts.map((port) => (
            <Chip
              key={`${node.id}-port-${port}`}
              className="font-mono"
              size="xs"
            >
              {port}
            </Chip>
          ))}
        </div>
      )}
      <div>
        <p className="mb-1.5 text-default-500">
          绑定明细 · {usage.activeBindingNum}
        </p>
        {usage.bindings.length > 0 ? (
          <ul className="max-h-32 divide-y divide-divider overflow-y-auto rounded-lg border border-divider">
            {usage.bindings.map((binding) => (
              <li
                key={binding.bindingId}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5"
              >
                <span className="min-w-0">
                  <span
                    className="block truncate font-medium text-foreground"
                    title={binding.tunnelName}
                  >
                    {binding.tunnelName}
                  </span>
                  <span className="text-[11px] text-default-500">
                    {handlers.formatChainType(
                      binding.chainType,
                      binding.hopInx,
                    )}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-default-500">
                  :{binding.allocatedPort}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-default-400">暂无绑定明细</p>
        )}
      </div>
    </div>
  );
};

const DragHandle = (props: React.HTMLAttributes<HTMLButtonElement>) => (
  <button
    aria-label="拖拽排序"
    className="forward-drag-handle -mr-1"
    title="拖拽排序"
    type="button"
    {...props}
  >
    <GripVertical size={15} />
  </button>
);

const NodeIdentity = ({
  node,
  trailing,
}: {
  node: Node;
  trailing?: ReactNode;
}) => {
  const addresses = nodeAddresses(node);

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        <h3
          className="truncate text-[15px] font-semibold text-foreground"
          title={node.name}
        >
          {node.name}
        </h3>
        <StatusChip node={node} />
        {trailing}
      </div>
      <p
        className="mt-0.5 truncate font-mono text-xs text-default-500"
        title={addresses.join(" / ")}
      >
        {addresses.join(" · ") || "-"}
        {node.isRemote !== 1 && node.version ? (
          <span className="font-sans"> · {node.version}</span>
        ) : null}
      </p>
    </div>
  );
};

const UpgradeProgressBar = ({
  progress,
}: {
  progress?: NodeUpgradeProgress;
}) =>
  progress && progress.percent < 100 ? (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-[11px] text-default-500">
        <span className="truncate">{progress.message || "正在升级"}</span>
        <span className="tabular-nums">{Math.round(progress.percent)}%</span>
      </div>
      <Progress
        animated
        striped
        aria-label="升级进度"
        color="orange"
        radius="xl"
        size={5}
        value={progress.percent}
      />
    </div>
  ) : null;

export const NodeCard = ({
  node,
  selected,
  selectMode,
  remoteUsage,
  upgradeProgress,
  dragListeners,
  handlers,
}: {
  node: Node;
  selected: boolean;
  selectMode: boolean;
  remoteUsage: RemoteUsageNode | null;
  upgradeProgress?: NodeUpgradeProgress;
  dragListeners?: React.HTMLAttributes<HTMLButtonElement>;
  handlers: NodeItemHandlers;
}) => {
  const isRemote = node.isRemote === 1;
  const expiry = getNodeExpiryMeta(node.expiryTime, node.renewalCycle);
  const highlight = !node.expiryReminderDismissed && expiry.isHighlighted;

  return (
    <Card
      className={cn(
        "group h-full gap-3 p-4",
        highlight &&
          (expiry.tone === "danger"
            ? "border-danger-line"
            : "border-warning-line"),
        selected && "border-primary-line bg-primary-soft",
      )}
    >
      <div className="flex items-start gap-2.5">
        {selectMode && (
          <Checkbox
            aria-label={`选择 ${node.name}`}
            className="mt-0.5"
            isSelected={selected}
            onValueChange={() => handlers.onToggleSelect(node.id)}
          />
        )}
        <NodeIdentity node={node} />
        {dragListeners && <DragHandle {...dragListeners} />}
      </div>

      <NodeTags node={node} />

      {isRemote && node.syncError && (
        <p className="rounded-md bg-warning-soft px-2.5 py-1.5 text-xs text-warning-ink">
          {getRemoteSyncErrorMessage(node.syncError)}
        </p>
      )}

      <UpgradeProgressBar progress={upgradeProgress} />

      {isRemote ? (
        <RemoteUsagePanel handlers={handlers} node={node} usage={remoteUsage} />
      ) : (
        <div className="space-y-3">
          <NodeMetrics node={node} />
          {isOnline(node) && node.systemInfo && (
            <NodeTraffic handlers={handlers} node={node} />
          )}
        </div>
      )}

      <div className="mt-auto flex items-center gap-1.5 border-t border-divider pt-3">
        {!isRemote && (
          <>
            <Button
              isLoading={node.copyLoading}
              size="sm"
              startContent={<Terminal size={14} />}
              variant="light"
              onPress={() => handlers.onInstall(node)}
            >
              安装
            </Button>
            <Button
              isDisabled={!isOnline(node)}
              isLoading={node.upgradeLoading}
              size="sm"
              startContent={<CircleArrowUp size={14} />}
              variant="light"
              onPress={() => handlers.onUpgrade(node)}
            >
              升级
            </Button>
            <Button
              size="sm"
              startContent={<SquarePen size={14} />}
              variant="light"
              onPress={() => handlers.onEdit(node)}
            >
              编辑
            </Button>
          </>
        )}
        <div className="ml-auto">
          <NodeMoreMenu handlers={handlers} node={node} />
        </div>
      </div>
    </Card>
  );
};

export const NodeListHeader = ({
  isAllSelected,
  isIndeterminate,
  onToggleAll,
}: {
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleAll: (selected: boolean) => void;
}) => (
  <div className="node-list-head" role="presentation">
    <div className="node-row-lead">
      <Checkbox
        aria-label="全选"
        isIndeterminate={isIndeterminate}
        isSelected={isAllSelected}
        onValueChange={onToggleAll}
      />
    </div>
    <div className="node-row-name">节点</div>
    <div className="node-row-metrics">资源</div>
    <div className="node-row-traffic">实时</div>
    <div className="node-row-actions">操作</div>
  </div>
);

export const NodeRow = ({
  node,
  selected,
  handlers,
}: {
  node: Node;
  selected: boolean;
  handlers: NodeItemHandlers;
}) => {
  const isRemote = node.isRemote === 1;

  return (
    <div className="node-row" data-selected={selected || undefined}>
      <div className="node-row-lead">
        <Checkbox
          aria-label={`选择 ${node.name}`}
          isSelected={selected}
          onValueChange={() => handlers.onToggleSelect(node.id)}
        />
      </div>
      <div className="node-row-name min-w-0">
        <NodeIdentity node={node} />
        <div className="mt-1">
          <NodeTags node={node} />
        </div>
      </div>
      <div className="node-row-metrics">
        {isRemote ? (
          <span className="text-xs text-default-500">远程节点</span>
        ) : (
          <NodeMetrics node={node} />
        )}
      </div>
      <div className="node-row-traffic">
        <NodeTraffic handlers={handlers} node={node} showUptime={false} />
      </div>
      <div className="node-row-actions">
        {!isRemote && (
          <>
            <Tooltip label="安装命令">
              <ActionIcon
                aria-label="安装命令"
                color="gray"
                loading={node.copyLoading}
                variant="subtle"
                onClick={() => handlers.onInstall(node)}
              >
                <Terminal size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="升级">
              <ActionIcon
                aria-label="升级节点"
                color="gray"
                disabled={!isOnline(node)}
                loading={node.upgradeLoading}
                variant="subtle"
                onClick={() => handlers.onUpgrade(node)}
              >
                <CircleArrowUp size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="编辑">
              <ActionIcon
                aria-label="编辑节点"
                color="gray"
                variant="subtle"
                onClick={() => handlers.onEdit(node)}
              >
                <SquarePen size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        )}
        <NodeMoreMenu handlers={handlers} node={node} />
      </div>
    </div>
  );
};
