import type { SemanticColor } from "@/components/ui/shared";

// 99999 是后端约定的"无限制"数值
export const UNLIMITED = 99999;

export const isUnlimitedFlow = (flow?: number, flowMiB?: number) =>
  flow === UNLIMITED && !flowMiB;

export const formatCount = (value?: number): string =>
  value === UNLIMITED ? "无限制" : String(value ?? 0);

export const usagePercent = (used: number, limit: number): number =>
  limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

export { usageTone } from "@/components/ui/shared";

export interface ExpiryStatus {
  tone: SemanticColor;
  text: string;
}

export const getExpiryStatus = (expTime?: string | number): ExpiryStatus => {
  if (!expTime) return { tone: "success", text: "永久" };

  const expDate = new Date(expTime);

  if (isNaN(expDate.getTime())) return { tone: "default", text: "无效" };

  const diffDays = Math.ceil(
    (expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays <= 0) return { tone: "danger", text: "已过期" };
  if (diffDays <= 7) return { tone: "danger", text: `${diffDays}天后过期` };
  if (diffDays <= 30) return { tone: "warning", text: `${diffDays}天后过期` };
  if (diffDays > 365) {
    return { tone: "success", text: `${Math.floor(diffDays / 365)}年后过期` };
  }

  return { tone: "success", text: `${diffDays}天后过期` };
};

export const formatExpiryDate = (expTime?: string | number): string => {
  if (!expTime) return "永久有效";

  const expDate = new Date(expTime);

  return isNaN(expDate.getTime())
    ? "日期无效"
    : expDate.toLocaleDateString("zh-CN");
};

export const formatResetTime = (resetDay?: number): string => {
  if (resetDay === undefined || resetDay === null) return "";
  if (resetDay === 0) return "不重置";

  const now = new Date();
  const currentDay = now.getDate();
  let daysUntilReset = 0;

  if (resetDay > currentDay) {
    daysUntilReset = resetDay - currentDay;
  } else if (resetDay < currentDay) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, resetDay);

    daysUntilReset = Math.ceil(
      (nextReset.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  if (daysUntilReset === 0) return "今日重置";
  if (daysUntilReset === 1) return "明日重置";

  return `${daysUntilReset}天后重置`;
};

export const splitList = (value?: string): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** Entry addresses as ip:port; inIp may already carry ports (newer data). */
export const entryAddresses = (inIp: string, port: number): string[] => {
  const items = splitList(inIp);

  if (items.length === 0) return [];
  if (/:\d+$/.test(items[0])) return items;
  if (!port) return [];

  return items.map((ip) =>
    ip.includes(":") && !ip.startsWith("[")
      ? `[${ip}]:${port}`
      : `${ip}:${port}`,
  );
};
