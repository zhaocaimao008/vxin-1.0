#!/usr/bin/env bash
set -euo pipefail
mkdir -p android-smoke
APK=$(find apk -name '*.apk' -print -quit)
test -n "$APK"
test "$(sha256sum "$APK" | cut -d' ' -f1)" = "$(jq -r .sha256 apk/vxin-android-version.json)"
adb install -r -g "$APK"
adb logcat -c
for mode in light dark; do
  if [ "$mode" = dark ]; then adb shell cmd uimode night yes; else adb shell cmd uimode night no; fi
  adb shell am force-stop com.vxin.app
  adb shell am start -W -n com.vxin.app/.MainActivity
  sleep 8
  adb shell pidof com.vxin.app
  adb shell uiautomator dump /sdcard/window.xml
  adb pull /sdcard/window.xml "android-smoke/$mode.xml"
  adb exec-out screencap -p > "android-smoke/$mode.png"
  grep -q 'package="com.vxin.app"' "android-smoke/$mode.xml"
  grep -q '登录' "android-smoke/$mode.xml"
done
adb logcat -d -b crash > android-smoke/crash.log
if grep -q 'com.vxin.app' android-smoke/crash.log; then cat android-smoke/crash.log; exit 1; fi
adb shell dumpsys package com.vxin.app | grep -E 'versionCode=|versionName=' > android-smoke/version.txt
cp apk/vxin-android-version.json android-smoke/
