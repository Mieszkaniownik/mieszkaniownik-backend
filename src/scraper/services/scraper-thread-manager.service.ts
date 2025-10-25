import type { Queue } from "bullmq";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";

import { BrowserSetupService } from "./browser-setup.service";
import { OtodomAuthService } from "./otodom-auth.service";

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

        const result = await this.browserSetup.scrapeWithBrowser<{
          offers: string[];
          hasNextPage: boolean;
        }>(url, false, async (page) => {
          await page
            .waitForSelector('[data-cy="listing-grid"]', { timeout: 10_000 })
            .catch(() => {
              this.logger.warn(
                `OLX page ${String(pageNumber)}: listing-grid not found`,
              );
            });

          // Extract offers directly in browser context
          const offers = await page.evaluate(() => {
            const links = [
              ...document.querySelectorAll('a[href*="/d/oferta/"]'),
            ];
            const uniqueUrls = new Set<string>();
            for (const a of links) {
              const href = (a as HTMLAnchorElement).href;
              if (href.includes("olx.pl/d/oferta/")) {
                uniqueUrls.add(href);
              }
            }
            return [...uniqueUrls];
          });

          // Check for next page
          const hasNextPage = await page.evaluate(() => {
            return (
              document.querySelector('[data-testid="pagination-forward"]') !==
                null ||
              document.querySelector('[aria-label="następna strona"]') !== null
            );
          });

          return { offers, hasNextPage };
        });

        if (result.offers.length > 0) {
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

        const result = await this.browserSetup.scrapeWithBrowser<{
          offers: string[];
          hasNextPage: boolean;
        }>(url, true, async (page) => {
          await page
            .waitForSelector('[data-cy="search.listing"]', {
              timeout: 15_000,
            })
            .catch(() => {
              this.logger.warn(
                `Otodom page ${String(pageNumber)}: search.listing not found`,
              );
            });

          // Extract offers directly in browser context
          const offers = await page.evaluate(() => {
            const links = [
              ...document.querySelectorAll('a[href*="/pl/oferta/"]'),
            ];
            const uniqueUrls = new Set<string>();
            for (const a of links) {
              const href = (a as HTMLAnchorElement).href;
              if (href.includes("otodom.pl/pl/oferta/")) {
                uniqueUrls.add(href);
              }
            }
            return [...uniqueUrls];
          });

          // Check for next page
          const hasNextPage = await page.evaluate(() => {
            return (
              document.querySelector('[data-cy="pagination.next-page"]') !==
                null ||
              document.querySelector('[aria-label="następna strona"]') !==
                null ||
              document.querySelector('[aria-label="Next page"]') !== null
            );
          });

          return { offers, hasNextPage };
        });

        if (result.offers.length > 0) {
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
}
