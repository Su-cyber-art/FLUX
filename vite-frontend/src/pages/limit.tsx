import { useState, useEffect, useMemo } from "react";
import { ActionIcon, Tooltip, Badge, Button, TextInput } from "@mantine/core";
import { Gauge, Plus, SearchX, SquarePen, Trash2 } from "lucide-react";

import toast from "@/lib/notifications";
import { PageToolbar } from "@/components/page-toolbar";
import { AnimatedPage } from "@/components/animated-page";
import { SearchBar } from "@/components/search-bar";
import { Card } from "@/components/ui/card";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
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
      <Badge
        color="orange"
        leftSection={<span className="badge-dot" />}
        size="xs"
        variant="light"
      >
        停用
      </Badge>
    );

  return (
    <AnimatedPage>
      <PageToolbar
        primary={{
          label: "新增",
          noun: "策略",
          icon: <Plus size={16} />,
          onClick: handleAdd,
        }}
        search={
          <SearchBar
            placeholder="搜索限速策略名称"
            value={searchKeyword}
            onChange={setSearchKeyword}
          />
        }
        view={{ value: viewMode, onChange: setViewMode }}
      />

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
              <Button variant="default" onClick={() => setSearchKeyword("")}>
                清空搜索
              </Button>
            }
            description="换个关键词再试试。"
            icon={<SearchX size={20} />}
            title="没有匹配的限速策略"
            tone="default"
          />
        ) : (
          <EmptyStateCard
            action={
              <Button leftSection={<Plus size={16} />} onClick={handleAdd}>
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
      <Modal opened={modalOpen} size="2xl" onClose={() => setModalOpen(false)}>
        <ModalContent>
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
              <TextInput
                error={errors.name}
                label="规则名称"
                placeholder="请输入限速规则名称"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />

              <TextInput
                error={errors.speed}
                label="速度限制"
                placeholder="请输入速度限制"
                rightSection={
                  <div className="pointer-events-none flex items-center">
                    <span className="text-default-400 text-small">Mbps</span>
                  </div>
                }
                type="number"
                value={form.speed.toString()}
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
            <Button
              color="gray"
              variant="subtle"
              onClick={() => setModalOpen(false)}
            >
              取消
            </Button>
            <Button loading={submitLoading} onClick={handleSubmit}>
              {isEdit ? "保存修改" : "创建规则"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        opened={deleteModalOpen}
        size="2xl"
        onClose={() => setDeleteModalOpen(false)}
      >
        <ModalContent>
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
            <Button
              color="gray"
              variant="subtle"
              onClick={() => setDeleteModalOpen(false)}
            >
              取消
            </Button>
            <Button color="red" loading={deleteLoading} onClick={confirmDelete}>
              确认删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </AnimatedPage>
  );
}
