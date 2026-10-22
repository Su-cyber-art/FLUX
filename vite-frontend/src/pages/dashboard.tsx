import { useState } from "react";
import { Skeleton } from "@mantine/core";
import {
  ArrowDownUp,
  ArrowLeftRight,
  CalendarClock,
  Copy,
  RotateCcw,
} from "lucide-react";

import toast from "@/lib/notifications";
import { AnimatedPage } from "@/components/animated-page";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
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
import { QuotaCard, UsageBar } from "@/pages/dashboard/components/quota-card";
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
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} h={156} radius="md" />
        ))}
      </div>
      <Skeleton h={360} radius="md" />
      <Skeleton h={220} radius="md" />
    </div>
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
          isOpen={isAnnouncementModalOpen}
          onClose={() => setIsAnnouncementModalOpen(false)}
          onDontShowAgain={dismissAnnouncementModal}
        />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <QuotaCard
          badge={
            !flowUnlimited && (
              <Chip color={usageTone(flowPercent)} size="sm">
                {flowPercent.toFixed(1)}%
              </Chip>
            )
          }
          footer={
            <>
              <RotateCcw size={12} />
              {resetText === "不重置" || !resetText
                ? "流量不自动重置"
                : `每月 ${userInfo.flowResetTime} 日重置 · ${resetText}`}
            </>
          }
          icon={ArrowDownUp}
          suffix={`/ ${formatFlowLimit(userInfo.flow, userInfo.flowMiB)}`}
          title="流量用量"
          tone="primary"
          value={formatTraffic(usedFlow)}
        >
          <UsageBar
            label="流量用量"
            percent={flowPercent}
            unlimited={flowUnlimited}
          />
        </QuotaCard>

        <QuotaCard
          badge={
            !forwardUnlimited && (
              <Chip color={usageTone(forwardPercent)} size="sm">
                {forwardPercent.toFixed(0)}%
              </Chip>
            )
          }
          footer={
            forwardList.length > 0
              ? `分布在 ${tunnelCount} 条隧道`
              : "还没有转发规则"
          }
          icon={ArrowLeftRight}
          suffix={`/ ${formatCount(userInfo.num)}`}
          title="转发规则"
          tone="secondary"
          value={forwardList.length}
        >
          <UsageBar
            label="转发规则"
            percent={forwardPercent}
            unlimited={forwardUnlimited}
          />
        </QuotaCard>

        <QuotaCard
          badge={
            <Chip dot color={accountExpiry.tone} size="sm">
              {accountExpiry.text}
            </Chip>
          }
          footer={isAdmin ? "管理员账户" : "成员账户"}
          icon={CalendarClock}
          title="账户有效期"
          tone={accountExpiry.tone}
          value={formatExpiryDate(userInfo.expTime)}
        />
      </div>

      <div
        className={cn(
          "grid gap-5",
          showReminders && "xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]",
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
        isOpen={addressModal !== null}
        scrollBehavior="inside"
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
                size="sm"
                startContent={<Copy size={14} />}
                onPress={() =>
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
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <code className="min-w-0 truncate font-mono text-sm text-foreground">
                    {address}
                  </code>
                  <Button
                    isIconOnly
                    aria-label={`复制 ${address}`}
                    size="sm"
                    variant="light"
                    onPress={() => void copyText(address)}
                  >
                    <Copy size={14} />
                  </Button>
                </li>
              ))}
            </ul>
          </ModalBody>
        </ModalContent>
      </Modal>
    </AnimatedPage>
  );
}
