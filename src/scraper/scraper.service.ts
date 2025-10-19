import type { Queue } from "bullmq";
import type { Browser } from "puppeteer";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { DatabaseService } from "../database/database.service";
import type { AddressExtractionResult } from "./dto/address-extraction.interface";
import { aiAddressExtractorService } from "./services/ai-address-extractor.service";
import { BrowserSetupService } from "./services/browser-setup.service";
import { OtodomAuthService } from "./services/otodom-auth.service";
import { ScraperThreadManagerService } from "./services/scraper-thread-manager.service";

export enum SortOrder {
  NEWEST = "created_at:desc",
  OLDEST = "created_at:asc",
  PRICE_LOW_TO_HIGH = "filter_float_price:asc",
  PRICE_HIGH_TO_LOW = "filter_float_price:desc",
}

@Injectable()
export class ScraperService implements OnModuleInit {
  private readonly logger = new Logger(ScraperService.name);
  private readonly olxBaseUrl = "https://www.olx.pl";
  private readonly otodomBaseUrl = "https://www.otodom.pl";
  private readonly defaultSortOrder = SortOrder.NEWEST;

  constructor(
    @InjectQueue("olx-existing") private readonly olxExistingQueue: Queue,
    @InjectQueue("otodom-existing")
    private readonly otodomExistingQueue: Queue,
    @InjectQueue("olx-new") private readonly olxNewQueue: Queue,
    @InjectQueue("otodom-new") private readonly otodomNewQueue: Queue,
    private readonly aiExtractor: aiAddressExtractorService,
    private readonly threadManager: ScraperThreadManagerService,
    private readonly databaseService: DatabaseService,
    private readonly browserSetup: BrowserSetupService,
    private readonly otodomAuth: OtodomAuthService,
  ) {}

  onModuleInit() {
    this.logger.log(
      "Starting initial multi-threaded scraping on application startup...",
    );

    setTimeout(() => {
      void this.startInitialScrapingForExistingOffers();
    }, 5000);
  }

  private async startInitialScrapingForExistingOffers() {
    this.logger.log(
      "Starting initial scraping for existing offers (2 dedicated workers)...",
    );

    try {
      await this.threadManager.startExistingOffersWorkers();
      this.logger.log("Initial scraping workers for existing offers started");
    } catch (error) {
      this.logger.error(
        "Error in initial scraping for existing offers:",
        error,
      );
    }
  }

