import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { HeatmapModule } from "../heatmap/heatmap.module";
import { MatchModule } from "../match/match.module";
import { OfferModule } from "../offer/offer.module";
import { OlxExistingProcessor } from "./processors/olx-existing.processor";
import { OlxNewProcessor } from "./processors/olx-new.processor";
import { OtodomExistingProcessor } from "./processors/otodom-existing.processor";
import { OtodomNewProcessor } from "./processors/otodom-new.processor";
import { ScraperController } from "./scraper.controller";
import { ScraperProcessor } from "./scraper.processor";
import { ScraperService } from "./scraper.service";
import { aiAddressExtractorService } from "./services/ai-address-extractor.service";
import { BaseScraperService } from "./services/base-scraper.service";
import { BrowserSetupService } from "./services/browser-setup.service";
import { OlxScraperService } from "./services/olx-scraper.service";
import { OtodomAuthService } from "./services/otodom-auth.service";
import { OtodomScraperService } from "./services/otodom-scraper.service";
import { ParameterParserService } from "./services/parameter-parser.service";
import { ScraperGeocodingService } from "./services/scraper-geocoding.service";
import { ScraperOfferMapperService } from "./services/scraper-offer-mapper.service";
import { ScraperThreadManagerService } from "./services/scraper-thread-manager.service";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: "olx-existing",
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    BullModule.registerQueue({
      name: "otodom-existing",
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    BullModule.registerQueue({
      name: "olx-new",
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    BullModule.registerQueue({
      name: "otodom-new",
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
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
