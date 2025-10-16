import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import type { Browser } from 'puppeteer';
import type { AddressExtractionResult } from './dto/address-extraction.interface';

import { aiAddressExtractorService } from './services/ai-address-extractor.service';
import { ScraperThreadManagerService } from './services/scraper-thread-manager.service';
import { BrowserSetupService } from './services/browser-setup.service';
import { OtodomAuthService } from './services/otodom-auth.service';
import { DatabaseService } from '../database/database.service';

export enum SortOrder {
  NEWEST = 'created_at:desc',
  OLDEST = 'created_at:asc',
  PRICE_LOW_TO_HIGH = 'filter_float_price:asc',
  PRICE_HIGH_TO_LOW = 'filter_float_price:desc',
}

@Injectable()
export class ScraperService implements OnModuleInit {
  private readonly logger = new Logger(ScraperService.name);
  private readonly olxBaseUrl = 'https://www.olx.pl';
  private readonly otodomBaseUrl = 'https://www.otodom.pl';
  private readonly defaultSortOrder = SortOrder.NEWEST;

  constructor(
    @InjectQueue('olx-existing') private readonly olxExistingQueue: Queue,
    @InjectQueue('otodom-existing')
    private readonly otodomExistingQueue: Queue,
    @InjectQueue('olx-new') private readonly olxNewQueue: Queue,
    @InjectQueue('otodom-new') private readonly otodomNewQueue: Queue,
    private readonly aiExtractor: aiAddressExtractorService,
    private readonly threadManager: ScraperThreadManagerService,
    private readonly databaseService: DatabaseService,
    private readonly browserSetup: BrowserSetupService,
    private readonly otodomAuth: OtodomAuthService,
  ) {}

  onModuleInit() {
    this.logger.log(
      'Starting initial multi-threaded scraping on application startup...',
    );

    setTimeout(() => {
      void this.startInitialScrapingForExistingOffers();
    }, 5000);
  }

  private async startInitialScrapingForExistingOffers() {
    this.logger.log(
      'Starting initial scraping for existing offers (2 dedicated workers)...',
    );

    try {
      await this.threadManager.startExistingOffersWorkers();
      this.logger.log('Initial scraping workers for existing offers started');
    } catch (error) {
      this.logger.error(
        'Error in initial scraping for existing offers:',
        error,
      );
    }
  }

