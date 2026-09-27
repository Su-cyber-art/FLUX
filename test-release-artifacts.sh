#!/bin/bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT
export TEST_DIR

python3 "$ROOT_DIR/scripts/prepare-release.py" --repository Su-cyber-art/FLUX --version 3.1.0 --output "$TEST_DIR/rendered" --templates-only
bash -n "$TEST_DIR/rendered/install.sh" "$TEST_DIR/rendered/panel_install.sh"
python3 - "$TEST_DIR/rendered" <<'PY'
from pathlib import Path
import hashlib, sys
root = Path(sys.argv[1])
for name in ['install.sh', 'panel_install.sh']:
    text = (root / name).read_text()
    assert 'REPO="Su-cyber-art/FLUX"' in text
    assert 'PINNED_VERSION="3.1.0"' in text
    assert 'Sagit-chu/flux-panel' not in text
for name in ['docker-compose-v4.yml', 'docker-compose-v6.yml']:
    text = (root / name).read_text()
    assert 'ghcr.io/su-cyber-art/flux/backend:3.1.0' in text
    assert 'ghcr.io/su-cyber-art/flux/frontend:3.1.0' in text
    assert 'ghcr.io/sagit-chu/' not in text
for line in (root / 'SHA256SUMS').read_text().splitlines():
    digest, name = line.split()
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
PY
if python3 "$ROOT_DIR/scripts/prepare-release.py" --repository Su-cyber-art/FLUX --version 3.1.0 --output "$TEST_DIR/incomplete" >/dev/null 2>&1; then
  echo "Incomplete releases must fail" >&2
  exit 1
fi
if python3 "$ROOT_DIR/scripts/prepare-release.py" --repository Su-cyber-art/FLUX --version '3.1.0;invalid' --output "$TEST_DIR/invalid" --templates-only >/dev/null 2>&1; then
  echo "Invalid release versions must fail" >&2
  exit 1
fi

mkdir -p "$TEST_DIR/fixtures" "$TEST_DIR/loaded"
printf 'backend archive\n' > "$TEST_DIR/fixtures/flux-backend-linux-amd64.tar.gz"
printf 'frontend archive\n' > "$TEST_DIR/fixtures/flux-frontend-linux-amd64.tar.gz"
python3 - "$TEST_DIR/fixtures" <<'PY'
from pathlib import Path
import hashlib, sys
root = Path(sys.argv[1])
(root / 'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in sorted(root.glob('*.tar.gz'))))
PY
# Load functions only. No container, installation, systemd or network action runs locally.
sed '/^# 执行主函数$/,$d' "$TEST_DIR/rendered/panel_install.sh" > "$TEST_DIR/functions.sh"
source "$TEST_DIR/functions.sh"
PROXY_ENABLED=""
PROXY_URL=""
ask_proxy_config >/dev/null < <(printf '\n')
[[ "$PROXY_ENABLED" == false ]]
PROXY_ENABLED=false
FLUX_IMAGE_SOURCE=auto
docker() {
  case "$1 $2" in
    'info --format') echo amd64 ;;
    'image inspect') [[ -f "$TEST_DIR/loaded/${3##*/}" ]] ;;
    'pull '*) return 1 ;;
    'load -i')
      case "$3" in
        *flux-backend-*) touch "$TEST_DIR/loaded/backend:3.1.0" ;;
        *flux-frontend-*) touch "$TEST_DIR/loaded/frontend:3.1.0" ;;
        *) return 1 ;;
      esac
      echo load >> "$TEST_DIR/load-calls"
      ;;
    *) echo "Unexpected Docker call: $*" >&2; return 1 ;;
  esac
}
curl() {
  local output="" url=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -o) output="$2"; shift 2 ;;
      *) url="$1"; shift ;;
    esac
  done
  cp "$TEST_DIR/fixtures/${url##*/}" "$output"
  echo download >> "$TEST_DIR/download-calls"
}
flux_ensure_release_images 3.1.0
[[ -f "$TEST_DIR/loaded/backend:3.1.0" && -f "$TEST_DIR/loaded/frontend:3.1.0" ]]
[[ $(wc -l < "$TEST_DIR/load-calls" | tr -d ' ') == 2 ]]
downloads=$(wc -l < "$TEST_DIR/download-calls")
flux_ensure_release_images 3.1.0
[[ $(wc -l < "$TEST_DIR/download-calls") == "$downloads" ]]
rm "$TEST_DIR/loaded/backend:3.1.0" "$TEST_DIR/loaded/frontend:3.1.0"
printf 'corrupted\n' > "$TEST_DIR/fixtures/flux-backend-linux-amd64.tar.gz"
if flux_ensure_release_images 3.1.0; then
  echo "A corrupt archive must not be installed" >&2
  exit 1
fi
[[ $(wc -l < "$TEST_DIR/load-calls" | tr -d ' ') == 2 ]]
echo "Release rendering, registry fallback, cache reuse and checksum rejection passed"
