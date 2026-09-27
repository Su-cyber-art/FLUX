import { User, UserTunnel } from "@/types";
import {
  formatTraffic,
  flowLimitMiB,
  preferredTrafficUnit,
  TRAFFIC_UNIT_MIB,
} from "@/utils/traffic";

export const formatFlow = formatTraffic;

export const formatQuotaLimit = (value?: number): string => {
  const limit = Number(value ?? 0);

  if (!Number.isFinite(limit) || limit <= 0) {
    return "不限";
  }

  return formatTraffic(limit * 1024 ** 3);
};

export const trafficInputFor = (flowGB: number, flowMiB?: number) => {
  const mib = flowLimitMiB(flowGB, flowMiB);
  const unit = preferredTrafficUnit(mib);

  return { value: String(mib / TRAFFIC_UNIT_MIB[unit]), unit };
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

export const getExpireStatus = (expTime: number) => {
  const now = Date.now();

  if (expTime < now) {
    return { color: "danger" as const, text: "已过期" };
  }
  const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) {
    return { color: "warning" as const, text: `${diffDays}天后过期` };
  }

  return { color: "success" as const, text: "正常" };
};

export const getUserStatus = (user: User) => {
  if (user.status === 1) {
    return { color: "success" as const, text: "正常" };
  } else {
    return { color: "danger" as const, text: "禁用" };
  }
};

export const calculateUserTotalUsedFlow = (user: User): number => {
  return (user.inFlow || 0) + (user.outFlow || 0);
};

export const calculateTunnelUsedFlow = (tunnel: UserTunnel): number => {
  const inFlow = tunnel.inFlow || 0;
  const outFlow = tunnel.outFlow || 0;

  // 后端已按计费类型处理流量，前端直接使用入站+出站总和
  return inFlow + outFlow;
};

export const USER_SEARCH_DEBOUNCE_MS = 250;

export const normalizeUserItem = (item: Partial<User>): User => {
  return {
    id: Number(item.id ?? 0),
    name: item.name,
    user: String(item.user ?? ""),
    status: Number(item.status ?? 0),
    flow: Number(item.flow ?? 0),
    flowMiB: Number(item.flowMiB ?? 0),
    num: Number(item.num ?? 0),
    expTime: item.expTime,
    flowResetTime: item.flowResetTime ?? 0,
    createdTime: item.createdTime,
    inFlow: Number(item.inFlow ?? 0),
    outFlow: Number(item.outFlow ?? 0),
    dailyQuotaGB: Number(item.dailyQuotaGB ?? 0),
    monthlyQuotaGB: Number(item.monthlyQuotaGB ?? 0),
    dailyUsedBytes: Number(item.dailyUsedBytes ?? 0),
    monthlyUsedBytes: Number(item.monthlyUsedBytes ?? 0),
    disabledByQuota: Number(item.disabledByQuota ?? 0),
    quotaDisabledAt: Number(item.quotaDisabledAt ?? 0),
    maxConn: item.maxConn != null ? Number(item.maxConn) : undefined,
  };
};

export const normalizeUserTunnelItem = (
  item: Partial<UserTunnel>,
): UserTunnel => {
  return {
    id: Number(item.id ?? 0),
    userId: Number(item.userId ?? 0),
    tunnelId: Number(item.tunnelId ?? 0),
    tunnelName: String(item.tunnelName ?? ""),
    status: Number(item.status ?? 0),
    flow: Number(item.flow ?? 0),
    flowMiB: Number(item.flowMiB ?? 0),
    num: Number(item.num ?? 0),
    expTime: Number(item.expTime ?? 0),
    flowResetTime: Number(item.flowResetTime ?? 0),
    speedId: item.speedId ?? null,
    speedLimitName: item.speedLimitName,
    inFlow: Number(item.inFlow ?? 0),
    outFlow: Number(item.outFlow ?? 0),
    tunnelFlow: item.tunnelFlow,
  };
};
