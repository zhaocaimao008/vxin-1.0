import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { Message, ConversationType, MessageType } from './entities/message.entity';

const makeMsg = (overrides: Partial<Message> = {}): Message =>
  ({
    id: 'msg-1',
    senderId: 'user-1',
    conversationType: ConversationType.PRIVATE,
    conversationId: 'conv-1',
    type: MessageType.TEXT,
    content: 'hello',
    isRecalled: false,
    createdAt: new Date(),
    ...overrides,
  } as Message);

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
};

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: getRepositoryToken(Message), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<MessagesService>(MessagesService);
  });

  describe('send', () => {
    it('creates and returns a message with sender relation', async () => {
      const msg = makeMsg();
      mockRepo.create.mockReturnValue(msg);
      mockRepo.save.mockResolvedValue(msg);
      mockRepo.findOne.mockResolvedValue(msg);

      const dto = {
        conversationType: ConversationType.PRIVATE,
        conversationId: 'conv-1',
        type: MessageType.TEXT,
        content: 'hello',
      };
      const result = await service.send('user-1', dto);
      expect(mockRepo.create).toHaveBeenCalledWith({ senderId: 'user-1', ...dto });
      expect(result.content).toBe('hello');
    });
  });

  describe('recall', () => {
    it('recalls a message within 2 minutes', async () => {
      const msg = makeMsg({ createdAt: new Date() });
      mockRepo.findOne.mockResolvedValue(msg);
      mockRepo.save.mockResolvedValue({ ...msg, isRecalled: true, type: MessageType.RECALL, content: '' });

      const result = await service.recall('user-1', 'msg-1');
      expect(result.isRecalled).toBe(true);
      expect(result.type).toBe(MessageType.RECALL);
    });

    it('throws NotFoundException when message does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.recall('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when recalling another user\'s message', async () => {
      mockRepo.findOne.mockResolvedValue(makeMsg({ senderId: 'user-2' }));
      await expect(service.recall('user-1', 'msg-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when message is older than 2 minutes', async () => {
      const old = new Date(Date.now() - 3 * 60 * 1000);
      mockRepo.findOne.mockResolvedValue(makeMsg({ createdAt: old }));
      await expect(service.recall('user-1', 'msg-1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getHistory', () => {
    it('returns messages in descending order, capped at 100', async () => {
      const msgs = [makeMsg(), makeMsg({ id: 'msg-2' })];
      mockRepo.find.mockResolvedValue(msgs);
      const result = await service.getHistory(ConversationType.PRIVATE, 'conv-1', undefined, 200);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, order: { createdAt: 'DESC' } }),
      );
      expect(result).toHaveLength(2);
    });
  });
});
