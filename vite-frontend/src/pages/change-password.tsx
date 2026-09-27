import { useState } from "react";
import {
  Alert,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { ShieldCheck } from "lucide-react";

import { updatePassword } from "@/api";
import { toast } from "@/lib/notifications";
import DefaultLayout from "@/layouts/default";
import { safeLogout } from "@/utils/logout";
export default function ChangePasswordPage() {
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
        value.length < 6 || value.length > 20 ? "密码长度需为 6–20 位" : null,
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
    } catch {
      toast.error("修改失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DefaultLayout>
      <Container py={48} size={520}>
        <Paper withBorder p="xl" radius="lg">
          <ThemeIcon
            color="orange"
            mb="lg"
            radius="md"
            size={44}
            variant="light"
          >
            <ShieldCheck size={24} />
          </ThemeIcon>
          <Title order={1} size={24}>
            完成账号安全设置
          </Title>
          <Text c="dimmed" mb="xl" mt="sm" size="sm">
            当前账号仍使用默认登录信息，请设置新的用户名和密码。
          </Text>
          <form noValidate onSubmit={form.onSubmit(submit)}>
            <Stack gap="md">
              <TextInput
                required
                autoComplete="username"
                disabled={loading}
                label="新用户名"
                placeholder="3–20 位用户名"
                {...form.getInputProps("newUsername")}
              />
              <PasswordInput
                required
                autoComplete="current-password"
                disabled={loading}
                label="当前密码"
                {...form.getInputProps("currentPassword")}
              />
              <PasswordInput
                required
                autoComplete="new-password"
                description="6–20 位字符"
                disabled={loading}
                label="新密码"
                {...form.getInputProps("newPassword")}
              />
              <PasswordInput
                required
                autoComplete="new-password"
                disabled={loading}
                label="确认新密码"
                {...form.getInputProps("confirmPassword")}
              />
              <Alert color="blue" variant="light">
                保存后将退出当前登录，请使用新账号信息重新登录。
              </Alert>
              <Button loading={loading} type="submit">
                保存账号信息
              </Button>
            </Stack>
          </form>
        </Paper>
      </Container>
    </DefaultLayout>
  );
}
