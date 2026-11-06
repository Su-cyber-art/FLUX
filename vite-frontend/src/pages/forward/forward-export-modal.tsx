import type * as React from "react";

import { Button, Select, Textarea } from "@mantine/core";
import { Clipboard, Upload } from "lucide-react";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { type Tunnel } from "@/pages/forward/presentation";

interface ForwardExportModalProps {
  exportModalOpen: boolean;
  setExportModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedTunnelForExport: React.Dispatch<
    React.SetStateAction<number | null>
  >;
  setExportData: React.Dispatch<React.SetStateAction<string>>;
  tunnels: Tunnel[];
  selectedTunnelForExport: number | null;
  exportData: string;
  exportLoading: boolean;
  executeExport: () => void;
  copyExportData: () => Promise<void>;
}

export function ForwardExportModal({
  exportModalOpen,
  setExportModalOpen,
  setSelectedTunnelForExport,
  setExportData,
  tunnels,
  selectedTunnelForExport,
  exportData,
  exportLoading,
  executeExport,
  copyExportData,
}: ForwardExportModalProps) {
  return (
    <Modal
      opened={exportModalOpen}
      size="2xl"
      onClose={() => {
        setExportModalOpen(false);
        setSelectedTunnelForExport(null);
        setExportData("");
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">导出规则数据</h2>
          <p className="text-small text-default-500">
            格式：目标地址|规则名称|入口端口
          </p>
        </ModalHeader>
        <ModalBody className="pb-6">
          <div className="space-y-4">
            {/* 隧道选择 */}
            <div>
              <Select
                required
                searchable
                data={tunnels.map((tunnel) => ({
                  value: tunnel.id.toString(),
                  label: tunnel.name,
                }))}
                label="选择导出隧道"
                placeholder="请选择要导出的隧道"
                value={
                  selectedTunnelForExport
                    ? selectedTunnelForExport.toString()
                    : null
                }
                onChange={(value) => {
                  const selectedKey = value as string;

                  setSelectedTunnelForExport(
                    selectedKey ? parseInt(selectedKey) : null,
                  );
                }}
              />
            </div>

            {/* 导出按钮和数据 */}
            {exportData && (
              <div className="flex justify-between items-center">
                <Button
                  disabled={!selectedTunnelForExport}
                  leftSection={<Upload className="w-4 h-4" />}
                  loading={exportLoading}
                  size="xs"
                  onClick={executeExport}
                >
                  重新生成
                </Button>
                <Button
                  color="violet"
                  leftSection={<Clipboard className="w-4 h-4" />}
                  size="xs"
                  onClick={copyExportData}
                >
                  复制
                </Button>
              </div>
            )}

            {/* 初始导出按钮 */}
            {!exportData && (
              <div className="text-right">
                <Button
                  disabled={!selectedTunnelForExport}
                  leftSection={<Upload className="w-4 h-4" />}
                  loading={exportLoading}
                  size="xs"
                  onClick={executeExport}
                >
                  生成导出数据
                </Button>
              </div>
            )}

            {/* 导出数据显示 */}
            {exportData && (
              <div className="relative">
                <Textarea
                  readOnly
                  className="font-mono text-sm"
                  classNames={{
                    input: "font-mono text-sm",
                  }}
                  maxRows={20}
                  minRows={10}
                  placeholder="暂无数据"
                  value={exportData}
                />
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={() => setExportModalOpen(false)}
          >
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
