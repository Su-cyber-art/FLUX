import { useState } from "react";
import { Skeleton, Button, ActionIcon } from "@mantine/core";
import { ArrowDownUp, ArrowLeftRight, CalendarClock, Copy } from "lucide-react";

import toast from "@/lib/notifications";
import { AnimatedPage } from "@/components/animated-page";
import { KpiCell, KpiStrip } from "@/components/stat-card";
import { UsageBar } from "@/components/usage-meter";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from "@/components/ui/modal";
import { AnnouncementBanner } from "@/pages/dashboard/components/announcement-banner";
import { AnnouncementModal } from "@/pages/dashboard/components/announcement-modal";
import { FlowChartCard } from "@/pages/dashboard/components/flow-chart-card";
import { ForwardOverview } from "@/pages/dashboard/components/forward-overview";
import { NodeExpiryPanel } from "@/pages/dashboard/components/node-expiry-panel";
import { TunnelAccessList } from "@/pages/dashboard/components/tunnel-access-list";
import {
  UNLIMITED,
  formatCount,
  formatExpiryDate,
  formatResetTime,
  getExpiryStatus,
  isUnlimitedFlow,
  usagePercent,
  usageTone,
} from "@/pages/dashboard/format";
import { useDashboardData } from "@/pages/dashboard/use-dashboard-data";
import { cn } from "@/lib/utils";
import {
  flowLimitBytes,
  formatFlowLimit,
  formatTraffic,
} from "@/utils/traffic";

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5" role="status">
      <span className="sr-only">正在加载数据…</span>
      <Skeleton h={118} radius="md" />
      <Skeleton h={300} radius="md" />
      <Skeleton h={200} radius="md" />
    </div>
  );
}

/** Usage percentage beside a KPI label, tinted only once it needs attention. */
function UsagePercent({
  percent,
  digits,
}: {
  percent: number;
  digits: number;
}) {
  const tone = usageTone(percent);

  return (
    <span
      className={cn(
        tone === "danger" && "text-danger-ink",
        tone === "warning" && "text-warning-ink",
        tone === "primary" && "text-default-500",
      )}
    >
      {percent.toFixed(digits)}%
    </span>
  );
}

