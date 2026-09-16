# v信构建、测试和发布

当前服务端是 `backend-v2`（Express、SQLite、Redis），前端是 `web`（React）。桌面程序在 `desktop-electron`，原生 Android 在 `android`（Kotlin/Compose），原生 iOS 在 `ios`（SwiftUI）。旧 Capacitor 包不作为原生 App 的构建入口。

## 本地运行

需要 Node 22、npm、Redis；Android 需要完整 JDK 17、Android SDK Platform 34 / Build Tools 33.0.1；iOS 需要 macOS、Xcode 和 XcodeGen。

```bash
# 后端：复制 backend-v2/.env.example，填写本地专用配置，Redis 需先启动
cd backend-v2
npm ci
PORT_V2=3002 npm start

# 另一个终端启动 Web
cd web
npm ci --legacy-peer-deps
npm run dev

# 桌面需要相对资源路径
cd desktop-electron
npm ci
npm run build:web
npm run dev
```

Web 的同源 `/config.json` 优先于公共配置源；桌面手动选择的服务器优先于自动发现。默认公共服务为 `https://vxinchat.com`。

## 构建与自检

```bash
cd web
npm run check:capacitor
npm test
npm run lint -- --max-warnings=0
npm run build

cd ../backend-v2
npm run test:coverage   # 自动先检查全部源码语法，使用隔离测试库

cd ../android
JAVA_HOME=/path/to/jdk17 ANDROID_HOME=/path/to/android-sdk ./gradlew testDebugUnitTest assembleDebug
# android/app/build/outputs/apk/debug/app-debug.apk

cd ../ios
xcodegen generate
xcodebuild -project Vxin.xcodeproj -scheme Vxin -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
# GitHub iOS Build 工作流会选择模拟器并运行 VxinTests

cd ../desktop-electron
npm run build:win       # Windows runner
npm run build:mac       # macOS runner
npm run build:linux     # Linux runner
# desktop-electron/dist/；版本来自其 package.json

cd ..
node --test desktop-electron/test/*.test.js deploy/release.test.cjs
```

Web E2E：构建 production Web 后，在 `e2e` 安装依赖，运行 `npm run test:web`。测试会创建独立后端与数据库；应配置专用 Redis。Electron E2E 必须先构建 desktop 模式，再运行 `playwright test --project=electron`，无桌面的 Linux 使用 `xvfb-run -a`。双端媒体测试用浏览器生成的音视频源验证真实 RTP；配置独立 coturn 的 `TURN_SECRET`、`TURN_URLS` 后还会强制验收中继，未配置的中继项明确跳过。

## Docker（独立部署）

根目录 `docker-compose.yml` 实际运行 backend-v2 + Redis + Nginx Web。SQLite 和上传文件使用持久卷，私密媒体仍经过后端鉴权。Redis、数据库没有映射宿主机端口。

在本地环境文件配置 `JWT_SECRET`、独立的 `ADMIN_JWT_SECRET`（均至少 32 字符）、`ADMIN_USERNAME`、`ADMIN_PASSWORD`、`INVITE_CODE`、`APP_URL`。不要复用测试凭据。

```bash
docker compose up --build -d --wait
# 默认 http://localhost:8080/app/；仅绑定 127.0.0.1
curl --fail http://localhost:8080/health
```

对公网服务应在前置代理启用 HTTPS，配置正确的 APP_URL，并按实际网络设置 BIND_IP/HTTP_PORT。TURN、推送、ASR、对象存储属于独立服务/凭据配置；本 Compose 不假定它们存在，也不启动旧 PostgreSQL/微服务实验栈。

## 生产升级与回滚

`deploy.yml` 的 main 发布先跑门禁，再在已有 self-hosted runner 上执行 `deploy/release.sh <commit>`。脚本先在隔离目录按锁文件安装依赖和构建；成功后才替换生产源码、依赖、前端并重启 `vxin-backend`。任一发布错误触发完整回滚并重新检查健康。备份保存在 `/var/lib/vxin-releases/`，不自动删除。

```bash
bash deploy/rollback.sh             # 上次成功发布之前的版本
bash deploy/rollback.sh <commit>    # 指定版本，含 Web 与依赖
```

这是已有安装的升级脚本，不自动初始化生产配置。数据库和上传文件不被代码回滚覆盖；如果将来引入不向后兼容的数据库迁移，必须先设计兼容迁移和独立的数据恢复方案。`--db` 是显式数据恢复操作，不能混在一般代码回滚中执行。

版本和分端发布见 `VERSIONING.md`；实际功能边界见 `docs/CAPABILITIES.md`。
