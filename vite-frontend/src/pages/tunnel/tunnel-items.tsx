import type { ReactNode } from "react";

import { ActionIcon, Menu, Tooltip, Checkbox } from "@mantine/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight,
  Ellipsis,
  GripVertical,
  SquarePen,
  Stethoscope,
  Trash2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getTunnelFlowDisplay,
  getTunnelTypeDisplay,
} from "@/pages/tunnel/form";
import {
  renderBestExitState,
  type ChainTunnel,
  type Node,
  type Tunnel,
} from "@/pages/tunnel/presentation";

export interface TunnelItemHandlers {
  onEdit: (tunnel: Tunnel) => void;
  onDiagnose: (tunnel: Tunnel) => void;
  onDelete: (tunnel: Tunnel) => void;
  onToggleSelect: (tunnelId: number) => void;
}

interface RouteNode {
  id: number;
  name: string;
  online: boolean;
}

interface RouteStage {
  role: string;
  nodes: RouteNode[];
}

const toRouteNodes = (
  items: ChainTunnel[] | undefined,
  nodeMap: Map<number, Node>,
): RouteNode[] =>
  (items ?? [])
    .filter((item) => item.nodeId !== -1)
    .map((item) => {
      const node = nodeMap.get(item.nodeId);

      return {
        id: item.nodeId,
        name: node?.name ?? `节点 #${item.nodeId}`,
        online: node?.status === 1,
      };
    });

/** Entry, relay hops and exit of a tunnel, resolved to node names. */
export const tunnelRoute = (
  tunnel: Tunnel,
  nodeMap: Map<number, Node>,
): RouteStage[] => {
  if (tunnel.type !== 2) {
    return [{ role: "入口", nodes: toRouteNodes(tunnel.inNodeId, nodeMap) }];
  }
  const hops = (tunnel.chainNodes ?? []).filter((hop) => hop.length > 0);

  return [
    { role: "入口", nodes: toRouteNodes(tunnel.inNodeId, nodeMap) },
    ...hops.map((hop, index) => ({
      role: hops.length > 1 ? `中转 ${index + 1}` : "中转",
      nodes: toRouteNodes(hop, nodeMap),
    })),
    { role: "出口", nodes: toRouteNodes(tunnel.outNodeId, nodeMap) },
  ];
};

/** Cards have room for three stages; fold multiple relay hops into one. */
const compactRoute = (stages: RouteStage[]): RouteStage[] => {
  if (stages.length <= 3) return stages;
  const relays = stages.slice(1, -1);

  return [
    stages[0],
    {
      role: `中转 ×${relays.length}`,
      nodes: relays.flatMap((stage) => stage.nodes),
    },
    stages[stages.length - 1],
  ];
};

/** Chain protocols (relay hops, then exit), de-duplicated, upper-cased. */
const tunnelProtocols = (tunnel: Tunnel): string[] => {
  if (tunnel.type !== 2) return [];
  const groups = [
    ...(tunnel.chainNodes ?? []),
    ...(tunnel.outNodeId?.length ? [tunnel.outNodeId] : []),
  ];
  const protocols = groups
    .map((group) => group[0]?.protocol?.trim().toUpperCase())
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(protocols));
};

const formatRatio = (ratio: number) => `${Number(Number(ratio).toFixed(2))}x`;

const nodesTitle = (stage: RouteStage) =>
  `${stage.role}\n${stage.nodes
    .map((node) => `${node.name}（${node.online ? "在线" : "离线"}）`)
    .join("\n")}`;

const RouteNodeLabel = ({ nodes }: { nodes: RouteNode[] }) => {
  if (nodes.length === 0) {
    return <span className="tunnel-node tunnel-node-empty">未配置</span>;
  }
  const [first, ...rest] = nodes;

  return (
    <span className="tunnel-node" data-online={first.online || undefined}>
      <span className="tunnel-node-name">{first.name}</span>
      {rest.length > 0 && (
        <span className="tunnel-node-more">+{rest.length}</span>
      )}
    </span>
  );
};

