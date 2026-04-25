#!/usr/bin/env bash
# Maestro 안드로이드 E2E 실행 헬퍼.
# 1) 에뮬레이터 부팅 (이미 떠있으면 그대로 사용)
# 2) 디버그 APK가 설치되어 있다고 가정 — 없으면 EAS 빌드 후 adb install로 깔아둘 것
# 3) maestro test로 maestro/flows/ 모두 실행
#
# 메모리: 헤드리스 에뮬레이터 ~1.5GB + Maestro ~200MB. Chrome 정리 권장.

set -e

export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk/jdk-17.0.13+11/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$HOME/.maestro/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

AVD_NAME="${MAESTRO_AVD:-catcare}"

# 에뮬레이터가 이미 떠있는지 확인
if ! adb devices 2>/dev/null | grep -q "emulator-"; then
  echo "▶ Booting emulator $AVD_NAME (headless, ~30s)..."
  emulator -avd "$AVD_NAME" -no-window -no-audio -no-snapshot-save -no-boot-anim &
  EMU_PID=$!
  trap "kill $EMU_PID 2>/dev/null || true" EXIT
  adb wait-for-device
  # boot completion polling
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 2
  done
  echo "✓ Emulator ready"
else
  echo "✓ Emulator already running"
fi

# 환경변수 (.env.test에서 가져와 Maestro로 주입)
if [ -f .env.test ]; then
  set -a; source .env.test; set +a
fi

EMAIL="${E2E_TEST_EMAIL:-}"
PASSWORD="${E2E_TEST_PASSWORD:-}"

echo "▶ Running Maestro flows..."
maestro test maestro/flows/ \
  -e EMAIL="$EMAIL" \
  -e PASSWORD="$PASSWORD"
