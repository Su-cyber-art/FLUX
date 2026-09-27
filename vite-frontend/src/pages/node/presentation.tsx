import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  getNodeRenewalSnapshot,
  type NodeRenewalCycle,
} from "@/pages/node/renewal";
import { type NodeSystemInfo } from "@/pages/node/system-info";

export const NODE_FALLBACK_REFRESH_INTERVAL_MS = 15000;

export interface Node {
  id: number;
  inx?: number;
  name: string;
  remark?: string;
  expiryTime?: number;
  renewalCycle?: NodeRenewalCycle;
  expiryReminderDismissed?: number;
  ip: string;
  serverIp: string;
  serverIpV4?: string;
  serverIpV6?: string;
  port: string;
  tcpListenAddr?: string;
  udpListenAddr?: string;
  extraIPs?: string;
  version?: string;
  http?: number; // 0 关 1 开
  tls?: number; // 0 关 1 开
  socks?: number; // 0 关 1 开
  status: number;
  isRemote?: number;
  forwardMode?: "agent" | "nftables";
  sshConfig?: {
    host?: string;
    port?: number;
    username?: string;
    authType?: "password" | "private_key";
    password?: string;
    privateKey?: string;
    passphrase?: string;
    sudoMode?: "none" | "sudo" | "sudo_su";
  } | null;
  remoteUrl?: string;
  syncError?: string;
  connectionStatus: "online" | "offline";
  systemInfo?: NodeSystemInfo | null;
  copyLoading?: boolean;
  upgradeLoading?: boolean;
  rollbackLoading?: boolean;
}

export interface NodeForm {
  id: number | null;
  name: string;
  remark: string;
  expiryTime: number;
  renewalCycle: NodeRenewalCycle;
  serverHost: string;
  serverIpV4: string;
  serverIpV6: string;
  port: string;
  tcpListenAddr: string;
  udpListenAddr: string;
  interfaceName: string;
  extraIPs: string;
  forwardMode: "agent" | "nftables";
  sshHost: string;
  sshPort: string;
  sshUsername: string;
  sshAuthType: "password" | "private_key";
  sshPassword: string;
  sshPrivateKey: string;
  sshPassphrase: string;
  sshSudoMode: "none" | "sudo" | "sudo_su";
  http: number; // 0 关 1 开
  tls: number; // 0 关 1 开
  socks: number; // 0 关 1 开
}

export type NodeTab = "local" | "remote";

export interface RemoteUsageBinding {
  bindingId: number;
  tunnelId: number;
  tunnelName: string;
  chainType: number;
  hopInx: number;
  allocatedPort: number;
  resourceKey: string;
  remoteBindingId: string;
  updatedTime: number;
}

export interface RemoteUsageNode {
  nodeId: number;
  nodeName: string;
  remoteUrl: string;
  shareId: number;
  portRangeStart: number;
  portRangeEnd: number;
  maxBandwidth: number;
  currentFlow: number;
  usedPorts: number[];
  bindings: RemoteUsageBinding[];
  activeBindingNum: number;
  syncError?: string;
}

export const EXPIRING_SOON_DAYS = 7;

export type NodeExpiryState =
  | "permanent"
  | "healthy"
  | "expiringSoon"
  | "expired";

export type NodeFilterMode = "all" | "expiringSoon" | "expired" | "withExpiry";

export const getNodeReminderEnabled = (node: Node): boolean => {
  return !!node.expiryTime && node.expiryTime > 0 && !!node.renewalCycle;
};

export const getNodeExpiryMeta = (
  timestamp?: number,
  cycle?: NodeRenewalCycle,
) => {
  const renewal = getNodeRenewalSnapshot(timestamp, cycle, EXPIRING_SOON_DAYS);

  if (renewal.state === "unset") {
    return {
      state: "permanent" as NodeExpiryState,
      label: "未设置续费周期",
      tone: "default" as const,
      accentClassName: "",
      bannerClassName: "",
      isHighlighted: false,
      sortWeight: 3,
      nextDueTime: undefined,
    };
  }

  if (renewal.state === "expired") {
    return {
      state: "expired" as NodeExpiryState,
      label: "已过期",
      tone: "danger" as const,
      accentClassName:
        "border-red-300/80 bg-red-50/70 shadow-red-100 dark:border-red-500/40 dark:bg-red-950/20",
      bannerClassName:
        "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
      isHighlighted: true,
      sortWeight: 0,
      nextDueTime: renewal.nextDueTime,
    };
  }

  if (renewal.state === "dueSoon") {
    return {
      state: "expiringSoon" as NodeExpiryState,
      label: renewal.label,
      tone: "warning" as const,
      accentClassName:
        "border-amber-300/80 bg-amber-50/80 shadow-amber-100 dark:border-amber-500/40 dark:bg-amber-950/20",
      bannerClassName:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
      isHighlighted: true,
      sortWeight: 1,
      nextDueTime: renewal.nextDueTime,
    };
  }

  return {
    state: "healthy" as NodeExpiryState,
    label: renewal.label,
    tone: "success" as const,
    accentClassName: "",
    bannerClassName: "",
    isHighlighted: false,
    sortWeight: 2,
    nextDueTime: renewal.nextDueTime,
  };
};

export const mergeNodeRealtimeState = (
  incomingNode: Node,
  existingNode?: Node,
): Node => {
  return {
    ...incomingNode,
    systemInfo: existingNode?.systemInfo ?? incomingNode.systemInfo ?? null,
    copyLoading: existingNode?.copyLoading ?? incomingNode.copyLoading ?? false,
    upgradeLoading:
      existingNode?.upgradeLoading ?? incomingNode.upgradeLoading ?? false,
    rollbackLoading:
      existingNode?.rollbackLoading ?? incomingNode.rollbackLoading ?? false,
  };
};

export const SortableItem = ({
  id,
  children,
}: {
  id: number;
  children: (listeners: any, attributes?: any) => any;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

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
    <div ref={setNodeRef} className="overflow-visible h-full" style={style}>
      {children(listeners, attributes)}
    </div>
  );
};
