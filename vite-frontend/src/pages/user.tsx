import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { parseDate } from "@internationalized/date";
import { LayoutGrid, List, SearchX, UserPlus, Users } from "lucide-react";
import { SegmentedControl } from "@mantine/core";

import { SearchBar } from "@/components/search-bar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormSection } from "@/components/form-section";
import { TunnelPermissionList } from "@/pages/user/tunnel-permission-list";
import {
  UserCard,
  UserListHeader,
  UserRow,
  type UserItemHandlers,
} from "@/pages/user/user-items";
import {
  formatFlow,
  formatQuotaLimit,
  trafficInputFor,
  getExpireStatus,
  calculateUserTotalUsedFlow,
  calculateTunnelUsedFlow,
  USER_SEARCH_DEBOUNCE_MS,
  normalizeUserItem,
  normalizeUserTunnelItem,
} from "@/pages/user/presentation";
import toast from "@/lib/notifications";
import { AnimatedPage } from "@/components/animated-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@/components/ui/modal";
import { Chip } from "@/components/ui/chip";
import { Select, SelectItem } from "@/components/ui/select";
import { RadioGroup, Radio } from "@/components/ui/radio";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { Spinner } from "@/components/ui/spinner";
import {
  User,
  UserForm,
  UserGroup,
  UserTunnel,
  TunnelAssignItem,
  Tunnel,
  SpeedLimit,
  Pagination as PaginationType,
} from "@/types";
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getTunnelList,
  batchAssignUserTunnel,
  getUserTunnelList,
  removeUserTunnel,
  updateUserTunnel,
  getSpeedLimitList,
  resetUserFlow,
  resetUserQuota,
  getUserGroupList,
  getUserGroups,
  getMonitorPermissionList,
  assignMonitorPermission,
  removeMonitorPermission,
} from "@/api";
import { EmptyStateCard, PageLoadingState } from "@/components/page-state";
import { TrafficLimitField } from "@/components/traffic-limit-field";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { removeItemsById, replaceItemById } from "@/utils/list-state";
import { parseTrafficInput, type TrafficUnit } from "@/utils/traffic";

