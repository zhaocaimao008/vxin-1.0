import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
export declare class UsersService {
    private readonly repo;
    constructor(repo: Repository<User>);
    findById(id: string): Promise<User>;
    findByPhone(phone: string): Promise<User | null>;
    findByUsername(username: string): Promise<User | null>;
    create(data: {
        phone: string;
        username: string;
        nickname: string;
        password: string;
    }): Promise<User>;
    updateProfile(id: string, dto: Partial<Pick<User, 'nickname' | 'avatar' | 'bio' | 'gender'>>): Promise<User>;
    setOnline(id: string, online: boolean): Promise<void>;
    searchUsers(query: string, currentUserId: string): Promise<User[]>;
}
