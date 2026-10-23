import type { BatchOperationFailure, ForwardApiItem } from "@/api/types";

import {
  ArrowRight,
  ChevronDown,
  Copy,
  Ellipsis,
  GripVertical,
  Network,
  RotateCcw,
  SquarePen,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { type SemanticColor } from "@/components/ui/shared";
import { cn } from "@/lib/utils";
import { addressPreview } from "@/pages/forward/address";

export interface Forward {
  id: number;
  name: string;
  forwardMode?: "agent" | "nftables";
  tunnelId: number;
  tunnelName: string;
  tunnelTrafficRatio?: number;
  inIp: string;
  inPort: number;
  remoteAddr: string;
  interfaceName?: string;
  strategy: string;
  status: number;
  inFlow: number;
  outFlow: number;
  serviceRunning: boolean;
  federationShareFlow?: number;
  maxConn?: number;
  createdTime: string;
  userName?: string;
  userId?: number;
  inx?: number;
  speedId?: number | null;
  ipMaxConn?: number;
  ipSpeedId?: number | null;
  ipSpeedLimitName?: string;
  proxyProtocol?: number;
  proxyProtocolReceive?: number;
  proxyProtocolSend?: number;
}

export interface Tunnel {
  id: number;
  name: string;
  forwardMode?: "agent" | "nftables";
  type?: number;
  inIp?: string;
  inNodeId?: Array<{ nodeId: number }>;
  inNodePortSta?: number;
  inNodePortEnd?: number;
  portRangeMin?: number;
  portRangeMax?: number;
}

export interface Node {
  id: number;
  name?: string;
  serverIp?: string;
  serverIpV4?: string;
  serverIpV6?: string;
  extraIPs?: string;
}

export interface ForwardForm {
  id?: number;
  userId?: number;
  name: string;
  tunnelId: number | null;
  inPort: number | null;
  inIp: string;
  remoteAddr: string;
  interfaceName?: string;
  strategy: string;
  speedId: number | null;
  ipMaxConn?: number;
  ipSpeedId: number | null;
  maxConn?: number;
  proxyProtocol?: number;
  proxyProtocolReceive?: number;
  proxyProtocolSend?: number;
}

export interface ForwardUserGroup {
  userId: number;
  userName: string;
  tunnels: ForwardTunnelGroup[];
}

export interface ForwardTunnelGroup {
  tunnelKey: string;
  tunnelName: string;
  tunnelTrafficRatio?: number;
  items: Forward[];
}

export interface BatchProgressState {
  active: boolean;
  label: string;
  percent: number;
}

export interface BatchResultModalState {
  failures: BatchOperationFailure[];
  open: boolean;
  summary: string;
  title: string;
}

export const EMPTY_BATCH_RESULT_MODAL_STATE: BatchResultModalState = {
  failures: [],
  open: false,
  summary: "",
  title: "",
};

export type ForwardGroupOrderMap = Record<string, string[]>;

export type ForwardGroupCollapsedMap = Record<string, boolean>;

export const UNKNOWN_FORWARD_USER_NAME = "未知用户";

export const UNCATEGORIZED_FORWARD_TUNNEL_NAME = "未分类";

export const FORWARD_COMPACT_MODE_CONFIG_KEY = "forward_compact_mode";

export const FORWARD_COMPACT_MODE_EVENT = "forwardCompactModeChanged";

export const FORWARD_GROUP_ORDER_CONFIG_KEY = "forward_group_order_map";

export const FORWARD_GROUP_COLLAPSED_CONFIG_KEY = "forward_group_collapsed_map";

export const FORWARD_GROUP_ORDER_LOCAL_STORAGE_PREFIX = "forward-group-order";

export const FORWARD_GROUP_COLLAPSED_LOCAL_STORAGE_PREFIX =
  "forward-group-collapsed";

export const FORWARD_TUNNEL_GROUP_SORTABLE_PREFIX = "forward-tunnel-group";

export const FORWARD_CARD_GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-4";

export const normalizeForwardUserName = (userName?: string): string => {
  const normalized = (userName || UNKNOWN_FORWARD_USER_NAME).trim();

  return normalized || UNKNOWN_FORWARD_USER_NAME;
};

export const compareForwardUserNameAsc = (a: string, b: string): number => {
  return a.localeCompare(b, "en", {
    sensitivity: "base",
    numeric: true,
  });
};

export const normalizeForwardTunnelName = (tunnelName?: string): string => {
  const normalized = (tunnelName || "").trim();

  return normalized || UNCATEGORIZED_FORWARD_TUNNEL_NAME;
};

export const buildForwardTunnelGroupKey = (tunnelName?: string): string => {
  const normalized = normalizeForwardTunnelName(tunnelName);

  if (normalized === UNCATEGORIZED_FORWARD_TUNNEL_NAME) {
    return "__uncategorized__";
  }

  return normalized.toLocaleLowerCase();
};

export const compareForwardTunnelNameAsc = (a: string, b: string): number => {
  return a.localeCompare(b, "en", {
    sensitivity: "base",
    numeric: true,
  });
};

export const compareForwardTunnelGroupKeyAsc = (
  a: string,
  b: string,
): number => {
  const aIsUncategorized = a === "__uncategorized__";
  const bIsUncategorized = b === "__uncategorized__";

  if (aIsUncategorized !== bIsUncategorized) {
    return aIsUncategorized ? 1 : -1;
  }

  return compareForwardTunnelNameAsc(a, b);
};

export const normalizeTunnelTrafficRatio = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 1;
};

