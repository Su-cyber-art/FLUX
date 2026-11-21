import type * as React from "react";

import { ActionIcon, Progress, Table } from "@mantine/core";
import { ArrowDown, ArrowUp, ChevronRight, Server } from "lucide-react";

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

const DASH = "—";

export function MonitorNodeTable({
  nodes,
  realtimeNodeMetrics,
  setDetailNodeId,
  setSelectedNodeId,
}: MonitorNodeTableProps) {
  const openDetail = (nodeId: number) => {
    setDetailNodeId(nodeId);
    setSelectedNodeId(nodeId);
  };

  return (
    <Card className="w-full overflow-hidden">
      <div className="app-table-scroll">
        <Table
          aria-label="节点列表"
          className="app-table"
          highlightOnHover={nodes.length > 0}
          verticalSpacing={8}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>节点</Table.Th>
              <Table.Th>实时速率</Table.Th>
              <Table.Th>累计流量</Table.Th>
              <Table.Th>连接</Table.Th>
              <Table.Th>CPU</Table.Th>
              <Table.Th>内存</Table.Th>
              <Table.Th>磁盘</Table.Th>
              <Table.Th className="w-12">
                <span className="sr-only">详情</span>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {nodes.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <p className="chart-empty">
                    <Server size={15} />
                    暂无节点
                  </p>
                </Table.Td>
              </Table.Tr>
            ) : (
              nodes.map((node) => {
                const metric = realtimeNodeMetrics[node.id] || null;
                const isOnline = node.connectionStatus === "online";
                const live = isOnline && metric;
                const distro = parseDistroFromVersion(node.version);
                const usageCell = (value?: number) => (
                  <div className="mon-usage">
                    {live ? (
                      <Progress
                        color={uiColor(getColorByUsage(value ?? 0))}
                        radius="xl"
                        value={value ?? 0}
                      />
                    ) : (
                      <div className="mon-usage-track" />
                    )}
                    <span
                      className={`mon-usage-value ${live ? "" : "mon-muted"}`}
                    >
                      {live ? `${(value ?? 0).toFixed(1)}%` : DASH}
                    </span>
                  </div>
                );
                const pair = (
                  up: React.ReactNode,
                  down: React.ReactNode,
                  icons = true,
                ) => (
                  <div className={`mon-stack ${live ? "" : "mon-muted"}`}>
                    <span>
                      {icons && <ArrowUp size={11} />}
                      {live ? up : DASH}
                    </span>
                    <span>
                      {icons && <ArrowDown size={11} />}
                      {live ? down : DASH}
                    </span>
                  </div>
                );

                return (
                  <Table.Tr
                    key={node.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(node.id)}
                  >
                    <Table.Td>
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-label={isOnline ? "在线" : "离线"}
                          className="status-dot"
                          data-tone={isOnline ? "success" : "danger"}
                          role="img"
                        />
                        <DistroIcon
                          className="h-4 w-4 flex-shrink-0 text-default-400"
                          distro={distro}
                          style={{
                            color: isOnline
                              ? getDistroColor(distro)
                              : undefined,
                          }}
                        />
                        <div className="min-w-0">
                          <p className="whitespace-nowrap text-[13px] font-medium text-foreground">
                            {node.name}
                          </p>
                          <p className="whitespace-nowrap text-xs text-default-500">
                            {!isOnline
                              ? "离线"
                              : metric
                                ? `运行 ${formatUptime(metric.uptime)}`
                                : "在线 · 等待上报"}
                          </p>
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      {pair(
                        formatBytesPerSecond(metric?.netOutSpeed ?? 0),
                        formatBytesPerSecond(metric?.netInSpeed ?? 0),
                      )}
                    </Table.Td>
                    <Table.Td>
                      {pair(
                        formatBytes(metric?.netOutBytes ?? 0),
                        formatBytes(metric?.netInBytes ?? 0),
                      )}
                    </Table.Td>
                    <Table.Td>
                      <div className={`mon-stack ${live ? "" : "mon-muted"}`}>
                        <span>
                          <span className="w-8 text-default-500">TCP</span>
                          {live ? metric.tcpConns : DASH}
                        </span>
                        <span>
                          <span className="w-8 text-default-500">UDP</span>
                          {live ? metric.udpConns : DASH}
                        </span>
                      </div>
                    </Table.Td>
                    <Table.Td>{usageCell(metric?.cpuUsage)}</Table.Td>
                    <Table.Td>{usageCell(metric?.memoryUsage)}</Table.Td>
                    <Table.Td>{usageCell(metric?.diskUsage)}</Table.Td>
                    <Table.Td>
                      <ActionIcon
                        aria-label="查看节点详情"
                        color="gray"
                        size={28}
                        variant="subtle"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDetail(node.id);
                        }}
                      >
                        <ChevronRight className="h-4 w-4 text-default-500" />
                      </ActionIcon>
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
