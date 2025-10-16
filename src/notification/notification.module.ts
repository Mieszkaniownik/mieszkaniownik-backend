import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { EmailHealthController } from './controllers/email-health.controller';
import { DiscordHealthController } from './controllers/discord-health.controller';
import { EmailService } from './services/email.service';
import { DiscordService } from './services/discord.service';
import { NotificationProcessor } from './notification.processor';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [
    NotificationController,
    EmailHealthController,
    DiscordHealthController,
  ],
  providers: [
    NotificationService,
    EmailService,
    DiscordService,
    NotificationProcessor,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