export default function UserPage() {
  // 状态管理
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useLocalStorageState(
    "user-search-keyword",
    "",
  );
  const [isSearchVisible, setIsSearchVisible] = useState(false);
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
  const {
    isOpen: isUserModalOpen,
    onOpen: onUserModalOpen,
    onClose: onUserModalClose,
  } = useDisclosure();
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
  const {
    isOpen: isTunnelModalOpen,
    onOpen: onTunnelModalOpen,
    onClose: onTunnelModalClose,
  } = useDisclosure();
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
  const {
    isOpen: isEditTunnelModalOpen,
    onOpen: onEditTunnelModalOpen,
    onClose: onEditTunnelModalClose,
  } = useDisclosure();
  const [editTunnelForm, setEditTunnelForm] = useState<UserTunnel | null>(null);
  const [tunnelFlowInput, setTunnelFlowInput] = useState("");
  const [tunnelFlowUnit, setTunnelFlowUnit] = useState<TrafficUnit>("GB");
  const [editTunnelLoading, setEditTunnelLoading] = useState(false);

  // 删除确认相关状态
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onClose: onDeleteModalClose,
  } = useDisclosure();
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // 删除隧道权限确认相关状态
  const {
    isOpen: isDeleteTunnelModalOpen,
    onOpen: onDeleteTunnelModalOpen,
    onClose: onDeleteTunnelModalClose,
  } = useDisclosure();
  const [tunnelToDelete, setTunnelToDelete] = useState<UserTunnel | null>(null);

  // 重置流量确认相关状态
  const {
    isOpen: isResetFlowModalOpen,
    onOpen: onResetFlowModalOpen,
    onClose: onResetFlowModalClose,
  } = useDisclosure();
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [resetFlowLoading, setResetFlowLoading] = useState(false);

  // 重置隧道流量确认相关状态
  const {
    isOpen: isResetTunnelFlowModalOpen,
    onOpen: onResetTunnelFlowModalOpen,
    onClose: onResetTunnelFlowModalClose,
  } = useDisclosure();
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
        toast.error(response.msg || (isEdit ? "更新失败" : "创建失败"));
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
      <div className="page-toolbar">
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
          <div className="min-w-40 flex-1 sm:max-w-72">
            <SearchBar
              isVisible={isSearchVisible}
              placeholder="搜索用户名"
              value={searchKeyword}
              onChange={setSearchKeyword}
              onClose={() => setIsSearchVisible(false)}
              onOpen={() => setIsSearchVisible(true)}
              onSubmit={handleSearch}
            />
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SegmentedControl
            aria-label="显示方式"
            data={[
              {
                value: "grid",
                label: (
                  <span className="flex items-center gap-1.5">
                    <LayoutGrid size={15} />
                    <span className="hidden sm:inline">卡片</span>
                  </span>
                ),
              },
              {
                value: "list",
                label: (
                  <span className="flex items-center gap-1.5">
                    <List size={15} />
                    <span className="hidden sm:inline">列表</span>
                  </span>
                ),
              },
            ]}
            size="sm"
            value={viewMode}
            onChange={(value) => setViewMode(value as "list" | "grid")}
          />
          <Button
            className="ml-auto sm:ml-0"
            color="primary"
            startContent={<UserPlus size={16} />}
            onPress={handleAdd}
          >
            新增<span className="hidden sm:inline">用户</span>
          </Button>
        </div>
      </div>

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
              <Button onPress={() => setSearchKeyword("")}>清空搜索</Button>
            }
            description="换个用户名再试试。"
            icon={<SearchX size={20} />}
            title="没有匹配的用户"
          />
        ) : (
          <EmptyStateCard
            action={
              <Button
                color="primary"
                startContent={<UserPlus size={16} />}
                onPress={handleAdd}
              >
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
      <Modal
        backdrop="blur"
        isOpen={isUserModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="xl"
        onClose={onUserModalClose}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">
              {isEdit ? "编辑用户" : "新增用户"}
            </h2>
            <p className="text-small text-default-500">
              {isEdit
                ? "修改账号、配额与有效期，密码留空则保持不变"
                : "创建面板账号并设置配额与有效期"}
            </p>
          </ModalHeader>
          <ModalBody>
            <FormSection title="账号">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  isRequired
                  label="用户名"
                  value={userForm.user}
                  onChange={(e) =>
                    setUserForm((prev) => ({ ...prev, user: e.target.value }))
                  }
                />
                <Input
                  isRequired={!isEdit}
                  label="密码"
                  placeholder={isEdit ? "留空则不修改密码" : "请输入密码"}
                  type="password"
                  value={userForm.pwd}
                  onChange={(e) =>
                    setUserForm((prev) => ({ ...prev, pwd: e.target.value }))
                  }
                />
              </div>
            </FormSection>
            <FormSection
              description="超出流量或规则数量后，该用户无法继续新增转发"
              title="配额与限制"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TrafficLimitField
                  isRequired
                  label="流量限制"
                  unit={userFlowUnit}
                  value={userFlowInput}
                  onChange={(value, unit) => {
                    setUserFlowInput(value);
                    setUserFlowUnit(unit);
                  }}
                />
                <Select
                  label="流量重置日期"
                  selectedKeys={[userForm.flowResetTime.toString()]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;

                    setUserForm((prev) => ({
                      ...prev,
                      flowResetTime: Number(value),
                    }));
                  }}
                >
                  <>
                    <SelectItem key="0" textValue="不重置">
                      不重置
                    </SelectItem>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <SelectItem
                        key={day.toString()}
                        textValue={`每月${day}号（0点重置）`}
                      >
                        每月{day}号（0点重置）
                      </SelectItem>
                    ))}
                  </>
                </Select>
                <Input
                  isRequired
                  label="规则数量"
                  max="99999"
                  min="1"
                  type="number"
                  value={userForm.num.toString()}
                  onChange={(e) => {
                    const value = Math.min(
                      Math.max(Number(e.target.value) || 0, 1),
                      99999,
                    );

                    setUserForm((prev) => ({ ...prev, num: value }));
                  }}
                />
                <Input
                  label="最大连接数"
                  min="0"
                  placeholder="0 或空表示不限制"
                  type="number"
                  value={
                    userForm.maxConn === 0 ? "" : String(userForm.maxConn || "")
                  }
                  onChange={(e) => {
                    const value = Math.max(Number(e.target.value) || 0, 0);

                    setUserForm((prev) => ({ ...prev, maxConn: value }));
                  }}
                />
              </div>
              {isEdit &&
                editingUser &&
                ((editingUser.dailyQuotaGB ?? 0) > 0 ||
                  (editingUser.monthlyQuotaGB ?? 0) > 0 ||
                  (editingUser.disabledByQuota ?? 0) > 0) && (
                  <div className="space-y-3 rounded-[10px] border border-divider bg-default-soft p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          当前配额状态
                        </h3>
                        <p className="text-xs text-default-500">
                          配额超额后会自动暂停该用户的转发，重置后可恢复
                        </p>
                      </div>
                      {editingUser.disabledByQuota ? (
                        <Chip color="danger" size="sm" variant="flat">
                          配额已触发禁用
                        </Chip>
                      ) : (
                        <Chip color="success" size="sm" variant="flat">
                          配额正常
                        </Chip>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-lg bg-content1 p-3">
                        <div className="text-xs text-default-500">每日用量</div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {formatFlow(Number(editingUser.dailyUsedBytes ?? 0))}{" "}
                          / {formatQuotaLimit(editingUser.dailyQuotaGB)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-content1 p-3">
                        <div className="text-xs text-default-500">每月用量</div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {formatFlow(
                            Number(editingUser.monthlyUsedBytes ?? 0),
                          )}{" "}
                          / {formatQuotaLimit(editingUser.monthlyQuotaGB)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        color="warning"
                        isLoading={quotaResetLoading}
                        size="sm"
                        variant="flat"
                        onPress={() => handleQuotaReset("daily")}
                      >
                        重置每日配额
                      </Button>
                      <Button
                        color="warning"
                        isLoading={quotaResetLoading}
                        size="sm"
                        variant="flat"
                        onPress={() => handleQuotaReset("monthly")}
                      >
                        重置每月配额
                      </Button>
                      <Button
                        color="primary"
                        isLoading={quotaResetLoading}
                        size="sm"
                        variant="flat"
                        onPress={() => handleQuotaReset("all")}
                      >
                        全部重置并恢复
                      </Button>
                    </div>
                  </div>
                )}
            </FormSection>
            <FormSection title="有效期与状态">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DatePicker
                  isRequired
                  showMonthAndYearPickers
                  label="过期时间"
                  value={
                    userForm.expTime
                      ? (parseDate(
                          userForm.expTime.toISOString().split("T")[0],
                        ) as any)
                      : null
                  }
                  onChange={(date) => {
                    if (date) {
                      const jsDate = new Date(
                        date.year,
                        date.month - 1,
                        date.day,
                        23,
                        59,
                        59,
                      );

                      setUserForm((prev) => ({ ...prev, expTime: jsDate }));
                    } else {
                      setUserForm((prev) => ({ ...prev, expTime: null }));
                    }
                  }}
                />
                <div className="flex flex-col justify-end">
                  <RadioGroup
                    label="状态"
                    orientation="horizontal"
                    value={userForm.status.toString()}
                    onValueChange={(value: string) =>
                      setUserForm((prev) => ({
                        ...prev,
                        status: Number(value),
                      }))
                    }
                  >
                    <Radio value="1">正常</Radio>
                    <Radio value="0">禁用</Radio>
                  </RadioGroup>
                </div>
              </div>
              {userGroups.length > 0 && (
                <Select
                  label="用户分组（可选）"
                  placeholder="选择要加入的分组"
                  selectedKeys={new Set((userForm.groupIds ?? []).map(String))}
                  selectionMode="multiple"
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys as Set<string>).map(
                      Number,
                    );

                    setUserForm((prev) => ({ ...prev, groupIds: selected }));
                  }}
                >
                  {userGroups.map((g) => (
                    <SelectItem key={g.id.toString()} textValue={g.name}>
                      {g.name}
                    </SelectItem>
                  ))}
                </Select>
              )}
            </FormSection>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onUserModalClose}>
              取消
            </Button>
            <Button
              color="primary"
              isLoading={userFormLoading}
              onPress={handleSubmitUser}
            >
              {isEdit ? "保存修改" : "创建用户"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 隧道权限管理模态框 */}
      <Modal
        backdrop="blur"
        isDismissable={false}
        isOpen={isTunnelModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onClose={onTunnelModalClose}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">隧道权限</h2>
            <p className="text-small text-default-500">
              管理用户 {currentUser?.user} 可使用的隧道与监控功能
            </p>
          </ModalHeader>
          <ModalBody>
            <FormSection title="监控权限">
              <div className="flex items-center justify-between gap-4 rounded-[10px] border border-divider px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    允许访问监控功能
                  </p>
                  <p className="mt-0.5 text-xs text-default-500">
                    授予后，该用户可以访问监控页面并管理服务监控（TCP/ICMP）。
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {monitorPermissionLoading ? <Spinner size="sm" /> : null}
                  <Switch
                    isDisabled={
                      !currentUser ||
                      monitorPermissionLoading ||
                      monitorPermissionMutatingUserId === currentUser.id
                    }
                    isSelected={
                      currentUser
                        ? monitorPermissionUserIds.has(currentUser.id)
                        : false
                    }
                    onValueChange={(v) =>
                      currentUser &&
                      void setUserMonitorPermission(currentUser.id, v)
                    }
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              description="流量限制、规则数量、到期时间与流量重置日期自动继承用户设置；选中后可单独指定限速。"
              title="分配新权限"
            >
              <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                {tunnels.map((tunnel) => {
                  const isAssigned = isTunnelAssigned(tunnel.id);
                  const isSelected = batchTunnelSelections.has(tunnel.id);
                  const tunnelSpeedLimits = getSpeedLimitsForTunnel(tunnel.id);

                  return (
                    <div
                      key={tunnel.id}
                      aria-disabled={isAssigned}
                      className={`
                            px-3 py-2.5 rounded-lg border transition-colors cursor-pointer
                            ${
                              isAssigned
                                ? "bg-default-soft border-divider opacity-60 cursor-not-allowed"
                                : isSelected
                                  ? "bg-primary-soft border-primary-line"
                                  : "bg-content1 border-divider hover:border-primary-line"
                            }
                          `}
                      role="button"
                      tabIndex={isAssigned ? -1 : 0}
                      onClick={() =>
                        !isAssigned && toggleTunnelSelection(tunnel.id)
                      }
                      onKeyDown={(event) => {
                        if (isAssigned) {
                          return;
                        }

                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleTunnelSelection(tunnel.id);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Checkbox
                            color="primary"
                            isDisabled={isAssigned}
                            isSelected={isSelected}
                            size="sm"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                            onValueChange={() =>
                              toggleTunnelSelection(tunnel.id)
                            }
                          />
                          <span
                            className={`text-sm font-medium truncate ${isAssigned ? "text-default-400" : "text-foreground"}`}
                          >
                            {tunnel.name}
                          </span>
                          {isAssigned && (
                            <Chip
                              className="shrink-0"
                              color="default"
                              size="sm"
                              variant="flat"
                            >
                              已分配
                            </Chip>
                          )}
                        </div>

                        {isSelected && !isAssigned && (
                          <div>
                            <Select
                              className="w-36"
                              classNames={{
                                trigger: "min-h-10 h-10",
                              }}
                              placeholder="不限速"
                              selectedKeys={
                                batchTunnelSelections.get(tunnel.id) !== null &&
                                batchTunnelSelections.get(tunnel.id) !==
                                  undefined
                                  ? [
                                      batchTunnelSelections
                                        .get(tunnel.id)!
                                        .toString(),
                                    ]
                                  : []
                              }
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              onSelectionChange={(keys) => {
                                const selectedKey = Array.from(keys)[0] as
                                  | string
                                  | undefined;

                                updateTunnelSpeedLimit(
                                  tunnel.id,
                                  selectedKey ? Number(selectedKey) : null,
                                );
                              }}
                            >
                              {tunnelSpeedLimits.map((sl) => (
                                <SelectItem
                                  key={sl.id.toString()}
                                  textValue={sl.name}
                                >
                                  {sl.name}
                                </SelectItem>
                              ))}
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {tunnels.length === 0 && (
                  <p className="rounded-[10px] border border-dashed border-divider px-4 py-6 text-center text-sm text-default-500">
                    暂无可用隧道
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="w-full sm:w-auto"
                  color="primary"
                  isDisabled={batchTunnelSelections.size === 0}
                  isLoading={assignLoading}
                  onPress={handleBatchAssignTunnel}
                >
                  分配权限
                </Button>
                {batchTunnelSelections.size > 0 && (
                  <span className="text-xs text-default-500">
                    已选 {batchTunnelSelections.size} 个隧道
                  </span>
                )}
              </div>
            </FormSection>

            <FormSection
              description={`共 ${userTunnels.length} 条隧道权限`}
              title="已有权限"
            >
              <TunnelPermissionList
                items={userTunnels}
                loading={tunnelListLoading}
                onEdit={handleEditTunnel}
                onRemove={handleRemoveTunnel}
                onResetFlow={handleResetTunnelFlow}
              />
            </FormSection>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onTunnelModalClose}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 编辑隧道权限模态框 */}
      <Modal
        backdrop="blur"
        isDismissable={false}
        isOpen={isEditTunnelModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="lg"
        onClose={onEditTunnelModalClose}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">编辑隧道权限</h2>
            <p className="text-small text-default-500">
              {currentUser?.user} · {editTunnelForm?.tunnelName}
            </p>
          </ModalHeader>
          <ModalBody>
            {editTunnelForm && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TrafficLimitField
                    isRequired
                    label="流量限制"
                    unit={tunnelFlowUnit}
                    value={tunnelFlowInput}
                    onChange={(value, unit) => {
                      setTunnelFlowInput(value);
                      setTunnelFlowUnit(unit);
                    }}
                  />

                  <Input
                    label="规则数量"
                    max="99999"
                    min="1"
                    type="number"
                    value={editTunnelForm.num.toString()}
                    onChange={(e) => {
                      const value = Math.min(
                        Math.max(Number(e.target.value) || 0, 1),
                        99999,
                      );

                      setEditTunnelForm((prev) =>
                        prev ? { ...prev, num: value } : null,
                      );
                    }}
                  />

                  <Select
                    label="限速规则"
                    placeholder="不限速"
                    selectedKeys={
                      editTunnelSelectedSpeedId !== null
                        ? [editTunnelSelectedSpeedId.toString()]
                        : []
                    }
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as
                        | string
                        | undefined;

                      setEditTunnelForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              speedId: selectedKey ? Number(selectedKey) : null,
                            }
                          : null,
                      );
                    }}
                  >
                    {editAvailableSpeedLimits.map((speedLimit) => (
                      <SelectItem
                        key={speedLimit.id.toString()}
                        textValue={speedLimit.name}
                      >
                        {speedLimit.name}
                      </SelectItem>
                    ))}
                  </Select>

                  <Select
                    label="流量重置日期"
                    selectedKeys={[editTunnelForm.flowResetTime.toString()]}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;

                      setEditTunnelForm((prev) =>
                        prev ? { ...prev, flowResetTime: Number(value) } : null,
                      );
                    }}
                  >
                    <>
                      <SelectItem key="0" textValue="不重置">
                        不重置
                      </SelectItem>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(
                        (day) => (
                          <SelectItem
                            key={day.toString()}
                            textValue={`每月${day}号（0点重置）`}
                          >
                            每月{day}号（0点重置）
                          </SelectItem>
                        ),
                      )}
                    </>
                  </Select>

                  <DatePicker
                    isRequired
                    showMonthAndYearPickers
                    label="到期时间"
                    value={
                      editTunnelForm.expTime
                        ? (parseDate(
                            new Date(editTunnelForm.expTime)
                              .toISOString()
                              .split("T")[0],
                          ) as any)
                        : null
                    }
                    onChange={(date) => {
                      if (date) {
                        const jsDate = new Date(
                          date.year,
                          date.month - 1,
                          date.day,
                          23,
                          59,
                          59,
                        );

                        setEditTunnelForm((prev) =>
                          prev ? { ...prev, expTime: jsDate.getTime() } : null,
                        );
                      } else {
                        setEditTunnelForm((prev) =>
                          prev ? { ...prev, expTime: Date.now() } : null,
                        );
                      }
                    }}
                  />
                </div>

                <RadioGroup
                  label="状态"
                  orientation="horizontal"
                  value={editTunnelForm.status.toString()}
                  onValueChange={(value: string) =>
                    setEditTunnelForm((prev) =>
                      prev ? { ...prev, status: Number(value) } : null,
                    )
                  }
                >
                  <Radio value="1">正常</Radio>
                  <Radio value="0">禁用</Radio>
                </RadioGroup>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onEditTunnelModalClose}>
              取消
            </Button>
            <Button
              color="primary"
              isLoading={editTunnelLoading}
              onPress={handleUpdateTunnel}
            >
              保存修改
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        confirmLabel="删除用户"
        isOpen={isDeleteModalOpen}
        message={
          <>
            确定要删除用户{" "}
            <span className="font-semibold text-foreground">
              {userToDelete?.user}
            </span>{" "}
            吗？该用户的规则与权限会一并删除，此操作不可撤销。
          </>
        }
        title="删除用户"
        onClose={onDeleteModalClose}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        confirmLabel="移除权限"
        isOpen={isDeleteTunnelModalOpen}
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
        title="移除隧道权限"
        onClose={onDeleteTunnelModalClose}
        onConfirm={handleConfirmRemoveTunnel}
      />

      <ConfirmDialog
        confirmLabel="重置流量"
        isOpen={isResetFlowModalOpen}
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
        title="重置账号流量"
        tone="warning"
        onClose={onResetFlowModalClose}
        onConfirm={handleConfirmResetFlow}
      />

      <ConfirmDialog
        confirmLabel="重置流量"
        isOpen={isResetTunnelFlowModalOpen}
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
