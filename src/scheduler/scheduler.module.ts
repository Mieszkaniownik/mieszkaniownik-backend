import { Module } from "@nestjs/common";
import { SchedulerService } from "./scheduler.service";
import { ScrapperModule } from "src/scrapper/scrapper.module";
import { ScheduleModule } from "@nestjs/schedule";
@Module({
    providers: [SchedulerService],
    imports: [
    ScheduleModule.forRoot(), 
    ScrapperModule,
  ],
    exports: [SchedulerService], 

})export class SchedulerModule {}