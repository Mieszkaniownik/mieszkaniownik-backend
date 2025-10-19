import { Injectable, Logger } from "@nestjs/common";

import { AnalyseService } from "../analyse/analyse.service";
import type { AnalyseQueryDto } from "../analyse/dto/analyse-query.dto";
import type {
  HeatmapData,
  HeatmapPoint,
  HeatmapQuery,
} from "./dto/heatmap.interface";

@Injectable()
export class HeatmapService {
  private readonly logger = new Logger(HeatmapService.name);

  constructor(private readonly analyseService: AnalyseService) {}

  async generateHeatmapData(
    query: HeatmapQuery = {},
    userId?: number,
  ): Promise<HeatmapData> {
    this.logger.log("Generating heatmap data with query:", query);
    this.logger.log(`Applied limit: ${String(Number(query.limit) || 5000)}`);

    const analyzedData = await this.analyseService.analyseOffers(
      query as unknown as AnalyseQueryDto,
      userId,
    );

    this.logger.log(
      `Analyse returned ${String(analyzedData.offers.length)} offers for heatmap`,
    );

    if (analyzedData.offers.length === 0) {
      return {
        points: [],
        avgViews: 0,
        minViews: 0,
        totalOffers: 0,
        avgViewsPerDay: 0,
        maxViewsPerDay: 0,
        minViewsPerDay: 0,
      };
    }

    const points: HeatmapPoint[] = analyzedData.offers.map((offer) => ({
      lat: offer.latitude,
      lng: offer.longitude,
      intensity: offer.normalizedIntensity,
      weight: offer.views,
      offerId: offer.id,
      matchId: offer.matchId,
      title: offer.title,
      price: offer.price,
      footage: offer.footage,
      pricePerSqm: offer.pricePerSqm,
      offerDensity: offer.offerDensity,
      viewsPerDay: offer.viewsPerDay,
      address: (() => {
        if (offer.street !== undefined && offer.streetNumber !== undefined) {
          return `${offer.street} ${offer.streetNumber}`;
        }
        return offer.district ?? offer.city;
      })(),
      images: offer.images,
      link: offer.link,
    }));

    this.logger.log(
      `Generated ${String(points.length)} heatmap points from analyzed data`,
    );

    return {
      points,
      avgViews: analyzedData.stats.avgViews,
      minViews: analyzedData.stats.minViews,
      totalOffers: analyzedData.stats.totalOffers,
      maxPricePerSqm: analyzedData.stats.maxPricePerSqm,
      minPricePerSqm: analyzedData.stats.minPricePerSqm,
      avgPricePerSqm: analyzedData.stats.avgPricePerSqm,
      maxDensity: analyzedData.stats.maxDensity,
      minDensity: analyzedData.stats.minDensity,
      avgDensity: analyzedData.stats.avgDensity,
      maxFootage: analyzedData.stats.maxFootage,
      minFootage: analyzedData.stats.minFootage,
      avgFootage: analyzedData.stats.avgFootage,
      avgViewsPerDay: analyzedData.stats.avgViewsPerDay,
      maxViewsPerDay: analyzedData.stats.maxViewsPerDay,
      minViewsPerDay: analyzedData.stats.minViewsPerDay,
      bounds: analyzedData.stats.bounds,
    };
  }

  async getHeatmapStats(userId?: number) {
    return this.analyseService.getDataAvailabilityStats(userId);
  }
}
