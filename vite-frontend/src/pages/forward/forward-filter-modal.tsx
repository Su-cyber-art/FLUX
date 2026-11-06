import type * as React from "react";

import { Button, Select, TextInput } from "@mantine/core";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { type Tunnel } from "@/pages/forward/presentation";

interface ForwardFilterModalProps {
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchParams: {
    name: string;
    userId: string;
    tunnelId: string;
    inPort: string;
    remoteAddr: string;
  };
  setSearchParams: React.Dispatch<
    React.SetStateAction<{
      name: string;
      userId: string;
      tunnelId: string;
      inPort: string;
      remoteAddr: string;
    }>
  >;
  isAdmin: boolean;
  uniqueUsers: { id: number; name: string }[];
  tunnels: Tunnel[];
  resetSearchParams: () => void;
}

export function ForwardFilterModal({
  isSearchModalOpen,
  setIsSearchModalOpen,
  searchParams,
  setSearchParams,
  isAdmin,
  uniqueUsers,
  tunnels,
  resetSearchParams,
}: ForwardFilterModalProps) {
  return (
    <Modal
      opened={isSearchModalOpen}
      size="md"
      onClose={() => setIsSearchModalOpen(false)}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          搜索筛选用户规则
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4 py-2">
            <TextInput
              label="规则名称 (模糊)"
              placeholder="请输入规则名称关键字"
              value={searchParams.name}
              onChange={(e) =>
                setSearchParams((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
            />

            {isAdmin && (
              <Select
                searchable
                data={[
                  { value: "all", label: "全部用户" },
                  ...uniqueUsers.map((user) => ({
                    value: user.id.toString(),
                    label: user.name,
                  })),
                ]}
                label="所属用户"
                placeholder="选择用户"
                value={searchParams.userId}
                onChange={(value) => {
                  const key = value as string;

                  setSearchParams((prev) => ({
                    ...prev,
                    userId: key || "all",
                  }));
                }}
              />
            )}

            <Select
              searchable
              data={[
                { value: "all", label: "全部隧道" },
                ...tunnels.map((tunnel) => ({
                  value: tunnel.id.toString(),
                  label: tunnel.name,
                })),
              ]}
              label="所属隧道"
              placeholder="选择隧道"
              value={searchParams.tunnelId}
              onChange={(value) => {
                const key = value as string;

                setSearchParams((prev) => ({
                  ...prev,
                  tunnelId: key || "all",
                }));
              }}
            />

            <TextInput
              label="入口监听端口 (精确)"
              placeholder="请输入具体端口号"
              type="number"
              value={searchParams.inPort}
              onChange={(e) =>
                setSearchParams((prev) => ({
                  ...prev,
                  inPort: e.target.value,
                }))
              }
            />

            <TextInput
              label="目标地址或端口 (模糊)"
              placeholder="请输入目标IP、域名或端口"
              value={searchParams.remoteAddr}
              onChange={(e) =>
                setSearchParams((prev) => ({
                  ...prev,
                  remoteAddr: e.target.value,
                }))
              }
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onClick={resetSearchParams}>
            重置
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
