import { Module } from "@nestjs/common";

import { AnalyseModule } from "../analyse/analyse.module";
import { GeocodingService } from "./geocoding.service";
import { HeatmapController } from "./heatmap.controller";
import { HeatmapService } from "./heatmap.service";

@Module({
  imports: [AnalyseModule],
  controllers: [HeatmapController],
  providers: [HeatmapService, GeocodingService],
  exports: [HeatmapService, GeocodingService],
})
export class HeatmapModule {}
