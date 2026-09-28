# Injected into the generated panel installer by prepare-release.py.
# An existing Docker installation is never upgraded by the convenience script.
flux_install_docker() (
  local choice="" script
  echo "未检测到 Docker。可使用官方脚本 https://get.docker.com 安装 Docker Engine 和 Compose。"
  read -r -p "是否一键安装 Docker？(y/N): " choice || choice=""
  case "$choice" in
    y|Y|yes|YES) ;;
    *) echo "已取消部署，请安装 Docker 后重新运行。" >&2; return 1 ;;
  esac
  if [[ "$(uname -s)" != Linux ]]; then
    echo "官方一键安装脚本仅适用于受支持的 Linux 发行版。" >&2
    return 1
  fi
  if [[ "$(id -u)" != 0 ]]; then
    echo "请使用 sudo bash panel_install.sh 重新运行，以便安装并管理 Docker。" >&2
    return 1
  fi
  script=$(mktemp "${TMPDIR:-/tmp}/flux-get-docker.XXXXXX") || return 1
  trap 'rm -f "$script"' EXIT
  if ! curl --proto '=https' --tlsv1.2 -fsSL --retry 3 https://get.docker.com -o "$script"; then
    echo "下载 Docker 官方安装脚本失败，部署已停止。" >&2
    return 1
  fi
  if ! sh "$script"; then
    echo "Docker 官方安装脚本执行失败，部署已停止。" >&2
    return 1
  fi
  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now docker || return 1
  elif command -v service >/dev/null 2>&1; then
    service docker start || return 1
  fi
)

check_docker() {
  local installed=false
  if ! command -v docker >/dev/null 2>&1; then
    flux_install_docker || return 1
    hash -r
    installed=true
  fi
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo "Docker 引擎验证失败：请确认服务已启动，且当前用户有访问权限。部署已停止。" >&2
    return 1
  fi
  if docker compose version >/dev/null 2>&1; then
    DOCKER_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
    DOCKER_CMD="docker-compose"
  else
    echo "Docker Compose 验证失败，请安装 Compose 插件后重试。部署已停止。" >&2
    return 1
  fi
  if [[ "$installed" == true ]] && ! docker run --rm hello-world; then
    echo "Docker hello-world 容器验证失败，部署已停止。请检查网络及 Docker 日志后重试。" >&2
    return 1
  fi
  echo "Docker 引擎与 Compose 验证通过：$DOCKER_CMD"
}
