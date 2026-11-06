import type * as React from "react";

import { Badge, Button, Select, Table } from "@mantine/core";
import { Play, RefreshCw } from "lucide-react";

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
            <div className="text-base font-semibold truncate">
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
                <span className="font-mono">
                  {formatDateTime(modalResults[0].timestamp)}
                </span>
              </div>
            ) : null}
          </div>
          {resultsMonitorId != null ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Select
                className="w-28"
                data={[
                  { value: "20", label: "20条" },
                  { value: "50", label: "50条" },
                  { value: "100", label: "100条" },
                  { value: "200", label: "200条" },
                ]}
                value={String(resultsLimit)}
                onChange={(value) => {
                  const v = Number(value);

                  if (v > 0) setResultsLimit(v);
                }}
              />
              <Button
                color="gray"
                size="xs"
                variant="light"
                onClick={() =>
                  resultsMonitorId != null && handleRunMonitor(resultsMonitorId)
                }
              >
                <Play className="w-4 h-4 mr-1" />
                检查
              </Button>
              <Button
                color="gray"
                loading={resultsLoading}
                size="xs"
                variant="light"
                onClick={() => void loadResultsForModal()}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                刷新
              </Button>
            </div>
          ) : null}
        </ModalHeader>
        <ModalBody>
          {resultsLoading ? (
            <div className="flex justify-center py-10">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : modalResults.length > 0 ? (
            <div className="app-table-scroll bg-transparent p-0 shadow-none border-none overflow-auto rounded-lg">
              <Table
                aria-label="监控记录"
                className="app-table min-w-[32rem]"
                classNames={{
                  th: "bg-transparent text-default-600 font-semibold text-sm border-b border-divider border-divider py-3  first:rounded-tl-xl last:rounded-tr-xl",
                  td: "py-3 border-b border-divider/50 group-data-[last=true]:border-b-0",
                  tr: "hover:bg-default-soft transition-colors",
                }}
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
                      <Table.Td className="text-sm whitespace-nowrap">
                        <span className="font-mono">
                          {formatDateTime(r.timestamp)}
                        </span>
                      </Table.Td>
                      <Table.Td className="min-w-20 whitespace-nowrap">
                        {r.success === 1 ? (
                          <Badge color="teal" size="sm" variant="light">
                            成功
                          </Badge>
                        ) : (
                          <Badge color="red" size="sm" variant="light">
                            失败
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td className="whitespace-nowrap">
                        <span className="font-mono text-sm">
                          {Number.isFinite(r.latencyMs)
                            ? `${r.latencyMs.toFixed(0)}ms`
                            : "-"}
                        </span>
                      </Table.Td>
                      <Table.Td>
                        <span
                          className={
                            r.errorMessage
                              ? "text-danger text-xs"
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
            <div className="text-center py-10 text-default-500">
              暂无监控记录
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="light"
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
