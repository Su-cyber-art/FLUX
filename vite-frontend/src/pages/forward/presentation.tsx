import type { BatchOperationFailure, ForwardApiItem } from "@/api/types";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

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

export const FORWARD_GROUPED_TABLE_MIN_WIDTH_CLASS = "min-w-[1320px]";

export const FORWARD_GROUPED_TABLE_COLUMN_CLASS = {
  select: "w-14",
  drag: "w-10 pl-4",
  name: "w-[200px]",
  inbound: "w-[280px]",
  target: "w-[280px]",
  strategy: "w-[100px]",
  totalFlow: "w-[120px]",
  status: "w-[100px]",
  actions: "w-[176px] text-right",
} as const;

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

export const SortableTunnelGroupContainer = ({
  groupUserId,
  tunnel,
  collapsed,
  onToggleCollapsed,
  wrapperClassName,
  headerClassName,
  titleClassName,
  countClassName,
  bodyClassName,
  children,
}: {
  groupUserId: number;
  tunnel: ForwardTunnelGroup;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  wrapperClassName: string;
  headerClassName: string;
  titleClassName: string;
  countClassName: string;
  bodyClassName: string;
  children: React.ReactNode;
}) => {
  const sortableId = buildTunnelGroupSortableId(groupUserId, tunnel.tunnelKey);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const style: React.CSSProperties = {
    transform: transform
      ? CSS.Transform.toString({
          ...transform,
          x: Math.round(transform.x),
          y: Math.round(transform.y),
        })
      : undefined,
    transition: isDragging ? undefined : transition || undefined,
    opacity: isDragging ? 0.55 : 1,
    willChange: isDragging ? "transform" : undefined,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} className={wrapperClassName} style={style}>
      <div className={headerClassName}>
        <div className="flex items-center gap-2 min-w-0">
          <Button
            isIconOnly
            aria-label={collapsed ? "展开分组" : "折叠分组"}
            className="h-7 w-7"
            size="sm"
            variant="light"
            onPress={onToggleCollapsed}
          >
            <svg
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </Button>
          {/* 倍率 */}
          <span className={titleClassName}>{tunnel.tunnelName}</span>
          <span className="text-default-500 font-semibold text-[10px] mr-1.5">
            [{formatTunnelTrafficRatio(tunnel.tunnelTrafficRatio)}]
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={countClassName}>{tunnel.items.length} 条规则</span>
          <div
            className="cursor-grab active:cursor-grabbing p-1 text-default-400 hover:text-default-600 transition-colors"
            title="拖拽分组排序"
            {...attributes}
            {...listeners}
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M7 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 2zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 8zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 14zm6-8a2 2 0 1 1-.001-4.001A2 2 0 0 1 13 6zm0 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 8zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 14z" />
            </svg>
          </div>
        </div>
      </div>
      {!collapsed && <div className={bodyClassName}>{children}</div>}
    </div>
  );
};

export const SortableForwardCard = ({ forward, renderCard }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: forward.id });

  const style: React.CSSProperties = {
    transform: transform
      ? CSS.Transform.toString({
          ...transform,
          x: Math.round(transform.x),
          y: Math.round(transform.y),
        })
      : undefined,
    transition: isDragging ? undefined : transition || undefined,
    opacity: isDragging ? 0.5 : 1,
    willChange: isDragging ? "transform" : undefined,
  };

  return (
    <div ref={setNodeRef} className="h-full" style={style} {...attributes}>
      {renderCard(forward, listeners)}
    </div>
  );
};

