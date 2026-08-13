import { Repository } from 'typeorm';
import { Friendship } from './entities/friendship.entity';
export declare class FriendsService {
    private readonly repo;
    constructor(repo: Repository<Friendship>);
    sendRequest(requesterId: string, addresseeId: string): Promise<Friendship>;
    accept(currentUserId: string, friendshipId: string): Promise<Friendship>;
    decline(currentUserId: string, friendshipId: string): Promise<void>;
    block(currentUserId: string, friendshipId: string): Promise<Friendship>;
    listFriends(userId: string): Promise<Friendship[]>;
    listPending(userId: string): Promise<Friendship[]>;
    areFriends(userA: string, userB: string): Promise<boolean>;
}