  private normalizeOlxUrl(url: string): string {
    if (url === "") {
      return "";
    }
    try {
      if (url.startsWith("http")) {
        return url;
      }
      return url.startsWith("/")
        ? `${this.olxBaseUrl}${url}`
        : `${this.olxBaseUrl}/${url}`;
    } catch (error) {
      this.logger.error(
        `Error normalizing OLX URL: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return "";
    }
  }

  @Cron("0 * * * * *")
  async monitorNewOffers() {
    this.logger.log("Monitoring for new offers (2 dedicated workers)...");

    try {
      await this.threadManager.startNewOffersWorkers();
    } catch (error) {
      this.logger.error("Error monitoring new offers:", error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    try {
      this.logger.log(
        "Starting scraping job for OLX and Otodom with newest listings first",
      );

      const useThreads = process.env.USE_SCRAPER_THREADS !== "false";

      if (useThreads) {
        this.logger.log("Using enhanced browser pool scraping approach");

        await Promise.all([
          this.threadManager.startExistingOffersWorkers(),
          this.threadManager.startNewOffersWorkers(),
        ]);

        return {
          message: "Enhanced scraping completed successfully",
          mode: "enhanced-browser-pool",
        };
      } else {
        this.logger.log("Using traditional concurrent scraping approach");

        const [olxResult, otodomResult] = await Promise.allSettled([
          this.scrapeOlxListings().catch((error: unknown) => {
            this.logger.error("OLX scraping failed:", error);
            return {
              error: `OLX failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }),
          this.scrapeOtodomListings().catch((error: unknown) => {
            this.logger.error("Otodom scraping failed:", error);
            return {
              error: `Otodom failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }),
        ]);

        this.logger.log(
          "OLX scraping result:",
          olxResult.status === "fulfilled" ? "Success" : "Failed",
        );
        this.logger.log(
          "Otodom scraping result:",
          otodomResult.status === "fulfilled" ? "Success" : "Failed",
        );

        return {
          message: "Scraping job started successfully for both OLX and Otodom",
          olx: olxResult.status,
          otodom: otodomResult.status,
          mode: "concurrent",
        };
      }
    } catch (error) {
      this.logger.error("Error in handleCron:", error);
      if (error instanceof Error) {
        this.logger.error("Error details:", error.message, error.stack);
      }
      throw new Error(
        `Failed to start scraping: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async scrapeOlxListings(
    pageNumber = 1,
    sortOrder: SortOrder = this.defaultSortOrder,
  ) {
    let browser: Browser | undefined;

    try {
      this.logger.log(
        `Scraping page ${String(pageNumber)} with sort order: ${sortOrder}`,
      );
      const url = `${this.olxBaseUrl}/nieruchomosci/mieszkania/wynajem/?search[order]=${sortOrder}&page=${String(pageNumber)}`;

      browser = await this.createBrowser();
      const page = await this.setupPage(browser);

      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 30_000,
      });

      await page.waitForSelector('[data-cy="l-card"]', { timeout: 10_000 });

      const offers = await page.evaluate((): string[] => {
        const cards = document.querySelectorAll('[data-cy="l-card"]');
        return [...cards]
          .map((card) => {
            const link = card.querySelector('a[href*="/d/"]');
            return link?.getAttribute("href") ?? null;
          })
          .filter((href): href is string => href !== null);
      });

      const normalizedOffers = offers.map((link) => this.normalizeOlxUrl(link));

      this.logger.log(
        `Found ${String(normalizedOffers.length)} offers to process`,
      );

      for (const offerUrl of normalizedOffers) {
        await this.queueOffer(offerUrl, 4);
      }

      const hasNextPage = await page.$$eval(
        '[data-testid="pagination-wrapper"] [data-testid="pagination-forward"]',
        (elements) => elements.length > 0,
      );

      if (hasNextPage && pageNumber < 25) {
        await this.scrapeOlxListings(pageNumber + 1, sortOrder);
      }
    } catch (error) {
      this.logger.error(
        `Error scraping listings page ${String(pageNumber)}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      if (browser !== undefined) {
        await browser.close();
      }
    }
  }

  private async scrapeOtodomListings(pageNumber = 1) {
    let browser: Browser | undefined;

    try {
      this.logger.log(
        `Scraping Otodom page ${String(pageNumber)} with newest listings first`,
      );
      const url = `${this.otodomBaseUrl}/pl/wyniki/wynajem/mieszkanie/cala-polska?ownerTypeSingleSelect=ALL&by=LATEST&direction=DESC&page=${String(pageNumber)}&limit=72`;
      this.logger.debug(`Otodom URL: ${url}`);

      browser = await this.createBrowser();
      const page = await this.setupPage(browser, true);

      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 30_000,
      });

      await page.waitForSelector(
        'article[data-sentry-component="AdvertCard"]',
        {
          timeout: 10_000,
        },
      );
      this.logger.debug(
        `Otodom listing cards loaded on page ${String(pageNumber)}`,
      );

      const offers = await page.evaluate((): string[] => {
        const linkElements = document.querySelectorAll(
          'a[data-cy="listing-item-link"][href*="/pl/oferta/"]',
        );
        return [...linkElements]
          .map((link) => {
            const href = link.getAttribute("href");
            const startsWithSlash = href?.startsWith("/") ?? false;
            if (href !== null && startsWithSlash) {
              return `https://www.otodom.pl${href}`;
            }
            return href;
          })
          .filter((href): href is string => href !== null);
      });

      const otodomOffers = offers;

      this.logger.log(
        `Found ${String(otodomOffers.length)} Otodom offers to process on page ${String(pageNumber)}`,
      );
      if (pageNumber === 1) {
        this.logger.debug(
          `Sample Otodom URLs: ${otodomOffers.slice(0, 3).join(", ")}`,
        );
      }

      this.logger.log(
        `Processing ${String(otodomOffers.length)} Otodom offers directly (bypassing queue)`,
      );

      let processedCount = 0;
      let errorCount = 0;

      for (const offerUrl of otodomOffers) {
        try {
          await this.otodomExistingQueue.add(
            "processOffer",
            { url: offerUrl },
            {
              priority: 4,
              attempts: 3,
              removeOnComplete: false,
            },
          );

          processedCount++;
          this.logger.log(
            `Processed Otodom offer ${String(processedCount)}/${String(otodomOffers.length)}: ${offerUrl}`,
          );
        } catch (error) {
          errorCount++;
          this.logger.error(
            `Failed to process Otodom offer ${offerUrl}:`,
            error instanceof Error ? error.message : "Unknown error",
          );
        }
      }