export const formatTunnelTrafficRatio = (value?: number): string => {
  const ratio = normalizeTunnelTrafficRatio(value);

  if (Number.isInteger(ratio)) {
    return `${ratio}x`;
  }

  return `${parseFloat(ratio.toFixed(2))}x`;
};

export const buildForwardGroupOrderLocalKey = (tokenUserId: number): string => {
  return `${FORWARD_GROUP_ORDER_LOCAL_STORAGE_PREFIX}:u:${tokenUserId}`;
};

export const buildForwardGroupCollapsedLocalKey = (
  tokenUserId: number,
): string => {
  return `${FORWARD_GROUP_COLLAPSED_LOCAL_STORAGE_PREFIX}:u:${tokenUserId}`;
};

export const parsePreferenceMap = <T,>(
  raw: string | null,
): Record<string, T> | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, T>;
  } catch {
    return null;
  }
};

export const parseGroupOrderMap = (
  raw: string | null,
): ForwardGroupOrderMap => {
  const parsed = parsePreferenceMap<unknown>(raw);

  if (!parsed) {
    return {};
  }

  const result: ForwardGroupOrderMap = {};

  Object.entries(parsed).forEach(([userId, value]) => {
    if (!Array.isArray(value)) {
      return;
    }

    const keys = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item !== "");

    if (keys.length > 0) {
      result[userId] = Array.from(new Set(keys));
    }
  });

  return result;
};

export const parseGroupCollapsedMap = (
  raw: string | null,
): ForwardGroupCollapsedMap => {
  const parsed = parsePreferenceMap<unknown>(raw);

  if (!parsed) {
    return {};
  }

  const result: ForwardGroupCollapsedMap = {};

  Object.entries(parsed).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      result[key] = value;
    }
  });

  return result;
};

export const sanitizeGroupOrderMap = (
  source: ForwardGroupOrderMap,
  availableTunnelKeysByUser: Map<number, Set<string>>,
): ForwardGroupOrderMap => {
  const sanitized: ForwardGroupOrderMap = {};

  availableTunnelKeysByUser.forEach((availableKeys, userId) => {
    if (availableKeys.size === 0) {
      return;
    }

    const orderFromSource = source[userId.toString()] || [];
    const used = new Set<string>();
    const merged: string[] = [];

    orderFromSource.forEach((key) => {
      if (!availableKeys.has(key) || used.has(key)) {
        return;
      }

      used.add(key);
      merged.push(key);
    });

    Array.from(availableKeys)
      .sort(compareForwardTunnelGroupKeyAsc)
      .forEach((key) => {
        if (!used.has(key)) {
          used.add(key);
          merged.push(key);
        }
      });

    if (merged.length > 0) {
      sanitized[userId.toString()] = merged;
    }
  });

  return sanitized;
};