/** Card route: role caption above each node, chevrons between stages. */
const TunnelPath = ({ stages }: { stages: RouteStage[] }) => (
  <ol className="tunnel-path">
    {compactRoute(stages).map((stage, index) => (
      <li
        key={`${stage.role}-${index}`}
        className="tunnel-stage"
        title={nodesTitle(stage)}
      >
        <span className="tunnel-stage-role">{stage.role}</span>
        <RouteNodeLabel nodes={stage.nodes} />
      </li>
    ))}
  </ol>
);

/** List route: one line, role as a muted prefix. */
const TunnelPathInline = ({ stages }: { stages: RouteStage[] }) => (
  <div className="tunnel-path-inline">
    {stages.map((stage, index) => (
      <span
        key={`${stage.role}-${index}`}
        className="tunnel-inline-stage"
        title={nodesTitle(stage)}
      >
        {index > 0 && (
          <ChevronRight className="tunnel-inline-arrow" size={12} />
        )}
        <span className="tunnel-stage-role">{stage.role}</span>
        <RouteNodeLabel nodes={stage.nodes} />
      </span>
    ))}
  </div>
);

const TunnelStatus = ({ tunnel }: { tunnel: Tunnel }) => (
  <span
    className="status-dot"
    data-tone={tunnel.status === 1 ? "success" : "warning"}
  >
    {tunnel.status === 1 ? "启用" : "停用"}
  </span>
);

/** Type · protocol · flow · ratio · IP preference. */
const TunnelMeta = ({
  tunnel,
  showRatio = true,
}: {
  tunnel: Tunnel;
  showRatio?: boolean;
}) => {
  const protocols = tunnelProtocols(tunnel);
  const preference =
    tunnel.type === 2 && tunnel.ipPreference
      ? tunnel.ipPreference === "v4"
        ? "IPv4 优先"
        : "IPv6 优先"
      : "";

  return (
    <p className="tunnel-meta">
      <span>{getTunnelTypeDisplay(tunnel.type).text}</span>
      {protocols.length > 0 && (
        <span className="mono-value">{protocols.join("/")}</span>
      )}
      <span>{getTunnelFlowDisplay(tunnel.flow)}</span>
      <span
        className={cn("mono-value", !showRatio && "tunnel-meta-ratio")}
        title="流量倍率"
      >
        {formatRatio(tunnel.trafficRatio)}
      </span>
      {preference && <span>{preference}</span>}
    </p>
  );
};

const TunnelMoreMenu = ({
  tunnel,
  handlers,
}: {
  tunnel: Tunnel;
  handlers: TunnelItemHandlers;
}) => (
  <Menu withinPortal position="bottom-end" shadow="md" width={150}>
    <Menu.Target>
      <ActionIcon aria-label="更多操作" color="gray" size="md" variant="subtle">
        <Ellipsis size={16} />
      </ActionIcon>
    </Menu.Target>
    <Menu.Dropdown>
      <Menu.Item
        color="red"
        leftSection={<Trash2 size={14} />}
        onClick={() => handlers.onDelete(tunnel)}
      >
        删除隧道
      </Menu.Item>
    </Menu.Dropdown>
  </Menu>
);

const TunnelActions = ({
  tunnel,
  handlers,
}: {
  tunnel: Tunnel;
  handlers: TunnelItemHandlers;
}) => (
  <div className="tunnel-actions">
    <Tooltip label="编辑">
      <ActionIcon
        aria-label="编辑隧道"
        color="gray"
        size="md"
        variant="subtle"
        onClick={() => handlers.onEdit(tunnel)}
      >
        <SquarePen size={15} />
      </ActionIcon>
    </Tooltip>
    <Tooltip label="诊断">
      <ActionIcon
        aria-label="诊断隧道"
        color="gray"
        size="md"
        variant="subtle"
        onClick={() => handlers.onDiagnose(tunnel)}
      >
        <Stethoscope size={15} />
      </ActionIcon>
    </Tooltip>
    <TunnelMoreMenu handlers={handlers} tunnel={tunnel} />
  </div>
);

export const SortableTunnelItem = ({
  id,
  children,
}: {
  id: number;
  children: (listeners: React.HTMLAttributes<HTMLButtonElement>) => ReactNode;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className="h-full"
      style={{
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
      }}
      {...attributes}
    >
      {children(listeners as React.HTMLAttributes<HTMLButtonElement>)}
    </div>
  );
};

