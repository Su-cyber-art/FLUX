import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Divider,
  Group,
  PasswordInput,
  Stack,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { ArrowRight, KeyRound, LockKeyhole, UserRound } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";

import {
  login,
  checkCaptcha,
  getPublicConfigByName,
  getPasskeyStatus,
  beginPasskeyLogin,
  finishPasskeyLogin,
  type LoginResponse,
} from "@/api";
import { getPasskey } from "@/utils/passkey";
import { writeLoginSession } from "@/utils/session";
import { toast } from "@/lib/notifications";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@/components/ui/modal";
import { useThemeContext } from "@/themes/context";
import DefaultLayout from "@/layouts/default";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveMode } = useThemeContext();
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [siteKey, setSiteKey] = useState("");
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const busy = loading || passkeyLoading;

  useEffect(() => {
    if (!window.isSecureContext || !window.PublicKeyCredential) return;
    let active = true;

    getPasskeyStatus()
      .then((res) => {
        if (active) setPasskeyEnabled(res.code === 0 && res.data.enabled);
      })
      .catch(() => {
        if (active) setPasskeyEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const form = useForm({
    initialValues: { username: "", password: "" },
    validate: {
      username: (value: string) => (value.trim() ? null : "请输入用户名"),
      password: (value: string) =>
        value.length >= 6 ? null : "密码长度至少 6 位",
    },
  });
  const completeLogin = (data: LoginResponse) => {
    writeLoginSession(data);
    if (data.requirePasswordChange) {
      navigate("/change-password", { replace: true });

      return;
    }
    const from = (location.state as { from?: string } | null)?.from;

    navigate(
      from?.startsWith("/") &&
        !from.startsWith("//") &&
        from !== "/" &&
        from !== "/change-password"
        ? from
        : "/dashboard",
      { replace: true },
    );
  };
  const authenticate = async (captchaId = "") => {
    try {
      const response = await login({
        username: form.values.username.trim(),
        password: form.values.password,
        captchaId,
      });

      if (response.code !== 0) {
        toast.error(response.msg || "登录失败，请检查账号和密码");

        return;
      }
      completeLogin(response.data);
    } catch {
      toast.error("暂时无法连接面板，请稍后重试");
    } finally {
      setLoading(false);
    }
  };
  const authenticatePasskey = async () => {
    setPasskeyLoading(true);
    try {
      const begin = await beginPasskeyLogin();

      if (begin.code !== 0) {
        toast.error(begin.msg || "无法使用通行证密钥登录");

        return;
      }
      const credential = await getPasskey(begin.data.options);
      const result = await finishPasskeyLogin(begin.data.sessionId, credential);

      if (result.code !== 0) {
        toast.error(result.msg || "通行证密钥登录失败");

        return;
      }
      completeLogin(result.data);
    } catch {
      toast.error("通行证密钥登录已取消或失败，请重试或使用密码登录");
    } finally {
      setPasskeyLoading(false);
    }
  };
  const submit = async () => {
    if (busy) return;
    setLoading(true);
    try {
      const check = await checkCaptcha();

      if (check.code !== 0) {
        toast.error(check.msg || "无法获取验证状态");
        setLoading(false);

        return;
      }
      if (check.data === 0) {
        await authenticate();

        return;
      }
      const result = await getPublicConfigByName("cloudflare_site_key");

      if (result.code === 0 && result.data?.value) {
        setSiteKey(result.data.value);
        setCaptchaOpen(true);
      } else {
        toast.error("验证码尚未配置，请联系管理员");
        setLoading(false);
      }
    } catch {
      toast.error("暂时无法连接面板，请稍后重试");
      setLoading(false);
    }
  };

  return (
    <DefaultLayout>
      <section aria-labelledby="login-title" className="auth-card">
        <header className="auth-card-head">
          <h1 id="login-title">登录控制台</h1>
          <p>欢迎回来，请使用你的面板账号登录。</p>
        </header>
        <form noValidate onSubmit={form.onSubmit(submit)}>
          <Stack gap="sm">
            <TextInput
              required
              autoComplete="username"
              disabled={busy}
              label="用户名"
              leftSection={<UserRound size={15} />}
              placeholder="输入用户名"
              {...form.getInputProps("username")}
            />
            <PasswordInput
              required
              autoComplete="current-password"
              disabled={busy}
              label="密码"
              leftSection={<LockKeyhole size={15} />}
              placeholder="输入密码"
              visibilityToggleButtonProps={{
                "aria-label": "显示或隐藏密码",
              }}
              {...form.getInputProps("password")}
            />
            <Button
              fullWidth
              disabled={passkeyLoading}
              loading={loading}
              mt={6}
              rightSection={<ArrowRight size={15} />}
              type="submit"
            >
              登录
            </Button>
          </Stack>
        </form>
        {passkeyEnabled && (
          <>
            <Divider
              c="dimmed"
              classNames={{ label: "text-xs" }}
              label="或"
              labelPosition="center"
              my="md"
            />
            <Button
              fullWidth
              disabled={loading}
              leftSection={<KeyRound size={15} />}
              loading={passkeyLoading}
              variant="default"
              onClick={() => void authenticatePasskey()}
            >
              使用通行证密钥登录
            </Button>
          </>
        )}
      </section>
      <Modal
        opened={captchaOpen}
        size="sm"
        onClose={() => {
          setCaptchaOpen(false);
          setLoading(false);
        }}
      >
        <ModalContent>
          <ModalHeader>安全验证</ModalHeader>
          <ModalBody>
            <Group justify="center">
              {siteKey && (
                <Turnstile
                  options={{ theme: effectiveMode, size: "flexible" }}
                  siteKey={siteKey}
                  onError={() => {
                    toast.error("验证失败，请重试");
                    setLoading(false);
                  }}
                  onExpire={() => setLoading(false)}
                  onSuccess={(token) => {
                    setCaptchaOpen(false);
                    void authenticate(token);
                  }}
                />
              )}
            </Group>
          </ModalBody>
        </ModalContent>
      </Modal>
    </DefaultLayout>
  );
}
