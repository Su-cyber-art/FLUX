import {
  ActionIcon,
  Loader,
  Tooltip as MantineTooltip,
  SegmentedControl,
  Select,
} from "@mantine/core";
import { ChartLine, CircleAlert, RefreshCw } from "lucide-react";
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

import {
  chartAxisProps,
  chartGridProps,
  chartLineProps,
  chartTooltipProps,
  useChartPalette,
} from "@/components/chart-theme";
import { Card } from "@/components/ui/card";
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
    <Card className="dash-panel">
      <div data-flush className="dash-panel-head flex-wrap">
        <div className="min-w-0">
          <h2 className="dash-panel-title">节点指标</h2>
          <p className="dash-panel-desc mt-0.5">
            资源占用、网络与连接的历史趋势
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Select
            required
            aria-label="时间范围"
            className="w-24"
            data={[
              { value: String(15 * 60 * 1000), label: "15分钟" },
              { value: String(60 * 60 * 1000), label: "1小时" },
              { value: String(6 * 60 * 60 * 1000), label: "6小时" },
              { value: String(24 * 60 * 60 * 1000), label: "24小时" },
            ]}
            size="xs"
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
              size={30}
              variant="subtle"
              onClick={() => nodeId && onRefresh(nodeId)}
            >
              <RefreshCw size={14} />
            </ActionIcon>
          </MantineTooltip>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-1">
        <div className="max-w-full overflow-x-auto">
          <SegmentedControl
            aria-label="指标类型"
            data={METRIC_TYPE_BUTTONS.map((item) => ({
              value: item.key,
              label: item.label,
            }))}
            size="xs"
            value={activeMetricType}
            onChange={(value) => onMetricTypeChange(value as MetricType)}
          />
        </div>
        {data.length > 0 && !loading && !error && (
          <div className="chart-legend">
            {chartConfig.lines.map((line) => (
              <span
                key={line.dataKey}
                className="chart-legend-item"
                style={{ "--legend-color": line.color } as React.CSSProperties}
              >
                {line.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="chart-empty">
          <Loader size="xs" />
          正在加载指标…
        </div>
      ) : error ? (
        <p className="chart-empty" data-tone="danger">
          <CircleAlert size={15} />
          {error}
        </p>
      ) : data.length > 0 ? (
        <>
          <div className="chart-frame h-[220px] px-2 pb-3 pt-2">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart
                data={data}
                margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
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
                  tickFormatter={yAxisTickFormatter}
                  width={activeMetricType === "network" ? 72 : 44}
                />
                <Tooltip {...chartTooltipProps} formatter={tooltipFormatter} />
                {chartConfig.lines.map((line) => (
                  <Line
                    key={line.dataKey}
                    {...chartLineProps}
                    dataKey={line.dataKey}
                    name={line.name}
                    stroke={line.color}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {truncated && (
            <div className="dash-panel-foot">
              数据点过多，已截断为最近 {maxRows} 条，建议缩小时间范围。
            </div>
          )}
        </>
      ) : (
        <p className="chart-empty">
          <ChartLine size={15} />
          所选时间范围内还没有指标记录
        </p>
      )}
    </Card>
  );
});
