# 开发指南

## 环境

- Go 1.26.10 或更新版本（使用 Go 1.27 时须为 1.27.3+）；`go-backend`、`go-gost`、`go-gost/x` 是三个独立模块。本地 Go 较旧时，默认的 `GOTOOLCHAIN=auto` 会按 `go.mod` 自动下载所需版本。
- Node.js 22.23.4（见 `.node-version`），或已修复的 24.22.1+ / 26.12.1+；pnpm 10.28.1。前端开启了 `engine-strict`，未修复的 Node.js 会拒绝安装和构建。
- 默认数据库为 SQLite；本地开发不依赖 Docker。

```bash
git clone https://github.com/Su-cyber-art/FLUX.git
cd FLUX
```

## 运行后端

在项目根目录打开终端。`FLUX_DATA_DIR` 可指向外置盘或其他持久化目录：

```bash
export FLUX_DATA_DIR="${FLUX_DATA_DIR:-$HOME/.local/share/flux}"
mkdir -p "$FLUX_DATA_DIR"
export DB_TYPE=sqlite
export DB_PATH="$FLUX_DATA_DIR/gost.db"
export JWT_SECRET="$(openssl rand -hex 32)"
export SERVER_ADDR=127.0.0.1:6365
cd go-backend
go run ./cmd/paneld
```

后端默认地址为 `:6365`。在不同启动会话中继续使用相同的 `JWT_SECRET` 可保留已有登录令牌的有效性；数据库首次初始化会创建 `admin_user` 账号。

## 运行前端

另开终端，从项目根目录执行：

```bash
cd vite-frontend
pnpm install --frozen-lockfile
pnpm run dev
```

访问 `http://localhost:3000`。开发服务器将 `/api` 和 WebSocket `/system-info` 代理到 `http://127.0.0.1:6365`。

- `VITE_API_PROXY`：覆盖开发代理的后端目标。
- `VITE_API_BASE`：使用独立 API 地址时配置，值为 API origin，不包含 `/api/v1`。
- `VITE_GITHUB_REPO`：覆盖前端的仓库链接和版本查询来源。
- `VITE_APP_VERSION`：构建时显示的版本；未设置时显示 `dev`。

## 检查与构建

```bash
(cd vite-frontend && pnpm run build)
(cd vite-frontend && pnpm exec eslint src --no-fix --max-warnings=0)
(cd go-backend && go test ./...)
(cd go-gost && go test ./...)
(cd go-gost/x && go test ./...)
```

前端没有单独的单元测试框架。`pnpm run lint` 使用 `--fix`，会修改源码。后端 PostgreSQL 契约测试需要提供 `FLVX_POSTGRES_TEST_DSN`。

常规 CI 会执行后端测试、Agent 及控制协议回归和前端只读 lint，发布流程继续执行镜像、自升级及恢复检查。

## 操作确认与流量上报

- 用户状态查询发生数据库错误时，API 返回 HTTP / 业务码 `503`，拒绝本次访问并保留现有 JWT；数据库恢复后同一凭证可继续使用。账号禁用、密码修改和无效 JWT 仍返回 `401`。
- 隧道配置已保存但节点未能同步时，响应 `data.runtimeSync.status` 为 `pending`，并返回关联转发的失败明细。前端显示警告；此状态不代表已应用，节点恢复后需重新下发。
- 普通用户的转发列表在 Repository 查询阶段按用户过滤，返回字段与管理员完整列表保持兼容。

新版 Agent 的 `/flow/upload` 保持原有 AES 加密数组格式，增加 `X-Flux-Flow-Producer` 和 `X-Flux-Flow-Sequence` 请求头。每个进程只保留一个未确认批次，每批最多 500 项；网络失败、响应丢失或服务端写入失败时，重试原批次及序号，新流量留到下一批。

新版后端在同一事务内完成批次收据、转发与用户流量、用户配额和共享流量更新。只有事务成功才返回 `ok` 和 `X-Flux-Flow-Ack: <producer>:<sequence>`；重复批次直接确认，不重复计量。所有权查询或记账失败返回 `503`，同序号更换内容或跳过未确认序号返回 `409`。指标写入及节点命令在记账提交后执行。

旧 Agent 未携带批次头时继续走原兼容路径；旧面板仍可接收新版 Agent 的数组格式，但不提供去重保证，建议先升级面板再升级节点。未确认批次保存在 Agent 内存中，Agent 进程退出或崩溃后不会恢复，不能把网络重试保证视为持久化投递保证。

## 外置盘与本地配置

依赖、缓存和数据可以独立于源码目录存放。例如，将 `FLUX_BUILD_DIR` 设为外置盘上的绝对路径后：

```bash
export GOCACHE="$FLUX_BUILD_DIR/go-build"
export GOMODCACHE="$FLUX_BUILD_DIR/go-mod"
export GOTMPDIR="$FLUX_BUILD_DIR/tmp"
mkdir -p "$GOCACHE" "$GOMODCACHE" "$GOTMPDIR"
pnpm --dir vite-frontend install --store-dir "$FLUX_BUILD_DIR/pnpm-store"
```

pnpm store 控制包缓存位置，项目的 `node_modules` 和 `dist` 可另行通过符号链接放到外置盘。部分 shell 测试夹具不支持带空格的临时路径，可使用指向外置盘的无空格路径别名。

本机若已有 `.flvx-build.local`，运行构建前可先载入它。该文件是可选的本地配置，不随仓库分发。

## 代码边界

- 前端使用 Mantine 和 `src/components/ui/` 共享组件；页面标题、导航和角色可见性集中在 `config/navigation.ts`。
- API 使用原始 JWT `Authorization` 头，不加 `Bearer`；成功响应的 `code` 为 `0`。
- 后端 handler 通过 Repository 访问数据，兼容 SQLite 和 PostgreSQL。
- `go-gost` 使用本地 `x` 模块；代理改动需要分别检查两个 Go 模块。
- 安装脚本由发布流程加工，按项目 `AGENTS.md` 的约定维护。
