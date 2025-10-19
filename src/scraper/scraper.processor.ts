import { BuildingType } from "@prisma/client";
import type { Page } from "puppeteer";

import { Injectable, Logger } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import { MatchService } from "../match/match.service";
import { OfferService } from "../offer/offer.service";
import { ScraperService } from "./scraper.service";
import { aiAddressExtractorService } from "./services/ai-address-extractor.service";
import { BrowserSetupService } from "./services/browser-setup.service";
import { ParameterParserService } from "./services/parameter-parser.service";
import { ScraperGeocodingService } from "./services/scraper-geocoding.service";
import { ScraperOfferMapperService } from "./services/scraper-offer-mapper.service";
import { StreetNameCleaner } from "./services/street-name-cleaner";

type ScrapedDetails = Record<string, string>;

interface ScrapedData {
  price: string | null;
  title: string | null;
  description: string | null;
  details: ScrapedDetails;
  createdAt: string | null;
  images?: string[];
  negotiable?: boolean;
  contact?:
    | {
        name: string | null;
        memberSince: string | null;
        lastSeen: string | null;
      }
    | string;
}

type OtodomScrapedData = ScrapedData & {
  source: "otodom";
  footage: string | null;
  address: string | null;
  contact: string | null;
  views: number;
};

@Injectable()
export class ScraperProcessor {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    private readonly offerService: OfferService,
    private readonly mapperService: ScraperOfferMapperService,
    private readonly databaseService: DatabaseService,
    private readonly matchService: MatchService,
    private readonly scraperService: ScraperService,
    private readonly geocodingService: ScraperGeocodingService,
    private readonly googleAiService: aiAddressExtractorService,
    private readonly browserSetup: BrowserSetupService,
    private readonly parameterParser: ParameterParserService,
  ) {}

  private async generateSummary(
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

  private async geocodeAddress(
    address: string,
    city?: string,
  ): Promise<{ latitude: number | null; longitude: number | null }> {
    return this.geocodingService.geocodeAddress(address, city);
  }

  public async processOlxOffer(page: Page, url: string, isNew = false) {
    try {
      const pageDebug = await page.evaluate(() => {
        const allSpans = [...document.querySelectorAll("span")];
        const spanInfo = allSpans
          .filter(
            (span) =>
              span.textContent.includes("października") ||
              span.textContent.includes("dzisiaj") ||
              span.textContent.includes("wczoraj"),
          )
          .map((span) => ({
            text: span.textContent.trim(),
            testId: span.dataset.testid,
            dataCy: span.dataset.cy,
            className: span.className,
            parentClass: span.parentElement?.className,
          }));

        return {
          foundSpans: spanInfo.length,
          spans: spanInfo,
          hasTestIdElement: Boolean(
            document.querySelector('[data-testid="ad-posted-at"]'),
          ),
          bodySnippet: document.body.innerHTML.slice(0, 2000),
        };
      });

      this.logger.log(
        `PAGE DEBUG: Found ${String(pageDebug.foundSpans)} potential date spans`,
      );
      this.logger.log(
        `Has testid element: ${String(pageDebug.hasTestIdElement)}`,
      );
      if (pageDebug.spans.length > 0) {
        this.logger.log(
          `Date spans:`,
          JSON.stringify(pageDebug.spans, null, 2),
        );
      }

      try {
        await page.waitForSelector('[data-testid="ad-posted-at"]', {
          timeout: 5000,
        });
        this.logger.log("Date element found, proceeding with scraping");
      } catch {
        this.logger.warn(
          "Date element not found after waiting, will attempt scraping anyway",
        );
      }

      const data = await page.evaluate(() => {
        interface ScrapedResult {
          title: string | null;
          price: number | null;
          description: string | null;
          city: string;
          district: string;
          images: string[];
          views: number;
          createdAt: string | null;
          negotiable: boolean;
          rawParameters: Record<string, string>;
          contact: {
            name: string | null;
            memberSince: string | null;
            lastSeen: string | null;
          };
        }

        const titleElement = document.querySelector(
          '[data-testid="offer_title"] h4',
        );
        const title = titleElement?.textContent.trim() ?? null;

        const priceElement = document.querySelector(
          '[data-testid="ad-price-container"] h3',
        );
        const priceText = priceElement?.textContent.trim() ?? "";
        const price =
          priceText === ""
            ? null
            : Number.parseInt(priceText.replaceAll(/\D/g, ""));

        const negotiableElement = document.querySelector(
          '[data-testid="ad-price-container"] .css-nw4rgq',
        );
        const negotiable =
          negotiableElement?.textContent.trim().toLowerCase() ===
          "do negocjacji";

        const createdAtElement = document.querySelector(
          '[data-testid="ad-posted-at"]',
        );
        let dateText = createdAtElement?.textContent.trim() ?? "";
        let createdAt: string | null = null;
        const dateDebug: string[] = [];

        dateDebug.push(
          "=== DATE EXTRACTION DEBUG ===",
          `Date element found: ${String(createdAtElement !== null)}`,
        );

        if (createdAtElement === null) {
          dateDebug.push("Trying alternative selectors...");

          const altElement1 = document.querySelector(
            '[data-cy="ad-posted-at"]',
          );
          if (altElement1 !== null) {
            dateDebug.push('Found with data-cy="ad-posted-at"');
            dateText = altElement1.textContent.trim();
          }

          const parentContainer = document.querySelector(".css-1yzzyg0");
          if (parentContainer !== null && dateText === "") {
            dateDebug.push("Found parent container .css-1yzzyg0");
            const spans = parentContainer.querySelectorAll("span");
            for (const [index, span] of spans.entries()) {
              const text = span.textContent.trim();
              dateDebug.push(`  Span ${String(index)}: "${text.slice(0, 50)}"`);
              if (
                /\d+\s+\w+\s+\d{4}/.test(text) ||
                text.toLowerCase().includes("dzisiaj") ||
                text.toLowerCase().includes("wczoraj")
              ) {
                dateText = text;
                dateDebug.push(`  Using span ${String(index)} as date source`);
              }
            }
          }

          if (dateText === "") {
            const allText = document.body.textContent;
            const dodaneMatch =
              /Dodane\s+(\d+\s+\w+\s+\d{4}|dzisiaj|wczoraj)/i.exec(allText);
            if (dodaneMatch !== null) {
              dateText = dodaneMatch[1];
              dateDebug.push(
                `Found date via "Dodane" text search: "${dateText}"`,
              );
            }
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        const dateChars = [...dateText];
        dateDebug.push(
          `Raw date text: "${dateText}"`,
          `Raw date charCodes: ${dateChars.map((c) => String(c.codePointAt(0) ?? 0)).join(",")}`,
          `Element HTML: ${createdAtElement?.outerHTML.slice(0, 200) ?? "N/A"}`,
        );

        dateText = dateText.replace(/^dodane\s+/i, "").trim();
        dateDebug.push(`Cleaned date text: "${dateText}"`);

        if (dateText === "") {
          dateDebug.push("No date text found");
        } else {
          const now = new Date();

          if (
            dateText.toLowerCase().includes("dzisiaj") ||
            dateText.toLowerCase().includes("dziś")
          ) {
            createdAt = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            ).toISOString();
            dateDebug.push(`Date is TODAY: ${createdAt}`);
          } else if (dateText.toLowerCase().includes("wczoraj")) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            createdAt = new Date(
              yesterday.getFullYear(),
              yesterday.getMonth(),
              yesterday.getDate(),
            ).toISOString();
            dateDebug.push(`Date is YESTERDAY: ${createdAt}`);
          } else {
            const monthMap: Record<string, number> = {
              stycznia: 0,
              lutego: 1,
              marca: 2,
              kwietnia: 3,
              maja: 4,
              czerwca: 5,
              lipca: 6,
              sierpnia: 7,
              września: 8,
              pazdziernika: 9,
              października: 9,
              listopada: 10,
              grudnia: 11,
            };

            const normalizedDate = dateText.replaceAll("\u00A0", " ");
            dateDebug.push(`Normalized date: "${normalizedDate}"`);

            const match = /(\d+)\s+([a-ząćęłńóśźż]+)\s+(\d+)/i.exec(
              normalizedDate,
            );
            dateDebug.push(
              `Date regex match result: ${match === null ? "NO MATCH" : "MATCHED"}`,
            );
            if (match === null) {
              dateDebug.push(`Date regex did not match: "${normalizedDate}"`);
            } else {
              dateDebug.push(
                `Match groups: [0]="${match[0]}", [1]="${match[1]}", [2]="${match[2]}", [3]="${match[3]}"`,
              );
              const day = Number.parseInt(match[1]);
              let monthName = match[2].toLowerCase();

              monthName = monthName
                .normalize("NFD")
                .replaceAll(/[\u0300-\u036F]/g, "");

              dateDebug.push(`Normalized month name: "${monthName}"`);
              const month =
                monthName in monthMap ? monthMap[monthName] : undefined;
              const year = Number.parseInt(match[3]);
              dateDebug.push(
                `Parsed values: day=${String(day)}, month=${String(month)}, year=${String(year)}`,
              );
              if (
                !Number.isNaN(day) &&
                !Number.isNaN(year) &&
                month !== undefined
              ) {
                createdAt = new Date(year, month, day).toISOString();
                dateDebug.push(
                  `Date parsed: ${String(day)} ${monthName} ${String(year)} -> ${createdAt}`,
                );
              } else {
                dateDebug.push(
                  `Date parsing failed - invalid values: day=${String(day)}, month=${String(month)}, year=${String(year)}`,
                );
              }
            }
          }
        }

        dateDebug.push(`=== FINAL createdAt: ${String(createdAt)} ===`);

        const descElement = document.querySelector(
          '[data-cy="ad_description"] .css-19duwlz',
        );
        const description = descElement?.textContent.trim() ?? null;

        const parameters: Record<string, string> = {};
        const parameterElements = document.querySelectorAll(
          '[data-testid="ad-parameters-container"] p.css-13x8d99',
        );

        for (const element of parameterElements) {
          const text = element.textContent.trim();

          const spanElement = element.querySelector("span:not([class])");
          if (spanElement !== null) {
            const spanQuery = element.querySelector("span");
            if (spanQuery !== null) {
              const value = spanQuery.textContent.trim();
              if (value !== "") {
                parameters[value] = "Tak";
              }
            }
            continue;
          }

          const parts = text.split(":");
          if (parts.length === 2) {
            const key = parts[0].trim();
            const value = parts[1].trim();
            if (key !== "" && value !== "") {
              parameters[key] = value;
            }
          } else if (text.includes(" ")) {
            const [key, value] = text.split(" ");
            if (key !== "" && value !== "") {
              parameters[key] = value;
            }
          } else if (text !== "") {
            parameters[text] = "Tak";
          }
        }

        const locationElement = document.querySelector(".css-9pna1a");
        const locationText = locationElement?.textContent.trim() ?? "";

        let city = "";
        let district = "";

        if (locationText !== "") {
          const parts = locationText.split(",");
          if (parts.length >= 2) {
            city = parts[0].trim();
            district = parts[1].trim();
          } else {
            city = parts[0].trim();
          }
        }

        const images = [
          ...document.querySelectorAll('[data-testid="ad-photo"] img'),
        ]
          .map((img) => img.getAttribute("src"))
          .filter((source): source is string => source !== null);

        const sellerName =
          document
            .querySelector('[data-testid="user-profile-user-name"]')
            ?.textContent.trim() ?? null;
        const memberSince =
          document
            .querySelector('[data-testid="member-since"] span')
            ?.textContent.trim() ?? null;
        const lastSeen =
          document
            .querySelector('[data-testid="lastSeenBox"] .css-1p85e15')
            ?.textContent.trim() ?? null;

        let views = 0;
        let viewsExtractionMethod = "none";

        const inactiveAdElement = document.querySelector(
          '[data-testid="ad-inactive-msg"]',
        );
        if (inactiveAdElement === null) {
          views = 0;
          viewsExtractionMethod = "inactive-ad";
        }

        if (views === 0) {
          const selector = '[data-testid="page-view-counter"]';
          const element = document.querySelector(selector);
          if (element !== null) {
            const text = element.textContent.trim();

            if (text.toLowerCase().includes("wyświetl")) {
              const viewsMatch = /(\d+)/.exec(text);
              if (viewsMatch !== null) {
                views = Number.parseInt(viewsMatch[1]);
                viewsExtractionMethod = "modern-selector-3";
              }
            }
          }
        }

        return {
          title,
          price,
          description,
          city,
          district,
          images,
          views,
          createdAt,
          negotiable,
          rawParameters: parameters,
          contact: {
            name: sellerName,
            memberSince,
            lastSeen,
          },
          viewsExtractionMethod,
          dateDebug,
        } as ScrapedResult & {
          viewsExtractionMethod: string;
          dateDebug: string[];
        };
      });

      const extractionData = data as typeof data & {
        viewsExtractionMethod: string;
        dateDebug: string[];
      };

      this.logger.log(
        `Date extraction result: ${data.createdAt !== null && data.createdAt !== "" ? `"${data.createdAt}"` : "NULL"} for URL: ${url}`,
      );

      this.logger.log(
        `DEBUG: dateDebug length: ${String(extractionData.dateDebug.length)}`,
      );

      if (extractionData.dateDebug.length > 0) {
        this.logger.log("DATE EXTRACTION DEBUG FROM BROWSER:");
        for (const line of extractionData.dateDebug) {
          this.logger.log(`   ${line}`);
        }
      } else {
        this.logger.warn("No date debug information returned from browser!");
      }

      this.logger.log(
        `Views extraction for ${url}: ${String(data.views)} views using method: ${extractionData.viewsExtractionMethod}`,
      );

      const parsed = this.parameterParser.parseOlxParameters(
        data.rawParameters,
      );

      const findParameterValue = (targetKey: string) =>
        this.parameterParser.findParamValue(data.rawParameters, targetKey);

      this.logger.debug("Final boolean values before database update:", {
        elevator: parsed.elevator,

        pets: parsed.pets,

        furniture: parsed.furniture,
        title:
          data.title !== null && data.title !== "" ? data.title : "unknown",
      });

      let extractedStreet: string | null = null;
      let extractedStreetNumber: string | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;

      try {
        if (data.title !== null && data.title !== "") {
          this.logger.debug(`Extracting address from: ${data.title}`);
          const addressResult = await this.scraperService.extractAddress(
            data.title,
            data.description !== null && data.description !== ""
              ? data.description
              : undefined,
          );

          if (addressResult.street !== undefined) {
            const cleanedStreet = StreetNameCleaner.normalizeStreetName(
              addressResult.street,
            );

            if (StreetNameCleaner.isValidStreetName(cleanedStreet)) {
              extractedStreet = cleanedStreet;
              extractedStreetNumber = addressResult.streetNumber ?? null;
              this.logger.log(
                `Address extracted: ${extractedStreet}${extractedStreetNumber === null ? "" : ` ${extractedStreetNumber}`} (confidence: ${String(addressResult.confidence)})`,
              );

              const fullAddress = `${extractedStreet}${extractedStreetNumber === null ? "" : ` ${extractedStreetNumber}`}, ${data.city}`;
              const coordinates = await this.geocodeAddress(
                fullAddress,
                data.city,
              );
              latitude = coordinates.latitude;
              longitude = coordinates.longitude;
            } else {
              this.logger.warn(
                `Rejected invalid street after final cleaning: ${addressResult.street} -> ${cleanedStreet}`,
              );
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Address extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      const validCity = data.city.trim();

      const finalCreatedAt =
        data.createdAt !== null && data.createdAt !== ""
          ? new Date(data.createdAt)
          : new Date();

      const contactValue = findParameterValue("kontakt");
      let contactString: string | null = null;
      if (data.contact.name === null || data.contact.name === "") {
        contactString = contactValue ?? null;
      } else {
        const memberPart =
          data.contact.memberSince !== null && data.contact.memberSince !== ""
            ? ` - Na OLX od ${data.contact.memberSince}`
            : "";
        const lastSeenPart =
          data.contact.lastSeen !== null && data.contact.lastSeen !== ""
            ? ` - ${data.contact.lastSeen}`
            : "";
        contactString = `${data.contact.name}${memberPart}${lastSeenPart}`;
      }

      const summary = await this.generateSummary(
        data.title ?? "",
        data.description ?? "",
      );

      this.logger.debug("Final boolean values before OfferService:", {
        elevator: parsed.elevator,
        pets: parsed.pets,
        furniture: parsed.furniture,
        title: data.title,
      });

      const offerDto = this.mapperService.mapOlxToCreateOfferDto({
        url,
        title: data.title ?? "",
        price: data.price ?? 0,
        city: validCity,
        district: data.district,
        footage: parsed.footage ?? 0,
        description: data.description ?? "",
        summary,
        street: extractedStreet,
        streetNumber: extractedStreetNumber,
        latitude,
        longitude,
        rooms:
          parsed.rooms !== null && parsed.rooms !== ""
            ? Number.parseInt(parsed.rooms)
            : null,
        floor:
          parsed.floor !== null && parsed.floor !== ""
            ? Number.parseInt(parsed.floor)
            : null,
        furniture: parsed.furniture,
        elevator: parsed.elevator,
        pets: parsed.pets,
        negotiable: data.negotiable,
        ownerType: parsed.ownerType,
        buildingType: parsed.buildingType,
        parkingType: parsed.parkingType,
        rentAdditional: parsed.rentAdditional,
        contact: contactString,
        views: data.views,
        createdAt: finalCreatedAt,
        isNew,
        images: data.images,
        infoAdditional: findParameterValue("informacje dodatkowe") ?? null,
        furnishing: findParameterValue("wyposażenie") ?? null,
        media: findParameterValue("media") ?? null,
      });

      const { offer: createdOffer, created } =
        await this.offerService.findOneOrCreate(offerDto);

      this.logger.log(
        `${created ? "Created" : "Updated"} OLX offer ${String(createdOffer.id)} for ${url} - Views: ${String(data.views)}`,
      );

      if (!created) {
        this.logger.debug(
          `Updated existing offer ${String(createdOffer.id)} for URL: ${url}`,
        );
      }

      if (created || createdOffer.id) {
        try {
          const matchCount = await this.matchService.processNewOffer(
            createdOffer.id,
          );
          this.logger.log(
            `Processed ${String(matchCount)} matches for offer ${String(createdOffer.id)}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to process matches for offer ${String(createdOffer.id)}:`,
            error,
          );
        }
      }

      this.logger.log(
        `OLX scraping completed for ${url} - Offer ID: ${String(createdOffer.id)}, Views: ${String(data.views)}, Method: ${extractionData.viewsExtractionMethod}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing OLX offer: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }

  public async processOtodomOffer(page: Page, url: string, isNew = false) {
    try {
      const data = await page.evaluate(() => {
        const priceElement =
          document.querySelector('[data-cy="adPageHeaderPrice"]') ??
          document.querySelector('strong[aria-label="Cena"]') ??
          document.querySelector(".css-1o51x5a.elm6lnc1") ??
          document.querySelector(".elm6lnc1");
        const price = priceElement?.textContent.trim() ?? null;

        const titleElement =
          document.querySelector('[data-cy="adPageAdTitle"]') ??
          document.querySelector("h1.css-4utb9r.e1dqm4hr1") ??
          document.querySelector("h1");
        const title = titleElement?.textContent.trim() ?? null;

        const addressElement =
          document.querySelector('a[href="#map"].css-1eowip8.e1aypsbg1') ??
          document.querySelector(".e1aypsbg1") ??
          document.querySelector('a[href="#map"]');
        const address = addressElement?.textContent.trim() ?? null;

        const descElement =
          document.querySelector('[data-cy="adPageAdDescription"]') ??
          document.querySelector(".css-1nuh7jg.e1op7yyl1") ??
          document.querySelector(".e1op7yyl1");
        const description = descElement?.textContent.trim() ?? null;

        const footageElement = [
          ...document.querySelectorAll(".css-1okys8k.e1mm5aqc2, .e1mm5aqc2"),
        ].find((element) => {
          const text = element.textContent.toLowerCase();
          return text.includes("m²") && /\d+\s*m²/.test(text);
        });
        const footage = footageElement?.textContent.trim() ?? null;

        const images = [...document.querySelectorAll("img")]
          .map((img) => img.getAttribute("src"))
          .filter(
            (source): source is string =>
              source !== null &&
              (source.includes("otodom") || source.includes("cdn")),
          )
          .slice(0, 10);

        let views = 0;
        const viewsDebug: string[] = [];
        viewsDebug.push("=== OTODOM VIEWS EXTRACTION DEBUG ===");

        const viewsElement = document.querySelector(
          ".css-lcnm6u.e3km50a2, .e3km50a2",
        );
        if (viewsElement === null) {
          viewsDebug.push("Method 1: Views element not found");

          const statsContainer = document.querySelector(
            ".css-1jzjbfr.e3km50a0, .e3km50a0",
          );
          if (statsContainer === null) {
            viewsDebug.push("Method 2: Statistics container not found");
          } else {
            viewsDebug.push(
              "Method 2: Found statistics container, searching for views",
            );
            const allText = statsContainer.textContent;
            const viewsMatch = /(\d+)\s*wyświetl/i.exec(allText);
            if (viewsMatch === null) {
              viewsDebug.push("  No views pattern found in container");
            } else {
              views = Number.parseInt(viewsMatch[1]);
              viewsDebug.push(
                `  Extracted views from container: ${String(views)}`,
              );
            }
          }
        } else {
          const viewsText = viewsElement.textContent.trim();
          viewsDebug.push(`Method 1: Found views element: "${viewsText}"`);
          const viewsMatch = /(\d+)/.exec(viewsText);
          if (viewsMatch === null) {
            viewsDebug.push("  No match in views element");
          } else {
            views = Number.parseInt(viewsMatch[1]);
            viewsDebug.push(`  Extracted views: ${String(views)}`);
          }
        }

        if (views === 0) {
          viewsDebug.push("Method 3: Searching entire page for views...");
          const bodyText = document.body.textContent;
          const viewsPattern = /(\d+)\s*wyświetl/i;
          const match = viewsPattern.exec(bodyText);
          if (match === null) {
            viewsDebug.push("  Method 3: No match found");
          } else {
            views = Number.parseInt(match[1]);
            viewsDebug.push(`  Method 3 success: ${String(views)} views`);
          }
        }

        if (views === 0) {
          viewsDebug.push(
            'Method 4: Looking for elements near "wyświetleń"...',
          );
          const allElements = document.querySelectorAll(
            '[class*="e3km50a"], [class*="stat"], [class*="view"]',
          );
          for (const element of allElements) {
            const text = element.textContent.toLowerCase();
            if (text.includes("wyświetl")) {
              const numberMatch = /(\d+)/.exec(text);
              if (numberMatch !== null) {
                views = Number.parseInt(numberMatch[1]);
                viewsDebug.push(
                  `  Method 4 success: Found ${String(views)} views near "wyświetleń"`,
                );
                break;
              }
            }
          }
          if (views === 0) {
            viewsDebug.push('  No views found near "wyświetleń"');
          }
        }

        if (views === 0) {
          viewsDebug.push(
            "All methods failed - No views found, defaulting to 0",
            "This may indicate CloudFront blocking or page structure change",
          );
        } else {
          viewsDebug.push(`Successfully extracted ${String(views)} views`);
        }

        viewsDebug.push(`=== FINAL VIEWS: ${String(views)} ===`);

        let createdAt: string | null = null;
        const dateDebug: string[] = [];
        dateDebug.push("=== OTODOM DATE EXTRACTION DEBUG ===");

        const historyRows = document.querySelectorAll(
          ".css-17wo1v5.etrn3wv7, .etrn3wv7",
        );
        dateDebug.push(
          `Method 1: Found ${String(historyRows.length)} history rows in "Historia i statystyki"`,
        );

        for (const [index, row] of historyRows.entries()) {
          const cells = [...row.querySelectorAll(".etrn3wv2")];

          dateDebug.push(
            `  Row ${String(index)}: Found ${String(cells.length)} cells`,
          );

          if (cells.length >= 2) {
            const dateCell = cells[0];
            const actionCell = cells[1];

            const dateText = dateCell.textContent.trim();
            const actionText = actionCell.textContent.trim();

            dateDebug.push(
              `  Row ${String(index)}: date="${dateText}", action="${actionText}"`,
            );

            if (
              actionText.toLowerCase().includes("dodanie") &&
              actionText.toLowerCase().includes("ogłoszenia")
            ) {
              dateDebug.push(`  ✓ Found "Dodanie ogłoszenia" row`);
              const dateMatch = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(dateText);
              if (dateMatch === null) {
                dateDebug.push(`  Date format not matched: "${dateText}"`);
              } else {
                const day = Number.parseInt(dateMatch[1]);
                const month = Number.parseInt(dateMatch[2]) - 1;
                const year = Number.parseInt(dateMatch[3]);

                createdAt = new Date(Date.UTC(year, month, day)).toISOString();
                dateDebug.push(
                  `  Parsed date: ${String(day)}.${String(month + 1)}.${String(year)} -> ${createdAt}`,
                );
                break;
              }
            }
          }
        }

        if (createdAt === null) {
          dateDebug.push(
            "Method 2: Trying alternative history row selectors...",
          );
          const altHistoryRows = document.querySelectorAll(
            '[class*="etrn3wv"], div[class*="history"] tr, table tr',
          );
          dateDebug.push(
            `  Found ${String(altHistoryRows.length)} alternative history rows`,
          );

          for (
            let index = 0;
            index < Math.min(altHistoryRows.length, 20);
            index++
          ) {
            const row = altHistoryRows[index];
            const rowText = row.textContent.toLowerCase();

            if (rowText.includes("dodanie") && rowText.includes("ogłoszenia")) {
              dateDebug.push(`  Found potential row at index ${String(index)}`);
              const dateMatch = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(
                row.textContent,
              );
              if (dateMatch !== null) {
                const day = Number.parseInt(dateMatch[1]);
                const month = Number.parseInt(dateMatch[2]) - 1;
                const year = Number.parseInt(dateMatch[3]);

                createdAt = new Date(Date.UTC(year, month, day)).toISOString();
                dateDebug.push(
                  `  ✓ Method 2 success: ${String(day)}.${String(month + 1)}.${String(year)} -> ${createdAt}`,
                );
                break;
              }
            }
          }
        }

        if (createdAt === null) {
          dateDebug.push(
            "Method 3: Searching entire page content for creation date...",
          );
          const bodyText = document.body.textContent;
          const creationPattern =
            /Dodanie\s+ogłoszenia[\s\S]{0,100}?(\d{1,2})\.(\d{1,2})\.(\d{4})/i;
          const match = creationPattern.exec(bodyText);

          if (match === null) {
            dateDebug.push("  No date pattern found in page content");
          } else {
            const day = Number.parseInt(match[1]);
            const month = Number.parseInt(match[2]) - 1;
            const year = Number.parseInt(match[3]);

            createdAt = new Date(Date.UTC(year, month, day)).toISOString();
            dateDebug.push(
              `  Method 3 success: ${String(day)}.${String(month + 1)}.${String(year)} -> ${createdAt}`,
            );
          }
        }

        if (createdAt === null) {
          dateDebug.push('Method 4: Looking for dates near "Historia"...');
          const historySection = document.querySelector(
            '[class*="history"], [class*="Historia"], [data-cy*="history"]',
          );
          if (historySection === null) {
            dateDebug.push("  No history section found");
          } else {
            const sectionText = historySection.textContent;
            const allDates = sectionText.match(
              /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
            );
            if (allDates === null || allDates.length === 0) {
              dateDebug.push("  No dates found in history section");
            } else {
              dateDebug.push(
                `  Found ${String(allDates.length)} dates in history`,
              );
              const oldestDate = allDates.at(-1);
              if (oldestDate !== undefined) {
                const match = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(oldestDate);
                if (match !== null) {
                  const day = Number.parseInt(match[1]);
                  const month = Number.parseInt(match[2]) - 1;
                  const year = Number.parseInt(match[3]);

                  createdAt = new Date(
                    Date.UTC(year, month, day),
                  ).toISOString();
                  dateDebug.push(
                    `  Method 4 success (oldest date): ${oldestDate} -> ${createdAt}`,
                  );
                }
              }
            }
          }
        }

        if (createdAt === null) {
          dateDebug.push(
            "Method 5: Looking for dates in Otodom paragraph classes...",
          );
          const dateParagraphs = document.querySelectorAll(
            'p.css-f4ltfo, .css-f4ltfo, p[class*="f4ltfo"]',
          );
          dateDebug.push(
            `  Found ${String(dateParagraphs.length)} date paragraphs`,
          );

          for (const [index, p] of dateParagraphs.entries()) {
            const text = p.textContent.trim();
            const dateMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);

            if (dateMatch !== null) {
              const day = Number.parseInt(dateMatch[1]);
              const month = Number.parseInt(dateMatch[2]) - 1;
              const year = Number.parseInt(dateMatch[3]);
              createdAt = new Date(Date.UTC(year, month, day)).toISOString();
              dateDebug.push(
                `  Method 5 success at index ${String(index)}: ${text} -> ${createdAt}`,
              );
              break;
            }
          }

          if (createdAt === null) {
            dateDebug.push("  No valid dates found in paragraphs");
          }
        }

        if (createdAt === null) {
          dateDebug.push(
            "All methods failed - No creation date found, will use current date",
            "This may indicate CloudFront blocking or page structure change",
          );
        } else {
          dateDebug.push(`Successfully extracted creation date: ${createdAt}`);
        }

        dateDebug.push(`=== FINAL CREATED_AT: ${createdAt ?? "NULL"} ===`);

        const details: Record<string, string> = {};

        const detailSections = document.querySelectorAll(
          ".css-1xw0jqp.e1mm5aqc1, .e1mm5aqc1",
        );
        for (const section of detailSections) {
          const keyElement = section.querySelector(
            ".css-1okys8k.e1mm5aqc2:first-child, .e1mm5aqc2:first-child",
          );
          const valueElement = section.querySelector(
            ".css-1okys8k.e1mm5aqc2:last-child, .e1mm5aqc2:last-child",
          );

          if (keyElement !== null && valueElement !== null) {
            const key = keyElement.textContent
              .trim()
              .toLowerCase()
              .replace(":", "");

            const spans = valueElement.querySelectorAll(
              "span.css-axw7ok.e1mm5aqc4, span.e1mm5aqc4, span",
            );
            let value = valueElement.textContent.trim();

            if (spans.length > 0) {
              const spanTexts = [...spans]
                .map((span) => span.textContent.trim())
                .filter((text) => text.length > 0)
                .join(", ");
              if (spanTexts !== "") {
                value = spanTexts;
              }
            }

            if (key !== "" && value !== "" && key !== value) {
              details[key] = value;

              if (key.includes("powierzchnia") || key.includes("m²")) {
                details.powierzchnia = value;
              }
              if (key.includes("pokoi") || key.includes("rooms")) {
                details["liczba pokoi"] = value;
                details.pokoi = value;
              }
              if (key.includes("piętro") || key.includes("floor")) {
                details["piętro"] = value;
              }

              if (key.includes("winda") || key.includes("elevator")) {
                details.winda = value;
              }
              if (
                key.includes("rodzaj zabudowy") ||
                key.includes("building type")
              ) {
                details["typ budynku"] = value;
              }
              if (
                key.includes("umeblowani") ||
                key.includes("furnished") ||
                key.includes("umeblowanie")
              ) {
                details.umeblowane = value;
              }
              if (key.includes("czynsz") && !key.includes("kaucja")) {
                details["czynsz dodatkowy"] = value;
              }
              if (
                key.includes("dostępne od") ||
                key.includes("available from")
              ) {
                details.kontakt = `Dostępne od: ${value}`;
              }
              if (
                key.includes("typ ogłoszeniodawcy") ||
                key.includes("advertiser type")
              ) {
                details["typ ogłoszeniodawcy"] = value;
              }
              if (
                key.includes("informacje dodatkowe") ||
                key.includes("additional information")
              ) {
                details["informacje dodatkowe"] = value;
              }
              if (
                key.includes("wyposażenie") &&
                !key.includes("bezpieczeństwo") &&
                !key.includes("zabezpieczenia")
              ) {
                details["wyposażenie"] = value;
              }
              if (key.includes("media") && !key.includes("social")) {
                details.media = value;
              }
            }
          }
        }

        const allTextElements = document.querySelectorAll(
          ".css-1okys8k.e1mm5aqc2, .e1mm5aqc2",
        );
        for (let index = 0; index < allTextElements.length - 1; index += 2) {
          const keyElement = allTextElements[index];
          const valueElement = allTextElements[index + 1];
          const keyText = keyElement.textContent
            .trim()
            .toLowerCase()
            .replace(":", "");
          const valueText = valueElement.textContent.trim();

          if (
            keyText !== "" &&
            valueText !== "" &&
            keyText !== valueText &&
            !(keyText in details)
          ) {
            details[keyText] = valueText;

            if (keyText.includes("powierzchnia") || keyText.includes("m²")) {
              details.powierzchnia = valueText;
            }
            if (keyText.includes("pokoi")) {
              details["liczba pokoi"] = valueText;
              details.pokoi = valueText;
            }
            if (keyText.includes("piętro")) {
              details["piętro"] = valueText;
            }

            if (keyText.includes("winda")) {
              details.winda = valueText;
            }
            if (keyText.includes("rodzaj zabudowy")) {
              details["typ budynku"] = valueText;
            }
            if (
              keyText.includes("umeblowani") ||
              keyText.includes("umeblowanie")
            ) {
              details.umeblowane = valueText;
            }
            if (keyText.includes("czynsz") && !keyText.includes("kaucja")) {
              details["czynsz dodatkowy"] = valueText;
            }
            if (keyText.includes("dostępne od")) {
              details.kontakt = `Dostępne od: ${valueText}`;
            }
            if (keyText.includes("typ ogłoszeniodawcy")) {
              details["typ ogłoszeniodawcy"] = valueText;
            }
            if (keyText.includes("informacje dodatkowe")) {
              details["informacje dodatkowe"] = valueText;
            }
            if (
              keyText.includes("wyposażenie") &&
              !keyText.includes("bezpieczeństwo") &&
              !keyText.includes("zabezpieczenia")
            ) {
              details["wyposażenie"] = valueText;
            }
            if (keyText.includes("media") && !keyText.includes("social")) {
              details.media = valueText;
            }
          }
        }

        if ("wyposażenie" in details) {
          const equipmentValue = details["wyposażenie"].toLowerCase();
          if (equipmentValue.includes("meble")) {
            details.umeblowane = "tak";
          }
        }

        for (const [, value] of Object.entries(details)) {
          if (value.toLowerCase().includes("meble")) {
            details.umeblowane = "tak";
          }
        }

        let contact: string | null = null;

        const sellerNameElement = document.querySelector(
          ".e4jldvc1.css-vbzhap",
        );
        let sellerName: string | null = null;
        if (sellerNameElement !== null) {
          const trimmed = sellerNameElement.textContent.trim();
          sellerName = trimmed === "" ? null : trimmed;
        }

        if (sellerName !== null) {
          const dashIndex = sellerName.indexOf(" - ");
          if (dashIndex !== -1) {
            const afterDash = sellerName
              .slice(Math.max(0, dashIndex + 3))
              .toLowerCase();
            const promotionalKeywords = [
              "włącz",
              "powiadomienia",
              "okazji",
              "przegap",
              "nie przegap",
              "subskryb",
              "subscribe",
              "follow",
              "obserwuj",
            ];

            if (
              promotionalKeywords.some((keyword) => afterDash.includes(keyword))
            ) {
              sellerName = sellerName.slice(0, Math.max(0, dashIndex));
            }
          }

          sellerName = sellerName.replace(/[\s-]+$/, "").trim();
        }

        const offerTypeElement = document.querySelector(".css-f4ltfo");
        let offerType: string | null = null;
        if (offerTypeElement !== null) {
          const trimmed = offerTypeElement.textContent.trim();
          offerType = trimmed === "" ? null : trimmed;
        }

        if (sellerName !== null || offerType !== null) {
          const contactParts: string[] = [];
          if (sellerName !== null) {
            contactParts.push(sellerName);
          }
          if (offerType !== null) {
            contactParts.push(offerType);
          }
          contact = contactParts.join(" - ");
        }

        return {
          price,
          title,
          footage,
          address,
          description,
          details,
          images,
          contact,
          views,
          createdAt,
          viewsDebug,
          dateDebug,
          source: "otodom" as const,
        } as OtodomScrapedData & {
          viewsDebug: string[];
          dateDebug: string[];
        };
      });

      const extractionData = data as typeof data & {
        viewsDebug: string[];
        dateDebug: string[];
      };

      this.logger.log(
        `OTODOM: Extracted ${String(extractionData.views)} views for ${url}`,
      );
      this.logger.log(
        `OTODOM: Extracted createdAt: ${extractionData.createdAt === null ? "NULL (will use current time)" : `"${extractionData.createdAt}"`} for ${url}`,
      );

      if (extractionData.viewsDebug.length > 0) {
        this.logger.debug("OTODOM VIEWS EXTRACTION DEBUG:");
        for (const line of extractionData.viewsDebug) {
          this.logger.debug(`   ${line}`);
        }
      }

      if (extractionData.dateDebug.length > 0) {
        this.logger.debug("OTODOM DATE EXTRACTION DEBUG:");
        for (const line of extractionData.dateDebug) {
          this.logger.debug(`   ${line}`);
        }
      }

      if (extractionData.views === 0 && extractionData.createdAt === null) {
        this.logger.warn(
          `OTODOM: Both views and createdAt extraction failed for ${url}`,
        );
        this.logger.warn(
          `This usually indicates CloudFront blocking or major page structure change`,
        );
        this.logger.warn(
          `The offer will be saved with views=0 and createdAt=now()`,
        );
      }

      const priceValue =
        data.price === null
          ? 0
          : Number.parseFloat(
              data.price.replaceAll(/[^0-9,]/g, "").replace(",", "."),
            );
      const address = data.address === null ? [] : data.address.split(",");

      let extractedStreet: string | null = null;
      let extractedStreetNumber: string | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;

      try {
        const addressText = data.address ?? "";
        if (data.title !== null || addressText !== "") {
          this.logger.debug(
            `Extracting Otodom address from: ${data.title ?? ""}, Address: ${addressText}`,
          );
          const addressResult = await this.scraperService.extractAddress(
            data.title ?? "",
            addressText === "" ? (data.description ?? undefined) : addressText,
          );

          if (addressResult.street !== undefined) {
            const cleanedStreet = StreetNameCleaner.normalizeStreetName(
              addressResult.street,
            );

            if (StreetNameCleaner.isValidStreetName(cleanedStreet)) {
              extractedStreet = cleanedStreet;
              const streetNumberRaw = addressResult.streetNumber ?? null;
              extractedStreetNumber =
                streetNumberRaw === "" ? null : streetNumberRaw;
              this.logger.log(
                `Otodom address extracted: ${extractedStreet}${extractedStreetNumber === null ? "" : ` ${extractedStreetNumber}`} (confidence: ${String(addressResult.confidence)})`,
              );

              const cityRaw = address.at(-2);
              const city =
                cityRaw === undefined
                  ? "Nieznane"
                  : cityRaw.trim() === ""
                    ? "Nieznane"
                    : cityRaw.trim();
              const fullAddress = `${extractedStreet}${extractedStreetNumber === null ? "" : ` ${extractedStreetNumber}`}, ${city}`;
              const coordinates = await this.geocodeAddress(fullAddress, city);
              latitude = coordinates.latitude;
              longitude = coordinates.longitude;
            } else {
              this.logger.warn(
                `Rejected invalid Otodom street after final cleaning: ${addressResult.street} -> ${cleanedStreet}`,
              );
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Otodom address extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      const findParameterValue = (targetKey: string) =>
        this.parameterParser.findParamValue(data.details, targetKey);

      const furniture = this.parameterParser.parseBoolean(
        findParameterValue("umeblowane"),
        "Furniture (Otodom)",
      );

      const elevator = this.parameterParser.parseBoolean(
        findParameterValue("winda"),
        "Elevator (Otodom)",
      );

      const ownerType = this.parameterParser.parseOwnerType(data.details);

      const cityRaw = address.at(-2);
      const city =
        cityRaw === undefined
          ? "Nieznane"
          : cityRaw.trim() === ""
            ? "Nieznane"
            : cityRaw.trim();
      const districtRaw = address.at(-3);
      const district =
        districtRaw === undefined
          ? null
          : districtRaw.trim() === ""
            ? null
            : districtRaw.trim();

      const finalCreatedAt =
        data.createdAt === null ? new Date() : new Date(data.createdAt);

      const summary = await this.generateSummary(
        data.title ?? "",
        data.description ?? "",
      );

      const offerDto = this.mapperService.mapOtodomToCreateOfferDto({
        url,
        title: data.title ?? "",
        price: priceValue,
        city,
        district,
        footage:
          this.parameterParser.parseOtodomFootage(data.footage, data.details) ??
          0,
        description: data.description ?? "",
        summary,
        street: extractedStreet,
        streetNumber: extractedStreetNumber,
        latitude,
        longitude,
        rooms:
          Number.parseInt(data.details["liczba pokoi"] ?? data.details.pokoi) ||
          null,
        floor: Number.parseInt(data.details["piętro"] ?? "") || null,
        furniture,
        elevator,
        ownerType,
        buildingType: BuildingType.APARTMENT,
        contact: typeof data.contact === "string" ? data.contact : null,
        views: data.views,
        createdAt: finalCreatedAt,
        isNew,
        images: data.images,
        infoAdditional: data.details["informacje dodatkowe"] ?? null,
        furnishing: data.details["wyposażenie"] ?? null,
        media: data.details.media,
      });

      const { offer: createdOffer, created } =
        await this.offerService.findOneOrCreate(offerDto);

      this.logger.log(
        `${created ? "Created" : "Updated"} Otodom offer ${String(createdOffer.id)} for ${url} - Views: ${String(data.views)}`,
      );

      if (created) {
        this.logger.debug("Created new Otodom offer");
      } else {
        this.logger.debug(
          `Updated existing Otodom offer ${String(createdOffer.id)} for URL: ${url}`,
        );
      }

      if (created || createdOffer.id) {
        try {
          const matchCount = await this.matchService.processNewOffer(
            createdOffer.id,
          );
          this.logger.log(
            `Processed ${String(matchCount)} matches for Otodom offer ${String(createdOffer.id)}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to process matches for Otodom offer ${String(createdOffer.id)}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Otodom scraping completed for ${url} - Offer ID: ${String(createdOffer.id)}, Views: ${String(data.views)}, CreatedAt: ${data.createdAt ?? "current time"}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing Otodom offer: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }
}