export const SortableTableRow = ({
  copyToClipboard,
  forward,
  selectedIds,
  toggleSelect,
  getStrategyDisplay,
  formatInAddress,
  formatRemoteAddress,
  handleServiceToggle,
  handleEdit,
  handleDelete,
  handleDiagnose,
  handleResetFlow,
  showAddressModal,
  formatFlow,
}: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: forward.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    willChange: "transform",
    backgroundColor: isDragging ? "var(--default-100)" : undefined,
  };

  const strategyDisplay = getStrategyDisplay(forward.strategy);

  return (
    <TableRow key={forward.id} ref={setNodeRef} style={style}>
      {true && (
        <TableCell className={FORWARD_GROUPED_TABLE_COLUMN_CLASS.select}>
          <Checkbox
            isSelected={selectedIds.has(forward.id)}
            onValueChange={(checked) => toggleSelect(forward.id, checked)}
          />
        </TableCell>
      )}
      <TableCell className={FORWARD_GROUPED_TABLE_COLUMN_CLASS.drag}>
        <div
          className="cursor-grab active:cursor-grabbing p-1 text-default-400 hover:text-default-600 transition-colors"
          {...attributes}
          {...listeners}
          title="拖拽排序"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M7 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 2zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 8zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 14zm6-8a2 2 0 1 1-.001-4.001A2 2 0 0 1 13 6zm0 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 8zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 14z" />
          </svg>
        </div>
      </TableCell>
      <TableCell
        className={`${FORWARD_GROUPED_TABLE_COLUMN_CLASS.name} whitespace-nowrap text-foreground cursor-pointer hover:text-primary transition-colors`}
        onClick={() => copyToClipboard(forward.name, "规则名")}
      >
        {forward.name}
      </TableCell>
      <TableCell
        className={`${FORWARD_GROUPED_TABLE_COLUMN_CLASS.inbound} max-w-[280px]`}
      >
        <button
          className="w-full truncate rounded-md bg-default-100/50 px-2.5 py-1.5 text-left font-mono text-xs font-medium text-default-700 transition-all hover:bg-default-200 hover:shadow-sm cursor-pointer"
          title={formatInAddress(forward.inIp, forward.inPort)}
          type="button"
          onClick={() =>
            showAddressModal(forward.inIp, forward.inPort, "入口端口")
          }
        >
          {formatInAddress(forward.inIp, forward.inPort)}
        </button>
      </TableCell>
      <TableCell
        className={`${FORWARD_GROUPED_TABLE_COLUMN_CLASS.target} max-w-[280px]`}
      >
        <button
          className="w-full truncate rounded-md bg-default-100/50 px-2.5 py-1.5 text-left font-mono text-xs font-medium text-default-700 transition-all hover:bg-default-200 hover:shadow-sm cursor-pointer"
          title={formatRemoteAddress(forward.remoteAddr)}
          type="button"
          onClick={() => showAddressModal(forward.remoteAddr, null, "目标地址")}
        >
          {formatRemoteAddress(forward.remoteAddr)}
        </button>
      </TableCell>
      <TableCell className={FORWARD_GROUPED_TABLE_COLUMN_CLASS.strategy}>
        <Chip
          className="text-xs font-medium shrink-0 whitespace-nowrap"
          color={strategyDisplay.color as any}
          size="sm"
          variant="flat"
        >
          {strategyDisplay.text}
        </Chip>
      </TableCell>
      <TableCell
        className={`${FORWARD_GROUPED_TABLE_COLUMN_CLASS.totalFlow} whitespace-nowrap`}
      >
        <span className="text-sm font-medium text-default-600 font-mono">
          {formatFlow(getForwardDisplayFlow(forward))}
        </span>
      </TableCell>
      <TableCell className={FORWARD_GROUPED_TABLE_COLUMN_CLASS.status}>
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <Switch
            color="success"
            isDisabled={forward.status !== 1 && forward.status !== 0}
            isSelected={forward.serviceRunning}
            size="sm"
            onValueChange={() => handleServiceToggle(forward)}
          />
        </div>
      </TableCell>
      <TableCell className={FORWARD_GROUPED_TABLE_COLUMN_CLASS.actions}>
        <div className="flex justify-start gap-2 pl-2">
          <Button
            isIconOnly
            className="bg-primary/10 text-primary hover:bg-primary/20"
            size="sm"
            title="编辑"
            onPress={() => handleEdit(forward)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </Button>
          <Button
            isIconOnly
            className="bg-warning/10 text-warning hover:bg-warning/20"
            size="sm"
            title="诊断"
            onPress={() => handleDiagnose(forward)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </Button>
          <Button
            isIconOnly
            className="bg-secondary/10 text-secondary hover:bg-secondary/20"
            isDisabled={(forward.inFlow || 0) + (forward.outFlow || 0) <= 0}
            size="sm"
            title="流量清零"
            onPress={() => handleResetFlow(forward)}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-13.657-3.657L4 8m16 8-2.343 2.657A8 8 0 014 15"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </Button>
          <Button
            isIconOnly
            className="bg-danger/10 text-danger hover:bg-danger/20"
            size="sm"
            title="删除"
            onPress={() => handleDelete(forward)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export const SortableCompactTableRow = ({
  copyToClipboard,
  forward,
  selectedIds,
  toggleSelect,
  getStrategyDisplay,
  formatInAddress,
  formatRemoteAddress,
  handleServiceToggle,
  handleEdit,
  handleDelete,
  handleDiagnose,
  handleResetFlow,
  showAddressModal,
  hasMultipleAddresses,
  formatFlow,
}: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: forward.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    willChange: "transform",
    backgroundColor: isDragging ? "var(--default-100)" : undefined,
  };

  const strategyDisplay = getStrategyDisplay(forward.strategy);

  return (
    <TableRow key={forward.id} ref={setNodeRef} style={style}>
      {true && (
        <TableCell>
          <Checkbox
            isSelected={selectedIds.has(forward.id)}
            onValueChange={(checked) => toggleSelect(forward.id, checked)}
          />
        </TableCell>
      )}
      <TableCell
        className={`${selectedIds.has(forward.id) ? "bg-primary-50/70 dark:bg-primary-900/40" : ""}`}
      >
        <div
          className="cursor-grab active:cursor-grabbing p-1 text-default-400 hover:text-default-600 transition-colors"
          {...attributes}
          {...listeners}
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M7 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 2zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 8zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 14zm6-8a2 2 0 1 1-.001-4.001A2 2 0 0 1 13 6zm0 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 8zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 14z" />
          </svg>
        </div>
      </TableCell>
      <TableCell
        className={`whitespace-nowrap text-foreground ${selectedIds.has(forward.id) ? "bg-primary-50/70 dark:bg-primary-900/40" : ""}`}
      >
        <button
          className="cursor-pointer hover:text-primary transition-colors text-left bg-transparent border-none p-0 outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded-sm"
          type="button"
          onClick={() => copyToClipboard(forward.name, "规则名")}
        >
          {forward.name}
        </button>
      </TableCell>
      <TableCell
        className={`whitespace-nowrap ${selectedIds.has(forward.id) ? "bg-primary-50/70 dark:bg-primary-900/40" : ""}`}
      >
        <div className="flex items-center">
          <span className="font-medium text-default-700 text-sm">
            {forward.tunnelName}
          </span>
          {forward.tunnelTrafficRatio !== undefined &&
            normalizeTunnelTrafficRatio(forward.tunnelTrafficRatio) !== 1 && (
              <span className="text-success font-bold text-[12px] ml-1.5 border border-success/30 rounded px-1 bg-success/10">
                {formatTunnelTrafficRatio(forward.tunnelTrafficRatio)}
              </span>
            )}
        </div>
      </TableCell>
      <TableCell
        className={`max-w-[220px] ${selectedIds.has(forward.id) ? "bg-primary-50/70 dark:bg-primary-900/40" : ""}`}
      >
        <button
          className={`w-full truncate rounded-md bg-default-100/50 px-2.5 py-1.5 text-left font-mono text-xs font-medium text-default-700 transition-all ${
            hasMultipleAddresses(forward.inIp)
              ? "hover:bg-default-200 hover:shadow-sm cursor-pointer"
              : "cursor-default"
          }`}
          title={formatInAddress(forward.inIp, forward.inPort)}
          type="button"
          onClick={() =>
            showAddressModal(forward.inIp, forward.inPort, "入口端口")
          }
        >
          {formatInAddress(forward.inIp, forward.inPort)}
        </button>
      </TableCell>
      <TableCell
        className={`max-w-[240px] ${selectedIds.has(forward.id) ? "bg-primary-50/70 dark:bg-primary-900/40" : ""}`}
      >
        <button
          className={`w-full truncate rounded-md bg-default-100/50 px-2.5 py-1.5 text-left font-mono text-xs font-medium text-default-700 transition-all ${
            hasMultipleAddresses(forward.remoteAddr)
              ? "hover:bg-default-200 hover:shadow-sm cursor-pointer"
              : "cursor-default"
          }`}
          title={formatRemoteAddress(forward.remoteAddr)}
          type="button"
          onClick={() => showAddressModal(forward.remoteAddr, null, "目标地址")}
        >
          {formatRemoteAddress(forward.remoteAddr)}
        </button>
      </TableCell>

      <TableCell
        className={`${selectedIds.has(forward.id) ? "bg-primary-50/70 dark:bg-primary-900/40" : ""}`}
      >
        <Chip
          className="text-sm font-medium shrink-0 whitespace-nowrap"
          color={strategyDisplay.color as any}
          size="sm"
          variant="flat"
        >
          {strategyDisplay.text}
        </Chip>
      </TableCell>
      <TableCell
        className={`whitespace-nowrap ${selectedIds.has(forward.id) ? "bg-primary-50/70 dark:bg-primary-900/40" : ""}`}
      >
        <span className="text-sm font-medium text-default-600 font-mono">
          {formatFlow(getForwardDisplayFlow(forward))}
        </span>
      </TableCell>
      <TableCell
        className={`${selectedIds.has(forward.id) ? "bg-primary-50/70 dark:bg-primary-900/40" : ""}`}
      >
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <Switch
            color="success"
            isDisabled={forward.status !== 1 && forward.status !== 0}
            isSelected={forward.serviceRunning}
            size="sm"
            onValueChange={() => handleServiceToggle(forward)}
          />
        </div>
      </TableCell>
      <TableCell
        className={`${selectedIds.has(forward.id) ? "bg-primary-50/70 dark:bg-primary-900/40" : ""}`}
      >
        <div className="flex justify-start gap-2 pl-2">
          <Button
            isIconOnly
            aria-label="编辑规则"
            className="bg-primary/10 text-primary hover:bg-primary/20"
            size="sm"
            onPress={() => handleEdit(forward)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                strokeWidth={2}
              />
            </svg>
          </Button>
          <Button
            isIconOnly
            aria-label="诊断规则"
            className="bg-warning/10 text-warning hover:bg-warning/20"
            size="sm"
            onPress={() => handleDiagnose(forward)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                strokeWidth={2}
              />
            </svg>
          </Button>
          <Button
            isIconOnly
            className="bg-secondary/10 text-secondary hover:bg-secondary/20"
            isDisabled={(forward.inFlow || 0) + (forward.outFlow || 0) <= 0}
            size="sm"
            title="流量清零"
            onPress={() => handleResetFlow(forward)}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-13.657-3.657L4 8m16 8-2.343 2.657A8 8 0 014 15"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </Button>
          <Button
            isIconOnly
            aria-label="删除规则"
            className="bg-danger/10 text-danger hover:bg-danger/20"
            size="sm"
            onPress={() => handleDelete(forward)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                strokeWidth={2}
              />
            </svg>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export const getForwardDisplayFlow = (forward: Forward): number => {
  const directFlow = (forward.inFlow || 0) + (forward.outFlow || 0);

  if (directFlow > 0) {
    return directFlow;
  }

  return forward.federationShareFlow || 0;
};
