import type * as React from "react";

import {
  Badge,
  Button,
  Group,
  MultiSelect,
  Radio,
  Select,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";

import { FormSection } from "@/components/form-section";
import { TrafficLimitField } from "@/components/traffic-limit-field";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { endOfDay } from "@/pages/user/presentation";
import { formatFlow, formatQuotaLimit } from "@/pages/user/presentation";
import { type User, type UserForm, type UserGroup } from "@/types";
import { type TrafficUnit } from "@/utils/traffic";

interface UserFormModalProps {
  isUserModalOpen: boolean;
  onUserModalClose: () => void;
  isEdit: boolean;
  userForm: UserForm;
  setUserForm: React.Dispatch<React.SetStateAction<UserForm>>;
  userFlowUnit: TrafficUnit;
  userFlowInput: string;
  setUserFlowInput: React.Dispatch<React.SetStateAction<string>>;
  setUserFlowUnit: React.Dispatch<React.SetStateAction<TrafficUnit>>;
  editingUser: User | null;
  quotaResetLoading: boolean;
  handleQuotaReset: (scope: "daily" | "monthly" | "all") => Promise<void>;
  userGroups: UserGroup[];
  userFormLoading: boolean;
  handleSubmitUser: () => Promise<void>;
}

export function UserFormModal({
  isUserModalOpen,
  onUserModalClose,
  isEdit,
  userForm,
  setUserForm,
  userFlowUnit,
  userFlowInput,
  setUserFlowInput,
  setUserFlowUnit,
  editingUser,
  quotaResetLoading,
  handleQuotaReset,
  userGroups,
  userFormLoading,
  handleSubmitUser,
}: UserFormModalProps) {
  return (
    <Modal opened={isUserModalOpen} size="xl" onClose={onUserModalClose}>
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
              <TextInput
                required
                label="用户名"
                value={userForm.user}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, user: e.target.value }))
                }
              />
              <TextInput
                label="密码"
                placeholder={isEdit ? "留空则不修改密码" : "请输入密码"}
                required={!isEdit}
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
                searchable
                data={[
                  { value: "0", label: "不重置" },
                  ...Array.from({ length: 31 }, (_, i) => i + 1).map((day) => ({
                    value: day.toString(),
                    label: `每月${day}号（0点重置）`,
                  })),
                ]}
                label="流量重置日期"
                value={userForm.flowResetTime.toString()}
                onChange={(value) => {
                  setUserForm((prev) => ({
                    ...prev,
                    flowResetTime: Number(value),
                  }));
                }}
              />
              <TextInput
                required
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
              <TextInput
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
                      <Badge color="red" size="sm" variant="light">
                        配额已触发禁用
                      </Badge>
                    ) : (
                      <Badge color="teal" size="sm" variant="light">
                        配额正常
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-content1 p-3">
                      <div className="text-xs text-default-500">每日用量</div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {formatFlow(Number(editingUser.dailyUsedBytes ?? 0))} /{" "}
                        {formatQuotaLimit(editingUser.dailyQuotaGB)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-content1 p-3">
                      <div className="text-xs text-default-500">每月用量</div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {formatFlow(Number(editingUser.monthlyUsedBytes ?? 0))}{" "}
                        / {formatQuotaLimit(editingUser.monthlyQuotaGB)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      color="orange"
                      loading={quotaResetLoading}
                      size="xs"
                      variant="light"
                      onClick={() => handleQuotaReset("daily")}
                    >
                      重置每日配额
                    </Button>
                    <Button
                      color="orange"
                      loading={quotaResetLoading}
                      size="xs"
                      variant="light"
                      onClick={() => handleQuotaReset("monthly")}
                    >
                      重置每月配额
                    </Button>
                    <Button
                      loading={quotaResetLoading}
                      size="xs"
                      variant="light"
                      onClick={() => handleQuotaReset("all")}
                    >
                      全部重置并恢复
                    </Button>
                  </div>
                </div>
              )}
          </FormSection>
          <FormSection title="有效期与状态">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DateInput
                required
                label="过期时间"
                value={
                  userForm.expTime
                    ? dayjs(userForm.expTime).format("YYYY-MM-DD")
                    : null
                }
                onChange={(date) =>
                  setUserForm((prev) => ({
                    ...prev,
                    expTime: date ? endOfDay(date) : null,
                  }))
                }
              />
              <div className="flex flex-col justify-end">
                <Radio.Group
                  label="状态"
                  value={userForm.status.toString()}
                  onChange={(value) =>
                    setUserForm((prev) => ({
                      ...prev,
                      status: Number(value),
                    }))
                  }
                >
                  <Group mt="xs">
                    <Radio label="正常" value="1" />
                    <Radio label="禁用" value="0" />
                  </Group>
                </Radio.Group>
              </div>
            </div>
            {userGroups.length > 0 && (
              <MultiSelect
                searchable
                data={userGroups.map((g) => ({
                  value: g.id.toString(),
                  label: g.name,
                }))}
                label="用户分组（可选）"
                placeholder="选择要加入的分组"
                value={(userForm.groupIds ?? []).map(String)}
                onChange={(values) => {
                  const selected = Array.from(values).map(Number);

                  setUserForm((prev) => ({ ...prev, groupIds: selected }));
                }}
              />
            )}
          </FormSection>
        </ModalBody>
        <ModalFooter>
          <Button color="gray" variant="subtle" onClick={onUserModalClose}>
            取消
          </Button>
          <Button loading={userFormLoading} onClick={handleSubmitUser}>
            {isEdit ? "保存修改" : "创建用户"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
