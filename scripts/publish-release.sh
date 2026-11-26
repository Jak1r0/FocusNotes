#!/usr/bin/env bash
# 创建 GitHub Release 并上传 0.2.1 产物。
# 用法：bash scripts/publish-release.sh
# 凭据来自本机 Git Credential Manager，不会写入脚本或仓库。
set -euo pipefail

OWNER=Jak1r0
REPO=FocusNotes
TAG=v0.2.1
TITLE="FocusNotes 0.2.1"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ART="$ROOT/artifacts"
NOTES="$ROOT/docs/RELEASE_NOTES.md"

# 读取 git 凭据（仅在进程内使用）
CREDS="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill)"
TOKEN="$(printf '%s\n' "$CREDS" | sed -n 's/^password=//p' | head -1)"
if [ -z "$TOKEN" ]; then echo "无法读取 GitHub 凭据" >&2; exit 1; fi

api() {
  curl -sS --fail-with-body -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" "$@"
}

# 取 RELEASE_NOTES.md 里 0.2.1 段落作为正文
BODY="$(python - "$NOTES" <<'PY'
import sys
text = open(sys.argv[1], encoding='utf-8').read()
start = text.index('## 0.2.1')
end = text.index('## 0.2.0', start)
print(text[start:end].strip())
PY
)"

echo "== 创建 Release $TAG =="
RELEASE_JSON="$(api -X POST "https://api.github.com/repos/$OWNER/$REPO/releases" \
  -d "$(printf '{"tag_name":"%s","name":"%s","body":%s,"draft":false,"prerelease":false}' \
    "$TAG" "$TITLE" "$(BODY="$BODY" python -c 'import json,os;print(json.dumps(os.environ["BODY"]))')")")"

UPLOAD_URL="$(printf '%s' "$RELEASE_JSON" | python -c 'import json,sys;print(json.load(sys.stdin)["upload_url"].split("{")[0])')"
RELEASE_HTML="$(printf '%s' "$RELEASE_JSON" | python -c 'import json,sys;print(json.load(sys.stdin)["html_url"])')"

for file in \
  "FocusNotes-Setup-0.2.1.exe" \
  "FocusNotes-Setup-0.2.1.exe.sha256" \
  "FocusNotes-0.2.1.apk" \
  "FocusNotes-0.2.1.apk.sha256" \
  "FocusNotes-0.2.1-cert.pem"
do
  echo "== 上传 $file =="
  curl -sS --fail-with-body -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$ART/$file" \
    "$UPLOAD_URL?name=$file" > /dev/null
done

echo "完成：$RELEASE_HTML"
