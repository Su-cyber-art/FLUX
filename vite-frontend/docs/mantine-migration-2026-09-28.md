# Mantine 前端重构记录

本次改造将 FLVX 的前端组件体系迁移到 Mantine 8.3.18，保留 React 18、Go API 和既有业务契约。组件规范、开发说明与相关项目文档同步更新。

## 实现范围

- 所有 13 个路由接入新的页面框架；登录、账号安全设置单独使用统一认证布局。
- 桌面侧栏和手机端菜单使用同一个 Mantine AppShell，角色导航集中在 navigation.ts；切换页面时导航保持挂载。
- 提供统一页头、账号菜单、页面搜索、侧栏折叠、深浅色切换；支持原有 H5/WebView 判定和移动设备安全区域。
- Button、Card、Input、Textarea、Select/MultiSelect、Checkbox、Switch、Radio、DateInput、Table、Modal、Menu、Tabs、Accordion、Alert、Badge、Progress、Loader 全部以 Mantine 实现。
- 原来的 shadcn-bridge、Radix 基础控件、独立主题注册器、玻璃背景/模糊/内阴影和旧布局已移除。
- 登录与首次密码修改采用 Mantine Form，验证码和强制改密流程保留。通知统一使用 Mantine Notifications。
- 主题以 MantineProvider 为唯一入口；保留 flvx:theme 偏好，新增强调色偏好；Tailwind 的 dark variant 与 Mantine 使用同一个模式属性。
- 大型规则、节点、隧道、用户页面的展示组件、类型和展示辅助逻辑拆到相邻的 presentation.tsx 模块。
- 规则名称和用户搜索统一到共享搜索栏；复杂筛选、拖拽、列表/卡片及批量选择保留。
- 监控顶部展示真实聚合指标，移除容易被误解为趋势的固定装饰柱形；仪表盘统计卡片使用共享 StatCard。
- 保留可选壁纸、商业品牌配置、公告、配额/流量单位、节点安装与升级、备份恢复等功能。
- 路由懒加载、生产压缩和 tree-shaking 已开启；增加页面错误边界与显式重新加载入口。

## 关键文件

| 文件 | 用途 |
| --- | --- |
| src/layouts/app-shell.tsx | 持久化应用框架、导航与权限可见性 |
| src/config/navigation.ts | 页面标题、说明、分组和角色 |
| src/components/ui/ | 应用控件，统一 Mantine 外观和业务事件契约 |
| src/components/stat-card.tsx | 仪表盘与监控共用指标卡片 |
| src/components/page-error-boundary.tsx | 路由加载/渲染失败反馈 |
| src/themes/context.tsx | 模式、强调色和 MantineProvider |
| src/styles/globals.css | 样式层顺序和语义变量 |
| src/styles/application.css | 框架、表格、弹窗与响应布局 |
| src/styles/tailwind-theme.pcss | 业务页面语义工具类映射 |
| src/lib/notifications.tsx | 统一消息反馈 |
| src/pages/*/presentation.tsx | 大型页面的展示组件与定义 |

## 兼容性处理

共享应用组件保留必要的业务调用语义，例如集合选择使用 Set、表格支持 items/render、诊断弹窗支持渲染回调。实现直接使用 Mantine，不再依赖旧的 UI 框架。

- 可选下拉项可清空，支持将限速重置为无限制；多选中的禁用项在清空/移除时保留。
- 授权列表内下拉操作保留点击事件隔离，避免触发所在行的选择动作。
- 表单错误与 disabled/loading 状态通过 Mantine 控件呈现。
- 对话框保留滚动位置处理，头部、内容和操作区分开；手机上的大型表单全屏显示，短确认框使用紧凑布局。
- 原始 JWT Authorization 头、API envelope、流式诊断、WebSocket 重连与轮询逻辑保留。
- 监控授权在路由切换和窗口重新聚焦时刷新，避免持久化导航导致权限显示长期过期。
- pnpm 保持仓库声明的 10.28.1。Mantine 8.3.18 兼容现有 React 18；没有同时升级 React 的主版本。

## 验证与边界

生产构建（含 TypeScript）、冻结锁文件安装和 ESLint 静态检查作为交付检查。本地独立 SQLite API 经前端开发代理验证登录、用户套餐、节点、规则、隧道、限速列表；原始 JWT 认证与 WebSocket 代理均验证成功。

浏览器已确认新登录页能够渲染。完整业务页面的视觉/交互回归、真实代理节点、跨面板联邦、SSH/nftables 和生产升级流程未在本轮环境中验证。代码中没有新增前端测试框架或测试文件。

构建产物、依赖、Go/pnpm 缓存、临时目录、预览数据库与日志位于用户外置盘。本机命令通过被 Git 忽略的 .flvx-build.local 载入外置存储配置；源码目录中的 node_modules/dist 为符号链接。
