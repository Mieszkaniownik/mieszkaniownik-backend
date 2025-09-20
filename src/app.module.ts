import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { DatabaseModule } from './database/database.module';
import { OfferModule } from './offer/offer.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [OfferModule,UserModule, DatabaseModule, SchedulerModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
