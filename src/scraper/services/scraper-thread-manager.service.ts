import { Injectable, Logger } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as path from 'path';
import type { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { OtodomAuthService } from './otodom-auth.service';
import type { Cookie } from 'puppeteer';

interface WorkerData {
  pageNum: number;
  sortOrder: string;
  baseUrl: string;
  userAgents: string[];
  isNewOffersOnly?: boolean;
  cookies?: Cookie[];
}

interface WorkerResult {
  success: boolean;
  offers: string[];
  hasNextPage: boolean;
  error?: string;
  pageNum: number;
  source: 'olx' | 'otodom';
  newOffers?: string[];
}

export enum SortOrder {
  NEWEST = 'created_at:desc',
  OLDEST = 'created_at:asc',
  PRICE_LOW_TO_HIGH = 'filter_float_price:asc',
  PRICE_HIGH_TO_LOW = 'filter_float_price:desc',
}

@Injectable()
export class ScraperThreadManagerService {
  private readonly logger = new Logger(ScraperThreadManagerService.name);
  private readonly olxBaseUrl = 'https://www.olx.pl';
  private readonly otodomBaseUrl = 'https://www.otodom.pl';

  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/116.0.1938.69',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
  ];

  constructor(
    @InjectQueue('olx-existing') private readonly olxExistingQueue: Queue,
    @InjectQueue('otodom-existing') private readonly otodomExistingQueue: Queue,
    @InjectQueue('olx-new') private readonly olxNewQueue: Queue,
    @InjectQueue('otodom-new') private readonly otodomNewQueue: Queue,
    private readonly otodomAuth: OtodomAuthService,
  ) {}

  public async startExistingOffersWorkers(): Promise<void> {
    this.logger.log('Starting dedicated workers for existing offers...');

    const olxExistingPromise = this.runEnhancedOlxWorker(false);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const otodomExistingPromise = this.runEnhancedOtodomWorker(false);

    await Promise.allSettled([olxExistingPromise, otodomExistingPromise]);
  }

  public async startNewOffersWorkers(): Promise<void> {
    this.logger.log('Starting dedicated workers for new offers...');

    const olxNewPromise = this.runEnhancedOlxWorker(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const otodomNewPromise = this.runEnhancedOtodomWorker(true);

    await Promise.allSettled([olxNewPromise, otodomNewPromise]);
  }

  private async runEnhancedOlxWorker(isNewOffersOnly: boolean): Promise<void> {
    const workerType = isNewOffersOnly ? 'NEW' : 'EXISTING';
    this.logger.log(`Starting OLX worker for ${workerType} offers`);

    return new Promise((resolve, reject) => {
      const workerData = {
        pageNum: 1,
        sortOrder: SortOrder.NEWEST,
        baseUrl: this.olxBaseUrl,
        userAgents: this.userAgents,
        isNewOffersOnly,
      };

      const workerPath = path.join(__dirname, '..', 'workers', 'olx-worker.js');
      const worker = new Worker(workerPath, { workerData });

      worker.on('message', (result: WorkerResult) => {
        if (result.success) {
          this.logger.log(
            `OLX ${workerType} worker found ${result.offers.length} offers`,
          );

          const queue = isNewOffersOnly
            ? this.olxNewQueue
            : this.olxExistingQueue;

          this.logger.log(
            `Queueing ${result.offers.length} OLX ${workerType} offers for processing...`,
          );

          result.offers.forEach((offerUrl, index) => {
            queue
              .add(
                'processOffer',
                { url: offerUrl, isNew: isNewOffersOnly },
                {
                  priority: isNewOffersOnly ? 1 : 5,
                  attempts: 3,
                  backoff: { type: 'exponential', delay: 2000 },
                },
              )
              .then((job) => {
                this.logger.debug(
                  `Queued OLX offer ${index + 1}/${result.offers.length}: ${offerUrl} (Job ID: ${job.id})`,
                );
              })
              .catch((err) => {
                this.logger.error(
                  `Failed to queue OLX offer: ${offerUrl}`,
                  err,
                );
              });
          });
        } else {
          this.logger.error(`OLX ${workerType} worker failed:`, result.error);
        }
      });

      worker.on('error', (error) => {
        this.logger.error(`OLX ${workerType} worker error:`, error);
        reject(error);
      });

      worker.on('exit', (code) => {
        this.logger.log(`OLX ${workerType} worker exited with code ${code}`);
        if (code !== 0) {
          reject(new Error(`OLX worker stopped with exit code ${code}`));
        } else {
          resolve();
        }
      });
    });
  }

  private async runEnhancedOtodomWorker(
    isNewOffersOnly: boolean,
  ): Promise<void> {
    const workerType = isNewOffersOnly ? 'NEW' : 'EXISTING';
    this.logger.log(`Starting Otodom worker for ${workerType} offers`);

    let cookies: Cookie[] | null = null;
    if (this.otodomAuth.isAuthConfigured()) {
      try {
        cookies = await this.otodomAuth.getCookiesForWorker();
        if (cookies) {
          this.logger.log(
            `Obtained ${cookies.length} Otodom auth cookies for worker`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to get Otodom auth cookies: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return new Promise((resolve, reject) => {
      const workerData: WorkerData = {
        pageNum: 1,
        sortOrder: 'created_at:desc',
        baseUrl: this.otodomBaseUrl,
        userAgents: this.userAgents,
        isNewOffersOnly,
        cookies: cookies || undefined,
      };

      const workerPath = path.join(
        __dirname,
        '..',
        'workers',
        'otodom-worker.js',
      );
      const worker = new Worker(workerPath, { workerData });

      worker.on('message', (result: WorkerResult) => {
        if (result.success) {
          this.logger.log(
            `Otodom ${workerType} worker found ${result.offers.length} offers`,
          );

          const queue = isNewOffersOnly
            ? this.otodomNewQueue
            : this.otodomExistingQueue;
          for (const offerUrl of result.offers) {
            queue
              .add(
                'processOffer',
                { url: offerUrl, isNew: isNewOffersOnly },
                {
                  priority: isNewOffersOnly ? 1 : 5,
                  attempts: 3,
                  backoff: { type: 'exponential', delay: 2000 },
                },
              )
              .catch((err) => {
                this.logger.error(
                  `Failed to queue Otodom offer: ${offerUrl}`,
                  err,
                );
              });
          }
        } else {
          this.logger.error(
            `Otodom ${workerType} worker failed:`,
            result.error,
          );
        }
      });

      worker.on('error', (error) => {
        this.logger.error(`Otodom ${workerType} worker error:`, error);
        reject(error);
      });

      worker.on('exit', (code) => {
        this.logger.log(`Otodom ${workerType} worker exited with code ${code}`);
        if (code !== 0) {
          reject(new Error(`Otodom worker stopped with exit code ${code}`));
        } else {
          resolve();
        }
      });
    });
  }

  public async scrapeOlxWithWorkers(
    maxPages = 25,
    sortOrder: SortOrder = SortOrder.NEWEST,
    maxConcurrentWorkers = 1,
  ): Promise<{ totalOffers: number; pagesProcessed: number }> {
    this.logger.log(
      `Starting multi-threaded OLX scraping with ${maxConcurrentWorkers} workers`,
    );

    let currentPage = 1;
    let totalOffers = 0;
    let pagesProcessed = 0;
    const activeWorkers = new Set<Worker>();

    const createWorker = (pageNum: number): Promise<WorkerResult> => {
      return new Promise((resolve) => {
        try {
          const workerData: WorkerData = {
            pageNum,
            sortOrder,
            baseUrl: this.olxBaseUrl,
            userAgents: this.userAgents,
            isNewOffersOnly: false,
          };

          const workerPath = path.join(
            __dirname,
            '..',
            'workers',
            'olx-worker.js',
          );
          const worker = new Worker(workerPath, { workerData });

          activeWorkers.add(worker);

          const timeout = setTimeout(() => {
            this.logger.warn(
              `OLX Worker timeout on page ${pageNum}, terminating...`,
            );
            void worker.terminate();
            activeWorkers.delete(worker);
            resolve({
              success: false,
              offers: [],
              hasNextPage: false,
              pageNum,
              source: 'olx',
              error: 'Worker timeout',
            });
          }, 30000);

          worker.on('message', (result: WorkerResult) => {
            clearTimeout(timeout);
            activeWorkers.delete(worker);
            resolve(result);
          });

          worker.on('error', (error) => {
            clearTimeout(timeout);
            activeWorkers.delete(worker);
            this.logger.error(`OLX Worker error on page ${pageNum}:`, error);
            resolve({
              success: false,
              offers: [],
              hasNextPage: false,
              pageNum,
              source: 'olx',
              error: error.message,
            });
          });

          worker.on('exit', (code) => {
            clearTimeout(timeout);
            activeWorkers.delete(worker);
            if (code !== 0) {
              this.logger.error(`OLX Worker stopped with exit code ${code}`);
              resolve({
                success: false,
                offers: [],
                hasNextPage: false,
                pageNum,
                source: 'olx',
                error: `Worker exit code ${code}`,
              });
            }
          });
        } catch (error) {
          this.logger.error(
            `Failed to create OLX worker for page ${pageNum}:`,
            error,
          );
          resolve({
            success: false,
            offers: [],
            hasNextPage: false,
            pageNum,
            source: 'olx',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });
    };

    try {
      while (currentPage <= maxPages) {
        const batch: Promise<WorkerResult>[] = [];

        for (
          let i = 0;
          i < maxConcurrentWorkers && currentPage <= maxPages;
          i++
        ) {
          batch.push(createWorker(currentPage));
          this.logger.log(`Created OLX worker for page ${currentPage}`);
          currentPage++;
        }

        const results = await Promise.allSettled(batch);

        let shouldContinue = false;

        for (const result of results) {
          if (result.status === 'fulfilled') {
            const workerResult = result.value;
            pagesProcessed++;

            if (workerResult.success) {
              this.logger.log(
                `OLX Page ${workerResult.pageNum}: ${workerResult.offers.length} offers found`,
              );

              for (const offerUrl of workerResult.offers) {
                await this.queueOffer(offerUrl, 4);
                totalOffers++;
              }

              if (workerResult.hasNextPage && currentPage <= maxPages) {
                shouldContinue = true;
              }
            } else {
              this.logger.error(
                `OLX Page ${workerResult.pageNum} failed: ${workerResult.error}`,
              );
            }
          } else {
            this.logger.error(`OLX Worker failed:`, result.reason);
          }
        }

        if (!shouldContinue) {
          this.logger.log('OLX: No more pages available, stopping pagination');
          break;
        }
      }

      this.logger.log(
        `OLX multi-threaded scraping completed: ${totalOffers} offers queued from ${pagesProcessed} pages`,
      );

      return { totalOffers, pagesProcessed };
    } finally {
      for (const worker of activeWorkers) {
        await worker.terminate();
      }
    }
  }

  public async scrapeOtodomWithWorkers(
    maxPages = 500,
    maxConcurrentWorkers = 1,
  ): Promise<{ totalOffers: number; pagesProcessed: number }> {
    this.logger.log(
      `Starting multi-threaded Otodom scraping with ${maxConcurrentWorkers} workers`,
    );

    let cookies: Cookie[] | null = null;
    if (this.otodomAuth.isAuthConfigured()) {
      try {
        cookies = await this.otodomAuth.getCookiesForWorker();
        if (cookies) {
          this.logger.log(
            `Obtained ${cookies.length} Otodom auth cookies for workers`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to get Otodom auth cookies: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    let currentPage = 1;
    let totalOffers = 0;
    let pagesProcessed = 0;
    const activeWorkers = new Set<Worker>();

    const createWorker = (pageNum: number): Promise<WorkerResult> => {
      return new Promise((resolve) => {
        try {
          const workerData: WorkerData = {
            pageNum,
            sortOrder: 'created_at:desc',
            baseUrl: this.otodomBaseUrl,
            userAgents: this.userAgents,
            isNewOffersOnly: false,
            cookies: cookies || undefined,
          };

          const workerPath = path.join(
            __dirname,
            '..',
            'workers',
            'otodom-worker.js',
          );
          const worker = new Worker(workerPath, { workerData });

          activeWorkers.add(worker);

          const timeout = setTimeout(() => {
            this.logger.warn(
              `Otodom Worker timeout on page ${pageNum}, terminating...`,
            );
            void worker.terminate();
            activeWorkers.delete(worker);
            resolve({
              success: false,
              offers: [],
              hasNextPage: false,
              pageNum,
              source: 'otodom',
              error: 'Worker timeout',
            });
          }, 30000);

          worker.on('message', (result: WorkerResult) => {
            clearTimeout(timeout);
            activeWorkers.delete(worker);
            resolve(result);
          });

          worker.on('error', (error) => {
            clearTimeout(timeout);
            activeWorkers.delete(worker);
            this.logger.error(`Otodom Worker error on page ${pageNum}:`, error);
            resolve({
              success: false,
              offers: [],
              hasNextPage: false,
              pageNum,
              source: 'otodom',
              error: error.message,
            });
          });

          worker.on('exit', (code) => {
            clearTimeout(timeout);
            activeWorkers.delete(worker);
            if (code !== 0) {
              this.logger.error(`Otodom Worker stopped with exit code ${code}`);
              resolve({
                success: false,
                offers: [],
                hasNextPage: false,
                pageNum,
                source: 'otodom',
                error: `Worker exit code ${code}`,
              });
            }
          });
        } catch (error) {
          this.logger.error(
            `Failed to create Otodom worker for page ${pageNum}:`,
            error,
          );
          resolve({
            success: false,
            offers: [],
            hasNextPage: false,
            pageNum,
            source: 'otodom',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });
    };

    try {
      while (currentPage <= maxPages) {
        const batch: Promise<WorkerResult>[] = [];

        for (
          let i = 0;
          i < maxConcurrentWorkers && currentPage <= maxPages;
          i++
        ) {
          batch.push(createWorker(currentPage));
          this.logger.log(`Created Otodom worker for page ${currentPage}`);
          currentPage++;
        }

        const results = await Promise.allSettled(batch);

        let shouldContinue = false;

        for (const result of results) {
          if (result.status === 'fulfilled') {
            const workerResult = result.value;
            pagesProcessed++;

            if (workerResult.success) {
              this.logger.log(
                `Otodom Page ${workerResult.pageNum}: ${workerResult.offers.length} offers found`,
              );

              for (const offerUrl of workerResult.offers) {
                await this.queueOffer(offerUrl, 4);
                totalOffers++;
              }

              if (workerResult.hasNextPage && currentPage <= maxPages) {
                shouldContinue = true;
              }
            } else {
              this.logger.error(
                `Otodom Page ${workerResult.pageNum} failed: ${workerResult.error}`,
              );
            }
          } else {
            this.logger.error(`Otodom Worker failed:`, result.reason);
          }
        }

        if (!shouldContinue) {
          this.logger.log(
            'Otodom: No more pages available, stopping pagination',
          );
          break;
        }
      }

      this.logger.log(
        `Otodom multi-threaded scraping completed: ${totalOffers} offers queued from ${pagesProcessed} pages`,
      );

      return { totalOffers, pagesProcessed };
    } finally {
      for (const worker of activeWorkers) {
        await worker.terminate();
      }
    }
  }

  public async scrapeWithBothThreads(
    olxMaxPages = 25,
    otodomMaxPages = 500,
    sortOrder: SortOrder = SortOrder.NEWEST,
  ): Promise<{
    olx: { totalOffers: number; pagesProcessed: number };
    otodom: { totalOffers: number; pagesProcessed: number };
  }> {
    this.logger.log('Starting multi-threaded scraping for both OLX and Otodom');

    const [olxResult, otodomResult] = await Promise.allSettled([
      this.scrapeOlxWithWorkers(olxMaxPages, sortOrder, 1),
      this.scrapeOtodomWithWorkers(otodomMaxPages, 1),
    ]);

    const results = {
      olx:
        olxResult.status === 'fulfilled'
          ? olxResult.value
          : { totalOffers: 0, pagesProcessed: 0 },
      otodom:
        otodomResult.status === 'fulfilled'
          ? otodomResult.value
          : { totalOffers: 0, pagesProcessed: 0 },
    };

    this.logger.log(
      `Multi-threaded scraping completed!
      OLX: ${results.olx.totalOffers} offers from ${results.olx.pagesProcessed} pages
      Otodom: ${results.otodom.totalOffers} offers from ${results.otodom.pagesProcessed} pages`,
    );

    return results;
  }

  private async queueOffer(offerUrl: string, priority = 1, isNew = false) {
    try {
      const offerType = isNew ? 'NEW' : 'EXISTING';

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

      this.logger.debug(
        `Queued ${offerType} job ID: ${job.id} to ${queueName} with priority ${priority} for URL: ${offerUrl}`,
      );
    } catch (error) {
      this.logger.error(`Failed to queue job for ${offerUrl}:`, error);
      throw error;
    }
  }
}
