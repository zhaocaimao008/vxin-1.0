'use strict';
const router = require('express').Router();
const auth = require('../../middleware/auth');
const { uploadCredentialLimiter } = require('../../middleware/rateLimiters');
const c = require('./upload.controller');

router.post('/credential', auth, uploadCredentialLimiter, c.credential);

module.exports = router;
