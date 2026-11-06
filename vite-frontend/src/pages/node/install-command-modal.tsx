import type * as React from "react";

import { Button } from "@mantine/core";
import { Copy } from "lucide-react";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";

interface InstallCommandModalProps {
  installCommandModal: boolean;
  setInstallCommandModal: React.Dispatch<React.SetStateAction<boolean>>;
  currentNodeName: string;
  handleManualCopy: () => Promise<void>;
  installCommand: string;
}

export function InstallCommandModal({
  installCommandModal,
  setInstallCommandModal,
  currentNodeName,
  handleManualCopy,
  installCommand,
}: InstallCommandModalProps) {
  return (
    <Modal
      opened={installCommandModal}
      size="lg"
      onClose={() => setInstallCommandModal(false)}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2>安装节点</h2>
          <p>{currentNodeName}</p>
        </ModalHeader>
        <ModalBody>
          <ol className="install-steps">
            <li>以 root 身份登录目标服务器</li>
            <li>复制下方命令并在终端中执行</li>
            <li>安装完成后，节点状态会自动变为在线</li>
          </ol>
          <div className="code-block">
            <div className="code-block-head">
              <span>bash</span>
              <Button
                color="gray"
                leftSection={<Copy size={14} />}
                size="xs"
                variant="subtle"
                onClick={handleManualCopy}
              >
                复制
              </Button>
            </div>
            <pre>{installCommand}</pre>
          </div>
          <p className="text-xs text-default-500">
            复制按钮不可用时，点击命令区域即可全选后手动复制。
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={() => setInstallCommandModal(false)}
          >
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
