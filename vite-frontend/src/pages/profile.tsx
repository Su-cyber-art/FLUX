import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gauge,
  KeyRound,
  LogOut,
  Settings,
  Share2,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import { toast } from "@/lib/notifications";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconTile } from "@/components/ui/icon-tile";
import { type SemanticColor } from "@/components/ui/shared";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { isWebViewFunc } from "@/utils/panel";
import { siteConfig } from "@/config/site";
import { VersionFooter } from "@/components/version-footer";
import { updatePassword } from "@/api";
import { safeLogout } from "@/utils/logout";
import { getAdminFlag, getSessionName } from "@/utils/session";
import { PasskeyManager } from "@/components/passkey-manager";
interface PasswordForm {
  newUsername: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  tone: SemanticColor;
  description: string;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    newUsername: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    // 获取用户信息
    setUsername(getSessionName() || "Admin");
    setIsAdmin(getAdminFlag());
  }, []);

  // 管理员菜单项
  const adminMenuItems: MenuItem[] = [
    {
      path: "/limit",
      label: "限速管理",
      icon: Gauge,
      tone: "warning",
      description: "管理用户限速策略",
    },
    {
      path: "/panel-sharing",
      label: "面板共享",
      icon: Share2,
      tone: "secondary",
      description: "与其他面板进行联邦共享",
    },
    {
      path: "/group",
      label: "分组管理",
      icon: ShieldCheck,
      tone: "success",
      description: "管理用户和隧道分组",
    },
    {
      path: "/user",
      label: "用户管理",
      icon: Users,
      tone: "primary",
      description: "管理系统用户",
    },
    {
      path: "/config",
      label: "网站配置",
      icon: Settings,
      tone: "secondary",
      description: "配置网站设置",
    },
  ];

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
        onOpenChange();
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

  // 重置密码表单
  const resetPasswordForm = () => {
    setPasswordForm({
      newUsername: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-6 flex-1">
        {/* 用户信息卡片 */}
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center space-x-4">
              <IconTile round size="lg" tone="primary">
                <UserRound size={22} />
              </IconTile>
              <div className="flex-1">
                <h3 className="text-base font-medium text-foreground">
                  {username}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <Chip color={isAdmin ? "primary" : "default"} size="sm">
                    {isAdmin ? "管理员" : "普通用户"}
                  </Chip>
                  <span className="text-xs text-default-500">
                    {new Date().toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 功能网格 */}
        <PasskeyManager />
        <Card>
          <CardBody className="p-4">
            <div className="grid grid-cols-3 gap-3">
              {/* 管理员功能 */}
              {isAdmin &&
                adminMenuItems.map((item) => (
                  <button
                    key={item.path}
                    className="flex flex-col items-center p-3 rounded-lg bg-default-soft hover:bg-default-soft-hover transition-colors duration-200"
                    onClick={() => navigate(item.path)}
                  >
                    <IconTile round className="mb-2" size="lg" tone={item.tone}>
                      <item.icon size={19} />
                    </IconTile>
                    <span className="text-xs text-foreground text-center">
                      {item.label}
                    </span>
                  </button>
                ))}

              {/* 修改密码 */}
              <button
                className="flex flex-col items-center p-3 rounded-lg bg-default-soft hover:bg-default-soft-hover transition-colors duration-200"
                onClick={onOpen}
              >
                <IconTile round className="mb-2" size="lg" tone="primary">
                  <KeyRound size={19} />
                </IconTile>
                <span className="text-xs text-foreground text-center">
                  修改密码
                </span>
              </button>

              {/* 退出登录 */}
              <button
                className="flex flex-col items-center p-3 rounded-lg bg-default-soft hover:bg-default-soft-hover transition-colors duration-200"
                onClick={handleLogout}
              >
                <IconTile round className="mb-2" size="lg" tone="danger">
                  <LogOut size={19} />
                </IconTile>
                <span className="text-xs text-foreground text-center">
                  退出登录
                </span>
              </button>
            </div>
          </CardBody>
        </Card>

        <VersionFooter
          containerClassName="mt-6 text-center py-4"
          poweredClassName="text-xs text-default-400"
          updateBadgeClassName="ml-2 inline-flex items-center rounded-full bg-danger px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white"
          version={
            isWebViewFunc() ? siteConfig.app_version : siteConfig.version
          }
          versionClassName="text-xs text-default-400 mt-1"
        />
      </div>

      {/* 修改密码弹窗 */}
      <Modal
        backdrop="blur"
        isOpen={isOpen}
        placement="center"
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={() => {
          onOpenChange();
          resetPasswordForm();
        }}
      >
        <ModalContent>
          {(onClose: () => void) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                修改密码
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <Input
                    label="新用户名"
                    placeholder="请输入新用户名（至少3位）"
                    value={passwordForm.newUsername}
                    variant="bordered"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        newUsername: e.target.value,
                      }))
                    }
                  />
                  <Input
                    label="当前密码"
                    placeholder="请输入当前密码"
                    type="password"
                    value={passwordForm.currentPassword}
                    variant="bordered"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        currentPassword: e.target.value,
                      }))
                    }
                  />
                  <Input
                    label="新密码"
                    placeholder="请输入新密码（至少6位）"
                    type="password"
                    value={passwordForm.newPassword}
                    variant="bordered"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                  />
                  <Input
                    label="确认密码"
                    placeholder="请再次输入新密码"
                    type="password"
                    value={passwordForm.confirmPassword}
                    variant="bordered"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button
                  color="primary"
                  isLoading={passwordLoading}
                  onPress={handlePasswordSubmit}
                >
                  确定
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
