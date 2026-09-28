# Keep terminal and web upgrades from changing the same deployment concurrently.
update_panel() (
  if [[ ! -f .env || ! -f docker-compose.yml ]]; then
    flux_template_update_panel "$@"
    return $?
  fi
  if [[ -f .flux-upgrade/maintenance ]]; then
    echo "面板正在切换版本或等待恢复，请先检查升级进度与备份。" >&2
    return 1
  fi
  (umask 077 && mkdir -p .flux-upgrade) || return 1
  if ! (umask 077 && mkdir .flux-upgrade/lock); then
    echo "已有面板升级任务执行中，请等待完成后重试。" >&2
    return 1
  fi
  local upgrade_owner="cli:$$"
  printf '%s' "$upgrade_owner" > .flux-upgrade/lock/owner
  cleanup_upgrade_lock() {
    if [[ "$(cat .flux-upgrade/lock/owner 2>/dev/null)" == "$upgrade_owner" ]]; then
      rm -f .flux-upgrade/lock/owner
      rmdir .flux-upgrade/lock
    fi
  }
  trap cleanup_upgrade_lock EXIT
  flux_template_update_panel "$@"
)
