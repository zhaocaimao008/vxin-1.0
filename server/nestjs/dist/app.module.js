"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const schedule_1 = require("@nestjs/schedule");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const friends_module_1 = require("./modules/friends/friends.module");
const groups_module_1 = require("./modules/groups/groups.module");
const messages_module_1 = require("./modules/messages/messages.module");
const files_module_1 = require("./modules/files/files.module");
const moments_module_1 = require("./modules/moments/moments.module");
const gateway_module_1 = require("./gateway/gateway.module");
const media_processor_1 = require("./queue/media.processor");
const push_processor_1 = require("./queue/push.processor");
const ai_processor_1 = require("./queue/ai.processor");
const scheduler_service_1 = require("./queue/scheduler.service");
const message_entity_1 = require("./modules/messages/entities/message.entity");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
            schedule_1.ScheduleModule.forRoot(),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (cfg) => ({
                    type: 'postgres',
                    host: cfg.get('DB_HOST', 'localhost'),
                    port: cfg.get('DB_PORT', 5432),
                    username: cfg.get('DB_USERNAME', 'vxin'),
                    password: cfg.get('DB_PASSWORD', 'changeme'),
                    database: cfg.get('DB_DATABASE', 'vxin'),
                    autoLoadEntities: true,
                    synchronize: cfg.get('NODE_ENV') !== 'production',
                    logging: cfg.get('NODE_ENV') === 'development',
                }),
            }),
            typeorm_1.TypeOrmModule.forFeature([message_entity_1.Message]),
            bullmq_1.BullModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (cfg) => ({
                    connection: {
                        host: cfg.get('REDIS_HOST', 'localhost'),
                        port: cfg.get('REDIS_PORT', 6379),
                        password: cfg.get('REDIS_PASSWORD') || undefined,
                    },
                }),
            }),
            bullmq_1.BullModule.registerQueue({ name: 'media' }, { name: 'push' }, { name: 'ai' }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            friends_module_1.FriendsModule,
            groups_module_1.GroupsModule,
            messages_module_1.MessagesModule,
            files_module_1.FilesModule,
            moments_module_1.MomentsModule,
            gateway_module_1.GatewayModule,
        ],
        providers: [media_processor_1.MediaProcessor, push_processor_1.PushProcessor, ai_processor_1.AiProcessor, scheduler_service_1.SchedulerService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map