import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { KeyRound, Plus, Trash2 } from "lucide-react";

import {
  beginPasskeyRegistration,
  deletePasskey,
  finishPasskeyRegistration,
  getPasskeyStatus,
  listPasskeys,
  type PasskeyItem,
} from "@/api";
import { toast } from "@/lib/notifications";
import { createPasskey } from "@/utils/passkey";

export function PasskeyManager() {
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<PasskeyItem[]>([]);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await listPasskeys();

      if (result.code !== 0) {
        setLoadError(result.msg || "无法获取通行证密钥，请重试");

        return;
      }
      setItems(result.data || []);
    } catch {
      setLoadError("无法获取通行证密钥，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!window.isSecureContext || !window.PublicKeyCredential) return;
    let active = true;

    getPasskeyStatus()
      .then((res) => {
        if (active && res.code === 0 && res.data.enabled) {
          setEnabled(true);
          void refresh();
        }
      })
      .catch(() => {
        if (active) setEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;

  const register = async () => {
    if (!password) {
      toast.error("请输入当前密码");

      return;
    }
    setBusy("register");
    try {
      const begin = await beginPasskeyRegistration(password);

      if (begin.code !== 0) {
        toast.error(begin.msg || "无法绑定通行证密钥");

        return;
      }
      const credential = await createPasskey(begin.data.options);
      const finish = await finishPasskeyRegistration(
        begin.data.sessionId,
        credential,
        name.trim(),
      );

      if (finish.code !== 0) {
        toast.error(finish.msg || "绑定失败");

        return;
      }
      toast.success("通行证密钥已绑定");
      setPassword("");
      setName("");
      await refresh();
    } catch {
      toast.error("绑定已取消或失败，请重试");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!password) {
      toast.error("请输入当前密码以删除密钥");

      return;
    }
    setBusy(id);
    try {
      const result = await deletePasskey(id, password);

      if (result.code !== 0) {
        toast.error(result.msg || "删除失败");

        return;
      }
      toast.success("通行证密钥已删除");
      setPassword("");
      await refresh();
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="md">
        <div>
          <Group gap="xs" mb={6}>
            <KeyRound aria-hidden size={18} />
            <Title order={3} size="h5">
              通行证密钥
            </Title>
          </Group>
          <Text c="dimmed" size="sm">
            绑定后可直接选择密钥并使用设备解锁登录，无需输入用户名和验证码。
            绑定和删除均需验证当前密码。
          </Text>
        </div>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <PasswordInput
            autoComplete="current-password"
            disabled={busy !== null}
            label="当前密码"
            placeholder="输入当前登录密码"
            value={password}
            visibilityToggleButtonProps={{ "aria-label": "显示或隐藏当前密码" }}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <TextInput
            disabled={busy !== null}
            label="密钥名称（可选）"
            maxLength={100}
            placeholder="例如：我的手机"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </SimpleGrid>
        <Group>
          <Button
            disabled={busy !== null && busy !== "register"}
            leftSection={<Plus size={16} />}
            loading={busy === "register"}
            onClick={() => void register()}
          >
            绑定通行证密钥
          </Button>
        </Group>
        {loadError ? (
          <Alert color="red" title="密钥列表加载失败">
            <Text size="sm">{loadError}</Text>
            <Button
              disabled={busy !== null}
              mt="sm"
              size="xs"
              variant="light"
              onClick={() => void refresh()}
            >
              重试
            </Button>
          </Alert>
        ) : loading ? (
          <Group gap="xs" role="status">
            <Loader size="sm" />
            <Text c="dimmed" size="sm">
              正在加载密钥…
            </Text>
          </Group>
        ) : items.length === 0 ? (
          <Text c="dimmed" size="sm">
            尚未绑定通行证密钥。
          </Text>
        ) : (
          <Stack gap="xs">
            {items.map((item) => (
              <Paper key={item.id} withBorder p="sm" radius="md">
                <Group gap="sm" justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    <Text fw={500} size="sm">
                      {item.name}
                    </Text>
                    <Text c="dimmed" size="xs">
                      创建于 {new Date(item.createdAt).toLocaleDateString()}
                      {item.lastUsedAt
                        ? ` · 最近使用 ${new Date(item.lastUsedAt).toLocaleDateString()}`
                        : " · 尚未使用"}
                    </Text>
                  </div>
                  <Button
                    aria-label={`删除密钥 ${item.name}`}
                    color="red"
                    disabled={busy !== null && busy !== item.id}
                    leftSection={<Trash2 size={14} />}
                    loading={busy === item.id}
                    size="sm"
                    style={{ flexShrink: 0 }}
                    variant="light"
                    onClick={() => void remove(item.id)}
                  >
                    删除
                  </Button>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
