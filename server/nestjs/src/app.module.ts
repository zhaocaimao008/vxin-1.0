import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FriendsModule } from './modules/friends/friends.module';
import { GroupsModule } from './modules/groups/groups.module';
import { MessagesModule } from './modules/messages/messages.module';
import { FilesModule } from './modules/files/files.module';
import { MomentsModule } from './modules/moments/moments.module';
import { GatewayModule } from './gateway/gateway.module';
import { MediaProcessor } from './queue/media.processor';
import { PushProcessor } from './queue/push.processor';
import { AiProcessor } from './queue/ai.processor';
import { SchedulerService } from './queue/scheduler.service';
import { Message } from './modules/messages/entities/message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5432),
        username: cfg.get('DB_USERNAME', 'vxin'),
        password: cfg.get('DB_PASSWORD', 'changeme'),
        database: cfg.get('DB_DATABASE', 'vxin'),
        autoLoadEntities: true,
        synchronize: cfg.get('NODE_ENV') !== 'production',
        logging: cfg.get('NODE_ENV') === 'development',
      }),
    }),

    TypeOrmModule.forFeature([Message]),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get('REDIS_HOST', 'localhost'),
          port: cfg.get<number>('REDIS_PORT', 6379),
          password: cfg.get('REDIS_PASSWORD') || undefined,
        },
      }),
    }),

    BullModule.registerQueue(
      { name: 'media' },
      { name: 'push' },
      { name: 'ai' },
    ),

    AuthModule,
    UsersModule,
    FriendsModule,
    GroupsModule,
    MessagesModule,
    FilesModule,
    MomentsModule,
    GatewayModule,
  ],
  providers: [MediaProcessor, PushProcessor, AiProcessor, SchedulerService],
})
export class AppModule {}
