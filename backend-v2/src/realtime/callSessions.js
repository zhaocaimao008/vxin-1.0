'use strict';

// A user can own media in one direct or group call at a time.
const sessions = new Map();
module.exports = {
  isBusy: userId => sessions.has(userId),
  claim(userId, callId) { sessions.set(userId, callId); },
  release(userId, callId) { if (sessions.get(userId) === callId) sessions.delete(userId); },
};
