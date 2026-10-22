# Mantine 外观系统

`context.tsx` 是唯一主题入口。MantineProvider 生成 CSS 变量，Tailwind 的 `@theme inline` 映射继续支持业务页面的语义类。

- 模式：light / dark / system，保存在 `flvx:theme`。
- 强调色：blue / teal / violet，保存在 `flvx:accent`。
- 跟随系统时监听系统模式变化，也同步其他浏览器标签页的偏好变化。
- `data-mantine-color-scheme` 同时控制 Mantine 和 Tailwind dark 工具类。
- 应用容器与组件材质为实色，页面无需覆写内联模糊或阴影。

新增控件优先使用 Mantine 的主题/默认属性与 Styles API。不要恢复旧的独立 CSS 注入器或整页替换注册器。

## 语义色调

色调：`default`、`primary`（跟随强调色）、`secondary`（violet）、`success`（teal）、`warning`（orange）、`danger`（red）、`info`（cyan）。映射关系集中在 `components/ui/shared.tsx` 的 `uiColor`。

- 组件优先：状态/标签用 `Chip color="…"`（可加 `dot`），图标底块用 `IconTile tone="…"`，按钮用 `Button color="…" variant="flat"`。
- 自定义元素用 Tailwind 色调令牌：`bg-*-soft`、`hover:bg-*-soft-hover`、`text-*-ink`、`border-*-line`，实色用 `bg-*` / `text-*`。
- 令牌由 `globals.css` 的 `--*-ink` 推导并自动随深浅色切换，不需要再写 `dark:` 变体。`default-*` 中性色阶本身也会翻转，同样不需要 `dark:text-default-*`。
- 不要使用 Tailwind 原始色板（`text-gray-500`、`bg-blue-100` 等）或固定色阶语义类（`bg-success-50`、`text-warning-700` 等）。
- 图标统一使用 `lucide-react`；内联 SVG 只保留品牌标识（`components/icons.tsx` 的 Logo、`distro-icon.tsx`）。
- `context.tsx` 的 `cssVariablesResolver` 让 Mantine light 变体文字使用与 `--*-ink` 相同的色阶，保证浅色背景上的可读性。
