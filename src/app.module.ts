import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OfferModule } from './offer/offer.module';

@Module({
  imports: [OfferModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
