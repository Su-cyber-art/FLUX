import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartLine } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  chartAxisProps,
  chartGridProps,
  chartTooltipProps,
} from "@/components/chart-theme";

interface FlowChartPoint {
  time: string;
  flow: number;
}

interface FlowChartCardProps {
  hasData: boolean;
  chartData: FlowChartPoint[];
  formatFlow: (value: number) => string;
}

const compactBytes = (value: number | string) => {
  const v = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(v)) return String(value);
  if (v === 0) return "0";
  if (v < 1024) return `${v}B`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)}K`;
  if (v < 1024 ** 3) return `${(v / 1024 ** 2).toFixed(1)}M`;

  return `${(v / 1024 ** 3).toFixed(1)}G`;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="chart-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export const FlowChartCard = ({
  hasData,
  chartData,
  formatFlow,
}: FlowChartCardProps) => {
  const total = chartData.reduce((sum, point) => sum + point.flow, 0);
  const peak = chartData.reduce(
    (max, point) => (point.flow > max.flow ? point : max),
    { time: "", flow: 0 },
  );
  // An all-zero series is a flat line on an arbitrary axis; say so instead.
  const showChart = hasData && total > 0;

  return (
    <Card className="dash-panel">
      <div data-flush className="dash-panel-head">
        <div className="min-w-0">
          <h2 className="dash-panel-title">近 24 小时流量</h2>
          <p className="dash-panel-desc mt-0.5">按小时统计的计费流量</p>
        </div>
        {showChart && (
          <dl className="m-0 flex items-center gap-5">
            <Stat label="合计" value={formatFlow(total)} />
            <Stat
              label={peak.time ? `峰值 · ${peak.time}` : "峰值"}
              value={formatFlow(peak.flow)}
            />
          </dl>
        )}
      </div>
      {!showChart ? (
        <p className="chart-empty pt-2">
          <ChartLine size={15} />
          {hasData ? "近 24 小时没有产生流量" : "暂无流量统计数据"}
        </p>
      ) : (
        <div className="flow-chart chart-frame h-[220px] w-full px-2 pb-3">
          <ResponsiveContainer height="100%" width="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="dashboard-flow-fill"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    className="flow-chart-stop"
                    offset="0%"
                    stopOpacity={0.18}
                  />
                  <stop
                    className="flow-chart-stop"
                    offset="100%"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid {...chartGridProps} />
              <XAxis
                {...chartAxisProps}
                dataKey="time"
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                {...chartAxisProps}
                tickFormatter={compactBytes}
                width={48}
              />
              <Tooltip
                content={({
                  active,
                  payload,
                  label,
                }: {
                  active?: boolean;
                  payload?: Array<{ value?: number | string }>;
                  label?: string | number;
                }) => {
                  if (!active || !payload?.length) return null;
                  const value = Number(payload[0]?.value);

                  return (
                    <div style={chartTooltipProps.contentStyle}>
                      <p style={chartTooltipProps.labelStyle}>{label}</p>
                      <p className="text-[12.5px] font-semibold tabular-nums text-foreground">
                        {formatFlow(Number.isFinite(value) ? value : 0)}
                      </p>
                    </div>
                  );
                }}
                cursor={chartTooltipProps.cursor}
              />
              <Area
                activeDot={{ r: 3.5, strokeWidth: 2 }}
                className="flow-chart-area"
                dataKey="flow"
                fill="url(#dashboard-flow-fill)"
                fillOpacity={1}
                // The dashboard polls every few seconds; animating each refresh would replay the curve.
                isAnimationActive={false}
                strokeLinecap="round"
                strokeWidth={1.5}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
