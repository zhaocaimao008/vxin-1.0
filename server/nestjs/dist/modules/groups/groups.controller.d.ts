import { GroupsService } from './groups.service';
export declare class GroupsController {
    private readonly svc;
    constructor(svc: GroupsService);
    mine(req: any): Promise<import("./entities/group.entity").Group[]>;
    create(req: any, dto: {
        name: string;
    }): Promise<import("./entities/group.entity").Group>;
    get(req: any, id: string): Promise<import("./entities/group.entity").Group>;
    update(req: any, id: string, dto: {
        name?: string;
        announcement?: string;
    }): Promise<import("./entities/group.entity").Group>;
    invite(req: any, id: string, dto: {
        userId: string;
    }): Promise<import("./entities/group.entity").GroupMember>;
    leave(req: any, id: string): Promise<void>;
    removeMember(req: any, id: string, userId: string): Promise<void>;
}
