export interface AnalyzedOffer {
  id: number;
  title: string;
  price?: number;
  views: number;
  latitude: number;
  longitude: number;
  createdAt: Date;
  footage?: number;
  rooms?: number;
  street?: string;
  streetNumber?: string;
  district?: string;
  city?: string;
  images?: string[];
  link?: string;

  viewsPerDay: number;
  pricePerSqm?: number;
  offerDensity: number;
  normalizedIntensity: number;

  matchId?: number;
}

export interface AnalysisStats {
  totalOffers: number;
  avgViews: number;
  minViews: number;
  maxViews: number;

  avgViewsPerDay: number;
  minViewsPerDay: number;
  maxViewsPerDay: number;

  avgPricePerSqm?: number;
  minPricePerSqm?: number;
  maxPricePerSqm?: number;

  avgDensity?: number;
  minDensity?: number;
  maxDensity?: number;

  avgFootage?: number;
  minFootage?: number;
  maxFootage?: number;

  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface AnalyzedData {
  offers: AnalyzedOffer[];
  stats: AnalysisStats;
  query: {
    filters: Record<string, any>;
    limit: number;
    isUserSpecific: boolean;
    userId?: number;
    alertId?: number;
  };
}

export interface DataAvailabilityStats {
  totalOffers: number;
  offersWithViews: number;
  offersWithAddresses: number;
  offersWithCoordinates: number;
  offersWithFootage: number;
  offersWithPrice: number;
  viewsStats: {
    average: number;
    maximum: number;
    minimum: number;
  };
  userContext?: {
    userId: number;
    isUserSpecific: boolean;
    description: string;
  };
}
