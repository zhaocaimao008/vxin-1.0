'use strict';
const router = require('express').Router();
const auth = require('../../middleware/auth');
const c = require('./stickers.controller');

router.get('/',          auth, c.list);
router.post('/upload',   auth, ...c.uploadMiddlewares, c.uploadHandle);
router.post('/collect',  auth, c.collect);
router.post('/send',     auth, c.send);
router.delete('/:id',    auth, c.remove);

module.exports = router;
