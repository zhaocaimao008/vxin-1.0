import { FriendsService } from './friends.service';
export declare class FriendsController {
    private readonly svc;
    constructor(svc: FriendsService);
    list(req: any): Promise<import("./entities/friendship.entity").Friendship[]>;
    pending(req: any): Promise<import("./entities/friendship.entity").Friendship[]>;
    sendRequest(req: any, dto: {
        addresseeId: string;
    }): Promise<import("./entities/friendship.entity").Friendship>;
    accept(req: any, id: string): Promise<import("./entities/friendship.entity").Friendship>;
    decline(req: any, id: string): Promise<void>;
    block(req: any, id: string): Promise<import("./entities/friendship.entity").Friendship>;
}
