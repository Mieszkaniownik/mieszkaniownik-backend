import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { DiscordHealthController } from "./controllers/discord-health.controller";
import { EmailHealthController } from "./controllers/email-health.controller";
import { NotificationController } from "./notification.controller";
import { NotificationProcessor } from "./notification.processor";
import { NotificationService } from "./notification.service";
import { DiscordService } from "./services/discord.service";
import { EmailService } from "./services/email.service";
import { OAuthRefreshService } from "./services/oauth-refresh.service";

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: "notifications",
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
    OAuthRefreshService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
