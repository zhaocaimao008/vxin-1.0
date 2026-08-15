#!/bin/bash
# V信 Web Deploy Script
# Auto-bumps patch version, builds, and deploys to /var/www/html

set -e
cd /root/v信/web

# 1. Bump patch version in web/package.json
python3 - << 'PY'
import json
with open('package.json', 'r') as f:
    pkg = json.load(f)
v = pkg['version'].split('.')
v[2] = str(int(v[2]) + 1)
pkg['version'] = '.'.join(v)
with open('package.json', 'w') as f:
    json.dump(pkg, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(f"[deploy] web version → {pkg['version']}")
PY

# 2. Build
echo "[deploy] Building..."
npm run build

# 3. Deploy to nginx root (preserve downloads/updates/welcome/config.json)
echo "[deploy] Deploying to /var/www/html..."
rsync -a --delete \
  --exclude='config.json' \
  --exclude='downloads' \
  --exclude='updates' \
  --exclude='welcome' \
  dist/ /var/www/html/

# 4. Reload nginx
nginx -s reload
echo "[deploy] Done. Version: $(python3 -c "import json; print(json.load(open('package.json'))['version'])")"
