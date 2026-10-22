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

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageEmptyState } from "@/components/page-state";
import { SectionHeader } from "@/pages/dashboard/components/section-header";

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
    <div className="min-w-0 text-right">
      <p className="text-[11px] text-default-500">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          actions={
            hasData && (
              <div className="flex items-center gap-6">
                <Stat label="合计" value={formatFlow(total)} />
                <Stat
                  label={peak.time ? `峰值 · ${peak.time}` : "峰值"}
                  value={formatFlow(peak.flow)}
                />
              </div>
            )
          }
          description="按小时统计的计费流量"
          icon={ChartLine}
          title="近 24 小时流量"
        />
      </CardHeader>
      <CardBody className="pt-0">
        {!hasData ? (
          <PageEmptyState className="h-56" message="暂无流量统计数据" />
        ) : (
          <div className="flow-chart h-60 w-full lg:h-72">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
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
                      stopOpacity={0.28}
                    />
                    <stop
                      className="flow-chart-stop"
                      offset="100%"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 4" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="time"
                  interval="preserveStartEnd"
                  minTickGap={28}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  tickFormatter={compactBytes}
                  tickLine={false}
                  width={56}
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
                      <div className="rounded-lg border border-divider bg-content1 px-3 py-2 shadow-sm">
                        <p className="text-xs text-default-500">{label}</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                          {formatFlow(Number.isFinite(value) ? value : 0)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  activeDot={{ r: 4, strokeWidth: 2 }}
                  className="flow-chart-area"
                  dataKey="flow"
                  fill="url(#dashboard-flow-fill)"
                  fillOpacity={1}
                  // The dashboard polls every few seconds; animating each refresh would replay the curve.
                  isAnimationActive={false}
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
};
