import { useState, useEffect, useMemo } from "react";
import { ActionIcon, SegmentedControl, Tooltip } from "@mantine/core";
import {
  Gauge,
  LayoutGrid,
  List,
  Plus,
  SearchX,
  SquarePen,
  Trash2,
} from "lucide-react";

import toast from "@/lib/notifications";
import { AnimatedPage } from "@/components/animated-page";
import { SearchBar } from "@/components/search-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Chip } from "@/components/ui/chip";
import {
  createSpeedLimit,
  getSpeedLimitList,
  updateSpeedLimit,
  deleteSpeedLimit,
} from "@/api";
import { EmptyStateCard, PageLoadingState } from "@/components/page-state";
import { IconTile } from "@/components/ui/icon-tile";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";

interface SpeedLimitRule {
  id: number;
  name: string;
  speed: number;
  status: number;
  createdTime: string;
  updatedTime: string;
}

interface SpeedLimitForm {
  id?: number;
  name: string;
  speed: number;
  status: number;
}

export default function LimitPage() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<SpeedLimitRule[]>([]);
  const [searchKeyword, setSearchKeyword] = useLocalStorageState(
    "limit-search-keyword",
    "",
  );
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [viewMode, setViewMode] = useLocalStorageState<"list" | "grid">(
    "limit-view-mode",
    "grid",
  );

  const filteredRules = useMemo(() => {
    if (!searchKeyword.trim()) return rules;
    const lowerKeyword = searchKeyword.toLowerCase();

    return rules.filter(
      (r) => r.name && r.name.toLowerCase().includes(lowerKeyword),
    );
  }, [rules, searchKeyword]);

  // 模态框状态
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<SpeedLimitRule | null>(null);

  // 表单状态
  const [form, setForm] = useState<SpeedLimitForm>({
    name: "",
    speed: 100,
    status: 1,
  });

  // 表单验证错误
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadData();
  }, []);

  // 加载所有数据
  const loadData = async () => {
    setLoading(true);
    try {
      const rulesRes = await getSpeedLimitList();

      if (rulesRes.code === 0) {
        setRules(rulesRes.data || []);
      } else {
        toast.error(rulesRes.msg || "获取限速规则失败");
      }
    } catch {
      toast.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!form.name.trim()) {
      newErrors.name = "请输入规则名称";
    } else if (form.name.length < 2 || form.name.length > 50) {
      newErrors.name = "规则名称长度应在2-50个字符之间";
    }

    if (!form.speed || form.speed < 1) {
      newErrors.speed = "请输入有效的速度限制（≥1 Mbps）";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // 新增规则
  const handleAdd = () => {
    setIsEdit(false);
    setForm({
      name: "",
      speed: 100,
      status: 1,
    });
    setErrors({});
    setModalOpen(true);
  };

  // 编辑规则
  const handleEdit = (rule: SpeedLimitRule) => {
    setIsEdit(true);
    setForm({
      id: rule.id,
      name: rule.name,
      speed: rule.speed,
      status: rule.status,
    });
    setErrors({});
    setModalOpen(true);
  };

  // 显示删除确认
  const handleDelete = (rule: SpeedLimitRule) => {
    setRuleToDelete(rule);
    setDeleteModalOpen(true);
  };

  // 确认删除规则
  const confirmDelete = async () => {
    if (!ruleToDelete) return;

    setDeleteLoading(true);
    try {
      const res = await deleteSpeedLimit(ruleToDelete.id);

      if (res.code === 0) {
        toast.success("删除成功");
        setDeleteModalOpen(false);
        loadData();
      } else {
        toast.error(res.msg || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleteLoading(false);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitLoading(true);
    try {
      let res: { code: number; msg: string };
      const payload = {
        id: form.id,
        name: form.name,
        speed: form.speed,
        status: form.status,
      };

      if (isEdit) {
        res = await updateSpeedLimit(payload);
      } else {
        const createData = {
          name: payload.name,
          speed: payload.speed,
          status: payload.status,
        };

        res = await createSpeedLimit(createData);
      }

      if (res.code === 0) {
        toast.success(isEdit ? "修改成功" : "创建成功");
        setModalOpen(false);
        loadData();
      } else {
        toast.error(res.msg || "操作失败");
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return <PageLoadingState message="正在加载..." />;
  }

  const enabledCount = filteredRules.filter((rule) => rule.status === 1).length;
  const speedLabel = (speed: number) =>
    `≈ ${(speed / 8).toFixed(speed % 8 === 0 ? 0 : 1)} MB/s`;
  const ruleActions = (rule: SpeedLimitRule) => (
    <>
      <Tooltip label="编辑">
        <ActionIcon
          aria-label={`编辑 ${rule.name}`}
          color="gray"
          variant="subtle"
          onClick={() => handleEdit(rule)}
        >
          <SquarePen size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="删除">
        <ActionIcon
          aria-label={`删除 ${rule.name}`}
          color="red"
          variant="subtle"
          onClick={() => handleDelete(rule)}
        >
          <Trash2 size={16} />
        </ActionIcon>
      </Tooltip>
    </>
  );
  const ruleStatus = (rule: SpeedLimitRule) =>
    rule.status === 1 ? null : (
      <Chip dot color="warning" size="xs">
        停用
      </Chip>
    );

  return (
    <AnimatedPage>
      <div className="page-toolbar">
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
          <div className="min-w-40 flex-1 sm:max-w-72">
            <SearchBar
              isVisible={isSearchVisible}
              placeholder="搜索限速策略名称"
              value={searchKeyword}
              onChange={setSearchKeyword}
              onClose={() => setIsSearchVisible(false)}
              onOpen={() => setIsSearchVisible(true)}
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
            startContent={<Plus size={16} />}
            onPress={handleAdd}
          >
            新增<span className="hidden sm:inline">策略</span>
          </Button>
        </div>
      </div>

      {rules.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-default-500">
          <span>
            共{" "}
            <span className="font-semibold text-foreground">
              {filteredRules.length}
            </span>{" "}
            条策略
            {filteredRules.length !== rules.length &&
              `（已筛选，全部 ${rules.length} 条）`}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            启用 {enabledCount}
          </span>
          {filteredRules.length - enabledCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              停用 {filteredRules.length - enabledCount}
            </span>
          )}
        </div>
      )}

      {filteredRules.length === 0 ? (
        rules.length > 0 ? (
          <EmptyStateCard
            action={
              <Button onPress={() => setSearchKeyword("")}>清空搜索</Button>
            }
            description="换个关键词再试试。"
            icon={<SearchX size={20} />}
            title="没有匹配的限速策略"
          />
        ) : (
          <EmptyStateCard
            action={
              <Button
                color="primary"
                startContent={<Plus size={16} />}
                onPress={handleAdd}
              >
                新增策略
              </Button>
            }
            description="创建带宽上限后，可以在用户、隧道权限和转发规则中选用。"
            icon={<Gauge size={20} />}
            title="还没有限速策略"
          />
        )
      ) : viewMode === "list" ? (
        <div className="overflow-hidden rounded-[10px] border border-divider bg-content1">
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-3 border-divider px-4 py-3 transition-colors hover:bg-default-soft [&+&]:border-t"
            >
              <IconTile
                size="sm"
                tone={rule.status === 1 ? "primary" : "default"}
              >
                <Gauge size={15} />
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {rule.name}
                  </span>
                  {ruleStatus(rule)}
                </div>
                <p className="text-xs text-default-500">
                  {speedLabel(rule.speed)}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                {rule.speed} Mbps
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                {ruleActions(rule)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {filteredRules.map((rule) => (
            <Card key={rule.id} className="h-full gap-4 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <IconTile
                    size="sm"
                    tone={rule.status === 1 ? "primary" : "default"}
                  >
                    <Gauge size={15} />
                  </IconTile>
                  <span
                    className="truncate text-sm font-semibold text-foreground"
                    title={rule.name}
                  >
                    {rule.name}
                  </span>
                </div>
                {ruleStatus(rule)}
              </div>
              <div>
                <p className="metric-value text-[26px] font-semibold leading-tight text-foreground">
                  {rule.speed}
                  <span className="ml-1 text-sm font-medium text-default-500">
                    Mbps
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-default-500">
                  {speedLabel(rule.speed)}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-end gap-0.5 border-t border-divider pt-2">
                {ruleActions(rule)}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 新增/编辑模态框 */}
      <Modal
        backdrop="blur"
        isOpen={modalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={setModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">
                  {isEdit ? "编辑限速规则" : "新增限速规则"}
                </h2>
                <p className="text-small text-default-500">
                  {isEdit ? "修改现有限速规则的配置信息" : "创建新的限速规则"}
                </p>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <Input
                    errorMessage={errors.name}
                    isInvalid={!!errors.name}
                    label="规则名称"
                    placeholder="请输入限速规则名称"
                    value={form.name}
                    variant="bordered"
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />

                  <Input
                    endContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-small">
                          Mbps
                        </span>
                      </div>
                    }
                    errorMessage={errors.speed}
                    isInvalid={!!errors.speed}
                    label="速度限制"
                    placeholder="请输入速度限制"
                    type="number"
                    value={form.speed.toString()}
                    variant="bordered"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        speed: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button
                  color="primary"
                  isLoading={submitLoading}
                  onPress={handleSubmit}
                >
                  {isEdit ? "保存修改" : "创建规则"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        backdrop="blur"
        isOpen={deleteModalOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={setDeleteModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-lg font-bold text-danger">确认删除</h2>
              </ModalHeader>
              <ModalBody>
                <p className="text-default-600">
                  确定要删除限速规则{" "}
                  <span className="font-semibold text-foreground">
                    &quot;{ruleToDelete?.name}&quot;
                  </span>{" "}
                  吗？
                </p>
                <p className="text-small text-default-500 mt-2">
                  此操作无法撤销，删除后该规则将永久消失。
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button
                  color="danger"
                  isLoading={deleteLoading}
                  onPress={confirmDelete}
                >
                  确认删除
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </AnimatedPage>
  );
}
