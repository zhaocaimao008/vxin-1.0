// Initialize missing Web Push credentials once. Existing subscriptions keep their original keys.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('../backend-v2/node_modules/dotenv');
const webPush = require('../backend-v2/node_modules/web-push');
const file = process.argv[2];
if (!file) throw Error('Usage: configure-web-push.cjs /path/to/backend-v2/.env');
const original = fs.readFileSync(file, 'utf8');
const env = dotenv.parse(original);
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  console.log('Web Push keys already configured; retained.');
} else {
  if (env.VAPID_PUBLIC_KEY || env.VAPID_PRIVATE_KEY) throw Error('Incomplete Web Push key pair; refusing to rotate existing credentials.');
  const keys = webPush.generateVAPIDKeys();
  const backupDir = process.env.STATE_ROOT || path.dirname(file);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, `env-before-web-push-${Date.now()}.bak`), original, { mode: 0o600, flag: 'wx' });
  const updated = original + `\n# Web Push credentials initialized by deployment\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n` +
    (env.VAPID_EMAIL ? '' : 'VAPID_EMAIL=mailto:support@vxinchat.com\n');
  const temp = file + '.web-push-tmp';
  fs.writeFileSync(temp, updated, { mode: 0o600, flag: 'wx' });
  fs.renameSync(temp, file);
  console.log('Web Push key pair configured; previous environment backed up privately.');
}
