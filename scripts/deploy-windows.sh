#!/bin/bash
# V信 Windows Build & Deploy
# Auto-bumps patch version, builds, copies to both download + update directories

set -e
cd /root/v信/desktop-electron

# 1. Bump both versions in sync
python3 - << 'PY'
import json

for path in ['../web/package.json', 'package.json']:
    with open(path, 'r') as f:
        pkg = json.load(f)
    v = pkg['version'].split('.')
    v[2] = str(int(v[2]) + 1)
    pkg['version'] = '.'.join(v)
    with open(path, 'w') as f:
        json.dump(pkg, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f"[build] {path} → {pkg['version']}")
PY

VERSION=$(node -p "require('./package.json').version")

# 2. Build web (desktop mode)
echo "[build] Building web in desktop mode..."
npm run build:web

# 3. Build Windows installer
echo "[build] Packaging Windows installer v${VERSION}..."
unset WIN_CSC_LINK
unset CSC_LINK
export CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --win --x64 --config electron-builder-nosign.json

INSTALLER="dist/vxin-${VERSION}-setup.exe"
BLOCKMAP="dist/vxin-${VERSION}-setup.exe.blockmap"

# 4. 重新计算实际 sha512（electron-builder 生成的 latest.yml 可能与最终文件不一致）
echo "[build] 计算实际 sha512..."
python3 - << PY
import hashlib, base64, datetime

exe_path = 'dist/vxin-${VERSION}-setup.exe'
with open(exe_path, 'rb') as f:
    data = f.read()
exe_hash = base64.b64encode(hashlib.sha512(data).digest()).decode()
exe_size = len(data)
now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')

yml = f"""version: ${VERSION}
files:
  - url: vxin-${VERSION}-setup.exe
    sha512: {exe_hash}
    size: {exe_size}
path: vxin-${VERSION}-setup.exe
sha512: {exe_hash}
releaseDate: '{now}'
"""

with open('dist/latest.yml', 'w') as f:
    f.write(yml)
print(f"[build] sha512: {exe_hash[:50]}...")
print(f"[build] size:   {exe_size} bytes")
PY

# 5. 部署到下载目录（直接下载链接）
echo "[build] 部署安装包..."
cp "${INSTALLER}"  "/var/www/downloads/vxin-${VERSION}-setup.exe"
cp "${INSTALLER}"  "/var/www/downloads/vxin-windows-latest-setup.exe"
cp "${BLOCKMAP}"   "/var/www/downloads/vxin-${VERSION}-setup.exe.blockmap" 2>/dev/null || true

# 6. 部署到更新目录（自动更新链路）
echo "[build] 部署更新文件..."
for UPDATES_DIR in /var/www/html/downloads/updates /var/www/downloads/updates; do
    cp "${INSTALLER}"         "${UPDATES_DIR}/vxin-${VERSION}-setup.exe"
    cp "${BLOCKMAP}"          "${UPDATES_DIR}/vxin-${VERSION}-setup.exe.blockmap" 2>/dev/null || true
    cp "dist/latest.yml"      "${UPDATES_DIR}/latest.yml"
    echo "[build]   ✓ ${UPDATES_DIR}"
done

echo "[build] 完成。"
echo "[build] 下载: https://vxinchat.com/downloads/vxin-${VERSION}-setup.exe"
echo "[build] 更新: https://vxinchat.com/downloads/updates/latest.yml"
