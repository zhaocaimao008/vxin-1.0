'use strict';
/**
 * JWT HMAC 密钥对象(进程内只创建一次)。
 * jsonwebtoken 9 收到字符串密钥时，每次 verify 都先 crypto.createPublicKey() 试解析(失败抛错)
 * 再退回对称密钥——压测中这一步占主线程 CPU ~6%。直接传 KeyObject 可跳过。
 */
const crypto = require('crypto');
const config = require('../config');

let userKey = null;
let adminKey = null;

exports.userJwtKey = () => (userKey ||= crypto.createSecretKey(Buffer.from(config.jwtSecret, 'utf8')));
exports.adminJwtKey = () => (adminKey ||= crypto.createSecretKey(Buffer.from(config.adminJwtSecret, 'utf8')));
