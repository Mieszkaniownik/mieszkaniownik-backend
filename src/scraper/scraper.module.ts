import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperService } from './scraper.service';
import { ScraperProcessor } from './scraper.processor';
import { ScraperController } from './scraper.controller';
import { ScraperThreadManagerService } from './services/scraper-thread-manager.service';
import { aiAddressExtractorService } from './services/ai-address-extractor.service';
import { BrowserSetupService } from './services/browser-setup.service';
import { ParameterParserService } from './services/parameter-parser.service';
import { OtodomAuthService } from './services/otodom-auth.service';
import { ScraperOfferMapperService } from './services/scraper-offer-mapper.service';
import { ScraperGeocodingService } from './services/scraper-geocoding.service';
import { BaseScraperService } from './services/base-scraper.service';
import { OlxScraperService } from './services/olx-scraper.service';
import { OtodomScraperService } from './services/otodom-scraper.service';
import { OlxExistingProcessor } from './processors/olx-existing.processor';
import { OtodomExistingProcessor } from './processors/otodom-existing.processor';
import { OlxNewProcessor } from './processors/olx-new.processor';
import { OtodomNewProcessor } from './processors/otodom-new.processor';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { MatchModule } from '../match/match.module';
import { HeatmapModule } from '../heatmap/heatmap.module';
import { OfferModule } from '../offer/offer.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: 'olx-existing',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    BullModule.registerQueue({
      name: 'otodom-existing',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    BullModule.registerQueue({
      name: 'olx-new',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    BullModule.registerQueue({
      name: 'otodom-new',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    DatabaseModule,
    AuthModule,
    MatchModule,
    HeatmapModule,
    OfferModule,
  ],
  controllers: [ScraperController],
  providers: [
    ScraperService,
    ScraperProcessor,
    ScraperThreadManagerService,
    aiAddressExtractorService,
    BrowserSetupService,
    ParameterParserService,
    OtodomAuthService,
    ScraperOfferMapperService,
    ScraperGeocodingService,
    BaseScraperService,
    OlxScraperService,
    OtodomScraperService,
    OlxExistingProcessor,
    OtodomExistingProcessor,
    OlxNewProcessor,
    OtodomNewProcessor,
  ],
  exports: [
    ScraperService,
    ScraperThreadManagerService,
    aiAddressExtractorService,
    OtodomAuthService,
    ScraperGeocodingService,
  ],
})
export class ScraperModule {}