      this.logger.log(
        `Otodom direct processing complete: ${String(processedCount)} successful, ${String(errorCount)} failed`,
      );
      const hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector(
          '[data-cy="pagination.next-page"]:not([disabled])',
        );
        const hasNext = Boolean(nextButton);
        return hasNext;
      });

      this.logger.debug(
        `Otodom page ${String(pageNumber)}: hasNextPage=${String(hasNextPage)}, pageLimit=${String(pageNumber < 500)}`,
      );
      if (hasNextPage && pageNumber < 500) {
        this.logger.log(`Moving to Otodom page ${String(pageNumber + 1)}...`);
        await this.scrapeOtodomListings(pageNumber + 1);
      } else if (pageNumber >= 500) {
        this.logger.log(`Reached Otodom page limit (500), stopping pagination`);
      } else {
        this.logger.log(
          `No more Otodom pages available, completed at page ${String(pageNumber)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error scraping Otodom listings page ${String(pageNumber)}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      if (error instanceof Error) {
        this.logger.error(
          "Otodom scraping error details:",
          error.message,
          error.stack,
        );
      }
    } finally {
      if (browser !== undefined) {
        this.logger.debug(
          `Closing Otodom browser for page ${String(pageNumber)}`,
        );
        await browser.close();
      }
    }
  }

  private async createBrowser(): Promise<Browser> {
    return this.browserSetup.createBrowser();
  }

  private async setupPage(browser: Browser, forOtodom = false) {
    return this.browserSetup.setupPage(browser, forOtodom);
  }

  private async queueOffer(offerUrl: string, priority = 1, isNew = false) {
    try {
      const offerType = isNew ? "NEW" : "EXISTING";
      this.logger.log(
        `Attempting to queue ${offerType} offer: ${offerUrl} with priority ${String(priority)}`,
      );

      const isOtodom = offerUrl.includes("otodom.pl");
      let targetQueue: Queue;
      let queueName: string;

      if (isOtodom) {
        targetQueue = isNew ? this.otodomNewQueue : this.otodomExistingQueue;
        queueName = isNew ? "otodom-new" : "otodom-existing";
      } else {
        targetQueue = isNew ? this.olxNewQueue : this.olxExistingQueue;
        queueName = isNew ? "olx-new" : "olx-existing";
      }

      const job = await targetQueue.add(
        "processOffer",
        { url: offerUrl, isNew },
        {
          priority,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: isNew ? 1000 : 2000,
          },
          removeOnComplete: false,
        },
      );

      this.logger.log(
        `Successfully queued ${offerType} job ID: ${job.id ?? "unknown"} to ${queueName} for URL: ${offerUrl}`,
      );

      if (isNew) {
        const queueStatus = await targetQueue.getJobCounts();
        this.logger.log(
          `Queue status for ${queueName} after new offer: ${JSON.stringify(queueStatus)}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to queue job for ${offerUrl}:`, error);
      throw error;
    }
  }

  public async scrapeWithSortOrder(sortOrder: SortOrder = SortOrder.NEWEST) {
    try {
      this.logger.log(`Starting manual scraping with sort order: ${sortOrder}`);
      await this.scrapeOlxListings(1, sortOrder);
      return { message: `Scraping started with sort order: ${sortOrder}` };
    } catch (error) {
      this.logger.error("Error in scrapeWithSortOrder:", error);
      throw new Error(
        `Failed to start scraping: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  public async extractAddress(
    title: string,
    description?: string,
  ): Promise<AddressExtractionResult> {
    const textToAnalyze =
      description !== undefined && description !== ""
        ? `${title}. ${description}`
        : title;

    this.logger.log(
      `Extracting address from text: ${textToAnalyze.slice(0, 100)}...`,
    );

    if (this.aiExtractor.isAvailable()) {
      try {
        const aiResult = await this.aiExtractor.extractAddress(
          title,
          description,
        );

        if (aiResult !== null && (aiResult.confidence ?? 0) >= 0) {
          this.logger.log(
            `AI successfully extracted address: ${aiResult.fullAddress ?? "unknown"} (confidence: ${String(aiResult.confidence ?? 0)})`,
          );
          return aiResult;
        }
      } catch (error) {
        this.logger.warn(
          `AI extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    } else {
      const status = this.aiExtractor.getStatus();
      this.logger.debug(`AI not available: ${status.reason ?? "unknown"}`);
    }

    return {
      street: undefined,
      streetNumber: undefined,
      fullAddress: undefined,
      extractedFrom: "title",
      rawText: textToAnalyze,
      confidence: 0,
    };
  }
}
