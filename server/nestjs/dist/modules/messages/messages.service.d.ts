import { Repository } from 'typeorm';
import { Message, ConversationType, MessageType } from './entities/message.entity';
export interface SendMessageDto {
    conversationType: ConversationType;
    conversationId: string;
    type: MessageType;
    content: string;
    extra?: Record<string, unknown>;
    replyToId?: string;
}
export declare class MessagesService {
    private readonly repo;
    constructor(repo: Repository<Message>);
    send(senderId: string, dto: SendMessageDto): Promise<Message>;
    getHistory(conversationType: ConversationType, conversationId: string, before?: Date, limit?: number): Promise<Message[]>;
    recall(userId: string, messageId: string): Promise<Message>;
    getUnread(userId: string, since: Date): Promise<Message[]>;
}
