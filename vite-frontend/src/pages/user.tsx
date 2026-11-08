import { Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { SearchX, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  assignMonitorPermission,
  batchAssignUserTunnel,
  createUser,
  deleteUser,
  getAllUsers,
  getMonitorPermissionList,
  getSpeedLimitList,
  getTunnelList,
  getUserGroupList,
  getUserGroups,
  getUserTunnelList,
  removeMonitorPermission,
  removeUserTunnel,
  resetUserFlow,
  resetUserQuota,
  updateUser,
  updateUserTunnel,
} from "@/api";
import { AnimatedPage } from "@/components/animated-page";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyStateCard, PageLoadingState } from "@/components/page-state";
import { PageToolbar } from "@/components/page-toolbar";
import { SearchBar } from "@/components/search-bar";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import toast from "@/lib/notifications";
import { EditTunnelPermissionModal } from "@/pages/user/edit-tunnel-permission-modal";
import {
  calculateTunnelUsedFlow,
  calculateUserTotalUsedFlow,
  formatFlow,
  getExpireStatus,
  normalizeUserItem,
  normalizeUserTunnelItem,
  trafficInputFor,
  USER_SEARCH_DEBOUNCE_MS,
} from "@/pages/user/presentation";
import { TunnelPermissionModal } from "@/pages/user/tunnel-permission-modal";
import { UserFormModal } from "@/pages/user/user-form-modal";
import {
  UserCard,
  UserListHeader,
  UserRow,
  type UserItemHandlers,
} from "@/pages/user/user-items";
import {
  Pagination as PaginationType,
  SpeedLimit,
  Tunnel,
  TunnelAssignItem,
  User,
  UserForm,
  UserGroup,
  UserTunnel,
} from "@/types";
import { removeItemsById, replaceItemById } from "@/utils/list-state";
import { parseTrafficInput, type TrafficUnit } from "@/utils/traffic";

// Expiry dates are inclusive: a picked day lasts until 23:59:59 local time.

