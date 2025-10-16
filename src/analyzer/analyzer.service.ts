import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AnalyzerQueryDto } from './dto/analyzer-query.dto';
import {
  AnalyzedData,
  AnalyzedOffer,
  AnalysisStats,
  DataAvailabilityStats,
} from './dto/analyzed-data.interface';
import type { Offer } from '@prisma/client';

@Injectable()
export class AnalyzerService {
  private readonly logger = new Logger(AnalyzerService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async analyzeOffers(
    query: AnalyzerQueryDto = {},
    userId?: number,
  ): Promise<AnalyzedData> {
    this.logger.log('Starting offer analysis with query:', query);

    const limit = Number(query.limit) || 5000;
    const isUserSpecific = !!userId;

    if (isUserSpecific) {
      this.logger.log(`Analyzing offers for user ${userId} matches`);
      return this.analyzeUserMatches(query, userId as number, limit);
    }

    return this.analyzeGeneralOffers(query, limit);
  }

  async getDataAvailabilityStats(
    userId?: number,
  ): Promise<DataAvailabilityStats> {
    if (userId) {
      return this.getUserMatchesAvailability(userId);
    }

    const totalOffers = await this.databaseService.offer.count({
      where: { available: true },
    });

    const offersWithViews = await this.databaseService.offer.count({
      where: { available: true, views: { gt: 0 } },
    });

    const offersWithAddresses = await this.databaseService.offer.count({
      where: {
        available: true,
        OR: [{ street: { not: '' } }, { district: { not: '' } }],
      },
    });

    const offersWithCoordinates = await this.databaseService.offer.count({
      where: {
        available: true,
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    const offersWithFootage = await this.databaseService.offer.count({
      where: {
        available: true,
        footage: { not: null, gt: 0 },
      },
    });

    const offersWithPrice = await this.databaseService.offer.count({
      where: {
        available: true,
        price: { gt: 0 },
      },
    });

    const viewsStats = await this.databaseService.offer.aggregate({
      where: { available: true, views: { gt: 0 } },
      _avg: { views: true },
      _max: { views: true },
      _min: { views: true },
    });

    return {
      totalOffers,
      offersWithViews,
      offersWithAddresses,
      offersWithCoordinates,
      offersWithFootage,
      offersWithPrice,
      viewsStats: {
        average: viewsStats._avg.views || 0,
        maximum: viewsStats._max.views || 0,
        minimum: viewsStats._min.views || 0,
      },
    };
  }

  private async analyzeGeneralOffers(
    query: AnalyzerQueryDto,
    limit: number,
  ): Promise<AnalyzedData> {
    const whereClause = this.buildOfferWhereClause(query);

    const offers = await this.databaseService.offer.findMany({
      where: {
        ...whereClause,
        available: true,
        views: { gt: 0 },
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    this.logger.log(`Found ${offers.length} offers matching criteria`);

    if (offers.length === 0) {
      return this.createEmptyAnalyzedData(query, false);
    }

    const analyzedOffers = this.processOffers(offers);
    const stats = this.calculateStats(analyzedOffers);

    return {
      offers: analyzedOffers,
      stats,
      query: {
        filters: query,
        limit,
        isUserSpecific: false,
      },
    };
  }

  private async analyzeUserMatches(
    query: AnalyzerQueryDto,
    userId: number,
    limit: number,
  ): Promise<AnalyzedData> {
    const offerWhereClause = this.buildOfferWhereClause(query);

    const alertWhereClause: { userId: number; id?: number } = { userId };
    if (query.alertId) {
      alertWhereClause.id = query.alertId;
      this.logger.log(`Filtering matches for alert ${query.alertId}`);
    }

    const matches = await this.databaseService.match.findMany({
      where: {
        alert: alertWhereClause,
        offer: {
          ...offerWhereClause,
          available: true,
          latitude: { not: null },
          longitude: { not: null },
        },
      },
      include: {
        offer: true,
      },
      orderBy: {
        matchedAt: 'desc',
      },
      take: limit,
    });

    this.logger.log(`Found ${matches.length} matches for user ${userId}`);

    if (matches.length === 0) {
      return this.createEmptyAnalyzedData(query, true, userId, query.alertId);
    }

    const offerIdToMatchId = new Map<number, number>();
    matches.forEach((match) => {
      offerIdToMatchId.set(match.offer.id, match.id);
    });

    const offers = matches
      .map((match) => match.offer)
      .filter(
        (offer) =>
          offer.available &&
          offer.latitude !== null &&
          offer.longitude !== null,
      );

    const analyzedOffers = this.processOffers(offers, offerIdToMatchId);
    const stats = this.calculateStats(analyzedOffers);

    return {
      offers: analyzedOffers,
      stats,
      query: {
        filters: query,
        limit,
        isUserSpecific: true,
        userId,
        alertId: query.alertId,
      },
    };
  }

  private processOffers(
    offers: Offer[],
    matchIdMap?: Map<number, number>,
  ): AnalyzedOffer[] {
    const viewsPerDayList = offers.map((offer) =>
      this.calculateViewsPerDay(offer.views, offer.createdAt),
    );
    const maxViewsPerDay = Math.max(...viewsPerDayList);
    const minViewsPerDay = Math.min(...viewsPerDayList);

    const densityMap = this.calculateDensity(offers);

    return offers
      .map((offer, index) => {
        if (offer.latitude === null || offer.longitude === null) {
          return null;
        }

        const viewsPerDay = this.calculateViewsPerDay(
          offer.views,
          offer.createdAt,
        );

        const normalizedIntensity =
          maxViewsPerDay > minViewsPerDay
            ? (viewsPerDay - minViewsPerDay) / (maxViewsPerDay - minViewsPerDay)
            : 1;

        const pricePerSqm =
          offer.price && offer.footage && Number(offer.footage) > 0
            ? Number(offer.price) / Number(offer.footage)
            : undefined;

        const analyzed: AnalyzedOffer = {
          id: offer.id,
          title: offer.title,
          price: offer.price ? Number(offer.price) : undefined,
          views: offer.views,
          latitude: Number(offer.latitude),
          longitude: Number(offer.longitude),
          createdAt: offer.createdAt,
          footage: offer.footage ? Number(offer.footage) : undefined,
          rooms: offer.rooms || undefined,
          street: offer.street || undefined,
          streetNumber: offer.streetNumber || undefined,
          district: offer.district || undefined,
          city: offer.city || undefined,
          images: offer.images || [],
          link: offer.link,
          viewsPerDay,
          pricePerSqm,
          offerDensity: densityMap.get(index) || 1,
          normalizedIntensity: Math.max(0.1, normalizedIntensity),
          matchId: matchIdMap?.get(offer.id),
        };

        return analyzed;
      })
      .filter((offer): offer is AnalyzedOffer => offer !== null);
  }

  private calculateStats(offers: AnalyzedOffer[]): AnalysisStats {
    if (offers.length === 0) {
      return this.createEmptyStats();
    }

    const viewsCounts = offers.map((o) => o.views);
    const avgViews =
      viewsCounts.reduce((sum, val) => sum + val, 0) / viewsCounts.length;
    const minViews = Math.min(...viewsCounts);
    const maxViews = Math.max(...viewsCounts);

    const viewsPerDayList = offers.map((o) => o.viewsPerDay);
    const avgViewsPerDay =
      viewsPerDayList.reduce((sum, val) => sum + val, 0) /
      viewsPerDayList.length;
    const minViewsPerDay = Math.min(...viewsPerDayList);
    const maxViewsPerDay = Math.max(...viewsPerDayList);

    const pricesPerSqm = offers
      .map((o) => o.pricePerSqm)
      .filter((p): p is number => p !== undefined);
    const avgPricePerSqm =
      pricesPerSqm.length > 0
        ? pricesPerSqm.reduce((sum, val) => sum + val, 0) / pricesPerSqm.length
        : undefined;
    const minPricePerSqm =
      pricesPerSqm.length > 0 ? Math.min(...pricesPerSqm) : undefined;
    const maxPricePerSqm =
      pricesPerSqm.length > 0 ? Math.max(...pricesPerSqm) : undefined;

    const densityCounts = offers.map((o) => o.offerDensity);
    const avgDensity =
      densityCounts.reduce((sum, val) => sum + val, 0) / densityCounts.length;
    const minDensity = Math.min(...densityCounts);
    const maxDensity = Math.max(...densityCounts);

    const footages = offers
      .map((o) => o.footage)
      .filter((f): f is number => f !== undefined);
    const avgFootage =
      footages.length > 0
        ? footages.reduce((sum, val) => sum + val, 0) / footages.length
        : undefined;
    const minFootage = footages.length > 0 ? Math.min(...footages) : undefined;
    const maxFootage = footages.length > 0 ? Math.max(...footages) : undefined;

    const bounds = {
      north: Math.max(...offers.map((o) => o.latitude)),
      south: Math.min(...offers.map((o) => o.latitude)),
      east: Math.max(...offers.map((o) => o.longitude)),
      west: Math.min(...offers.map((o) => o.longitude)),
    };

    return {
      totalOffers: offers.length,
      avgViews,
      minViews,
      maxViews,
      avgViewsPerDay,
      minViewsPerDay,
      maxViewsPerDay,
      avgPricePerSqm,
      minPricePerSqm,
      maxPricePerSqm,
      avgDensity,
      minDensity,
      maxDensity,
      avgFootage,
      minFootage,
      maxFootage,
      bounds,
    };
  }

  private calculateViewsPerDay(views: number, createdAt: Date): number {
    const now = new Date();
    const offerAgeInMs = now.getTime() - createdAt.getTime();
    const offerAgeInDays = offerAgeInMs / (1000 * 60 * 60 * 24);
    const daysForCalculation = Math.max(offerAgeInDays, 0.1);
    return views / daysForCalculation;
  }

  private calculateDensity(offers: Offer[]): Map<number, number> {
    const densityRadius = 0.01; // ~1km in degrees
    const densityMap = new Map<number, number>();

    offers.forEach((offer, index) => {
      if (offer.latitude === null || offer.longitude === null) {
        densityMap.set(index, 0);
        return;
      }

      const lat = Number(offer.latitude);
      const lng = Number(offer.longitude);
      let nearbyCount = 0;

      offers.forEach((otherOffer) => {
        if (otherOffer.latitude === null || otherOffer.longitude === null) {
          return;
        }

        const otherLat = Number(otherOffer.latitude);
        const otherLng = Number(otherOffer.longitude);

        const distance = Math.sqrt(
          Math.pow(lat - otherLat, 2) + Math.pow(lng - otherLng, 2),
        );

        if (distance <= densityRadius) {
          nearbyCount++;
        }
      });

      densityMap.set(index, nearbyCount);
    });

    return densityMap;
  }

  private buildOfferWhereClause(query: AnalyzerQueryDto): Record<string, any> {
    const where: Record<string, any> = {};

    if (query.city) {
      where.city = {
        contains: query.city,
        mode: 'insensitive',
      };
    }

    if (query.district) {
      where.district = {
        contains: query.district,
        mode: 'insensitive',
      };
    }

    if (query.minPrice || query.maxPrice) {
      const priceFilter: Record<string, any> = {};
      if (query.minPrice) priceFilter.gte = query.minPrice;
      if (query.maxPrice) priceFilter.lte = query.maxPrice;
      where.price = priceFilter;
    }

    if (query.minViews || query.maxViews) {
      const viewsFilter: Record<string, any> = {};
      if (query.minViews) viewsFilter.gte = query.minViews;
      if (query.maxViews) viewsFilter.lte = query.maxViews;
      where.views = viewsFilter;
    }

    if (query.buildingType) {
      where.buildingType = query.buildingType;
    }

    if (query.minFootage || query.maxFootage) {
      const footageFilter: Record<string, any> = {};
      if (query.minFootage) footageFilter.gte = query.minFootage;
      if (query.maxFootage) footageFilter.lte = query.maxFootage;
      where.footage = footageFilter;
    }

    if (query.minRooms || query.maxRooms) {
      const roomsFilter: Record<string, any> = {};
      if (query.minRooms) roomsFilter.gte = query.minRooms;
      if (query.maxRooms) roomsFilter.lte = query.maxRooms;
      where.rooms = roomsFilter;
    }

    if (query.minPricePerSqm || query.maxPricePerSqm) {
      const andConditions = (where.AND as any[]) || [];
      andConditions.push({
        price: { gt: 0 },
        footage: { gt: 0 },
      });
      where.AND = andConditions;
    }

    return where;
  }

  private createEmptyAnalyzedData(
    query: AnalyzerQueryDto,
    isUserSpecific: boolean,
    userId?: number,
    alertId?: number,
  ): AnalyzedData {
    return {
      offers: [],
      stats: this.createEmptyStats(),
      query: {
        filters: query,
        limit: Number(query.limit) || 5000,
        isUserSpecific,
        userId,
        alertId,
      },
    };
  }

  private createEmptyStats(): AnalysisStats {
    return {
      totalOffers: 0,
      avgViews: 0,
      minViews: 0,
      maxViews: 0,
      avgViewsPerDay: 0,
      minViewsPerDay: 0,
      maxViewsPerDay: 0,
    };
  }

  private async getUserMatchesAvailability(
    userId: number,
  ): Promise<DataAvailabilityStats> {
    this.logger.log(`Getting data availability for user ${userId} matches`);

    const totalOffers = await this.databaseService.match.count({
      where: { alert: { userId } },
    });

    const offersWithViews = await this.databaseService.match.count({
      where: {
        alert: { userId },
        offer: { available: true, views: { gt: 0 } },
      },
    });

    const offersWithAddresses = await this.databaseService.match.count({
      where: {
        alert: { userId },
        offer: {
          available: true,
          OR: [{ street: { not: '' } }, { district: { not: '' } }],
        },
      },
    });

    const offersWithCoordinates = await this.databaseService.match.count({
      where: {
        alert: { userId },
        offer: {
          available: true,
          latitude: { not: null },
          longitude: { not: null },
        },
      },
    });

    const offersWithFootage = await this.databaseService.match.count({
      where: {
        alert: { userId },
        offer: {
          available: true,
          footage: { not: null, gt: 0 },
        },
      },
    });

    const offersWithPrice = await this.databaseService.match.count({
      where: {
        alert: { userId },
        offer: {
          available: true,
          price: { gt: 0 },
        },
      },
    });

    const matchesWithOfferViews = await this.databaseService.match.findMany({
      where: {
        alert: { userId },
        offer: { available: true, views: { gt: 0 } },
      },
      select: { offer: { select: { views: true } } },
    });

    const viewsCounts = matchesWithOfferViews.map((match) => match.offer.views);
    const viewsStats =
      viewsCounts.length > 0
        ? {
            average:
              viewsCounts.reduce((sum, views) => sum + views, 0) /
              viewsCounts.length,
            maximum: Math.max(...viewsCounts),
            minimum: Math.min(...viewsCounts),
          }
        : { average: 0, maximum: 0, minimum: 0 };

    return {
      totalOffers,
      offersWithViews,
      offersWithAddresses,
      offersWithCoordinates,
      offersWithFootage,
      offersWithPrice,
      viewsStats,
      userContext: {
        userId,
        isUserSpecific: true,
        description: 'Statistics based on user matches',
      },
    };
  }
}
