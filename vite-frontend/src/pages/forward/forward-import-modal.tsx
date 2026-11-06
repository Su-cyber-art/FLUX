import type * as React from "react";

import { Button, Select, Textarea } from "@mantine/core";
import { Check, X } from "lucide-react";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { type Tunnel } from "@/pages/forward/presentation";

export type ImportFormat = "flvx" | "ny";

interface ForwardImportModalProps {
  importModalOpen: boolean;
  setImportModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  importFormat: ImportFormat;
  setImportFormat: React.Dispatch<React.SetStateAction<ImportFormat>>;
  setSelectedTunnelForImport: React.Dispatch<
    React.SetStateAction<number | null>
  >;
  setImportData: React.Dispatch<React.SetStateAction<string>>;
  setImportResults: React.Dispatch<
    React.SetStateAction<
      {
        line: string;
        success: boolean;
        message: string;
        forwardName?: string;
      }[]
    >
  >;
  tunnels: Tunnel[];
  selectedTunnelForImport: number | null;
  importData: string;
  importResults: {
    line: string;
    success: boolean;
    message: string;
    forwardName?: string;
  }[];
  importLoading: boolean;
  executeImport: () => Promise<void>;
}

export function ForwardImportModal({
  importModalOpen,
  setImportModalOpen,
  importFormat,
  setImportFormat,
  setSelectedTunnelForImport,
  setImportData,
  setImportResults,
  tunnels,
  selectedTunnelForImport,
  importData,
  importResults,
  importLoading,
  executeImport,
}: ForwardImportModalProps) {
  return (
    <Modal
      opened={importModalOpen}
      size="2xl"
      onClose={() => setImportModalOpen(false)}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">导入规则数据</h2>
          {importFormat === "flvx" ? (
            <>
              <p className="text-small text-default-500">
                格式：目标地址|规则名称|入口端口，每行一个，入口端口留空将自动分配可用端口
              </p>
              <p className="text-small text-default-400">
                目标地址支持单个地址(如：example.com:8080)或多个地址用逗号分隔(如：3.3.3.3:3,4.4.4.4:4)
              </p>
            </>
          ) : (
            <>
              <p className="text-small text-default-500">
                ny格式：JSON对象，支持多个目标地址（负载均衡），按所选隧道导入
              </p>
              <p className="text-small text-default-400">
                格式：&#123;&quot;dest&quot;:[&quot;地址:端口&quot;],&quot;listen_port&quot;:端口,&quot;name&quot;:&quot;名称&quot;&#125;（listen_port可省略，自动分配端口）
              </p>
            </>
          )}
        </ModalHeader>
        <ModalBody className="pb-6">
          <div className="space-y-4">
            {/* 格式选择 */}
            <Select
              required
              data={[
                { value: "flvx", label: "flvx格式（管道分隔）" },
                { value: "ny", label: "ny格式（JSON）" },
              ]}
              label="导入格式"
              placeholder="请选择导入格式"
              value={importFormat}
              onChange={(value) => {
                const selectedKey = value as ImportFormat;

                if (selectedKey) {
                  setImportFormat(selectedKey);
                  setSelectedTunnelForImport(null);
                  setImportData("");
                  setImportResults([]);
                }
              }}
            />

            {/* 隧道选择 - 两种格式都需要 */}
            <Select
              required
              searchable
              data={tunnels.map((tunnel) => ({
                value: tunnel.id.toString(),
                label: tunnel.name,
              }))}
              label="选择导入隧道"
              placeholder="请选择要导入的隧道"
              value={
                selectedTunnelForImport
                  ? selectedTunnelForImport.toString()
                  : null
              }
              onChange={(value) => {
                const selectedKey = value as string;

                setSelectedTunnelForImport(
                  selectedKey ? parseInt(selectedKey) : null,
                );
              }}
            />

            {/* 输入区域 */}
            <Textarea
              classNames={{
                input: "font-mono text-sm",
              }}
              label="导入数据"
              maxRows={12}
              minRows={8}
              placeholder={
                importFormat === "flvx"
                  ? "请输入要导入的规则数据，格式：目标地址|规则名称|入口端口"
                  : '请输入ny格式数据，每行一个JSON对象，如：{"dest":["1.2.3.4:80"],"listen_port":8080,"name":"规则1"}；listen_port可省略自动分配'
              }
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
            />

            {/* 导入结果 */}
            {importResults.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-semibold">导入结果</h3>
                  <span className="text-xs text-default-500">
                    成功：{importResults.filter((r) => r.success).length} /
                    总计：{importResults.length}
                  </span>
                </div>

                <div
                  className="max-h-40 overflow-y-auto space-y-1"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgb(156 163 175) transparent",
                  }}
                >
                  {importResults.map((result, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded border ${
                        result.success
                          ? "bg-success-soft border-success-line"
                          : "bg-danger-soft border-danger-line"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <Check className="w-3 h-3 text-success-ink flex-shrink-0" />
                        ) : (
                          <X className="w-3 h-3 text-danger-ink flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={`text-xs font-medium ${
                                result.success
                                  ? "text-success-ink"
                                  : "text-danger-ink"
                              }`}
                            >
                              {result.success ? "成功" : "失败"}
                            </span>
                            <span className="text-xs text-default-500">|</span>
                            <code className="text-xs font-mono text-default-600 truncate">
                              {result.line}
                            </code>
                          </div>
                          <div
                            className={`text-xs ${
                              result.success
                                ? "text-success-ink"
                                : "text-danger-ink"
                            }`}
                          >
                            {result.message}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={() => setImportModalOpen(false)}
          >
            关闭
          </Button>
          <Button
            color="orange"
            disabled={!importData.trim() || !selectedTunnelForImport}
            loading={importLoading}
            onClick={executeImport}
          >
            开始导入
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
