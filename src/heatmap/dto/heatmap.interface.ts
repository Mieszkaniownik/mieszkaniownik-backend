export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  weight?: number;
  title?: string;
  price?: number;
  address?: string;
  offerId: number;
  matchId?: number;
  footage?: number;
  pricePerSqm?: number;
  offerDensity?: number;
  viewsPerDay?: number;
  images?: string[];
  link?: string;
}

export interface HeatmapData {
  points: HeatmapPoint[];
  avgViews: number;
  minViews: number;
  totalOffers: number;
  maxPricePerSqm?: number;
  minPricePerSqm?: number;
  avgPricePerSqm?: number;
  maxDensity?: number;
  minDensity?: number;
  avgDensity?: number;
  maxFootage?: number;
  minFootage?: number;
  avgFootage?: number;
  avgViewsPerDay?: number;
  maxViewsPerDay?: number;
  minViewsPerDay?: number;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  accuracy: 'high' | 'medium' | 'low';
  source: 'cache' | 'api';
}

export interface HeatmapQuery {
  city?: string;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  minViews?: number;
  maxViews?: number;
  buildingType?: string;
  limit?: number;
  minPricePerSqm?: number;
  maxPricePerSqm?: number;
  alertId?: number;
}
