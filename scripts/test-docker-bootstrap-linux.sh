#!/bin/bash
set -euo pipefail
# This intentionally removes Docker packages on a disposable GitHub runner.
[[ ${GITHUB_ACTIONS:-} == true && $(uname -s) == Linux && $(id -u) == 0 ]] || {
  echo 'Run only as root on a disposable GitHub Actions Linux runner.' >&2
  exit 1
}
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
systemctl stop docker.service docker.socket containerd.service || true
packages=$(dpkg-query -W -f='${binary:Package}\n' | grep -E '^(docker-ce|docker-ce-cli|docker-ce-rootless-extras|docker-buildx-plugin|docker-compose-plugin|docker.io|docker-compose-v2|containerd.io|moby-engine|moby-cli|moby-buildx|moby-compose|moby-containerd|moby-runc)(:.*)?$' || true)
if [[ -n "$packages" ]]; then
  readarray -t package_list <<< "$packages"
  apt-get remove -y "${package_list[@]}"
fi
hash -r
if command -v docker >/dev/null 2>&1; then
  echo 'Preinstalled Docker remains; refusing to treat this as a clean install test.' >&2
  exit 1
fi
rendered=$(mktemp -d)
trap 'rm -rf "$rendered"' EXIT
python3 "$root/scripts/prepare-release.py" --repository Su-cyber-art/FLUX --version 3.1.1 --output "$rendered" --templates-only
sed '/^# 执行主函数$/,$d' "$rendered/panel_install.sh" > "$rendered/functions.sh"
source "$rendered/functions.sh"
check_docker <<< y
docker info >/dev/null
docker compose version
docker run --rm hello-world
echo 'Official Docker installation and runtime validation passed on clean Linux'
