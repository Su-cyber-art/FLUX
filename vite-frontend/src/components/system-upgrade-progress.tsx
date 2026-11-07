import type { SystemUpgradeJob } from "@/api/types";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Progress,
  ScrollArea,
  Stack,
  Text,
  Timeline,
} from "@mantine/core";
import { AlertCircle, Check, LoaderCircle } from "lucide-react";

import { RefreshApplicationButton } from "@/components/refresh-application-button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { refreshApplication } from "@/utils/application-update";
import { BUILD_VERSION } from "@/utils/version-sync";

const AUTO_REFRESH_SECONDS = 5;

const labels = [
  "检查发布文件",
  "下载与校验镜像",
  "备份配置和数据",
  "重启面板服务",
  "确认服务恢复",
];

function phaseIndex(stage: string) {
  if (stage.startsWith("downloading") || stage.startsWith("loading")) return 1;
  if (stage === "backing_up") return 2;
  if (stage === "restarting") return 3;
  if (stage === "checking" || stage === "rolling_back") return 4;

  return 0;
}

function bytes(value: number) {
  return value >= 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(value / 1024)} KB`;
}

export function SystemUpgradeProgress({
  job,
  reconnecting,
  opened,
  onClose,
  onRecover,
}: {
  job: SystemUpgradeJob | null;
  reconnecting: boolean;
  opened: boolean;
  onClose: () => void;
  onRecover?: () => Promise<void>;
}) {
  // This tab still runs the previous release's code after a successful
  // upgrade; load the new one automatically unless the user cancels.
  const needsReload = Boolean(
    job?.status === "succeeded" &&
      BUILD_VERSION &&
      BUILD_VERSION !== job.version,
  );
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    setCountdown(needsReload && opened ? AUTO_REFRESH_SECONDS : null);
  }, [needsReload, opened]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      refreshApplication().catch(() => setCountdown(null));

      return;
    }
    const timer = setTimeout(
      () => setCountdown((value) => (value === null ? null : value - 1)),
      1000,
    );

    return () => clearTimeout(timer);
  }, [countdown]);

  if (!job) return null;
  const active = job.status === "running";
  const success = job.status === "succeeded";
  const restored = job.status === "rolled_back";
  const downloading = job.stage.startsWith("downloading") && job.total > 0;
  const percent = downloading
    ? Math.min(100, Math.floor((job.downloaded / job.total) * 100))
    : null;
  const color = success
    ? "teal"
    : restored
      ? "orange"
      : active
        ? "blue"
        : "red";

  return (
    <Modal opened={opened} size="lg" onClose={onClose}>
      <ModalContent>
        <ModalHeader>面板升级进度</ModalHeader>
        <ModalBody>
          <Stack gap="lg">
            <Group justify="space-between">
              <Text fw={600}>
                {job.fromVersion} → {job.version}
              </Text>
              <Badge color={color}>
                {active
                  ? "升级进行中"
                  : success
                    ? "升级完成"
                    : restored
                      ? "已恢复原版本"
                      : "升级未完成"}
              </Badge>
            </Group>
            <Stack gap="xs">
              <Text fw={500} role="status">
                {reconnecting ? "服务正在重启，正在重新连接…" : job.message}
              </Text>
              {(success || percent !== null) && (
                <Progress
                  aria-label="面板升级进度"
                  color={color}
                  value={success ? 100 : (percent ?? 0)}
                />
              )}
              {active && percent === null && (
                <Group gap="xs">
                  <Loader size="xs" />
                  <Text c="dimmed" size="sm">
                    第 {phaseIndex(job.stage) + 1} / {labels.length} 阶段
                  </Text>
                </Group>
              )}
              {percent !== null && active && (
                <Text c="dimmed" size="sm">
                  {percent}% · {bytes(job.downloaded)} / {bytes(job.total)}
                </Text>
              )}
              {active && (
                <Text c="dimmed" size="xs">
                  关闭此窗口不会中断升级。刷新页面后可继续查看进度。
                </Text>
              )}
              {countdown !== null && (
                <Group gap="xs" justify="space-between">
                  <Text c="dimmed" size="sm">
                    新版本已就绪，{Math.max(countdown, 0)} 秒后自动刷新页面
                  </Text>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    onClick={() => setCountdown(null)}
                  >
                    取消自动刷新
                  </Button>
                </Group>
              )}
            </Stack>
            {!active && job.maintenance && (
              <Alert
                color="yellow"
                icon={<AlertCircle size={18} />}
                title="面板仍处于维护状态"
              >
                <Stack gap="xs">
                  <Text size="sm">
                    升级没有正常结束，除升级相关功能外的操作暂时不可用。确认前后端服务正常后即可解除维护；如果检查未通过，请使用下方备份手动恢复。
                  </Text>
                  {onRecover && (
                    <Group>
                      <Button
                        loading={recovering}
                        size="xs"
                        onClick={async () => {
                          setRecovering(true);
                          try {
                            await onRecover();
                          } finally {
                            setRecovering(false);
                          }
                        }}
                      >
                        检查服务并解除维护
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Alert>
            )}
            {job.error && (
              <Alert
                color={restored ? "orange" : "red"}
                icon={<AlertCircle size={18} />}
                title={restored ? "升级失败，原版本已恢复" : "升级失败"}
              >
                {job.error}
              </Alert>
            )}
            <Timeline
              active={success ? labels.length : phaseIndex(job.stage)}
              bulletSize={22}
              color={color}
              lineWidth={2}
            >
              {labels.map((label, index) => (
                <Timeline.Item
                  key={label}
                  bullet={
                    success || index < phaseIndex(job.stage) ? (
                      <Check size={12} />
                    ) : active && index === phaseIndex(job.stage) ? (
                      <LoaderCircle size={12} />
                    ) : undefined
                  }
                  title={label}
                />
              ))}
            </Timeline>
            <Stack gap="xs">
              <Text fw={600} size="sm">
                升级记录
              </Text>
              <ScrollArea.Autosize mah={200}>
                <Stack gap={6}>
                  {job.events.map((event, index) => (
                    <Text key={`${event.time}-${index}`} c="dimmed" size="xs">
                      {new Date(event.time).toLocaleTimeString()} ·{" "}
                      {event.message}
                    </Text>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
              {job.backupPath && (
                <Text c="dimmed" size="xs">
                  备份保存在部署目录：{job.backupPath}
                </Text>
              )}
            </Stack>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="default" onClick={onClose}>
            {active ? "后台继续" : "关闭"}
          </Button>
          {(success || restored) && <RefreshApplicationButton />}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
