import { useState } from "react";
import {
  ArrowLeftRight,
  Clock,
  Database,
  ListChecks,
  Network,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

import toast from "@/lib/notifications";
import { AnimatedPage } from "@/components/animated-page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconTile } from "@/components/ui/icon-tile";
import { type SemanticColor } from "@/components/ui/shared";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from "@/components/ui/modal";
import { PageEmptyState, PageLoadingState } from "@/components/page-state";
import { AnnouncementBanner } from "@/pages/dashboard/components/announcement-banner";
import { AnnouncementModal } from "@/pages/dashboard/components/announcement-modal";
import { FlowChartCard } from "@/pages/dashboard/components/flow-chart-card";
import { MetricCard } from "@/pages/dashboard/components/metric-card";
import {
  formatTraffic,
  formatFlowLimit,
  flowLimitBytes,
} from "@/utils/traffic";
import {
  formatNodeRenewalTime,
  getNodeRenewalCycleLabel,
  getNodeRenewalSnapshot,
} from "@/pages/node/renewal";
import {
  useDashboardData,
  type DashboardForward as Forward,
  type DashboardNodeExpiryItem,
  type DashboardUserTunnel as UserTunnel,
} from "@/pages/dashboard/use-dashboard-data";

interface AddressItem {
  id: number;
  ip: string;
  address: string;
  copying: boolean;
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

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressModalTitle, setAddressModalTitle] = useState("");
  const [addressList, setAddressList] = useState<AddressItem[]>([]);

  const formatFlow = formatTraffic;

  const formatNumber = (value: number): string => {
    // 99999 表示无限制
    if (value === 99999) {
      return "无限制";
    }

    return value.toString();
  };

  const getNodeExpiryStatus = (
    nextDueTime?: number,
    renewalState: "unset" | "expired" | "dueSoon" | "scheduled" = "unset",
  ) => {
    if (!nextDueTime || renewalState === "unset") {
      return {
        label: "未设置",
        tone: "default" as SemanticColor,
        nextDueTime: undefined as number | undefined,
      };
    }

    const diffDays = Math.ceil(
      (nextDueTime - Date.now()) / (1000 * 60 * 60 * 24),
    );

    if (renewalState === "expired" || diffDays <= 0) {
      return {
        label: "已逾期",
        tone: "danger" as SemanticColor,
        nextDueTime,
      };
    }

    if (diffDays === 1) {
      return {
        label: "明天到期",
        tone: "warning" as SemanticColor,
        nextDueTime,
      };
    }

    return {
      label: `${diffDays}天后到期`,
      tone: (diffDays <= 7 ? "warning" : "success") as SemanticColor,
      nextDueTime,
    };
  };

  const renderNodeExpiryCard = (node: DashboardNodeExpiryItem) => {
    const renewalSnapshot = getNodeRenewalSnapshot(
      node.expiryTime,
      node.renewalCycle,
    );
    const expiryStatus = getNodeExpiryStatus(
      renewalSnapshot.nextDueTime,
      renewalSnapshot.state,
    );

    return (
      <div
        key={node.id}
        className="rounded-lg border border-warning-line bg-content1 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              {node.name}
            </div>
            <div className="mt-1 text-xs text-default-500">
              节点 ID: {node.id}
            </div>
          </div>
          <Chip className="shrink-0" color={expiryStatus.tone} size="sm">
            {expiryStatus.label}
          </Chip>
        </div>

        <div className="mt-3 text-sm text-default-700">
          {formatNodeRenewalTime(renewalSnapshot.nextDueTime)}
        </div>

        <div className="mt-1 text-xs text-default-500">
          {getNodeRenewalCycleLabel(node.renewalCycle)}
        </div>

        {node.remark?.trim() && (
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-default-600">
            {node.remark.trim()}
          </p>
        )}
      </div>
    );
  };

  // 处理24小时流量统计数据
  const processFlowChartData = () => {
    // 生成最近24小时的时间数组（从当前小时往前推24小时）
    const now = new Date();
    const hours: string[] = [];

    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourString = time.getHours().toString().padStart(2, "0") + ":00";

      hours.push(hourString);
    }

    // 创建数据映射
    const flowMap = new Map<string, number>();

    statisticsFlows.forEach((item) => {
      flowMap.set(item.time, item.flow || 0);
    });

    // 生成图表数据，没有数据的小时显示为0
    return hours.map((hour) => ({
      time: hour,
      flow: flowMap.get(hour) || 0,
      // 格式化显示用的流量值
      formattedFlow: formatFlow(flowMap.get(hour) || 0),
    }));
  };

  const getExpStatus = (expTime?: string | number) => {
    if (!expTime) return { tone: "success" as SemanticColor, text: "永久" };

    const now = new Date();
    const expDate = new Date(expTime);

    if (isNaN(expDate.getTime())) {
      return { tone: "default" as SemanticColor, text: "无效" };
    }

    if (expDate < now) {
      return { tone: "danger" as SemanticColor, text: "已过期" };
    }

    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
      return { tone: "danger" as SemanticColor, text: `${diffDays}天后过期` };
    } else if (diffDays <= 30) {
      return { tone: "warning" as SemanticColor, text: `${diffDays}天后过期` };
    } else {
      return { tone: "success" as SemanticColor, text: `${diffDays}天后过期` };
    }
  };

  const calculateUserTotalUsedFlow = (): number => {
    // 后端已按计费类型处理流量，前端直接使用入站+出站总和
    return (userInfo.inFlow || 0) + (userInfo.outFlow || 0);
  };

  const calculateUsagePercentage = (type: "flow" | "forwards"): number => {
    if (type === "flow") {
      const totalUsed = calculateUserTotalUsedFlow();
      const totalLimit = flowLimitBytes(userInfo.flow || 0, userInfo.flowMiB);

      // 无限制时返回0%
      if (userInfo.flow === 99999 && !userInfo.flowMiB) return 0;

      return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
    } else if (type === "forwards") {
      const totalUsed = forwardList.length;
      const totalLimit = userInfo.num || 0;

      // 无限制时返回0%
      if (userInfo.num === 99999) return 0;

      return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
    }

    return 0;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "bg-danger";
    if (percentage >= 70) return "bg-warning";

    return "bg-primary";
  };

  const renderProgressBar = (
    percentage: number,
    size: "sm" | "md" = "md",
    isUnlimited: boolean = false,
  ) => {
    const height = size === "sm" ? "h-1.5" : "h-2";

    if (isUnlimited) {
      return (
        <div className="w-full">
          <div
            className={`w-full bg-primary-soft-hover rounded-full ${height}`}
          >
            <div
              className={`${height} bg-gradient-to-r from-primary to-secondary rounded-full w-full opacity-60`}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        <div className={`w-full bg-default-200 rounded-full ${height}`}>
          <div
            className={`${height} rounded-full transition-all duration-300 ${getUsageColor(percentage)}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  const calculateTunnelUsedFlow = (tunnel: UserTunnel): number => {
    if (!tunnel) return 0;
    const inFlow = tunnel.inFlow || 0;
    const outFlow = tunnel.outFlow || 0;

    // 后端已按计费类型处理流量，前端直接使用入站+出站总和
    return inFlow + outFlow;
  };

  const calculateTunnelFlowPercentage = (tunnel: UserTunnel): number => {
    const totalUsed = calculateTunnelUsedFlow(tunnel);
    const totalLimit = flowLimitBytes(tunnel.flow || 0, tunnel.flowMiB);

    // 无限制时返回0%
    if (tunnel.flow === 99999 && !tunnel.flowMiB) return 0;

    return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
  };

  const getTunnelUsedForwards = (tunnelId: number): number => {
    return forwardList.filter((forward) => forward.tunnelId === tunnelId)
      .length;
  };

  const calculateTunnelForwardPercentage = (tunnel: UserTunnel): number => {
    const totalUsed = getTunnelUsedForwards(tunnel.tunnelId);
    const totalLimit = tunnel.num || 0;

    // 无限制时返回0%
    if (tunnel.num === 99999) return 0;

    return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
  };

  const formatResetTime = (resetDay?: number): string => {
    if (resetDay === undefined || resetDay === null) return "";
    if (resetDay === 0) return "不重置";

    const now = new Date();
    const currentDay = now.getDate();

    let daysUntilReset: number;

    if (resetDay > currentDay) {
      daysUntilReset = resetDay - currentDay;
    } else if (resetDay < currentDay) {
      const nextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        resetDay,
      );
      const diffTime = nextMonth.getTime() - now.getTime();

      daysUntilReset = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      daysUntilReset = 0;
    }

    if (daysUntilReset === 0) {
      return "今日重置";
    } else if (daysUntilReset === 1) {
      return "明日重置";
    } else {
      return `${daysUntilReset}天后重置`;
    }
  };

  const groupedForwards = () => {
    const groups: {
      [key: string]: { tunnelName: string; forwards: Forward[] };
    } = {};

    forwardList.forEach((forward) => {
      const tunnelName = forward.tunnelName || "未知隧道";

      if (!groups[tunnelName]) {
        groups[tunnelName] = {
          tunnelName,
          forwards: [],
        };
      }
      groups[tunnelName].forwards.push(forward);
    });

    return Object.values(groups);
  };

  const formatInAddress = (ipString: string, port: number): string => {
    if (!ipString) return "";

    const items = ipString
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item);

    if (items.length === 0) return "";

    // 检查第一项是否已经包含端口（格式：IP:端口）
    const firstItem = items[0];
    const hasPort = /:\d+$/.test(firstItem);

    if (hasPort) {
      // inIp 已经包含完整的 IP:Port 组合
      if (items.length === 1) {
        return items[0];
      }

      return `${items[0]} (+${items.length - 1}个)`;
    }

    // inIp 只包含IP，需要添加端口（兼容旧数据）
    if (!port) return "";

    if (items.length === 1) {
      const ip = items[0];

      if (ip.includes(":") && !ip.startsWith("[")) {
        return `[${ip}]:${port}`;
      } else {
        return `${ip}:${port}`;
      }
    }

    const firstIp = items[0];
    let formattedFirstIp: string;

    if (firstIp.includes(":") && !firstIp.startsWith("[")) {
      formattedFirstIp = `[${firstIp}]`;
    } else {
      formattedFirstIp = firstIp;
    }

    return `${formattedFirstIp}:${port} (+${items.length - 1}个)`;
  };

  const formatRemoteAddress = (remoteAddr: string): string => {
    if (!remoteAddr) return "";

    const addresses = remoteAddr
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr);

    if (addresses.length === 0) return "";

    if (addresses.length === 1) {
      return addresses[0];
    }

    return `${addresses[0]} (+${addresses.length - 1})`;
  };

  const hasMultipleIps = (ipString: string): boolean => {
    if (!ipString) return false;
    const ips = ipString
      .split(",")
      .map((ip) => ip.trim())
      .filter((ip) => ip);

    return ips.length > 1;
  };

  const hasMultipleRemoteAddresses = (remoteAddr: string): boolean => {
    if (!remoteAddr) return false;
    const addresses = remoteAddr
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr);

    return addresses.length > 1;
  };

  const showAddressModal = (ipString: string, port: number, title: string) => {
    if (!ipString) return;

    const items = ipString
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item);

    if (items.length <= 1) {
      copyToClipboard(formatInAddress(ipString, port));

      return;
    }

    // 检查是否已经包含端口
    const hasPort = /:\d+$/.test(items[0]);

    let formattedList: AddressItem[];

    if (hasPort) {
      // 已经包含完整的 IP:Port 组合，直接使用
      formattedList = items.map((item, index) => ({
        id: index,
        ip: item,
        address: item,
        copying: false,
      }));
    } else {
      // 只包含IP，需要添加端口
      formattedList = items.map((ip, index) => {
        let formattedAddress: string;

        if (ip.includes(":") && !ip.startsWith("[")) {
          formattedAddress = `[${ip}]:${port}`;
        } else {
          formattedAddress = `${ip}:${port}`;
        }

        return {
          id: index,
          ip: ip,
          address: formattedAddress,
          copying: false,
        };
      });
    }

    setAddressList(formattedList);
    setAddressModalTitle(`${title} (${items.length}个)`);
    setAddressModalOpen(true);
  };

  const showRemoteAddressModal = (remoteAddr: string, title: string) => {
    if (!remoteAddr) return;

    const addresses = remoteAddr
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr);

    if (addresses.length <= 1) {
      copyToClipboard(remoteAddr);

      return;
    }

    const formattedList = addresses.map((address, index) => {
      return {
        id: index,
        ip: address,
        address: address,
        copying: false,
      };
    });

    setAddressList(formattedList);
    setAddressModalTitle(`${title} (${addresses.length}个)`);
    setAddressModalOpen(true);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`已复制`);
    } catch {
      toast.error("复制失败");
    }
  };

  const copyAddress = async (addressItem: AddressItem) => {
    try {
      setAddressList((prev) =>
        prev.map((item) =>
          item.id === addressItem.id ? { ...item, copying: true } : item,
        ),
      );
      await copyToClipboard(addressItem.address);
    } catch {
      toast.error("复制失败");
    } finally {
      setAddressList((prev) =>
        prev.map((item) =>
          item.id === addressItem.id ? { ...item, copying: false } : item,
        ),
      );
    }
  };

  const copyAllAddresses = async () => {
    if (addressList.length === 0) return;
    const allAddresses = addressList.map((item) => item.address).join("\n");

    await copyToClipboard(allAddresses);
  };

  const calculateForwardBillingFlow = (forward: Forward): number => {
    if (!forward) return 0;

    const inFlow = forward.inFlow || 0;
    const outFlow = forward.outFlow || 0;

    // 后端已按计费类型处理流量，前端直接使用入站+出站总和
    return inFlow + outFlow;
  };

  if (loading) {
    return (
      <div className="px-3 lg:px-6 flex-grow pt-2 lg:pt-4">
        <PageLoadingState message="正在加载数据..." />
      </div>
    );
  }

  return (
    <AnimatedPage>
      {announcement && <AnnouncementBanner announcement={announcement} />}
      {announcement && (
        <AnnouncementModal
          announcement={announcement}
          isOpen={isAnnouncementModalOpen}
          onClose={() => setIsAnnouncementModalOpen(false)}
          onDontShowAgain={dismissAnnouncementModal}
        />
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
        <MetricCard
          icon={<Database size={17} />}
          title="总流量"
          tone="primary"
          value={formatFlowLimit(userInfo.flow, userInfo.flowMiB)}
        />

        <MetricCard
          bottomContent={
            <div className="mt-1">
              {renderProgressBar(
                calculateUsagePercentage("flow"),
                "sm",
                userInfo.flow === 99999 && !userInfo.flowMiB,
              )}
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-default-500 truncate">
                  {userInfo.flow === 99999 && !userInfo.flowMiB
                    ? "无限制"
                    : `${calculateUsagePercentage("flow").toFixed(1)}%`}
                </p>
                {userInfo.flowResetTime !== undefined &&
                  userInfo.flowResetTime !== null && (
                    <div className="text-xs text-default-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className="truncate">
                        {formatResetTime(userInfo.flowResetTime)}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          }
          icon={<TrendingUp size={17} />}
          title="已用流量"
          tone="success"
          value={formatFlow(calculateUserTotalUsedFlow())}
        />

        <MetricCard
          icon={<ArrowLeftRight size={17} />}
          title="规则配额"
          tone="secondary"
          value={formatNumber(userInfo.num || 0)}
        />

        <MetricCard
          bottomContent={
            <div className="mt-1">
              {renderProgressBar(
                calculateUsagePercentage("forwards"),
                "sm",
                userInfo.num === 99999,
              )}
              <p className="text-xs text-default-500 mt-1 truncate">
                {userInfo.num === 99999
                  ? "无限制"
                  : `${calculateUsagePercentage("forwards").toFixed(1)}%`}
              </p>
            </div>
          }
          icon={<ListChecks size={17} />}
          title="已用规则"
          tone="warning"
          value={forwardList.length}
        />
      </div>

      <FlowChartCard
        chartData={processFlowChartData()}
        formatFlow={formatFlow}
        statisticsFlowsCount={statisticsFlows.length}
      />

      {isAdmin && nodeExpiryReminders.length > 0 && (
        <Card className="mb-6 lg:mb-8 border-warning-line bg-warning-soft">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
              <div className="flex items-center gap-2">
                <IconTile size="lg" tone="warning">
                  <TriangleAlert size={20} />
                </IconTile>
                <div>
                  <h2 className="text-lg lg:text-xl font-semibold text-foreground">
                    节点到期提醒
                  </h2>
                  <p className="text-sm text-default-500">
                    展示 7
                    天内需要续费或已经逾期的节点，基于月付/季付/年付周期自动推算
                  </p>
                </div>
              </div>
              <Chip className="w-fit" color="warning">
                {nodeExpiryReminders.length} 个提醒
              </Chip>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {nodeExpiryReminders.slice(0, 6).map(renderNodeExpiryCard)}
            </div>
            {nodeExpiryReminders.length > 6 && (
              <p className="mt-4 text-xs text-default-500">
                还有 {nodeExpiryReminders.length - 6}{" "}
                个节点未展开显示，可前往节点页面继续处理。
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* 隧道权限 - 管理员不显示 */}
      {!isAdmin && (
        <Card className="mb-6 lg:mb-8">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              <h2 className="text-lg lg:text-xl font-semibold text-foreground">
                隧道权限
              </h2>
              <Chip size="sm">{userTunnels.length}</Chip>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            {userTunnels.length === 0 ? (
              <PageEmptyState className="h-48" message="暂无隧道权限" />
            ) : (
              <div className="space-y-3">
                {userTunnels.map((tunnel) => {
                  const tunnelExpStatus = getExpStatus(tunnel.expTime);

                  return (
                    <div
                      key={tunnel.id}
                      className="border border-divider rounded-lg p-3 lg:p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {tunnel.tunnelName} ID: {tunnel.id}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Chip
                              color={
                                tunnel.tunnelFlow === 1 ? "primary" : "warning"
                              }
                              size="sm"
                            >
                              {tunnel.tunnelFlow === 1
                                ? "单向计费"
                                : "双向计费"}
                            </Chip>
                            <Chip dot color={tunnelExpStatus.tone} size="sm">
                              {tunnelExpStatus.text}
                            </Chip>
                            {tunnel.flowResetTime !== undefined &&
                              tunnel.flowResetTime !== null && (
                                <span className="text-xs text-default-500">
                                  {formatResetTime(tunnel.flowResetTime)}
                                </span>
                              )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                        <div>
                          <p className="text-sm text-default-600 mb-1">
                            流量配额
                          </p>
                          <p className="font-semibold text-foreground">
                            {formatFlowLimit(tunnel.flow, tunnel.flowMiB)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-default-600 mb-1">
                            已用流量
                          </p>
                          <p className="font-semibold text-foreground">
                            {formatFlow(calculateTunnelUsedFlow(tunnel))}
                          </p>
                          <div className="mt-1">
                            {renderProgressBar(
                              calculateTunnelFlowPercentage(tunnel),
                              "sm",
                              tunnel.flow === 99999 && !tunnel.flowMiB,
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-default-600 mb-1">
                            规则配额
                          </p>
                          <p className="font-semibold text-foreground">
                            {formatNumber(tunnel.num)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-default-600 mb-1">
                            已用规则
                          </p>
                          <p className="font-semibold text-foreground">
                            {getTunnelUsedForwards(tunnel.tunnelId)}
                          </p>
                          <div className="mt-1">
                            {renderProgressBar(
                              calculateTunnelForwardPercentage(tunnel),
                              "sm",
                              tunnel.num === 99999,
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* 规则配置 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            <h2 className="text-lg lg:text-xl font-semibold text-foreground">
              规则配置
            </h2>
            <Chip size="sm">{forwardList.length}</Chip>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {groupedForwards().length === 0 ? (
            <PageEmptyState className="h-48" message="暂无规则配置" />
          ) : (
            <div className="space-y-4">
              {groupedForwards().map((group) => (
                <div
                  key={group.tunnelName}
                  className="border border-divider rounded-lg p-3 lg:p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-foreground">
                      {group.tunnelName}
                    </h3>
                    <Chip color="primary" size="sm">
                      {group.forwards.length} 个规则
                    </Chip>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {group.forwards.map((forward) => (
                      <div
                        key={forward.id}
                        className="bg-content1 border border-divider rounded-lg p-3 transition-shadow hover:shadow-sm"
                      >
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium text-foreground text-sm mb-2 truncate">
                              {forward.name}
                            </h4>
                            <div className="space-y-1">
                              <button
                                className={`block max-w-full px-2 py-2 text-left bg-content1 rounded-lg border border-divider font-mono text-xs truncate text-foreground transition-colors ${hasMultipleIps(forward.inIp) ? "cursor-pointer hover:bg-default-soft" : ""}`}
                                disabled={!hasMultipleIps(forward.inIp)}
                                title={formatInAddress(
                                  forward.inIp,
                                  forward.inPort,
                                )}
                                type="button"
                                onClick={() =>
                                  showAddressModal(
                                    forward.inIp,
                                    forward.inPort,
                                    "入口地址",
                                  )
                                }
                              >
                                {formatInAddress(forward.inIp, forward.inPort)}
                              </button>
                              <div className="text-center text-default-400 text-xs">
                                ↓
                              </div>
                              <button
                                className={`block max-w-full px-2 py-2 text-left bg-content1 rounded-lg border border-divider font-mono text-xs truncate text-foreground transition-colors ${hasMultipleRemoteAddresses(forward.remoteAddr) ? "cursor-pointer hover:bg-default-soft" : ""}`}
                                disabled={
                                  !hasMultipleRemoteAddresses(
                                    forward.remoteAddr,
                                  )
                                }
                                title={formatRemoteAddress(forward.remoteAddr)}
                                type="button"
                                onClick={() =>
                                  showRemoteAddressModal(
                                    forward.remoteAddr,
                                    "出口地址",
                                  )
                                }
                              >
                                {formatRemoteAddress(forward.remoteAddr)}
                              </button>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-divider">
                            <div className="grid grid-cols-3 gap-1 text-xs">
                              <div className="text-center">
                                <div className="text-default-500 mb-1">
                                  上传
                                </div>
                                <div className="font-medium text-success-ink truncate">
                                  {formatFlow(forward.inFlow || 0)}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-default-500 mb-1">
                                  下载
                                </div>
                                <div className="font-medium text-warning-ink truncate">
                                  {formatFlow(forward.outFlow || 0)}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-default-500 mb-1">
                                  计费
                                </div>
                                <div className="font-medium text-primary truncate">
                                  {formatFlow(
                                    calculateForwardBillingFlow(forward),
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 地址列表弹窗 */}
      <Modal
        backdrop="blur"
        isOpen={addressModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onClose={() => setAddressModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="text-base">{addressModalTitle}</ModalHeader>
          <ModalBody className="pb-6">
            <div className="mb-4 text-right">
              <Button size="sm" onPress={copyAllAddresses}>
                复制全部
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {addressList.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 border border-divider rounded-lg"
                >
                  <code className="font-mono text-sm flex-1 mr-3 text-foreground">
                    {item.address}
                  </code>
                  <Button
                    isLoading={item.copying}
                    size="sm"
                    variant="light"
                    onPress={() => copyAddress(item)}
                  >
                    复制
                  </Button>
                </div>
              ))}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </AnimatedPage>
  );
}
