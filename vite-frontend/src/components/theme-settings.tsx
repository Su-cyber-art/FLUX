import {
  Group,
  SegmentedControl,
  Text,
  UnstyledButton,
  ColorSwatch,
} from "@mantine/core";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { ACCENTS, useThemeContext, type ThemeMode } from "@/themes/context";

/** Appearance rows for the settings page; preferences live in this browser. */
export function ThemeSettings() {
  const { mode, accent, setMode, setAccent } = useThemeContext();

  return (
    <>
      <div className="settings-row">
        <div>
          <p className="settings-row-label">显示模式</p>
          <p className="settings-row-desc">
            浅色、深色或跟随系统；偏好保存在当前浏览器，所有页面同步应用。
          </p>
        </div>
        <div>
          <SegmentedControl
            data={[
              {
                value: "light",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <Sun size={14} />
                    浅色
                  </Group>
                ),
              },
              {
                value: "dark",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <Moon size={14} />
                    深色
                  </Group>
                ),
              },
              {
                value: "system",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <Monitor size={14} />
                    系统
                  </Group>
                ),
              },
            ]}
            size="sm"
            value={mode}
            onChange={(value) => setMode(value as ThemeMode)}
          />
        </div>
      </div>
      <div className="settings-row">
        <div>
          <p className="settings-row-label">强调色</p>
          <p className="settings-row-desc">
            按钮、链接、进度条与图表使用的主色。
          </p>
        </div>
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
                size={22}
              >
                {accent === item.value && <Check color="white" size={13} />}
              </ColorSwatch>
              <Text size="sm">{item.label}</Text>
            </UnstyledButton>
          ))}
        </Group>
      </div>
    </>
  );
}