export const sanitizeGroupCollapsedMap = (
  source: ForwardGroupCollapsedMap,
  availableCollapseKeys: Set<string>,
): ForwardGroupCollapsedMap => {
  const sanitized: ForwardGroupCollapsedMap = {};

  availableCollapseKeys.forEach((key) => {
    if (source[key] === true) {
      sanitized[key] = true;
    }
  });

  return sanitized;
};

export const buildTunnelGroupCollapseKey = (
  userId: number,
  tunnelKey: string,
): string => {
  return `${userId}:${tunnelKey}`;
};

export const buildTunnelGroupSortableId = (
  userId: number,
  tunnelKey: string,
): string => {
  return `${FORWARD_TUNNEL_GROUP_SORTABLE_PREFIX}:${userId}:${tunnelKey}`;
};

export const parseTunnelGroupSortableId = (
  value: unknown,
): { userId: number; tunnelKey: string } | null => {
  if (typeof value !== "string") {
    return null;
  }

  if (!value.startsWith(`${FORWARD_TUNNEL_GROUP_SORTABLE_PREFIX}:`)) {
    return null;
  }

  const parts = value.split(":");

  if (parts.length < 3) {
    return null;
  }

  const userId = Number(parts[1]);
  const tunnelKey = parts.slice(2).join(":").trim();

  if (!Number.isFinite(userId) || tunnelKey === "") {
    return null;
  }

  return { userId, tunnelKey };
};

export const buildAvailableGroupData = (
  forwards: Forward[],
): {
  availableTunnelKeysByUser: Map<number, Set<string>>;
  availableCollapseKeys: Set<string>;
} => {
  const availableTunnelKeysByUser = new Map<number, Set<string>>();
  const availableCollapseKeys = new Set<string>();

  forwards.forEach((forward) => {
    const userId = forward.userId ?? 0;
    const tunnelKey = buildForwardTunnelGroupKey(forward.tunnelName);

    let set = availableTunnelKeysByUser.get(userId);

    if (!set) {
      set = new Set<string>();
      availableTunnelKeysByUser.set(userId, set);
    }

    set.add(tunnelKey);
    availableCollapseKeys.add(buildTunnelGroupCollapseKey(userId, tunnelKey));
  });

  return { availableTunnelKeysByUser, availableCollapseKeys };
};

export const isSameStringArray = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
};

export const isSameGroupOrderMap = (
  a: ForwardGroupOrderMap,
  b: ForwardGroupOrderMap,
): boolean => {
  const aKeys = Object.keys(a).sort(compareForwardTunnelNameAsc);
  const bKeys = Object.keys(b).sort(compareForwardTunnelNameAsc);

  if (!isSameStringArray(aKeys, bKeys)) {
    return false;
  }

  for (const key of aKeys) {
    if (!isSameStringArray(a[key] || [], b[key] || [])) {
      return false;
    }
  }

  return true;
};

export const isSameGroupCollapsedMap = (
  a: ForwardGroupCollapsedMap,
  b: ForwardGroupCollapsedMap,
): boolean => {
  const aKeys = Object.keys(a).sort(compareForwardTunnelNameAsc);
  const bKeys = Object.keys(b).sort(compareForwardTunnelNameAsc);

  if (!isSameStringArray(aKeys, bKeys)) {
    return false;
  }

  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
};

export const normalizeForwardItems = (items: Forward[]): Forward[] => {
  return items.map((forward) => ({
    ...forward,
    serviceRunning: forward.status === 1,
  }));
};

