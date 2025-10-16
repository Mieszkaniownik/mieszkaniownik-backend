import { isMainThread, parentPort, workerData } from 'worker_threads';
import * as puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';

export interface ScraperWorkerData {
  pageNum: number;
  sortOrder: string;
  baseUrl: string;
  userAgents: string[];
  isNewOffersOnly?: boolean;
}

export interface ScraperWorkerResult {
  success: boolean;
  offers: string[];
  hasNextPage: boolean;
  error?: string;
  pageNum: number;
  source: 'olx' | 'otodom';
  newOffers?: string[];
}

if (!isMainThread && parentPort) {
  const data = workerData as ScraperWorkerData;

  async function scrapeOlxPage(): Promise<ScraperWorkerResult> {
    let browser: Browser | undefined;

    try {
      console.log(
        `WorkerResultOLX Worker: Scraping page ${data.pageNum} (new offers only: ${data.isNewOffersOnly || false})`,
      );
      const url = `${data.baseUrl}/nieruchomosci/mieszkania/wynajem/?search[order]=${data.sortOrder}&page=${data.pageNum}`;

      browser = await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--disable-background-networking',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-ipc-flooding-protection',
        ],
      });

      const page = await browser.newPage();
      const userAgent =
        data.userAgents[Math.floor(Math.random() * data.userAgents.length)];

      await page.setUserAgent(userAgent);
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Sec-Ch-Ua':
          '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Linux"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      });

      await page.setViewport({ width: 1920, height: 1080 });

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => ['pl-PL', 'pl', 'en-US', 'en'],
        });

        Object.defineProperty(window, 'chrome', {
          value: { runtime: {} },
          writable: true,
        });
      });

      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 3000 + 2000),
      );

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

      const normalizedOffers = offers
        .map((link) => {
          if (!link) return '';
          try {
            if (link.startsWith('http')) return link;
            return link.startsWith('/')
              ? `${data.baseUrl}${link}`
              : `${data.baseUrl}/${link}`;
          } catch (error) {
            console.error(
              `Error normalizing OLX URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            return '';
          }
        })
        .filter((url) => url !== '');

      let hasNextPage = false;
      if (!data.isNewOffersOnly) {
        hasNextPage = await page.$$eval(
          '[data-testid="pagination-wrapper"] [data-testid="pagination-forward"]',
          (elements) => elements.length > 0,
        );
      }

      console.log(
        `WorkerResultOLX Worker: Found ${normalizedOffers.length} offers on page ${data.pageNum}, hasNextPage: ${hasNextPage}`,
      );

      return {
        success: true,
        offers: normalizedOffers,
        hasNextPage,
        pageNum: data.pageNum,
        source: 'olx',
      };
    } catch (error) {
      console.error(
        `WorkerResultOLX Worker: Error scraping page ${data.pageNum}:`,
        error,
      );
      return {
        success: false,
        offers: [],
        hasNextPage: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        pageNum: data.pageNum,
        source: 'olx',
      };
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log(`OLX Worker: Browser closed for page ${data.pageNum}`);
        } catch (closeError) {
          console.error(
            `OLX Worker: Error closing browser for page ${data.pageNum}:`,
            closeError,
          );
        }
      }
    }
  }

  scrapeOlxPage()
    .then((result) => {
      parentPort!.postMessage(result);
      process.exit(0);
    })
    .catch((error) => {
      parentPort!.postMessage({
        success: false,
        offers: [],
        hasNextPage: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        pageNum: data.pageNum,
        source: 'olx',
      });
      process.exit(1);
    });
}
