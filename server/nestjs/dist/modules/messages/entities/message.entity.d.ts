import { User } from '../../users/entities/user.entity';
export declare enum MessageType {
    TEXT = "text",
    IMAGE = "image",
    VOICE = "voice",
    VIDEO = "video",
    FILE = "file",
    LOCATION = "location",
    RECALL = "recall"
}
export declare enum ConversationType {
    PRIVATE = "private",
    GROUP = "group"
}
export declare class Message {
    id: string;
    senderId: string;
    sender: User;
    conversationType: ConversationType;
    conversationId: string;
    type: MessageType;
    content: string;
    extra: Record<string, unknown>;
    replyToId: string;
    isRecalled: boolean;
    createdAt: Date;
}
