"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const messages_service_1 = require("../modules/messages/messages.service");
const groups_service_1 = require("../modules/groups/groups.service");
const message_entity_1 = require("../modules/messages/entities/message.entity");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    constructor(jwt, messagesService, groupsService) {
        this.jwt = jwt;
        this.messagesService = messagesService;
        this.groupsService = groupsService;
        this.logger = new common_1.Logger(ChatGateway_1.name);
        this.userSockets = new Map();
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token ||
                client.handshake.headers?.authorization?.replace('Bearer ', '');
            if (!token) {
                client.disconnect();
                return;
            }
            const payload = this.jwt.verify(token);
            client.userId = payload.sub;
            if (!this.userSockets.has(client.userId)) {
                this.userSockets.set(client.userId, new Set());
            }
            this.userSockets.get(client.userId).add(client.id);
            client.join(`user:${client.userId}`);
            this.logger.log(`Connected: ${client.userId} (${client.id})`);
        }
        catch {
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        if (client.userId) {
            this.userSockets.get(client.userId)?.delete(client.id);
            if (this.userSockets.get(client.userId)?.size === 0) {
                this.userSockets.delete(client.userId);
            }
            this.logger.log(`Disconnected: ${client.userId} (${client.id})`);
        }
    }
    async handleJoinGroup(client, data) {
        const isMember = await this.groupsService.isMember(data.groupId, client.userId);
        if (!isMember) {
            client.emit('error', { message: 'Not a group member' });
            return;
        }
        client.join(`group:${data.groupId}`);
        client.emit('joined_group', { groupId: data.groupId });
    }
    handleLeaveGroup(client, data) {
        client.leave(`group:${data.groupId}`);
    }
    async handleMessage(client, dto) {
        try {
            const message = await this.messagesService.send(client.userId, dto);
            if (dto.conversationType === message_entity_1.ConversationType.PRIVATE) {
                this.server.to(`user:${dto.conversationId}`).to(`user:${client.userId}`).emit('new_message', message);
            }
            else {
                this.server.to(`group:${dto.conversationId}`).emit('new_message', message);
            }
            return { ok: true, message };
        }
        catch (err) {
            client.emit('error', { message: err.message });
        }
    }
    async handleRecall(client, data) {
        try {
            const message = await this.messagesService.recall(client.userId, data.messageId);
            const room = data.conversationType === message_entity_1.ConversationType.PRIVATE
                ? `user:${data.conversationId}`
                : `group:${data.conversationId}`;
            this.server.to(room).to(`user:${client.userId}`).emit('message_recalled', { messageId: data.messageId });
            return { ok: true, message };
        }
        catch (err) {
            client.emit('error', { message: err.message });
        }
    }
    handleTyping(client, data) {
        const room = data.conversationType === message_entity_1.ConversationType.PRIVATE
            ? `user:${data.conversationId}`
            : `group:${data.conversationId}`;
        client.to(room).emit('user_typing', { userId: client.userId, conversationId: data.conversationId });
    }
    notifyUser(userId, event, payload) {
        this.server.to(`user:${userId}`).emit(event, payload);
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_group'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleJoinGroup", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave_group'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleLeaveGroup", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('send_message'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('recall_message'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleRecall", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleTyping", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*', credentials: true },
        namespace: '/chat',
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        messages_service_1.MessagesService,
        groups_service_1.GroupsService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map