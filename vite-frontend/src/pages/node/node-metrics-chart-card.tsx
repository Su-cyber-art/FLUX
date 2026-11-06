import {
  ActionIcon,
  Loader,
  Tooltip as MantineTooltip,
  SegmentedControl,
  Select,
} from "@mantine/core";
import { ChartLine, RefreshCw } from "lucide-react";
import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartTooltipProps, useChartPalette } from "@/components/chart-theme";
import { SectionHeader } from "@/components/section-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatBytesPerSecond } from "@/pages/node/monitor-format";

export type MetricType =
  | "cpu"
  | "memory"
  | "disk"
  | "network"
  | "load"
  | "connections";

export const METRICS_MAX_ROWS = 5000;

/* ─── Memoized Node Metrics Chart sub-component ─────────────────── */

export interface NodeMetricsChartCardProps {
  rangeMs: number;
  onRangeChange: (v: number) => void;
  activeMetricType: MetricType;
  onMetricTypeChange: (t: MetricType) => void;
  loading: boolean;
  error: string | null;
  truncated: boolean;
  maxRows: number;
  data: Array<Record<string, unknown>>;
  nodeId: number | null;
  onRefresh: (id: number) => void;
}

export const METRIC_TYPE_BUTTONS: { key: MetricType; label: string }[] = [
  { key: "cpu", label: "CPU" },
  { key: "memory", label: "内存" },
  { key: "disk", label: "磁盘" },
  { key: "network", label: "网络" },
  { key: "load", label: "负载" },
  { key: "connections", label: "连接" },
];

export const NodeMetricsChartCard = React.memo(function NodeMetricsChartCard({
  rangeMs,
  onRangeChange,
  activeMetricType,
  onMetricTypeChange,
  loading,
  error,
  truncated,
  maxRows,
  data,
  nodeId,
  onRefresh,
}: NodeMetricsChartCardProps) {
  const palette = useChartPalette();
  const chartConfig = (() => {
    switch (activeMetricType) {
      case "cpu":
        return {
          lines: [{ dataKey: "cpu", color: palette.blue, name: "CPU %" }],
          yAxisLabel: "使用率 (%)",
        };
      case "memory":
        return {
          lines: [{ dataKey: "memory", color: palette.violet, name: "内存 %" }],
          yAxisLabel: "使用率 (%)",
        };
      case "disk":
        return {
          lines: [{ dataKey: "disk", color: palette.orange, name: "磁盘 %" }],
          yAxisLabel: "使用率 (%)",
        };
      case "network":
        return {
          lines: [
            { dataKey: "netIn", color: palette.teal, name: "入站速度" },
            { dataKey: "netOut", color: palette.red, name: "出站速度" },
          ],
          yAxisLabel: "速度 (bytes/s)",
        };
      case "load":
        return {
          lines: [
            { dataKey: "load1", color: palette.blue, name: "负载 1m" },
            { dataKey: "load5", color: palette.violet, name: "负载 5m" },
            { dataKey: "load15", color: palette.orange, name: "负载 15m" },
          ],
          yAxisLabel: "负载值",
        };
      case "connections":
        return {
          lines: [
            { dataKey: "tcp", color: palette.blue, name: "TCP 连接" },
            { dataKey: "udp", color: palette.teal, name: "UDP 连接" },
          ],
          yAxisLabel: "连接数",
        };
    }
  })();

  const yAxisTickFormatter = (value: unknown) => {
    const n = Number(value);

    if (!Number.isFinite(n)) return "";
    switch (activeMetricType) {
      case "network":
        return formatBytesPerSecond(n);
      case "cpu":
      case "memory":
      case "disk":
        return `${n.toFixed(0)}%`;
      case "load":
        return n.toFixed(1);
      case "connections":
        return String(Math.round(n));
    }
  };

  const tooltipFormatter = (value: unknown) => {
    const n = Number(value);

    if (!Number.isFinite(n)) return "-";
    switch (activeMetricType) {
      case "network":
        return formatBytesPerSecond(n);
      case "cpu":
      case "memory":
      case "disk":
        return `${n.toFixed(1)}%`;
      case "load":
        return n.toFixed(2);
      case "connections":
        return String(Math.round(n));
    }
  };

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
                  { value: String(15 * 60 * 1000), label: "15分钟" },
                  { value: String(60 * 60 * 1000), label: "1小时" },
                  { value: String(6 * 60 * 60 * 1000), label: "6小时" },
                  { value: String(24 * 60 * 60 * 1000), label: "24小时" },
                ]}
                value={String(rangeMs)}
                onChange={(value) => {
                  const v = Number(value);

                  if (v > 0) onRangeChange(v);
                }}
              />
              <MantineTooltip label="刷新">
                <ActionIcon
                  aria-label="刷新指标"
                  color="gray"
                  loading={loading}
                  variant="subtle"
                  onClick={() => nodeId && onRefresh(nodeId)}
                >
                  <RefreshCw size={16} />
                </ActionIcon>
              </MantineTooltip>
            </>
          }
          description="资源占用、网络与连接的历史趋势"
          icon={ChartLine}
          title="节点指标"
        />
      </CardHeader>
      <CardBody className="space-y-4 pt-0">
        <div className="overflow-x-auto">
          <SegmentedControl
            aria-label="指标类型"
            data={METRIC_TYPE_BUTTONS.map((item) => ({
              value: item.key,
              label: item.label,
            }))}
            size="sm"
            value={activeMetricType}
            onChange={(value) => onMetricTypeChange(value as MetricType)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader size="sm" />
          </div>
        ) : error ? (
          <p className="monitor-chart-empty text-danger-ink">{error}</p>
        ) : data.length > 0 ? (
          <>
            <div className="h-64">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={yAxisTickFormatter} />
                  <Tooltip
                    {...chartTooltipProps}
                    formatter={tooltipFormatter}
                  />
                  {chartConfig.lines.map((line) => (
                    <Line
                      key={line.dataKey}
                      dataKey={line.dataKey}
                      dot={false}
                      name={line.name}
                      stroke={line.color}
                      strokeWidth={2}
                      type="monotone"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {truncated && (
              <div className="text-xs text-default-500">
                数据点过多，已截断为最近 {maxRows} 条，建议缩小时间范围。
              </div>
            )}
          </>
        ) : (
          <p className="monitor-chart-empty">所选时间范围内还没有指标记录</p>
        )}
      </CardBody>
    </Card>
  );
});
