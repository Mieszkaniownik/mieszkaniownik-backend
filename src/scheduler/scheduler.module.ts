import { Module } from "@nestjs/common";
import { SchedulerService } from "./scheduler.service";
import { ScrapperModule } from "src/scrapper/scrapper.module";
import { ScheduleModule } from "@nestjs/schedule";
import { OfferModule } from "src/offer/offer.module";
@Module({
    providers: [SchedulerService],
    imports: [
    ScheduleModule.forRoot(), 
    ScrapperModule,
    OfferModule,
  ],
    exports: [SchedulerService], 

})export class SchedulerModule {}