'use strict';
/**
 * WebRTC 1对1 通话信令转发（纯转发，服务端不参与媒体）。
 */
module.exports = function registerCallHandler(io, socket) {
  const userId = socket.user.id;
  socket.on('call:request',  ({ to, type, caller }) => io.to(`user_${to}`).emit('call:incoming', { from: userId, type, caller }));
  socket.on('call:response', ({ to, accepted })     => io.to(`user_${to}`).emit('call:response', { from: userId, accepted }));
  socket.on('call:offer',    ({ to, offer })        => io.to(`user_${to}`).emit('call:offer',    { from: userId, offer }));
  socket.on('call:answer',   ({ to, answer })       => io.to(`user_${to}`).emit('call:answer',   { from: userId, answer }));
  socket.on('call:ice',      ({ to, candidate })    => io.to(`user_${to}`).emit('call:ice',      { from: userId, candidate }));
  socket.on('call:end',      ({ to })               => io.to(`user_${to}`).emit('call:end',      { from: userId }));
};
