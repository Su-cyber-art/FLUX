import type * as React from "react";

import {
  ActionIcon,
  Badge,
  Button,
  Loader,
  Tooltip as MantineTooltip,
  Menu,
  Select,
} from "@mantine/core";
import {
  Activity,
  Edit,
  MoreVertical,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ServiceMonitorApiItem,
  type ServiceMonitorResultApiItem,
} from "@/api/types";
import {
  chartTooltipProps,
  type ChartSeriesColor,
} from "@/components/chart-theme";
import { SectionHeader } from "@/components/section-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

interface ServiceMonitorPanelProps {
  serviceMonitorRangeMs: number;
  setServiceMonitorRangeMs: React.Dispatch<React.SetStateAction<number>>;
  resolvedActiveMonitorId: number;
  loadMonitorResults: (
    monitorId: number,
    options?: { rangeMs?: number; limit?: number },
  ) => Promise<void>;
  handleOpenEditModal: (monitor?: ServiceMonitorApiItem) => void;
  monitorsLoading: boolean;
  detailServiceMonitors: ServiceMonitorApiItem[];
  getLatestResult: (monitorId: number) => ServiceMonitorResultApiItem | null;
  setActiveServiceMonitorId: React.Dispatch<
    React.SetStateAction<number | null>
  >;
  monitorResults: Record<number, ServiceMonitorResultApiItem[]>;
  resolvedActiveMonitor: ServiceMonitorApiItem;
  activeLatestResult: ServiceMonitorResultApiItem | null;
  activeStale: boolean;
  handleRunMonitor: (id: number) => Promise<void>;
  openResultsModal: (monitorId: number) => void;
  handleDeleteMonitor: (id: number) => Promise<void>;
  activeLatencyData: {
    time: string;
    latency: number | null;
    success: number;
  }[];
  palette: Record<ChartSeriesColor, string>;
}

