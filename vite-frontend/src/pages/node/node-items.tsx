import type { ReactNode } from "react";

import {
  ActionIcon,
  Menu,
  Progress,
  Tooltip,
  Badge,
  Checkbox,
} from "@mantine/core";
import {
  ArrowDown,
  ArrowUp,
  BellOff,
  CircleArrowUp,
  Ellipsis,
  GripVertical,
  RotateCcw,
  SquarePen,
  Terminal,
  Trash2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
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

const hasMetrics = (node: Node) => isOnline(node) && Boolean(node.systemInfo);

const reminderEnabled = (node: Node) =>
  Boolean(
    node.expiryTime &&
      node.expiryTime > 0 &&
      node.renewalCycle &&
      !node.expiryReminderDismissed,
  );

const clampPercent = (value?: number) => Math.max(0, Math.min(100, value ?? 0));

const NodeStatus = ({ node }: { node: Node }) =>
  node.deleteState ? (
    <span className="status-dot" data-tone="warning">
      {node.deleteState === 3 ? "待移除" : "待清理"}
    </span>
  ) : (
    <span
      className="status-dot"
      data-tone={isOnline(node) ? "success" : undefined}
    >
      {isOnline(node) ? "在线" : "离线"}
    </span>
  );

/** Muted single line shown until a node reports live metrics. */
const MetricsPending = ({ node }: { node: Node }) => (
  <p className="node-pending" data-online={isOnline(node) || undefined}>
    {isOnline(node) ? "等待节点上报…" : "节点离线，暂无实时数据"}
  </p>
);

const MeterMetric = ({ label, value }: { label: string; value?: number }) => {
  const percent = clampPercent(value);

  return (
    <div className="node-metric">
      <div className="node-metric-line">
        <span className="node-metric-label">{label}</span>
        <span className="node-metric-value">
          {value === undefined ? "—" : `${percent.toFixed(0)}%`}
        </span>
      </div>
      <Progress
        aria-label={label}
        color={uiColor(usageTone(percent))}
        size={3}
        value={percent}
      />
    </div>
  );
};

const PairMetric = ({
  label,
  down,
  up,
  downTitle,
  upTitle,
}: {
  label: string;
  down: string;
  up: string;
  downTitle: string;
  upTitle: string;
}) => (
  <div className="node-metric">
    <div className="node-metric-line">
      <span className="node-metric-label">{label}</span>
    </div>
    <div className="node-metric-pair">
      <span title={downTitle}>
        <ArrowDown className="text-success-ink" size={11} />
        {down}
      </span>
      <span title={upTitle}>
        <ArrowUp className="text-primary-ink" size={11} />
        {up}
      </span>
    </div>
  </div>
);

/** 2×2 live metrics plus a quiet footnote (disk, connections, uptime). */
const NodeCardMetrics = ({
  node,
  handlers,
}: {
  node: Node;
  handlers: NodeItemHandlers;
}) => {
  const info = node.systemInfo;

  if (!hasMetrics(node) || !info) {
    return <MetricsPending node={node} />;
  }
  const conns = (info.tcpConns ?? 0) + (info.udpConns ?? 0);

  return (
    <div className="node-card-metrics">
      <div className="node-metric-grid">
        <MeterMetric label="CPU" value={info.cpuUsage} />
        <MeterMetric label="内存" value={info.memoryUsage} />
        <PairMetric
          down={handlers.formatSpeed(info.netInSpeed ?? info.downloadSpeed)}
          downTitle="下载速度"
          label="网速"
          up={handlers.formatSpeed(info.netOutSpeed ?? info.uploadSpeed)}
          upTitle="上传速度"
        />
        <PairMetric
          down={handlers.formatFlow(info.downloadTraffic)}
          downTitle="累计下载"
          label="流量"
          up={handlers.formatFlow(info.uploadTraffic)}
          upTitle="累计上传"
        />
      </div>
      <p className="node-metric-foot">
        <span title="磁盘使用率">
          磁盘{" "}
          {info.diskUsage === undefined
            ? "—"
            : `${clampPercent(info.diskUsage).toFixed(0)}%`}
        </span>
        <span title="TCP + UDP 连接数">连接 {conns}</span>
        <span title="运行时长">运行 {handlers.formatUptime(info.uptime)}</span>
      </p>
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
  const reminderOn = reminderEnabled(node);

  return (
    <Menu withinPortal position="bottom-end" shadow="md" width={168}>
      <Menu.Target>
        <ActionIcon
          aria-label="更多操作"
          color="gray"
          size="md"
          variant="subtle"
        >
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

/** Install / upgrade / edit as quiet icon buttons, then the overflow menu. */
const NodeActions = ({
  node,
  handlers,
}: {
  node: Node;
  handlers: NodeItemHandlers;
}) => {
  const isRemote = node.isRemote === 1;

  return (
    <div className="node-actions">
      {!isRemote && (
        <>
          <Tooltip label="安装命令">
            <ActionIcon
              aria-label="安装命令"
              color="gray"
              loading={node.copyLoading}
              size="md"
              variant="subtle"
              onClick={() => handlers.onInstall(node)}
            >
              <Terminal size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={isOnline(node) ? "升级" : "节点离线，无法升级"}>
            <ActionIcon
              aria-label="升级节点"
              color="gray"
              disabled={!isOnline(node)}
              loading={node.upgradeLoading}
              size="md"
              variant="subtle"
              onClick={() => handlers.onUpgrade(node)}
            >
              <CircleArrowUp size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="编辑">
            <ActionIcon
              aria-label="编辑节点"
              color="gray"
              size="md"
              variant="subtle"
              onClick={() => handlers.onEdit(node)}
            >
              <SquarePen size={15} />
            </ActionIcon>
          </Tooltip>
        </>
      )}
      <NodeMoreMenu handlers={handlers} node={node} />
    </div>
  );
};

/** Renewal tag + remark, both small. */
const NodeTags = ({ node }: { node: Node }) => {
  const remark = node.remark?.trim();
  const expiry = reminderEnabled(node)
    ? getNodeExpiryMeta(node.expiryTime, node.renewalCycle)
    : null;

  if (!expiry && !remark) return null;

  return (
    <div className="node-tags">
      {expiry && (
        <Badge
          className="shrink-0"
          color={uiColor(expiry.tone)}
          size="xs"
          variant="light"
        >
          {expiry.label}
        </Badge>
      )}
      {remark && (
        <span className="node-remark" title={remark}>
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
    return <p className="node-pending">暂未获取到远程占用数据</p>;
  }
  const portTotal = Math.max(usage.portRangeEnd - usage.portRangeStart + 1, 0);

  return (
    <div className="node-remote">
      <dl className="node-remote-facts">
        <div>
          <dt>共享 ID</dt>
          <dd className="mono-value">#{usage.shareId}</dd>
        </div>
        <div>
          <dt>流量</dt>
          <dd className="mono-value">
            {handlers.formatFlow(usage.currentFlow)}
          </dd>
        </div>
        <div>
          <dt>带宽上限</dt>
          <dd className="mono-value">
            {usage.maxBandwidth > 0
              ? handlers.formatSpeed(usage.maxBandwidth)
              : "不限"}
          </dd>
        </div>
        <div>
          <dt>占用端口</dt>
          <dd className="mono-value">
            {usage.usedPorts.length}/{portTotal}
          </dd>
        </div>
      </dl>
      {(usage.remoteUrl || node.remoteUrl) && (
        <p
          className="mono-value truncate text-default-500"
          title={usage.remoteUrl || node.remoteUrl}
        >
          {usage.remoteUrl || node.remoteUrl}
        </p>
      )}
      {usage.usedPorts.length > 0 && (
        <p
          className="node-remote-ports mono-value"
          title={usage.usedPorts.join(", ")}
        >
          {usage.usedPorts.join(" ")}
        </p>
      )}
      <div>
        <p className="node-remote-caption">
          绑定明细 · {usage.activeBindingNum}
        </p>
        {usage.bindings.length > 0 ? (
          <ul className="node-remote-bindings">
            {usage.bindings.map((binding) => (
              <li key={binding.bindingId}>
                <span className="min-w-0 truncate" title={binding.tunnelName}>
                  <span className="text-foreground">{binding.tunnelName}</span>
                  <span className="ml-1.5 text-default-500">
                    {handlers.formatChainType(
                      binding.chainType,
                      binding.hopInx,
                    )}
                  </span>
                </span>
                <span className="mono-value shrink-0 text-default-500">
                  :{binding.allocatedPort}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-default-400">暂无绑定明细</p>
        )}
      </div>
    </div>
  );
};

const DragHandle = (props: React.HTMLAttributes<HTMLButtonElement>) => (
  <button
    aria-label="拖拽排序"
    className="node-drag-handle"
    title="拖拽排序"
    type="button"
    {...props}
  >
    <GripVertical size={14} />
  </button>
);

/** Address list (monospace) followed by the agent version. */
const NodeAddressLine = ({ node }: { node: Node }) => {
  const addresses = nodeAddresses(node);

  return (
    <p className="node-address" title={addresses.join(" / ")}>
      <span className="mono-value">{addresses.join(" · ") || "-"}</span>
      {node.isRemote !== 1 && node.version ? (
        <span className="node-version">
          {/^\d/.test(node.version) ? `v${node.version}` : node.version}
        </span>
      ) : null}
    </p>
  );
};

const UpgradeProgressBar = ({
  progress,
}: {
  progress?: NodeUpgradeProgress;
}) =>
  progress && progress.percent < 100 ? (
    <div className="node-upgrade">
      <div className="node-metric-line">
        <span className="truncate text-default-500">
          {progress.message || "正在升级"}
        </span>
        <span className="node-metric-value">
          {Math.round(progress.percent)}%
        </span>
      </div>
      <Progress
        aria-label="升级进度"
        color="orange"
        size={3}
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
        "node-card group",
        highlight &&
          (expiry.tone === "danger"
            ? "border-danger-line"
            : "border-warning-line"),
        selected && "border-primary-line bg-primary-soft",
      )}
      data-selected={selected || undefined}
    >
      <div className="node-card-head">
        {selectMode && (
          <Checkbox
            aria-label={`选择 ${node.name}`}
            checked={selected}
            className="mt-px"
            size="xs"
            onChange={() => handlers.onToggleSelect(node.id)}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <h3 className="node-name" title={node.name}>
              {node.name}
            </h3>
            <NodeStatus node={node} />
          </div>
          <NodeAddressLine node={node} />
        </div>
        {dragListeners && <DragHandle {...dragListeners} />}
      </div>

      <NodeTags node={node} />

      {isRemote && node.syncError && (
        <p className="node-sync-error">
          {getRemoteSyncErrorMessage(node.syncError)}
        </p>
      )}

      <UpgradeProgressBar progress={upgradeProgress} />

      {isRemote ? (
        <RemoteUsagePanel handlers={handlers} node={node} usage={remoteUsage} />
      ) : (
        <NodeCardMetrics handlers={handlers} node={node} />
      )}

      <div className="node-card-foot">
        <NodeActions handlers={handlers} node={node} />
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
    <div className="node-cell-lead">
      <Checkbox
        aria-label="全选"
        checked={isAllSelected}
        indeterminate={isIndeterminate}
        size="xs"
        onChange={(event) => onToggleAll(event.currentTarget.checked)}
      />
    </div>
    <div className="node-cell-name">节点</div>
    <div className="node-cell-status">状态</div>
    <div className="node-cell-cpu">CPU</div>
    <div className="node-cell-mem">内存</div>
    <div className="node-cell-net">网速</div>
    <div className="node-cell-meta">续费 / 备注</div>
    <div className="node-cell-actions">操作</div>
  </div>
);

const InlineMeter = ({ label, value }: { label: string; value?: number }) => {
  const percent = clampPercent(value);

  return (
    <div className="node-inline-meter">
      <span className="node-metric-value">{percent.toFixed(0)}%</span>
      <Progress
        aria-label={label}
        className="flex-1"
        color={uiColor(usageTone(percent))}
        size={3}
        value={percent}
      />
    </div>
  );
};

const Dash = (): ReactNode => <span className="text-default-400">—</span>;

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
  const info = hasMetrics(node) ? node.systemInfo : null;
  const down = info
    ? handlers.formatSpeed(info.netInSpeed ?? info.downloadSpeed)
    : "";
  const up = info
    ? handlers.formatSpeed(info.netOutSpeed ?? info.uploadSpeed)
    : "";

  return (
    <div className="node-row" data-selected={selected || undefined}>
      <div className="node-cell-lead">
        <Checkbox
          aria-label={`选择 ${node.name}`}
          checked={selected}
          size="xs"
          onChange={() => handlers.onToggleSelect(node.id)}
        />
      </div>
      <div className="node-cell-name">
        <span className="node-name" title={node.name}>
          {node.name}
        </span>
        <NodeAddressLine node={node} />
      </div>
      <div className="node-cell-status">
        <NodeStatus node={node} />
      </div>
      <div className="node-cell-cpu">
        {info ? <InlineMeter label="CPU" value={info.cpuUsage} /> : <Dash />}
      </div>
      <div className="node-cell-mem">
        {info ? (
          <InlineMeter label="内存" value={info.memoryUsage} />
        ) : (
          <Dash />
        )}
      </div>
      <div className="node-cell-net">
        {info ? (
          <span className="node-metric-pair">
            <span title="下载速度">
              <ArrowDown className="text-success-ink" size={11} />
              {down}
            </span>
            <span title="上传速度">
              <ArrowUp className="text-primary-ink" size={11} />
              {up}
            </span>
          </span>
        ) : isRemote ? (
          <span className="text-xs text-default-500">远程节点</span>
        ) : (
          <Dash />
        )}
      </div>
      <div
        className="node-cell-meta"
        data-empty={
          !node.remark?.trim() && !reminderEnabled(node) ? "" : undefined
        }
      >
        {node.remark?.trim() || reminderEnabled(node) ? (
          <NodeTags node={node} />
        ) : (
          <Dash />
        )}
      </div>
      {/* Compact one-line summary used when the list is too narrow for columns. */}
      <div className="node-cell-summary">
        {info ? (
          <>
            <span>CPU {clampPercent(info.cpuUsage).toFixed(0)}%</span>
            <span>内存 {clampPercent(info.memoryUsage).toFixed(0)}%</span>
            <span>
              ↓ {down} ↑ {up}
            </span>
          </>
        ) : (
          <span>
            {isRemote
              ? "远程节点"
              : isOnline(node)
                ? "等待节点上报…"
                : "暂无实时数据"}
          </span>
        )}
      </div>
      <div className="node-cell-actions">
        <NodeActions handlers={handlers} node={node} />
      </div>
    </div>
  );
};
