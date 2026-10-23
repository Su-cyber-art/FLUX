import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import {
  ArrowRight,
  Network,
  Plus,
  ShieldCheck,
  SquarePen,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

import toast from "@/lib/notifications";
import { AnimatedPage } from "@/components/animated-page";
import { PageEmptyState, PageLoadingState } from "@/components/page-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SectionHeader } from "@/components/section-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@/components/ui/modal";
import { Select, SelectItem } from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";
import {
  assignGroupPermission,
  assignTunnelsToGroup,
  assignUsersToGroup,
  createTunnelGroup,
  createUserGroup,
  deleteTunnelGroup,
  deleteUserGroup,
  getAllUsers,
  getGroupPermissionList,
  getTunnelGroupList,
  getTunnelList,
  getUserGroupList,
  removeGroupPermission,
  updateTunnelGroup,
  updateUserGroup,
} from "@/api";
import { getAdminFlag } from "@/utils/session";

interface TunnelItem {
  id: number;
  name: string;
}

interface UserItem {
  id: number;
  user: string;
}

interface TunnelGroup {
  id: number;
  name: string;
  status: number;
  tunnelIds: number[];
  tunnelNames: string[];
  createdTime: number;
}

interface UserGroup {
  id: number;
  name: string;
  status: number;
  userIds: number[];
  userNames: string[];
  createdTime: number;
}

interface GroupPermission {
  id: number;
  userGroupId: number;
  userGroupName: string;
  tunnelGroupId: number;
  tunnelGroupName: string;
  createdTime: number;
}

const formatDate = (timestamp?: number): string => {
  if (!timestamp) {
    return "-";
  }

  return new Date(timestamp).toLocaleString();
};

interface GroupPanelItem {
  id: number;
  name: string;
  status: number;
  members: string[];
  createdTime: number;
}

const MEMBER_PREVIEW_LIMIT = 4;

/** One group family (tunnel or user groups): header, rows and empty state. */
function GroupPanel({
  icon,
  title,
  description,
  items,
  memberUnit,
  assignLabel,
  emptyText,
  onCreate,
  onAssign,
  onEdit,
  onDelete,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  items: GroupPanelItem[];
  memberUnit: string;
  assignLabel: string;
  emptyText: string;
  onCreate: () => void;
  onAssign: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (item: GroupPanelItem) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          actions={
            <Button
              color="primary"
              size="sm"
              startContent={<Plus size={14} />}
              variant="flat"
              onPress={onCreate}
            >
              新建
            </Button>
          }
          count={items.length}
          description={description}
          icon={icon}
          title={title}
        />
      </CardHeader>
      <CardBody className="pt-0">
        {items.length === 0 ? (
          <PageEmptyState className="min-h-32" message={emptyText} />
        ) : (
          <ul className="divide-y divide-divider overflow-hidden rounded-lg border border-divider">
            {items.map((item) => {
              const hidden = item.members.length - MEMBER_PREVIEW_LIMIT;

              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-default-soft"
                >
                  <div className="min-w-0 flex-1 basis-60">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.name}
                      </span>
                      {item.status !== 1 && (
                        <Chip dot color="warning" size="xs">
                          停用
                        </Chip>
                      )}
                      <span className="shrink-0 text-xs text-default-500">
                        {item.members.length} {memberUnit}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.members.length === 0 ? (
                        <span className="text-xs text-default-400">
                          尚未分配
                        </span>
                      ) : (
                        <>
                          {item.members
                            .slice(0, MEMBER_PREVIEW_LIMIT)
                            .map((member) => (
                              <Chip key={member} size="xs">
                                {member}
                              </Chip>
                            ))}
                          {hidden > 0 && (
                            <Chip
                              color="primary"
                              size="xs"
                              title={item.members
                                .slice(MEMBER_PREVIEW_LIMIT)
                                .join("、")}
                            >
                              +{hidden}
                            </Chip>
                          )}
                        </>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-default-400">
                      创建于 {formatDate(item.createdTime)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => onAssign(item.id)}
                    >
                      {assignLabel}
                    </Button>
                    <Tooltip label="编辑">
                      <ActionIcon
                        aria-label={`编辑 ${item.name}`}
                        color="gray"
                        variant="subtle"
                        onClick={() => onEdit(item.id)}
                      >
                        <SquarePen size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="删除">
                      <ActionIcon
                        aria-label={`删除 ${item.name}`}
                        color="red"
                        variant="subtle"
                        onClick={() => onDelete(item)}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export default function GroupPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin] = useState(getAdminFlag());

  const [tunnelGroups, setTunnelGroups] = useState<TunnelGroup[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [permissions, setPermissions] = useState<GroupPermission[]>([]);
  const [tunnels, setTunnels] = useState<TunnelItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);

  const [selectedUserGroupId, setSelectedUserGroupId] = useState<number | null>(
    null,
  );
  const [selectedTunnelGroupId, setSelectedTunnelGroupId] = useState<
    number | null
  >(null);

  const [savingPermission, setSavingPermission] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "tunnelGroup" | "userGroup" | "permission";
    id: number;
    name: string;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const {
    isOpen: tunnelGroupModalOpen,
    onOpen: onTunnelGroupModalOpen,
    onClose: onTunnelGroupModalClose,
    onOpenChange: onTunnelGroupModalChange,
  } = useDisclosure();
  const {
    isOpen: userGroupModalOpen,
    onOpen: onUserGroupModalOpen,
    onClose: onUserGroupModalClose,
    onOpenChange: onUserGroupModalChange,
  } = useDisclosure();
  const {
    isOpen: tunnelAssignModalOpen,
    onOpen: onTunnelAssignModalOpen,
    onClose: onTunnelAssignModalClose,
    onOpenChange: onTunnelAssignModalChange,
  } = useDisclosure();
  const {
    isOpen: userAssignModalOpen,
    onOpen: onUserAssignModalOpen,
    onClose: onUserAssignModalClose,
    onOpenChange: onUserAssignModalChange,
  } = useDisclosure();

  const [editingTunnelGroup, setEditingTunnelGroup] =
    useState<TunnelGroup | null>(null);
  const [editingUserGroup, setEditingUserGroup] = useState<UserGroup | null>(
    null,
  );
  const [groupName, setGroupName] = useState("");
  const [groupStatus, setGroupStatus] = useState("1");
  const [savingGroup, setSavingGroup] = useState(false);

  const [assignTunnelGroup, setAssignTunnelGroup] =
    useState<TunnelGroup | null>(null);
  const [assignUserGroup, setAssignUserGroup] = useState<UserGroup | null>(
    null,
  );
  const [selectedTunnelKeys, setSelectedTunnelKeys] = useState<Set<string>>(
    new Set(),
  );
  const [selectedUserKeys, setSelectedUserKeys] = useState<Set<string>>(
    new Set(),
  );
  const [savingAssign, setSavingAssign] = useState(false);

  const tunnelNameMap = useMemo(() => {
    const map = new Map<number, string>();

    tunnels.forEach((item) => {
      map.set(item.id, item.name);
    });

    return map;
  }, [tunnels]);

  const userNameMap = useMemo(() => {
    const map = new Map<number, string>();

    users.forEach((item) => {
      map.set(item.id, item.user);
    });

    return map;
  }, [users]);

  const selectedTunnelSummary = useMemo(() => {
    const value = Array.from(selectedTunnelKeys)
      .map((id) => tunnelNameMap.get(Number(id)) || id)
      .join("、");

    return value || "无";
  }, [selectedTunnelKeys, tunnelNameMap]);

  const selectedUserSummary = useMemo(() => {
    const value = Array.from(selectedUserKeys)
      .map((id) => userNameMap.get(Number(id)) || id)
      .join("、");

    return value || "无";
  }, [selectedUserKeys, userNameMap]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tunnelGroupRes, userGroupRes, permissionRes, tunnelRes, userRes] =
        await Promise.all([
          getTunnelGroupList(),
          getUserGroupList(),
          getGroupPermissionList(),
          getTunnelList(),
          getAllUsers(),
        ]);

      if (tunnelGroupRes.code === 0) {
        setTunnelGroups(
          Array.isArray(tunnelGroupRes.data) ? tunnelGroupRes.data : [],
        );
      }
      if (userGroupRes.code === 0) {
        setUserGroups(
          Array.isArray(userGroupRes.data) ? userGroupRes.data : [],
        );
      }
      if (permissionRes.code === 0) {
        setPermissions(
          Array.isArray(permissionRes.data) ? permissionRes.data : [],
        );
      }
      if (tunnelRes.code === 0) {
        setTunnels(Array.isArray(tunnelRes.data) ? tunnelRes.data : []);
      }
      if (userRes.code === 0) {
        setUsers(Array.isArray(userRes.data) ? userRes.data : []);
      }

      if (
        tunnelGroupRes.code !== 0 ||
        userGroupRes.code !== 0 ||
        permissionRes.code !== 0
      ) {
        toast.error("部分分组数据加载失败");
      }
    } catch {
      toast.error("分组数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateTunnelGroup = () => {
    setEditingTunnelGroup(null);
    setGroupName("");
    setGroupStatus("1");
    onTunnelGroupModalOpen();
  };

  const openEditTunnelGroup = (group: TunnelGroup) => {
    setEditingTunnelGroup(group);
    setGroupName(group.name);
    setGroupStatus(String(group.status));
    onTunnelGroupModalOpen();
  };

  const openCreateUserGroup = () => {
    setEditingUserGroup(null);
    setGroupName("");
    setGroupStatus("1");
    onUserGroupModalOpen();
  };

  const openEditUserGroup = (group: UserGroup) => {
    setEditingUserGroup(group);
    setGroupName(group.name);
    setGroupStatus(String(group.status));
    onUserGroupModalOpen();
  };

  const saveTunnelGroup = async () => {
    if (!groupName.trim()) {
      toast.error("请输入分组名称");

      return;
    }
    setSavingGroup(true);
    try {
      const payload = { name: groupName.trim(), status: Number(groupStatus) };
      const res = editingTunnelGroup
        ? await updateTunnelGroup({ id: editingTunnelGroup.id, ...payload })
        : await createTunnelGroup(payload);

      if (res.code === 0) {
        toast.success(editingTunnelGroup ? "更新成功" : "创建成功");
        onTunnelGroupModalClose();
        loadData();
      } else {
        toast.error(res.msg || "保存失败");
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSavingGroup(false);
    }
  };

  const saveUserGroup = async () => {
    if (!groupName.trim()) {
      toast.error("请输入分组名称");

      return;
    }
    setSavingGroup(true);
    try {
      const payload = { name: groupName.trim(), status: Number(groupStatus) };
      const res = editingUserGroup
        ? await updateUserGroup({ id: editingUserGroup.id, ...payload })
        : await createUserGroup(payload);

      if (res.code === 0) {
        toast.success(editingUserGroup ? "更新成功" : "创建成功");
        onUserGroupModalClose();
        loadData();
      } else {
        toast.error(res.msg || "保存失败");
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteTunnelGroup = async (id: number) => {
    try {
      const res = await deleteTunnelGroup(id);

      if (res.code === 0) {
        toast.success("删除成功");
        loadData();
      } else {
        toast.error(res.msg || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleDeleteUserGroup = async (id: number) => {
    try {
      const res = await deleteUserGroup(id);

      if (res.code === 0) {
        toast.success("删除成功");
        loadData();
      } else {
        toast.error(res.msg || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const openAssignTunnels = (group: TunnelGroup) => {
    setAssignTunnelGroup(group);
    setSelectedTunnelKeys(new Set(group.tunnelIds.map((id) => String(id))));
    onTunnelAssignModalOpen();
  };

  const openAssignUsers = (group: UserGroup) => {
    setAssignUserGroup(group);
    setSelectedUserKeys(new Set(group.userIds.map((id) => String(id))));
    onUserAssignModalOpen();
  };

  const saveAssignTunnels = async () => {
    if (!assignTunnelGroup) return;
    setSavingAssign(true);
    try {
      const tunnelIds = Array.from(selectedTunnelKeys).map((id) => Number(id));
      const res = await assignTunnelsToGroup({
        groupId: assignTunnelGroup.id,
        tunnelIds,
      });

      if (res.code === 0) {
        toast.success("分配成功");
        onTunnelAssignModalClose();
        loadData();
      } else {
        toast.error(res.msg || "分配失败");
      }
    } catch {
      toast.error("分配失败");
    } finally {
      setSavingAssign(false);
    }
  };

  const saveAssignUsers = async () => {
    if (!assignUserGroup) return;
    setSavingAssign(true);
    try {
      const userIds = Array.from(selectedUserKeys).map((id) => Number(id));
      const res = await assignUsersToGroup({
        groupId: assignUserGroup.id,
        userIds,
      });

      if (res.code === 0) {
        toast.success("分配成功");
        onUserAssignModalClose();
        loadData();
      } else {
        toast.error(res.msg || "分配失败");
      }
    } catch {
      toast.error("分配失败");
    } finally {
      setSavingAssign(false);
    }
  };

  const handleAssignPermission = async () => {
    if (!selectedUserGroupId || !selectedTunnelGroupId) {
      toast.error("请选择用户分组和隧道分组");

      return;
    }
    setSavingPermission(true);
    try {
      const res = await assignGroupPermission({
        userGroupId: selectedUserGroupId,
        tunnelGroupId: selectedTunnelGroupId,
      });

      if (res.code === 0) {
        toast.success(res.msg || "权限分配成功");
        loadData();
      } else {
        toast.error(res.msg || "权限分配失败");
      }
    } catch {
      toast.error("权限分配失败");
    } finally {
      setSavingPermission(false);
    }
  };

  const handleRemovePermission = async (id: number) => {
    try {
      const res = await removeGroupPermission(id);

      if (res.code === 0) {
        toast.success("权限回收成功");
        loadData();
      } else {
        toast.error(res.msg || "权限回收失败");
      }
    } catch {
      toast.error("权限回收失败");
    }
  };

  if (!isAdmin) {
    return (
      <div>
        <Card>
          <CardBody>
            <p className="text-danger">
              权限不足，只有管理员可以访问分组管理页面。
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return;
    setConfirmLoading(true);
    try {
      if (pendingDelete.kind === "tunnelGroup") {
        await handleDeleteTunnelGroup(pendingDelete.id);
      } else if (pendingDelete.kind === "userGroup") {
        await handleDeleteUserGroup(pendingDelete.id);
      } else {
        await handleRemovePermission(pendingDelete.id);
      }
    } finally {
      setConfirmLoading(false);
      setPendingDelete(null);
    }
  };

  return (
    <AnimatedPage className="space-y-5">
      {loading ? (
        <PageLoadingState message="正在加载..." />
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <GroupPanel
              assignLabel="分配隧道"
              description="把隧道归类，授权时整组生效"
              emptyText="暂无隧道分组"
              icon={Network}
              items={tunnelGroups.map((group) => ({
                ...group,
                members: group.tunnelNames,
              }))}
              memberUnit="条隧道"
              title="隧道分组"
              onAssign={(id) => {
                const group = tunnelGroups.find((item) => item.id === id);

                if (group) openAssignTunnels(group);
              }}
              onCreate={openCreateTunnelGroup}
              onDelete={(item) =>
                setPendingDelete({
                  kind: "tunnelGroup",
                  id: item.id,
                  name: item.name,
                })
              }
              onEdit={(id) => {
                const group = tunnelGroups.find((item) => item.id === id);

                if (group) openEditTunnelGroup(group);
              }}
            />
            <GroupPanel
              assignLabel="分配用户"
              description="把用户归类，统一授予隧道分组"
              emptyText="暂无用户分组"
              icon={Users}
              items={userGroups.map((group) => ({
                ...group,
                members: group.userNames,
              }))}
              memberUnit="位用户"
              title="用户分组"
              onAssign={(id) => {
                const group = userGroups.find((item) => item.id === id);

                if (group) openAssignUsers(group);
              }}
              onCreate={openCreateUserGroup}
              onDelete={(item) =>
                setPendingDelete({
                  kind: "userGroup",
                  id: item.id,
                  name: item.name,
                })
              }
              onEdit={(id) => {
                const group = userGroups.find((item) => item.id === id);

                if (group) openEditUserGroup(group);
              }}
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <SectionHeader
                count={permissions.length}
                description="授权后，用户分组内的用户可以使用隧道分组中的全部隧道"
                icon={ShieldCheck}
                title="权限分配"
              />
            </CardHeader>
            <CardBody className="space-y-4 pt-0">
              <div className="grid gap-3 rounded-lg bg-default-soft p-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-end">
                <Select
                  items={userGroups}
                  label="用户分组"
                  placeholder="选择用户分组"
                  selectedKeys={
                    selectedUserGroupId ? [String(selectedUserGroupId)] : []
                  }
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys as Set<React.Key>)[0];

                    setSelectedUserGroupId(key ? Number(key) : null);
                  }}
                >
                  {(item) => <SelectItem key={item.id}>{item.name}</SelectItem>}
                </Select>
                <span className="hidden pb-2 text-xs text-default-500 md:block">
                  可使用
                </span>
                <Select
                  items={tunnelGroups}
                  label="隧道分组"
                  placeholder="选择隧道分组"
                  selectedKeys={
                    selectedTunnelGroupId ? [String(selectedTunnelGroupId)] : []
                  }
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys as Set<React.Key>)[0];

                    setSelectedTunnelGroupId(key ? Number(key) : null);
                  }}
                >
                  {(item) => <SelectItem key={item.id}>{item.name}</SelectItem>}
                </Select>
                <Button
                  color="primary"
                  isDisabled={!selectedUserGroupId || !selectedTunnelGroupId}
                  isLoading={savingPermission}
                  startContent={<Plus size={15} />}
                  onPress={handleAssignPermission}
                >
                  授权
                </Button>
              </div>

              {permissions.length === 0 ? (
                <PageEmptyState
                  className="min-h-32"
                  message="暂无权限分配记录"
                />
              ) : (
                <ul className="divide-y divide-divider overflow-hidden rounded-lg border border-divider">
                  {permissions.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-default-soft"
                    >
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
                        <Chip color="secondary" size="sm">
                          {item.userGroupName || `#${item.userGroupId}`}
                        </Chip>
                        <ArrowRight
                          className="shrink-0 text-default-400"
                          size={14}
                        />
                        <Chip color="primary" size="sm">
                          {item.tunnelGroupName || `#${item.tunnelGroupId}`}
                        </Chip>
                        <span className="text-[11px] text-default-400">
                          {formatDate(item.createdTime)}
                        </span>
                      </div>
                      <Button
                        color="danger"
                        size="sm"
                        variant="light"
                        onPress={() =>
                          setPendingDelete({
                            kind: "permission",
                            id: item.id,
                            name: `${item.userGroupName || item.userGroupId} → ${item.tunnelGroupName || item.tunnelGroupId}`,
                          })
                        }
                      >
                        回收
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <ConfirmDialog
            confirmLabel={
              pendingDelete?.kind === "permission" ? "回收" : "删除"
            }
            isOpen={pendingDelete !== null}
            loading={confirmLoading}
            message={
              pendingDelete?.kind === "permission"
                ? `回收“${pendingDelete.name}”后，该用户分组将不能再使用这些隧道。`
                : `确定删除“${pendingDelete?.name ?? ""}”吗？此操作无法撤销。`
            }
            title={
              pendingDelete?.kind === "permission" ? "回收权限" : "删除分组"
            }
            onClose={() => setPendingDelete(null)}
            onConfirm={() => void confirmPendingDelete()}
          />

          <Modal
            backdrop="blur"
            isOpen={tunnelGroupModalOpen}
            onOpenChange={onTunnelGroupModalChange}
          >
            <ModalContent>
              <ModalHeader>
                {editingTunnelGroup ? "编辑隧道分组" : "新建隧道分组"}
              </ModalHeader>
              <ModalBody className="space-y-3">
                <Input
                  label="分组名称"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <Select
                  label="状态"
                  selectedKeys={[groupStatus]}
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys as Set<React.Key>)[0];

                    if (key) {
                      setGroupStatus(String(key));
                    }
                  }}
                >
                  <SelectItem key="1">启用</SelectItem>
                  <SelectItem key="0">停用</SelectItem>
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onTunnelGroupModalClose}>
                  取消
                </Button>
                <Button
                  color="primary"
                  isLoading={savingGroup}
                  onPress={saveTunnelGroup}
                >
                  保存
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Modal
            backdrop="blur"
            isOpen={userGroupModalOpen}
            onOpenChange={onUserGroupModalChange}
          >
            <ModalContent>
              <ModalHeader>
                {editingUserGroup ? "编辑用户分组" : "新建用户分组"}
              </ModalHeader>
              <ModalBody className="space-y-3">
                <Input
                  label="分组名称"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <Select
                  label="状态"
                  selectedKeys={[groupStatus]}
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys as Set<React.Key>)[0];

                    if (key) {
                      setGroupStatus(String(key));
                    }
                  }}
                >
                  <SelectItem key="1">启用</SelectItem>
                  <SelectItem key="0">停用</SelectItem>
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onUserGroupModalClose}>
                  取消
                </Button>
                <Button
                  color="primary"
                  isLoading={savingGroup}
                  onPress={saveUserGroup}
                >
                  保存
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Modal
            backdrop="blur"
            isOpen={tunnelAssignModalOpen}
            onOpenChange={onTunnelAssignModalChange}
          >
            <ModalContent>
              <ModalHeader>分配隧道 - {assignTunnelGroup?.name}</ModalHeader>
              <ModalBody className="min-w-0">
                <Select
                  className="min-w-0"
                  classNames={{ trigger: "max-w-full" }}
                  items={tunnels}
                  label="选择隧道"
                  selectedKeys={selectedTunnelKeys}
                  selectionMode="multiple"
                  onSelectionChange={(keys) => {
                    setSelectedTunnelKeys(
                      new Set(Array.from(keys as Set<React.Key>).map(String)),
                    );
                  }}
                >
                  {(item) => <SelectItem key={item.id}>{item.name}</SelectItem>}
                </Select>
                <p
                  className="w-full min-w-0 max-w-full text-xs text-default-500 truncate"
                  title={`当前已选：${selectedTunnelSummary}`}
                >
                  当前已选：{selectedTunnelSummary}
                </p>
                <p className="text-xs text-default-500">
                  不选择任何隧道并保存将清空该分组成员。
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onTunnelAssignModalClose}>
                  取消
                </Button>
                <Button
                  color="primary"
                  isLoading={savingAssign}
                  onPress={saveAssignTunnels}
                >
                  保存
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          <Modal
            backdrop="blur"
            isOpen={userAssignModalOpen}
            onOpenChange={onUserAssignModalChange}
          >
            <ModalContent>
              <ModalHeader>分配用户 - {assignUserGroup?.name}</ModalHeader>
              <ModalBody className="min-w-0">
                <Select
                  className="min-w-0"
                  classNames={{ trigger: "max-w-full" }}
                  items={users}
                  label="选择用户"
                  selectedKeys={selectedUserKeys}
                  selectionMode="multiple"
                  onSelectionChange={(keys) => {
                    setSelectedUserKeys(
                      new Set(Array.from(keys as Set<React.Key>).map(String)),
                    );
                  }}
                >
                  {(item) => <SelectItem key={item.id}>{item.user}</SelectItem>}
                </Select>
                <p
                  className="w-full min-w-0 max-w-full text-xs text-default-500 truncate"
                  title={`当前已选：${selectedUserSummary}`}
                >
                  当前已选：{selectedUserSummary}
                </p>
                <p className="text-xs text-default-500">
                  不选择任何用户并保存将清空该分组成员。
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onUserAssignModalClose}>
                  取消
                </Button>
                <Button
                  color="primary"
                  isLoading={savingAssign}
                  onPress={saveAssignUsers}
                >
                  保存
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </>
      )}
    </AnimatedPage>
  );
}