export const mapForwardApiItems = (items: ForwardApiItem[]): Forward[] => {
  return (items || []).map((forward) => ({
    id: forward.id,
    name: forward.name,
    tunnelId: forward.tunnelId ?? 0,
    tunnelName: forward.tunnelName || "",
    tunnelTrafficRatio: normalizeTunnelTrafficRatio(forward.tunnelTrafficRatio),
    inIp: forward.inIp || "",
    inPort: forward.inPort ?? 0,
    remoteAddr: forward.remoteAddr || "",
    strategy: typeof forward.strategy === "string" ? forward.strategy : "fifo",
    status: typeof forward.status === "number" ? forward.status : 0,
    inFlow: forward.inFlow ?? 0,
    outFlow: forward.outFlow ?? 0,
    createdTime:
      typeof forward.createdTime === "string" ? forward.createdTime : "",
    userName:
      typeof forward.userName === "string" ? forward.userName : undefined,
    userId: typeof forward.userId === "number" ? forward.userId : undefined,
    inx: typeof forward.inx === "number" ? forward.inx : undefined,
    speedId:
      typeof forward.speedId === "number" || forward.speedId === null
        ? forward.speedId
        : undefined,
    ipMaxConn:
      typeof forward.ipMaxConn === "number" ? forward.ipMaxConn : undefined,
    ipSpeedId:
      typeof forward.ipSpeedId === "number" || forward.ipSpeedId === null
        ? forward.ipSpeedId
        : undefined,
    ipSpeedLimitName:
      typeof forward.ipSpeedLimitName === "string"
        ? forward.ipSpeedLimitName
        : undefined,
    maxConn: typeof forward.maxConn === "number" ? forward.maxConn : undefined,
    proxyProtocol:
      typeof forward.proxyProtocol === "number"
        ? forward.proxyProtocol
        : undefined,
    proxyProtocolReceive:
      typeof forward.proxyProtocolReceive === "number"
        ? forward.proxyProtocolReceive
        : 0,
    proxyProtocolSend:
      typeof forward.proxyProtocolSend === "number"
        ? forward.proxyProtocolSend
        : typeof forward.proxyProtocol === "number"
          ? forward.proxyProtocol
          : 0,
    serviceRunning: forward.status === 1,
  }));
};

export interface ForwardItemHandlers {
  formatFlow: (bytes: number) => string;
  getStrategyDisplay: (strategy: string) => { color: string; text: string };
  onSelect: (id: number, selected: boolean) => void;
  onToggleService: (forward: Forward) => void;
  onEdit: (forward: Forward) => void;
  onDiagnose: (forward: Forward) => void;
  onResetFlow: (forward: Forward) => void;
  onDelete: (forward: Forward) => void;
  onAddresses: (
    addressString: string,
    port: number | null,
    title: string,
  ) => void;
  onCopyName: (name: string) => void;
}

const forwardStatus = (
  forward: Forward,
): { tone: SemanticColor; text: string } => {
  switch (forward.status) {
    case 1:
      return { tone: "success", text: "运行中" };
    case 0:
      return { tone: "warning", text: "已暂停" };
    case -1:
      return { tone: "danger", text: "异常" };
    default:
      return { tone: "default", text: "未知" };
  }
};

const hasForwardFlow = (forward: Forward) =>
  (forward.inFlow || 0) + (forward.outFlow || 0) > 0;

const useSortableStyle = (id: number | string) => {
  const sortable = useSortable({ id });
  const { transform, transition, isDragging } = sortable;
  const style: React.CSSProperties = {
    transform: transform
      ? CSS.Transform.toString({
          ...transform,
          x: Math.round(transform.x),
          y: Math.round(transform.y),
        })
      : undefined,
    transition: isDragging ? undefined : transition || undefined,
    willChange: isDragging ? "transform" : undefined,
  };

  return { ...sortable, style };
};

