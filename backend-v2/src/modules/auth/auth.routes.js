'use strict';
const router = require('express').Router();
const auth = require('../../middleware/auth');
const { loginLimiter, registerLimiter } = require('../../middleware/rateLimiters');
const c = require('./auth.controller');

router.post('/register',        registerLimiter, c.register);
router.post('/login',           loginLimiter,    c.login);
router.get ('/me',              auth,            c.me);
router.post('/refresh',         auth,            c.refresh);
router.post('/logout',                           c.logout);
router.get ('/sessions',        auth,            c.sessions);
router.delete('/sessions/:id',  auth,            c.deleteSession);
router.put ('/change-password', auth,            c.changePassword);

module.exports = router;
