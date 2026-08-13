import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessagesService, SendMessageDto } from '../modules/messages/messages.service';
import { GroupsService } from '../modules/groups/groups.service';
import { ConversationType } from '../modules/messages/entities/message.entity';
interface AuthSocket extends Socket {
    userId: string;
}
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwt;
    private readonly messagesService;
    private readonly groupsService;
    server: Server;
    private readonly logger;
    private readonly userSockets;
    constructor(jwt: JwtService, messagesService: MessagesService, groupsService: GroupsService);
    handleConnection(client: AuthSocket): Promise<void>;
    handleDisconnect(client: AuthSocket): void;
    handleJoinGroup(client: AuthSocket, data: {
        groupId: string;
    }): Promise<void>;
    handleLeaveGroup(client: AuthSocket, data: {
        groupId: string;
    }): void;
    handleMessage(client: AuthSocket, dto: SendMessageDto): Promise<{
        ok: boolean;
        message: import("../modules/messages/entities/message.entity").Message;
    } | undefined>;
    handleRecall(client: AuthSocket, data: {
        messageId: string;
        conversationType: ConversationType;
        conversationId: string;
    }): Promise<{
        ok: boolean;
        message: import("../modules/messages/entities/message.entity").Message;
    } | undefined>;
    handleTyping(client: AuthSocket, data: {
        conversationType: ConversationType;
        conversationId: string;
    }): void;
    notifyUser(userId: string, event: string, payload: unknown): void;
}
export {};
