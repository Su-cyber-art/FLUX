import {
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  UnstyledButton,
  ColorSwatch,
} from "@mantine/core";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { ACCENTS, useThemeContext, type ThemeMode } from "@/themes/context";
export function ThemeSettings() {
  const { mode, accent, setMode, setAccent } = useThemeContext();

  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="lg">
        <div>
          <Text fw={600} size="lg">
            界面外观
          </Text>
          <Text c="dimmed" mt={4} size="sm">
            外观偏好保存在当前浏览器，所有页面同步应用。
          </Text>
        </div>
        <Group align="flex-start" justify="space-between">
          <div>
            <Text fw={500} size="sm">
              显示模式
            </Text>
            <Text c="dimmed" mt={4} size="xs">
              选择浅色、深色或跟随系统
            </Text>
          </div>
          <SegmentedControl
            data={[
              {
                value: "light",
                label: (
                  <Group gap={6}>
                    <Sun size={14} />
                    浅色
                  </Group>
                ),
              },
              {
                value: "dark",
                label: (
                  <Group gap={6}>
                    <Moon size={14} />
                    深色
                  </Group>
                ),
              },
              {
                value: "system",
                label: (
                  <Group gap={6}>
                    <Monitor size={14} />
                    系统
                  </Group>
                ),
              },
            ]}
            value={mode}
            onChange={(value) => setMode(value as ThemeMode)}
          />
        </Group>
        <Group justify="space-between">
          <Text fw={500} size="sm">
            强调色
          </Text>
          <Group gap="xs">
            {ACCENTS.map((item) => (
              <UnstyledButton
                key={item.value}
                aria-label={item.label}
                aria-pressed={accent === item.value}
                className="accent-choice"
                onClick={() => setAccent(item.value)}
              >
                <ColorSwatch
                  color={`var(--mantine-color-${item.value}-6)`}
                  size={26}
                >
                  {accent === item.value && <Check color="white" size={15} />}
                </ColorSwatch>
                <Text size="sm">{item.label}</Text>
              </UnstyledButton>
            ))}
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
}
