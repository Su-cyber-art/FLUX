import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  ArrowRight,
  Check,
  KeyRound,
  Network,
  Server,
  ShieldCheck,
  Target,
} from "lucide-react";
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
import { useWebViewMode } from "@/hooks/useWebViewMode";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useThemeContext } from "@/themes/context";
import { VersionFooter } from "@/components/version-footer";
import DefaultLayout from "@/layouts/default";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const config = useSiteConfig();
  const isWebView = useWebViewMode();
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
      <div className="auth-grid">
        <section className="auth-intro">
          <Text c="blue" fw={650} mb="lg" size="xs">
            节点 · 隧道 · 转发
          </Text>
          <Title fw={650} lh={1.3} order={1} size={42}>
            掌握每一条连接。
          </Title>
          <Text c="dimmed" lh={1.8} mt="lg" size="md">
            将转发规则、节点状态和访问权限集中到一个清晰的工作空间。
          </Text>
          <div className="auth-network">
            <div className="auth-network-node">
              <Server size={24} />
              <span>入口节点</span>
            </div>
            <div className="auth-network-line" />
            <div className="auth-network-node">
              <Network color="var(--primary)" size={24} />
              <span>转发隧道</span>
            </div>
            <div className="auth-network-line" />
            <div className="auth-network-node">
              <Target size={24} />
              <span>目标服务</span>
            </div>
          </div>
          <Stack gap="sm">
            {[
              "集中管理转发与流量策略",
              "实时查看节点和链路状态",
              "精细配置用户与分组权限",
            ].map((text) => (
              <Group key={text} gap="xs">
                <ThemeIcon color="teal" radius="xl" size={20} variant="light">
                  <Check size={13} />
                </ThemeIcon>
                <Text c="dimmed" size="sm">
                  {text}
                </Text>
              </Group>
            ))}
          </Stack>
        </section>
        <section className="auth-form-panel">
          <div className="auth-form">
            <Paper withBorder p={32} radius="lg">
              <ThemeIcon mb="xl" radius="md" size={44} variant="light">
                <ShieldCheck size={23} />
              </ThemeIcon>
              <Title order={2} size={25}>
                登录控制台
              </Title>
              <Text c="dimmed" mb="xl" mt={6} size="sm">
                欢迎回来，请使用你的面板账号登录。
              </Text>
              <form noValidate onSubmit={form.onSubmit(submit)}>
                <Stack gap="md">
                  <TextInput
                    required
                    autoComplete="username"
                    disabled={busy}
                    label="用户名"
                    placeholder="输入用户名"
                    {...form.getInputProps("username")}
                  />
                  <PasswordInput
                    required
                    autoComplete="current-password"
                    disabled={busy}
                    label="密码"
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
                    mt="sm"
                    rightSection={<ArrowRight size={16} />}
                    type="submit"
                  >
                    登录
                  </Button>
                </Stack>
              </form>
              {passkeyEnabled && (
                <Button
                  fullWidth
                  disabled={loading}
                  leftSection={<KeyRound size={16} />}
                  loading={passkeyLoading}
                  mt="md"
                  variant="default"
                  onClick={() => void authenticatePasskey()}
                >
                  选择通行证密钥登录
                </Button>
              )}
            </Paper>
            <VersionFooter
              containerClassName="mt-6 text-center"
              poweredClassName="text-xs text-default-500 mt-1"
              updateBadgeClassName="ml-2 rounded bg-primary-50 px-1.5 py-0.5 text-primary"
              version={isWebView ? config.app_version : config.version}
              versionClassName="text-xs text-default-500"
            />
          </div>
        </section>
      </div>
      <Modal
        isOpen={captchaOpen}
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
