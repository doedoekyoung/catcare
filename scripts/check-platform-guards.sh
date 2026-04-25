#!/usr/bin/env bash
# 웹 전용 globals(window.location, document.*, localStorage 등)를
# Platform.OS 가드 없이 사용하는 코드를 차단한다.
# RN/Hermes에서 window는 정의되어 있으나 window.location이 없어,
# typeof window === 'undefined' 만으로는 안전하지 않다.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 검사 대상 패턴 — 웹에만 존재하는 globals
PATTERNS='window\.(location|document|localStorage|sessionStorage|history)|^[[:space:]]*document\.|^[[:space:]]*localStorage\.|^[[:space:]]*sessionStorage\.'

# src/ 아래 모든 .ts/.tsx 검사. node_modules·dist·assets 제외.
HITS=$(grep -rnE "$PATTERNS" src/ \
  --include='*.ts' --include='*.tsx' \
  2>/dev/null | grep -vE '//\s' | grep -vE '^\s*\*' || true)

# 각 hit의 같은 줄 또는 위 30줄(같은 함수 스코프 가정) 이내에
# Platform.OS 가드가 있으면 통과로 간주.
# typeof window 체크만으로는 RN(window는 있는데 location 없음)에서 충분치 않으므로
# 반드시 Platform.OS 명시적 체크가 있어야 함.
FAILED=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file=$(echo "$line" | cut -d: -f1)
  lineno=$(echo "$line" | cut -d: -f2)
  start=$((lineno - 60))
  [ $start -lt 1 ] && start=1
  context=$(sed -n "${start},${lineno}p" "$file")
  if ! echo "$context" | grep -qE "Platform\.OS\s*[!=]==?\s*'web'|Platform\.OS\s*[!=]==?\s*\"web\""; then
    FAILED+=("$line")
  fi
done <<< "$HITS"

if [ ${#FAILED[@]} -gt 0 ]; then
  echo "❌ 가드 없는 웹 전용 globals 사용 감지 (Platform.OS 가드 추가 필요):"
  printf '%s\n' "${FAILED[@]}"
  echo ""
  echo "예시 가드:"
  echo "  if (Platform.OS !== 'web') return;"
  echo "  if (typeof window !== 'undefined' && window.location) { ... }"
  exit 1
fi

echo "✅ 플랫폼 가드 OK — 웹 전용 globals이 모두 가드되어 있음"