  private normalizeOlxUrl(url: string): string {
    if (!url) return '';
    try {
      if (url.startsWith('http')) return url;
      return url.startsWith('/')
        ? `${this.olxBaseUrl}${url}`
        : `${this.olxBaseUrl}/${url}`;
    } catch (error) {
      this.logger.error(
        `Error normalizing OLX URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return '';
    }
  }

  @Cron('0 * * * * *')
  async monitorNewOffers() {
    this.logger.log('Monitoring for new offers (2 dedicated workers)...');

    try {
      await this.threadManager.startNewOffersWorkers();
    } catch (error) {
      this.logger.error('Error monitoring new offers:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    try {
      this.logger.log(
        'Starting scraping job for OLX and Otodom with newest listings first',
      );

      const useThreads = process.env.USE_SCRAPER_THREADS !== 'false';

      if (useThreads) {
        this.logger.log('Using multi-threaded scraping approach');

        const results = await this.threadManager.scrapeWithBothThreads(
          25,
          500,
          this.defaultSortOrder,
        );

        return {
          message: 'Multi-threaded scraping completed successfully',
          olx: {
            status: 'fulfilled',
            offers: results.olx.totalOffers,
            pages: results.olx.pagesProcessed,
          },
          otodom: {
            status: 'fulfilled',
            offers: results.otodom.totalOffers,
            pages: results.otodom.pagesProcessed,
          },
          mode: 'threaded',
        };
      } else {
        this.logger.log('Using traditional concurrent scraping approach');

        const [olxResult, otodomResult] = await Promise.allSettled([
          this.scrapeOlxListings().catch((error) => {
            this.logger.error('OLX scraping failed:', error);
            return {
              error: `OLX failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }),
          this.scrapeOtodomListings().catch((error) => {
            this.logger.error('Otodom scraping failed:', error);
            return {
              error: `Otodom failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }),
        ]);

        this.logger.log(
          'OLX scraping result:',
          olxResult.status === 'fulfilled' ? 'Success' : 'Failed',
        );
        this.logger.log(
          'Otodom scraping result:',
          otodomResult.status === 'fulfilled' ? 'Success' : 'Failed',
        );

        return {
          message: 'Scraping job started successfully for both OLX and Otodom',
          olx: olxResult.status,
          otodom: otodomResult.status,
          mode: 'concurrent',
        };
      }
    } catch (error) {
      this.logger.error('Error in handleCron:', error);
      if (error instanceof Error) {
        this.logger.error('Error details:', error.message, error.stack);
      }
      throw new Error(
        `Failed to start scraping: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async scrapeOlxListings(
    pageNum = 1,
    sortOrder: SortOrder = this.defaultSortOrder,
  ) {
    let browser: Browser | undefined;

    try {
      this.logger.log(`Scraping page ${pageNum} with sort order: ${sortOrder}`);
      const url = `${this.olxBaseUrl}/nieruchomosci/mieszkania/wynajem/?search[order]=${sortOrder}&page=${pageNum}`;

      browser = await this.createBrowser();
      const page = await this.setupPage(browser);

      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      await page.waitForSelector('[data-cy="l-card"]', { timeout: 10000 });

      const offers = await page.evaluate((): string[] => {
        const cards = document.querySelectorAll('[data-cy="l-card"]');
        return Array.from(cards)
          .map((card) => {
            const link = card.querySelector('a[href*="/d/"]');
            return link?.getAttribute('href') || null;
          })
          .filter((href): href is string => href !== null);
      });

      const normalizedOffers = offers.map((link) => this.normalizeOlxUrl(link));

      this.logger.log(`Found ${normalizedOffers.length} offers to process`);

      for (const offerUrl of normalizedOffers) {
        await this.queueOffer(offerUrl, 4);
      }

      const hasNextPage = await page.$$eval(
        '[data-testid="pagination-wrapper"] [data-testid="pagination-forward"]',
        (elements) => elements.length > 0,
      );

      if (hasNextPage && pageNum < 25) {
        await this.scrapeOlxListings(pageNum + 1, sortOrder);
      }
    } catch (error) {
      this.logger.error(
        `Error scraping listings page ${pageNum}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async scrapeOtodomListings(pageNum = 1) {
    let browser: Browser | undefined;

    try {
      this.logger.log(
        `Scraping Otodom page ${pageNum} with newest listings first`,
      );
      const url = `${this.otodomBaseUrl}/pl/wyniki/wynajem/mieszkanie/cala-polska?ownerTypeSingleSelect=ALL&by=LATEST&direction=DESC&page=${pageNum}&limit=72`;
      this.logger.debug(`Otodom URL: ${url}`);

      browser = await this.createBrowser();
      const page = await this.setupPage(browser, true);

      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      await page.waitForSelector(
        'article[data-sentry-component="AdvertCard"]',
        {
          timeout: 10000,
        },
      );
      this.logger.debug(`Otodom listing cards loaded on page ${pageNum}`);

      const offers = await page.evaluate((): string[] => {
        const linkElements = document.querySelectorAll(
          'a[data-cy="listing-item-link"][href*="/pl/oferta/"]',
        );
        console.log(`Found ${linkElements.length} Otodom offer links on page`);
        return Array.from(linkElements)
          .map((link) => {
            const href = link.getAttribute('href');
            return href && href.startsWith('/')
              ? `https://www.otodom.pl${href}`
              : href;
          })
          .filter((href): href is string => href !== null);
      });

      const otodomOffers = offers;

      this.logger.log(
        `Found ${otodomOffers.length} Otodom offers to process on page ${pageNum}`,
      );
      if (pageNum === 1) {
        this.logger.debug(
          `Sample Otodom URLs: ${otodomOffers.slice(0, 3).join(', ')}`,
        );
      }

      this.logger.log(
        `Processing ${otodomOffers.length} Otodom offers directly (bypassing queue)`,
      );

      let processedCount = 0;
      let errorCount = 0;

      for (const offerUrl of otodomOffers) {
        try {
          await this.otodomExistingQueue.add(
            'processOffer',
            { url: offerUrl },
            {
              priority: 4,
              attempts: 3,
              removeOnComplete: false,
            },
          );

          processedCount++;
          this.logger.log(
            `Processed Otodom offer ${processedCount}/${otodomOffers.length}: ${offerUrl}`,
          );
        } catch (error) {
          errorCount++;
          this.logger.error(
            `Failed to process Otodom offer ${offerUrl}:`,
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      }

      this.logger.log(
        `Otodom direct processing complete: ${processedCount} successful, ${errorCount} failed`,
      );
      const hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector(
          '[data-cy="pagination.next-page"]:not([disabled])',
        );
        const hasNext = !!nextButton;
        console.log(`Otodom next page button exists and enabled: ${hasNext}`);
        return hasNext;
      });

      this.logger.debug(
        `Otodom page ${pageNum}: hasNextPage=${hasNextPage}, pageLimit=${pageNum < 500}`,
      );
      if (hasNextPage === true && pageNum < 500) {
        this.logger.log(`Moving to Otodom page ${pageNum + 1}...`);
        await this.scrapeOtodomListings(pageNum + 1);
      } else if (pageNum >= 500) {
        this.logger.log(`Reached Otodom page limit (500), stopping pagination`);
      } else {
        this.logger.log(
          `No more Otodom pages available, completed at page ${pageNum}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error scraping Otodom listings page ${pageNum}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      if (error instanceof Error) {
        this.logger.error(
          'Otodom scraping error details:',
          error.message,
          error.stack,
        );
      }
    } finally {
      if (browser) {
        this.logger.debug(`Closing Otodom browser for page ${pageNum}`);
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

  private async queueOffer(
    offerUrl: string,
    priority: number = 1,
    isNew = false,
  ) {
    try {
      const offerType = isNew ? 'NEW' : 'EXISTING';
      this.logger.log(
        `Attempting to queue ${offerType} offer: ${offerUrl} with priority ${priority}`,
      );

      const isOtodom = offerUrl.includes('otodom.pl');
      let targetQueue: Queue;
      let queueName: string;

      if (isOtodom) {
        targetQueue = isNew ? this.otodomNewQueue : this.otodomExistingQueue;
        queueName = isNew ? 'otodom-new' : 'otodom-existing';
      } else {
        targetQueue = isNew ? this.olxNewQueue : this.olxExistingQueue;
        queueName = isNew ? 'olx-new' : 'olx-existing';
      }

      const job = await targetQueue.add(
        'processOffer',
        { url: offerUrl, isNew: isNew },
        {
          priority,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: isNew ? 1000 : 2000,
          },
          removeOnComplete: false,
        },
      );

      this.logger.log(
        `Successfully queued ${offerType} job ID: ${job.id} to ${queueName} for URL: ${offerUrl}`,
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
      this.logger.error('Error in scrapeWithSortOrder:', error);
      throw new Error(
        `Failed to start scraping: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  public async scrapeOlxWithThreads(
    maxPages = 25,
    sortOrder: SortOrder = this.defaultSortOrder,
    maxWorkers = 3,
  ) {
    try {
      this.logger.log(
        `Starting threaded OLX scraping with ${maxWorkers} workers`,
      );
      const result = await this.threadManager.scrapeOlxWithWorkers(
        maxPages,
        sortOrder,
        maxWorkers,
      );
      return {
        message: `Threaded OLX scraping completed: ${result.totalOffers} offers from ${result.pagesProcessed} pages`,
        ...result,
      };
    } catch (error) {
      this.logger.error('Error in scrapeOlxWithThreads:', error);
      throw new Error(
        `Failed to start threaded OLX scraping: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  public async scrapeOtodomWithThreads(maxPages = 500, maxWorkers = 3) {
    try {
      this.logger.log(
        `Starting threaded Otodom scraping with ${maxWorkers} workers`,
      );
      const result = await this.threadManager.scrapeOtodomWithWorkers(
        maxPages,
        maxWorkers,
      );
      return {
        message: `Threaded Otodom scraping completed: ${result.totalOffers} offers from ${result.pagesProcessed} pages`,
        ...result,
      };
    } catch (error) {
      this.logger.error('Error in scrapeOtodomWithThreads:', error);
      throw new Error(
        `Failed to start threaded Otodom scraping: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  public async scrapeBothWithThreads(
    olxMaxPages = 25,
    otodomMaxPages = 500,
    sortOrder: SortOrder = this.defaultSortOrder,
  ) {
    try {
      this.logger.log(
        'Starting simultaneous threaded scraping for both OLX and Otodom',
      );
      const results = await this.threadManager.scrapeWithBothThreads(
        olxMaxPages,
        otodomMaxPages,
        sortOrder,
      );
      return {
        message: 'Simultaneous threaded scraping completed successfully',
        ...results,
      };
    } catch (error) {
      this.logger.error('Error in scrapeBothWithThreads:', error);
      throw new Error(
        `Failed to start threaded scraping: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  public async extractAddress(
    title: string,
    description?: string,
  ): Promise<AddressExtractionResult> {
    const textToAnalyze = description ? `${title}. ${description}` : title;

    this.logger.log(
      `Extracting address from text: ${textToAnalyze.substring(0, 100)}...`,
    );

    if (this.aiExtractor.isAvailable()) {
      try {
        const aiResult = await this.aiExtractor.extractAddress(
          title,
          description,
        );

        if (aiResult && (aiResult.confidence || 0) >= 0) {
          this.logger.log(
            `AI successfully extracted address: ${aiResult.fullAddress} (confidence: ${aiResult.confidence})`,
          );
          return aiResult;
        }
      } catch (error) {
        this.logger.warn(
          `AI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } else {
      const status = this.aiExtractor.getStatus();
      this.logger.debug(`AI not available: ${status.reason}`);
    }

    return {
      street: undefined,
      streetNumber: undefined,
      fullAddress: undefined,
      extractedFrom: 'title',
      rawText: textToAnalyze,
      confidence: 0,
    };
  }
}
