# 部署当前分支

FLUX 的 Mantine 前端需要从本仓库源码构建。默认的 `docker-compose-v4.yml` / `docker-compose-v6.yml` 保留了上游发布模板；合并 `compose.source.yml` 后，前后端会使用本地构建的镜像。

## Docker Compose 源码部署

准备 Docker、Docker Compose v2 和 Git：

```bash
git clone https://github.com/Su-cyber-art/FLUX.git
cd FLUX
cp .env.example .env
```

编辑 `.env`，设置 `JWT_SECRET`。可用 `openssl rand -hex 32` 生成随机值。默认前端端口为 `6366`，API 端口为 `6365`。

```bash
docker compose -f docker-compose-v4.yml -f compose.source.yml config --quiet
docker compose -f docker-compose-v4.yml -f compose.source.yml up -d --build backend frontend
```

访问 `http://服务器地址:6366`。首次登录使用 `admin_user` / `admin_user`，并按提示修改账号信息。

有 IPv6 网络需求时，将命令中的 `docker-compose-v4.yml` 换为 `docker-compose-v6.yml`；宿主机和 Docker 网络也需具备 IPv6 连通性。

## 查看与更新

```bash
docker compose -f docker-compose-v4.yml -f compose.source.yml ps
docker compose -f docker-compose-v4.yml -f compose.source.yml logs --tail=100 backend frontend
```

更新源码后使用同一组 Compose 文件重新构建：

```bash
git pull --ff-only
docker compose -f docker-compose-v4.yml -f compose.source.yml up -d --build backend frontend
```

源码构建部署使用上述更新方式。面板内的一键升级和安装脚本依赖匹配的发布产物，以 [本仓库 Releases](https://github.com/Su-cyber-art/FLUX/releases) 实际提供的资源为准。

## 数据与数据库

SQLite 数据保存在 `sqlite_data` 卷中的 `gost.db`。停止或重新构建容器会保留该卷。PostgreSQL 配置及备份方法见 [数据库指南](postgresql.md)。

`.env` 包含运行密钥，不提交到 Git。共享 Compose 模板中的后端挂载了 Docker socket，用于面板升级功能；部署配置应与实际需要一致。

## 节点代理

先在面板中添加节点，再准备代理所需的面板地址和节点密钥。

从当前源码构建代理：

```bash
cd go-gost
go build -o gost .
```

在代理运行目录创建 `config.json`：

```json
{
  "addr": "https://panel.example.com",
  "secret": "替换为面板生成的节点密钥",
  "http": 0,
  "tls": 0,
  "socks": 0
}
```

运行 `./gost`，回到面板检查节点在线状态。运行用户需要有权使用对应的监听端口与网络能力。需要 systemd/OpenRC 托管时，使用匹配发布版本的安装资源或自行配置服务。

仓库根目录的 `install.sh`、`panel_install.sh` 是继承的发布模板，不能仅将其下载地址改成个人仓库就视为已经发布了本分支。

## 反向代理

前端 Nginx 已转发 API、流式诊断与 WebSocket。可将域名反向代理到前端端口，例如 Caddy：

```caddyfile
panel.example.com {
    reverse_proxy 127.0.0.1:6366
}
```

使用反向代理时，可按部署需要将 `.env` 中的前端绑定改为 `FRONTEND_PORT=127.0.0.1:6366`。