export const TunnelCard = ({
  tunnel,
  nodeMap,
  selected,
  selectMode,
  dragListeners,
  handlers,
}: {
  tunnel: Tunnel;
  nodeMap: Map<number, Node>;
  selected: boolean;
  selectMode: boolean;
  dragListeners?: React.HTMLAttributes<HTMLButtonElement>;
  handlers: TunnelItemHandlers;
}) => {
  const bestExit = renderBestExitState(tunnel.bestExitState);

  return (
    <Card
      className={cn(
        "tunnel-card",
        selected && "border-primary-line bg-primary-soft",
      )}
      data-disabled={tunnel.status !== 1 || undefined}
    >
      <div className="tunnel-card-head">
        {selectMode && (
          <Checkbox
            aria-label={`选择 ${tunnel.name}`}
            checked={selected}
            className="mt-px"
            size="xs"
            onChange={() => handlers.onToggleSelect(tunnel.id)}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <h3 className="tunnel-name" title={tunnel.name}>
              {tunnel.name}
            </h3>
            <TunnelStatus tunnel={tunnel} />
          </div>
          <TunnelMeta tunnel={tunnel} />
        </div>
        {dragListeners && (
          <button
            aria-label="拖拽排序"
            className="tunnel-drag-handle"
            title="拖拽排序"
            type="button"
            {...dragListeners}
          >
            <GripVertical size={14} />
          </button>
        )}
      </div>

      <TunnelPath stages={tunnelRoute(tunnel, nodeMap)} />
      {bestExit && <div className="flex min-w-0">{bestExit}</div>}

      <div className="tunnel-card-foot">
        <TunnelActions handlers={handlers} tunnel={tunnel} />
      </div>
    </Card>
  );
};

export const TunnelListHeader = ({
  isAllSelected,
  isIndeterminate,
  onToggleAll,
}: {
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleAll: (selected: boolean) => void;
}) => (
  <div className="tunnel-list-head" role="presentation">
    <div className="tunnel-cell-lead">
      <Checkbox
        aria-label="全选"
        checked={isAllSelected}
        indeterminate={isIndeterminate}
        size="xs"
        onChange={(event) => onToggleAll(event.currentTarget.checked)}
      />
    </div>
    <div className="tunnel-cell-name">隧道</div>
    <div className="tunnel-cell-route">链路</div>
    <div className="tunnel-cell-ratio">倍率</div>
    <div className="tunnel-cell-status">状态</div>
    <div className="tunnel-cell-actions">操作</div>
  </div>
);

export const TunnelRow = ({
  tunnel,
  nodeMap,
  selected,
  handlers,
}: {
  tunnel: Tunnel;
  nodeMap: Map<number, Node>;
  selected: boolean;
  handlers: TunnelItemHandlers;
}) => {
  const bestExit = renderBestExitState(tunnel.bestExitState);

  return (
    <div className="tunnel-row" data-selected={selected || undefined}>
      <div className="tunnel-cell-lead">
        <Checkbox
          aria-label={`选择 ${tunnel.name}`}
          checked={selected}
          size="xs"
          onChange={() => handlers.onToggleSelect(tunnel.id)}
        />
      </div>
      <div className="tunnel-cell-name">
        <span className="tunnel-name" title={tunnel.name}>
          {tunnel.name}
        </span>
        <TunnelMeta showRatio={false} tunnel={tunnel} />
      </div>
      <div className="tunnel-cell-route">
        <TunnelPathInline stages={tunnelRoute(tunnel, nodeMap)} />
        {bestExit && <div className="mt-1 flex min-w-0">{bestExit}</div>}
      </div>
      <div className="tunnel-cell-ratio mono-value">
        {formatRatio(tunnel.trafficRatio)}
      </div>
      <div className="tunnel-cell-status">
        <TunnelStatus tunnel={tunnel} />
      </div>
      <div className="tunnel-cell-actions">
        <TunnelActions handlers={handlers} tunnel={tunnel} />
      </div>
    </div>
  );
};
