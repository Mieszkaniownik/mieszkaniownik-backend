import { Injectable, Logger } from '@nestjs/common';
import type { Page } from 'puppeteer';
import { BuildingType } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { MatchService } from '../match/match.service';
import { ScraperService } from './scraper.service';
import { StreetNameCleaner } from './services/street-name-cleaner';
import { ScraperGeocodingService } from './services/scraper-geocoding.service';
import { aiAddressExtractorService } from './services/ai-address-extractor.service';
import { BrowserSetupService } from './services/browser-setup.service';
import { ParameterParserService } from './services/parameter-parser.service';
import { OfferService } from '../offer/offer.service';
import { ScraperOfferMapperService } from './services/scraper-offer-mapper.service';

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
  source: 'otodom';
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
    private readonly paramParser: ParameterParserService,
  ) {}

  private async generateSummary(
    title: string,
    description: string | null,
  ): Promise<string | null> {
    if (!description || description.trim() === '') {
      this.logger.debug('No description available for summary generation');
      return null;
    }

    try {
      return await this.googleAiService.generateSummary(title, description);
    } catch (error) {
      this.logger.warn(
        `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        const allSpans = Array.from(document.querySelectorAll('span'));
        const spanInfo = allSpans
          .filter(
            (span) =>
              span.textContent?.includes('października') ||
              span.textContent?.includes('dzisiaj') ||
              span.textContent?.includes('wczoraj'),
          )
          .map((span) => ({
            text: span.textContent?.trim(),
            testId: span.getAttribute('data-testid'),
            dataCy: span.getAttribute('data-cy'),
            className: span.className,
            parentClass: span.parentElement?.className,
          }));

        return {
          foundSpans: spanInfo.length,
          spans: spanInfo,
          hasTestIdElement: !!document.querySelector(
            '[data-testid="ad-posted-at"]',
          ),
          bodySnippet: document.body.innerHTML.substring(0, 2000),
        };
      });

      this.logger.log(
        `PAGE DEBUG: Found ${pageDebug.foundSpans} potential date spans`,
      );
      this.logger.log(`Has testid element: ${pageDebug.hasTestIdElement}`);
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
        this.logger.log('Date element found, proceeding with scraping');
      } catch {
        this.logger.warn(
          'Date element not found after waiting, will attempt scraping anyway',
        );
      }

      const data = await page.evaluate(() => {
        type ScrapedResult = {
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
        };

        const titleElement = document.querySelector(
          '[data-testid="offer_title"] h4',
        );
        const title = titleElement?.textContent?.trim() || null;

        const priceElement = document.querySelector(
          '[data-testid="ad-price-container"] h3',
        );
        const priceText = priceElement?.textContent?.trim() || '';
        const price = priceText ? parseInt(priceText.replace(/\D/g, '')) : null;

        const negotiableElement = document.querySelector(
          '[data-testid="ad-price-container"] .css-nw4rgq',
        );
        const negotiable = Boolean(
          negotiableElement?.textContent?.trim().toLowerCase() ===
            'do negocjacji',
        );

        const createdAtElement = document.querySelector(
          '[data-testid="ad-posted-at"]',
        );
        let dateText = createdAtElement?.textContent?.trim() || '';
        let createdAt: string | null = null;
        const dateDebug: string[] = [];

        dateDebug.push('=== DATE EXTRACTION DEBUG ===');
        dateDebug.push(`Date element found: ${!!createdAtElement}`);

        if (!createdAtElement) {
          dateDebug.push('Trying alternative selectors...');

          const altElement1 = document.querySelector(
            '[data-cy="ad-posted-at"]',
          );
          if (altElement1) {
            dateDebug.push('Found with data-cy="ad-posted-at"');
            dateText = altElement1.textContent?.trim() || '';
          }

          const parentContainer = document.querySelector('.css-1yzzyg0');
          if (parentContainer && !dateText) {
            dateDebug.push('Found parent container .css-1yzzyg0');
            const spans = parentContainer.querySelectorAll('span');
            spans.forEach((span, idx) => {
              const text = span.textContent?.trim() || '';
              dateDebug.push(`  Span ${idx}: "${text.substring(0, 50)}"`);
              if (
                text.match(/\d+\s+\w+\s+\d{4}/) ||
                text.toLowerCase().includes('dzisiaj') ||
                text.toLowerCase().includes('wczoraj')
              ) {
                dateText = text;
                dateDebug.push(`  Using span ${idx} as date source`);
              }
            });
          }

          if (!dateText) {
            const allText = document.body.innerText;
            const dodaneMatch = allText.match(
              /Dodane\s+(\d+\s+\w+\s+\d{4}|dzisiaj|wczoraj)/i,
            );
            if (dodaneMatch) {
              dateText = dodaneMatch[1];
              dateDebug.push(
                `Found date via "Dodane" text search: "${dateText}"`,
              );
            }
          }
        }

        dateDebug.push(`Raw date text: "${dateText}"`);
        dateDebug.push(
          `Raw date charCodes: ${Array.from(dateText)
            .map((c) => c.charCodeAt(0))
            .join(',')}`,
        );
        dateDebug.push(
          `Element HTML: ${createdAtElement?.outerHTML?.substring(0, 200) || 'N/A'}`,
        );

        dateText = dateText.replace(/^dodane\s+/i, '').trim();
        dateDebug.push(`Cleaned date text: "${dateText}"`);

        if (dateText) {
          const now = new Date();

          if (
            dateText.toLowerCase().includes('dzisiaj') ||
            dateText.toLowerCase().includes('dziś')
          ) {
            createdAt = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            ).toISOString();
            dateDebug.push(`Date is TODAY: ${createdAt}`);
          } else if (dateText.toLowerCase().includes('wczoraj')) {
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

            const normalizedDate = dateText.replace(/\u00A0/g, ' ');
            dateDebug.push(`Normalized date: "${normalizedDate}"`);

            const match = normalizedDate.match(
              /(\d+)\s+([a-ząćęłńóśźż]+)\s+(\d+)/i,
            );
            dateDebug.push(
              `Date regex match result: ${match ? 'MATCHED' : 'NO MATCH'}`,
            );
            if (match) {
              dateDebug.push(
                `Match groups: [0]="${match[0]}", [1]="${match[1]}", [2]="${match[2]}", [3]="${match[3]}"`,
              );
              const day = parseInt(match[1]);
              let monthName = match[2].toLowerCase();

              monthName = monthName
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

              dateDebug.push(`Normalized month name: "${monthName}"`);
              const month = monthMap[monthName];
              const year = parseInt(match[3]);
              dateDebug.push(
                `Parsed values: day=${day}, month=${month} (${monthName}), year=${year}`,
              );
              if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                createdAt = new Date(year, month, day).toISOString();
                dateDebug.push(
                  `Date parsed: ${day} ${monthName} ${year} -> ${createdAt}`,
                );
              } else {
                dateDebug.push(
                  `Date parsing failed - invalid values: day=${day}, month=${month}, year=${year}`,
                );
              }
            } else {
              dateDebug.push(`Date regex did not match: "${normalizedDate}"`);
            }
          }
        } else {
          dateDebug.push('No date text found');
        }

        dateDebug.push(`=== FINAL createdAt: ${createdAt} ===`);

        const descElement = document.querySelector(
          '[data-cy="ad_description"] .css-19duwlz',
        );
        const description = descElement?.textContent?.trim() || null;

        const parameters: Record<string, string> = {};
        const paramElements = document.querySelectorAll(
          '[data-testid="ad-parameters-container"] p.css-13x8d99',
        );

        paramElements.forEach((elem, index) => {
          const text = elem.textContent?.trim() || '';
          console.log(`Parameter element ${index}:`, {
            text,
            innerHTML: elem.innerHTML,
            hasSpanChild: !!elem.querySelector('span:not([class])'),
            textLength: text.length,
            charCodes: Array.from(text)
              .map((c) => c.charCodeAt(0))
              .join(','),
          });

          if (elem.querySelector('span:not([class])')) {
            const value = elem.querySelector('span')?.textContent?.trim();
            if (value) {
              parameters[value] = 'Tak';
              console.log(`Added span parameter: "${value}" = "Tak"`);
            }
            return;
          }

          const parts = text.split(':');
          console.log(`Split by colon - parts:`, parts);
          if (parts.length === 2) {
            const key = parts[0].trim();
            const value = parts[1].trim();
            if (key && value) {
              parameters[key] = value;
              console.log(`Added colon parameter: "${key}" = "${value}"`);
            }
          } else if (text.includes(' ')) {
            const [key, value] = text.split(' ');
            if (key && value) {
              parameters[key] = value;
              console.log(`Added space parameter: "${key}" = "${value}"`);
            }
          } else if (text) {
            parameters[text] = 'Tak';
            console.log(`Added flag parameter: "${text}" = "Tak"`);
          }
        });

        const locationElement = document.querySelector('.css-9pna1a');
        const locationText = locationElement?.textContent?.trim() || '';

        let city = '';
        let district = '';

        if (locationText) {
          const parts = locationText.split(',');
          if (parts.length >= 2) {
            city = parts[0].trim();
            district = parts[1].trim();
          } else {
            city = parts[0].trim();
          }
        }

        const images = Array.from(
          document.querySelectorAll('[data-testid="ad-photo"] img'),
        )
          .map((img) => img.getAttribute('src'))
          .filter((src): src is string => src !== null);

        const sellerName =
          document
            .querySelector('[data-testid="user-profile-user-name"]')
            ?.textContent?.trim() || null;
        const memberSince =
          document
            .querySelector('[data-testid="member-since"] span')
            ?.textContent?.trim() || null;
        const lastSeen =
          document
            .querySelector('[data-testid="lastSeenBox"] .css-1p85e15')
            ?.textContent?.trim() || null;

        let views = 0;
        let viewsExtractionMethod = 'none';

        console.log('=== VIEWS EXTRACTION UPDATED 2025 ===');
        console.log('Page URL:', window.location.href);
        console.log('Page has been scrolled to trigger lazy loading');

        const inactiveAdElement = document.querySelector(
          '[data-testid="ad-inactive-msg"]',
        );
        if (inactiveAdElement) {
          console.log('Method 1 - Ad inactive, views not available');
          views = 0;
          viewsExtractionMethod = 'inactive-ad';
        } else {
          console.log(
            'Method 1 - Ad is active, proceeding with views extraction',
          );
        }

        if (views === 0) {
          const selector = '[data-testid="page-view-counter"]';
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent?.trim() || '';
            console.log(
              `Modern selector 3 - Found element with selector ${selector}:`,
              text,
            );

            if (text.toLowerCase().includes('wyświetl')) {
              const viewsMatch = text.match(/(\d+)/);
              if (viewsMatch) {
                views = parseInt(viewsMatch[1]);
                viewsExtractionMethod = 'modern-selector-3';
                console.log(
                  'Modern selector 3 - SUCCESS extracted views:',
                  views,
                );
              }
            }
          }
        }

        console.log(
          `Final views extraction result: views=${views}, method=${viewsExtractionMethod}, url=${window.location.href}`,
        );

        console.log('City extraction debug:', {
          locationText,
          extractedCity: city,
          extractedDistrict: district,
          url: window.location.href,
        });

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
          debugInfo: string[];
          dateDebug: string[];
        };
      });

      if (!data) {
        throw new Error('Failed to extract data from OLX page');
      }

      const extractionData = data as typeof data & {
        viewsExtractionMethod: string;
        debugInfo?: string[];
        dateDebug?: string[];
      };

      this.logger.log(
        `Date extraction result: ${data.createdAt ? `"${data.createdAt}"` : 'NULL'} for URL: ${url}`,
      );

      this.logger.log(
        `DEBUG: dateDebug exists? ${!!extractionData.dateDebug}, length: ${extractionData.dateDebug?.length || 0}`,
      );

      if (extractionData.dateDebug && extractionData.dateDebug.length > 0) {
        this.logger.log('DATE EXTRACTION DEBUG FROM BROWSER:');
        extractionData.dateDebug.forEach((line) => {
          this.logger.log(`   ${line}`);
        });
      } else {
        this.logger.warn('No date debug information returned from browser!');
      }

      this.logger.log(
        `Views extraction for ${url}: ${data.views} views using method: ${extractionData.viewsExtractionMethod}`,
      );

      if (
        extractionData.debugInfo &&
        (data.views === 0 || process.env.DEBUG_VIEWS_EXTRACTION)
      ) {
        this.logger.debug(`Views extraction debug for ${url}:`);
        extractionData.debugInfo.forEach((debugLine, index) => {
          this.logger.debug(`   ${index + 1}. ${debugLine}`);
        });
      }

      const parsed = this.paramParser.parseOlxParameters(data.rawParameters);

      const findParamValue = (targetKey: string) =>
        this.paramParser.findParamValue(data.rawParameters, targetKey);

      console.log('Final boolean values before database update:', {
        elevator: parsed.elevator,
        pets: parsed.pets,
        furniture: parsed.furniture,
        title: data.title || 'unknown',
      });

      if (!data) {
        throw new Error('Failed to extract data from OLX page');
      }

      let extractedStreet: string | null = null;
      let extractedStreetNumber: string | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;

      try {
        if (data.title) {
          this.logger.debug(`Extracting address from: ${data.title}`);
          const addressResult = await this.scraperService.extractAddress(
            data.title,
            data.description || undefined,
          );

          if (addressResult.street) {
            const cleanedStreet = StreetNameCleaner.normalizeStreetName(
              addressResult.street,
            );

            if (StreetNameCleaner.isValidStreetName(cleanedStreet)) {
              extractedStreet = cleanedStreet;
              extractedStreetNumber = addressResult.streetNumber || null;
              this.logger.log(
                `Address extracted: ${extractedStreet}${extractedStreetNumber ? ` ${extractedStreetNumber}` : ''} (confidence: ${addressResult.confidence})`,
              );

              const fullAddress = `${extractedStreet}${extractedStreetNumber ? ` ${extractedStreetNumber}` : ''}, ${data.city}`;
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
          } else {
            this.logger.debug(
              'No address found in offer text - trying city-level geocoding',
            );
            if (data.city) {
              const cityAddress = data.district
                ? `${data.district}, ${data.city}`
                : data.city;
              const coordinates = await this.geocodeAddress(cityAddress);
              latitude = coordinates.latitude;
              longitude = coordinates.longitude;
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Address extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      const validCity =
        data.city && data.city.trim() !== '' ? data.city.trim() : 'Nieznane';

      const finalCreatedAt = data.createdAt
        ? new Date(data.createdAt)
        : new Date();

      const contactString = data.contact?.name
        ? `${data.contact.name}${data.contact.memberSince ? ` - Na OLX od ${data.contact.memberSince}` : ''}${data.contact.lastSeen ? ` - ${data.contact.lastSeen}` : ''}`
        : findParamValue('kontakt') || null;

      const summary = await this.generateSummary(
        data.title || '',
        data.description || '',
      );

      console.log('Final boolean values before OfferService:', {
        elevator: parsed.elevator,
        pets: parsed.pets,
        furniture: parsed.furniture,
        title: data.title,
      });

      const offerDto = this.mapperService.mapOlxToCreateOfferDto({
        url: url,
        title: data.title || '',
        price: data.price || 0,
        city: validCity,
        district: data.district || null,
        footage: parsed.footage || 0,
        description: data.description || '',
        summary: summary,
        street: extractedStreet,
        streetNumber: extractedStreetNumber,
        latitude: latitude,
        longitude: longitude,
        rooms: parsed.rooms ? parseInt(parsed.rooms) : null,
        floor: parsed.floor ? parseInt(parsed.floor) : null,
        furniture: parsed.furniture,
        elevator: parsed.elevator,
        pets: parsed.pets,
        negotiable: data.negotiable || false,
        ownerType: parsed.ownerType,
        buildingType: parsed.buildingType,
        parkingType: parsed.parkingType,
        rentAdditional: parsed.rentAdditional,
        contact: contactString,
        views: data.views,
        createdAt: finalCreatedAt,
        isNew: isNew,
        images: data.images || [],
        infoAdditional: findParamValue('informacje dodatkowe') || null,
        furnishing: findParamValue('wyposażenie') || null,
        media: findParamValue('media') || null,
      });

      const { offer: createdOffer, created } =
        await this.offerService.findOneOrCreate(offerDto);

      this.logger.log(
        `${created ? 'Created' : 'Updated'} OLX offer ${createdOffer.id} for ${url} - Views: ${data.views}`,
      );

      if (!created) {
        this.logger.debug(
          `Updated existing offer ${createdOffer.id} for URL: ${url}`,
        );
      }

      if (createdOffer?.id) {
        try {
          const matchCount = await this.matchService.processNewOffer(
            createdOffer.id,
          );
          this.logger.log(
            `Processed ${matchCount} matches for offer ${createdOffer.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to process matches for offer ${createdOffer.id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `OLX scraping completed for ${url} - Offer ID: ${createdOffer?.id}, Views: ${data.views}, Method: ${extractionData.viewsExtractionMethod}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing OLX offer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  public async processOtodomOffer(page: Page, url: string, isNew = false) {
    try {
      const data = await page.evaluate(() => {
        const priceElement =
          document.querySelector('[data-cy="adPageHeaderPrice"]') ||
          document.querySelector('strong[aria-label="Cena"]') ||
          document.querySelector('.css-1o51x5a.elm6lnc1') ||
          document.querySelector('.elm6lnc1');
        const price = priceElement?.textContent?.trim() ?? null;

        const titleElement =
          document.querySelector('[data-cy="adPageAdTitle"]') ||
          document.querySelector('h1.css-4utb9r.e1dqm4hr1') ||
          document.querySelector('h1');
        const title = titleElement?.textContent?.trim() ?? null;

        const addressElement =
          document.querySelector('a[href="#map"].css-1eowip8.e1aypsbg1') ||
          document.querySelector('.e1aypsbg1') ||
          document.querySelector('a[href="#map"]');
        const address = addressElement?.textContent?.trim() ?? null;

        const descElement =
          document.querySelector('[data-cy="adPageAdDescription"]') ||
          document.querySelector('.css-1nuh7jg.e1op7yyl1') ||
          document.querySelector('.e1op7yyl1');
        const description = descElement?.textContent?.trim() ?? null;

        const footageElement = Array.from(
          document.querySelectorAll('.css-1okys8k.e1mm5aqc2, .e1mm5aqc2'),
        ).find((el) => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('m²') && /\d+\s*m²/.test(text);
        });
        const footage = footageElement?.textContent?.trim() ?? null;

        const images = Array.from(document.querySelectorAll('img'))
          .map((img) => img.getAttribute('src'))
          .filter(
            (src) => src && (src.includes('otodom') || src.includes('cdn')),
          )
          .slice(0, 10);

        let views = 0;
        const viewsDebug: string[] = [];
        viewsDebug.push('=== OTODOM VIEWS EXTRACTION DEBUG ===');

        const viewsElement = document.querySelector(
          '.css-lcnm6u.e3km50a2, .e3km50a2',
        );
        if (viewsElement) {
          const viewsText = viewsElement.textContent?.trim() || '';
          viewsDebug.push(`Method 1: Found views element: "${viewsText}"`);
          const viewsMatch = viewsText.match(/(\d+)/);
          if (viewsMatch) {
            views = parseInt(viewsMatch[1]);
            viewsDebug.push(`  Extracted views: ${views}`);
          }
        } else {
          viewsDebug.push('Method 1: Views element not found');

          const statsContainer = document.querySelector(
            '.css-1jzjbfr.e3km50a0, .e3km50a0',
          );
          if (statsContainer) {
            viewsDebug.push(
              'Method 2: Found statistics container, searching for views',
            );
            const allText = statsContainer.textContent || '';
            const viewsMatch = allText.match(/(\d+)\s*wyświetl/i);
            if (viewsMatch) {
              views = parseInt(viewsMatch[1]);
              viewsDebug.push(`  Extracted views from container: ${views}`);
            } else {
              viewsDebug.push('  No views pattern found in container');
            }
          } else {
            viewsDebug.push('Method 2: Statistics container not found');
          }
        }

        if (views === 0) {
          viewsDebug.push('Method 3: Searching entire page for views...');
          const bodyText = document.body.textContent || '';
          const viewsPattern = /(\d+)\s*wyświetl/i;
          const match = bodyText.match(viewsPattern);
          if (match) {
            views = parseInt(match[1]);
            viewsDebug.push(`  Method 3 success: ${views} views`);
          } else {
            viewsDebug.push('  No views pattern found in page');
          }
        }

        if (views === 0) {
          viewsDebug.push(
            'Method 4: Looking for elements near "wyświetleń"...',
          );
          const allElements = document.querySelectorAll(
            '[class*="e3km50a"], [class*="stat"], [class*="view"]',
          );
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const text = el.textContent?.toLowerCase() || '';
            if (text.includes('wyświetl')) {
              const numMatch = text.match(/(\d+)/);
              if (numMatch) {
                views = parseInt(numMatch[1]);
                viewsDebug.push(
                  `  Method 4 success: Found ${views} views near "wyświetleń"`,
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
            'All methods failed - No views found, defaulting to 0',
          );
          viewsDebug.push(
            'This may indicate CloudFront blocking or page structure change',
          );
        } else {
          viewsDebug.push(`Successfully extracted ${views} views`);
        }

        viewsDebug.push(`=== FINAL VIEWS: ${views} ===`);

        let createdAt: string | null = null;
        const dateDebug: string[] = [];
        dateDebug.push('=== OTODOM DATE EXTRACTION DEBUG ===');

        const historyRows = document.querySelectorAll(
          '.css-17wo1v5.etrn3wv7, .etrn3wv7',
        );
        dateDebug.push(
          `Method 1: Found ${historyRows.length} history rows in "Historia i statystyki"`,
        );

        for (let i = 0; i < historyRows.length; i++) {
          const row = historyRows[i];
          const cells = Array.from(row.querySelectorAll('.etrn3wv2'));

          dateDebug.push(`  Row ${i}: Found ${cells.length} cells`);

          if (cells.length >= 2) {
            const dateCell = cells[0];
            const actionCell = cells[1];

            const dateText = dateCell.textContent?.trim() || '';
            const actionText = actionCell.textContent?.trim() || '';

            dateDebug.push(
              `  Row ${i}: date="${dateText}", action="${actionText}"`,
            );

            if (
              actionText.toLowerCase().includes('dodanie') &&
              actionText.toLowerCase().includes('ogłoszenia')
            ) {
              dateDebug.push(`  ✓ Found "Dodanie ogłoszenia" row`);
              const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
              if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]) - 1;
                const year = parseInt(dateMatch[3]);

                createdAt = new Date(Date.UTC(year, month, day)).toISOString();
                dateDebug.push(
                  `  Parsed date: ${day}.${month + 1}.${year} -> ${createdAt}`,
                );
                break;
              } else {
                dateDebug.push(`  Date format not matched: "${dateText}"`);
              }
            }
          }
        }

        if (!createdAt) {
          dateDebug.push(
            'Method 2: Trying alternative history row selectors...',
          );
          const altHistoryRows = document.querySelectorAll(
            '[class*="etrn3wv"], div[class*="history"] tr, table tr',
          );
          dateDebug.push(
            `  Found ${altHistoryRows.length} alternative history rows`,
          );

          for (let i = 0; i < Math.min(altHistoryRows.length, 20); i++) {
            const row = altHistoryRows[i];
            const rowText = row.textContent?.toLowerCase() || '';

            if (rowText.includes('dodanie') && rowText.includes('ogłoszenia')) {
              dateDebug.push(`  Found potential row at index ${i}`);
              const dateMatch = row.textContent?.match(
                /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
              );
              if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]) - 1;
                const year = parseInt(dateMatch[3]);

                createdAt = new Date(Date.UTC(year, month, day)).toISOString();
                dateDebug.push(
                  `  ✓ Method 2 success: ${day}.${month + 1}.${year} -> ${createdAt}`,
                );
                break;
              }
            }
          }
        }

        if (!createdAt) {
          dateDebug.push(
            'Method 3: Searching entire page content for creation date...',
          );
          const bodyText = document.body.textContent || '';
          const creationPattern =
            /Dodanie\s+ogłoszenia[\s\S]{0,100}?(\d{1,2})\.(\d{1,2})\.(\d{4})/i;
          const match = bodyText.match(creationPattern);

          if (match) {
            const day = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const year = parseInt(match[3]);

            createdAt = new Date(Date.UTC(year, month, day)).toISOString();
            dateDebug.push(
              `  Method 3 success: ${day}.${month + 1}.${year} -> ${createdAt}`,
            );
          } else {
            dateDebug.push('  No date pattern found in page content');
          }
        }

        if (!createdAt) {
          dateDebug.push('Method 4: Looking for dates near "Historia"...');
          const historySection = document.querySelector(
            '[class*="history"], [class*="Historia"], [data-cy*="history"]',
          );
          if (historySection) {
            const sectionText = historySection.textContent || '';
            const allDates = sectionText.match(
              /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
            );
            if (allDates && allDates.length > 0) {
              dateDebug.push(`  Found ${allDates.length} dates in history`);
              const oldestDate = allDates[allDates.length - 1];
              const match = oldestDate.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
              if (match) {
                const day = parseInt(match[1]);
                const month = parseInt(match[2]) - 1;
                const year = parseInt(match[3]);

                createdAt = new Date(Date.UTC(year, month, day)).toISOString();
                dateDebug.push(
                  `  Method 4 success (oldest date): ${oldestDate} -> ${createdAt}`,
                );
              }
            } else {
              dateDebug.push('  No dates found in history section');
            }
          } else {
            dateDebug.push('  History section not found');
          }
        }

        if (!createdAt) {
          dateDebug.push(
            'Method 5: Looking for dates in Otodom paragraph classes...',
          );
          const dateParagraphs = document.querySelectorAll(
            'p.css-f4ltfo, .css-f4ltfo, p[class*="f4ltfo"]',
          );
          dateDebug.push(`  Found ${dateParagraphs.length} date paragraphs`);

          for (let i = 0; i < dateParagraphs.length; i++) {
            const p = dateParagraphs[i];
            const text = p.textContent?.trim() || '';
            const dateMatch = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

            if (dateMatch) {
              const day = parseInt(dateMatch[1]);
              const month = parseInt(dateMatch[2]) - 1;
              const year = parseInt(dateMatch[3]);
              createdAt = new Date(Date.UTC(year, month, day)).toISOString();
              dateDebug.push(
                `  Method 5 success at index ${i}: ${text} -> ${createdAt}`,
              );
              break;
            }
          }

          if (!createdAt) {
            dateDebug.push('  No valid dates found in paragraphs');
          }
        }

        if (!createdAt) {
          dateDebug.push(
            'All methods failed - No creation date found, will use current date',
          );
          dateDebug.push(
            'This may indicate CloudFront blocking or page structure change',
          );
        } else {
          dateDebug.push(`Successfully extracted creation date: ${createdAt}`);
        }

        dateDebug.push(`=== FINAL CREATED_AT: ${createdAt} ===`);

        const details: Record<string, string> = {};

        const detailSections = document.querySelectorAll(
          '.css-1xw0jqp.e1mm5aqc1, .e1mm5aqc1',
        );
        detailSections.forEach((section) => {
          const keyElement = section.querySelector(
            '.css-1okys8k.e1mm5aqc2:first-child, .e1mm5aqc2:first-child',
          );
          const valueElement = section.querySelector(
            '.css-1okys8k.e1mm5aqc2:last-child, .e1mm5aqc2:last-child',
          );

          if (keyElement && valueElement) {
            const key = keyElement.textContent
              ?.trim()
              .toLowerCase()
              .replace(':', '');

            const spans = valueElement.querySelectorAll(
              'span.css-axw7ok.e1mm5aqc4, span.e1mm5aqc4, span',
            );
            let value = valueElement.textContent?.trim();

            if (spans.length > 0) {
              const spanTexts = Array.from(spans)
                .map((span) => span.textContent?.trim())
                .filter((text) => text && text.length > 0)
                .join(', ');
              if (spanTexts) {
                value = spanTexts;
              }
            }

            if (key && value && key !== value) {
              details[key] = value;

              if (key.includes('powierzchnia') || key.includes('m²')) {
                details['powierzchnia'] = value;
              }
              if (key.includes('pokoi') || key.includes('rooms')) {
                details['liczba pokoi'] = value;
                details['pokoi'] = value;
              }
              if (key.includes('piętro') || key.includes('floor')) {
                details['piętro'] = value;
              }

              if (key.includes('winda') || key.includes('elevator')) {
                details['winda'] = value;
              }
              if (
                key.includes('rodzaj zabudowy') ||
                key.includes('building type')
              ) {
                details['typ budynku'] = value;
              }
              if (
                key.includes('umeblowani') ||
                key.includes('furnished') ||
                key.includes('umeblowanie')
              ) {
                details['umeblowane'] = value;
              }
              if (key.includes('czynsz') && !key.includes('kaucja')) {
                details['czynsz dodatkowy'] = value;
              }
              if (
                key.includes('dostępne od') ||
                key.includes('available from')
              ) {
                details['kontakt'] = `Dostępne od: ${value}`;
              }
              if (
                key.includes('typ ogłoszeniodawcy') ||
                key.includes('advertiser type')
              ) {
                details['typ ogłoszeniodawcy'] = value;
              }
              if (
                key.includes('informacje dodatkowe') ||
                key.includes('additional information')
              ) {
                details['informacje dodatkowe'] = value;
              }
              if (
                key.includes('wyposażenie') &&
                !key.includes('bezpieczeństwo') &&
                !key.includes('zabezpieczenia')
              ) {
                details['wyposażenie'] = value;
              }
              if (key.includes('media') && !key.includes('social')) {
                details['media'] = value;
              }
            }
          }
        });

        const allTextElements = document.querySelectorAll(
          '.css-1okys8k.e1mm5aqc2, .e1mm5aqc2',
        );
        for (let i = 0; i < allTextElements.length - 1; i += 2) {
          const keyEl = allTextElements[i];
          const valueEl = allTextElements[i + 1];
          if (keyEl && valueEl) {
            const keyText =
              keyEl.textContent?.trim().toLowerCase().replace(':', '') || '';
            const valueText = valueEl.textContent?.trim() || '';

            if (
              keyText &&
              valueText &&
              keyText !== valueText &&
              !details[keyText]
            ) {
              details[keyText] = valueText;

              if (keyText.includes('powierzchnia') || keyText.includes('m²')) {
                details['powierzchnia'] = valueText;
              }
              if (keyText.includes('pokoi')) {
                details['liczba pokoi'] = valueText;
                details['pokoi'] = valueText;
              }
              if (keyText.includes('piętro')) {
                details['piętro'] = valueText;
              }

              if (keyText.includes('winda')) {
                details['winda'] = valueText;
              }
              if (keyText.includes('rodzaj zabudowy')) {
                details['typ budynku'] = valueText;
              }
              if (
                keyText.includes('umeblowani') ||
                keyText.includes('umeblowanie')
              ) {
                details['umeblowane'] = valueText;
              }
              if (keyText.includes('czynsz') && !keyText.includes('kaucja')) {
                details['czynsz dodatkowy'] = valueText;
              }
              if (keyText.includes('dostępne od')) {
                details['kontakt'] = `Dostępne od: ${valueText}`;
              }
              if (keyText.includes('typ ogłoszeniodawcy')) {
                details['typ ogłoszeniodawcy'] = valueText;
              }
              if (keyText.includes('informacje dodatkowe')) {
                details['informacje dodatkowe'] = valueText;
              }
              if (
                keyText.includes('wyposażenie') &&
                !keyText.includes('bezpieczeństwo') &&
                !keyText.includes('zabezpieczenia')
              ) {
                details['wyposażenie'] = valueText;
              }
              if (keyText.includes('media') && !keyText.includes('social')) {
                details['media'] = valueText;
              }
            }
          }
        }

        if (details['wyposażenie']) {
          const equipmentValue = details['wyposażenie'].toLowerCase();
          if (equipmentValue.includes('meble')) {
            details['umeblowane'] = 'tak';
          }
        }

        Object.entries(details).forEach(([, value]) => {
          if (value && value.toLowerCase().includes('meble')) {
            details['umeblowane'] = 'tak';
          }
        });

        let contact: string | null = null;

        const sellerNameElement = document.querySelector(
          '.e4jldvc1.css-vbzhap',
        );
        let sellerName = sellerNameElement?.textContent?.trim() || null;

        if (sellerName) {
          const dashIndex = sellerName.indexOf(' - ');
          if (dashIndex !== -1) {
            const afterDash = sellerName.substring(dashIndex + 3).toLowerCase();
            const promotionalKeywords = [
              'włącz',
              'powiadomienia',
              'okazji',
              'przegap',
              'nie przegap',
              'subskryb',
              'subscribe',
              'follow',
              'obserwuj',
            ];

            if (
              promotionalKeywords.some((keyword) => afterDash.includes(keyword))
            ) {
              sellerName = sellerName.substring(0, dashIndex);
            }
          }

          sellerName = sellerName.replace(/[\s-]+$/, '').trim();
        }

        const offerTypeElement = document.querySelector('.css-f4ltfo');
        const offerType = offerTypeElement?.textContent?.trim() || null;

        if (sellerName || offerType) {
          const contactParts: string[] = [];
          if (sellerName) contactParts.push(sellerName);
          if (offerType) contactParts.push(offerType);
          contact = contactParts.join(' - ');
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
          source: 'otodom' as const,
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
        `OTODOM: Extracted ${extractionData.views} views for ${url}`,
      );
      this.logger.log(
        `OTODOM: Extracted createdAt: ${extractionData.createdAt ? `"${extractionData.createdAt}"` : 'NULL (will use current time)'} for ${url}`,
      );

      if (extractionData.viewsDebug && extractionData.viewsDebug.length > 0) {
        this.logger.debug('OTODOM VIEWS EXTRACTION DEBUG:');
        extractionData.viewsDebug.forEach((line) => {
          this.logger.debug(`   ${line}`);
        });
      }

      if (extractionData.dateDebug && extractionData.dateDebug.length > 0) {
        this.logger.debug('OTODOM DATE EXTRACTION DEBUG:');
        extractionData.dateDebug.forEach((line) => {
          this.logger.debug(`   ${line}`);
        });
      }

      if (extractionData.views === 0 && !extractionData.createdAt) {
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

      const priceValue = data.price
        ? parseFloat(data.price.replace(/[^0-9,]/g, '').replace(',', '.'))
        : 0;
      const address = data.address?.split(',') || [];

      let extractedStreet: string | null = null;
      let extractedStreetNumber: string | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;

      try {
        const addressText = data.address || '';
        if (data.title || addressText) {
          this.logger.debug(
            `Extracting Otodom address from: ${data.title}, Address: ${addressText}`,
          );
          const addressResult = await this.scraperService.extractAddress(
            data.title || '',
            addressText || data.description || undefined,
          );

          if (addressResult.street) {
            const cleanedStreet = StreetNameCleaner.normalizeStreetName(
              addressResult.street,
            );

            if (StreetNameCleaner.isValidStreetName(cleanedStreet)) {
              extractedStreet = cleanedStreet;
              extractedStreetNumber = addressResult.streetNumber || null;
              this.logger.log(
                `Otodom address extracted: ${extractedStreet}${extractedStreetNumber ? ` ${extractedStreetNumber}` : ''} (confidence: ${addressResult.confidence})`,
              );

              const city = address[address.length - 2]?.trim() || 'Nieznane';
              const fullAddress = `${extractedStreet}${extractedStreetNumber ? ` ${extractedStreetNumber}` : ''}, ${city}`;
              const coordinates = await this.geocodeAddress(fullAddress, city);
              latitude = coordinates.latitude;
              longitude = coordinates.longitude;
            } else {
              this.logger.warn(
                `Rejected invalid Otodom street after final cleaning: ${addressResult.street} -> ${cleanedStreet}`,
              );
            }
          } else {
            this.logger.debug(
              'No address found in Otodom offer text - trying location geocoding',
            );

            const city = address[address.length - 2]?.trim() || 'Nieznane';
            const district = address[address.length - 3]?.trim();
            const geocodingAddress =
              addressText || (district ? `${district}, ${city}` : city);
            if (geocodingAddress && geocodingAddress !== 'Nieznane') {
              const coordinates = await this.geocodeAddress(geocodingAddress);
              latitude = coordinates.latitude;
              longitude = coordinates.longitude;
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Otodom address extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      const findParamValue = (targetKey: string) =>
        this.paramParser.findParamValue(data.details, targetKey);

      const furniture = this.paramParser.parseBoolean(
        findParamValue('umeblowane'),
        'Furniture (Otodom)',
      );

      const elevator = this.paramParser.parseBoolean(
        findParamValue('winda'),
        'Elevator (Otodom)',
      );

      const ownerType = this.paramParser.parseOwnerType(data.details);

      const city = address[address.length - 2]?.trim() || 'Nieznane';
      const district = address[address.length - 3]?.trim() || null;

      const finalCreatedAt = data.createdAt
        ? new Date(data.createdAt)
        : new Date();

      const summary = await this.generateSummary(
        data.title || '',
        data.description || '',
      );

      const offerDto = this.mapperService.mapOtodomToCreateOfferDto({
        url: url,
        title: data.title || '',
        price: priceValue,
        city: city,
        district: district,
        footage:
          this.paramParser.parseOtodomFootage(data.footage, data.details) || 0,
        description: data.description || '',
        summary: summary,
        street: extractedStreet,
        streetNumber: extractedStreetNumber,
        latitude: latitude,
        longitude: longitude,
        rooms:
          parseInt(data.details['liczba pokoi'] || data.details['pokoi']) ||
          null,
        floor: parseInt(data.details['piętro']) || null,
        furniture: furniture,
        elevator: elevator,
        ownerType: ownerType,
        buildingType: BuildingType.APARTMENT,
        contact: typeof data.contact === 'string' ? data.contact : null,
        views: data.views || 0,
        createdAt: finalCreatedAt,
        isNew: isNew,
        images: data.images || [],
        infoAdditional: data.details['informacje dodatkowe'] || null,
        furnishing: data.details['wyposażenie'] || null,
        media: data.details['media'] || null,
      });

      const { offer: createdOffer, created } =
        await this.offerService.findOneOrCreate(offerDto);

      this.logger.log(
        `${created ? 'Created' : 'Updated'} Otodom offer ${createdOffer.id} for ${url} - Views: ${data.views || 0}`,
      );

      if (!created) {
        this.logger.debug(
          `Updated existing Otodom offer ${createdOffer.id} for URL: ${url}`,
        );
      }

      if (createdOffer?.id) {
        try {
          const matchCount = await this.matchService.processNewOffer(
            createdOffer.id,
          );
          this.logger.log(
            `Processed ${matchCount} matches for Otodom offer ${createdOffer.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to process matches for Otodom offer ${createdOffer.id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Otodom scraping completed for ${url} - Offer ID: ${createdOffer?.id}, Views: ${data.views || 0}, CreatedAt: ${data.createdAt || 'current time'}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing Otodom offer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