export default function UserPage() {
  // 状态管理
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useLocalStorageState(
    "user-search-keyword",
    "",
  );
  const [viewMode, setViewMode] = useLocalStorageState<"list" | "grid">(
    "user-view-mode",
    "grid",
  );
  const [pagination, setPagination] = useState<PaginationType>({
    current: 1,
    size: 10,
    total: 0,
  });
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 用户表单相关状态
  const [isUserModalOpen, { open: onUserModalOpen, close: onUserModalClose }] =
    useDisclosure();
  const [isEdit, setIsEdit] = useState(false);
  const [userForm, setUserForm] = useState<UserForm>({
    user: "",
    pwd: "",
    status: 1,
    flow: 1000,
    dailyQuotaGB: 0,
    monthlyQuotaGB: 0,
    num: 10,
    expTime: null,
    flowResetTime: 0,
    maxConn: 0,
  });
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [userSubmitWarning, setUserSubmitWarning] = useState<string | null>(
    null,
  );
  const [userFlowInput, setUserFlowInput] = useState("1000");
  const [userFlowUnit, setUserFlowUnit] = useState<TrafficUnit>("GB");
  const [quotaResetLoading, setQuotaResetLoading] = useState(false);

  const editingUser = useMemo(
    () =>
      userForm.id
        ? users.find((item) => item.id === userForm.id) || null
        : null,
    [userForm.id, users],
  );

  // 隧道权限管理相关状态
  const [
    isTunnelModalOpen,
    { open: onTunnelModalOpen, close: onTunnelModalClose },
  ] = useDisclosure();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [monitorPermissionUserIds, setMonitorPermissionUserIds] = useState<
    Set<number>
  >(new Set());
  const [monitorPermissionLoading, setMonitorPermissionLoading] =
    useState(false);
  const [monitorPermissionMutatingUserId, setMonitorPermissionMutatingUserId] =
    useState<number | null>(null);
  const [userTunnels, setUserTunnels] = useState<UserTunnel[]>([]);
  const [tunnelListLoading, setTunnelListLoading] = useState(false);

  // 分配新隧道权限相关状态
  const [assignLoading, setAssignLoading] = useState(false);
  const [batchTunnelSelections, setBatchTunnelSelections] = useState<
    Map<number, number | null>
  >(new Map());

  // 编辑隧道权限相关状态
  const [
    isEditTunnelModalOpen,
    { open: onEditTunnelModalOpen, close: onEditTunnelModalClose },
  ] = useDisclosure();
  const [editTunnelForm, setEditTunnelForm] = useState<UserTunnel | null>(null);
  const [tunnelFlowInput, setTunnelFlowInput] = useState("");
  const [tunnelFlowUnit, setTunnelFlowUnit] = useState<TrafficUnit>("GB");
  const [editTunnelLoading, setEditTunnelLoading] = useState(false);

  // 删除确认相关状态
  const [
    isDeleteModalOpen,
    { open: onDeleteModalOpen, close: onDeleteModalClose },
  ] = useDisclosure();
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // 删除隧道权限确认相关状态
  const [
    isDeleteTunnelModalOpen,
    { open: onDeleteTunnelModalOpen, close: onDeleteTunnelModalClose },
  ] = useDisclosure();
  const [tunnelToDelete, setTunnelToDelete] = useState<UserTunnel | null>(null);

  // 重置流量确认相关状态
  const [
    isResetFlowModalOpen,
    { open: onResetFlowModalOpen, close: onResetFlowModalClose },
  ] = useDisclosure();
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [resetFlowLoading, setResetFlowLoading] = useState(false);

  // 重置隧道流量确认相关状态
  const [
    isResetTunnelFlowModalOpen,
    { open: onResetTunnelFlowModalOpen, close: onResetTunnelFlowModalClose },
  ] = useDisclosure();
  const [tunnelToReset, setTunnelToReset] = useState<UserTunnel | null>(null);
  const [resetTunnelFlowLoading, setResetTunnelFlowLoading] = useState(false);

  // 其他数据
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [speedLimits, setSpeedLimits] = useState<SpeedLimit[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);

  const noLimitSpeedLimitIds = useMemo(() => {
    return new Set(
      speedLimits
        .filter((speedLimit) => speedLimit.name.trim() === "不限速")
        .map((speedLimit) => speedLimit.id),
    );
  }, [speedLimits]);

  const speedLimitIds = useMemo(() => {
    return new Set(speedLimits.map((speedLimit) => speedLimit.id));
  }, [speedLimits]);

  const normalizeSpeedId = (speedId?: number | null): number | null => {
    if (speedId === null || speedId === undefined) {
      return null;
    }

    if (noLimitSpeedLimitIds.has(speedId)) {
      return null;
    }

    if (speedLimits.length > 0 && !speedLimitIds.has(speedId)) {
      return null;
    }

    return speedId;
  };

  const isMissingSpeedLimit = (speedId?: number | null): boolean => {
    if (speedId === null || speedId === undefined) {
      return false;
    }

    if (speedLimits.length === 0 || noLimitSpeedLimitIds.has(speedId)) {
      return false;
    }

    return !speedLimitIds.has(speedId);
  };

  // 数据加载函数
  const loadUsers = useCallback(
    async (keywordOverride?: string) => {
      setLoading(true);
      try {
        const keyword = keywordOverride ?? searchKeyword;
        const response = await getAllUsers({
          current: pagination.current,
          size: pagination.size,
          keyword,
        });

        if (response.code === 0) {
          const nextUsers = Array.isArray(response.data)
            ? response.data.map((item) => normalizeUserItem(item))
            : [];

          setUsers(nextUsers);
          setPagination((prev) => ({ ...prev, total: nextUsers.length }));
        } else {
          toast.error(response.msg || "获取用户列表失败");
        }
      } catch {
        toast.error("获取用户列表失败");
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.size],
  );

  const loadTunnels = useCallback(async () => {
    try {
      const response = await getTunnelList();

      if (response.code === 0) {
        setTunnels(Array.isArray(response.data) ? response.data : []);
      }
    } catch {}
  }, []);

  const loadSpeedLimits = useCallback(async () => {
    try {
      const response = await getSpeedLimitList();

      if (response.code === 0) {
        const speedLimitList = Array.isArray(response.data)
          ? response.data.map((item) => ({
              ...item,
              uploadSpeed: item.uploadSpeed ?? item.speed ?? 0,
              downloadSpeed: item.downloadSpeed ?? item.speed ?? 0,
            }))
          : [];

        setSpeedLimits(speedLimitList);
      }
    } catch {}
  }, []);

  const loadUserGroups = useCallback(async () => {
    try {
      const response = await getUserGroupList();

      if (response.code === 0) {
        setUserGroups(Array.isArray(response.data) ? response.data : []);
      }
    } catch {}
  }, []);

  const loadMonitorPermissions = useCallback(async () => {
    setMonitorPermissionLoading(true);
    try {
      const response = await getMonitorPermissionList();

      if (response.code === 0) {
        const ids = new Set<number>();

        if (Array.isArray(response.data)) {
          response.data.forEach((item: any) => {
            const id = Number(item?.userId ?? 0);

            if (id > 0) ids.add(id);
          });
        }
        setMonitorPermissionUserIds(ids);
      } else if (response.code !== 403) {
        toast.error(response.msg || "获取监控权限失败");
      }
    } catch {
      // ignore
    } finally {
      setMonitorPermissionLoading(false);
    }
  }, []);

  const loadUserTunnels = useCallback(async (userId: number) => {
    setTunnelListLoading(true);
    try {
      const response = await getUserTunnelList({ userId });

      if (response.code === 0) {
        setUserTunnels(
          Array.isArray(response.data)
            ? response.data.map((item) => normalizeUserTunnelItem(item))
            : [],
        );
      } else {
        toast.error(response.msg || "获取隧道权限列表失败");
      }
    } catch {
      toast.error("获取隧道权限列表失败");
    } finally {
      setTunnelListLoading(false);
    }
  }, []);

  // 生命周期
  useEffect(() => {
    void loadTunnels();
    void loadSpeedLimits();
    void loadUserGroups();
    void loadMonitorPermissions();
  }, [loadMonitorPermissions, loadSpeedLimits, loadTunnels, loadUserGroups]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      setPagination((prev) => {
        if (prev.current === 1) {
          void loadUsers(searchKeyword);

          return prev;
        }

        return { ...prev, current: 1 };
      });
    }, USER_SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [loadUsers, searchKeyword]);

  // 用户管理操作
  const handleSearch = () => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    setPagination((prev) => ({ ...prev, current: 1 }));
    void loadUsers(searchKeyword);
  };

  const handleAdd = () => {
    setUserSubmitWarning(null);
    setIsEdit(false);
    setUserFlowInput("1000");
    setUserFlowUnit("GB");
    setUserForm({
      user: "",
      pwd: "",
      status: 1,
      flow: 1000,
      dailyQuotaGB: 0,
      monthlyQuotaGB: 0,
      num: 10,
      expTime: null,
      flowResetTime: 0,
      maxConn: 0,
      groupIds: [],
    });
    onUserModalOpen();
  };

  const handleEdit = async (user: User) => {
    setUserSubmitWarning(null);
    setIsEdit(true);
    const trafficInput = trafficInputFor(user.flow, user.flowMiB);

    setUserFlowInput(trafficInput.value);
    setUserFlowUnit(trafficInput.unit);
    let currentGroupIds: number[] = [];

    try {
      const groupRes = await getUserGroups(user.id);

      if (groupRes.code === 0) {
        currentGroupIds = groupRes.data || [];
      }
    } catch {}

    setUserForm({
      id: user.id,
      name: user.name,
      user: user.user,
      pwd: "",
      status: user.status,
      flow: user.flow,
      dailyQuotaGB: user.dailyQuotaGB ?? 0,
      monthlyQuotaGB: user.monthlyQuotaGB ?? 0,
      num: user.num,
      expTime: user.expTime ? new Date(user.expTime) : null,
      flowResetTime: user.flowResetTime ?? 0,
      maxConn: user.maxConn ?? 0,
      groupIds: currentGroupIds,
    });
    onUserModalOpen();
  };

  const handleDelete = (user: User) => {
    setUserToDelete(user);
    onDeleteModalOpen();
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    try {
      const response = await deleteUser(userToDelete.id);

      if (response.code === 0) {
        toast.success("删除成功");
        onDeleteModalClose();
        setUsers((prev) => removeItemsById(prev, [userToDelete.id]));
        setPagination((prev) => ({
          ...prev,
          total: Math.max(prev.total - 1, 0),
        }));
        setUserToDelete(null);
        if (currentUser?.id === userToDelete.id) {
          setCurrentUser(null);
          setUserTunnels([]);
        }
      } else {
        toast.error(response.msg || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleSubmitUser = async () => {
    if (!userForm.user || (!userForm.pwd && !isEdit) || !userForm.expTime) {
      toast.error("请填写完整信息");

      return;
    }

    const flowMiB = parseTrafficInput(userFlowInput, userFlowUnit);

    if (flowMiB === null) {
      toast.error("请输入有效的流量限制，最小单位为 1 MB");

      return;
    }

    setUserFormLoading(true);
    setUserSubmitWarning(null);
    try {
      const submitData: any = {
        ...userForm,
        flow: Math.ceil(flowMiB / 1024),
        flowMiB:
          userFlowInput === "99999" && userFlowUnit === "GB" ? 0 : flowMiB,
        expTime: userForm.expTime.getTime(),
        groupIds: userForm.groupIds ?? [],
      };

      if (isEdit && !submitData.pwd) {
        delete submitData.pwd;
      }

      const response = isEdit
        ? await updateUser(submitData)
        : await createUser(submitData);

      if (response.code === 0) {
        toast.success(isEdit ? "更新成功" : "创建成功");
        onUserModalClose();
        const responseUser = normalizeUserItem((response as any).data || {});

        if (
          isEdit &&
          responseUser.id > 0 &&
          pagination.current === 1 &&
          !searchKeyword.trim()
        ) {
          setUsers((prev) => replaceItemById(prev, responseUser));
        } else if (
          !isEdit &&
          responseUser.id > 0 &&
          pagination.current === 1 &&
          !searchKeyword.trim()
        ) {
          setUsers((prev) => [responseUser, ...prev].slice(0, pagination.size));
          setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
        } else {
          await loadUsers();
        }
      } else {
        const userDisabled =
          isEdit &&
          response.data !== null &&
          typeof response.data === "object" &&
          "userDisabled" in response.data &&
          response.data.userDisabled === true;

        if (userDisabled) {
          setUserSubmitWarning(response.msg);
          await loadUsers();
        } else {
          toast.error(response.msg || (isEdit ? "更新失败" : "创建失败"));
        }
      }
    } catch {
      toast.error(isEdit ? "更新失败" : "创建失败");
    } finally {
      setUserFormLoading(false);
    }
  };

  const setUserMonitorPermission = useCallback(
    async (userId: number, enabled: boolean) => {
      if (userId <= 0) return;
      if (monitorPermissionMutatingUserId === userId) return;

      const prevEnabled = monitorPermissionUserIds.has(userId);

      if (prevEnabled === enabled) return;

      setMonitorPermissionMutatingUserId(userId);

      // Optimistic update for better UX.
      setMonitorPermissionUserIds((prev) => {
        const next = new Set(prev);

        if (enabled) {
          next.add(userId);
        } else {
          next.delete(userId);
        }

        return next;
      });

      try {
        const response = enabled
          ? await assignMonitorPermission(userId)
          : await removeMonitorPermission(userId);

        if (response.code === 0) {
          toast.success(enabled ? "已授权监控" : "已撤销监控");

          return;
        }

        toast.error(response.msg || "操作失败");
        throw new Error("mutation failed");
      } catch {
        // Revert optimistic update on failure.
        setMonitorPermissionUserIds((prev) => {
          const next = new Set(prev);

          if (prevEnabled) {
            next.add(userId);
          } else {
            next.delete(userId);
          }

          return next;
        });
      } finally {
        setMonitorPermissionMutatingUserId(null);
      }
    },
    [monitorPermissionMutatingUserId, monitorPermissionUserIds],
  );

  // 隧道权限管理操作
  const handleManageTunnels = (user: User) => {
    setCurrentUser(user);
    setBatchTunnelSelections(new Map());
    onTunnelModalOpen();
    loadUserTunnels(user.id);
  };

  const handleBatchAssignTunnel = async () => {
    if (batchTunnelSelections.size === 0 || !currentUser) {
      toast.error("请选择至少一个隧道");

      return;
    }

    setAssignLoading(true);
    try {
      let speedLimitAutoCleared = false;
      const tunnelsToAssign: TunnelAssignItem[] = Array.from(
        batchTunnelSelections.entries(),
      ).map(([tunnelId, speedId]) => ({
        tunnelId,
        speedId: (() => {
          const cleared = normalizeSpeedId(speedId);

          if (isMissingSpeedLimit(speedId)) {
            speedLimitAutoCleared = true;
          }

          return cleared;
        })(),
      }));

      const response = await batchAssignUserTunnel({
        userId: currentUser.id,
        tunnels: tunnelsToAssign,
      });

      if (response.code === 0) {
        if (speedLimitAutoCleared) {
          toast.warning("所选限速规则不存在，已自动清除为不限速", {
            duration: 5000,
          });
        }
        toast.success(response.msg || "分配成功");
        setBatchTunnelSelections(new Map());
        await loadUserTunnels(currentUser.id);
      } else {
        toast.error(response.msg || "分配失败");
      }
    } catch {
      toast.error("分配失败");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleEditTunnel = (userTunnel: UserTunnel) => {
    const trafficInput = trafficInputFor(userTunnel.flow, userTunnel.flowMiB);

    setTunnelFlowInput(trafficInput.value);
    setTunnelFlowUnit(trafficInput.unit);
    setEditTunnelForm({
      ...userTunnel,
      speedId: normalizeSpeedId(userTunnel.speedId),
      expTime: userTunnel.expTime,
    });
    onEditTunnelModalOpen();
  };

  const handleUpdateTunnel = async () => {
    if (!editTunnelForm) return;

    const flowMiB = parseTrafficInput(tunnelFlowInput, tunnelFlowUnit);

    if (flowMiB === null) {
      toast.error("请输入有效的流量限制，最小单位为 1 MB");

      return;
    }
    const flow = Math.ceil(flowMiB / 1024);
    const storedFlowMiB =
      tunnelFlowInput === "99999" && tunnelFlowUnit === "GB" ? 0 : flowMiB;

    setEditTunnelLoading(true);
    try {
      const speedLimitAutoCleared = isMissingSpeedLimit(editTunnelForm.speedId);
      const response = await updateUserTunnel({
        id: editTunnelForm.id,
        flow,
        flowMiB: storedFlowMiB,
        num: editTunnelForm.num,
        expTime: editTunnelForm.expTime,
        flowResetTime: editTunnelForm.flowResetTime,
        speedId: normalizeSpeedId(editTunnelForm.speedId),
        status: editTunnelForm.status,
      });

      if (response.code === 0) {
        if (speedLimitAutoCleared) {
          toast.warning("所选限速规则不存在，已自动清除为不限速", {
            duration: 5000,
          });
        }
        toast.success("更新成功");
        onEditTunnelModalClose();
        if (currentUser) {
          const nextTunnel = normalizeUserTunnelItem({
            ...editTunnelForm,
            flow,
            flowMiB: storedFlowMiB,
            speedId: normalizeSpeedId(editTunnelForm.speedId),
            speedLimitName:
              normalizeSpeedId(editTunnelForm.speedId) !== null
                ? speedLimits.find(
                    (speedLimit) =>
                      speedLimit.id ===
                      normalizeSpeedId(editTunnelForm.speedId),
                  )?.name
                : undefined,
          });

          setUserTunnels((prev) => replaceItemById(prev, nextTunnel));
        }
      } else {
        toast.error(response.msg || "更新失败");
      }
    } catch {
      toast.error("更新失败");
    } finally {
      setEditTunnelLoading(false);
    }
  };

  const handleRemoveTunnel = (userTunnel: UserTunnel) => {
    setTunnelToDelete(userTunnel);
    onDeleteTunnelModalOpen();
  };

  const handleConfirmRemoveTunnel = async () => {
    if (!tunnelToDelete) return;

    try {
      const response = await removeUserTunnel({ id: tunnelToDelete.id });

      if (response.code === 0) {
        toast.success("删除成功");
        if (currentUser) {
          setUserTunnels((prev) => removeItemsById(prev, [tunnelToDelete.id]));
        }
        onDeleteTunnelModalClose();
        setTunnelToDelete(null);
      } else {
        toast.error(response.msg || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  // 重置流量相关函数
  const handleResetFlow = (user: User) => {
    setUserToReset(user);
    onResetFlowModalOpen();
  };

  const handleConfirmResetFlow = async () => {
    if (!userToReset) return;

    setResetFlowLoading(true);
    try {
      const response = await resetUserFlow({
        id: userToReset.id,
        type: 1, // 1表示重置用户流量
      });

      if (response.code === 0) {
        toast.success("流量重置成功");
        onResetFlowModalClose();
        const targetUserId = userToReset.id;

        setUsers((prev) =>
          prev.map((user) =>
            user.id === targetUserId
              ? { ...user, inFlow: 0, outFlow: 0 }
              : user,
          ),
        );
        setUserToReset(null);
      } else {
        toast.error(response.msg || "重置失败");
      }
    } catch {
      toast.error("重置失败");
    } finally {
      setResetFlowLoading(false);
    }
  };

  const handleQuotaReset = async (scope: "daily" | "monthly" | "all") => {
    const userId = userForm.id;

    if (!userId) {
      return;
    }

    setQuotaResetLoading(true);
    try {
      const response = await resetUserQuota({ userId, scope });

      if (response.code === 0) {
        toast.success("用户配额已重置");
        await loadUsers(searchKeyword);
      } else {
        toast.error(response.msg || "重置用户配额失败");
      }
    } catch {
      toast.error("重置用户配额失败");
    } finally {
      setQuotaResetLoading(false);
    }
  };

  // 隧道流量重置相关函数
  const handleResetTunnelFlow = (userTunnel: UserTunnel) => {
    setTunnelToReset(userTunnel);
    onResetTunnelFlowModalOpen();
  };

  const handleConfirmResetTunnelFlow = async () => {
    if (!tunnelToReset) return;

    setResetTunnelFlowLoading(true);
    try {
      const response = await resetUserFlow({
        id: tunnelToReset.id,
        type: 2, // 2表示重置隧道流量
      });

      if (response.code === 0) {
        toast.success("隧道流量重置成功");
        onResetTunnelFlowModalClose();
        const targetTunnelId = tunnelToReset.id;

        setUserTunnels((prev) =>
          prev.map((userTunnel) =>
            userTunnel.id === targetTunnelId
              ? { ...userTunnel, inFlow: 0, outFlow: 0 }
              : userTunnel,
          ),
        );
        setTunnelToReset(null);
      } else {
        toast.error(response.msg || "重置失败");
      }
    } catch {
      toast.error("重置失败");
    } finally {
      setResetTunnelFlowLoading(false);
    }
  };

  const editAvailableSpeedLimits = speedLimits.filter(
    (speedLimit) => !noLimitSpeedLimitIds.has(speedLimit.id),
  );

  const getSpeedLimitsForTunnel = (_tunnelId: number) => {
    return speedLimits.filter(
      (speedLimit) => !noLimitSpeedLimitIds.has(speedLimit.id),
    );
  };

  const editTunnelSelectedSpeedId = normalizeSpeedId(editTunnelForm?.speedId);

  const toggleTunnelSelection = (tunnelId: number) => {
    setBatchTunnelSelections((prev) => {
      const newMap = new Map(prev);

      if (newMap.has(tunnelId)) {
        newMap.delete(tunnelId);
      } else {
        newMap.set(tunnelId, null);
      }

      return newMap;
    });
  };

  const updateTunnelSpeedLimit = (tunnelId: number, speedId: number | null) => {
    setBatchTunnelSelections((prev) => {
      const newMap = new Map(prev);

      newMap.set(tunnelId, speedId);

      return newMap;
    });
  };

  const isTunnelAssigned = (tunnelId: number) => {
    return userTunnels.some((ut) => ut.tunnelId === tunnelId);
  };

  const userHandlers: UserItemHandlers = {
    onManageTunnels: handleManageTunnels,
    onEdit: handleEdit,
    onResetFlow: handleResetFlow,
    onDelete: handleDelete,
  };
  const activeUserCount = users.filter((user) => user.status === 1).length;
  const overQuotaCount = users.filter((user) => user.disabledByQuota).length;
  const expiringCount = users.filter(
    (user) => user.expTime && getExpireStatus(user.expTime).color !== "success",
  ).length;

  return (
    <AnimatedPage>
      <PageToolbar
        primary={{
          label: "新增",
          noun: "用户",
          icon: <UserPlus size={16} />,
          onClick: handleAdd,
        }}
        search={
          <SearchBar
            placeholder="搜索用户名"
            value={searchKeyword}
            onChange={setSearchKeyword}
            onSubmit={handleSearch}
          />
        }
        view={{ value: viewMode, onChange: setViewMode }}
      />

      {!loading && users.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-default-500">
          <span>
            共{" "}
            <span className="font-semibold text-foreground">
              {users.length}
            </span>{" "}
            个用户
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            正常 {activeUserCount}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-default-400" />
            禁用 {users.length - activeUserCount}
          </span>
          {overQuotaCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-danger-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-danger" />
              配额超额 {overQuotaCount}
            </span>
          )}
          {expiringCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-warning-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              即将过期或已过期 {expiringCount}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <PageLoadingState message="正在加载..." />
      ) : users.length === 0 ? (
        searchKeyword.trim() ? (
          <EmptyStateCard
            action={
              <Button variant="default" onClick={() => setSearchKeyword("")}>
                清空搜索
              </Button>
            }
            description="换个用户名再试试。"
            icon={<SearchX size={20} />}
            title="没有匹配的用户"
            tone="default"
          />
        ) : (
          <EmptyStateCard
            action={
              <Button leftSection={<UserPlus size={16} />} onClick={handleAdd}>
                新增用户
              </Button>
            }
            description="创建用户后，可以在“权限”中为其分配隧道与配额。"
            icon={<Users size={20} />}
            title="还没有用户"
          />
        )
      ) : viewMode === "list" ? (
        <div className="user-list">
          <UserListHeader />
          {users.map((user) => (
            <UserRow key={user.id} handlers={userHandlers} user={user} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {users.map((user) => (
            <UserCard key={user.id} handlers={userHandlers} user={user} />
          ))}
        </div>
      )}

      {/* 用户表单模态框 */}
      <UserFormModal
        editingUser={editingUser}
        handleQuotaReset={handleQuotaReset}
        handleSubmitUser={handleSubmitUser}
        isEdit={isEdit}
        isUserModalOpen={isUserModalOpen}
        quotaResetLoading={quotaResetLoading}
        setUserFlowInput={setUserFlowInput}
        setUserFlowUnit={setUserFlowUnit}
        setUserForm={setUserForm}
        userFlowInput={userFlowInput}
        userFlowUnit={userFlowUnit}
        userForm={userForm}
        userFormLoading={userFormLoading}
        userGroups={userGroups}
        userSubmitWarning={userSubmitWarning}
        onUserModalClose={onUserModalClose}
      />

      {/* 隧道权限管理模态框 */}
      <TunnelPermissionModal
        assignLoading={assignLoading}
        batchTunnelSelections={batchTunnelSelections}
        currentUser={currentUser}
        getSpeedLimitsForTunnel={getSpeedLimitsForTunnel}
        handleBatchAssignTunnel={handleBatchAssignTunnel}
        handleEditTunnel={handleEditTunnel}
        handleRemoveTunnel={handleRemoveTunnel}
        handleResetTunnelFlow={handleResetTunnelFlow}
        isTunnelAssigned={isTunnelAssigned}
        isTunnelModalOpen={isTunnelModalOpen}
        monitorPermissionLoading={monitorPermissionLoading}
        monitorPermissionMutatingUserId={monitorPermissionMutatingUserId}
        monitorPermissionUserIds={monitorPermissionUserIds}
        setUserMonitorPermission={setUserMonitorPermission}
        toggleTunnelSelection={toggleTunnelSelection}
        tunnelListLoading={tunnelListLoading}
        tunnels={tunnels}
        updateTunnelSpeedLimit={updateTunnelSpeedLimit}
        userTunnels={userTunnels}
        onTunnelModalClose={onTunnelModalClose}
      />

      {/* 编辑隧道权限模态框 */}
      <EditTunnelPermissionModal
        currentUser={currentUser}
        editAvailableSpeedLimits={editAvailableSpeedLimits}
        editTunnelForm={editTunnelForm}
        editTunnelLoading={editTunnelLoading}
        editTunnelSelectedSpeedId={editTunnelSelectedSpeedId}
        handleUpdateTunnel={handleUpdateTunnel}
        isEditTunnelModalOpen={isEditTunnelModalOpen}
        setEditTunnelForm={setEditTunnelForm}
        setTunnelFlowInput={setTunnelFlowInput}
        setTunnelFlowUnit={setTunnelFlowUnit}
        tunnelFlowInput={tunnelFlowInput}
        tunnelFlowUnit={tunnelFlowUnit}
        onEditTunnelModalClose={onEditTunnelModalClose}
      />

      <ConfirmDialog
        confirmLabel="删除用户"
        message={
          <>
            确定要删除用户{" "}
            <span className="font-semibold text-foreground">
              {userToDelete?.user}
            </span>{" "}
            吗？该用户的规则与权限会一并删除，此操作不可撤销。
          </>
        }
        opened={isDeleteModalOpen}
        title="删除用户"
        onClose={onDeleteModalClose}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        confirmLabel="移除权限"
        message={
          <>
            确定要移除用户{" "}
            <span className="font-semibold text-foreground">
              {currentUser?.user}
            </span>{" "}
            对隧道{" "}
            <span className="font-semibold text-foreground">
              {tunnelToDelete?.tunnelName}
            </span>{" "}
            的权限吗？移除后该用户无法再用此隧道创建规则。
          </>
        }
        opened={isDeleteTunnelModalOpen}
        title="移除隧道权限"
        onClose={onDeleteTunnelModalClose}
        onConfirm={handleConfirmRemoveTunnel}
      />

      <ConfirmDialog
        confirmLabel="重置流量"
        loading={resetFlowLoading}
        message={
          <>
            <p>
              确定要重置用户{" "}
              <span className="font-semibold text-foreground">
                {userToReset?.user}
              </span>{" "}
              的账号流量吗？隧道权限流量不受影响，此操作不可撤销。
            </p>
            {userToReset && (
              <FlowBreakdown
                inFlow={userToReset.inFlow || 0}
                outFlow={userToReset.outFlow || 0}
                total={calculateUserTotalUsedFlow(userToReset)}
              />
            )}
          </>
        }
        opened={isResetFlowModalOpen}
        title="重置账号流量"
        tone="warning"
        onClose={onResetFlowModalClose}
        onConfirm={handleConfirmResetFlow}
      />

      <ConfirmDialog
        confirmLabel="重置流量"
        loading={resetTunnelFlowLoading}
        message={
          <>
            <p>
              确定要重置用户{" "}
              <span className="font-semibold text-foreground">
                {currentUser?.user}
              </span>{" "}
              在隧道{" "}
              <span className="font-semibold text-foreground">
                {tunnelToReset?.tunnelName}
              </span>{" "}
              上的流量吗？账号流量不受影响，此操作不可撤销。
            </p>
            {tunnelToReset && (
              <FlowBreakdown
                inFlow={tunnelToReset.inFlow || 0}
                outFlow={tunnelToReset.outFlow || 0}
                total={calculateTunnelUsedFlow(tunnelToReset)}
              />
            )}
          </>
        }
        opened={isResetTunnelFlowModalOpen}
        title="重置隧道流量"
        tone="warning"
        onClose={onResetTunnelFlowModalClose}
        onConfirm={handleConfirmResetTunnelFlow}
      />
    </AnimatedPage>
  );
}

function FlowBreakdown({
  inFlow,
  outFlow,
  total,
}: {
  inFlow: number;
  outFlow: number;
  total: number;
}) {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-default-soft p-3 text-xs">
      {[
        ["上行", inFlow],
        ["下行", outFlow],
        ["合计", total],
      ].map(([label, value]) => (
        <div key={label as string}>
          <dt className="text-default-500">{label}</dt>
          <dd className="mt-0.5 font-mono font-medium text-foreground">
            {formatFlow(value as number)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
