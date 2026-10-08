# 安装部署


## 一键安装发布版本

面板端要求 Linux 和 Bash。缺少 Docker 时，会询问是否通过 [Docker 官方安装脚本](https://docs.docker.com/engine/install/ubuntu/#install-using-the-convenience-script) 安装；拒绝安装或验证失败会停止部署。建议在用于面板部署的空目录中以 root 或 sudo 执行：

```bash
curl -fsSL https://github.com/Su-cyber-art/FLUX/releases/latest/download/panel_install.sh -o panel_install.sh && sudo bash panel_install.sh
```

选择 `1` 安装。缺少 Docker 时输入 `y` 同意安装，脚本从 `https://get.docker.com` 下载并执行官方脚本，再检查引擎、Compose 和 `hello-world` 容器。已有 Docker 不会被自动升级，缺少 Compose 或无法访问引擎时会提示修复。验证通过后设置端口和数据库，脚本生成运行密钥和配置，下载当前发布版本并启动容器。

节点端：

```bash
curl -fsSL https://github.com/Su-cyber-art/FLUX/releases/latest/download/install.sh -o install.sh && sh install.sh
```

Alpine 缺少 curl 时可用 wget 下载节点脚本：

```bash
wget -O install.sh https://github.com/Su-cyber-art/FLUX/releases/latest/download/install.sh && sh install.sh
```

代理安装后核对面板地址和节点密钥，查看节点是否在线。支持 Linux amd64 与 arm64。

## 指定版本与更新

将 `latest/download` 换成 `download/3.1.2` 即可获取固定版本的安装脚本：

```bash
curl -fsSL https://github.com/Su-cyber-art/FLUX/releases/download/3.1.2/panel_install.sh -o panel_install.sh && sudo bash panel_install.sh
```

更新时重新运行面板安装命令，选择 `2`。更新流程会验证配置、备份数据、准备镜像再重建服务；启动失败时按脚本结果检查回滚状态。首次安装不会覆盖当前目录中已有的 `.env` 或 `docker-compose.yml`。

## 面板内自升级（3.2.0 起）

从 3.1.x 首次更新时，请在原部署目录下载最新安装脚本，并选择 `2` 更新：

```bash
curl -fsSL https://github.com/Su-cyber-art/FLUX/releases/latest/download/panel_install.sh -o panel_install.sh && sudo bash panel_install.sh
```

之后可在“系统设置 → 面板升级”检查版本并开始升级。进度窗口会显示实际下载大小和百分比、配置及数据库备份、服务重启与健康检查。关闭窗口或刷新页面不会取消任务，设置页会重新读取最近的进度。

切换期间面板会短暂不可用，页面会等待重新连接。只有前端页面和后端健康接口恢复可用后，任务才会显示升级完成。健康检查失败时，会恢复原镜像和对应的数据库备份；下载或校验失败不会停止现有服务。

升级完成后，点击进度窗口中的“刷新页面”。3.3.1 起，这个按钮会检查并等待浏览器应用新的前端缓存，再刷新页面；登录状态会保留。网络异常时会提示重试。

从 3.3.0 或更早版本首次升级时，如果设置页的当前版本已更新、侧栏仍显示旧版本，请点击右下角“发现新版本”提示中的“刷新”，或使用浏览器强制刷新一次，以加载修复后的前端。无需重复执行已经成功的服务器升级。

支持使用官方镜像、默认容器运行用户和单个 `docker-compose.yml` 的部署。部署目录与 Docker socket 需要可写挂载；SQLite 数据需挂载在 `/app/data`，PostgreSQL 自动备份使用同一 Compose 项目的 `postgres` 容器。源码、多配置文件、自定义运行用户或外部 PostgreSQL 部署会显示不可升级原因，请继续使用相应的部署流程更新。

每次任务的状态、计划和备份保存在部署目录的 `.flux-upgrade/<任务编号>/`。进度窗口会给出具体备份位置。若自动恢复也失败，请保留该目录，依据 `plan.json` 中的原镜像、`backup/` 中的 Compose、环境文件和数据库快照恢复服务；确认恢复完成后再移除 `.flux-upgrade/maintenance` 标记。

终端更新和网页升级共用锁，已有任务执行时，另一种方式会明确停止。健康检查默认等待 180 秒，安装环境可通过后端环境变量 `PANEL_UPGRADE_HEALTH_TIMEOUT` 调整为 10–300 秒。

## 通行证密钥登录（3.3.0 起）

通行证密钥（Passkey）默认关闭。管理员启用后，用户先用密码登录，在“个人中心 → 通行证密钥”输入当前密码并绑定设备密钥；之后可在登录页选择密钥，通过设备解锁直接登录，无需输入用户名或 Cloudflare 验证码。绑定和删除密钥均需验证当前密码，原密码登录仍可使用。

在实际部署目录的 `.env` 中添加浏览器访问面板时的公开前端 origin：

```dotenv
FLVX_WEBAUTHN_ORIGIN=https://panel.example.com
```

必须包含协议、域名和必要的端口，不能带路径、查询参数或尾部 `/`。公网部署使用 HTTPS；本机开发可用 `http://localhost:3000` 或 `http://127.0.0.1:3000`。反向代理和独立 API 部署均填写浏览器地址栏中的前端 origin。

确认部署的 `docker-compose.yml` 在 `backend.environment` 下传递该变量；3.3.0 的 IPv4 / IPv6 Compose 模板已包含：

```yaml
FLVX_WEBAUTHN_ORIGIN: ${FLVX_WEBAUTHN_ORIGIN:-}
```

保存后在部署目录执行 `docker compose up -d --force-recreate backend`，再重新加载前端页面。源码部署将同一环境变量传给 `paneld`；多文件 Compose 部署使用原有的 `-f` 参数。

升级会保留已有 `.env`，不会自动启用此功能。旧部署若保留了自定义 Compose 文件，需要补上变量传递项。入口未出现时，检查实际容器中的变量、HTTPS 和浏览器对通行密钥的支持；PWA 提示新版本时选择刷新。未绑定密钥的账号仍需先完成密码和验证码登录。

更换面板域名会改变密钥所属站点，需要在新域名重新绑定。设备丢失时可使用密码登录，在个人中心输入当前密码后删除旧密钥，再绑定新设备。

## 删除节点

建议面板和 agent 均升级至 3.1.2 或更高版本后，再在节点页面删除本地节点。请先删除或迁移该节点关联的隧道、转发和节点共享，避免遗留其他节点上的链路资源。

删除会停止监听、清空运行配置，移除安装目录（含接入密钥、转发配置和升级备份），禁用并移除 systemd / OpenRC 服务，最后撤销面板中的节点身份。支持官方安装目录 `/etc/flux_agent`，以及可确认归属的旧版 `/etc/gost` 安装；自定义目录会明确报错，需先按官方脚本安装。远程共享节点只移除本面板的接入，不能卸载提供方面板的 agent。nftables 节点会先通过 SSH 清理本项目的转发规则，再删除 SSH 凭据。

离线或清理失败的节点会保留为“待清理”，不会显示已完成删除。清理请求保存在数据库中，面板重启后仍有效；agent 重新上线会自动重试。旧版 agent 不支持卸载指令时，先升级该节点再重试。批量删除会分别显示成功数量与每个失败原因。

## 镜像与校验

默认优先使用现有镜像或尝试从 GHCR 拉取；拉取失败后自动下载本版本的公开 Release 镜像包。镜像包会按 `SHA256SUMS` 校验后加载，不需要 GitHub 或 registry 凭据。

也可以在已下载脚本的目录强制使用镜像包：

```bash
FLUX_IMAGE_SOURCE=archive bash panel_install.sh
```

`FLUX_IMAGE_SOURCE=registry` 表示仅使用镜像仓库。Release 同时提供独立代理二进制、校验文件和 IPv4 / IPv6 Compose 配置。

## 从源码部署

需要部署尚未发版的当前代码时，可从源码构建。默认的 `docker-compose-v4.yml` / `docker-compose-v6.yml` 保留了上游发布模板；合并 `compose.source.yml` 后，前后端会使用本地构建的镜像。

### 构建与启动

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

### 查看与更新源码部署

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

## 从源码构建节点代理

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

仓库根目录的 `install.sh`、`panel_install.sh` 是发布模板。正式安装使用 Release 附件；发布流程会注入本仓库地址、版本、镜像来源和校验逻辑。

## 反向代理

前端 Nginx 已转发 API、流式诊断与 WebSocket。可将域名反向代理到前端端口，例如 Caddy：

```caddyfile
panel.example.com {
    reverse_proxy 127.0.0.1:6366
}
```

使用反向代理时，可按部署需要将 `.env` 中的前端绑定改为 `FRONTEND_PORT=127.0.0.1:6366`。
