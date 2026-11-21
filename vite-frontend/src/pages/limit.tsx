import { useState, useEffect, useMemo } from "react";
import { ActionIcon, Tooltip, Button, TextInput } from "@mantine/core";
import { Gauge, Plus, SearchX, SquarePen, Trash2 } from "lucide-react";

import toast from "@/lib/notifications";
import { PageToolbar } from "@/components/page-toolbar";
import { AnimatedPage } from "@/components/animated-page";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
    <div className="access-actions">
      <Tooltip label="编辑">
        <ActionIcon
          aria-label={`编辑 ${rule.name}`}
          color="gray"
          variant="subtle"
          onClick={() => handleEdit(rule)}
        >
          <SquarePen size={15} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="删除">
        <ActionIcon
          aria-label={`删除 ${rule.name}`}
          color="red"
          variant="subtle"
          onClick={() => handleDelete(rule)}
        >
          <Trash2 size={15} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
  const ruleStatus = (rule: SpeedLimitRule) => (
    <span
      className="status-dot"
      data-tone={rule.status === 1 ? "success" : "warning"}
    >
      {rule.status === 1 ? "启用" : "停用"}
    </span>
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
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-default-500">
          <span>
            共{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {filteredRules.length}
            </span>{" "}
            条策略
            {filteredRules.length !== rules.length &&
              `（已筛选，全部 ${rules.length} 条）`}
          </span>
          <span className="status-dot" data-tone="success">
            启用 {enabledCount}
          </span>
          {filteredRules.length - enabledCount > 0 && (
            <span className="status-dot" data-tone="warning">
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
        <div className="access-table limit-table">
          <div className="access-table-head" role="presentation">
            <span className="limit-cell-name">策略名称</span>
            <span className="limit-cell-speed">带宽上限</span>
            <span className="limit-cell-bytes">约合</span>
            <span className="limit-cell-status">状态</span>
            <span className="limit-cell-actions" />
          </div>
          {filteredRules.map((rule) => (
            <div key={rule.id} className="access-table-row">
              <span
                className="limit-cell-name truncate font-medium text-foreground"
                title={rule.name}
              >
                {rule.name}
              </span>
              <span className="limit-cell-speed">
                <span className="limit-speed-value">{rule.speed}</span>
                <span className="limit-speed-unit">Mbps</span>
              </span>
              <span className="limit-cell-bytes">{speedLabel(rule.speed)}</span>
              <span className="limit-cell-status">{ruleStatus(rule)}</span>
              <span className="limit-cell-actions">{ruleActions(rule)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="access-grid">
          {filteredRules.map((rule) => (
            <Card
              key={rule.id}
              className="limit-card"
              data-disabled={rule.status !== 1 || undefined}
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span
                  className="truncate text-[13.5px] font-semibold text-foreground"
                  title={rule.name}
                >
                  {rule.name}
                </span>
                {ruleActions(rule)}
              </div>
              <div className="flex items-end justify-between gap-3">
                <p className="leading-none">
                  <span className="limit-card-speed">{rule.speed}</span>
                  <span className="limit-speed-unit">Mbps</span>
                </p>
                {ruleStatus(rule)}
              </div>
              <p className="text-xs tabular-nums text-default-500">
                {speedLabel(rule.speed)}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* 新增/编辑模态框 */}
      <Modal opened={modalOpen} size="sm" onClose={() => setModalOpen(false)}>
        <ModalContent>
          <ModalHeader>
            <h2>{isEdit ? "编辑限速规则" : "新增限速规则"}</h2>
            <p>{isEdit ? "修改现有限速规则的配置信息" : "创建新的限速规则"}</p>
          </ModalHeader>
          <ModalBody>
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
              description={form.speed > 0 ? speedLabel(form.speed) : undefined}
              error={errors.speed}
              label="速度限制"
              placeholder="请输入速度限制"
              rightSection={
                <span className="pointer-events-none text-xs text-default-400">
                  Mbps
                </span>
              }
              rightSectionWidth={52}
              type="number"
              value={form.speed.toString()}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  speed: parseInt(e.target.value) || 0,
                }))
              }
            />
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

      <ConfirmDialog
        confirmLabel="确认删除"
        loading={deleteLoading}
        message={
          <>
            确定要删除限速规则{" "}
            <span className="font-semibold text-foreground">
              “{ruleToDelete?.name}”
            </span>{" "}
            吗？此操作无法撤销，删除后该规则将永久消失。
          </>
        }
        opened={deleteModalOpen}
        title="确认删除"
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
    </AnimatedPage>
  );
}
