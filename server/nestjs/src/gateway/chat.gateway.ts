import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessagesService, SendMessageDto } from '../modules/messages/messages.service';
import { GroupsService } from '../modules/groups/groups.service';
import { ConversationType } from '../modules/messages/entities/message.entity';

interface AuthSocket extends Socket {
  userId: string;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly messagesService: MessagesService,
    private readonly groupsService: GroupsService,
  ) {}

  async handleConnection(client: AuthSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) { client.disconnect(); return; }

      const payload = this.jwt.verify(token);
      client.userId = payload.sub;

      if (!this.userSockets.has(client.userId)) {
        this.userSockets.set(client.userId, new Set());
      }
      this.userSockets.get(client.userId)!.add(client.id);

      client.join(`user:${client.userId}`);
      this.logger.log(`Connected: ${client.userId} (${client.id})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthSocket) {
    if (client.userId) {
      this.userSockets.get(client.userId)?.delete(client.id);
      if (this.userSockets.get(client.userId)?.size === 0) {
        this.userSockets.delete(client.userId);
      }
      this.logger.log(`Disconnected: ${client.userId} (${client.id})`);
    }
  }

  @SubscribeMessage('join_group')
  async handleJoinGroup(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { groupId: string }) {
    const isMember = await this.groupsService.isMember(data.groupId, client.userId);
    if (!isMember) { client.emit('error', { message: 'Not a group member' }); return; }
    client.join(`group:${data.groupId}`);
    client.emit('joined_group', { groupId: data.groupId });
  }

  @SubscribeMessage('leave_group')
  handleLeaveGroup(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { groupId: string }) {
    client.leave(`group:${data.groupId}`);
  }

  @SubscribeMessage('send_message')
  async handleMessage(@ConnectedSocket() client: AuthSocket, @MessageBody() dto: SendMessageDto) {
    try {
      const message = await this.messagesService.send(client.userId, dto);

      if (dto.conversationType === ConversationType.PRIVATE) {
        this.server.to(`user:${dto.conversationId}`).to(`user:${client.userId}`).emit('new_message', message);
      } else {
        this.server.to(`group:${dto.conversationId}`).emit('new_message', message);
      }

      return { ok: true, message };
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('recall_message')
  async handleRecall(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { messageId: string; conversationType: ConversationType; conversationId: string }) {
    try {
      const message = await this.messagesService.recall(client.userId, data.messageId);
      const room = data.conversationType === ConversationType.PRIVATE
        ? `user:${data.conversationId}`
        : `group:${data.conversationId}`;
      this.server.to(room).to(`user:${client.userId}`).emit('message_recalled', { messageId: data.messageId });
      return { ok: true, message };
    } catch (err) {
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { conversationType: ConversationType; conversationId: string }) {
    const room = data.conversationType === ConversationType.PRIVATE
      ? `user:${data.conversationId}`
      : `group:${data.conversationId}`;
    client.to(room).emit('user_typing', { userId: client.userId, conversationId: data.conversationId });
  }

  notifyUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
