# FLUX 前端

[FLUX](https://github.com/Su-cyber-art/FLUX) 个人分支的前端，基于 React 18、TypeScript、Mantine 8 和 Tailwind CSS 4 的流量转发控制台。使用 rolldown-vite 构建，Go 管理 API 提供业务数据。

## 本地开发

使用 Node.js 20.19+ 和 pnpm 10.28.1：

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

前端默认运行在 `http://localhost:3000`，开发代理将 `/api` 与 WebSocket `/system-info` 转发到 `http://127.0.0.1:6365`。使用 `VITE_API_PROXY` 修改本地代理目标；已有的 `VITE_API_BASE` 独立 API 地址配置继续支持。

```bash
pnpm run build
pnpm exec eslint src --no-fix
```

`pnpm run lint` 会自动修复代码。当前未配置前端单元测试框架。

## 界面结构

- `layouts/app-shell.tsx`：桌面侧栏、手机菜单、统一页头、账号菜单与快捷导航。
- `config/navigation.ts`：路由标题、分组、描述与角色可见性。
- `components/ui/`：基于 Mantine 的应用组件，保留业务层对集合选择、表单错误和批量表格的稳定调用契约。
- `themes/context.tsx`：浅色、深色、跟随系统以及强调色；兼容原有 `flvx:theme` 偏好。
- `styles/`：Mantine 样式层、Tailwind 语义色映射和应用布局。
- `pages/`：路由按需加载；规则、节点、隧道、用户的展示组件和类型与页面控制逻辑分开。
- `api/`：保留 JWT、响应 envelope、WebSocket 和流式诊断契约。

Mantine 使用 8.3.18，以兼容当前 React 18。旧的 shadcn/HeroUI 桥接层、Radix 组件依赖和玻璃主题包已移除。

## 发布

生产构建开启压缩和 tree-shaking，路由单独分包。Docker 使用 Nginx 提供静态资源和 API/WebSocket 代理，PWA 更新仍通过用户确认刷新生效。
