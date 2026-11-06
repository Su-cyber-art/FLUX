import type * as React from "react";

import { Badge, Button, Loader, Select } from "@mantine/core";
import { CircleArrowUp, Database, RefreshCw } from "lucide-react";

import {
  SystemUpgradeJob,
  type SystemUpgradeReleaseApiItem,
  type SystemUpgradeVersionApiData,
} from "@/api/types";
import { SectionHeader } from "@/components/section-header";
import { describedSelectProps } from "@/components/select-options";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { uiColor } from "@/components/ui/shared";
import {
  CONFIG_SECTION_KEYS,
  type ConfigItem,
} from "@/pages/config/config-items";
import { type UpdateReleaseChannel } from "@/utils/version-update";

interface UpdateSettingsCardProps {
  itemsFor: (keys: string[]) => ConfigItem[];
  renderItemRow: (item: ConfigItem, force?: boolean) => JSX.Element | null;
  updateChannel: UpdateReleaseChannel;
  handleUpdateChannelChange: (channel: UpdateReleaseChannel) => void;
  storageSummary: string;
  systemUpgradeLoading: boolean;
  systemUpgradeInfo: SystemUpgradeVersionApiData | null;
  systemUpgradeReleasesMatchChannel: boolean;
  systemUpgradeReleases: SystemUpgradeReleaseApiItem[];
  systemUpgradeInProgress: boolean;
  systemUpgradeSelectedVersion: string;
  setSystemUpgradeSelectedVersion: React.Dispatch<React.SetStateAction<string>>;
  systemUpgradeChecking: boolean;
  handleCheckSystemUpgrade: () => Promise<boolean>;
  systemUpgradeExecuting: boolean;
  canTriggerSystemUpgrade: boolean;
  upgrade: {
    job: SystemUpgradeJob | null;
    track: (next: SystemUpgradeJob) => void;
    reconnecting: boolean;
    refresh: () => void;
  };
  handleOpenSystemUpgradeModal: () => Promise<void>;
  setUpgradeProgressOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function UpdateSettingsCard({
  itemsFor,
  renderItemRow,
  updateChannel,
  handleUpdateChannelChange,
  storageSummary,
  systemUpgradeLoading,
  systemUpgradeInfo,
  systemUpgradeReleasesMatchChannel,
  systemUpgradeReleases,
  systemUpgradeInProgress,
  systemUpgradeSelectedVersion,
  setSystemUpgradeSelectedVersion,
  systemUpgradeChecking,
  handleCheckSystemUpgrade,
  systemUpgradeExecuting,
  canTriggerSystemUpgrade,
  upgrade,
  handleOpenSystemUpgradeModal,
  setUpgradeProgressOpen,
}: UpdateSettingsCardProps) {
  return (
    <Card className="config-section" id="config-upgrade">
      <CardHeader className="pb-3">
        <SectionHeader
          description="更新通道、下载加速、数据库占用与面板自升级"
          icon={CircleArrowUp}
          title="更新与升级"
        />
      </CardHeader>
      <CardBody className="pt-0">
        {itemsFor(CONFIG_SECTION_KEYS[3].keys).map((item) =>
          renderItemRow(item),
        )}
        <div className="settings-row">
          <div>
            <p className="settings-row-label">更新通道</p>
            <p className="settings-row-desc">
              稳定版仅匹配纯数字版本；开发版仅匹配包含 alpha / beta / rc
              的版本。
            </p>
          </div>
          <Select
            {...describedSelectProps([
              {
                value: "stable",
                label: "稳定版",
                description: "仅纯数字版本，如 2.1.4",
              },
              {
                value: "dev",
                label: "开发版",
                description: "仅 alpha / beta / rc 关键字版本",
              },
            ])}
            aria-label="更新通道"
            size="md"
            value={updateChannel}
            onChange={(value) => {
              const selected = (value as UpdateReleaseChannel) || "stable";

              handleUpdateChannelChange(selected);
            }}
          />
        </div>
        <div className="settings-row">
          <div>
            <p className="settings-row-label">数据库占用</p>
            <p className="settings-row-desc">
              当前后端数据库文件或实例占用空间，仅用于容量参考。
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Database className="text-default-400" size={16} />
            {storageSummary}
          </p>
        </div>
        <div data-wide className="settings-row">
          <div>
            <p className="settings-row-label">面板自升级</p>
            <p className="settings-row-desc">
              检查当前版本与可用发布，并在容器环境中触发面板升级。
            </p>
          </div>
          {systemUpgradeLoading ? (
            <div className="flex items-center gap-2 rounded-lg bg-default-soft px-4 py-3 text-sm text-default-500">
              <Loader aria-label="加载中" role="status" size="sm" />
              正在加载升级状态...
            </div>
          ) : (
            <div className="space-y-4">
              <dl className="grid gap-x-4 gap-y-3 rounded-lg bg-default-soft px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="min-w-0">
                  <dt className="text-xs text-default-500">当前版本</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {systemUpgradeInfo?.currentVersion || "未获取"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-default-500">最新版本</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {systemUpgradeInfo?.latestVersion || "未获取"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-default-500">当前通道</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {systemUpgradeInfo?.channel === "dev"
                      ? "开发版"
                      : systemUpgradeInfo?.channel === "stable"
                        ? "稳定版"
                        : updateChannel === "dev"
                          ? "开发版"
                          : "稳定版"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-default-500">升级能力</dt>
                  <dd className="mt-0.5">
                    <Badge
                      color={uiColor(
                        systemUpgradeInfo?.capability.capable
                          ? "success"
                          : "warning",
                      )}
                      leftSection={<span className="badge-dot" />}
                      size="sm"
                      variant="light"
                    >
                      {systemUpgradeInfo?.capability.capable
                        ? "可升级"
                        : "当前不可升级"}
                    </Badge>
                  </dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs text-default-500">部署目录</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-foreground">
                    {systemUpgradeInfo?.capability.deployDir || "未获取"}
                  </dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs text-default-500">后端容器</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-foreground">
                    {systemUpgradeInfo?.capability.backendContainer || "未获取"}
                  </dd>
                </div>
              </dl>

              {!systemUpgradeInfo?.capability.capable && (
                <div className="rounded-lg border border-warning-line bg-warning-soft px-4 py-3 text-warning-ink">
                  <p className="text-xs font-medium">当前无法升级</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                    {(systemUpgradeInfo?.capability.reasons?.length
                      ? systemUpgradeInfo.capability.reasons
                      : ["暂未获取到不可升级原因"]
                    ).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <Select
                  clearable
                  {...describedSelectProps(
                    (systemUpgradeReleasesMatchChannel
                      ? systemUpgradeReleases
                      : []
                    ).map((release) => ({
                      value: release.version,
                      label: release.name || release.version,
                      description: release.publishedAt || "暂无发布时间",
                    })),
                  )}
                  searchable
                  aria-label="目标版本"
                  description="留空时使用当前通道下最新可用版本"
                  disabled={
                    !systemUpgradeReleasesMatchChannel ||
                    systemUpgradeReleases.length === 0 ||
                    systemUpgradeInProgress
                  }
                  label="目标版本"
                  placeholder={
                    systemUpgradeReleasesMatchChannel &&
                    systemUpgradeReleases.length > 0
                      ? "留空时自动选择最新版本"
                      : "请先检查当前通道更新"
                  }
                  size="md"
                  value={
                    systemUpgradeSelectedVersion
                      ? systemUpgradeSelectedVersion
                      : null
                  }
                  onChange={(value) => {
                    const selected = value as string | undefined;

                    setSystemUpgradeSelectedVersion(selected || "");
                  }}
                />
                <div className="flex flex-wrap gap-2 md:pb-6">
                  <Button
                    color="gray"
                    disabled={systemUpgradeInProgress}
                    leftSection={<RefreshCw size={15} />}
                    loading={systemUpgradeChecking}
                    variant="light"
                    onClick={handleCheckSystemUpgrade}
                  >
                    检查更新
                  </Button>
                  <Button
                    disabled={
                      systemUpgradeExecuting ||
                      (!canTriggerSystemUpgrade &&
                        upgrade.job?.status !== "running")
                    }
                    leftSection={<CircleArrowUp size={15} />}
                    loading={systemUpgradeExecuting}
                    onClick={handleOpenSystemUpgradeModal}
                  >
                    {upgrade.job?.status === "running"
                      ? "查看升级进度"
                      : "立即升级"}
                  </Button>
                </div>
              </div>
              {upgrade.job && upgrade.job.status !== "running" && (
                <Button
                  color="gray"
                  size="xs"
                  variant="subtle"
                  onClick={() => setUpgradeProgressOpen(true)}
                >
                  查看上次升级结果
                </Button>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
