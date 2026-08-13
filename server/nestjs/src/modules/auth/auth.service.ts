import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.users.create(dto);
    return this.issueToken(user.id, user.username);
  }

  async login(dto: LoginDto) {
    const user =
      (await this.users.findByPhone(dto.identity)) ??
      (await this.users.findByUsername(dto.identity));

    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueToken(user.id, user.username);
  }

  private issueToken(userId: string, username: string) {
    const payload = { sub: userId, username };
    return {
      accessToken: this.jwt.sign(payload),
      userId,
      username,
    };
  }
}
