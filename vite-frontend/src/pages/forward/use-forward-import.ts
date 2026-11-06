import { useState } from "react";

import { createForward } from "@/api";
import toast from "@/lib/notifications";
import { type ImportFormat } from "@/pages/forward/forward-import-modal";
import {
  convertNyItemToForwardInput,
  parseNyFormatData,
} from "@/pages/forward/import-format";

export function useForwardImport({
  refreshForwardList,
}: {
  refreshForwardList: (lod?: boolean) => Promise<void>;
}) {
  // 导出相关状态
  // 导入相关状态
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importFormat, setImportFormat] = useState<ImportFormat>("flvx");
  const [selectedTunnelForImport, setSelectedTunnelForImport] = useState<
    number | null
  >(null);
  const [importResults, setImportResults] = useState<
    Array<{
      line: string;
      success: boolean;
      message: string;
      forwardName?: string;
    }>
  >([]);
  // 导出规则数据
  // 执行导出
  // 复制导出数据
  // 导入规则数据
  const handleImport = () => {
    setImportData("");
    setImportResults([]);
    setSelectedTunnelForImport(null);
    setImportModalOpen(true);
  };
  // 执行导入
  const executeImport = async () => {
    if (!importData.trim()) {
      toast.error("请输入要导入的数据");

      return;
    }

    if (!selectedTunnelForImport) {
      toast.error("请选择要导入的隧道");

      return;
    }

    setImportLoading(true);
    setImportResults([]);

    try {
      if (importFormat === "ny") {
        const parsedItems = parseNyFormatData(importData);

        if (parsedItems.length === 0) {
          toast.error("未解析到有效的ny格式数据");

          setImportLoading(false);

          return;
        }

        for (const item of parsedItems) {
          if (item.error) {
            setImportResults((prev) => [
              {
                line: item.line,
                success: false,
                message: item.error || "解析失败",
              },
              ...prev,
            ]);

            continue;
          }

          if (!item.parsed) {
            setImportResults((prev) => [
              {
                line: item.line,
                success: false,
                message: "解析失败",
              },
              ...prev,
            ]);

            continue;
          }

          const parsedNyItem = item.parsed;
          const nyForwardInput = convertNyItemToForwardInput(parsedNyItem);

          try {
            const response = await createForward({
              name: nyForwardInput.name,
              tunnelId: selectedTunnelForImport,
              inPort: nyForwardInput.inPort,
              remoteAddr: nyForwardInput.remoteAddr,
              strategy: nyForwardInput.strategy,
            });

            if (response.code === 0) {
              setImportResults((prev) => [
                {
                  line: item.line,
                  success: true,
                  message: `创建成功 (${parsedNyItem.dest.length}个目标)`,
                  forwardName: nyForwardInput.name,
                },
                ...prev,
              ]);
            } else {
              setImportResults((prev) => [
                {
                  line: item.line,
                  success: false,
                  message: response.msg || "创建失败",
                },
                ...prev,
              ]);
            }
          } catch {
            setImportResults((prev) => [
              {
                line: item.line,
                success: false,
                message: "网络错误，创建失败",
              },
              ...prev,
            ]);
          }
        }
      } else {
        const lines = importData
          .trim()
          .split("\n")
          .filter((line) => line.trim());

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const parts = line.split("|");

          if (parts.length < 2) {
            setImportResults((prev) => [
              {
                line,
                success: false,
                message: "格式错误：需要至少包含目标地址和规则名称",
              },
              ...prev,
            ]);
            continue;
          }

          const [remoteAddr, name, inPort] = parts;

          if (!remoteAddr.trim() || !name.trim()) {
            setImportResults((prev) => [
              {
                line,
                success: false,
                message: "目标地址和规则名称不能为空",
              },
              ...prev,
            ]);
            continue;
          }

          const addresses = remoteAddr.trim().split(",");
          const addressPattern = /^[^:]+:\d+$/;
          const isValidFormat = addresses.every((addr) =>
            addressPattern.test(addr.trim()),
          );

          if (!isValidFormat) {
            setImportResults((prev) => [
              {
                line,
                success: false,
                message:
                  "目标地址格式错误，应为 地址:端口 格式，多个地址用逗号分隔",
              },
              ...prev,
            ]);
            continue;
          }

          try {
            let portNumber: number | null = null;

            if (inPort && inPort.trim()) {
              const port = parseInt(inPort.trim());

              if (isNaN(port) || port < 1 || port > 65535) {
                setImportResults((prev) => [
                  {
                    line,
                    success: false,
                    message: "入口端口格式错误，应为1-65535之间的数字",
                  },
                  ...prev,
                ]);
                continue;
              }
              portNumber = port;
            }

            const response = await createForward({
              name: name.trim(),
              tunnelId: selectedTunnelForImport,
              inPort: portNumber,
              remoteAddr: remoteAddr.trim(),
              strategy: "fifo",
            });

            if (response.code === 0) {
              setImportResults((prev) => [
                {
                  line,
                  success: true,
                  message: "创建成功",
                  forwardName: name.trim(),
                },
                ...prev,
              ]);
            } else {
              setImportResults((prev) => [
                {
                  line,
                  success: false,
                  message: response.msg || "创建失败",
                },
                ...prev,
              ]);
            }
          } catch {
            setImportResults((prev) => [
              {
                line,
                success: false,
                message: "网络错误，创建失败",
              },
              ...prev,
            ]);
          }
        }
      }

      toast.success("导入执行完成");

      await refreshForwardList(false);
    } catch {
      toast.error("导入过程中发生错误");
    } finally {
      setImportLoading(false);
    }
  };

  return {
    importModalOpen,
    setImportModalOpen,
    importData,
    setImportData,
    importLoading,
    importFormat,
    setImportFormat,
    selectedTunnelForImport,
    setSelectedTunnelForImport,
    importResults,
    setImportResults,
    handleImport,
    executeImport,
  };
}
