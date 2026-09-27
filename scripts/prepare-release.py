#!/usr/bin/env python3
"""Render immutable, fork-specific release installers and checksums."""

import argparse
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def replace_once(pattern: str, replacement: str, text: str) -> str:
    result, count = re.subn(pattern, lambda _: replacement, text, flags=re.MULTILINE)
    if count != 1:
        raise ValueError(f"Expected exactly one template match: {pattern} (found {count})")
    return result


def prepare(repository: str, version: str, output: Path, require_artifacts: bool = True) -> list[Path]:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Repository must be owner/name")
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?", version):
        raise ValueError("Version must be a numeric semantic version, without a v prefix")
    output.mkdir(parents=True, exist_ok=True)
    image_prefix = f"ghcr.io/{repository.lower()}"
    result = []
    for name in ("install.sh", "panel_install.sh"):
        source = (ROOT / name).read_text()
        source = replace_once(r'^REPO="[^"]*"$', f'REPO="{repository}"', source)
        source = replace_once(r'^PINNED_VERSION="[^"]*"$', f'PINNED_VERSION="{version}"', source)
        source = source.replace("是否开启 GitHub 加速? (Y/n): ", "是否开启 GitHub 加速? (y/N): ")
        source = replace_once(r'^  case "\$proxy_choice" in$', '  case "${proxy_choice:-n}" in', source)
        if name == "panel_install.sh":
            marker = "# 执行主函数\nmain"
            if source.count(marker) != 1:
                raise ValueError("Panel installer entry point has changed")
            helper = (ROOT / "scripts/release-image-loader.sh").read_text()
            source = source.replace(marker, f'FLUX_IMAGE_PREFIX="{image_prefix}"\n\n{helper}\n{marker}')
            source = replace_once(
                r'^  get_config_params$',
                '  if [[ -e .env || -e docker-compose.yml ]]; then\n'
                '    echo "当前目录已有部署配置，请选择更新功能或换用空目录。" >&2\n'
                '    return 1\n'
                '  fi\n'
                '  get_config_params\n'
                '  flux_ensure_release_images "$RESOLVED_VERSION" || return 1',
                source,
            )
            source = source.replace("curl -L -o docker-compose.yml", "curl -fL --retry 3 -o docker-compose.yml")
            source = source.replace("https://tes.cc/guide.html", f"https://github.com/{repository}/blob/main/doc/install.md")
            source = source.replace("部署完成后请阅读下使用文档，求求了啊，不要上去就是一顿操作", "部署完成后可按使用文档接入节点与配置规则")
        path = output / name
        path.write_text(source)
        path.chmod(0o755)
        result.append(path)

    for name in ("docker-compose-v4.yml", "docker-compose-v6.yml"):
        text = (ROOT / name).read_text()
        text = replace_once(r"^    image: [^\n]*flux-panel-backend:[^\n]*$", f"    image: {image_prefix}/backend:{version}", text)
        text = replace_once(r"^    image: [^\n]*vite-frontend:[^\n]*$", f"    image: {image_prefix}/frontend:{version}", text)
        path = output / name
        path.write_text(text)
        result.append(path)

    for arch in ("amd64", "arm64"):
        binary = output / f"gost-{arch}"
        archives = [output / f"flux-{component}-linux-{arch}.tar.gz" for component in ("backend", "frontend")]
        for artifact in [binary, *archives]:
            if not artifact.is_file():
                if require_artifacts:
                    raise FileNotFoundError(f"Missing release artifact: {artifact.name}")
                continue
            result.append(artifact)
        if binary.is_file():
            digest = sha256(binary)
            checksum = output / f"gost-{arch}.sha256"
            checksum.write_text(f"{digest}  {binary.name}\n")
            result.append(checksum)

    for name in ("LICENSE", "LICENSE-APACHE", "NOTICE"):
        path = output / name
        path.write_bytes((ROOT / name).read_bytes())
        result.append(path)

    (output / "SHA256SUMS").write_text("".join(f"{sha256(path)}  {path.name}\n" for path in sorted(result)))
    return result + [output / "SHA256SUMS"]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--templates-only", action="store_true")
    args = parser.parse_args()
    files = prepare(args.repository, args.version, args.output, not args.templates_only)
    print(f"Prepared {len(files)} release files for {args.repository} {args.version}")
