# Included in the generated release panel installer by prepare-release.py.
# The image archives make a release installable without registry credentials.

flux_image_architecture() {
  local architecture
  architecture=$(docker info --format '{{.Architecture}}' 2>/dev/null || uname -m)
  case "$architecture" in
    amd64|x86_64) echo amd64 ;;
    arm64|aarch64) echo arm64 ;;
    *) echo "不支持的 Docker 架构: $architecture（支持 amd64 / arm64）" >&2; return 1 ;;
  esac
}

flux_release_image() {
  printf '%s/%s:%s\n' "$FLUX_IMAGE_PREFIX" "$1" "$2"
}

flux_load_image_archives() (
  set -e
  local version="$1" architecture temp_dir base_url component image filename expected actual
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]] || {
    echo "无效的发布版本: $version" >&2
    return 1
  }
  architecture=$(flux_image_architecture) || return 1
  temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/flux-images.XXXXXX") || return 1
  trap 'rm -rf "$temp_dir"' EXIT
  base_url="https://github.com/${REPO}/releases/download/${version}"
  curl -fL --retry 3 --connect-timeout 15 -o "$temp_dir/SHA256SUMS" "$(maybe_proxy_url "$base_url/SHA256SUMS")" || return 1

  for component in backend frontend; do
    image=$(flux_release_image "$component" "$version")
    if docker image inspect "$image" >/dev/null 2>&1; then
      continue
    fi
    filename="flux-${component}-linux-${architecture}.tar.gz"
    expected=$(awk -v name="$filename" '$2 == name {print $1}' "$temp_dir/SHA256SUMS")
    [[ "$expected" =~ ^[a-fA-F0-9]{64}$ ]] || {
      echo "发布校验清单中缺少有效的 $filename 校验值" >&2
      return 1
    }
    echo "📦 下载 $filename"
    curl -fL --retry 3 --connect-timeout 15 -o "$temp_dir/$filename" "$(maybe_proxy_url "$base_url/$filename")" || return 1
    if command -v sha256sum >/dev/null 2>&1; then
      actual=$(sha256sum "$temp_dir/$filename" | awk '{print $1}') || return 1
    else
      actual=$(shasum -a 256 "$temp_dir/$filename" | awk '{print $1}') || return 1
    fi
    [[ "$actual" == "$expected" ]] || {
      echo "镜像包校验失败: $filename，安装已中止" >&2
      return 1
    }
    docker load -i "$temp_dir/$filename" || return 1
    docker image inspect "$image" >/dev/null || {
      echo "镜像包未提供期望的版本: $image" >&2
      return 1
    }
  done
)

flux_ensure_release_images() {
  local version="$1" backend_image frontend_image
  backend_image=$(flux_release_image backend "$version")
  frontend_image=$(flux_release_image frontend "$version")
  if docker image inspect "$backend_image" >/dev/null 2>&1 && docker image inspect "$frontend_image" >/dev/null 2>&1; then
    return 0
  fi
  case "${FLUX_IMAGE_SOURCE:-auto}" in
    archive) flux_load_image_archives "$version" ;;
    registry) docker pull "$backend_image" && docker pull "$frontend_image" ;;
    auto)
      if docker pull "$backend_image" && docker pull "$frontend_image"; then
        return 0
      fi
      echo "ℹ️ 镜像仓库暂不可用，改用此版本的 Release 镜像包（无需登录）。"
      flux_load_image_archives "$version"
      ;;
    *) echo "FLUX_IMAGE_SOURCE 只能为 auto、archive 或 registry" >&2; return 1 ;;
  esac
}

# Preserve the original backup/validation/rollback flow while allowing archives.
pull_panel_update_images() {
  local db_type="$1"
  flux_ensure_release_images "$LATEST_VERSION" || return 1
  if [[ "$db_type" == "postgres" ]]; then
    FLUX_VERSION="$LATEST_VERSION" run_panel_compose -f "$UPDATE_COMPOSE_CANDIDATE" pull postgres
  fi
}
