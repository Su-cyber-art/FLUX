import type * as React from "react";

import { Button, Select } from "@mantine/core";

import { type ReleaseChannel } from "@/api";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { type Node } from "@/pages/node/presentation";

interface InstallSelectorModalProps {
  installSelectorOpen: boolean;
  setInstallSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  installTargetNode: Node | null;
  installChannel: ReleaseChannel;
  setInstallChannel: React.Dispatch<React.SetStateAction<ReleaseChannel>>;
  handleConfirmInstallCommand: () => Promise<void>;
}

export function InstallSelectorModal({
  installSelectorOpen,
  setInstallSelectorOpen,
  installTargetNode,
  installChannel,
  setInstallChannel,
  handleConfirmInstallCommand,
}: InstallSelectorModalProps) {
  return (
    <Modal
      opened={installSelectorOpen}
      size="md"
      onClose={() => setInstallSelectorOpen(false)}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">
            选择安装通道
            {installTargetNode ? ` - ${installTargetNode.name}` : ""}
          </h2>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Select
              data={[
                {
                  value: "stable",
                  label: "正式版（纯数字版本，如 2.1.4）",
                },
                { value: "dev", label: "测试版（含 alpha / beta / rc）" },
              ]}
              label="版本通道"
              value={installChannel}
              onChange={(value) => {
                const selected = value as ReleaseChannel;

                setInstallChannel(selected || "stable");
              }}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={() => setInstallSelectorOpen(false)}
          >
            取消
          </Button>
          <Button onClick={handleConfirmInstallCommand}>生成命令</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
