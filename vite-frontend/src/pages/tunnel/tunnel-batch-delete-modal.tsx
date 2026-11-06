import type * as React from "react";

import {
  Alert,
  Badge,
  Button,
  Loader,
  Radio,
  Select,
  Stack,
} from "@mantine/core";

import { type TunnelDeletePreviewApiData } from "@/api/types";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { TunnelDeleteAction, type Tunnel } from "@/pages/tunnel/presentation";

interface TunnelBatchDeleteModalProps {
  batchDeleteModalOpen: boolean;
  handleBatchDeleteModalOpenChange: (open: boolean) => void;
  selectedTunnelIdList: number[];
  batchDeletePreviewLoading: boolean;
  batchDeleteHasForwardDependencies: boolean;
  batchDeleteDependentTunnelCount: number;
  batchDeleteTotalForwardCount: number;
  batchDeleteDirectDeleteTunnelCount: number;
  batchDeleteDependentItems: TunnelDeletePreviewApiData[];
  batchDeleteAction: TunnelDeleteAction;
  setBatchDeleteAction: React.Dispatch<
    React.SetStateAction<TunnelDeleteAction>
  >;
  setBatchDeleteTargetTunnelId: React.Dispatch<
    React.SetStateAction<number | null>
  >;
  batchDeleteReplacementTunnels: Tunnel[];
  batchDeleteReplaceUnavailable: boolean;
  batchDeleteTargetTunnelId: number | null;
  batchLoading: boolean;
  handleBatchDelete: () => Promise<void>;
  batchDeleteConfirmLabel: string;
}

export function TunnelBatchDeleteModal({
  batchDeleteModalOpen,
  handleBatchDeleteModalOpenChange,
  selectedTunnelIdList,
  batchDeletePreviewLoading,
  batchDeleteHasForwardDependencies,
  batchDeleteDependentTunnelCount,
  batchDeleteTotalForwardCount,
  batchDeleteDirectDeleteTunnelCount,
  batchDeleteDependentItems,
  batchDeleteAction,
  setBatchDeleteAction,
  setBatchDeleteTargetTunnelId,
  batchDeleteReplacementTunnels,
  batchDeleteReplaceUnavailable,
  batchDeleteTargetTunnelId,
  batchLoading,
  handleBatchDelete,
  batchDeleteConfirmLabel,
}: TunnelBatchDeleteModalProps) {
  return (
    <Modal
      opened={batchDeleteModalOpen}
      onClose={() => handleBatchDeleteModalOpenChange(false)}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-lg font-bold sm:text-xl">批量删除隧道</h2>
          <p className="text-xs font-normal leading-5 text-default-500 sm:text-sm">
            即将删除这 {selectedTunnelIdList.length}{" "}
            条隧道，删除前会先检查是否有关联规则。
          </p>
        </ModalHeader>
        <ModalBody className="space-y-3 sm:space-y-4">
          {batchDeletePreviewLoading ? (
            <div className="flex items-center gap-3 rounded-xl border border-divider bg-content2/40 px-3 py-5 text-sm text-default-600 sm:px-4 sm:py-6">
              <Loader aria-label="加载中" role="status" size="sm" />
              正在检查选中隧道是否有关联规则...
            </div>
          ) : batchDeleteHasForwardDependencies ? (
            <>
              <Alert
                color="orange"
                title="发现关联规则"
              >{`已选 ${selectedTunnelIdList.length} 条隧道，其中 ${batchDeleteDependentTunnelCount} 条仍被规则使用，共 ${batchDeleteTotalForwardCount} 条规则待处理。${batchDeleteDirectDeleteTunnelCount > 0 ? `其余 ${batchDeleteDirectDeleteTunnelCount} 条会直接删除。` : ""}`}</Alert>

              <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-divider bg-content2/40 p-3 sm:max-h-72 sm:p-4">
                {batchDeleteDependentItems.map((item) => (
                  <div
                    key={item.tunnelId}
                    className="rounded-lg border border-divider/70 bg-background/80 p-2.5 sm:p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.tunnelName}
                        </p>
                        <p className="mt-1 text-xs text-default-500">
                          {item.forwardCount} 条规则依赖
                        </p>
                      </div>
                      <Badge color="orange" size="sm" variant="light">
                        有关联
                      </Badge>
                    </div>

                    {item.sampleForwards.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {item.sampleForwards.map((forward) => (
                          <div
                            key={forward.id}
                            className="rounded-md bg-content1 px-2.5 py-2 sm:px-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-xs font-medium text-foreground">
                                {forward.name}
                              </span>
                              <span className="shrink-0 font-mono text-[11px] text-default-500">
                                :{forward.inPort || 0}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-default-500">
                              用户：
                              {forward.userName || `#${forward.userId}`}
                            </p>
                          </div>
                        ))}
                        {item.forwardCount > item.sampleForwards.length ? (
                          <p className="text-[11px] text-default-500">
                            还有{" "}
                            {item.forwardCount - item.sampleForwards.length}{" "}
                            条规则未展开显示。
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <Radio.Group
                label="处理方式"
                value={batchDeleteAction}
                onChange={(value) => {
                  const nextAction = value as TunnelDeleteAction;

                  setBatchDeleteAction(nextAction);
                  if (nextAction !== "replace") {
                    setBatchDeleteTargetTunnelId(null);

                    return;
                  }

                  setBatchDeleteTargetTunnelId(
                    batchDeleteReplacementTunnels[0]?.id ?? null,
                  );
                }}
              >
                <Stack gap="sm" mt="xs">
                  <Radio
                    label={`保留规则，统一迁移到其他隧道${batchDeleteReplaceUnavailable ? "（当前无可用目标）" : "（推荐）"}`}
                    value="replace"
                  />
                  <Radio label="直接删除这些关联规则" value="delete_forwards" />
                </Stack>
              </Radio.Group>

              {batchDeleteReplaceUnavailable ? (
                <Alert color="orange">
                  {
                    "当前没有可承接这些规则的启用隧道，只能删除关联规则后再删除所选隧道。"
                  }
                </Alert>
              ) : null}

              {batchDeleteAction === "replace" &&
              !batchDeleteReplaceUnavailable ? (
                <div className="space-y-2">
                  <Select
                    clearable
                    searchable
                    data={batchDeleteReplacementTunnels.map((tunnel) => ({
                      value: String(tunnel.id),
                      label: tunnel.name,
                    }))}
                    label="目标隧道"
                    placeholder="请选择目标隧道"
                    value={
                      batchDeleteTargetTunnelId
                        ? String(batchDeleteTargetTunnelId)
                        : null
                    }
                    onChange={(selected) => {
                      setBatchDeleteTargetTunnelId(
                        selected ? Number(selected) : null,
                      );
                    }}
                  />
                  <p className="text-xs text-default-500">
                    所有关联规则都会迁移到这里，删除列表中的隧道不会出现在可选项里。
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <Alert
              color="orange"
              title="可以直接删除"
            >{`已选 ${selectedTunnelIdList.length} 条隧道，当前未发现关联规则。确认后将直接删除这些隧道，此操作不可撤销。`}</Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="gray"
            variant="subtle"
            onClick={() => handleBatchDeleteModalOpenChange(false)}
          >
            取消
          </Button>
          <Button
            color="red"
            disabled={
              batchDeletePreviewLoading ||
              (batchDeleteHasForwardDependencies &&
                batchDeleteAction === "replace" &&
                (!batchDeleteTargetTunnelId || batchDeleteReplaceUnavailable))
            }
            loading={batchLoading}
            onClick={handleBatchDelete}
          >
            {batchLoading ? "删除中..." : batchDeleteConfirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