export function ServiceMonitorPanel({
  serviceMonitorRangeMs,
  setServiceMonitorRangeMs,
  resolvedActiveMonitorId,
  loadMonitorResults,
  handleOpenEditModal,
  monitorsLoading,
  detailServiceMonitors,
  getLatestResult,
  setActiveServiceMonitorId,
  monitorResults,
  resolvedActiveMonitor,
  activeLatestResult,
  activeStale,
  handleRunMonitor,
  openResultsModal,
  handleDeleteMonitor,
  activeLatencyData,
  palette,
}: ServiceMonitorPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          actions={
            <>
              <Select
                required
                aria-label="时间范围"
                className="w-28"
                data={[
                  { value: String(60 * 60 * 1000), label: "1小时" },
                  {
                    value: String(6 * 60 * 60 * 1000),
                    label: "6小时",
                  },
                  {
                    value: String(24 * 60 * 60 * 1000),
                    label: "24小时",
                  },
                ]}
                value={String(serviceMonitorRangeMs)}
                onChange={(value) => {
                  const v = Number(value);

                  if (v > 0) setServiceMonitorRangeMs(v);
                }}
              />
              {resolvedActiveMonitorId != null && (
                <MantineTooltip label="刷新">
                  <ActionIcon
                    aria-label="刷新监控记录"
                    color="gray"
                    variant="subtle"
                    onClick={() => {
                      void loadMonitorResults(resolvedActiveMonitorId, {
                        rangeMs: serviceMonitorRangeMs,
                      });
                    }}
                  >
                    <RefreshCw size={16} />
                  </ActionIcon>
                </MantineTooltip>
              )}
              <Button
                leftSection={<Plus size={15} />}
                size="xs"
                variant="light"
                onClick={() => handleOpenEditModal()}
              >
                添加监控
              </Button>
            </>
          }
          description="TCP / ICMP 可用性与延迟"
          icon={Activity}
          title="服务监控"
        />
      </CardHeader>
      <CardBody className="space-y-4 pt-0">
        {monitorsLoading ? (
          <div className="flex justify-center py-8">
            <Loader size="sm" />
          </div>
        ) : detailServiceMonitors.length > 0 ? (
          <>
            {/* Monitor switcher buttons – like metric type tabs */}
            <div className="flex flex-wrap gap-2">
              {detailServiceMonitors.map((monitor) => {
                const lr = getLatestResult(monitor.id);
                const dot =
                  monitor.enabled !== 1 || !lr
                    ? "bg-default-400"
                    : lr.success === 1
                      ? "bg-success"
                      : "bg-danger";
                const isActive = monitor.id === resolvedActiveMonitorId;

                return (
                  <button
                    key={monitor.id}
                    aria-pressed={isActive}
                    className="monitor-pill"
                    type="button"
                    onClick={() => {
                      setActiveServiceMonitorId(monitor.id);
                      // Load results for this monitor if not loaded
                      if (
                        !monitorResults[monitor.id] ||
                        monitorResults[monitor.id].length <= 1
                      ) {
                        void loadMonitorResults(monitor.id, {
                          rangeMs: serviceMonitorRangeMs,
                        });
                      }
                    }}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
                    />
                    {monitor.name}
                  </button>
                );
              })}
            </div>

            {/* Active monitor info bar */}
            {resolvedActiveMonitor && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-default-soft px-3 py-2">
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                  <Badge size="sm" variant="light">
                    {resolvedActiveMonitor.type.toUpperCase()}
                  </Badge>
                  <span className="font-mono text-xs text-default-500">
                    {resolvedActiveMonitor.target}
                  </span>
                  <span className="text-xs text-default-500">
                    每秒测试，30秒上报
                  </span>
                  {activeLatestResult &&
                  Number.isFinite(activeLatestResult.latencyMs) ? (
                    <span className="font-mono text-xs font-semibold text-success-ink">
                      {activeLatestResult.latencyMs.toFixed(0)}ms
                    </span>
                  ) : null}
                  {activeStale ? (
                    <Badge color="orange" size="sm" variant="light">
                      陈旧
                    </Badge>
                  ) : null}
                  {resolvedActiveMonitor.enabled !== 1 ? (
                    <Badge color="gray" size="sm" variant="light">
                      已禁用
                    </Badge>
                  ) : null}
                </div>
                <Menu position="bottom-start">
                  <Menu.Target>
                    <ActionIcon
                      aria-label="监控操作"
                      color="gray"
                      size={30}
                      variant="subtle"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<Play className="w-4 h-4" />}
                      onClick={() =>
                        resolvedActiveMonitorId != null &&
                        handleRunMonitor(resolvedActiveMonitorId)
                      }
                    >
                      立即检查
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<Activity className="w-4 h-4" />}
                      onClick={() =>
                        resolvedActiveMonitorId != null &&
                        openResultsModal(resolvedActiveMonitorId)
                      }
                    >
                      查看记录
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<Edit className="w-4 h-4" />}
                      onClick={() =>
                        resolvedActiveMonitor &&
                        handleOpenEditModal(resolvedActiveMonitor)
                      }
                    >
                      编辑
                    </Menu.Item>
                    <Menu.Item
                      className="text-danger"
                      color="red"
                      leftSection={<Trash2 className="w-4 h-4" />}
                      onClick={() =>
                        resolvedActiveMonitorId != null &&
                        handleDeleteMonitor(resolvedActiveMonitorId)
                      }
                    >
                      删除
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </div>
            )}

            {/* Chart area – same h-64 as node metrics */}
            {activeLatencyData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={activeLatencyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" fontSize={12} />
                    <YAxis
                      fontSize={12}
                      tickFormatter={(v: number) => `${Math.round(v)}ms`}
                    />
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value: unknown) => [
                        `${Number(value).toFixed(0)}ms`,
                        "延迟",
                      ]}
                    />
                    <Line
                      connectNulls={false}
                      dataKey="latency"
                      dot={false}
                      name="延迟"
                      stroke={palette.teal}
                      strokeWidth={2}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="monitor-chart-empty">暂无检查记录</p>
            )}
          </>
        ) : (
          <p className="monitor-chart-empty">
            还没有服务监控，点击“添加监控”创建
          </p>
        )}
      </CardBody>
    </Card>
  );
}
