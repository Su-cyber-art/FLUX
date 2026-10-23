import type { User } from "@/types";

import { ActionIcon, Avatar, Menu, Tooltip } from "@mantine/core";
import { Ellipsis, KeyRound, RotateCcw, SquarePen, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { type SemanticColor } from "@/components/ui/shared";
import { UsageMeter } from "@/components/usage-meter";
import { cn } from "@/lib/utils";
import {
  calculateUserTotalUsedFlow,
  formatFlow,
  formatQuotaLimit,
  getExpireStatus,
  getUserStatus,
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

const resetText = (user: User) =>
  !user.flowResetTime ? "不自动重置" : `每月 ${user.flowResetTime} 日重置`;

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

const UserIdentity = ({ user }: { user: User }) => {
  const status = getUserStatus(user);
  const displayName = user.name || user.user;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative shrink-0">
        <Avatar color="initials" name={displayName} radius="xl" size={38} />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-content1",
            user.status === 1 ? "bg-success" : "bg-default-400",
          )}
          title={status.text}
        />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="truncate text-sm font-semibold text-foreground"
            title={displayName}
          >
            {displayName}
          </span>
          {user.status !== 1 && (
            <Chip color="default" size="xs">
              {status.text}
            </Chip>
          )}
          {user.disabledByQuota ? (
            <Chip color="danger" size="xs">
              配额超额
            </Chip>
          ) : null}
        </div>
        <p className="truncate text-xs text-default-500">@{user.user}</p>
      </div>
    </div>
  );
};

const FlowMeter = ({ user }: { user: User }) => (
  <UsageMeter
    label="流量"
    limit={formatFlowLimit(user.flow, user.flowMiB)}
    percent={flowPercent(user)}
    unlimited={isUnlimited(user)}
    used={formatFlow(calculateUserTotalUsedFlow(user))}
  />
);

const QuotaLine = ({ user }: { user: User }) =>
  hasQuota(user) ? (
    <p className="truncate text-xs text-default-500">
      日 {formatFlow(Number(user.dailyUsedBytes ?? 0))} /{" "}
      {formatQuotaLimit(user.dailyQuotaGB)} · 月{" "}
      {formatFlow(Number(user.monthlyUsedBytes ?? 0))} /{" "}
      {formatQuotaLimit(user.monthlyQuotaGB)}
    </p>
  ) : (
    <p className="text-xs text-default-400">未设置日 / 月配额</p>
  );

const UserMoreMenu = ({
  user,
  handlers,
}: {
  user: User;
  handlers: UserItemHandlers;
}) => (
  <Menu withinPortal position="bottom-end" shadow="md" width={150}>
    <Menu.Target>
      <ActionIcon aria-label="更多操作" color="gray" variant="subtle">
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

export const UserCard = ({
  user,
  handlers,
}: {
  user: User;
  handlers: UserItemHandlers;
}) => {
  const expiry = expiryInfo(user);

  return (
    <Card className="h-full gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <UserIdentity user={user} />
        <Chip className="shrink-0" color={expiry.tone} size="xs">
          {expiry.text}
        </Chip>
      </div>
      <div className="space-y-2">
        <FlowMeter user={user} />
        <QuotaLine user={user} />
      </div>
      <dl className="grid grid-cols-2 gap-2 rounded-lg bg-default-soft px-3 py-2.5 text-xs">
        <div>
          <dt className="text-default-500">规则上限</dt>
          <dd className="font-medium text-foreground">
            {user.num === 99999 ? "无限制" : `${user.num} 条`}
          </dd>
        </div>
        <div>
          <dt className="text-default-500">流量重置</dt>
          <dd className="font-medium text-foreground">{resetText(user)}</dd>
        </div>
      </dl>
      <div className="mt-auto flex items-center gap-1.5 border-t border-divider pt-3">
        <Button
          size="sm"
          startContent={<KeyRound size={14} />}
          variant="light"
          onPress={() => handlers.onManageTunnels(user)}
        >
          权限
        </Button>
        <Button
          size="sm"
          startContent={<SquarePen size={14} />}
          variant="light"
          onPress={() => handlers.onEdit(user)}
        >
          编辑
        </Button>
        <div className="ml-auto">
          <UserMoreMenu handlers={handlers} user={user} />
        </div>
      </div>
    </Card>
  );
};

export const UserListHeader = () => (
  <div className="user-list-head" role="presentation">
    <div className="user-row-name">用户</div>
    <div className="user-row-flow">流量</div>
    <div className="user-row-meta">配额与规则</div>
    <div className="user-row-expiry">有效期</div>
    <div className="user-row-actions">操作</div>
  </div>
);

export const UserRow = ({
  user,
  handlers,
}: {
  user: User;
  handlers: UserItemHandlers;
}) => {
  const expiry = expiryInfo(user);

  return (
    <div className="user-row">
      <div className="user-row-name min-w-0">
        <UserIdentity user={user} />
      </div>
      <div className="user-row-flow min-w-0">
        <FlowMeter user={user} />
      </div>
      <div className="user-row-meta min-w-0">
        <QuotaLine user={user} />
        <p className="truncate text-xs text-default-500">
          规则 {user.num === 99999 ? "无限制" : `${user.num} 条`} ·{" "}
          {resetText(user)}
        </p>
      </div>
      <div className="user-row-expiry">
        <Chip color={expiry.tone} size="xs">
          {expiry.text}
        </Chip>
      </div>
      <div className="user-row-actions">
        <Tooltip label="隧道权限">
          <ActionIcon
            aria-label="隧道权限"
            color="gray"
            variant="subtle"
            onClick={() => handlers.onManageTunnels(user)}
          >
            <KeyRound size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="编辑">
          <ActionIcon
            aria-label="编辑用户"
            color="gray"
            variant="subtle"
            onClick={() => handlers.onEdit(user)}
          >
            <SquarePen size={16} />
          </ActionIcon>
        </Tooltip>
        <UserMoreMenu handlers={handlers} user={user} />
      </div>
    </div>
  );
};
