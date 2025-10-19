import { Injectable, Logger } from "@nestjs/common";

import { MatchService } from "../../match/match.service";
import { CreateOfferDto } from "../../offer/dto/create-offer.dto";
import { OfferService } from "../../offer/offer.service";
import { ScraperService } from "../scraper.service";
import { aiAddressExtractorService } from "./ai-address-extractor.service";
import { ScraperGeocodingService } from "./scraper-geocoding.service";
import { StreetNameCleaner } from "./street-name-cleaner";

@Injectable()
export class BaseScraperService {
  private readonly logger = new Logger(BaseScraperService.name);

  constructor(
    private readonly offerService: OfferService,
    private readonly matchService: MatchService,
    private readonly scraperService: ScraperService,
    private readonly geocodingService: ScraperGeocodingService,
    private readonly googleAiService: aiAddressExtractorService,
  ) {}

  async extractAndGeocodeAddress(
    title: string | null,
    description: string | null,
    city: string,
    district?: string,
  ): Promise<{
    street: string | null;
    streetNumber: string | null;
    latitude: number | null;
    longitude: number | null;
  }> {
    let extractedStreet: string | null = null;
    let extractedStreetNumber: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;

    try {
      if (title !== null && title !== "") {
        this.logger.debug(`Extracting address from: ${title}`);
        const addressResult = await this.scraperService.extractAddress(
          title,
          description !== null && description !== "" ? description : undefined,
        );

        if (addressResult.street !== undefined && addressResult.street !== "") {
          const cleanedStreet = StreetNameCleaner.normalizeStreetName(
            addressResult.street,
          );

          if (StreetNameCleaner.isValidStreetName(cleanedStreet)) {
            extractedStreet = cleanedStreet;
            extractedStreetNumber = addressResult.streetNumber ?? null;
            const streetNumberPart =
              extractedStreetNumber === null ? "" : ` ${extractedStreetNumber}`;
            this.logger.log(
              `Address extracted: ${extractedStreet}${streetNumberPart} (confidence: ${String(addressResult.confidence)})`,
            );

            const fullAddress = `${extractedStreet}${streetNumberPart}, ${city}`;
            const coordinates = await this.geocodingService.geocodeAddress(
              fullAddress,
              city,
            );
            latitude = coordinates.latitude;
            longitude = coordinates.longitude;
          } else {
            this.logger.warn(
              `Rejected invalid street: ${addressResult.street} -> ${cleanedStreet}`,
            );
          }
        } else {
          this.logger.debug("No address found - trying city-level geocoding");
          if (city !== "") {
            const cityAddress =
              district !== undefined && district !== ""
                ? `${district}, ${city}`
                : city;
            const coordinates =
              await this.geocodingService.geocodeAddress(cityAddress);
            latitude = coordinates.latitude;
            longitude = coordinates.longitude;
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `Address extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return {
      street: extractedStreet,
      streetNumber: extractedStreetNumber,
      latitude,
      longitude,
    };
  }

  async generateSummary(
    title: string,
    description: string | null,
  ): Promise<string | null> {
    if (description === null || description.trim() === "") {
      this.logger.debug("No description available for summary generation");
      return null;
    }

    try {
      return await this.googleAiService.generateSummary(title, description);
    } catch (error) {
      this.logger.warn(
        `Failed to generate summary: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    }
  }

  async saveOffer(offerDto: CreateOfferDto): Promise<{
    offer: unknown;
    created: boolean;
  }> {
    const { offer, created } =
      await this.offerService.findOneOrCreate(offerDto);

    this.logger.log(
      `${created ? "Created" : "Updated"} offer ${String((offer as { id: number }).id)} for ${offerDto.link} - Views: ${String(offerDto.views)}`,
    );

    if (!created) {
      this.logger.debug(
        `Updated existing offer ${String((offer as { id: number }).id)} for URL: ${offerDto.link}`,
      );
    }

    return { offer, created };
  }

  async processMatches(offerId: number): Promise<number> {
    try {
      const matchCount = await this.matchService.processNewOffer(offerId);
      this.logger.log(
        `Processed ${String(matchCount)} matches for offer ${String(offerId)}`,
      );
      return matchCount ?? 0;
    } catch (error) {
      this.logger.error(
        `Failed to process matches for offer ${String(offerId)}:`,
        error,
      );
      return 0;
    }
  }
}
