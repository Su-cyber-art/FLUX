# Mantine 外观系统 · Console

`context.tsx` 是唯一主题入口。MantineProvider 生成 CSS 变量，Tailwind 的 `@theme inline` 映射继续支持业务页面的语义类。

- 模式：light / dark / system，保存在 `flvx:theme`。
- 强调色：blue / indigo / teal / violet / grape，保存在 `flvx:accent`。
- `data-mantine-color-scheme` 同时控制 Mantine 和 Tailwind dark 工具类。
- 切换深浅色时，支持 View Transitions 的浏览器会从点击位置圆形展开新配色。

## 设计语言：控制台（Console）

目标是“精密、克制、信息密度高”的运维控制台，参考 Linear / Vercel 一类产品的气质。

### 版式

- **平铺，不嵌套。** 侧栏贴边（`--sidebar` 底色 + 右侧发丝线），右侧是 52px 的粘性顶栏（面包屑、搜索、主题、账号），下面是平铺画布 `--background`。页面内容直接放在画布上，**不要再出现“托盘里套卡片、卡片里再套卡片”**。
- 页面标题由 App Shell 统一渲染：22px 标题 + 13px 说明，不再有胶囊标签和渐变文字。
- 卡片 `Card`（`.app-card`）：白底（深色 `#111114`）、1px `--border`、10px 圆角、无阴影。分组用 **小节标题 `.section-label`**（13px 粗体 + 12px 弱化计数）+ 内容，而不是外面再包一张卡片。
- 内容最大宽度 1400px，桌面内边距 28px 32px。

### 字号与密度

- 正文 14px，控件与表格 13px，辅助信息 12px，小节标题 13px/600，页面标题 22px/600。
- 控件高度 32px（`size="sm"`），工具栏一行排开：左侧搜索（约 16rem）+ 筛选，右侧视图切换、次要操作、主按钮。
- 列表行高约 44–48px；表头 12px、`--default-500`、`--content2` 底色。
- 数字一律等宽（body 已开启 `tabular-nums`）；地址、端口、ID 用 `.mono-value`（等宽 12.5px），**不要再用灰色底块包住每个地址**，复制按钮在悬停时出现即可。

### 颜色

- 中性色为主，强调色只用于主按钮、链接、焦点环、选中态。
- 状态用 `.status-dot`（`data-tone="success|warning|danger|primary"`，缺省为灰）：小圆点 + 文字。实心/浅色胶囊 Badge 只在确实需要“标签”时使用（例如倍率 `1.5x`、角色）。
- 进度条是平滑细条（Mantine `Progress`，默认 6px），不再使用分段方块。
- 不要使用 Tailwind 原始色板（`text-gray-500`、`bg-blue-100`），使用语义令牌：`bg-content1/2/3`、`border-border`、`text-default-500`、`bg-*-soft`、`text-*-ink`、`border-*-line`。

### 令牌（`styles/globals.css`）

| 令牌 | 用途 |
|---|---|
| `--background` | 画布 |
| `--sidebar` | 侧栏 |
| `--content1` | 卡片、弹窗、表格主体 |
| `--content2` | 表头、凹陷区、悬停行 |
| `--content3` | 更深一层的填充（深色模式分段控件指示器等） |
| `--border` / `--border-strong` | 发丝线 / 悬停与强调描边 |
| `--elevation-2/3` | 只给浮层（菜单、弹窗、浮动操作栏）使用 |

### 样式文件

`styles/application.css` 只负责按区域引入：

- `shell.css`：App Shell（侧栏、顶栏、画布、快速搜索）
- `components.css`：共享组件与 Mantine 打磨（卡片、表格、弹窗、工具栏、批量栏、徽标、进度条…）
- `diagnosis.css`：诊断弹窗
- `pages/*.css`：每个页面自己的类，只由对应页面使用
- `responsive.css`：跨区域的响应式与触屏适配

新增控件优先使用 Mantine 的主题默认属性与 Styles API；页面私有样式写进对应的 `pages/*.css`。

## 语义色调

色调：`default`、`primary`（跟随强调色）、`secondary`（violet）、`success`（teal）、`warning`（orange）、`danger`（red）、`info`（cyan）。映射关系集中在 `components/ui/shared.ts` 的 `uiColor`。

- 图标底块用 `IconTile tone="…"`，但在高密度列表里优先直接用图标（`text-default-500`），不要每行都放图标底块。
- 图标统一使用 `lucide-react`。
