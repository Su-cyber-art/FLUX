import type * as React from "react";

import { Button } from "@mantine/core";
import { Download, HardDriveDownload, Upload } from "lucide-react";

import { SectionHeader } from "@/components/section-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BACKUP_TYPE_VALUES } from "@/pages/config/config-items";

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
    <Card className="config-section" id="config-backup">
      <CardHeader className="pb-3">
        <SectionHeader
          description="导出或导入系统数据，可按类型选择"
          icon={HardDriveDownload}
          title="数据备份与恢复"
        />
      </CardHeader>
      <CardBody className="pt-0">
        <div className="settings-row">
          <div>
            <p className="settings-row-label">导出数据</p>
            <p className="settings-row-desc">
              选择数据类型后导出为 JSON 文件（当前已选 {exportTypes.length} /{" "}
              {BACKUP_TYPE_VALUES.length}）
            </p>
          </div>
          <div>
            <Button
              leftSection={<Download size={15} />}
              loading={exporting}
              variant="default"
              onClick={() => setExportSelectorOpen(true)}
            >
              选择并导出
            </Button>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <p className="settings-row-label">导入数据</p>
            <p className="settings-row-desc">
              从备份文件恢复所选类型的数据（当前已选 {importTypes.length} /{" "}
              {BACKUP_TYPE_VALUES.length}）
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={backupFileInputRef}
              accept=".json"
              className="hidden"
              type="file"
              onChange={handleFileChange}
            />
            <Button
              leftSection={<Upload size={15} />}
              loading={importing}
              variant="default"
              onClick={() => setImportSelectorOpen(true)}
            >
              选择并导入
            </Button>
            {importFileName && (
              <span className="text-sm text-default-600">
                已选择：{importFileName}
              </span>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
