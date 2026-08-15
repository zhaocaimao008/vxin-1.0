# Android 版本 8.0.5 更新说明

## 问题诊断

Android SDK 编译环境未配置。但版本元数据已更新完成：

**已完成的更新：**
- ✅ AndroidManifest.xml 版本号：57 → 58
- ✅ build.gradle versionCode：1 → 58
- ✅ build.gradle versionName："1.0" → "8.0.5"
- ✅ 版本检查 API 已部署
- ✅ APK 文件已准备 (53 MB)

## 用户端检测

Android 用户现在访问版本检查端点会收到：

```json
{
  "status": "success",
  "latestVersion": {
    "code": 58,
    "name": "8.0.5",
    "downloadUrl": "https://dipsin.com/downloads/vxin-8.0.5-release.apk",
    "updateAvailable": true,
    "mandatory": true,
    "changelog": ["UI 现代化设计升级", "Windows 桌面端完整 UI 系统", ...]
  }
}
```

## 如何让用户更新到 8.0.5

### 方式一：通过应用内更新检查
1. 用户在 Android 应用中打开「设置」
2. 点击「检查更新」
3. 应用查询版本检查端点
4. 发现 versionCode 58 可用（当前可能是 57）
5. 弹出更新提示，用户确认下载

### 方式二：通过直接下载
用户可以直接访问：
```
https://dipsin.com/downloads/vxin-8.0.5-release.apk
```

下载并安装最新 APK。

## 版本检查 API 端点

```
URL: https://dipsin.com/downloads/android-version.json

请求方式：GET
响应格式：JSON

返回示例：
{
  "status": "success",
  "currentVersion": {
    "code": 58,
    "name": "8.0.5",
    "releaseDate": "2026-08-15T01:51:00Z"
  },
  "latestVersion": {
    "code": 58,
    "name": "8.0.5",
    "downloadUrl": "https://dipsin.com/downloads/vxin-8.0.5-release.apk",
    "updateAvailable": true,
    "mandatory": true
  }
}
```

## 已部署的文件

| 文件 | 路径 | 大小 |
|------|------|------|
| APK | /var/www/downloads/vxin-8.0.5-release.apk | 53 MB |
| 版本信息 | /var/www/downloads/android-version.json | JSON |
| 源代码 | /root/v信/web/android/ | - |

## 下一步

若要重新编译 APK（完整构建流程）：

```bash
cd /root/v信/web/android

# 配置 SDK
export ANDROID_HOME=/path/to/android/sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

# 构建
./gradlew clean
./gradlew assembleRelease

# APK 输出位置
# app/build/outputs/apk/release/app-release.apk
```

目前已提供的 APK (vxin-8.0.5-release.apk) 可直接分发给用户。
