import { UsersService } from './users.service';
export declare class UsersController {
    private readonly svc;
    constructor(svc: UsersService);
    getMe(req: any): Promise<import("./entities/user.entity").User>;
    search(q: string, req: any): Promise<import("./entities/user.entity").User[]>;
    getUser(id: string): Promise<import("./entities/user.entity").User>;
    updateMe(req: any, dto: {
        nickname?: string;
        bio?: string;
        gender?: number;
    }): Promise<import("./entities/user.entity").User>;
}
