import {
  Group,
  SegmentedControl,
  Tooltip,
  UnstyledButton,
  ColorSwatch,
} from "@mantine/core";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { ACCENTS, useThemeContext, type ThemeMode } from "@/themes/context";

/** Appearance rows for the settings page; preferences live in this browser. */
export function ThemeSettings() {
  const { mode, accent, setMode, setAccent } = useThemeContext();
  const activeAccent = ACCENTS.find((item) => item.value === accent);

  return (
    <>
      <div className="settings-row">
        <div className="settings-row-text">
          <p className="settings-row-label">显示模式</p>
          <p className="settings-row-desc">
            浅色、深色或跟随系统；偏好保存在当前浏览器，所有页面同步应用。
          </p>
        </div>
        <div className="settings-row-control">
          <SegmentedControl
            aria-label="显示模式"
            data={[
              {
                value: "light",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <Sun size={13} />
                    浅色
                  </Group>
                ),
              },
              {
                value: "dark",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <Moon size={13} />
                    深色
                  </Group>
                ),
              },
              {
                value: "system",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <Monitor size={13} />
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
        <div className="settings-row-text">
          <p className="settings-row-label">强调色</p>
          <p className="settings-row-desc">
            按钮、链接、进度条与图表使用的主色
            {activeAccent ? `，当前为${activeAccent.label}` : ""}。
          </p>
        </div>
        <div className="settings-row-control">
          <Group gap={6} role="group">
            {ACCENTS.map((item) => (
              <Tooltip key={item.value} withArrow label={item.label}>
                <UnstyledButton
                  aria-label={item.label}
                  aria-pressed={accent === item.value}
                  className="accent-choice"
                  style={{
                    ["--accent-swatch" as string]: `var(--mantine-color-${item.value}-6)`,
                  }}
                  onClick={() => setAccent(item.value)}
                >
                  <ColorSwatch
                    color={`var(--mantine-color-${item.value}-6)`}
                    size={20}
                    withShadow={false}
                  >
                    {accent === item.value && <Check color="white" size={12} />}
                  </ColorSwatch>
                </UnstyledButton>
              </Tooltip>
            ))}
          </Group>
        </div>
      </div>
    </>
  );
}
