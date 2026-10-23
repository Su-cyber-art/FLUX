import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Divider,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  KeyRound,
  LockKeyhole,
  Network,
  Server,
  Target,
  UserRound,
  Users,
  type LucideIcon,
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
import { IconTile } from "@/components/ui/icon-tile";
import { type SemanticColor } from "@/components/ui/shared";
import { useWebViewMode } from "@/hooks/useWebViewMode";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useThemeContext } from "@/themes/context";
import { VersionFooter } from "@/components/version-footer";
import DefaultLayout from "@/layouts/default";

const AUTH_FEATURES: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: SemanticColor;
}[] = [
  {
    icon: ArrowLeftRight,
    title: "转发与流量策略",
    description: "端口转发、限速与流量配额集中管理",
    tone: "primary",
  },
  {
    icon: Activity,
    title: "节点与链路监控",
    description: "实时查看节点负载、隧道质量与服务可用性",
    tone: "success",
  },
  {
    icon: Users,
    title: "用户与分组权限",
    description: "按用户组与隧道组精细分配访问权限",
    tone: "secondary",
  },
];

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
          <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-primary-ink">
            节点 · 隧道 · 转发
          </p>
          <Title fw={650} lh={1.25} order={1} size={42}>
            掌握每一条连接。
          </Title>
          <Text c="dimmed" lh={1.8} mt="md" size="md">
            将转发规则、节点状态和访问权限集中到一个清晰的工作空间。
          </Text>
          <div aria-hidden className="auth-network">
            <div className="auth-network-node">
              <IconTile size="sm" tone="default">
                <Server size={16} />
              </IconTile>
              入口节点
            </div>
            <div className="auth-network-line" />
            <div data-active className="auth-network-node">
              <IconTile size="sm" tone="primary">
                <Network size={16} />
              </IconTile>
              转发隧道
            </div>
            <div className="auth-network-line" />
            <div className="auth-network-node">
              <IconTile size="sm" tone="default">
                <Target size={16} />
              </IconTile>
              目标服务
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {AUTH_FEATURES.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">
                <IconTile size="sm" tone={feature.tone}>
                  <feature.icon size={15} />
                </IconTile>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {feature.title}
                  </p>
                  <p className="mt-0.5 text-xs text-default-500">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="auth-form-panel">
          <div className="auth-form">
            <Paper withBorder p={{ base: 24, sm: 32 }} radius="lg" shadow="xs">
              <Title order={2} size={24}>
                登录控制台
              </Title>
              <Text c="dimmed" mb={28} mt={6} size="sm">
                欢迎回来，请使用你的面板账号登录。
              </Text>
              <form noValidate onSubmit={form.onSubmit(submit)}>
                <Stack gap="md">
                  <TextInput
                    required
                    autoComplete="username"
                    disabled={busy}
                    label="用户名"
                    leftSection={<UserRound size={16} />}
                    placeholder="输入用户名"
                    {...form.getInputProps("username")}
                  />
                  <PasswordInput
                    required
                    autoComplete="current-password"
                    disabled={busy}
                    label="密码"
                    leftSection={<LockKeyhole size={16} />}
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
                    mt="xs"
                    rightSection={<ArrowRight size={16} />}
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
                    label="或"
                    labelPosition="center"
                    my="lg"
                  />
                  <Button
                    fullWidth
                    disabled={loading}
                    leftSection={<KeyRound size={16} />}
                    loading={passkeyLoading}
                    variant="default"
                    onClick={() => void authenticatePasskey()}
                  >
                    使用通行证密钥登录
                  </Button>
                </>
              )}
            </Paper>
            <VersionFooter
              containerClassName="mt-6 flex items-center justify-center gap-3"
              poweredClassName="text-xs text-default-400"
              version={isWebView ? config.app_version : config.version}
              versionClassName="text-xs text-default-400"
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
