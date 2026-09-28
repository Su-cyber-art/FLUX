#!/bin/bash
set -euo pipefail
: "${FLUX_IMAGE_PREFIX:?Missing image prefix}"
: "${FLUX_RELEASE_VERSION:?Missing version}"
cleanup() {
  docker rm -f flux-release-api flux-release-ui >/dev/null 2>&1 || true
  docker network rm flux-release-smoke >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create flux-release-smoke >/dev/null
docker run -d --name flux-release-api --network flux-release-smoke --network-alias backend \
  -e JWT_SECRET=release-smoke-only -e DB_PATH=/tmp/gost.db \
  "$FLUX_IMAGE_PREFIX/backend:$FLUX_RELEASE_VERSION" >/dev/null
docker run -d --name flux-release-ui --network flux-release-smoke -p 127.0.0.1::80 \
  "$FLUX_IMAGE_PREFIX/frontend:$FLUX_RELEASE_VERSION" >/dev/null
port=$(docker inspect --format '{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}' flux-release-ui)
ready=false
for attempt in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$port/flow/test" >/dev/null; then
    ready=true
    break
  fi
  sleep 2
done
if [[ "$ready" != true ]]; then
  docker logs flux-release-api
  docker logs flux-release-ui
  exit 1
fi
curl -fsS "http://127.0.0.1:$port/" | grep -q '<div id="root"></div>'
curl -fsS "http://127.0.0.1:$port/api/v1/user/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin_user","password":"admin_user"}' \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); assert r["code"] == 0 and r["data"]["token"] and r["data"]["requirePasswordChange"]'
echo "Container health, frontend HTML and API login smoke checks passed"
python3 - "$port" <<'PY'
import json, sys, urllib.request
base = f'http://127.0.0.1:{sys.argv[1]}/api/v1'
def post(path, payload, token=''):
    req = urllib.request.Request(base + path, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json', 'Authorization': token})
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)
first = post('/user/login', {'username': 'admin_user', 'password': 'admin_user'})
token = first['data']['token']
changed = post('/user/updatePassword', {'newUsername': 'admin_user', 'currentPassword': 'admin_user', 'newPassword': 'release-smoke-password', 'confirmPassword': 'release-smoke-password'}, token)
assert changed['code'] == 0, changed
assert post('/tunnel/user/tunnel', {}, token)['code'] == 401
second = post('/user/login', {'username': 'admin_user', 'password': 'release-smoke-password'})
assert second['code'] == 0 and second['data']['requirePasswordChange'] is False, second
assert post('/tunnel/user/tunnel', {}, second['data']['token'])['code'] == 0
print('First-login onboarding and subsequent session checks passed in release containers')
PY
