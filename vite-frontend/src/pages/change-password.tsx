import { useState } from "react";
import {
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  Info,
  LockKeyhole,
  LogOut,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { updatePassword } from "@/api";
import { IconTile } from "@/components/ui/icon-tile";
import { toast } from "@/lib/notifications";
import DefaultLayout from "@/layouts/default";
import { safeLogout } from "@/utils/logout";
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const form = useForm({
    initialValues: {
      newUsername: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    validate: {
      newUsername: (value: string) =>
        value.trim().length < 3 || value.length > 20
          ? "用户名长度需为 3–20 位"
          : null,
      currentPassword: (value: string) => (value ? null : "请输入当前密码"),
      newPassword: (value: string) =>
        value === "admin_user"
          ? "新密码不能使用默认密码"
          : value.length < 6 || value.length > 20
            ? "密码长度需为 6–20 位"
            : null,
      confirmPassword: (value: string, values: { newPassword: string }) =>
        value === values.newPassword ? null : "两次输入的密码不一致",
    },
  });
  const submit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const result = await updatePassword(values);

      if (result.code !== 0) {
        toast.error(result.msg || "修改失败");

        return;
      }
      toast.success("账号信息已更新，请重新登录");
      safeLogout();
      navigate("/", { replace: true, state: null });
    } catch {
      toast.error("修改失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DefaultLayout>
      <div className="auth-form-panel">
        <div className="auth-form">
          <Paper withBorder p={{ base: 24, sm: 32 }} radius="lg" shadow="xs">
            <IconTile className="mb-5" tone="warning">
              <ShieldAlert size={19} />
            </IconTile>
            <Title order={1} size={24}>
              完成账号安全设置
            </Title>
            <Text c="dimmed" mb={28} mt={6} size="sm">
              当前账号仍在使用默认登录信息，设置新的用户名和密码后才能继续使用面板。
            </Text>
            <form noValidate onSubmit={form.onSubmit(submit)}>
              <Stack gap="md">
                <TextInput
                  required
                  autoComplete="username"
                  disabled={loading}
                  label="新用户名"
                  leftSection={<UserRound size={16} />}
                  placeholder="3–20 位用户名"
                  {...form.getInputProps("newUsername")}
                />
                <PasswordInput
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  label="当前密码"
                  leftSection={<LockKeyhole size={16} />}
                  placeholder="用于验证身份"
                  {...form.getInputProps("currentPassword")}
                />
                <PasswordInput
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  label="新密码"
                  leftSection={<LockKeyhole size={16} />}
                  placeholder="6–20 位字符"
                  {...form.getInputProps("newPassword")}
                />
                <PasswordInput
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  label="确认新密码"
                  leftSection={<LockKeyhole size={16} />}
                  placeholder="再次输入新密码"
                  {...form.getInputProps("confirmPassword")}
                />
                <p className="flex items-start gap-1.5 text-xs text-default-500">
                  <Info className="mt-px shrink-0" size={13} />
                  保存后将退出当前登录，请使用新账号信息重新登录。
                </p>
                <Button fullWidth loading={loading} type="submit">
                  保存并重新登录
                </Button>
              </Stack>
            </form>
          </Paper>
          <Button
            fullWidth
            color="gray"
            disabled={loading}
            leftSection={<LogOut size={15} />}
            mt="md"
            variant="subtle"
            onClick={() => {
              safeLogout();
              navigate("/", { replace: true, state: null });
            }}
          >
            退出登录
          </Button>
        </div>
      </div>
    </DefaultLayout>
  );
}