/** First address in mono with "+N"; a click copies it or lists all addresses. */
export const AddressPill = ({
  addressString,
  port,
  title,
  onAddresses,
}: {
  addressString: string;
  port: number | null;
  title: string;
  onAddresses: ForwardItemHandlers["onAddresses"];
}) => {
  const { first, more } = addressPreview(addressString, port);

  if (!first) {
    return <span className="text-xs text-default-400">-</span>;
  }

  return (
    <button
      className="group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-default-soft px-2 py-1 font-mono text-xs text-default-700 transition-colors hover:bg-default-soft-hover"
      title={more > 0 ? `查看全部${title}` : `复制${title}：${first}`}
      type="button"
      onClick={() => onAddresses(addressString, port, title)}
    >
      <span className="truncate">{first}</span>
      {more > 0 ? (
        <span className="shrink-0 rounded bg-primary-soft px-1 font-sans text-[10px] font-semibold text-primary-ink">
          +{more}
        </span>
      ) : (
        <Copy
          className="shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
          size={12}
        />
      )}
    </button>
  );
};

const RouteAddresses = ({
  forward,
  onAddresses,
}: {
  forward: Forward;
  onAddresses: ForwardItemHandlers["onAddresses"];
}) => (
  <>
    <AddressPill
      addressString={forward.inIp}
      port={forward.inPort}
      title="入口地址"
      onAddresses={onAddresses}
    />
    <ArrowRight className="shrink-0 text-default-400" size={14} />
    <AddressPill
      addressString={forward.remoteAddr}
      port={null}
      title="目标地址"
      onAddresses={onAddresses}
    />
  </>
);

const FlowSummary = ({
  forward,
  formatFlow,
  align = "start",
}: {
  forward: Forward;
  formatFlow: ForwardItemHandlers["formatFlow"];
  align?: "start" | "end";
}) => {
  const shared =
    !hasForwardFlow(forward) && (forward.federationShareFlow || 0) > 0;

  return (
    <div className={cn("min-w-0", align === "end" && "text-right")}>
      <p className="truncate text-sm font-medium tabular-nums text-foreground">
        {formatFlow(getForwardDisplayFlow(forward))}
      </p>
      <p className="truncate text-[11px] tabular-nums text-default-500">
        {shared
          ? "面板共享流量"
          : `↑ ${formatFlow(forward.inFlow || 0)} · ↓ ${formatFlow(forward.outFlow || 0)}`}
      </p>
    </div>
  );
};

const ServiceSwitch = ({
  forward,
  onToggleService,
}: {
  forward: Forward;
  onToggleService: ForwardItemHandlers["onToggleService"];
}) => (
  <Tooltip
    label={forward.serviceRunning ? "运行中，点击暂停" : "已暂停，点击启用"}
  >
    <span className="inline-flex">
      <Switch
        aria-label={forward.serviceRunning ? "暂停规则" : "启用规则"}
        color="success"
        isDisabled={forward.status !== 1 && forward.status !== 0}
        isSelected={forward.serviceRunning}
        size="sm"
        onValueChange={() => onToggleService(forward)}
      />
    </span>
  </Tooltip>
);

const ForwardActions = ({
  forward,
  handlers,
}: {
  forward: Forward;
  handlers: ForwardItemHandlers;
}) => (
  <>
    <Tooltip label="编辑">
      <ActionIcon
        aria-label="编辑规则"
        color="gray"
        variant="subtle"
        onClick={() => handlers.onEdit(forward)}
      >
        <SquarePen size={16} />
      </ActionIcon>
    </Tooltip>
    <Tooltip label="诊断">
      <ActionIcon
        aria-label="诊断规则"
        color="gray"
        variant="subtle"
        onClick={() => handlers.onDiagnose(forward)}
      >
        <Stethoscope size={16} />
      </ActionIcon>
    </Tooltip>
    <Menu withinPortal position="bottom-end" shadow="md" width={160}>
      <Menu.Target>
        <ActionIcon aria-label="更多操作" color="gray" variant="subtle">
          <Ellipsis size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          disabled={!hasForwardFlow(forward)}
          leftSection={<RotateCcw size={14} />}
          onClick={() => handlers.onResetFlow(forward)}
        >
          流量清零
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<Trash2 size={14} />}
          onClick={() => handlers.onDelete(forward)}
        >
          删除规则
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  </>
);

