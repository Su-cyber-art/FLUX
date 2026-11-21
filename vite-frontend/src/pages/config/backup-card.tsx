import type * as React from "react";

import { Button } from "@mantine/core";
import { Download, Upload } from "lucide-react";

import { BACKUP_TYPE_VALUES } from "@/pages/config/config-items";
import { SettingsRow, SettingsSection } from "@/pages/config/settings-section";

interface BackupCardProps {
  exportTypes: string[];
  exporting: boolean;
  setExportSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  importTypes: string[];
  backupFileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  importing: boolean;
  setImportSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  importFileName: string;
}

export function BackupCard({
  exportTypes,
  exporting,
  setExportSelectorOpen,
  importTypes,
  backupFileInputRef,
  handleFileChange,
  importing,
  setImportSelectorOpen,
  importFileName,
}: BackupCardProps) {
  return (
    <SettingsSection
      description="导出或导入系统数据，可按类型选择"
      id="config-backup"
      title="数据备份与恢复"
    >
      <SettingsRow
        description={`选择数据类型后导出为 JSON 文件（当前已选 ${exportTypes.length} / ${BACKUP_TYPE_VALUES.length}）`}
        label="导出数据"
      >
        <Button
          leftSection={<Download size={14} />}
          loading={exporting}
          size="sm"
          variant="default"
          onClick={() => setExportSelectorOpen(true)}
        >
          选择并导出
        </Button>
      </SettingsRow>
      <SettingsRow
        description={
          <>
            从备份文件恢复所选类型的数据（当前已选 {importTypes.length} /{" "}
            {BACKUP_TYPE_VALUES.length}）
            {importFileName && (
              <span className="mt-0.5 block text-default-600">
                已选择：<span className="mono-value">{importFileName}</span>
              </span>
            )}
          </>
        }
        label="导入数据"
      >
        <input
          ref={backupFileInputRef}
          accept=".json"
          className="hidden"
          type="file"
          onChange={handleFileChange}
        />
        <Button
          leftSection={<Upload size={14} />}
          loading={importing}
          size="sm"
          variant="default"
          onClick={() => setImportSelectorOpen(true)}
        >
          选择并导入
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}
