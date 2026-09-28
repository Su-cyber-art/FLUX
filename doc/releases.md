# 发布指南

发布流程位于 `.github/workflows/docker-build.yml`，支持手动触发和推送数字版本标签。版本示例为 `3.1.0`；使用 `3.1.1-rc1` 等带连字符的版本时会标记为预发布，不替换稳定版 latest。

## 发布前

- 提交代码与对应的 `docs/releases/<版本>.md` 变更说明。
- 运行 `bash test-install-scripts-proxy.sh`、`bash test-release-artifacts.sh` 和 `bash test-docker-bootstrap.sh`。
- 确认 GitHub Actions 可运行，工作流可写入本仓库的 Release 和 Packages。

## 手动触发

```bash
gh workflow run docker-build.yml --repo Su-cyber-art/FLUX --ref main -f version=3.1.2
```

工作流固定使用触发时的提交构建，全部检查完成后创建标签与 Release。无需提前创建空 Release，也无需设置额外的发布 PAT。

也可推送一个未发布的数字版本标签触发流程。已发布版本不能直接覆盖，需要递增版本。

## 构建产物

1. 在原生 amd64 和 arm64 Linux runner 上执行后端测试、构建代理与前后端镜像。
2. 在干净 Linux 上实际安装官方 Docker，并在两种架构上验证真实 agent 的 systemd / OpenRC 卸载；启动实际镜像检查健康接口、前端 HTML、首次改密及重新登录。
3. 导出 Docker 镜像包，同时推送带架构后缀的 GHCR 镜像。
4. 合并多架构 manifest，生成固定仓库和版本的安装脚本、Compose 文件与 SHA-256 清单。
5. 验证 Alpine 节点安装流程，将全部资源上传到草稿 Release，核对大小及可用的服务端摘要。
6. 发布完整 Release，并检查安装脚本和校验文件可公开下载。

面板脚本在镜像仓库不可用时使用公开 Release 镜像包，避免首次安装依赖 registry 登录。归档中的镜像标签与发布 Compose 完全一致。

## 修改安装逻辑

根目录的 `install.sh` 和 `panel_install.sh` 保留为模板。仓库和版本注入、部署保护、镜像回退及 Docker 安装逻辑在 `scripts/prepare-release.py`、`scripts/release-image-loader.sh` 和 `scripts/release-docker-bootstrap.sh` 中维护。修改后先运行发布脚本测试，避免只改 README 下载地址却仍从上游下载产物。
