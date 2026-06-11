'use strict';
const router = require('express').Router();
const auth = require('../../middleware/auth');
const { uploadCredentialLimiter } = require('../../middleware/rateLimiters');
const c = require('./upload.controller');

/**
 * @swagger
 * /upload/credential:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Get cloud storage upload credentials
 *     description: Get STS credentials for uploading files to cloud storage
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *               fileSize:
 *                 type: integer
 *               fileType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Upload credentials
 *       400:
 *         description: Invalid request
 */
router.post('/credential', auth, uploadCredentialLimiter, c.credential);

module.exports = router;
