import { MessagesService, SendMessageDto } from './messages.service';
import { ConversationType } from './entities/message.entity';
export declare class MessagesController {
    private readonly svc;
    constructor(svc: MessagesService);
    send(req: any, dto: SendMessageDto): Promise<import("./entities/message.entity").Message>;
    history(type: ConversationType, conversationId: string, before?: string, limit?: string): Promise<import("./entities/message.entity").Message[]>;
    recall(req: any, id: string): Promise<import("./entities/message.entity").Message>;
}
