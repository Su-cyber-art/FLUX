import type * as React from "react";

import { Button, Loader, Select, Table } from "@mantine/core";
import { Activity, Play, RefreshCw } from "lucide-react";

import {
  type ServiceMonitorApiItem,
  type ServiceMonitorResultApiItem,
} from "@/api/types";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { formatDateTime } from "@/pages/node/monitor-format";

interface MonitorResultsModalProps {
  resultsModalOpen: boolean;
  setResultsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setResultsMonitorId: React.Dispatch<React.SetStateAction<number | null>>;
  resultsMonitor: ServiceMonitorApiItem | null;
  nodeMap: Map<
    number,
    { id: number; name: string; connectionStatus: string; version?: string }
  >;
  modalResults: ServiceMonitorResultApiItem[];
  resultsMonitorId: number | null;
  resultsLimit: number;
  setResultsLimit: React.Dispatch<React.SetStateAction<number>>;
  handleRunMonitor: (id: number) => Promise<void>;
  resultsLoading: boolean;
  loadResultsForModal: () => Promise<void>;
}

export function MonitorResultsModal({
  resultsModalOpen,
  setResultsModalOpen,
  setResultsMonitorId,
  resultsMonitor,
  nodeMap,
  modalResults,
  resultsMonitorId,
  resultsLimit,
  setResultsLimit,
  handleRunMonitor,
  resultsLoading,
  loadResultsForModal,
}: MonitorResultsModalProps) {
  return (
    <Modal
      opened={resultsModalOpen}
      size="xl"
      onClose={() => {
        setResultsModalOpen(false);
        setResultsMonitorId(null);
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold">
              监控记录
              {resultsMonitor?.name ? ` - ${resultsMonitor.name}` : ""}
            </div>
            {resultsMonitor?.nodeId && resultsMonitor.nodeId > 0 ? (
              <div className="text-xs text-default-500 truncate">
                节点:{" "}
                {nodeMap.get(resultsMonitor.nodeId)?.name ||
                  resultsMonitor.nodeId}
              </div>
            ) : (
              <div className="text-xs text-default-500 truncate">面板执行</div>
            )}

            {modalResults.length > 0 ? (
              <div className="text-xs text-default-500 truncate">
                最新检查:{" "}
                <span className="tabular-nums">
                  {formatDateTime(modalResults[0].timestamp)}
                </span>
              </div>
            ) : null}
          </div>
          {resultsMonitorId != null ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Select
                aria-label="记录条数"
                className="w-24"
                data={[
                  { value: "20", label: "20条" },
                  { value: "50", label: "50条" },
                  { value: "100", label: "100条" },
                  { value: "200", label: "200条" },
                ]}
                size="xs"
                value={String(resultsLimit)}
                onChange={(value) => {
                  const v = Number(value);

                  if (v > 0) setResultsLimit(v);
                }}
              />
              <Button
                leftSection={<Play size={13} />}
                size="xs"
                variant="default"
                onClick={() =>
                  resultsMonitorId != null && handleRunMonitor(resultsMonitorId)
                }
              >
                检查
              </Button>
              <Button
                leftSection={<RefreshCw size={13} />}
                loading={resultsLoading}
                size="xs"
                variant="default"
                onClick={() => void loadResultsForModal()}
              >
                刷新
              </Button>
            </div>
          ) : null}
        </ModalHeader>
        <ModalBody>
          {resultsLoading ? (
            <div className="chart-empty">
              <Loader size="xs" />
              正在加载记录…
            </div>
          ) : modalResults.length > 0 ? (
            <div className="app-table-scroll overflow-hidden rounded-lg border border-divider">
              <Table
                highlightOnHover
                stickyHeader
                aria-label="监控记录"
                className="app-table min-w-[32rem]"
                verticalSpacing={7}
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>时间</Table.Th>
                    <Table.Th>结果</Table.Th>
                    <Table.Th>延迟</Table.Th>
                    <Table.Th>错误</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {modalResults.map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td className="whitespace-nowrap">
                        <span className="mono-value">
                          {formatDateTime(r.timestamp)}
                        </span>
                      </Table.Td>
                      <Table.Td className="min-w-20 whitespace-nowrap">
                        <span
                          className="status-dot"
                          data-tone={r.success === 1 ? "success" : "danger"}
                        >
                          {r.success === 1 ? "成功" : "失败"}
                        </span>
                      </Table.Td>
                      <Table.Td className="whitespace-nowrap">
                        <span className="tabular-nums">
                          {Number.isFinite(r.latencyMs)
                            ? `${r.latencyMs.toFixed(0)}ms`
                            : "-"}
                        </span>
                      </Table.Td>
                      <Table.Td>
                        <span
                          className={
                            r.errorMessage
                              ? "text-danger-ink text-xs"
                              : "text-default-400 text-xs"
                          }
                        >
                          {r.errorMessage || "-"}
                        </span>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          ) : (
            <p className="chart-empty">
              <Activity size={15} />
              暂无监控记录
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="default"
            onClick={() => {
              setResultsModalOpen(false);
              setResultsMonitorId(null);
            }}
          >
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
