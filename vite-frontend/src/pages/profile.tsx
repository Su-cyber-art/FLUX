import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  KeyRound,
  LayoutGrid,
  LogOut,
  Palette,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Badge, Button, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import { toast } from "@/lib/notifications";
import { AnimatedPage } from "@/components/animated-page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { SectionHeader } from "@/components/section-header";
import { ThemeSettings } from "@/components/theme-settings";
import { navigation } from "@/config/navigation";
import { isWebViewFunc } from "@/utils/panel";
import { siteConfig } from "@/config/site";
import { VersionFooter } from "@/components/version-footer";
import { updatePassword } from "@/api";
import { safeLogout } from "@/utils/logout";
import { getAdminFlag, getSessionName } from "@/utils/session";
import { PasskeyManager } from "@/components/passkey-manager";
import { uiColor } from "@/components/ui/shared";

interface PasswordForm {
  newUsername: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY_PASSWORD_FORM: PasswordForm = {
  newUsername: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const ADMIN_SHORTCUTS = [
  "/user",
  "/group",
  "/limit",
  "/panel-sharing",
  "/config",
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const [passwordModalOpened, passwordModal] = useDisclosure();
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] =
    useState<PasswordForm>(EMPTY_PASSWORD_FORM);

  useEffect(() => {
    // 获取用户信息
    setUsername(getSessionName() || "Admin");
    setIsAdmin(getAdminFlag());
  }, []);

  const shortcuts = navigation.filter((item) =>
    ADMIN_SHORTCUTS.includes(item.path),
  );
  const initials = username.slice(0, 2).toUpperCase();

  // 退出登录
  const handleLogout = () => {
    safeLogout();
  };

  // 密码表单验证
  const validatePasswordForm = (): boolean => {
    if (!passwordForm.newUsername.trim()) {
      toast.error("请输入新用户名");

      return false;
    }
    if (passwordForm.newUsername.length < 3) {
      toast.error("用户名长度至少3位");

      return false;
    }
    if (!passwordForm.currentPassword) {
      toast.error("请输入当前密码");

      return false;
    }
    if (!passwordForm.newPassword) {
      toast.error("请输入新密码");

      return false;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("新密码长度不能少于6位");

      return false;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("两次输入密码不一致");

      return false;
    }

    return true;
  };

  // 提交密码修改
  const handlePasswordSubmit = async () => {
    if (!validatePasswordForm()) return;

    setPasswordLoading(true);
    try {
      const response = await updatePassword(passwordForm);

      if (response.code === 0) {
        toast.success("密码修改成功，请重新登录");
        passwordModal.close();
        handleLogout();
      } else {
        toast.error(response.msg || "密码修改失败");
      }
    } catch {
      toast.error("修改密码时发生错误");
    } finally {
      setPasswordLoading(false);
    }
  };

  const updateField =
    (field: keyof PasswordForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <AnimatedPage className="flex w-full max-w-[960px] flex-col gap-5">
      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <div aria-hidden className="profile-avatar">
            {initials || <UserRound size={22} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-foreground">
                {username}
              </h2>
              <Badge
                color={uiColor(isAdmin ? "primary" : "default")}
                leftSection={isAdmin ? <ShieldCheck size={12} /> : undefined}
                size="sm"
                variant="light"
              >
                {isAdmin ? "管理员" : "普通用户"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-default-500">
              {isAdmin
                ? "拥有面板的全部管理权限"
                : "可以管理自己的转发规则，并使用已授权的隧道"}
            </p>
          </div>
          <Button
            className="w-full sm:w-auto"
            color="red"
            leftSection={<LogOut size={15} />}
            variant="light"
            onClick={handleLogout}
          >
            退出登录
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionHeader
            description="登录凭据与免密登录方式"
            icon={ShieldCheck}
            title="账号安全"
          />
        </CardHeader>
        <CardBody className="pt-0">
          <div className="settings-row">
            <div>
              <p className="settings-row-label">用户名与密码</p>
              <p className="settings-row-desc">
                同时修改登录用户名和密码，保存后需要使用新凭据重新登录。
              </p>
            </div>
            <div>
              <Button
                color="gray"
                leftSection={<KeyRound size={14} />}
                size="xs"
                variant="light"
                onClick={passwordModal.open}
              >
                修改凭据
              </Button>
            </div>
          </div>
          <PasskeyManager />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionHeader
            description="仅对当前浏览器生效，不影响其他用户"
            icon={Palette}
            title="外观偏好"
          />
        </CardHeader>
        <CardBody className="pt-0">
          <ThemeSettings />
        </CardBody>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader
              description="常用的管理页面"
              icon={LayoutGrid}
              title="管理入口"
            />
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-2 pt-0 sm:grid-cols-2">
            {shortcuts.map((item) => (
              <button
                key={item.path}
                className="profile-shortcut"
                type="button"
                onClick={() => navigate(item.path)}
              >
                <IconTile size="sm" tone="primary">
                  <item.icon size={15} />
                </IconTile>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-default-500">
                    {item.description}
                  </span>
                </span>
                <ChevronRight className="shrink-0 text-default-400" size={16} />
              </button>
            ))}
          </CardBody>
        </Card>
      )}

      <VersionFooter
        containerClassName="flex items-center justify-center gap-3 pb-2"
        poweredClassName="text-xs text-default-400"
        version={isWebViewFunc() ? siteConfig.app_version : siteConfig.version}
        versionClassName="text-xs text-default-400"
      />

      <Modal
        opened={passwordModalOpened}
        size="md"
        onClose={() => {
          passwordModal.close();
          setPasswordForm(EMPTY_PASSWORD_FORM);
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            修改用户名与密码
            <span className="text-xs font-normal text-default-500">
              保存后会退出登录，请使用新凭据重新登录。
            </span>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-3">
              <TextInput
                autoComplete="username"
                label="新用户名"
                placeholder="至少 3 位"
                value={passwordForm.newUsername}
                onChange={updateField("newUsername")}
              />
              <TextInput
                autoComplete="current-password"
                label="当前密码"
                placeholder="用于验证身份"
                type="password"
                value={passwordForm.currentPassword}
                onChange={updateField("currentPassword")}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput
                  autoComplete="new-password"
                  label="新密码"
                  placeholder="至少 6 位"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={updateField("newPassword")}
                />
                <TextInput
                  autoComplete="new-password"
                  label="确认新密码"
                  placeholder="再次输入新密码"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={updateField("confirmPassword")}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="gray"
              variant="subtle"
              onClick={() => {
                passwordModal.close();
                setPasswordForm(EMPTY_PASSWORD_FORM);
              }}
            >
              取消
            </Button>
            <Button loading={passwordLoading} onClick={handlePasswordSubmit}>
              保存并重新登录
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </AnimatedPage>
  );
}
