import type * as React from "react";

import { Button, Loader, Select } from "@mantine/core";

import { type ReleaseChannel } from "@/api";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";

interface NodeUpgradeModalProps {
  upgradeModalOpen: boolean;
  setUpgradeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  upgradeTarget: "single" | "batch";
  selectedIds: Set<number>;
  releasesLoading: boolean;
  releaseChannel: ReleaseChannel;
  setReleaseChannel: React.Dispatch<React.SetStateAction<ReleaseChannel>>;
  setSelectedVersion: React.Dispatch<React.SetStateAction<string>>;
  loadReleasesByChannel: (channel: ReleaseChannel) => Promise<void>;
  releases: {
    version: string;
    name: string;
    publishedAt: string;
    prerelease: boolean;
    channel: ReleaseChannel;
  }[];
  selectedVersion: string;
  handleConfirmUpgrade: () => Promise<void>;
}

export function NodeUpgradeModal({
  upgradeModalOpen,
  setUpgradeModalOpen,
  upgradeTarget,
  selectedIds,
  releasesLoading,
  releaseChannel,
  setReleaseChannel,
  setSelectedVersion,
  loadReleasesByChannel,
  releases,
  selectedVersion,
  handleConfirmUpgrade,
}: NodeUpgradeModalProps) {
  return (
    <Modal
      opened={upgradeModalOpen}
      size="md"
      onClose={() => setUpgradeModalOpen(false)}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">
            {upgradeTarget === "batch"
              ? `批量升级 (${selectedIds.size} 个节点)`
              : "升级节点"}
          </h2>
        </ModalHeader>
        <ModalBody>
          {releasesLoading ? (
            <div className="flex justify-center py-8">
              <Loader aria-label="加载中" role="status" size="lg" />
            </div>
          ) : (
            <div className="space-y-4">
              <Select
                data={[
                  {
                    value: "stable",
                    label: "正式版（纯数字版本，如 2.1.4）",
                  },
                  {
                    value: "dev",
                    label: "测试版（含 alpha / beta / rc）",
                  },
                ]}
                label="版本通道"
                value={releaseChannel}
                onChange={(value) => {
                  const selected = (value as ReleaseChannel) || "stable";

                  setReleaseChannel(selected);
                  setSelectedVersion("");
                  void loadReleasesByChannel(selected);
                }}
              />
              <Select
                clearable
                searchable
                data={releases.map((r) => ({
                  value: String(r.version),
                  label: r.version,
                }))}
                label="选择版本"
                placeholder="留空则使用当前通道最新版本"
                value={selectedVersion ? selectedVersion : null}
                onChange={(value) => {
                  const selected = value as string;

                  setSelectedVersion(selected || "");
                }}
              />
              <p className="text-sm text-default-500">
                {selectedVersion
                  ? `将升级到版本 ${selectedVersion}`
                  : `未选择版本，将自动使用最新${releaseChannel === "stable" ? "正式" : "测试"}版`}
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={() => setUpgradeModalOpen(false)}
          >
            取消
          </Button>
          <Button
            color="orange"
            disabled={releasesLoading}
            onClick={handleConfirmUpgrade}
          >
            确认升级
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