const DragHandle = (props: React.HTMLAttributes<HTMLButtonElement>) => (
  <button
    aria-label="拖拽排序"
    className="forward-drag-handle"
    title="拖拽排序"
    type="button"
    {...props}
  >
    <GripVertical size={15} />
  </button>
);

/** Column labels for the responsive rule list (shown once the list is wide enough). */
export const ForwardListHeader = ({
  isAllSelected,
  isIndeterminate,
  onToggleAll,
}: {
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleAll: (selected: boolean) => void;
}) => (
  <div className="forward-list-head" role="presentation">
    <div className="forward-row-lead">
      <Checkbox
        aria-label="全选"
        isIndeterminate={isIndeterminate}
        isSelected={isAllSelected}
        onValueChange={onToggleAll}
      />
    </div>
    <div className="forward-row-name">规则</div>
    <div className="forward-row-route">入口 → 目标</div>
    <div className="forward-row-flow">流量</div>
    <div className="forward-row-status">状态</div>
    <div className="forward-row-actions">操作</div>
  </div>
);

export const SortableForwardRow = ({
  forward,
  selected,
  showTunnel,
  handlers,
}: {
  forward: Forward;
  selected: boolean;
  showTunnel?: boolean;
  handlers: ForwardItemHandlers;
}) => {
  const { attributes, listeners, setNodeRef, isDragging, style } =
    useSortableStyle(forward.id);
  const strategy = handlers.getStrategyDisplay(forward.strategy);
  const status = forwardStatus(forward);
  const ratio = normalizeTunnelTrafficRatio(forward.tunnelTrafficRatio);

  return (
    <div
      ref={setNodeRef}
      className="forward-row"
      data-dragging={isDragging || undefined}
      data-selected={selected || undefined}
      style={style}
    >
      <div className="forward-row-lead">
        <Checkbox
          aria-label={`选择 ${forward.name}`}
          isSelected={selected}
          onValueChange={(checked) => handlers.onSelect(forward.id, checked)}
        />
        <DragHandle {...attributes} {...listeners} />
      </div>
      <div className="forward-row-name">
        <button
          className="block max-w-full truncate text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
          title="复制规则名"
          type="button"
          onClick={() => handlers.onCopyName(forward.name)}
        >
          {forward.name}
        </button>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <Chip color={strategy.color as SemanticColor} size="xs">
            {strategy.text}
          </Chip>
          {forward.status === -1 && (
            <Chip dot color={status.tone} size="xs">
              {status.text}
            </Chip>
          )}
          {showTunnel && (
            <span className="truncate text-xs text-default-500">
              {forward.tunnelName}
              {ratio !== 1 ? ` · ${formatTunnelTrafficRatio(ratio)}` : ""}
            </span>
          )}
        </div>
      </div>
      <div className="forward-row-route">
        <RouteAddresses forward={forward} onAddresses={handlers.onAddresses} />
      </div>
      <div className="forward-row-flow">
        <FlowSummary formatFlow={handlers.formatFlow} forward={forward} />
      </div>
      <div className="forward-row-status">
        <ServiceSwitch
          forward={forward}
          onToggleService={handlers.onToggleService}
        />
      </div>
      <div className="forward-row-actions">
        <ForwardActions forward={forward} handlers={handlers} />
      </div>
    </div>
  );
};