export default function DashboardPage() {
  const {
    loading,
    userInfo,
    userTunnels,
    forwardList,
    statisticsFlows,
    nodeExpiryReminders,
    isAdmin,
    announcement,
    isAnnouncementModalOpen,
    setIsAnnouncementModalOpen,
    dismissAnnouncementModal,
  } = useDashboardData();

  const [addressModal, setAddressModal] = useState<{
    title: string;
    addresses: string[];
  } | null>(null);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  const openAddresses = (title: string, addresses: string[]) => {
    if (addresses.length === 1) {
      void copyText(addresses[0]);

      return;
    }
    setAddressModal({ title, addresses });
  };

  // 最近 24 小时（含当前小时），缺失的小时补 0
  const flowChartData = (() => {
    const flowMap = new Map(
      statisticsFlows.map((item) => [item.time, item.flow || 0]),
    );
    const now = Date.now();

    return Array.from({ length: 24 }, (_, index) => {
      const hour = new Date(now - (23 - index) * 60 * 60 * 1000).getHours();
      const time = `${hour.toString().padStart(2, "0")}:00`;

      return { time, flow: flowMap.get(time) ?? 0 };
    });
  })();

  if (loading) {
    return <DashboardSkeleton />;
  }

  // 后端已按计费类型处理流量，前端直接使用入站+出站总和
  const usedFlow = (userInfo.inFlow || 0) + (userInfo.outFlow || 0);
  const flowUnlimited = isUnlimitedFlow(userInfo.flow, userInfo.flowMiB);
  const flowPercent = flowUnlimited
    ? 0
    : usagePercent(
        usedFlow,
        flowLimitBytes(userInfo.flow || 0, userInfo.flowMiB),
      );
  const forwardUnlimited = userInfo.num === UNLIMITED;
  const forwardPercent = forwardUnlimited
    ? 0
    : usagePercent(forwardList.length, userInfo.num || 0);
  const tunnelCount = new Set(forwardList.map((forward) => forward.tunnelId))
    .size;
  const resetText = formatResetTime(userInfo.flowResetTime);
  const accountExpiry = getExpiryStatus(userInfo.expTime);
  const showReminders = isAdmin && nodeExpiryReminders.length > 0;

  return (
    <AnimatedPage className="flex flex-col gap-5">
      {announcement && <AnnouncementBanner announcement={announcement} />}
      {announcement && (
        <AnnouncementModal
          announcement={announcement}
          opened={isAnnouncementModalOpen}
          onClose={() => setIsAnnouncementModalOpen(false)}
          onDontShowAgain={dismissAnnouncementModal}
        />
      )}

      <KpiStrip columns={3} label="账户概览">
        <KpiCell
          aside={
            !flowUnlimited && <UsagePercent digits={1} percent={flowPercent} />
          }
          caption={
            <span>
              {resetText === "不重置" || !resetText
                ? "流量不自动重置"
                : `每月 ${userInfo.flowResetTime} 日重置 · ${resetText}`}
            </span>
          }
          icon={<ArrowDownUp />}
          label="流量用量"
          meter={
            <UsageBar
              label="流量用量"
              percent={flowPercent}
              unlimited={flowUnlimited}
            />
          }
          unit={`/ ${formatFlowLimit(userInfo.flow, userInfo.flowMiB)}`}
          value={formatTraffic(usedFlow)}
        />
        <KpiCell
          aside={
            !forwardUnlimited && (
              <UsagePercent digits={0} percent={forwardPercent} />
            )
          }
          caption={
            <span>
              {forwardList.length > 0
                ? `分布在 ${tunnelCount} 条隧道`
                : "还没有转发规则"}
            </span>
          }
          icon={<ArrowLeftRight />}
          label="转发规则"
          meter={
            <UsageBar
              label="转发规则"
              percent={forwardPercent}
              unlimited={forwardUnlimited}
            />
          }
          unit={`/ ${formatCount(userInfo.num)}`}
          value={forwardList.length}
        />
        <KpiCell
          caption={
            <>
              <span className="status-dot" data-tone={accountExpiry.tone}>
                {accountExpiry.text}
              </span>
              <span className="text-default-400">·</span>
              <span>{isAdmin ? "管理员账户" : "成员账户"}</span>
            </>
          }
          icon={<CalendarClock />}
          label="账户有效期"
          meter={<div aria-hidden className="h-1" />}
          value={formatExpiryDate(userInfo.expTime)}
        />
      </KpiStrip>

      <div
        className={cn(
          "grid gap-5",
          showReminders && "xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]",
        )}
      >
        <FlowChartCard
          chartData={flowChartData}
          formatFlow={formatTraffic}
          hasData={statisticsFlows.length > 0}
        />
        {showReminders && <NodeExpiryPanel reminders={nodeExpiryReminders} />}
      </div>

      {!isAdmin && (
        <TunnelAccessList
          forwardCount={(tunnelId) =>
            forwardList.filter((forward) => forward.tunnelId === tunnelId)
              .length
          }
          tunnels={userTunnels}
        />
      )}

      <ForwardOverview forwards={forwardList} onAddresses={openAddresses} />

      <Modal
        opened={addressModal !== null}
        size="lg"
        onClose={() => setAddressModal(null)}
      >
        <ModalContent>
          <ModalHeader>
            {addressModal?.title}（{addressModal?.addresses.length} 个）
          </ModalHeader>
          <ModalBody className="pb-6">
            <div className="flex justify-end">
              <Button
                leftSection={<Copy size={14} />}
                size="xs"
                variant="default"
                onClick={() =>
                  void copyText(addressModal?.addresses.join("\n") ?? "")
                }
              >
                复制全部
              </Button>
            </div>
            <ul className="max-h-72 divide-y divide-divider overflow-y-auto rounded-lg border border-divider">
              {addressModal?.addresses.map((address) => (
                <li
                  key={address}
                  className="flex items-center justify-between gap-3 px-3 py-1.5"
                >
                  <code className="mono-value min-w-0 truncate">{address}</code>
                  <ActionIcon
                    aria-label={`复制 ${address}`}
                    color="gray"
                    size={30}
                    variant="subtle"
                    onClick={() => void copyText(address)}
                  >
                    <Copy size={14} />
                  </ActionIcon>
                </li>
              ))}
            </ul>
          </ModalBody>
        </ModalContent>
      </Modal>
    </AnimatedPage>
  );
}
