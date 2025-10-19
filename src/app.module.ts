import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AlertModule } from "./alert/alert.module";
import { AnalyseModule } from "./analyse/analyse.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { CoreModule } from "./core/core.module";
import { DatabaseModule } from "./database/database.module";
import { HeatmapModule } from "./heatmap/heatmap.module";
import { MatchModule } from "./match/match.module";
import { NotificationModule } from "./notification/notification.module";
import { OfferModule } from "./offer/offer.module";
import { ScraperModule } from "./scraper/scraper.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number.parseInt(process.env.REDIS_PORT ?? "6379", 10),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    CoreModule,
    DatabaseModule,
    UserModule,
    AuthModule,
    ScraperModule,
    AlertModule,
    AnalyseModule,
    MatchModule,
    NotificationModule,
    HeatmapModule,
    OfferModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