export const ForwardCard = ({
  forward,
  selected,
  dragListeners,
  handlers,
}: {
  forward: Forward;
  selected: boolean;
  dragListeners?: React.HTMLAttributes<HTMLButtonElement>;
  handlers: ForwardItemHandlers;
}) => {
  const strategy = handlers.getStrategyDisplay(forward.strategy);
  const status = forwardStatus(forward);

  return (
    <Card
      className={cn(
        "h-full gap-4 p-4 transition-shadow hover:shadow-sm",
        selected && "border-primary-line bg-primary-soft",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Checkbox
          aria-label={`选择 ${forward.name}`}
          className="mt-0.5"
          isSelected={selected}
          onValueChange={(checked) => handlers.onSelect(forward.id, checked)}
        />
        <div className="min-w-0 flex-1">
          <button
            className="block max-w-full truncate text-left text-sm font-semibold text-foreground transition-colors hover:text-primary"
            title={`复制规则名：${forward.name}`}
            type="button"
            onClick={() => handlers.onCopyName(forward.name)}
          >
            {forward.name}
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip dot color={status.tone} size="xs">
              {status.text}
            </Chip>
            <Chip color={strategy.color as SemanticColor} size="xs">
              {strategy.text}
            </Chip>
          </div>
        </div>
        <ServiceSwitch
          forward={forward}
          onToggleService={handlers.onToggleService}
        />
        {dragListeners && <DragHandle {...dragListeners} />}
      </div>

      <dl className="space-y-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <dt className="w-8 shrink-0 text-default-500">入口</dt>
          <dd className="min-w-0">
            <AddressPill
              addressString={forward.inIp}
              port={forward.inPort}
              title="入口地址"
              onAddresses={handlers.onAddresses}
            />
          </dd>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <dt className="w-8 shrink-0 text-default-500">目标</dt>
          <dd className="min-w-0">
            <AddressPill
              addressString={forward.remoteAddr}
              port={null}
              title="目标地址"
              onAddresses={handlers.onAddresses}
            />
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-divider pt-3">
        <FlowSummary formatFlow={handlers.formatFlow} forward={forward} />
        <div className="flex shrink-0 items-center">
          <ForwardActions forward={forward} handlers={handlers} />
        </div>
      </div>
    </Card>
  );
};

export const SortableTunnelGroupContainer = ({
  groupUserId,
  tunnel,
  collapsed,
  onToggleCollapsed,
  children,
}: {
  groupUserId: number;
  tunnel: ForwardTunnelGroup;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  children: React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, isDragging, style } =
    useSortableStyle(buildTunnelGroupSortableId(groupUserId, tunnel.tunnelKey));
  const ratio = normalizeTunnelTrafficRatio(tunnel.tunnelTrafficRatio);

  return (
    <section
      ref={setNodeRef}
      className="forward-group"
      data-dragging={isDragging || undefined}
      style={style}
    >
      <div
        className="forward-group-head"
        data-collapsed={collapsed || undefined}
      >
        <button
          aria-expanded={!collapsed}
          className="flex min-w-0 items-center gap-2 text-left"
          type="button"
          onClick={onToggleCollapsed}
        >
          <ChevronDown
            className={cn(
              "shrink-0 text-default-500 transition-transform",
              collapsed && "-rotate-90",
            )}
            size={16}
          />
          <Network className="shrink-0 text-primary" size={15} />
          <span className="truncate text-sm font-semibold text-foreground">
            {tunnel.tunnelName}
          </span>
          {ratio !== 1 && (
            <Chip color="success" size="xs" title="流量倍率">
              {formatTunnelTrafficRatio(ratio)}
            </Chip>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs text-default-500">
            {tunnel.items.length} 条
          </span>
          <button
            aria-label="拖拽分组排序"
            className="forward-drag-handle"
            title="拖拽分组排序"
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={15} />
          </button>
        </div>
      </div>
      {!collapsed && children}
    </section>
  );
};

export const SortableForwardCard = ({
  forward,
  renderCard,
}: {
  forward: Forward;
  renderCard: (
    forward: Forward,
    listeners?: React.HTMLAttributes<HTMLButtonElement>,
  ) => React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, isDragging, style } =
    useSortableStyle(forward.id);

  return (
    <div
      ref={setNodeRef}
      className="h-full"
      style={{ ...style, opacity: isDragging ? 0.6 : 1 }}
      {...attributes}
    >
      {renderCard(
        forward,
        listeners as React.HTMLAttributes<HTMLButtonElement>,
      )}
    </div>
  );
};

export const getForwardDisplayFlow = (forward: Forward): number => {
  const directFlow = (forward.inFlow || 0) + (forward.outFlow || 0);

  if (directFlow > 0) {
    return directFlow;
  }

  return forward.federationShareFlow || 0;
};
