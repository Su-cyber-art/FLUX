# 开发指南

## 环境

- Go 1.25 或更新版本；`go-backend`、`go-gost`、`go-gost/x` 是三个独立模块。
- Node.js 20.19+，pnpm 10.28.1。
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
