'use strict';
const router = require('express').Router();
const auth = require('../../middleware/auth');
const c = require('./notifications.controller');

router.get   ('/vapid-public-key',       c.vapidPublicKey);  // 公钥无需鉴权
router.post  ('/web-subscribe',    auth,  c.webSubscribe);
router.delete('/web-subscribe',    auth,  c.webUnsubscribe);
router.post  ('/device-token',     auth,  c.saveDeviceToken);
router.delete('/device-token',     auth,  c.deleteDeviceToken);
router.get   ('/status',           auth,  c.status);

module.exports = router;
