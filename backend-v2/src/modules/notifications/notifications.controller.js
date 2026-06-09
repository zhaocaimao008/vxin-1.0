'use strict';
const { asyncHandler } = require('../../utils/http');
const svc = require('./notifications.service');

exports.vapidPublicKey = asyncHandler(async (req, res) => {
  const key = svc.vapidPublicKey();
  if (!key) return res.status(503).json({ error: 'Web Push 未配置' });
  res.json({ publicKey: key });
});

exports.webSubscribe = asyncHandler(async (req, res) => {
  svc.webSubscribe(req.user.id, req.body.subscription);
  res.json({ success: true });
});
exports.webUnsubscribe = asyncHandler(async (req, res) => {
  svc.webUnsubscribe(req.user.id, req.body.endpoint);
  res.json({ success: true });
});
exports.saveDeviceToken = asyncHandler(async (req, res) => {
  svc.saveDeviceToken(req.user.id, req.body.token, req.body.platform);
  res.json({ success: true });
});
exports.deleteDeviceToken = asyncHandler(async (req, res) => {
  svc.deleteDeviceToken(req.user.id, req.body.token);
  res.json({ success: true });
});
exports.status = asyncHandler(async (req, res) => res.json(svc.status(req.user.id)));
