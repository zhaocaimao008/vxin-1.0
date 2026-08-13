import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly svc;
    constructor(svc: AuthService);
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
}
