import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly users;
    private readonly jwt;
    constructor(users: UsersService, jwt: JwtService);
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        userId: string;
        username: string;
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        userId: string;
        username: string;
    }>;
    private issueToken;
}
