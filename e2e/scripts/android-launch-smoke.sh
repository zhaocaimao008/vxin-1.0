#!/usr/bin/env bash
set -euo pipefail
mkdir -p android-smoke
APK=$(find apk -name '*.apk' -print -quit)
test -n "$APK"
adb install -r "$APK"
adb logcat -c
adb shell am start -W -n com.vxin.app/.MainActivity
sleep 8
adb shell pidof com.vxin.app
adb shell uiautomator dump /sdcard/window.xml
adb pull /sdcard/window.xml android-smoke/window.xml
adb exec-out screencap -p > android-smoke/launch.png
adb logcat -d -b crash > android-smoke/crash.log
if grep -q 'com.vxin.app' android-smoke/crash.log; then
  cat android-smoke/crash.log
  exit 1
fi
# Check that a real app window rendered, not just a surviving background process.
grep -q 'package="com.vxin.app"' android-smoke/window.xml
