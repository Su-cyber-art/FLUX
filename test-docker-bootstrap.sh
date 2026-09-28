#!/bin/bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT
source "$ROOT_DIR/scripts/release-docker-bootstrap.sh"
run_case() (
  local name="$1" choice="$2" expected="$3"
  export CASE_DIR="$TEST_DIR/$name"
  mkdir -p "$CASE_DIR"
  [[ "$name" != existing* ]] || touch "$CASE_DIR/docker"
  command() {
    if [[ "$*" == '-v docker' ]]; then [[ -f "$CASE_DIR/docker" ]]
    elif [[ "$*" == '-v docker-compose' ]]; then return 1
    else builtin command "$@"; fi
  }
  uname() { echo Linux; }
  id() { echo 0; }
  systemctl() { echo "start $*" >> "$CASE_DIR/calls"; [[ "$name" != start-fail ]]; }
  curl() {
    [[ "$*" == *https://get.docker.com* ]] || exit 10
    [[ "$name" != download-fail ]] || return 1
    local destination=""
    while [[ $# -gt 0 ]]; do
      if [[ "$1" == -o ]]; then destination="$2"; shift; fi
      shift
    done
    printf 'echo install >> "$CASE_DIR/calls"\n' > "$destination"
    if [[ "$name" == install-fail ]]; then echo 'exit 1' >> "$destination"
    else printf 'touch "$CASE_DIR/docker"\n' >> "$destination"; fi
  }
  docker() {
    echo "docker $*" >> "$CASE_DIR/calls"
    case "$1" in
      info) [[ "$name" != engine-fail ]] ;;
      compose) [[ "$name" != compose-fail && "$name" != existing-no-compose ]] ;;
      run) [[ "$*" == 'run --rm hello-world' && "$name" != hello-fail ]] ;;
      *) return 1 ;;
    esac
  }
  actual=0
  check_docker <<< "$choice" || actual=$?
  if [[ "$expected" == success ]]; then [[ "$actual" == 0 && "$DOCKER_CMD" == 'docker compose' ]]
  else [[ "$actual" != 0 ]]; fi
  if [[ "$name" == decline || "$name" == blank || "$name" == existing* ]]; then
    ! grep -q '^install$' "$CASE_DIR/calls" 2>/dev/null
  fi
  if [[ "$name" == accept ]]; then grep -q '^docker run --rm hello-world$' "$CASE_DIR/calls"; fi
)
run_case decline n fail
run_case blank '' fail
run_case accept y success
run_case download-fail y fail
run_case install-fail y fail
run_case start-fail y fail
run_case engine-fail y fail
run_case compose-fail y fail
run_case hello-fail y fail
run_case existing '' success
run_case existing-no-compose '' fail
echo 'Docker consent, official source, failure propagation and verification checks passed'
