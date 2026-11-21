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
  ChartLine,
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
  chartAxisProps,
  chartGridProps,
  chartLineProps,
  chartTooltipProps,
  type ChartSeriesColor,
} from "@/components/chart-theme";
import { Card } from "@/components/ui/card";

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
    <Card className="dash-panel">
      <div data-flush className="dash-panel-head flex-wrap">
        <div className="min-w-0">
          <h2 className="dash-panel-title">
            服务监控
            {detailServiceMonitors.length > 0 && (
              <small>{detailServiceMonitors.length}</small>
            )}
          </h2>
          <p className="dash-panel-desc mt-0.5">TCP / ICMP 可用性与延迟</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Select
            required
            aria-label="时间范围"
            className="w-24"
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
            size="xs"
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
                size={30}
                variant="subtle"
                onClick={() => {
                  void loadMonitorResults(resolvedActiveMonitorId, {
                    rangeMs: serviceMonitorRangeMs,
                  });
                }}
              >
                <RefreshCw size={14} />
              </ActionIcon>
            </MantineTooltip>
          )}
          <Button
            leftSection={<Plus size={14} />}
            size="xs"
            variant="default"
            onClick={() => handleOpenEditModal()}
          >
            添加监控
          </Button>
        </div>
      </div>
      <div className="space-y-3 px-4 pb-4">
        {monitorsLoading ? (
          <div className="chart-empty">
            <Loader size="xs" />
            正在加载服务监控…
          </div>
        ) : detailServiceMonitors.length > 0 ? (
          <>
            {/* Monitor switcher buttons – like metric type tabs */}
            <div className="flex flex-wrap gap-1.5">
              {detailServiceMonitors.map((monitor) => {
                const lr = getLatestResult(monitor.id);
                const tone =
                  monitor.enabled !== 1 || !lr
                    ? undefined
                    : lr.success === 1
                      ? "success"
                      : "danger";
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
                    <span aria-hidden className="status-dot" data-tone={tone} />
                    {monitor.name}
                  </button>
                );
              })}
            </div>

            {/* Active monitor info bar */}
            {resolvedActiveMonitor && (
              <div className="mon-infobar justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge color="gray" size="sm" variant="light">
                    {resolvedActiveMonitor.type.toUpperCase()}
                  </Badge>
                  <span className="mono-value">
                    {resolvedActiveMonitor.target}
                  </span>
                  <span>每秒测试，30秒上报</span>
                  {activeLatestResult &&
                  Number.isFinite(activeLatestResult.latencyMs) ? (
                    <span className="font-medium tabular-nums text-foreground">
                      {activeLatestResult.latencyMs.toFixed(0)}ms
                    </span>
                  ) : null}
                  {activeStale ? (
                    <span className="status-dot" data-tone="warning">
                      陈旧
                    </span>
                  ) : null}
                  {resolvedActiveMonitor.enabled !== 1 ? (
                    <span className="status-dot">已禁用</span>
                  ) : null}
                </div>
                <Menu position="bottom-end">
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

            {/* Chart area */}
            {activeLatencyData.length > 0 ? (
              <div className="chart-frame h-[220px]">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart
                    data={activeLatencyData}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid {...chartGridProps} />
                    <XAxis
                      {...chartAxisProps}
                      dataKey="time"
                      interval="preserveStartEnd"
                      minTickGap={32}
                    />
                    <YAxis
                      {...chartAxisProps}
                      tickFormatter={(v: number) => `${Math.round(v)}ms`}
                      width={48}
                    />
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value: unknown) => [
                        `${Number(value).toFixed(0)}ms`,
                        "延迟",
                      ]}
                    />
                    <Line
                      {...chartLineProps}
                      connectNulls={false}
                      dataKey="latency"
                      name="延迟"
                      stroke={palette.teal}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="chart-empty">
                <ChartLine size={15} />
                暂无检查记录
              </p>
            )}
          </>
        ) : (
          <p className="chart-empty">
            <Activity size={15} />
            还没有服务监控，点击“添加监控”创建
          </p>
        )}
      </div>
    </Card>
  );
}
