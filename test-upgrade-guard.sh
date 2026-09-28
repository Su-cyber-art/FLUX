#!/bin/bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT
source "$ROOT_DIR/scripts/release-upgrade-guard.sh"
cd "$TEST_DIR"
touch .env docker-compose.yml
flux_template_update_panel() {
  [[ -d .flux-upgrade/lock ]]
  echo called >> calls
  return "${TEMPLATE_RESULT:-0}"
}
update_panel
[[ ! -e .flux-upgrade/lock ]]
TEMPLATE_RESULT=1
if update_panel; then echo 'failed update lost its exit status' >&2; exit 1; fi
[[ ! -e .flux-upgrade/lock ]]
mkdir -p .flux-upgrade/lock
printf 'web-job-owner' > .flux-upgrade/lock/owner
if update_panel; then echo 'web update lock was ignored' >&2; exit 1; fi
[[ $(cat .flux-upgrade/lock/owner) == web-job-owner ]]
[[ $(wc -l < calls | tr -d ' ') == 2 ]]
rm -f .flux-upgrade/lock/owner
rmdir .flux-upgrade/lock
touch .flux-upgrade/maintenance
if update_panel; then echo 'maintenance was ignored' >&2; exit 1; fi
[[ $(wc -l < calls | tr -d ' ') == 2 ]]
echo 'Terminal/web upgrade exclusion and lock cleanup passed'
