import { useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
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
import { IconTile } from "@/components/ui/icon-tile";
import { toast } from "@/lib/notifications";
import { createPasskey } from "@/utils/passkey";

/** Settings row for binding and removing passkeys; hidden when unsupported. */
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
    <div className="settings-row">
      <div>
        <p className="settings-row-label">通行证密钥</p>
        <p className="settings-row-desc">
          绑定后可直接选择密钥并使用设备解锁登录，无需输入用户名和验证码。绑定和删除均需验证当前密码。
        </p>
      </div>
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <PasswordInput
            autoComplete="current-password"
            disabled={busy !== null}
            label="当前密码"
            placeholder="输入当前登录密码"
            size="sm"
            value={password}
            visibilityToggleButtonProps={{ "aria-label": "显示或隐藏当前密码" }}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <TextInput
            disabled={busy !== null}
            label="密钥名称（可选）"
            maxLength={100}
            placeholder="例如：我的手机"
            size="sm"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </SimpleGrid>
        <Group>
          <Button
            disabled={busy !== null && busy !== "register"}
            leftSection={<Plus size={16} />}
            loading={busy === "register"}
            size="sm"
            variant="light"
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
          <Text c="dimmed" size="xs">
            尚未绑定通行证密钥。
          </Text>
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-divider">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-divider px-3 py-2.5 [&+&]:border-t"
              >
                <IconTile size="sm" tone="primary">
                  <KeyRound size={15} />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.name}
                  </p>
                  <p className="truncate text-xs text-default-500">
                    创建于 {new Date(item.createdAt).toLocaleDateString()}
                    {item.lastUsedAt
                      ? ` · 最近使用 ${new Date(item.lastUsedAt).toLocaleDateString()}`
                      : " · 尚未使用"}
                  </p>
                </div>
                <Tooltip label="删除密钥（需当前密码）">
                  <ActionIcon
                    aria-label={`删除密钥 ${item.name}`}
                    color="red"
                    disabled={busy !== null && busy !== item.id}
                    loading={busy === item.id}
                    variant="subtle"
                    onClick={() => void remove(item.id)}
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </Stack>
    </div>
  );
}
