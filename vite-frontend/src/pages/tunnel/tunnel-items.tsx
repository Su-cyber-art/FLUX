import type { ReactNode } from "react";

import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  Ellipsis,
  GripVertical,
  SquarePen,
  Stethoscope,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { type SemanticColor } from "@/components/ui/shared";
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
  (items ?? []).map((item) => {
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

const tunnelStatus = (tunnel: Tunnel): { tone: SemanticColor; text: string } =>
  tunnel.status === 1
    ? { tone: "success", text: "启用" }
    : { tone: "warning", text: "停用" };

const RouteNodes = ({ nodes }: { nodes: RouteNode[] }) => {
  if (nodes.length === 0) {
    return <span className="text-xs text-default-400">未配置</span>;
  }
  const [first, ...rest] = nodes;

  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-default-soft px-2 py-0.5 text-xs text-default-700"
      title={nodes
        .map((node) => `${node.name}（${node.online ? "在线" : "离线"}）`)
        .join("\n")}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          first.online ? "bg-success" : "bg-default-400",
        )}
      />
      <span className="truncate">{first.name}</span>
      {rest.length > 0 && (
        <span className="shrink-0 font-semibold text-primary-ink">
          +{rest.length}
        </span>
      )}
    </span>
  );
};

/** Vertical route used on cards. */
const TunnelRouteSteps = ({ stages }: { stages: RouteStage[] }) => (
  <ol className="tunnel-route">
    {stages.map((stage, index) => (
      <li key={`${stage.role}-${index}`} className="tunnel-route-step">
        <span className="tunnel-route-role">{stage.role}</span>
        <RouteNodes nodes={stage.nodes} />
      </li>
    ))}
  </ol>
);

/** Inline route used in list rows. */
const TunnelRouteInline = ({ stages }: { stages: RouteStage[] }) => (
  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
    {stages.map((stage, index) => (
      <span
        key={`${stage.role}-${index}`}
        className="inline-flex min-w-0 max-w-full items-center gap-1.5"
      >
        {index > 0 && (
          <ArrowRight className="shrink-0 text-default-400" size={13} />
        )}
        <RouteNodes nodes={stage.nodes} />
      </span>
    ))}
  </div>
);

const TunnelMeta = ({ tunnel }: { tunnel: Tunnel }) => (
  <p className="truncate text-xs text-default-500">
    {[
      getTunnelFlowDisplay(tunnel.flow),
      `倍率 ${tunnel.trafficRatio}x`,
      tunnel.type === 2 && tunnel.ipPreference
        ? tunnel.ipPreference === "v4"
          ? "IPv4 优先"
          : "IPv6 优先"
        : "",
    ]
      .filter(Boolean)
      .join(" · ")}
  </p>
);

const TunnelChips = ({ tunnel }: { tunnel: Tunnel }) => {
  const type = getTunnelTypeDisplay(tunnel.type);
  const status = tunnelStatus(tunnel);

  return (
    <>
      <Chip color={type.color as SemanticColor} size="xs">
        {type.text}
      </Chip>
      {tunnel.status !== 1 && (
        <Chip dot color={status.tone} size="xs">
          {status.text}
        </Chip>
      )}
    </>
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
      <ActionIcon aria-label="更多操作" color="gray" variant="subtle">
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
        "h-full gap-3 p-4",
        selected && "border-primary-line bg-primary-soft",
      )}
    >
      <div className="flex items-start gap-2.5">
        {selectMode && (
          <Checkbox
            aria-label={`选择 ${tunnel.name}`}
            className="mt-0.5"
            isSelected={selected}
            onValueChange={() => handlers.onToggleSelect(tunnel.id)}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3
              className="truncate text-[15px] font-semibold text-foreground"
              title={tunnel.name}
            >
              {tunnel.name}
            </h3>
            <TunnelChips tunnel={tunnel} />
          </div>
          <div className="mt-0.5">
            <TunnelMeta tunnel={tunnel} />
          </div>
        </div>
        {dragListeners && (
          <button
            aria-label="拖拽排序"
            className="forward-drag-handle -mr-1"
            title="拖拽排序"
            type="button"
            {...dragListeners}
          >
            <GripVertical size={15} />
          </button>
        )}
      </div>

      <TunnelRouteSteps stages={tunnelRoute(tunnel, nodeMap)} />
      {bestExit && <div className="flex min-w-0">{bestExit}</div>}

      <div className="mt-auto flex items-center gap-1.5 border-t border-divider pt-3">
        <Button
          size="sm"
          startContent={<SquarePen size={14} />}
          variant="light"
          onPress={() => handlers.onEdit(tunnel)}
        >
          编辑
        </Button>
        <Button
          size="sm"
          startContent={<Stethoscope size={14} />}
          variant="light"
          onPress={() => handlers.onDiagnose(tunnel)}
        >
          诊断
        </Button>
        <div className="ml-auto">
          <TunnelMoreMenu handlers={handlers} tunnel={tunnel} />
        </div>
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
    <div className="tunnel-row-lead">
      <Checkbox
        aria-label="全选"
        isIndeterminate={isIndeterminate}
        isSelected={isAllSelected}
        onValueChange={onToggleAll}
      />
    </div>
    <div className="tunnel-row-name">隧道</div>
    <div className="tunnel-row-route">链路</div>
    <div className="tunnel-row-actions">操作</div>
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
      <div className="tunnel-row-lead">
        <Checkbox
          aria-label={`选择 ${tunnel.name}`}
          isSelected={selected}
          onValueChange={() => handlers.onToggleSelect(tunnel.id)}
        />
      </div>
      <div className="tunnel-row-name min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="truncate text-sm font-medium text-foreground"
            title={tunnel.name}
          >
            {tunnel.name}
          </span>
          <TunnelChips tunnel={tunnel} />
        </div>
        <div className="mt-0.5">
          <TunnelMeta tunnel={tunnel} />
        </div>
      </div>
      <div className="tunnel-row-route min-w-0 space-y-1.5">
        <TunnelRouteInline stages={tunnelRoute(tunnel, nodeMap)} />
        {bestExit && <div className="flex min-w-0">{bestExit}</div>}
      </div>
      <div className="tunnel-row-actions">
        <Tooltip label="编辑">
          <ActionIcon
            aria-label="编辑隧道"
            color="gray"
            variant="subtle"
            onClick={() => handlers.onEdit(tunnel)}
          >
            <SquarePen size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="诊断">
          <ActionIcon
            aria-label="诊断隧道"
            color="gray"
            variant="subtle"
            onClick={() => handlers.onDiagnose(tunnel)}
          >
            <Stethoscope size={16} />
          </ActionIcon>
        </Tooltip>
        <TunnelMoreMenu handlers={handlers} tunnel={tunnel} />
      </div>
    </div>
  );
};
