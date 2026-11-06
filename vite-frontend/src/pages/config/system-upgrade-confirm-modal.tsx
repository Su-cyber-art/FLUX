import type * as React from "react";

import { Button } from "@mantine/core";

import { type SystemUpgradeVersionApiData } from "@/api/types";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";

interface SystemUpgradeConfirmModalProps {
  systemUpgradeModalOpen: boolean;
  systemUpgradeExecuting: boolean;
  setSystemUpgradeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  systemUpgradeInfo: SystemUpgradeVersionApiData | null;
  systemUpgradeSelectedVersion: string;
  handleConfirmSystemUpgrade: () => Promise<void>;
}

export function SystemUpgradeConfirmModal({
  systemUpgradeModalOpen,
  systemUpgradeExecuting,
  setSystemUpgradeModalOpen,
  systemUpgradeInfo,
  systemUpgradeSelectedVersion,
  handleConfirmSystemUpgrade,
}: SystemUpgradeConfirmModalProps) {
  return (
    <Modal
      opened={systemUpgradeModalOpen}
      onClose={() => {
        if (!systemUpgradeExecuting) setSystemUpgradeModalOpen(false);
      }}
    >
      <ModalContent>
        <ModalHeader>确认面板升级</ModalHeader>
        <ModalBody>
          <div className="space-y-3 text-sm text-default-700">
            <p>
              将从 {systemUpgradeInfo?.currentVersion || "当前版本"} 升级至{" "}
              {systemUpgradeSelectedVersion ||
                systemUpgradeInfo?.latestVersion ||
                "最新版本"}
              。
            </p>
            <p>
              下载并校验镜像后，将自动备份配置与数据库，再切换服务。健康检查失败会自动恢复原版本和备份数据。
            </p>
            <p>
              切换期间面板会短暂离线，恢复后继续显示进度。关闭页面不会中断升级。
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            disabled={systemUpgradeExecuting}
            variant="subtle"
            onClick={() =>
              ((open) => {
                if (!systemUpgradeExecuting) {
                  setSystemUpgradeModalOpen(open);
                }
              })(false)
            }
          >
            取消
          </Button>
          <Button
            disabled={systemUpgradeExecuting}
            loading={systemUpgradeExecuting}
            onClick={handleConfirmSystemUpgrade}
          >
            确认升级
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
