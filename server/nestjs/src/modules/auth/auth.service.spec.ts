import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

const mockUser = {
  id: 'user-1',
  username: 'alice',
  passwordHash: bcrypt.hashSync('secret', 4),
  isActive: true,
};

const mockUsersService = {
  create: jest.fn(),
  findByPhone: jest.fn(),
  findByUsername: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('creates a user and returns a token', async () => {
      mockUsersService.create.mockResolvedValue(mockUser);
      const dto = { username: 'alice', password: 'secret', phone: '13800000000' } as any;
      const result = await service.register(dto);
      expect(mockUsersService.create).toHaveBeenCalledWith(dto);
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.userId).toBe('user-1');
    });
  });

  describe('login', () => {
    it('issues a token with correct credentials', async () => {
      mockUsersService.findByPhone.mockResolvedValue(mockUser);
      const result = await service.login({ identity: '13800000000', password: 'secret' });
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.username).toBe('alice');
    });

    it('falls back to username lookup when phone lookup returns null', async () => {
      mockUsersService.findByPhone.mockResolvedValue(null);
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      const result = await service.login({ identity: 'alice', password: 'secret' });
      expect(result.userId).toBe('user-1');
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockUsersService.findByPhone.mockResolvedValue(null);
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      await expect(
        service.login({ identity: 'alice', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockUsersService.findByPhone.mockResolvedValue(null);
      mockUsersService.findByUsername.mockResolvedValue(null);
      await expect(
        service.login({ identity: 'ghost', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for inactive user', async () => {
      mockUsersService.findByPhone.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(
        service.login({ identity: '13800000000', password: 'secret' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
