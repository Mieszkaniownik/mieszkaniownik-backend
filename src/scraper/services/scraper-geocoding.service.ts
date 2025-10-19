import { Injectable, Logger } from "@nestjs/common";

import { GeocodingService } from "../../heatmap/geocoding.service";

@Injectable()
export class ScraperGeocodingService {
  private readonly logger = new Logger(ScraperGeocodingService.name);

  constructor(private readonly geocodingService: GeocodingService) {}

  async geocodeAddress(
    address: string,
    city?: string,
  ): Promise<{ latitude: number | null; longitude: number | null }> {
    try {
      const fullAddress =
        city !== undefined && city !== "" && !address.includes(city)
          ? `${address}, ${city}`
          : address;

      this.logger.debug(`Geocoding address: ${fullAddress}`);

      const result = await this.geocodingService.geocodeAddress(
        fullAddress,
        city,
      );

      if (result === null) {
        this.logger.warn(`Failed to geocode address: ${fullAddress}`);
        return { latitude: null, longitude: null };
      }

      this.logger.log(
        `Successfully geocoded "${fullAddress}" -> lat: ${String(result.lat)}, lng: ${String(result.lng)}`,
      );
      return {
        latitude: result.lat,
        longitude: result.lng,
      };
    } catch (error) {
      this.logger.warn(
        `Geocoding error for "${address}": ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return { latitude: null, longitude: null };
    }
  }

  async batchGeocodeAddresses(
    addresses: {
      address: string;
      city?: string;
      identifier: string | number;
    }[],
  ): Promise<
    {
      identifier: string | number;
      latitude: number | null;
      longitude: number | null;
    }[]
  > {
    this.logger.log(
      `Starting batch geocoding of ${String(addresses.length)} addresses`,
    );

    const results = await this.geocodingService.batchGeocode(
      addresses.map((addr) => ({
        address: addr.address,
        city: addr.city,
        offerId: 0,
      })),
    );

    return addresses.map((addr, index) => ({
      identifier: addr.identifier,
      latitude: results[index]?.result?.lat ?? null,
      longitude: results[index]?.result?.lng ?? null,
    }));
  }

  getCacheStats() {
    return this.geocodingService.getCacheStats();
  }

  clearCache() {
    this.geocodingService.clearCache();
    this.logger.log("Scraper geocoding cache cleared");
  }
}
