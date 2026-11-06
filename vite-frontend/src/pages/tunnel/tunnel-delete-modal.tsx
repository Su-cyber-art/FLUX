import type * as React from "react";

import { Alert, Button, Loader, Radio, Select, Stack } from "@mantine/core";

import { type TunnelDeletePreviewApiData } from "@/api/types";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { TunnelDeleteAction, type Tunnel } from "@/pages/tunnel/presentation";

interface TunnelDeleteModalProps {
  deleteModalOpen: boolean;
  handleDeleteModalOpenChange: (open: boolean) => void;
  tunnelDeletePreview: TunnelDeletePreviewApiData | null;
  tunnelToDelete: Tunnel | null;
  deletePreviewLoading: boolean;
  deleteHasForwardDependencies: boolean;
  deletePreviewForwardCount: number;
  deleteAction: TunnelDeleteAction;
  setDeleteAction: React.Dispatch<React.SetStateAction<TunnelDeleteAction>>;
  setDeleteTargetTunnelId: React.Dispatch<React.SetStateAction<number | null>>;
  deleteReplacementTunnels: Tunnel[];
  deleteReplaceUnavailable: boolean;
  deleteTargetTunnelId: number | null;
  deleteLoading: boolean;
  confirmDelete: () => Promise<void>;
  deleteConfirmLabel:
    | "迁移规则后删除该隧道"
    | "删除规则并删除该隧道"
    | "删除该隧道";
}

export function TunnelDeleteModal({
  deleteModalOpen,
  handleDeleteModalOpenChange,
  tunnelDeletePreview,
  tunnelToDelete,
  deletePreviewLoading,
  deleteHasForwardDependencies,
  deletePreviewForwardCount,
  deleteAction,
  setDeleteAction,
  setDeleteTargetTunnelId,
  deleteReplacementTunnels,
  deleteReplaceUnavailable,
  deleteTargetTunnelId,
  deleteLoading,
  confirmDelete,
  deleteConfirmLabel,
}: TunnelDeleteModalProps) {
  return (
    <Modal
      opened={deleteModalOpen}
      size="2xl"
      onClose={() => handleDeleteModalOpenChange(false)}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-lg font-bold sm:text-xl">删除隧道</h2>
          <p className="text-xs font-normal leading-5 text-default-500 sm:text-sm">
            {tunnelDeletePreview?.tunnelName || tunnelToDelete?.name
              ? `即将删除“${tunnelDeletePreview?.tunnelName || tunnelToDelete?.name}”，删除前会先检查是否有关联规则。`
              : "删除前会先检查是否有关联规则。"}
          </p>
        </ModalHeader>
        <ModalBody className="space-y-3 sm:space-y-4">
          {deletePreviewLoading ? (
            <div className="flex items-center gap-3 rounded-xl border border-divider bg-content2/40 px-3 py-5 text-sm text-default-600 sm:px-4 sm:py-6">
              <Loader aria-label="加载中" role="status" size="sm" />
              正在检查是否有规则正在使用该隧道...
            </div>
          ) : deleteHasForwardDependencies ? (
            <>
              <Alert
                color="orange"
                title="发现关联规则"
              >{`隧道 \"${tunnelDeletePreview?.tunnelName || tunnelToDelete?.name || ""}\" 当前被 ${deletePreviewForwardCount} 条规则使用。删除前需要先处理这些规则。`}</Alert>

              {(tunnelDeletePreview?.sampleForwards?.length ?? 0) > 0 ? (
                <div className="space-y-3 rounded-xl border border-divider bg-content2/40 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      关联规则预览
                    </h3>
                    <span className="text-xs text-default-500">
                      前 {tunnelDeletePreview?.sampleForwards?.length ?? 0} 条
                    </span>
                  </div>
                  <div className="space-y-2">
                    {tunnelDeletePreview?.sampleForwards?.map((forward) => (
                      <div
                        key={forward.id}
                        className="rounded-lg border border-divider/70 bg-background/80 px-2.5 py-2 sm:px-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium text-foreground">
                            {forward.name}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-default-500">
                            :{forward.inPort || 0}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-default-500">
                          用户：
                          {forward.userName || `#${forward.userId}`}
                        </p>
                      </div>
                    ))}
                  </div>
                  {deletePreviewForwardCount >
                  (tunnelDeletePreview?.sampleForwards?.length ?? 0) ? (
                    <p className="text-xs text-default-500">
                      还有{" "}
                      {deletePreviewForwardCount -
                        (tunnelDeletePreview?.sampleForwards?.length ?? 0)}{" "}
                      条规则未展开显示。
                    </p>
                  ) : null}
                </div>
              ) : null}

              <Radio.Group
                label="处理方式"
                value={deleteAction}
                onChange={(value) => {
                  const nextAction = value as TunnelDeleteAction;

                  setDeleteAction(nextAction);
                  if (nextAction !== "replace") {
                    setDeleteTargetTunnelId(null);

                    return;
                  }

                  setDeleteTargetTunnelId(
                    deleteReplacementTunnels[0]?.id ?? null,
                  );
                }}
              >
                <Stack gap="sm" mt="xs">
                  <Radio
                    label={`保留规则，迁移到其他隧道${deleteReplaceUnavailable ? "（当前无可用目标）" : "（推荐）"}`}
                    value="replace"
                  />
                  <Radio label="直接删除这些关联规则" value="delete_forwards" />
                </Stack>
              </Radio.Group>

              {deleteReplaceUnavailable ? (
                <Alert color="orange">
                  {
                    "当前没有其他启用中的隧道可用于承接这些规则，只能删除关联规则后再删除该隧道。"
                  }
                </Alert>
              ) : null}

              {deleteAction === "replace" && !deleteReplaceUnavailable ? (
                <div className="space-y-2">
                  <Select
                    clearable
                    searchable
                    data={deleteReplacementTunnels.map((tunnel) => ({
                      value: String(tunnel.id),
                      label: tunnel.name,
                    }))}
                    label="目标隧道"
                    placeholder="请选择目标隧道"
                    value={
                      deleteTargetTunnelId ? String(deleteTargetTunnelId) : null
                    }
                    onChange={(selected) => {
                      setDeleteTargetTunnelId(
                        selected ? Number(selected) : null,
                      );
                    }}
                  />
                  <p className="text-xs text-default-500">
                    关联规则会迁移到这里，当前要删除的隧道不会出现在可选项里。
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <Alert
              color="orange"
              title="可以直接删除"
            >{`当前未发现关联规则。确认后将直接删除“${tunnelToDelete?.name || "该隧道"}”，此操作不可撤销。`}</Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={() => handleDeleteModalOpenChange(false)}
          >
            取消
          </Button>
          <Button
            color="red"
            disabled={
              deletePreviewLoading ||
              (deleteHasForwardDependencies &&
                deleteAction === "replace" &&
                (!deleteTargetTunnelId || deleteReplaceUnavailable))
            }
            loading={deleteLoading}
            onClick={confirmDelete}
          >
            {deleteLoading ? "删除中..." : deleteConfirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
