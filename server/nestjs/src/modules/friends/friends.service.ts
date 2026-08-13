import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Or, Equal } from 'typeorm';
import { Friendship, FriendshipStatus } from './entities/friendship.entity';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friendship) private readonly repo: Repository<Friendship>,
  ) {}

  async sendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    if (requesterId === addresseeId) throw new BadRequestException('Cannot add yourself');

    const existing = await this.repo.findOne({
      where: [
        { requesterId, addresseeId },
        { requesterId: addresseeId, addresseeId: requesterId },
      ],
    });
    if (existing) throw new ConflictException('Friend request already exists');

    const f = this.repo.create({ requesterId, addresseeId, status: FriendshipStatus.PENDING });
    return this.repo.save(f);
  }

  async accept(currentUserId: string, friendshipId: string): Promise<Friendship> {
    const f = await this.repo.findOne({ where: { id: friendshipId, addresseeId: currentUserId } });
    if (!f) throw new NotFoundException('Friend request not found');
    if (f.status !== FriendshipStatus.PENDING) throw new BadRequestException('Request already handled');

    f.status = FriendshipStatus.ACCEPTED;
    return this.repo.save(f);
  }

  async decline(currentUserId: string, friendshipId: string): Promise<void> {
    const f = await this.repo.findOne({ where: { id: friendshipId, addresseeId: currentUserId } });
    if (!f) throw new NotFoundException('Friend request not found');
    await this.repo.remove(f);
  }

  async block(currentUserId: string, friendshipId: string): Promise<Friendship> {
    const f = await this.repo.findOne({
      where: [
        { id: friendshipId, requesterId: currentUserId },
        { id: friendshipId, addresseeId: currentUserId },
      ],
    });
    if (!f) throw new NotFoundException('Friendship not found');
    f.status = FriendshipStatus.BLOCKED;
    return this.repo.save(f);
  }

  async listFriends(userId: string): Promise<Friendship[]> {
    return this.repo.find({
      where: [
        { requesterId: userId, status: FriendshipStatus.ACCEPTED },
        { addresseeId: userId, status: FriendshipStatus.ACCEPTED },
      ],
    });
  }

  async listPending(userId: string): Promise<Friendship[]> {
    return this.repo.find({ where: { addresseeId: userId, status: FriendshipStatus.PENDING } });
  }

  async areFriends(userA: string, userB: string): Promise<boolean> {
    const f = await this.repo.findOne({
      where: [
        { requesterId: userA, addresseeId: userB, status: FriendshipStatus.ACCEPTED },
        { requesterId: userB, addresseeId: userA, status: FriendshipStatus.ACCEPTED },
      ],
    });
    return !!f;
  }
}
