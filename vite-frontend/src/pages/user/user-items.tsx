import type { User } from "@/types";

import { ActionIcon, Avatar, Badge, Menu, Tooltip } from "@mantine/core";
import {
  CalendarClock,
  Ellipsis,
  KeyRound,
  ListOrdered,
  RotateCcw,
  SquarePen,
  Trash2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { type SemanticColor, uiColor } from "@/components/ui/shared";
import { UsageBar, UsageMeter } from "@/components/usage-meter";
import {
  calculateUserTotalUsedFlow,
  formatFlow,
  formatQuotaLimit,
  getExpireStatus,
} from "@/pages/user/presentation";
import { flowLimitBytes, formatFlowLimit } from "@/utils/traffic";

export interface UserItemHandlers {
  onManageTunnels: (user: User) => void;
  onEdit: (user: User) => void;
  onResetFlow: (user: User) => void;
  onDelete: (user: User) => void;
}

const isUnlimited = (user: User) => user.flow === 99999 && !user.flowMiB;

const flowPercent = (user: User) => {
  if (isUnlimited(user) || user.flow <= 0) return 0;
  const limit = flowLimitBytes(user.flow, user.flowMiB);

  return limit > 0
    ? Math.min((calculateUserTotalUsedFlow(user) / limit) * 100, 100)
    : 0;
};

const hasQuota = (user: User) =>
  (user.dailyQuotaGB ?? 0) > 0 || (user.monthlyQuotaGB ?? 0) > 0;

const ruleText = (user: User) =>
  user.num === 99999 ? "不限" : `${user.num} 条`;

const resetText = (user: User) =>
  !user.flowResetTime ? "不自动重置" : `每月 ${user.flowResetTime} 日重置`;

const quotaText = (user: User) =>
  `日 ${formatFlow(Number(user.dailyUsedBytes ?? 0))} / ${formatQuotaLimit(
    user.dailyQuotaGB,
  )} · 月 ${formatFlow(Number(user.monthlyUsedBytes ?? 0))} / ${formatQuotaLimit(
    user.monthlyQuotaGB,
  )}`;

const expiryInfo = (
  user: User,
): { text: string; tone: SemanticColor; date: string } => {
  if (!user.expTime) {
    return { text: "长期有效", tone: "success", date: "长期有效" };
  }
  const status = getExpireStatus(user.expTime);
  const date = new Date(user.expTime).toLocaleDateString("zh-CN");

  return {
    text: status.text === "正常" ? `${date} 到期` : status.text,
    tone: status.color,
    date,
  };
};

/** Quiet text while valid; a toned tag once expiry is near or past. */
const ExpiryTag = ({ user }: { user: User }) => {
  const expiry = expiryInfo(user);

  if (expiry.tone === "success") {
    return (
      <span
        className="user-expiry"
        title={user.expTime ? `${expiry.date} 到期` : expiry.text}
      >
        {expiry.text}
      </span>
    );
  }

  return (
    <Badge
      className="shrink-0"
      color={uiColor(expiry.tone)}
      size="sm"
      title={`${expiry.date} 到期`}
      variant="light"
    >
      {expiry.text}
    </Badge>
  );
};

const StatusDot = ({ user }: { user: User }) => (
  <span
    className="status-dot"
    data-tone={user.status === 1 ? "success" : undefined}
  >
    {user.status === 1 ? "正常" : "禁用"}
  </span>
);

const QuotaFlag = ({ user }: { user: User }) =>
  user.disabledByQuota ? (
    <Badge className="shrink-0" color="red" size="sm" variant="light">
      配额超额
    </Badge>
  ) : null;

const UserMoreMenu = ({
  user,
  handlers,
}: {
  user: User;
  handlers: UserItemHandlers;
}) => (
  <Menu withinPortal position="bottom-end" shadow="md" width={150}>
    <Menu.Target>
      <ActionIcon
        aria-label={`更多操作 ${user.user}`}
        color="gray"
        size="md"
        variant="subtle"
      >
        <Ellipsis size={16} />
      </ActionIcon>
    </Menu.Target>
    <Menu.Dropdown>
      <Menu.Item
        leftSection={<RotateCcw size={14} />}
        onClick={() => handlers.onResetFlow(user)}
      >
        重置流量
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item
        color="red"
        leftSection={<Trash2 size={14} />}
        onClick={() => handlers.onDelete(user)}
      >
        删除用户
      </Menu.Item>
    </Menu.Dropdown>
  </Menu>
);

const UserActions = ({
  user,
  handlers,
}: {
  user: User;
  handlers: UserItemHandlers;
}) => (
  <div className="user-actions">
    <Tooltip label="隧道权限">
      <ActionIcon
        aria-label={`隧道权限 ${user.user}`}
        color="gray"
        size="md"
        variant="subtle"
        onClick={() => handlers.onManageTunnels(user)}
      >
        <KeyRound size={15} />
      </ActionIcon>
    </Tooltip>
    <Tooltip label="编辑">
      <ActionIcon
        aria-label={`编辑用户 ${user.user}`}
        color="gray"
        size="md"
        variant="subtle"
        onClick={() => handlers.onEdit(user)}
      >
        <SquarePen size={15} />
      </ActionIcon>
    </Tooltip>
    <UserMoreMenu handlers={handlers} user={user} />
  </div>
);

export const UserCard = ({
  user,
  handlers,
}: {
  user: User;
  handlers: UserItemHandlers;
}) => {
  const displayName = user.name || user.user;

  return (
    <Card className="user-card">
      <div className="user-card-head">
        <Avatar color="initials" name={displayName} radius="xl" size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="truncate text-[13.5px] font-semibold text-foreground"
              title={displayName}
            >
              {displayName}
            </span>
            <StatusDot user={user} />
          </div>
          <p className="truncate text-xs text-default-500">@{user.user}</p>
        </div>
        <UserActions handlers={handlers} user={user} />
      </div>

      <div className="space-y-1.5">
        <UsageMeter
          label="流量"
          limit={formatFlowLimit(user.flow, user.flowMiB)}
          percent={flowPercent(user)}
          unlimited={isUnlimited(user)}
          used={formatFlow(calculateUserTotalUsedFlow(user))}
        />
        {hasQuota(user) && (
          <p className="truncate text-xs tabular-nums text-default-500">
            {quotaText(user)}
          </p>
        )}
      </div>

      <div className="user-card-meta">
        <span title="规则上限">
          <ListOrdered size={13} />
          规则 <b>{ruleText(user)}</b>
        </span>
        <span title="流量重置">
          <CalendarClock size={13} />
          {resetText(user)}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <QuotaFlag user={user} />
          <ExpiryTag user={user} />
        </span>
      </div>
    </Card>
  );
};

export const UserListHeader = () => (
  <div className="user-list-head" role="presentation">
    <div className="user-cell-name">用户</div>
    <div className="user-cell-status">状态</div>
    <div className="user-cell-flow">流量</div>
    <div className="user-cell-quota">日 / 月配额</div>
    <div className="user-cell-rules">规则</div>
    <div className="user-cell-reset">重置</div>
    <div className="user-cell-expiry">有效期</div>
    <div className="user-cell-actions" />
  </div>
);

export const UserRow = ({
  user,
  handlers,
}: {
  user: User;
  handlers: UserItemHandlers;
}) => {
  const displayName = user.name || user.user;
  const unlimited = isUnlimited(user);
  const percent = flowPercent(user);

  return (
    <div className="user-row">
      <div className="user-cell-name">
        <Avatar color="initials" name={displayName} radius="xl" size={24} />
        <div className="min-w-0">
          <p
            className="truncate text-[13px] font-medium text-foreground"
            title={displayName}
          >
            {displayName}
          </p>
          <p className="truncate text-xs text-default-500">@{user.user}</p>
        </div>
      </div>
      <div className="user-cell-status">
        <StatusDot user={user} />
        <QuotaFlag user={user} />
      </div>
      <div className="user-cell-flow">
        <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
          <span className="user-cell-label">流量</span>
          <span className="truncate text-default-500">
            <span className="font-medium text-foreground">
              {formatFlow(calculateUserTotalUsedFlow(user))}
            </span>{" "}
            / {formatFlowLimit(user.flow, user.flowMiB)}
          </span>
          {!unlimited && (
            <span className="user-flow-percent">{Math.round(percent)}%</span>
          )}
        </div>
        <UsageBar
          label={`${displayName} 流量`}
          percent={percent}
          unlimited={unlimited}
        />
      </div>
      <div
        className="user-cell-quota"
        data-empty={!hasQuota(user) || undefined}
      >
        <span className="user-cell-label">配额</span>
        {hasQuota(user) ? (
          <span className="truncate" title={quotaText(user)}>
            {quotaText(user)}
          </span>
        ) : (
          <span className="text-default-400">—</span>
        )}
      </div>
      <div className="user-cell-rules">
        <span className="user-cell-label">规则</span>
        {ruleText(user)}
      </div>
      <div className="user-cell-reset">
        <span className="user-cell-label">重置</span>
        {user.flowResetTime ? `每月 ${user.flowResetTime} 日` : "不重置"}
      </div>
      <div className="user-cell-expiry">
        <ExpiryTag user={user} />
      </div>
      <div className="user-cell-actions">
        <UserActions handlers={handlers} user={user} />
      </div>
    </div>
  );
};
