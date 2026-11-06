import { useState } from "react";

import toast from "@/lib/notifications";
import { Forward } from "@/pages/forward/presentation";

export function useForwardExport({
  sortedForwards,
  copyToClipboard,
}: {
  sortedForwards: Forward[];
  copyToClipboard: (text: string, label?: string) => Promise<void>;
}) {
  // 导出相关状态
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportData, setExportData] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedTunnelForExport, setSelectedTunnelForExport] = useState<
    number | null
  >(null);
  // 导出规则数据
  const handleExport = () => {
    setSelectedTunnelForExport(null);
    setExportData("");
    setExportModalOpen(true);
  };
  // 执行导出
  const executeExport = () => {
    if (!selectedTunnelForExport) {
      toast.error("请选择要导出的隧道");

      return;
    }

    setExportLoading(true);

    try {
      // 获取要导出的规则列表
      const forwardsToExport = sortedForwards.filter(
        (forward) => forward.tunnelId === selectedTunnelForExport,
      );

      if (forwardsToExport.length === 0) {
        toast.error("所选隧道没有规则数据");
        setExportLoading(false);

        return;
      }

      // 格式化导出数据：remoteAddr|name|inPort
      const exportLines = forwardsToExport.map((forward) => {
        return `${forward.remoteAddr}|${forward.name}|${forward.inPort}`;
      });

      const exportText = exportLines.join("\n");

      setExportData(exportText);
    } catch {
      toast.error("导出失败");
    } finally {
      setExportLoading(false);
    }
  };
  // 复制导出数据
  const copyExportData = async () => {
    await copyToClipboard(exportData, "规则数据");
  };

  return {
    exportModalOpen,
    setExportModalOpen,
    exportData,
    setExportData,
    exportLoading,
    selectedTunnelForExport,
    setSelectedTunnelForExport,
    handleExport,
    executeExport,
    copyExportData,
  };
}
