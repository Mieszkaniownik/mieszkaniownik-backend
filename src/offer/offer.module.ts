import { Module } from '@nestjs/common';
import { OfferService } from './offer.service';
import { OfferController } from './offer.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [OfferController],
  providers: [OfferService],
  imports: [DatabaseModule], 
  exports: [OfferService], 
})
export class OfferModule {}
