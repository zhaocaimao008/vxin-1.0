import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../modules/messages/messages.module';
import { GroupsModule } from '../modules/groups/groups.module';

@Module({
  imports: [
    MessagesModule,
    GroupsModule,
    JwtModule.register({ secret: process.env.JWT_SECRET || 'change_me' }),
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewayModule {}
