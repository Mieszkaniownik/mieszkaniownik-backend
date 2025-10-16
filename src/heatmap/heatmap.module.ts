import { Module } from '@nestjs/common';
import { HeatmapController } from './heatmap.controller';
import { HeatmapService } from './heatmap.service';
import { GeocodingService } from './geocoding.service';
import { AnalyzerModule } from '../analyzer/analyzer.module';

@Module({
  imports: [AnalyzerModule],
  controllers: [HeatmapController],
  providers: [HeatmapService, GeocodingService],
  exports: [HeatmapService, GeocodingService],
})
export class HeatmapModule {}
