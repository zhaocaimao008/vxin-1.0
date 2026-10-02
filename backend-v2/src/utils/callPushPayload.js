'use strict';

// FCM, Getui and PushKit must agree on the invitation route. Group calls
// require conversationId; they cannot be answered with call:response.
module.exports = function callPushPayload({ callId, from, callerName, callType, conversationId }) {
  return {
    type: conversationId ? 'group_call' : 'call',
    callId: String(callId || ''),
    from: String(from || ''),
    callerName: String(callerName || ''),
    callType: callType === 'video' ? 'video' : 'audio',
    ...(conversationId ? { conversationId: String(conversationId) } : {}),
  };
};
