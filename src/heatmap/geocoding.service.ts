/* eslint-disable @typescript-eslint/no-restricted-imports */
import axios from "axios";

import { Injectable, Logger } from "@nestjs/common";

import type { NominatimResult } from "./dto/geocoding.interface";
import type { GeocodeResult } from "./dto/heatmap.interface";

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, GeocodeResult>();
  private failureCount = 0;
  private readonly maxFailures = 10;

  private readonly nominatimUrl = "https://nominatim.openstreetmap.org/search";

  async geocodeAddress(
    address: string,
    city?: string,
  ): Promise<GeocodeResult | null> {
    const fullAddress =
      city !== undefined && city !== ""
        ? `${address}, ${city}, Poland`
        : `${address}, Poland`;
    const cacheKey = fullAddress.toLowerCase();

    if (this.cache.has(cacheKey)) {
      this.logger.debug(`Geocoding cache hit for: ${fullAddress}`);
      const cachedResult = this.cache.get(cacheKey);
      if (cachedResult !== undefined) {
        return { ...cachedResult, source: "cache" };
      }
    }

    const addressVariations = this.generateAddressVariations(address, city);

    for (const variation of addressVariations) {
      try {
        this.logger.debug(`Trying geocoding variation: ${variation}`);
        const result = await this.tryGeocode(variation);

        if (result !== null) {
          this.cache.set(cacheKey, result);
          this.logger.log(
            `Geocoded "${fullAddress}" -> ${String(result.lat)}, ${String(result.lng)} (${result.accuracy}) via "${variation}"`,
          );
          return result;
        }
      } catch (error) {
        this.logger.debug(
          `Geocoding variation failed for "${variation}": ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        continue;
      }
    }

    this.logger.warn(`All geocoding variations failed for: ${fullAddress}`);
    return null;
  }

  private generateAddressVariations(address: string, city?: string): string[] {
    const variations: string[] = [];

    const cleanAddress = address.replace(/^(ul\.|al\.|pl\.)\s*/, "").trim();

    if (city !== undefined && city !== "") {
      variations.push(`${address}, ${city}, Poland`);

      if (cleanAddress !== address) {
        variations.push(`${cleanAddress}, ${city}, Poland`);
      }

      const streetWithoutNumber = cleanAddress
        .replace(/\s+\d+[A-Za-z]*$/, "")
        .trim();
      if (streetWithoutNumber && streetWithoutNumber !== cleanAddress) {
        variations.push(`${streetWithoutNumber}, ${city}, Poland`);
      }

      const streetName = cleanAddress.split(/\s+\d+/)[0].trim();
      if (
        streetName &&
        streetName !== streetWithoutNumber &&
        streetName !== cleanAddress
      ) {
        variations.push(`${streetName}, ${city}, Poland`);
      }

      if (address.includes(",")) {
        const parts = address.split(",").map((p) => p.trim());
        for (let index = 1; index < parts.length; index++) {
          const district = parts[index];
          if (district && district !== city) {
            variations.push(`${district}, ${city}, Poland`);
          }
        }
      }

      variations.push(`${city}, Poland`);
    } else {
      variations.push(`${address}, Poland`);

      if (cleanAddress !== address) {
        variations.push(`${cleanAddress}, Poland`);
      }

      if (address.includes(",")) {
        const parts = address.split(",").map((p) => p.trim());

        if (parts.length >= 2) {
          const potentialCity = parts.at(-1);
          const streetPart = parts[0];
          if (potentialCity !== undefined) {
            variations.push(
              `${streetPart}, ${potentialCity}, Poland`,
              `${potentialCity}, Poland`,
            );
          }
        }
      }
    }

    return [...new Set(variations)];
  }

  private async tryGeocode(fullAddress: string): Promise<GeocodeResult | null> {
    if (this.failureCount >= this.maxFailures) {
      this.logger.warn(
        `Circuit breaker open: skipping geocoding for "${fullAddress}"`,
      );
      return null;
    }

    try {
      const response = await axios.get(this.nominatimUrl, {
        params: {
          q: fullAddress,
          format: "json",
          limit: 1,
          countrycodes: "pl",
          addressdetails: 1,
        },
        headers: {
          "User-Agent":
            "Mieszkaniownik-Backend/1.0 (contact@mieszkaniownik.com)",
          Accept: "application/json",
          "Accept-Language": "pl,en",
        },
        timeout: 8000,
        validateStatus: (status) => status < 500,
      });

      if (response.status !== 200) {
        return null;
      }

      if (
        response.data !== null &&
        response.data !== undefined &&
        Array.isArray(response.data) &&
        response.data.length > 0
      ) {
        const result = response.data[0] as NominatimResult;
        const lat = Number.parseFloat(result.lat);
        const lng = Number.parseFloat(result.lon);

        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          const accuracy = this.determineAccuracy(result);
          this.failureCount = 0;
          return {
            lat,
            lng,
            accuracy,
            source: "api",
          };
        }
      }

      return null;
    } catch (error) {
      this.failureCount++;
      this.logger.error(
        `Geocoding failed for "${fullAddress}": ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    }
  }

  async batchGeocode(
    addresses: { address: string; city?: string; offerId: number }[],
  ): Promise<{ offerId: number; result: GeocodeResult | null }[]> {
    const results: { offerId: number; result: GeocodeResult | null }[] = [];

    this.logger.log(
      `Starting batch geocoding of ${String(addresses.length)} addresses`,
    );

    for (let index = 0; index < addresses.length; index++) {
      const { address, city, offerId } = addresses[index];

      const fullAddress =
        city !== undefined && city !== ""
          ? `${address}, ${city}, Poland`
          : `${address}, Poland`;
      const cacheKey = fullAddress.toLowerCase();

      if (index > 0 && !this.cache.has(cacheKey)) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      const result = await this.geocodeAddress(address, city);
      results.push({ offerId, result });

      if ((index + 1) % 20 === 0) {
        this.logger.log(
          `Geocoded ${String(index + 1)}/${String(addresses.length)} addresses`,
        );
      }
    }

    const successCount = results.filter((r) => r.result !== null).length;
    this.logger.log(
      `Batch geocoding completed: ${String(successCount)}/${String(addresses.length)} successful`,
    );

    return results;
  }

  private determineAccuracy(
    nominatimResult: NominatimResult,
  ): "high" | "medium" | "low" {
    const type = nominatimResult.type ?? "";
    const importance = Number.parseFloat(nominatimResult.importance ?? "0");

    if (type === "house" || type === "building" || type === "apartment") {
      return "high";
    }

    if (type === "way" || type === "residential" || importance > 0.5) {
      return "medium";
    }

    return "low";
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      keys: [...this.cache.keys()].slice(0, 10),
    };
  }

  clearCache() {
    this.cache.clear();
    this.logger.log("Geocoding cache cleared");
  }
}
