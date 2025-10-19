import type { Queue } from "bullmq";
import path from "node:path";
import { Worker } from "node:worker_threads";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";

import { BrowserSetupService } from "./browser-setup.service";
import { OtodomAuthService } from "./otodom-auth.service";

interface ExtractorWorkerData {
  pageNum: number;
  html: string;
  isNewOffersOnly?: boolean;
}

interface WorkerResult {
  success: boolean;
  offers: string[];
  hasNextPage: boolean;
  error?: string;
  pageNum: number;
  source: "olx" | "otodom";
}

export enum SortOrder {
  NEWEST = "created_at:desc",
  OLDEST = "created_at:asc",
  PRICE_LOW_TO_HIGH = "filter_float_price:asc",
  PRICE_HIGH_TO_LOW = "filter_float_price:desc",
}

@Injectable()
export class ScraperThreadManagerService {
  private readonly logger = new Logger(ScraperThreadManagerService.name);
  private readonly olxBaseUrl = "https://www.olx.pl";
  private readonly otodomBaseUrl = "https://www.otodom.pl";

  private readonly userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/116.0.1938.69",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0",
  ];

  constructor(
    @InjectQueue("olx-existing") private readonly olxExistingQueue: Queue,
    @InjectQueue("otodom-existing") private readonly otodomExistingQueue: Queue,
    @InjectQueue("olx-new") private readonly olxNewQueue: Queue,
    @InjectQueue("otodom-new") private readonly otodomNewQueue: Queue,
    private readonly otodomAuth: OtodomAuthService,
    private readonly browserSetup: BrowserSetupService,
  ) {}

  public async startExistingOffersWorkers(): Promise<void> {
    this.logger.log("Starting dedicated workers for existing offers...");

    const olxExistingPromise = this.runEnhancedOlxWorker(false);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const otodomExistingPromise = this.runEnhancedOtodomWorker(false);

    await Promise.allSettled([olxExistingPromise, otodomExistingPromise]);
  }

  public async startNewOffersWorkers(): Promise<void> {
    this.logger.log("Starting dedicated workers for new offers...");

    const olxNewPromise = this.runEnhancedOlxWorker(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const otodomNewPromise = this.runEnhancedOtodomWorker(true);

    await Promise.allSettled([olxNewPromise, otodomNewPromise]);
  }

  private async runEnhancedOlxWorker(isNewOffersOnly: boolean): Promise<void> {
    const workerType = isNewOffersOnly ? "NEW" : "EXISTING";
    this.logger.log(`Starting OLX worker for ${workerType} offers`);

    const sortOrder = SortOrder.NEWEST;
    const queue = isNewOffersOnly ? this.olxNewQueue : this.olxExistingQueue;
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore && pageNumber <= 10) {
      try {
        const url = `${this.olxBaseUrl}/nieruchomosci/mieszkania/wynajem/?search[order]=${sortOrder}&page=${String(pageNumber)}`;

        this.logger.log(`OLX: Fetching page ${String(pageNumber)}`);

        const html = await this.browserSetup.scrapeWithBrowser<string>(
          url,
          false,
          async (page) => {
            await page
              .waitForSelector('[data-cy="listing-grid"]', { timeout: 10_000 })
              .catch(() => {
                this.logger.warn(
                  `OLX page ${String(pageNumber)}: listing-grid not found`,
                );
              });
            return await page.content();
          },
        );

        const result = await this.extractOffersWithWorker(
          {
            pageNum: pageNumber,
            html,
            isNewOffersOnly,
          },
          "olx",
        );

        if (result.success && result.offers.length > 0) {
          this.logger.log(
            `OLX ${workerType} page ${String(pageNumber)} found ${String(result.offers.length)} offers`,
          );

          for (const [index, offerUrl] of result.offers.entries()) {
            queue
              .add(
                "processOffer",
                { url: offerUrl, isNew: isNewOffersOnly },
                {
                  priority: isNewOffersOnly ? 1 : 5,
                  attempts: 3,
                  backoff: { type: "exponential", delay: 2000 },
                },
              )
              .then((job) => {
                this.logger.debug(
                  `Queued OLX offer ${String(index + 1)}/${String(result.offers.length)}: ${offerUrl} (Job ID: ${job.id ?? "unknown"})`,
                );
              })
              .catch((error: unknown) => {
                this.logger.error(
                  `Failed to queue OLX offer: ${offerUrl}`,
                  error,
                );
              });
          }

          hasMore = result.hasNextPage;
        } else {
          this.logger.log(
            `OLX page ${String(pageNumber)}: No offers found or extraction failed`,
          );
          hasMore = false;
        }

        pageNumber++;
      } catch (error) {
        this.logger.error(`OLX page ${String(pageNumber)} failed:`, error);
        hasMore = false;
      }
    }

    this.logger.log(
      `OLX ${workerType} worker completed: processed ${String(pageNumber - 1)} pages`,
    );
  }

  private async extractOffersWithWorker(
    data: ExtractorWorkerData,
    source: "olx" | "otodom",
  ): Promise<WorkerResult> {
    return new Promise((resolve) => {
      const workerPath = path.join(
        process.cwd(),
        "dist",
        "src",
        "scraper",
        "workers",
        `${source}-extractor.worker.js`,
      );

      const worker = new Worker(workerPath, { workerData: data });

      const timeout = setTimeout(() => {
        this.logger.warn(
          `${source.toUpperCase()} extractor worker timeout on page ${String(data.pageNum)}, terminating...`,
        );
        void worker.terminate();
        resolve({
          success: false,
          offers: [],
          hasNextPage: false,
          pageNum: data.pageNum,
          source,
          error: "Worker timeout",
        });
      }, 10_000);

      worker.on("message", (result: WorkerResult) => {
        clearTimeout(timeout);
        resolve(result);
      });

      worker.on("error", (error) => {
        clearTimeout(timeout);
        this.logger.error(
          `${source.toUpperCase()} extractor worker error:`,
          error,
        );
        resolve({
          success: false,
          offers: [],
          hasNextPage: false,
          pageNum: data.pageNum,
          source,
          error: error.message,
        });
      });

      worker.on("exit", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          this.logger.error(
            `${source.toUpperCase()} extractor worker exited with code ${String(code)}`,
          );
        }
      });
    });
  }

  private async runEnhancedOtodomWorker(
    isNewOffersOnly: boolean,
  ): Promise<void> {
    const workerType = isNewOffersOnly ? "NEW" : "EXISTING";
    this.logger.log(`Starting Otodom worker for ${workerType} offers`);

    const queue = isNewOffersOnly
      ? this.otodomNewQueue
      : this.otodomExistingQueue;
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore && pageNumber <= 10) {
      try {
        const url = `${this.otodomBaseUrl}/pl/wyniki/wynajem/mieszkanie/cala-polska?ownerTypeSingleSelect=ALL&by=LATEST&direction=DESC&page=${String(pageNumber)}&limit=72`;

        this.logger.log(`Otodom: Fetching page ${String(pageNumber)}`);

        const html = await this.browserSetup.scrapeWithBrowser<string>(
          url,
          true,
          async (page) => {
            await page
              .waitForSelector('[data-cy="search.listing"]', {
                timeout: 15_000,
              })
              .catch(() => {
                this.logger.warn(
                  `Otodom page ${String(pageNumber)}: search.listing not found`,
                );
              });
            return await page.content();
          },
        );

        const result = await this.extractOffersWithWorker(
          {
            pageNum: pageNumber,
            html,
            isNewOffersOnly,
          },
          "otodom",
        );

        if (result.success && result.offers.length > 0) {
          this.logger.log(
            `Otodom ${workerType} page ${String(pageNumber)} found ${String(result.offers.length)} offers`,
          );

          for (const [index, offerUrl] of result.offers.entries()) {
            queue
              .add(
                "processOffer",
                { url: offerUrl, isNew: isNewOffersOnly },
                {
                  priority: isNewOffersOnly ? 1 : 5,
                  attempts: 3,
                  backoff: { type: "exponential", delay: 2000 },
                },
              )
              .then((job) => {
                this.logger.debug(
                  `Queued Otodom offer ${String(index + 1)}/${String(result.offers.length)}: ${offerUrl} (Job ID: ${job.id ?? "unknown"})`,
                );
              })
              .catch((error: unknown) => {
                this.logger.error(
                  `Failed to queue Otodom offer: ${offerUrl}`,
                  error,
                );
              });
          }

          hasMore = result.hasNextPage;
        } else {
          this.logger.log(
            `Otodom page ${String(pageNumber)}: No offers found or extraction failed`,
          );
          hasMore = false;
        }

        pageNumber++;
      } catch (error) {
        this.logger.error(`Otodom page ${String(pageNumber)} failed:`, error);
        hasMore = false;
      }
    }

    this.logger.log(
      `Otodom ${workerType} worker completed: processed ${String(pageNumber - 1)} pages`,
    );
  }

  private async queueOffer(offerUrl: string, priority = 1, isNew = false) {
    try {
      const offerType = isNew ? "NEW" : "EXISTING";

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

      this.logger.debug(
        `Queued ${offerType} job ID: ${job.id ?? "unknown"} to ${queueName} with priority ${String(priority)} for URL: ${offerUrl}`,
      );
    } catch (error) {
      this.logger.error(`Failed to queue job for ${offerUrl}:`, error);
      throw error;
    }
  }
}
