# FLUX

我维护的流量转发管理面板，基于 [FLVX](https://github.com/Sagit-chu/flvx) 继续开发，面向个人节点与网络服务的日常管理。

这个版本使用 **React + Mantine** 控制台、**Go** 管理 API 和 **GOST** 转发代理。当前主要改动是全站前端重构、响应式布局、统一主题与项目文档；后端和转发能力延续上游实现。

[使用文档](doc/index.md) · [开发指南](doc/development.md) · [安装部署](doc/install.md) · [问题反馈](https://github.com/Su-cyber-art/FLUX/issues)

## 功能

- **转发规则**：TCP / UDP、端口与隧道转发、批量启停和下发、导入导出、规则诊断。
- **节点与隧道**：本地/远程节点、多入口/中继/出口、链路质量、节点安装与版本管理。
- **配额与权限**：用户流量和数量配额、限速策略、隧道授权、用户组与隧道组。
- **运行监控**：节点资源、连接和带宽指标、服务探测、隧道历史趋势。
- **面板共享**：分享节点资源，接入其他面板的远程节点。
- **数据管理**：SQLite / PostgreSQL、业务配置备份与恢复。
- **面板自升级**：下载进度、自动备份、重启后继续查看状态、健康检查及失败恢复。
- **Mantine 界面**：统一桌面和手机导航、浅色/深色/跟随系统、强调色、页面搜索和按需加载。

## 本分支的变化

前端已迁移到 Mantine 8，替换旧的 shadcn/HeroUI 桥接层和玻璃样式，覆盖 13 个路由。大型业务页面的展示代码已拆分，登录、通知、表格和弹窗使用统一组件。

生产构建、TypeScript、lint，以及本地 API / WebSocket 连通检查已通过。完整业务页面的浏览器交互回归和真实节点联调仍需进一步验证。具体实现见 [Mantine 迁移记录](vite-frontend/docs/mantine-migration-2026-09-28.md)。

## 一键部署

面板端（Linux，需要 Bash；缺少 Docker 时会询问是否使用官方脚本安装）：

```bash
curl -fsSL https://github.com/Su-cyber-art/FLUX/releases/latest/download/panel_install.sh -o panel_install.sh && sudo bash panel_install.sh
```

选择安装，按提示安装 Docker、设置端口和数据库。Docker 安装后会验证引擎、Compose 和 `hello-world`，通过后才部署面板。访问默认前端端口 `6366`，首次使用 `admin_user` / `admin_user` 登录并修改账号信息。

节点端：

```bash
curl -fsSL https://github.com/Su-cyber-art/FLUX/releases/latest/download/install.sh -o install.sh && sh install.sh
```

支持 Linux amd64 / arm64。脚本与镜像来自本仓库的 [最新 Release](https://github.com/Su-cyber-art/FLUX/releases/latest)；镜像仓库不可用时，面板脚本会自动下载并校验 Release 镜像包，无需登录镜像仓库。

指定版本、更新、Alpine 节点和源码部署见 [安装部署](doc/install.md)。维护者发版方式见 [发布指南](doc/releases.md)。

## 开始使用

```bash
git clone https://github.com/Su-cyber-art/FLUX.git
cd FLUX
```

- **本地开发**：准备 Go 1.25+、Node.js 20.19+ 和 pnpm 10.28.1，按 [开发指南](doc/development.md) 启动 API 与前端。
- **部署发布版本**：使用上面的一键脚本，或下载指定 Release 的镜像包。
- **从源码部署**：合并 `compose.source.yml` 构建当前代码，详见安装文档。
- **发布产物**：以 [本仓库 Releases](https://github.com/Su-cyber-art/FLUX/releases) 实际提供的资源为准。仓库继承的标签不代表这个个人版本已发布对应镜像。

首次初始化的管理员账号和密码均为 `admin_user`，首次登录会引导修改账号信息。

## 项目结构

| 目录 | 内容 |
| --- | --- |
| `vite-frontend/` | React、TypeScript、Mantine、Tailwind CSS 与 rolldown-vite |
| `go-backend/` | Go 管理 API、GORM、鉴权、配额、监控和共享 |
| `go-gost/` | GOST 代理入口与面板接入 |
| `go-gost/x/` | 独立 Go 模块，包含协议实现和遥测通信 |
| `doc/` | 当前使用、开发与部署文档 |
| `docs/`、`plans/` | 历史设计和变更记录，包含上游开发过程 |
| `skills/flvx-api/` | API 操作技能及接口参考 |

## 开发检查

```bash
(cd vite-frontend && pnpm install --frozen-lockfile)
(cd vite-frontend && pnpm run build)
(cd vite-frontend && pnpm exec eslint src --no-fix --max-warnings=0)
(cd go-backend && go test ./...)
```

`pnpm run lint` 会自动修改文件。PostgreSQL 契约测试需要设置 `FLVX_POSTGRES_TEST_DSN`。外置盘数据与构建缓存的配置见 [开发指南](doc/development.md)。

## 维护与来源

本仓库由 [Su-cyber-art](https://github.com/Su-cyber-art) 个人维护。问题和建议请提交到 [本仓库 Issues](https://github.com/Su-cyber-art/FLUX/issues)。

上游与基础项目：

- [Sagit-chu/flvx](https://github.com/Sagit-chu/flvx)：本仓库直接 fork 来源，提供 Go 管理后端和既有业务能力。
- [bqlpfy/flux-panel](https://github.com/bqlpfy/flux-panel)：更早的原始项目。
- [go-gost/gost](https://github.com/go-gost/gost)、[go-gost/x](https://github.com/go-gost/x)：转发代理基础。

保留上游版权与许可证文件：[LICENSE](LICENSE)、[LICENSE-APACHE](LICENSE-APACHE)、[NOTICE](NOTICE) 和 [前端模板许可证](vite-frontend/LICENSE)。本分支的修改记录与原有作者贡献分别保留在 Git 历史中。
