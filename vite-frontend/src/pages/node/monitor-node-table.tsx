import type * as React from "react";

import { ActionIcon, Progress, Table } from "@mantine/core";
import { ArrowDown, ArrowUp, Eye } from "lucide-react";

import {
  DistroIcon,
  getDistroColor,
  parseDistroFromVersion,
} from "@/components/distro-icon";
import { Card } from "@/components/ui/card";
import { uiColor } from "@/components/ui/shared";
import {
  formatBytes,
  formatBytesPerSecond,
  formatUptime,
  getColorByUsage,
  type RealtimeNodeMetric,
} from "@/pages/node/monitor-format";

interface MonitorNodeTableProps {
  nodes: {
    id: number;
    name: string;
    connectionStatus: string;
    version?: string;
  }[];
  realtimeNodeMetrics: Record<number, RealtimeNodeMetric>;
  setDetailNodeId: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<number | null>>;
}

export function MonitorNodeTable({
  nodes,
  realtimeNodeMetrics,
  setDetailNodeId,
  setSelectedNodeId,
}: MonitorNodeTableProps) {
  return (
    <Card className="w-full">
      <div className="app-table-scroll">
        <Table aria-label="节点列表" className="app-table">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>节点</Table.Th>
              <Table.Th>实时速率</Table.Th>
              <Table.Th>累计流量</Table.Th>
              <Table.Th>连接</Table.Th>
              <Table.Th>CPU</Table.Th>
              <Table.Th>内存</Table.Th>
              <Table.Th>磁盘</Table.Th>
              <Table.Th align="center">详情</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {nodes.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <div className="p-8 text-center text-default-500">
                    暂无节点
                  </div>
                </Table.Td>
              </Table.Tr>
            ) : (
              nodes.map((node) => {
                const metric = realtimeNodeMetrics[node.id] || null;
                const isOnline = node.connectionStatus === "online";
                const live = isOnline && metric;
                const usageCell = (value?: number) => (
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    {live ? (
                      <Progress
                        className="w-12"
                        color={uiColor(getColorByUsage(value ?? 0))}
                        value={value ?? 0}
                      />
                    ) : (
                      <div className="h-1.5 w-12 rounded-full bg-default-soft" />
                    )}
                    <span className="w-10 text-right font-mono text-xs tabular-nums text-default-600">
                      {live ? `${(value ?? 0).toFixed(1)}%` : "-"}
                    </span>
                  </div>
                );

                return (
                  <Table.Tr key={node.id}>
                    <Table.Td>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${isOnline ? "bg-success" : "bg-danger"}`}
                          title={isOnline ? "在线" : "离线"}
                        />
                        <DistroIcon
                          className="h-4 w-4 flex-shrink-0"
                          distro={parseDistroFromVersion(node.version)}
                          style={{
                            color: isOnline
                              ? getDistroColor(
                                  parseDistroFromVersion(node.version),
                                )
                              : undefined,
                          }}
                        />
                        <div className="min-w-0">
                          <p className="whitespace-nowrap text-sm font-semibold text-foreground">
                            {node.name}
                          </p>
                          <p className="whitespace-nowrap text-[11px] text-default-500">
                            {live
                              ? `运行 ${formatUptime(metric.uptime)}`
                              : "离线"}
                          </p>
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div className="space-y-0.5 whitespace-nowrap font-mono text-xs tabular-nums">
                        <p className="flex items-center gap-1 text-success-ink">
                          <ArrowUp size={12} strokeWidth={2.5} />
                          {live
                            ? formatBytesPerSecond(metric.netOutSpeed)
                            : "-"}
                        </p>
                        <p className="flex items-center gap-1 text-primary-ink">
                          <ArrowDown size={12} strokeWidth={2.5} />
                          {live ? formatBytesPerSecond(metric.netInSpeed) : "-"}
                        </p>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div className="space-y-0.5 whitespace-nowrap font-mono text-xs tabular-nums text-default-600">
                        <p className="flex items-center gap-1">
                          <ArrowUp size={12} strokeWidth={2.5} />
                          {live ? formatBytes(metric.netOutBytes) : "-"}
                        </p>
                        <p className="flex items-center gap-1">
                          <ArrowDown size={12} strokeWidth={2.5} />
                          {live ? formatBytes(metric.netInBytes) : "-"}
                        </p>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div className="space-y-0.5 whitespace-nowrap font-mono text-xs tabular-nums text-default-600">
                        <p>TCP {live ? metric.tcpConns : "-"}</p>
                        <p>UDP {live ? metric.udpConns : "-"}</p>
                      </div>
                    </Table.Td>
                    <Table.Td>{usageCell(metric?.cpuUsage)}</Table.Td>
                    <Table.Td>{usageCell(metric?.memoryUsage)}</Table.Td>
                    <Table.Td>{usageCell(metric?.diskUsage)}</Table.Td>
                    <Table.Td>
                      <div className="flex justify-center">
                        <ActionIcon
                          aria-label="查看节点详情"
                          color="gray"
                          size={30}
                          variant="subtle"
                          onClick={() => {
                            setDetailNodeId(node.id);
                            setSelectedNodeId(node.id);
                          }}
                        >
                          <Eye className="h-4 w-4 text-default-500" />
                        </ActionIcon>
                      </div>
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </div>
    </Card>
  );
}
