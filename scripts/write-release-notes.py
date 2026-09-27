#!/usr/bin/env python3
"""Generate release notes with working, version-pinned install commands."""
import argparse
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--repository", required=True)
parser.add_argument("--version", required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
details = root / "docs/releases" / f"{args.version}.md"
intro = details.read_text() if details.is_file() else f"FLUX {args.version}\n\nMantine 控制台、Go 管理 API 与 GOST 代理。\n"
base = f"https://github.com/{args.repository}/releases/download/{args.version}"
notes = intro + f'''

## 一键安装

面板端（Linux，需 Docker 和 Docker Compose）：

```bash
curl -fsSL {base}/panel_install.sh -o panel_install.sh && bash panel_install.sh
```

节点端：

```bash
curl -fsSL {base}/install.sh -o install.sh && sh install.sh
```

脚本固定安装本版本。面板安装会提示端口和数据库设置；首次登录使用 `admin_user` / `admin_user`，随后按提示修改账号信息。

## 发布资源

- Linux amd64 / arm64 的 GOST 代理及单独 SHA-256 校验文件。
- IPv4 / IPv6 Docker Compose 配置与面板、节点安装脚本。
- 两种架构的前后端 Docker 镜像归档，可直接 `docker load -i 文件名`。
- `SHA256SUMS` 覆盖所有上述产物。

镜像仓库不可用或需要登录时，面板脚本会自动下载并校验公开的 Release 镜像包。也可在运行脚本前设置 `FLUX_IMAGE_SOURCE=archive` 强制使用镜像包；不需要 GitHub 或 registry 凭据。

当前版本的镜像引用为 `ghcr.io/{args.repository.lower()}/backend:{args.version}` 与 `ghcr.io/{args.repository.lower()}/frontend:{args.version}`。仓库访问权限不足时使用上述安装脚本或 Release 镜像包。

## 验证

发布流程在两种 Linux 架构上构建并测试镜像，检查前端页面、API 登录、代理版本与安装脚本。所有文件先上传至草稿版本，校验完成后才发布。
'''
args.output.write_text(notes)
